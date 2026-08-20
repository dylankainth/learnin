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
