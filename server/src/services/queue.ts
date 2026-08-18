import { Queue } from "bullmq";
import { Redis } from "ioredis";
import { env } from "../env.js";

export const connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });

export interface IngestJobData {
  documentId: string;
}

export const ingestQueue = new Queue<IngestJobData>("ingest", { connection });

export async function enqueueIngest(documentId: string): Promise<void> {
  await ingestQueue.add("ingest-document", { documentId }, {
    attempts: 2,
    backoff: { type: "exponential", delay: 5000 },
  });
}
