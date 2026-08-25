import { Router } from "express";
import { ensureSuperuserAuth, pb } from "../services/pocketbase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const progressRouter = Router();
progressRouter.use(requireAuth);

progressRouter.get("/heatmap", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();

  const days = Number(req.query.days ?? 90);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const reviews = await pb.collection("reviews").getFullList({
    filter: pb.filter("user_id = {:uid} && reviewed_at >= {:start}", { uid: req.userId, start: startDate }),
    fields: "reviewed_at",
  });

  const counts: Record<string, number> = {};
  reviews.forEach((r) => {
    const date = new Date(r.reviewed_at).toISOString().split("T")[0];
    counts[date] = (counts[date] ?? 0) + 1;
  });

  const heatmap = Object.entries(counts).map(([date, count]) => ({ date, count }));
  res.json({ heatmap });
});

progressRouter.get("/retention", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();

  // Use last 30 days of actual review ratings: correct = rating >= 3
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const reviews = await pb.collection("reviews").getFullList({
    filter: pb.filter("user_id = {:uid} && reviewed_at >= {:since}", { uid: req.userId, since }),
    fields: "rating,reviewed_at",
  });

  const total = reviews.length;
  const correct = reviews.filter((r) => Number(r.rating) >= 3).length;
  const retentionRate = total > 0 ? Math.round((correct / total) * 100) : 0;

  // Card-level stats for context
  const cards = await pb.collection("cards").getFullList({
    filter: pb.filter("user_id = {:uid}", { uid: req.userId }),
    fields: "reps,lapses",
  });
  const studied = cards.filter((c) => c.reps > 0).length;
  const lapsed = cards.filter((c) => c.lapses > 0).length;
  const avgReps = studied > 0 ? Math.round((cards.reduce((sum, c) => sum + c.reps, 0) / studied) * 10) / 10 : 0;

  res.json({ studied, lapsed, avgReps, retentionRate, total, correct });
});

progressRouter.get("/first-understanding", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();

  const reviews = await pb.collection("reviews").getFullList({
    filter: pb.filter("user_id = {:uid}", { uid: req.userId }),
    fields: "card_id,rating,reviewed_at",
    sort: "reviewed_at",
  });

  const firstReviews = new Map<string, number>();
  for (const r of reviews) {
    if (!firstReviews.has(r.card_id)) firstReviews.set(r.card_id, Number(r.rating));
  }

  const total = firstReviews.size;
  const correct = [...firstReviews.values()].filter((r) => r >= 3).length;
  res.json({ rate: total > 0 ? Math.round((correct / total) * 100) : 0, correct, total });
});

// Seed sample review history for demo purposes
progressRouter.post("/seed-sample-data", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();

  const cards = await pb.collection("cards").getFullList({
    filter: pb.filter("user_id = {:uid}", { uid: req.userId }),
    fields: "id",
  });

  if (cards.length === 0) return res.json({ seeded: 0 });

  // Generate ~14 days of realistic review history
  const DAILY_COUNTS = [5, 3, 7, 12, 8, 15, 6, 9, 4, 11, 7, 13, 10, 5];
  const created: number[] = [];

  for (let daysAgo = 13; daysAgo >= 0; daysAgo--) {
    const count = DAILY_COUNTS[13 - daysAgo];
    for (let i = 0; i < count; i++) {
      const card = cards[Math.floor(Math.random() * cards.length)];
      const reviewedAt = new Date();
      reviewedAt.setDate(reviewedAt.getDate() - daysAgo);
      reviewedAt.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));
      // ~80% correct (rating 3 or 4), ~20% wrong (rating 1)
      const rating = Math.random() < 0.8 ? (Math.random() < 0.5 ? 3 : 4) : 1;
      await pb.collection("reviews").create({
        card_id: card.id,
        user_id: req.userId,
        rating,
        reviewed_at: reviewedAt.toISOString(),
      });
    }
    created.push(count);
  }

  res.json({ seeded: created.reduce((a, b) => a + b, 0) });
});
