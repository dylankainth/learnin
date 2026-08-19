// Generate elaboration prompts to encourage deeper thinking

const ELABORATION_TEMPLATES = [
  "Can you think of a real-world example of this?",
  "How does this relate to something you already know?",
  "Why do you think this matters?",
  "What would happen if the opposite were true?",
  "How would you explain this to a friend?",
  "What are the key implications of this concept?",
  "Can you break this down into simpler parts?",
  "What assumptions are being made here?",
  "How could you apply this in practice?",
  "What's one thing you found surprising about this?",
];

export function generateElaborationPrompt(question: string, answer: string, _explanation: string): string {
  // Rotate through templates based on question hash
  let hash = 0;
  for (let i = 0; i < question.length; i++) {
    hash = (hash * 31 + question.charCodeAt(i)) >>> 0;
  }
  return ELABORATION_TEMPLATES[hash % ELABORATION_TEMPLATES.length];
}

export function generateDifficultyScore(question: string, options?: string[]): number {
  // Simple heuristic: longer questions are harder
  const textLength = question.length + (options?.join("").length ?? 0);
  if (textLength < 100) return 1; // Easy
  if (textLength < 300) return 2; // Medium
  return 3; // Hard
}
