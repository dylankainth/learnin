import { Router } from "express";
import { z } from "zod";
import { ensureSuperuserAuth, pb } from "../services/pocketbase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { schedule, type CardState, type Rating, type CardReview } from "../services/srs.js";

export const reviewRouter = Router();
reviewRouter.use(requireAuth);

reviewRouter.get("/due", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();

  const limit = Math.min(Number(req.query.limit ?? 20), 50);
  const documentId = typeof req.query.documentId === "string" ? req.query.documentId : null;
  const interleave = req.query.interleave !== "false"; // Default true

  const filterExpr = documentId
    ? "user_id = {:uid} && due_at <= {:now} && document_id = {:docId}"
    : "user_id = {:uid} && due_at <= {:now}";
  const { items: cards } = await pb.collection("cards").getList(1, limit * 3, {
    filter: pb.filter(filterExpr, { uid: req.userId, now: new Date(), docId: documentId }),
    sort: interleave ? "-due_at" : "due_at",
  });

  // Interleave: shuffle order but keep due cards prioritized
  let finalCards = cards.slice(0, limit);
  if (interleave && !documentId && cards.length > limit) {
    // Fisher-Yates shuffle for randomization
    finalCards = cards.slice(0, limit);
    for (let i = finalCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [finalCards[i], finalCards[j]] = [finalCards[j], finalCards[i]];
    }
  }

  const docs = await pb.collection("documents").getFullList({
    filter: pb.filter("user_id = {:uid}", { uid: req.userId }),
    fields: "id,title",
  });
  const titleById = new Map(docs.map((d) => [d.id, d.title]));

  res.json({
    cards: finalCards.map((c) => ({
      id: c.id,
      question: c.question,
      options: c.options ?? null,
      answer: c.answer,
      explanation: c.explanation,
      due_at: c.due_at,
      document_title: titleById.get(c.document_id) ?? "",
      question_type: c.question_type ?? "multiple-choice",
      elaboration_prompt: c.elaboration_prompt,
      difficulty: c.difficulty ?? 2,
    })),
  });
});

reviewRouter.get("/stats", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();

  const [cards, reviews] = await Promise.all([
    pb.collection("cards").getFullList({
      filter: pb.filter("user_id = {:uid}", { uid: req.userId }),
      fields: "id,due_at,reps",
    }),
    pb.collection("reviews").getFullList({
      filter: pb.filter("user_id = {:uid}", { uid: req.userId }),
      fields: "reviewed_at",
      sort: "-reviewed_at",
    }),
  ]);

  const now = Date.now();
  const dueNow = cards.filter((c) => c.due_at && new Date(c.due_at).getTime() <= now).length;
  const studied = cards.filter((c) => c.reps > 0).length;

  const days = Array.from(
    new Set(
      reviews.map((r) => {
        const d = new Date(r.reviewed_at);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
      }),
    ),
  ).sort((a, b) => b - a);

  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const dayTime of days) {
    const diffDays = Math.round((cursor.getTime() - dayTime) / 86_400_000);
    if (diffDays === streak) {
      streak += 1;
    } else if (diffDays === streak + 1 && streak === 0) {
      continue;
    } else {
      break;
    }
  }

  res.json({ due_now: String(dueNow), total_cards: String(cards.length), studied: String(studied), streak });
});

const submitSchema = z.object({
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  confidencePre: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).optional(),
});

reviewRouter.post("/:cardId", async (req: AuthedRequest, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { rating, confidencePre } = parsed.data;

  await ensureSuperuserAuth();

  let card;
  try {
    card = await pb.collection("cards").getOne(req.params.cardId);
  } catch {
    res.status(404).json({ error: "Card not found" });
    return;
  }
  if (card.user_id !== req.userId) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const state: CardState = {
    easeFactor: card.ease_factor,
    intervalDays: card.interval_days,
    reps: card.reps,
    lapses: card.lapses,
  };
  const review: CardReview = { rating: rating as Rating, confidencePre };
  const next = schedule(state, review);

  await pb.collection("cards").update(card.id, {
    ease_factor: next.easeFactor,
    interval_days: next.intervalDays,
    reps: next.reps,
    lapses: next.lapses,
    due_at: next.dueAt,
    last_reviewed_at: new Date(),
    confidence_pre_rating: confidencePre ?? null,
  });
  await pb.collection("reviews").create({ card_id: card.id, user_id: req.userId, rating, reviewed_at: new Date() });

  res.json({ dueAt: next.dueAt, intervalDays: next.intervalDays });
});
