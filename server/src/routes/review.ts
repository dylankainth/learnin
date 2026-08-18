import { Router } from "express";
import { z } from "zod";
import { pool } from "../db/index.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { schedule, type CardState, type Rating } from "../services/srs.js";

export const reviewRouter = Router();
reviewRouter.use(requireAuth);

reviewRouter.get("/due", async (req: AuthedRequest, res) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 50);
  const documentId = typeof req.query.documentId === "string" ? req.query.documentId : null;
  const { rows } = await pool.query(
    `SELECT ca.id, ca.question, ca.options, ca.answer, ca.explanation, ca.due_at, d.title AS document_title
     FROM cards ca
     JOIN documents d ON d.id = ca.document_id
     WHERE ca.user_id = $1 AND ca.due_at <= now() AND ($3::uuid IS NULL OR ca.document_id = $3)
     ORDER BY ca.due_at ASC
     LIMIT $2`,
    [req.userId, limit, documentId],
  );
  res.json({ cards: rows });
});

reviewRouter.get("/stats", async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE due_at <= now()) AS due_now,
       COUNT(*) AS total_cards,
       COUNT(*) FILTER (WHERE reps > 0) AS studied
     FROM cards WHERE user_id = $1`,
    [req.userId],
  );
  const streakResult = await pool.query(
    `SELECT DISTINCT date_trunc('day', reviewed_at) AS day
     FROM reviews WHERE user_id = $1
     ORDER BY day DESC`,
    [req.userId],
  );
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  for (const row of streakResult.rows) {
    const day = new Date(row.day);
    const diffDays = Math.round((cursor.getTime() - day.getTime()) / 86_400_000);
    if (diffDays === streak) {
      streak += 1;
    } else if (diffDays === streak + 1 && streak === 0) {
      // allow "today not yet reviewed but yesterday was" to still count as an active streak
      continue;
    } else {
      break;
    }
  }
  res.json({ ...rows[0], streak });
});

const submitSchema = z.object({ rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]) });

reviewRouter.post("/:cardId", async (req: AuthedRequest, res) => {
  const parsed = submitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const rating = parsed.data.rating as Rating;

  const cardResult = await pool.query(
    "SELECT id, ease_factor, interval_days, reps, lapses FROM cards WHERE id = $1 AND user_id = $2",
    [req.params.cardId, req.userId],
  );
  const card = cardResult.rows[0];
  if (!card) {
    res.status(404).json({ error: "Card not found" });
    return;
  }

  const state: CardState = {
    easeFactor: card.ease_factor,
    intervalDays: card.interval_days,
    reps: card.reps,
    lapses: card.lapses,
  };
  const next = schedule(state, rating);

  await pool.query(
    `UPDATE cards SET ease_factor = $1, interval_days = $2, reps = $3, lapses = $4, due_at = $5, last_reviewed_at = now()
     WHERE id = $6`,
    [next.easeFactor, next.intervalDays, next.reps, next.lapses, next.dueAt, card.id],
  );
  await pool.query("INSERT INTO reviews (card_id, user_id, rating) VALUES ($1, $2, $3)", [
    card.id,
    req.userId,
    rating,
  ]);

  res.json({ dueAt: next.dueAt, intervalDays: next.intervalDays });
});
