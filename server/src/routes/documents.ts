import { Router } from "express";
import multer from "multer";
import { ensureSuperuserAuth, pb } from "../services/pocketbase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { enqueueIngest } from "../services/queue.js";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB, lecture videos are large
});

const PDF_TYPES = new Set(["application/pdf"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/x-matroska", "video/webm"]);

documentsRouter.post("/", upload.single("file"), async (req: AuthedRequest, res) => {
  const file = req.file;
  const title = typeof req.body.title === "string" && req.body.title.trim() ? req.body.title.trim() : file?.originalname;
  const topicId = typeof req.body.topic_id === "string" ? req.body.topic_id : null;
  const integrationMode = req.body.integration_mode === "arrange" ? "arrange" : "append";
  if (!file) {
    res.status(400).json({ error: "No file uploaded (expected multipart field 'file')" });
    return;
  }

  let sourceType: "pdf" | "video";
  if (PDF_TYPES.has(file.mimetype)) sourceType = "pdf";
  else if (VIDEO_TYPES.has(file.mimetype)) sourceType = "video";
  else {
    res.status(400).json({ error: `Unsupported file type: ${file.mimetype}` });
    return;
  }

  await ensureSuperuserAuth();

  const form = new FormData();
  form.append("user_id", req.userId!);
  form.append("title", title!);
  form.append("source_type", sourceType);
  form.append("original_filename", file.originalname);
  form.append("status", "pending");
  form.append("integration_mode", integrationMode);
  if (topicId) form.append("topic_id", topicId);
  form.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname);

  const doc = await pb.collection("documents").create(form);
  await enqueueIngest(doc.id);
  res.status(201).json({
    document: {
      id: doc.id,
      title: doc.title,
      source_type: doc.source_type,
      status: doc.status,
      created_at: doc.created,
      topic_id: doc.topic_id,
    },
  });
});

documentsRouter.get("/", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();

  const topicId = req.query.topicId as string | undefined;
  let filter = pb.filter("user_id = {:uid}", { uid: req.userId });
  if (topicId) {
    filter = pb.filter("user_id = {:uid} && topic_id = {:tid}", { uid: req.userId, tid: topicId });
  }

  const [docs, cards] = await Promise.all([
    pb.collection("documents").getFullList({
      filter,
    }),
    pb.collection("cards").getFullList({
      filter: pb.filter("user_id = {:uid}", { uid: req.userId }),
      fields: "id,document_id,due_at",
    }),
  ]);

  const now = Date.now();
  const countsByDoc = new Map<string, { cardCount: number; dueCount: number }>();
  for (const card of cards) {
    const entry = countsByDoc.get(card.document_id) ?? { cardCount: 0, dueCount: 0 };
    entry.cardCount += 1;
    if (card.due_at && new Date(card.due_at).getTime() <= now) entry.dueCount += 1;
    countsByDoc.set(card.document_id, entry);
  }

  res.json({
    documents: docs.map((d) => {
      const counts = countsByDoc.get(d.id) ?? { cardCount: 0, dueCount: 0 };
      return {
        id: d.id,
        title: d.title,
        source_type: d.source_type,
        status: d.status,
        created_at: d.created,
        card_count: String(counts.cardCount),
        due_count: String(counts.dueCount),
        topic_id: d.topic_id,
      };
    }),
  });
});

documentsRouter.get("/:id", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();

  let doc;
  try {
    doc = await pb.collection("documents").getOne(req.params.id);
  } catch {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  if (doc.user_id !== req.userId) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const [blocks, cards] = await Promise.all([
    pb.collection("blocks").getFullList({
      filter: pb.filter("document_id = {:id}", { id: doc.id }),
      sort: "order_index",
    }),
    pb.collection("cards").getFullList({
      filter: pb.filter("document_id = {:id}", { id: doc.id }),
      fields: "id,block_id,due_at,reps",
    }),
  ]);
  const cardByBlock = new Map(cards.map((c) => [c.block_id, c]));

  res.json({
    document: {
      id: doc.id,
      title: doc.title,
      sourceType: doc.source_type,
      status: doc.status,
      errorMessage: doc.error_message || undefined,
      createdAt: doc.created,
    },
    blocks: blocks.map((block) => {
      const card = cardByBlock.get(block.id);
      return {
        id: block.id,
        type: block.type,
        ...block.content,
        cardId: card?.id,
        dueAt: card?.due_at,
        reps: card?.reps,
      };
    }),
  });
});

documentsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await ensureSuperuserAuth();

  let doc;
  try {
    doc = await pb.collection("documents").getOne(req.params.id);
  } catch {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  if (doc.user_id !== req.userId) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const cards = await pb.collection("cards").getFullList({
    filter: pb.filter("document_id = {:id}", { id: doc.id }),
    fields: "id",
  });
  const reviews = (
    await Promise.all(
      cards.map((c) =>
        pb.collection("reviews").getFullList({ filter: pb.filter("card_id = {:id}", { id: c.id }), fields: "id" }),
      ),
    )
  ).flat();

  await Promise.all(reviews.map((r) => pb.collection("reviews").delete(r.id).catch(() => {})));
  await Promise.all(cards.map((c) => pb.collection("cards").delete(c.id).catch(() => {})));
  const blocks = await pb.collection("blocks").getFullList({
    filter: pb.filter("document_id = {:id}", { id: doc.id }),
    fields: "id",
  });
  await Promise.all(blocks.map((b) => pb.collection("blocks").delete(b.id).catch(() => {})));
  await pb.collection("documents").delete(doc.id);

  res.status(204).send();
});
