import { Router } from "express";
import { z } from "zod";
import { ensureSuperuserAuth, pb } from "../services/pocketbase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const topicsRouter = Router();
topicsRouter.use(requireAuth);

topicsRouter.get("/", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();
  try {
    const [topics, documents, cards] = await Promise.all([
      pb.collection("topics").getFullList({
        filter: pb.filter("user_id = {:uid}", { uid: req.userId }),
        fields: "id,name,description,color_accent,created",
      }),
      pb.collection("documents").getFullList({
        filter: pb.filter("user_id = {:uid}", { uid: req.userId }),
        fields: "id,topic_id",
      }),
      pb.collection("cards").getFullList({
        filter: pb.filter("user_id = {:uid}", { uid: req.userId }),
        fields: "id,topic_id,due_at",
      }),
    ]);

    const now = Date.now();
    const docCountByTopic = new Map<string, number>();
    for (const doc of documents) {
      if (doc.topic_id) docCountByTopic.set(doc.topic_id, (docCountByTopic.get(doc.topic_id) ?? 0) + 1);
    }
    const cardCountByTopic = new Map<string, number>();
    const dueCountByTopic = new Map<string, number>();
    for (const card of cards) {
      if (card.topic_id) {
        cardCountByTopic.set(card.topic_id, (cardCountByTopic.get(card.topic_id) ?? 0) + 1);
        if (card.due_at && new Date(card.due_at).getTime() <= now) {
          dueCountByTopic.set(card.topic_id, (dueCountByTopic.get(card.topic_id) ?? 0) + 1);
        }
      }
    }

    res.json({
      topics: topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        description: topic.description || undefined,
        color_accent: topic.color_accent,
        created_at: topic.created,
        content_count: docCountByTopic.get(topic.id) ?? 0,
        card_count: cardCountByTopic.get(topic.id) ?? 0,
        due_count: dueCountByTopic.get(topic.id) ?? 0,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch topics:", err);
    res.status(500).json({ error: "Failed to fetch topics" });
  }
});

topicsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const { id } = req.params;
  await ensureSuperuserAuth();
  try {
    const topic = await pb.collection("topics").getOne(id);
    if (topic.user_id !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const [documents, cards] = await Promise.all([
      pb.collection("documents").getFullList({
        filter: pb.filter("topic_id = {:tid}", { tid: id }),
      }),
      pb.collection("cards").getFullList({
        filter: pb.filter("topic_id = {:tid}", { tid: id }),
        fields: "id,document_id,due_at",
      }),
    ]);

    const now = Date.now();
    const cardCountByDoc = new Map<string, number>();
    const dueCountByDoc = new Map<string, number>();
    for (const card of cards) {
      cardCountByDoc.set(card.document_id, (cardCountByDoc.get(card.document_id) ?? 0) + 1);
      if (card.due_at && new Date(card.due_at).getTime() <= now) {
        dueCountByDoc.set(card.document_id, (dueCountByDoc.get(card.document_id) ?? 0) + 1);
      }
    }

    const dueCards = cards.filter((c) => c.due_at && new Date(c.due_at).getTime() <= now);

    res.json({
      topic: {
        id: topic.id,
        name: topic.name,
        description: topic.description || undefined,
        color_accent: topic.color_accent,
        created_at: topic.created,
        content_count: documents.length,
        card_count: cards.length,
        due_count: dueCards.length,
      },
      contents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        source_type: doc.source_type,
        status: doc.status,
        created_at: doc.created,
        card_count: String(cardCountByDoc.get(doc.id) ?? 0),
        due_count: String(dueCountByDoc.get(doc.id) ?? 0),
        topic_id: doc.topic_id,
      })),
    });
  } catch (err) {
    console.error("Failed to fetch topic:", err);
    res.status(500).json({ error: "Failed to fetch topic" });
  }
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

topicsRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  await ensureSuperuserAuth();
  try {
    const { name, description } = parsed.data;
    const topic = await pb.collection("topics").create({
      user_id: req.userId,
      name,
      description: description || null,
    });

    res.json({
      topic: {
        id: topic.id,
        name: topic.name,
        description: topic.description || undefined,
        color_accent: topic.color_accent,
        created_at: topic.created,
        content_count: 0,
        card_count: 0,
        due_count: 0,
      },
    });
  } catch (err) {
    console.error("Failed to create topic:", err);
    res.status(500).json({ error: "Failed to create topic" });
  }
});

const updateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullable().optional(),
});

topicsRouter.patch("/:id", async (req: AuthedRequest, res) => {
  const { id } = req.params;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  await ensureSuperuserAuth();
  try {
    const topic = await pb.collection("topics").getOne(id);
    if (topic.user_id !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const { name, description } = parsed.data;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (description !== undefined) patch.description = description;

    const updated = await pb.collection("topics").update(id, patch);

    res.json({
      topic: {
        id: updated.id,
        name: updated.name,
        description: updated.description || undefined,
        color_accent: updated.color_accent,
        created_at: updated.created,
        content_count: 0,
        card_count: 0,
        due_count: 0,
      },
    });
  } catch (err) {
    console.error("Failed to update topic:", err);
    res.status(500).json({ error: "Failed to update topic" });
  }
});

topicsRouter.get("/:id/study", async (req: AuthedRequest, res) => {
  const { id } = req.params;
  await ensureSuperuserAuth();
  try {
    const topic = await pb.collection("topics").getOne(id);
    if (topic.user_id !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    const [documents, blocks, cards] = await Promise.all([
      pb.collection("documents").getFullList({
        filter: pb.filter("topic_id = {:tid}", { tid: id }),
        fields: "id,title,status",
      }),
      pb.collection("blocks").getFullList({
        filter: pb.filter("topic_id = {:tid}", { tid: id }),
        fields: "id,document_id,type,content,topic_order_index,locked",
      }),
      pb.collection("cards").getFullList({
        filter: pb.filter("topic_id = {:tid}", { tid: id }),
        fields: "id,block_id,due_at,reps",
      }),
    ]);

    // Only show blocks from ready documents
    const readyDocIds = new Set(documents.filter((d) => d.status === "ready").map((d) => d.id));
    const processingCount = documents.filter((d) => d.status === "pending" || d.status === "processing").length;

    const cardByBlock = new Map(cards.map((c) => [c.block_id, c]));
    const readyBlocks = blocks
      .filter((b) => readyDocIds.has(b.document_id))
      .sort((a, b) => (a.topic_order_index ?? 0) - (b.topic_order_index ?? 0));

    res.json({
      topic: {
        id: topic.id,
        name: topic.name,
        description: topic.description || undefined,
        color_accent: topic.color_accent,
      },
      processingCount,
      blocks: readyBlocks.map((block) => {
        const card = cardByBlock.get(block.id);
        return {
          id: block.id,
          type: block.type,
          topic_order_index: block.topic_order_index,
          locked: block.locked ?? false,
          ...block.content,
          cardId: card?.id,
          dueAt: card?.due_at,
          reps: card?.reps,
        };
      }),
    });
  } catch (err) {
    console.error("Failed to fetch topic study:", err);
    res.status(500).json({ error: "Failed to fetch topic study" });
  }
});

topicsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const { id } = req.params;
  await ensureSuperuserAuth();
  try {
    const topic = await pb.collection("topics").getOne(id);
    if (topic.user_id !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    await pb.collection("topics").delete(id);
    res.status(204).send();
  } catch (err) {
    console.error("Failed to delete topic:", err);
    res.status(500).json({ error: "Failed to delete topic" });
  }
});
