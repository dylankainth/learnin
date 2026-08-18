import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { env } from "../env.js";

const client = new Anthropic({ apiKey: env.anthropicApiKey });

// Single-shot budget: most single lectures (a 60-90min transcript, or a
// lecture-length PDF) fit well inside this and give the model the whole
// source in view, which keeps the explainer coherent and lets it decide
// where quizzes belong. Only text longer than this gets chunked.
const SINGLE_SHOT_CHAR_BUDGET = 60_000;
const CHUNK_CHAR_BUDGET = 40_000;

const explainerBlock = z.object({
  type: z.literal("explainer"),
  markdown: z
    .string()
    .describe("A few paragraphs of clear, conversational explainer prose covering one coherent idea from the source material."),
});

const quizBlock = z.object({
  type: z.literal("quiz"),
  question: z.string().describe("A short recall/understanding question about the explainer text immediately above it."),
  options: z
    .array(z.string())
    .min(2)
    .max(5)
    .nullable()
    .describe("2-5 multiple choice options if this suits a multiple-choice format, otherwise null for a short free-recall answer."),
  answer: z.string().describe("The correct answer — exact text of the correct option if options is set, otherwise a short model answer."),
  explanation: z.string().describe("One or two sentences explaining why the answer is correct, for after the learner responds."),
});

const chunkResultSchema = z.object({
  blocks: z
    .array(z.discriminatedUnion("type", [explainerBlock, quizBlock]))
    .describe("Ordered list of blocks. Every explainer block should be followed by exactly one quiz block testing what was just introduced, before moving to the next idea."),
  running_summary: z
    .string()
    .describe("A brief (3-6 sentence) rolling summary of everything covered so far, including this chunk. Used as context for continuing the document — do not repeat quizzes already asked."),
});

export type ExplainerBlock = z.infer<typeof explainerBlock>;
export type QuizBlock = z.infer<typeof quizBlock>;
export type GeneratedBlock = ExplainerBlock | QuizBlock;

const SYSTEM_PROMPT = `You are an expert teacher turning raw lecture material (a PDF's extracted text, or a video's transcript) into a long-form, scrollable study document in the style of quantum.country / Duolingo: clear, friendly explainer prose broken into short digestible sections, with a quiz question testing recall inserted right after each new idea before moving to the next one.

Rules:
- Cover the source material faithfully and in full — don't skip sections or invent content that isn't there.
- Write explainer blocks as if teaching a curious student who has not seen the source: define terms, motivate why each idea matters, use concrete examples.
- Keep each explainer block focused on ONE idea (roughly 80-200 words) so a quiz can immediately follow it.
- After every explainer block, add exactly one quiz block testing the idea just introduced. Vary between multiple-choice and short-answer (options: null) questions.
- Quiz questions should test understanding and recall, not trivia — the kind of question that, reviewed later with spaced repetition, cements the concept in long-term memory.
- Do not ask a quiz question about anything not yet explained.`;

function buildUserPrompt(params: {
  title: string;
  text: string;
  priorSummary?: string;
  isFinalChunk: boolean;
}): string {
  const parts: string[] = [];
  if (params.priorSummary) {
    parts.push(
      `Context — summary of the document so far (do not re-teach or re-quiz this, just stay consistent with it):\n${params.priorSummary}`,
    );
  }
  parts.push(`Lecture title: ${params.title}`);
  parts.push(
    params.priorSummary
      ? `Continue the document using this next portion of the source material:\n\n${params.text}`
      : `Source material:\n\n${params.text}`,
  );
  return parts.join("\n\n");
}

async function generateChunk(params: {
  title: string;
  text: string;
  priorSummary?: string;
  isFinalChunk: boolean;
}) {
  const response = await client.messages.parse({
    model: env.anthropicModel,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(params) }],
    output_config: { format: zodOutputFormat(chunkResultSchema) },
  });
  if (!response.parsed_output) {
    throw new Error("Claude did not return a parseable lecture document");
  }
  return response.parsed_output;
}

function splitIntoChunks(text: string, budget: number): string[] {
  if (text.length <= budget) return [text];
  const paragraphs = text.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    if (current.length + para.length + 2 > budget && current.length > 0) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Turns raw extracted lecture text into an ordered list of explainer/quiz
 * blocks. Single API call for a normal lecture; chunked map-reduce (each
 * chunk sees a rolling summary of what came before) for very long sources.
 */
export async function generateLectureDoc(title: string, fullText: string): Promise<GeneratedBlock[]> {
  const text = fullText.trim();
  if (!text) {
    throw new Error("No extractable text found in the uploaded source");
  }

  if (text.length <= SINGLE_SHOT_CHAR_BUDGET) {
    const result = await generateChunk({ title, text, isFinalChunk: true });
    return result.blocks;
  }

  const chunks = splitIntoChunks(text, CHUNK_CHAR_BUDGET);
  const blocks: GeneratedBlock[] = [];
  let summary: string | undefined;

  for (let i = 0; i < chunks.length; i++) {
    const result = await generateChunk({
      title,
      text: chunks[i],
      priorSummary: summary,
      isFinalChunk: i === chunks.length - 1,
    });
    blocks.push(...result.blocks);
    summary = result.running_summary;
  }

  return blocks;
}
