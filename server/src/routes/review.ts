import { Router } from "express";
import { z } from "zod";
import { ensureSuperuserAuth, pb } from "../services/pocketbase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { schedule, type CardState, type Rating, type CardReview } from "../services/srs.js";
import { generateLongformQuestions, gradeLongformAnswer } from "../services/llm.js";

export const reviewRouter = Router();
reviewRouter.use(requireAuth);

reviewRouter.get("/due", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();

  const limit = Math.min(Number(req.query.limit ?? 20), 50);
  const documentId = typeof req.query.documentId === "string" ? req.query.documentId : null;
  const topicId = typeof req.query.topicId === "string" ? req.query.topicId : null;
  const interleave = req.query.interleave !== "false"; // Default true

  let filterExpr = "user_id = {:uid} && due_at <= {:now}";
  if (documentId) filterExpr += " && document_id = {:docId}";
  if (topicId) filterExpr += " && topic_id = {:tid}";

  const { items: cards } = await pb.collection("cards").getList(1, limit * 3, {
    filter: pb.filter(filterExpr, { uid: req.userId, now: new Date(), docId: documentId, tid: topicId }),
    sort: interleave ? "-due_at" : "due_at",
  });

  // Interleave: shuffle order but keep due cards prioritized
  let finalCards = cards.slice(0, limit);
  if (interleave && !documentId && !topicId && cards.length > limit) {
    // Fisher-Yates shuffle for randomization
    finalCards = cards.slice(0, limit);
    for (let i = finalCards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [finalCards[i], finalCards[j]] = [finalCards[j], finalCards[i]];
    }
  }

  const [docs, topics] = await Promise.all([
    pb.collection("documents").getFullList({
      filter: pb.filter("user_id = {:uid}", { uid: req.userId }),
      fields: "id,title",
    }),
    pb.collection("topics").getFullList({
      filter: pb.filter("user_id = {:uid}", { uid: req.userId }),
      fields: "id,name",
    }),
  ]);
  const titleById = new Map(docs.map((d) => [d.id, d.title]));
  const nameById = new Map(topics.map((t) => [t.id, t.name]));

  res.json({
    cards: finalCards.map((c) => ({
      id: c.id,
      question: c.question,
      options: c.options ?? null,
      answer: c.answer,
      explanation: c.explanation,
      due_at: c.due_at,
      document_title: titleById.get(c.document_id) ?? "",
      topic_id: c.topic_id,
      topic_name: c.topic_id ? nameById.get(c.topic_id) : undefined,
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
    if (diffDays === 0) {
      streak += 1;
      cursor = new Date(dayTime - 86_400_000);
    } else if (diffDays === 1 && streak === 0) {
      // No review today, but reviewed yesterday — start streak from yesterday
      streak += 1;
      cursor = new Date(dayTime - 86_400_000);
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

// GET /review/quiz?topicId=xxx&limit=5
// Returns cards for a topic for a quiz session (due cards first, then least-studied)
reviewRouter.get("/quiz", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();
  const topicId = typeof req.query.topicId === "string" ? req.query.topicId : null;
  const documentId = typeof req.query.documentId === "string" ? req.query.documentId : null;
  const limit = Math.min(Number(req.query.limit ?? 5), 10);

  if (!topicId) { res.status(400).json({ error: "topicId required" }); return; }

  let filterExpr = "user_id = {:uid} && topic_id = {:tid}";
  if (documentId) filterExpr += " && document_id = {:docId}";

  const allCards = await pb.collection("cards").getFullList({
    filter: pb.filter(filterExpr, { uid: req.userId, tid: topicId, docId: documentId }),
    fields: "id,question,options,answer,explanation,due_at,reps,question_type,elaboration_prompt,difficulty",
  });

  const now = new Date();
  // Due cards first, then by reps ascending (least studied first)
  const sorted = allCards.sort((a, b) => {
    const aDue = new Date(a.due_at) <= now ? 0 : 1;
    const bDue = new Date(b.due_at) <= now ? 0 : 1;
    if (aDue !== bDue) return aDue - bDue;
    return (a.reps ?? 0) - (b.reps ?? 0);
  });

  const cards = sorted.slice(0, limit).map((c) => ({
    id: c.id,
    question: c.question,
    options: c.options ?? null,
    answer: c.answer,
    explanation: c.explanation,
    due_at: c.due_at,
    question_type: c.question_type ?? (c.options ? "multiple-choice" : "free-text"),
    elaboration_prompt: c.elaboration_prompt ?? null,
    difficulty: c.difficulty ?? 1,
  }));

  res.json({ cards });
});

// POST /review/longform/generate  { topicId, documentId?, count? }
// Generates fresh open-ended long-answer questions from a topic's study
// material and persists them so they can be graded later.
const longformGenerateSchema = z.object({
  topicId: z.string().min(1),
  documentId: z.string().min(1).optional(),
  count: z.number().int().min(1).max(5).optional(),
});

reviewRouter.post("/longform/generate", async (req: AuthedRequest, res) => {
  const parsed = longformGenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { topicId, documentId, count = 3 } = parsed.data;

  await ensureSuperuserAuth();

  let topic;
  try {
    topic = await pb.collection("topics").getOne(topicId);
  } catch {
    res.status(404).json({ error: "Topic not found" });
    return;
  }
  if (topic.user_id !== req.userId) {
    res.status(403).json({ error: "Not authorized" });
    return;
  }

  let filterExpr = "topic_id = {:tid} && type = 'explainer'";
  if (documentId) filterExpr += " && document_id = {:docId}";
  const blocks = await pb.collection("blocks").getFullList({
    filter: pb.filter(filterExpr, { tid: topicId, docId: documentId }),
    fields: "content,topic_order_index",
    sort: "topic_order_index",
  });

  const content = blocks.map((b) => (b.content as { markdown?: string })?.markdown ?? "").filter(Boolean).join("\n\n");
  if (!content.trim()) {
    res.status(400).json({ error: "No study material available yet for this topic" });
    return;
  }

  let questions;
  try {
    questions = await generateLongformQuestions(topic.name, content, count);
  } catch (err) {
    console.error("Failed to generate long-answer questions:", err);
    res.status(502).json({ error: "Failed to generate long-answer questions" });
    return;
  }

  const created = await Promise.all(
    questions.map((q) =>
      pb.collection("longform_questions").create({
        user_id: req.userId,
        topic_id: topicId,
        document_id: documentId ?? null,
        question: q.question,
        key_points: q.key_points,
      }),
    ),
  );

  res.json({
    questions: created.map((c) => ({ id: c.id, question: c.question as string })),
  });
});

// POST /review/longform/:id/submit  { answer }
// Grades a student's written answer against the question's rubric and
// persists the result.
const longformSubmitSchema = z.object({
  answer: z.string().min(1).max(8000),
});

reviewRouter.post("/longform/:id/submit", async (req: AuthedRequest, res) => {
  const parsed = longformSubmitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { answer } = parsed.data;

  await ensureSuperuserAuth();

  let record;
  try {
    record = await pb.collection("longform_questions").getOne(req.params.id);
  } catch {
    res.status(404).json({ error: "Question not found" });
    return;
  }
  if (record.user_id !== req.userId) {
    res.status(404).json({ error: "Question not found" });
    return;
  }

  let grade;
  try {
    grade = await gradeLongformAnswer(record.question as string, (record.key_points as string[]) ?? [], answer);
  } catch (err) {
    console.error("Failed to grade long-answer response:", err);
    res.status(502).json({ error: "Failed to grade your answer" });
    return;
  }

  await pb.collection("longform_questions").update(record.id, {
    answer,
    score: grade.score,
    verdict: grade.verdict,
    feedback: grade.feedback,
    strengths: grade.strengths,
    missed_points: grade.missed_points,
    answered_at: new Date(),
  });

  res.json({
    score: grade.score,
    verdict: grade.verdict,
    feedback: grade.feedback,
    strengths: grade.strengths,
    missedPoints: grade.missed_points,
  });
});
