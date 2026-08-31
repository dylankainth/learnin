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

// Shapes of the two block types the app stores and renders (see `flattenSections`
// below for how generation actually produces them — this pair only exists for
// the exported ExplainerBlock/QuizBlock/GeneratedBlock types the rest of the
// codebase imports).
const explainerBlock = z.object({
  type: z.literal("explainer"),
  markdown: z.string(),
});

const NO_LATEX_NOTE =
  "This text renders as plain, unformatted text (no markdown, no LaTeX/KaTeX) — never use LaTeX commands " +
  "(\\Sigma, \\langle, \\varepsilon, etc.) or markdown syntax (`backticks`, **bold**); write formal notation " +
  "directly with Unicode symbols (Σ σ δ ε λ α β × ÷ ± → ∈ ⊆ ∪ ∩ ∅ ≤ ≥ ≠ ⟨ ⟩) and plain punctuation instead.";

const quizFields = {
  question: z.string().describe(`A recall or understanding question testing the section just above it. ${NO_LATEX_NOTE}`),
  options: z
    .array(z.string())
    .min(2)
    .max(4)
    .nullable()
    .describe(`2-4 multiple choice options when that format is appropriate, otherwise null for a short free-recall answer. ${NO_LATEX_NOTE}`),
  answer: z.string().describe(`The correct answer — exact text of the correct option if options is set, otherwise a concise model answer. ${NO_LATEX_NOTE}`),
  explanation: z.string().describe(`One or two sentences explaining why the answer is correct. ${NO_LATEX_NOTE}`),
};

const quizBlock = z.object({ type: z.literal("quiz"), ...quizFields });

// The model generates {markdown, quiz} pairs rather than a flat list of
// independently-typed blocks. A flat array only *suggests* an alternating
// explainer/quiz pattern via prompt wording — nothing stops the model from
// drifting into "explain everything, then quiz everything" for a long
// document, which reads fine to the model but shows up in the app as a wall
// of text followed by a stack of quiz prompts with nothing between them.
// Tying each quiz to its section as one JSON object makes that structurally
// impossible: there is no array position a quiz block could end up in other
// than right after the section it belongs to.
const sectionSchema = z.object({
  markdown: z.string().describe(
    "Rich markdown for one major section of the document, written like a teacher explaining the idea out " +
    "loud to a curious student — not like a textbook summarizing it. " +
    "Start with a ## heading for the section title. " +
    "Use ### for subsections and #### for sub-subsections if the section warrants it. " +
    "Write in full paragraphs (3-6 sentences each) separated by blank lines, in a natural, spoken-explanation " +
    "register: short connecting sentences, not a wall of dense claims. Explain what a term means and why it " +
    "matters before naming it, then **bold** it on that first mention — don't bold every technical noun that " +
    "follows, and don't let the passage turn into a list of named frameworks. " +
    "Use *italic* for emphasis and titles. " +
    "Use `inline code` for technical terms, variable names, formulas. " +
    "Use fenced code blocks (```language\\n...\\n```) for multi-line code or pseudocode. " +
    "Use - bullet lists for enumerable items; use 1. numbered lists for steps or ranked items. " +
    "Math and formal notation: the renderer is plain markdown with NO LaTeX/KaTeX/MathJax support, so raw LaTeX " +
    "commands (\\Sigma, \\langle, \\varepsilon, \\times, \\rightarrow, $...$, \\(...\\), etc.) render as literal " +
    "backslashed text, not symbols — never write them. Use the actual Unicode character instead " +
    "(Σ σ δ ε λ α β Γ Π μ θ, × ÷ ± → ⇒ ↔ ∈ ∉ ⊆ ⊂ ∪ ∩ ∅ ≤ ≥ ≠ ∀ ∃ ⟨ ⟩ ∞ …) and wrap the whole expression in " +
    "`inline code`, e.g. `A = ⟨Σ, Q, q₀, F, δ⟩` or `δ: Q × Σ → Q`. Superscript/subscript characters " +
    "(⁰¹²³ⁿ, ₀₁₂ᵢⱼ) are fine inline; for anything without a clean Unicode form, spell it out in words instead " +
    "of falling back to LaTeX. " +
    "When the section describes a process, workflow, sequence of steps, decision logic, system architecture, " +
    "hierarchy/taxonomy, state machine, or the relationships between several named things, include one small " +
    "```mermaid\\n...\\n``` diagram (flowchart, sequenceDiagram, classDiagram, stateDiagram-v2, or graph) right " +
    "after the paragraph it illustrates. " +
    "When the section instead describes how something changes, grows, matures, or declines over time — an " +
    "S-curve, adoption curve, exponential or diminishing trend, learning curve, or any other named curve or " +
    "cycle — actually plot it with a ```mermaid\\nxychart-beta\\n...\\n``` chart right after the paragraph, " +
    "using illustrative, roughly-correct values and axis/stage labels drawn from the text, instead of only " +
    "describing its shape in prose. " +
    "Only include a diagram when it would genuinely clarify structure or a trend a reader would otherwise have " +
    "to hold in their head; skip it for sections that are purely descriptive or narrative. " +
    "Never invent structure or data the source doesn't support just to include a diagram. Keep diagrams small " +
    "(roughly 3-8 nodes or data points) and use short, plain-text labels — mermaid syntax is strict, so double-" +
    "check node/edge/chart syntax is valid and avoid parentheses, colons, or quotes inside unquoted labels. " +
    "Aim for 200-600 words — enough to thoroughly cover the idea with examples. " +
    "Do NOT add a quiz question inside this markdown — use the separate quiz field for that.",
  ),
  quiz: z
    .object(quizFields)
    .nullable()
    .describe(
      "A quiz testing genuine understanding of the section above (not surface recall) — vary between " +
      "multiple-choice (options array) and free-recall (options: null). Never ask about material not yet " +
      "covered by this or an earlier section. Set to null only for a short section where quizzing would be " +
      "forced (e.g. a brief intro or transition) — most sections should have a quiz.",
    ),
});

const chunkResultSchema = z.object({
  sections: z
    .array(sectionSchema)
    .describe(
      "Ordered list of sections covering the source material end-to-end, each pairing one rich explainer " +
      "passage with the quiz that tests it. Prefer fewer, richer sections over many tiny ones.",
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

/** Turns {markdown, quiz} section pairs into the flat explainer/quiz block list the rest of the app stores and renders. */
function flattenSections(sections: z.infer<typeof sectionSchema>[]): GeneratedBlock[] {
  const blocks: GeneratedBlock[] = [];
  for (const section of sections) {
    blocks.push({ type: "explainer", markdown: section.markdown });
    if (section.quiz) {
      blocks.push({ type: "quiz", ...section.quiz });
    }
  }
  return blocks;
}

const SYSTEM_PROMPT = `You are a warm, sharp teacher walking a student through this material one idea at a time — not an author summarizing a textbook chapter. Picture explaining it out loud to someone smart but new to the topic: build intuition before naming things, favor plain language over jargon, and let examples and "why this matters" carry as much weight as definitions. If a passage reads like a glossary entry or a Wikipedia summary, rewrite it as an explanation.

CRITICAL — output shape: respond with a "sections" array. Each section is one object with a "markdown" field and a "quiz" field (or quiz: null) — never a flat list of separately-typed items, and never a section with no markdown.

Rules:
- Cover the source material faithfully and completely — do not skip topics or invent content.
- markdown: rich text for one major section. Start with a ## heading. Use ### for subsections, #### for sub-subsections. Write full paragraphs (3-6 sentences each) in a natural, spoken-explanation register — short connecting sentences, not a wall of dense claims stitched together. Introduce a term by explaining what it means and why it exists before naming it, then **bold** it on that first mention; don't bold every technical noun that follows, and don't let a passage collapse into a list of named frameworks or citations. Use *italic* for emphasis, \`inline code\` for technical terms, fenced code blocks for multi-line code, - bullet lists, 1. numbered lists. Prefer one well-explained example over a catalog of named concepts. Aim for 200-600 words per section.
- Math/formal notation: NEVER use LaTeX commands (\\Sigma, \\langle, \\varepsilon, \\rightarrow, $...$, etc.) — the renderer is plain markdown and shows them as literal backslashed text. Use real Unicode symbols instead (Σ σ δ ε λ α β Γ Π μ θ × ÷ ± → ⇒ ↔ ∈ ⊆ ∪ ∩ ∅ ≤ ≥ ≠ ∀ ∃ ⟨ ⟩ ∞) wrapped in \`inline code\`, e.g. \`A = ⟨Σ, Q, q₀, F, δ⟩\`.
- Diagrams — structure: when a section describes a process, workflow, decision logic, system architecture, hierarchy, state machine, or how several named things relate, add one compact \`\`\`mermaid fenced diagram (flowchart/graph, sequenceDiagram, classDiagram, or stateDiagram-v2) right after the paragraph it illustrates.
- Diagrams — trends and curves: when a section instead describes how something changes, grows, matures, or declines over time — an S-curve, adoption curve, exponential or diminishing trend, learning curve, or any other named curve or cycle — actually draw it with a \`\`\`mermaid xychart-beta chart right after the paragraph, instead of only describing its shape in prose. Use illustrative, roughly-correct values and label axes/stages from the text, e.g.:
  \`\`\`mermaid
  xychart-beta
      title "Technology S-Curve"
      x-axis [Emergence, Growth, Maturity, Decline]
      y-axis "Performance" 0 --> 100
      line [5, 35, 85, 95]
  \`\`\`
- Only include a diagram where it genuinely clarifies structure or a trend a reader would otherwise have to hold in their head — never force one into a purely narrative section, and never invent structure or data the source doesn't support. Keep diagrams small (about 3-8 nodes or data points), use short plain-text labels, and keep the mermaid syntax strictly valid (avoid parentheses/colons/quotes in unquoted labels).
- quiz: test genuine understanding of that section, not surface recall. Vary between multiple-choice (options array) and free-recall (options: null). Only set quiz to null for a short section where quizzing would be forced — most sections should have one.
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
  return { blocks: flattenSections(result.data.sections), running_summary: result.data.running_summary };
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

const longformQuestionSchema = z.object({
  question: z.string().describe(
    "An open-ended essay-style question that requires a multi-sentence written answer synthesizing " +
    `concepts from the material — not answerable with a single word or fact. ${NO_LATEX_NOTE}`,
  ),
  key_points: z
    .array(z.string())
    .min(2)
    .max(6)
    .describe(`2-6 distinct points a strong answer should cover. Used as a grading rubric — not shown to the student before they answer. ${NO_LATEX_NOTE}`),
});

const longformQuestionsResultSchema = z.object({
  questions: z.array(longformQuestionSchema).describe("The generated long-answer questions."),
});

export type LongformQuestion = z.infer<typeof longformQuestionSchema>;

const LONGFORM_QUESTIONS_JSON_SCHEMA = toStrictJsonSchema(longformQuestionsResultSchema);

/**
 * Generates open-ended essay-style questions from a topic's study material,
 * each with a short rubric of key points a strong answer should hit.
 */
export async function generateLongformQuestions(
  title: string,
  content: string,
  count: number,
): Promise<LongformQuestion[]> {
  const text = content.trim().slice(0, SINGLE_SHOT_CHAR_BUDGET);
  if (!text) {
    throw new Error("No study material available to generate questions from");
  }

  const completion = await client.chat.completions.create({
    model: env.openRouterModel,
    messages: [
      {
        role: "system",
        content:
          "You are an expert instructor writing essay-style long-answer questions to test deep, synthesized understanding of study material — the kind of question that can't be answered in one word and rewards explaining connections, reasoning, and examples. " +
          "Spread questions across different parts of the material rather than clustering on one section. " +
          `${NO_LATEX_NOTE} Respond with JSON only, matching the given schema exactly.`,
      },
      {
        role: "user",
        content: `Topic: ${title}\n\nStudy material:\n\n${text}\n\nWrite ${count} long-answer question${count === 1 ? "" : "s"}.`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "longform_questions", strict: true, schema: LONGFORM_QUESTIONS_JSON_SCHEMA },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenRouter returned no content for long-answer question generation");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenRouter did not return valid JSON for long-answer question generation");
  }

  const result = longformQuestionsResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`OpenRouter response didn't match the expected schema: ${result.error.message}`);
  }
  return result.data.questions;
}

const longformGradeSchema = z.object({
  score: z.number().describe("Overall quality score from 0 to 100."),
  verdict: z
    .enum(["excellent", "good", "needs_work", "incorrect"])
    .describe("excellent: 85-100, good: 60-84, needs_work: 30-59, incorrect: 0-29."),
  feedback: z.string().describe(`2-4 sentences of direct, encouraging feedback addressed to the student. ${NO_LATEX_NOTE}`),
  strengths: z.array(z.string()).describe(`What the answer got right. Empty array if none. ${NO_LATEX_NOTE}`),
  missed_points: z.array(z.string()).describe(`Key points from the rubric the answer missed or got wrong. Empty array if none. ${NO_LATEX_NOTE}`),
});

export type LongformGrade = z.infer<typeof longformGradeSchema>;

const LONGFORM_GRADE_JSON_SCHEMA = toStrictJsonSchema(longformGradeSchema);

/**
 * Grades a student's free-form written answer against a question and its
 * rubric key points, returning a score plus qualitative feedback.
 */
export async function gradeLongformAnswer(
  question: string,
  keyPoints: string[],
  userAnswer: string,
): Promise<LongformGrade> {
  const completion = await client.chat.completions.create({
    model: env.openRouterModel,
    messages: [
      {
        role: "system",
        content:
          "You are a fair, encouraging instructor grading a student's written answer to an essay-style question. " +
          "Judge understanding and reasoning, not writing style or exact wording. Partial credit for partially correct or incomplete answers. " +
          `${NO_LATEX_NOTE} Respond with JSON only, matching the given schema exactly.`,
      },
      {
        role: "user",
        content:
          `Question: ${question}\n\n` +
          `Rubric — key points a strong answer should cover:\n${keyPoints.map((p) => `- ${p}`).join("\n")}\n\n` +
          `Student's answer:\n${userAnswer.trim() || "(no answer given)"}\n\n` +
          "Grade this answer.",
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "longform_grade", strict: true, schema: LONGFORM_GRADE_JSON_SCHEMA },
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenRouter returned no content for long-answer grading");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("OpenRouter did not return valid JSON for long-answer grading");
  }

  const result = longformGradeSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`OpenRouter response didn't match the expected schema: ${result.error.message}`);
  }
  const score = Math.max(0, Math.min(100, Math.round(result.data.score)));
  return { ...result.data, score };
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
