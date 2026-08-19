import { Router } from "express";
import { z } from "zod";
import { ensureSuperuserAuth, pb } from "../services/pocketbase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const topicsRouter = Router();
topicsRouter.use(requireAuth);

topicsRouter.get("/", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();
  try {
    const topics = await pb.collection("topics").getFullList({
      filter: `user_id = "${req.userId}"`,
      sort: "-created_at",
    });

    const topicsWithCounts = await Promise.all(
      topics.map(async (topic) => {
        const documents = await pb.collection("documents").getFullList({
          filter: `topic_id = "${topic.id}"`,
        });

        const cards = await pb.collection("cards").getFullList({
          filter: `topic_id = "${topic.id}"`,
        });

        const dueCards = cards.filter((c) => new Date(c.due_at) <= new Date());

        return {
          id: topic.id,
          name: topic.name,
          description: topic.description || undefined,
          color_accent: topic.color_accent,
          created_at: topic.created_at,
          content_count: documents.length,
          card_count: cards.length,
          due_count: dueCards.length,
        };
      })
    );

    res.json({ topics: topicsWithCounts });
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

    const documents = await pb.collection("documents").getFullList({
      filter: `topic_id = "${id}"`,
      sort: "-created_at",
    });

    const cards = await pb.collection("cards").getFullList({
      filter: `topic_id = "${id}"`,
    });

    const dueCards = cards.filter((c) => new Date(c.due_at) <= new Date());

    res.json({
      topic: {
        id: topic.id,
        name: topic.name,
        description: topic.description || undefined,
        color_accent: topic.color_accent,
        created_at: topic.created_at,
        content_count: documents.length,
        card_count: cards.length,
        due_count: dueCards.length,
      },
      contents: documents.map((doc) => ({
        id: doc.id,
        title: doc.title,
        source_type: doc.source_type,
        status: doc.status,
        created_at: doc.created_at,
        card_count: doc.card_count ?? "0",
        due_count: doc.due_count ?? "0",
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
        created_at: topic.created_at,
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
        created_at: updated.created_at,
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
