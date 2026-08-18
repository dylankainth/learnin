import { Worker } from "bullmq";
import { pool, ensureSchema } from "../db/index.js";
import { connection, type IngestJobData } from "../services/queue.js";
import { extractPdfText, transcribeVideo } from "../services/extract.js";
import { generateLectureDoc } from "../services/llm.js";

async function processDocument(documentId: string): Promise<void> {
  const { rows } = await pool.query("SELECT * FROM documents WHERE id = $1", [documentId]);
  const doc = rows[0];
  if (!doc) throw new Error(`Document ${documentId} not found`);

  await pool.query("UPDATE documents SET status = 'processing' WHERE id = $1", [documentId]);

  const text =
    doc.source_type === "pdf" ? await extractPdfText(doc.file_path) : await transcribeVideo(doc.file_path);

  const blocks = await generateLectureDoc(doc.title, text);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const blockResult = await client.query(
        `INSERT INTO blocks (document_id, order_index, type, content) VALUES ($1, $2, $3, $4) RETURNING id`,
        [documentId, i, block.type, JSON.stringify(block)],
      );
      const blockId = blockResult.rows[0].id;

      if (block.type === "quiz") {
        await client.query(
          `INSERT INTO cards (user_id, document_id, block_id, question, options, answer, explanation)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            doc.user_id,
            documentId,
            blockId,
            block.question,
            block.options ? JSON.stringify(block.options) : null,
            block.answer,
            block.explanation,
          ],
        );
      }
    }
    await client.query("UPDATE documents SET status = 'ready' WHERE id = $1", [documentId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  await ensureSchema();

  const worker = new Worker<IngestJobData>(
    "ingest",
    async (job) => {
      try {
        await processDocument(job.data.documentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await pool.query("UPDATE documents SET status = 'error', error_message = $2 WHERE id = $1", [
          job.data.documentId,
          message,
        ]);
        throw err;
      }
    },
    { connection, concurrency: 2 },
  );

  worker.on("completed", (job) => console.log(`[ingest] completed ${job.id}`));
  worker.on("failed", (job, err) => console.error(`[ingest] failed ${job?.id}:`, err.message));

  console.log("Ingest worker started");
}

main().catch((err) => {
  console.error("Ingest worker crashed:", err);
  process.exit(1);
});
