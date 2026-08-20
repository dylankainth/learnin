import { Worker } from "bullmq";
import { ensureSuperuserAuth, pb } from "../services/pocketbase.js";
import { connection, type IngestJobData } from "../services/queue.js";
import { extractPdfText, transcribeVideo } from "../services/extract.js";
import { generateLectureDoc, arrangeTopicBlocks, type GeneratedBlock } from "../services/llm.js";

async function fetchUploadedFile(doc: { id: string; file: string; collectionId: string; collectionName: string }): Promise<Buffer> {
  const token = await pb.files.getToken();
  const url = pb.files.getURL(doc, doc.file, { token });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch uploaded file: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Fetches existing unlocked blocks for the topic and returns them with their
 * topic_order_index, plus the max index so we know where to append.
 */
async function getExistingTopicBlocks(topicId: string): Promise<{ id: string; summary: string; topic_order_index: number }[]> {
  const blocks = await pb.collection("blocks").getFullList({
    filter: pb.filter("topic_id = {:tid} && locked = false", { tid: topicId }),
    fields: "id,topic_order_index,type,content",
  });
  // Sort by topic_order_index ascending
  blocks.sort((a, b) => (a.topic_order_index ?? 0) - (b.topic_order_index ?? 0));
  return blocks
    .filter((b) => b.type === "explainer")
    .map((b) => ({
      id: b.id,
      summary: (b.content?.markdown ?? "").slice(0, 150),
      topic_order_index: b.topic_order_index ?? 0,
    }));
}

/**
 * Finds the current max topic_order_index for any block in the topic
 * (including locked ones) so new blocks appended after don't collide.
 */
async function getMaxTopicOrderIndex(topicId: string): Promise<number> {
  const blocks = await pb.collection("blocks").getFullList({
    filter: pb.filter("topic_id = {:tid}", { tid: topicId }),
    fields: "topic_order_index",
  });
  if (blocks.length === 0) return 0;
  return Math.max(...blocks.map((b) => b.topic_order_index ?? 0));
}

/**
 * Computes topic_order_index for each new block given LLM-determined placements.
 * Locked blocks keep their indices unchanged; this only repositions new blocks
 * among unlocked space.
 */
function computeArrangedIndices(
  existingBlocks: { topic_order_index: number }[],
  placements: { new_block_index: number; insert_after_existing_index: number | null }[],
  newBlockCount: number,
  maxExistingIndex: number,
): number[] {
  const indices = new Array<number>(newBlockCount).fill(0);
  const STEP = 1000;

  for (const p of placements) {
    const i = p.new_block_index;
    if (i >= newBlockCount) continue;

    if (p.insert_after_existing_index === null) {
      // Insert at very beginning
      const firstIdx = existingBlocks[0]?.topic_order_index ?? STEP;
      indices[i] = Math.max(1, Math.floor(firstIdx / 2));
    } else {
      const afterIdx = p.insert_after_existing_index;
      const afterBlock = existingBlocks[afterIdx];
      const nextBlock = existingBlocks[afterIdx + 1];
      if (!afterBlock) {
        indices[i] = maxExistingIndex + STEP;
      } else if (!nextBlock) {
        indices[i] = (afterBlock.topic_order_index ?? 0) + STEP;
      } else {
        indices[i] = Math.floor(((afterBlock.topic_order_index ?? 0) + (nextBlock.topic_order_index ?? 0)) / 2);
      }
    }
  }
  return indices;
}

async function processDocument(documentId: string): Promise<void> {
  await ensureSuperuserAuth();

  const doc = await pb.collection("documents").getOne(documentId);
  await pb.collection("documents").update(documentId, { status: "processing" });

  const fileBuffer = await fetchUploadedFile(doc as never);
  const text = doc.source_type === "pdf" ? await extractPdfText(fileBuffer) : await transcribeVideo(fileBuffer);

  const newBlocks = await generateLectureDoc(doc.title, text);

  const topicId: string | null = doc.topic_id || null;
  const integrationMode: "append" | "arrange" = doc.integration_mode === "arrange" ? "arrange" : "append";

  // Compute topic_order_index for each new block
  const STEP = 1000;
  let topicOrderIndices: number[];

  if (topicId) {
    const maxExisting = await getMaxTopicOrderIndex(topicId);

    if (integrationMode === "arrange" && maxExisting > 0) {
      const existingExplainers = await getExistingTopicBlocks(topicId);
      const placements = await arrangeTopicBlocks(
        existingExplainers.map((b, i) => ({ summary: b.summary, index: i })),
        newBlocks,
      );

      // Build full existing block list (all blocks, for computing midpoints)
      const allExisting = await pb.collection("blocks").getFullList({
        filter: pb.filter("topic_id = {:tid}", { tid: topicId }),
        fields: "topic_order_index",
      });
      allExisting.sort((a, b) => (a.topic_order_index ?? 0) - (b.topic_order_index ?? 0));

      // Map explainer placements back to all new blocks: quiz blocks follow their preceding explainer
      const explainerIndices = computeArrangedIndices(
        allExisting.map((b) => ({ topic_order_index: b.topic_order_index ?? 0 })),
        placements,
        newBlocks.filter((b) => b.type === "explainer").length,
        maxExisting,
      );

      // Assign indices: explainer gets arranged index, quiz gets explainer index + 1
      topicOrderIndices = [];
      let explainerPos = 0;
      for (const block of newBlocks) {
        if (block.type === "explainer") {
          topicOrderIndices.push(explainerIndices[explainerPos] ?? maxExisting + STEP * (explainerPos + 1));
          explainerPos++;
        } else {
          // Quiz follows the last explainer
          const lastExplainerIdx = topicOrderIndices[topicOrderIndices.length - 1] ?? maxExisting;
          topicOrderIndices.push(lastExplainerIdx + 1);
        }
      }
    } else {
      // Append mode: new blocks start after the existing max
      topicOrderIndices = newBlocks.map((_, i) => maxExisting + STEP * (i + 1));
    }
  } else {
    // No topic — just use document order
    topicOrderIndices = newBlocks.map((_, i) => i * STEP);
  }

  const createdBlockIds: string[] = [];
  const createdCardIds: string[] = [];
  try {
    for (let i = 0; i < newBlocks.length; i++) {
      const block = newBlocks[i];
      const blockRecord = await pb.collection("blocks").create({
        document_id: documentId,
        order_index: i,
        type: block.type,
        content: block,
        topic_id: topicId,
        topic_order_index: topicOrderIndices[i],
        locked: false,
      });
      createdBlockIds.push(blockRecord.id);

      if (block.type === "quiz") {
        const cardRecord = await pb.collection("cards").create({
          user_id: doc.user_id,
          document_id: documentId,
          topic_id: topicId,
          block_id: blockRecord.id,
          question: block.question,
          options: block.options,
          answer: block.answer,
          explanation: block.explanation,
          ease_factor: 2.5,
          interval_days: 0,
          reps: 0,
          lapses: 0,
        });
        createdCardIds.push(cardRecord.id);
      }
    }
    await pb.collection("documents").update(documentId, { status: "ready" });
  } catch (err) {
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
