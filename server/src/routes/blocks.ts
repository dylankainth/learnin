import { Router } from "express";
import { ensureSuperuserAuth, pb } from "../services/pocketbase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";

export const blocksRouter = Router();
blocksRouter.use(requireAuth);

blocksRouter.patch("/:id/lock", async (req: AuthedRequest, res) => {
  const { id } = req.params;
  await ensureSuperuserAuth();
  try {
    const block = await pb.collection("blocks").getOne(id, { fields: "id,topic_id,document_id" });

    // Verify ownership via the document
    const doc = await pb.collection("documents").getOne(block.document_id, { fields: "user_id" });
    if (doc.user_id !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    await pb.collection("blocks").update(id, { locked: true });
    res.json({ ok: true });
  } catch (err) {
    console.error("Failed to lock block:", err);
    res.status(500).json({ error: "Failed to lock block" });
  }
});

blocksRouter.patch("/:id/paragraphs/:index/toggle", async (req: AuthedRequest, res) => {
  const { id: blockId, index } = req.params;
  const paragraphIndex = parseInt(index, 10);
  if (isNaN(paragraphIndex)) {
    res.status(400).json({ error: "Invalid paragraph index" });
    return;
  }
  await ensureSuperuserAuth();
  try {
    const block = await pb.collection("blocks").getOne(blockId, { fields: "id,document_id" });
    const doc = await pb.collection("documents").getOne(block.document_id, { fields: "user_id" });
    if (doc.user_id !== req.userId) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }

    let record: { id: string; paragraph_indices: number[] } | null = null;
    try {
      record = await pb.collection("paragraph_reads").getFirstListItem(
        pb.filter("user_id = {:uid} && block_id = {:bid}", { uid: req.userId, bid: blockId }),
      ) as { id: string; paragraph_indices: number[] };
    } catch {
      record = null;
    }

    const indices: number[] = Array.isArray(record?.paragraph_indices) ? [...record.paragraph_indices] : [];
    const pos = indices.indexOf(paragraphIndex);
    if (pos === -1) indices.push(paragraphIndex);
    else indices.splice(pos, 1);

    if (record) {
      await pb.collection("paragraph_reads").update(record.id, { paragraph_indices: indices });
    } else {
      await pb.collection("paragraph_reads").create({
        user_id: req.userId,
        block_id: blockId,
        paragraph_indices: indices,
      });
    }

    res.json({ paragraphIndices: indices });
  } catch (err) {
    console.error("Failed to toggle paragraph read:", err);
    res.status(500).json({ error: "Failed to toggle paragraph read" });
  }
});
