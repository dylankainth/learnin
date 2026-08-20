import OpenAI from "openai";
import { z } from "zod/v4";
import { env } from "../env.js";

// OpenRouter exposes an OpenAI-compatible /chat/completions endpoint, so the
// regular openai SDK works unmodified — just point baseURL at OpenRouter and
// pass an OpenRouter API key. HTTP-Referer/X-Title are optional but let
// OpenRouter attribute usage to this app on your dashboard.
const client = new OpenAI({
  apiKey: env.openRouterApiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": env.openRouterSiteUrl,
    "X-Title": env.openRouterAppName,
  },
});

// Single-shot budget: most single lectures (a 60-90min transcript, or a
// lecture-length PDF) fit well inside this and give the model the whole
// source in view, which keeps the explainer coherent and lets it decide
// where quizzes belong. Only text longer than this gets chunked.
const SINGLE_SHOT_CHAR_BUDGET = 60_000;
const CHUNK_CHAR_BUDGET = 40_000;

const explainerBlock = z.object({
  type: z.literal("explainer"),
  markdown: z.string().describe(
    "Rich markdown for one major section of the document. " +
    "Start with a ## heading for the section title. " +
    "Use ### for subsections and #### for sub-subsections if the section warrants it. " +
    "Write in full paragraphs (3-6 sentences each) separated by blank lines. " +
    "Use **bold** for key terms on first introduction, *italic* for emphasis and titles. " +
    "Use `inline code` for technical terms, variable names, formulas. " +
    "Use fenced code blocks (```language\\n...\\n```) for multi-line code or pseudocode. " +
    "Use - bullet lists for enumerable items; use 1. numbered lists for steps or ranked items. " +
    "Aim for 200-600 words — enough to thoroughly cover the idea with examples. " +
    "Do NOT add a quiz question inside this block.",
  ),
});

const quizBlock = z.object({
  type: z.literal("quiz"),
  question: z.string().describe("A recall or understanding question testing the section just above it."),
  options: z
    .array(z.string())
    .min(2)
    .max(4)
    .nullable()
    .describe("2-4 multiple choice options when that format is appropriate, otherwise null for a short free-recall answer."),
  answer: z.string().describe("The correct answer — exact text of the correct option if options is set, otherwise a concise model answer."),
  explanation: z.string().describe("One or two sentences explaining why the answer is correct."),
});

const chunkResultSchema = z.object({
  blocks: z
    .array(z.discriminatedUnion("type", [explainerBlock, quizBlock]))
    .describe(
      "Ordered list of blocks. Each item MUST have type 'explainer' or type 'quiz' — no other values. " +
      "Pattern: explainer (rich ## section) followed by quiz (at the section break), repeat. " +
      "Prefer fewer, richer explainer blocks over many tiny ones.",
    ),
  running_summary: z
    .string()
    .describe("A brief (3-6 sentence) rolling summary of everything covered so far, including this chunk. Used as context for continuing the document."),
});

export type ExplainerBlock = z.infer<typeof explainerBlock>;
export type QuizBlock = z.infer<typeof quizBlock>;
export type GeneratedBlock = ExplainerBlock | QuizBlock;

function toStrictJsonSchema(schema: z.ZodType): Record<string, unknown> {
  const { $schema, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

const CHUNK_RESULT_JSON_SCHEMA = toStrictJsonSchema(chunkResultSchema);

const SYSTEM_PROMPT = `You are an expert author turning raw lecture material into a polished, book-quality study document — think a well-written textbook chapter or a high-quality online course page.

CRITICAL — block types: The blocks array may only contain objects with type "explainer" or type "quiz". No other type values are valid. Do not use "section", "heading", "text", "paragraph", or anything else.

Rules:
- Cover the source material faithfully and completely — do not skip topics or invent content.
- type "explainer": rich markdown for one major section. Start the markdown with a ## heading. Use ### for subsections, #### for sub-subsections. Write full paragraphs (3-6 sentences each). Use **bold** for key terms on first use, *italic* for emphasis, \`inline code\` for technical terms, fenced code blocks for multi-line code, - bullet lists, 1. numbered lists. Aim for 200-600 words per explainer block.
- type "quiz": placed after each explainer block at the section boundary. Test genuine understanding, not surface recall. Vary between multiple-choice (options array) and free-recall (options: null).
- Do not ask quiz questions about topics not yet explained.
- Respond with JSON only, matching the given schema exactly.`;

function buildUserPrompt(params: {
  title: string;
  text: string;
  priorSummary?: string;
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

async function generateChunk(params: { title: string; text: string; priorSummary?: string }) {
  const completion = await client.chat.completions.create({
    model: env.openRouterModel,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(params) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "lecture_chunk", strict: true, schema: CHUNK_RESULT_JSON_SCHEMA },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenRouter returned no content for lecture generation");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenRouter did not return valid JSON for lecture generation");
  }

  const result = chunkResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`OpenRouter response didn't match the expected schema: ${result.error.message}`);
  }
  return result.data;
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

const arrangementSchema = z.object({
  placements: z
    .array(
      z.object({
        new_block_index: z.number().describe("0-based index into the new_blocks array"),
        insert_after_existing_index: z
          .number()
          .nullable()
          .describe("0-based index into existing_blocks to insert after, or null to insert at the very beginning"),
      }),
    )
    .describe("One entry per new block, describing where it fits best in the existing document"),
});

const ARRANGEMENT_JSON_SCHEMA = toStrictJsonSchema(arrangementSchema);

export type BlockPlacement = { new_block_index: number; insert_after_existing_index: number | null };

/**
 * Given summaries of existing (unlocked) topic blocks and new blocks just
 * generated, returns optimal insertion placements for the new content so the
 * topic reads as a single coherent document.
 */
export async function arrangeTopicBlocks(
  existingBlocks: { summary: string; index: number }[],
  newBlocks: GeneratedBlock[],
): Promise<BlockPlacement[]> {
  const existingList = existingBlocks
    .map((b, i) => `[${i}] ${b.summary}`)
    .join("\n");
  const newList = newBlocks
    .filter((b) => b.type === "explainer")
    .map((b, i) => `[${i}] ${(b as ExplainerBlock).markdown.slice(0, 200)}`)
    .join("\n");

  const completion = await client.chat.completions.create({
    model: env.openRouterModel,
    messages: [
      {
        role: "system",
        content:
          "You are a curriculum designer. Given an existing document outline and new content blocks, determine the optimal insertion point for each new block so the document reads as a single coherent unit. Respond with JSON only.",
      },
      {
        role: "user",
        content: `Existing document blocks (in order):\n${existingList || "(empty)"}\n\nNew blocks to insert:\n${newList}\n\nFor each new block, specify which existing block index to insert it after (null = insert at the beginning). If a new block logically continues from the end of the existing document, use the last existing block index.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "arrangement", strict: true, schema: ARRANGEMENT_JSON_SCHEMA },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenRouter returned no content for block arrangement");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenRouter did not return valid JSON for block arrangement");
  }

  const result = arrangementSchema.safeParse(parsed);
  if (!result.success) {
    // Fall back to appending everything at the end
    return newBlocks.map((_, i) => ({
      new_block_index: i,
      insert_after_existing_index: existingBlocks.length - 1,
    }));
  }
  return result.data.placements;
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
    const result = await generateChunk({ title, text });
    return result.blocks;
  }

  const chunks = splitIntoChunks(text, CHUNK_CHAR_BUDGET);
  const blocks: GeneratedBlock[] = [];
  let summary: string | undefined;

  for (const chunk of chunks) {
    const result = await generateChunk({ title, text: chunk, priorSummary: summary });
    blocks.push(...result.blocks);
    summary = result.running_summary;
  }

  return blocks;
}
