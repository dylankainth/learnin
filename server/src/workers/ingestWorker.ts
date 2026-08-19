import { Worker } from "bullmq";
import { ensureSuperuserAuth, pb } from "../services/pocketbase.js";
import { connection, type IngestJobData } from "../services/queue.js";
import { extractPdfText, transcribeVideo } from "../services/extract.js";
import { generateLectureDoc } from "../services/llm.js";

async function fetchUploadedFile(doc: { id: string; file: string; collectionId: string; collectionName: string }): Promise<Buffer> {
  const token = await pb.files.getToken();
  const url = pb.files.getURL(doc, doc.file, { token });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch uploaded file: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function processDocument(documentId: string): Promise<void> {
  await ensureSuperuserAuth();

  const doc = await pb.collection("documents").getOne(documentId);
  await pb.collection("documents").update(documentId, { status: "processing" });

  const fileBuffer = await fetchUploadedFile(doc as never);
  const text = doc.source_type === "pdf" ? await extractPdfText(fileBuffer) : await transcribeVideo(fileBuffer);

  const blocks = await generateLectureDoc(doc.title, text);

  const createdBlockIds: string[] = [];
  const createdCardIds: string[] = [];
  try {
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const blockRecord = await pb
        .collection("blocks")
        .create({ document_id: documentId, order_index: i, type: block.type, content: block });
      createdBlockIds.push(blockRecord.id);

      if (block.type === "quiz") {
        const cardRecord = await pb.collection("cards").create({
          user_id: doc.user_id,
          document_id: documentId,
          topic_id: doc.topic_id || null,
          block_id: blockRecord.id,
          question: block.question,
          options: block.options,
          answer: block.answer,
          explanation: block.explanation,
        });
        createdCardIds.push(cardRecord.id);
      }
    }
    await pb.collection("documents").update(documentId, { status: "ready" });
  } catch (err) {
    // Best-effort cleanup of the partial document so a retry starts clean.
    await Promise.all(createdCardIds.map((id) => pb.collection("cards").delete(id).catch(() => {})));
    await Promise.all(createdBlockIds.map((id) => pb.collection("blocks").delete(id).catch(() => {})));
    throw err;
  }
}

async function main() {
  const worker = new Worker<IngestJobData>(
    "ingest",
    async (job) => {
      try {
        await processDocument(job.data.documentId);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await ensureSuperuserAuth();
        await pb.collection("documents").update(job.data.documentId, { status: "error", error_message: message });
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
