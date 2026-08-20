import { Router } from "express";
import { ensureSuperuserAuth, pb } from "../services/pocketbase.js";
import { requireAuth, type AuthedRequest } from "../middleware/auth.js";
import { env } from "../env.js";

export const chatRouter = Router();
chatRouter.use(requireAuth);

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

chatRouter.post("/start", async (req: AuthedRequest, res) => {
  const { documentId } = req.body;
  if (!documentId) {
    res.status(400).json({ error: "documentId required" });
    return;
  }

  await ensureSuperuserAuth();

  let doc;
  try {
    doc = await pb.collection("documents").getOne(documentId);
  } catch {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  if (doc.user_id !== req.userId) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  // Get related cards to provide context
  const cards = await pb.collection("cards").getList(1, 10, {
    filter: pb.filter("document_id = {:docId}", { docId: documentId }),
    fields: "question,answer,explanation",
  });

  const cardsSummary = cards.items.map((c) => ({
    question: c.question as string,
    answer: c.answer as string,
    explanation: c.explanation as string,
  }));

  const systemPrompt = buildSystemPrompt(doc.title, cardsSummary);

  res.json({
    sessionId: Math.random().toString(36).slice(2),
    initialPrompt: `I'm ready to help you learn about ${doc.title} using the Socratic method. Ask me about any concept, and I'll ask you clarifying questions to deepen your understanding.`,
    systemPrompt,
  });
});

chatRouter.post("/message", async (req: AuthedRequest, res) => {
  const { userMessage, documentId, history } = req.body as {
    userMessage?: string;
    documentId?: string;
    history?: ChatMessage[];
  };
  if (!userMessage || !documentId) {
    res.status(400).json({ error: "userMessage and documentId required" });
    return;
  }

  await ensureSuperuserAuth();
  let doc;
  try {
    doc = await pb.collection("documents").getOne(documentId);
  } catch {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  if (doc.user_id !== req.userId) {
    res.status(403).json({ error: "Unauthorized" });
    return;
  }

  const cards = await pb.collection("cards").getList(1, 10, {
    filter: pb.filter("document_id = {:docId}", { docId: documentId }),
    fields: "question,answer,explanation",
  });

  const cardsSummary = cards.items.map((c) => ({
    question: c.question as string,
    answer: c.answer as string,
    explanation: c.explanation as string,
  }));

  const systemPrompt = buildSystemPrompt(doc.title, cardsSummary);
  const priorHistory: ChatMessage[] = Array.isArray(history) ? history.slice(-20) : [];
  const response = await generateSocraticResponse(systemPrompt, priorHistory, userMessage, env.openRouterApiKey);

  res.json({ response });
});

function buildSystemPrompt(
  docTitle: string,
  cards: Array<{ question: string; answer: string; explanation: string }>,
): string {
  const cardContext = cards
    .map((c) => `Q: ${c.question}\nA: ${c.answer}\nExplanation: ${c.explanation}`)
    .join("\n\n---\n\n");

  return `You are a Socratic tutor helping a student learn about "${docTitle}".

Your role is to ask probing questions that help the student think deeply, not to provide direct answers.

Use this context from the document:
${cardContext}

Guidelines:
1. Ask clarifying questions like "What do you mean by...?" or "Can you give an example?"
2. Point out contradictions gently: "Earlier you said X, but now you're saying Y. How do these fit together?"
3. Guide towards understanding, don't just answer: If the student asks "What is X?", ask "What do you think X means?" first
4. Scaffold learning: Start with simple questions, then build to harder ones
5. Stay grounded in the document context provided
6. After the student demonstrates understanding, suggest 1-2 related concepts to explore

Respond naturally and conversationally, not as bullet points.`;
}

async function generateSocraticResponse(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
  apiKey?: string,
): Promise<string> {
  if (!apiKey) {
    return "Socratic chatbot requires OPENROUTER_API_KEY to be configured.";
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": env.openRouterSiteUrl,
      "X-Title": env.openRouterAppName,
    },
    body: JSON.stringify({
      model: env.openRouterModel,
      messages: [
        { role: "system", content: systemPrompt },
        ...history,
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    return "Error generating response. Please try again.";
  }

  const data = (await response.json()) as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message.content || "Unable to generate response.";
}
