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

  const cards = await pb.collection("cards").getFullList({
    filter: pb.filter("user_id = {:uid}", { uid: req.userId }),
    fields: "reps,lapses,due_at,last_reviewed_at",
  });

  const now = Date.now();
  const studied = cards.filter((c) => c.reps > 0).length;
  const mastered = cards.filter((c) => c.reps >= 4 && c.lapses === 0).length;
  const lapsed = cards.filter((c) => c.lapses > 0).length;

  const avgReps = studied > 0 ? Math.round((cards.reduce((sum, c) => sum + c.reps, 0) / studied) * 10) / 10 : 0;
  const retentionRate =
    studied > 0 ? Math.round(((studied - lapsed) / studied) * 100) : 0;

  res.json({
    studied,
    mastered,
    lapsed,
    avgReps,
    retentionRate,
  });
});
