import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import { pool } from "../db/index.js";
import { env } from "../env.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { enqueueIngest } from "../services/queue.js";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

const upload = multer({
  storage: multer.diskStorage({
    destination: env.uploadDir,
    filename: (_req, file, cb) => cb(null, `${randomUUID()}${path.extname(file.originalname)}`),
  }),
  limits: { fileSize: 1024 * 1024 * 1024 }, // 1GB, lecture videos are large
});

const PDF_TYPES = new Set(["application/pdf"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/quicktime", "video/x-matroska", "video/webm"]);

documentsRouter.post("/", upload.single("file"), async (req: AuthedRequest, res) => {
  const file = req.file;
  const title = typeof req.body.title === "string" && req.body.title.trim() ? req.body.title.trim() : file?.originalname;
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

  const result = await pool.query(
    `INSERT INTO documents (user_id, title, source_type, original_filename, file_path)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, title, source_type, status, created_at`,
    [req.userId, title, sourceType, file.originalname, file.path],
  );
  const doc = result.rows[0];
  await enqueueIngest(doc.id);
  res.status(201).json({ document: doc });
});

documentsRouter.get("/", async (req: AuthedRequest, res) => {
  const { rows } = await pool.query(
    `SELECT d.id, d.title, d.source_type, d.status, d.created_at,
            COUNT(c.id) FILTER (WHERE c.id IS NOT NULL) AS card_count,
            COUNT(c.id) FILTER (WHERE c.due_at <= now()) AS due_count
     FROM documents d
     LEFT JOIN cards c ON c.document_id = d.id
     WHERE d.user_id = $1
     GROUP BY d.id
     ORDER BY d.created_at DESC`,
    [req.userId],
  );
  res.json({ documents: rows });
});

documentsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const docResult = await pool.query("SELECT * FROM documents WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  const doc = docResult.rows[0];
  if (!doc) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const blocksResult = await pool.query(
    `SELECT b.id, b.type, b.content, c.id AS card_id, c.due_at, c.reps
     FROM blocks b
     LEFT JOIN cards c ON c.block_id = b.id
     WHERE b.document_id = $1
     ORDER BY b.order_index ASC`,
    [doc.id],
  );

  res.json({
    document: {
      id: doc.id,
      title: doc.title,
      sourceType: doc.source_type,
      status: doc.status,
      errorMessage: doc.error_message,
      createdAt: doc.created_at,
    },
    blocks: blocksResult.rows.map((row) => ({
      id: row.id,
      type: row.type,
      ...row.content,
      cardId: row.card_id ?? undefined,
      dueAt: row.due_at ?? undefined,
      reps: row.reps ?? undefined,
    })),
  });
});

documentsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const result = await pool.query("DELETE FROM documents WHERE id = $1 AND user_id = $2", [
    req.params.id,
    req.userId,
  ]);
  if (result.rowCount === 0) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.status(204).send();
});
