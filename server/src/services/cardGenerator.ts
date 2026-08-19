// Generate varied question types from content for better active recall
export type QuestionType = "multiple-choice" | "free-text" | "cloze" | "true-false";

export interface GeneratedCard {
  question: string;
  answer: string;
  explanation: string;
  options?: string[];
  type: QuestionType;
}

/**
 * Generate a cloze deletion variant: randomly blank key terms
 * E.g., "Photosynthesis is the process where plants convert ___ into energy"
 */
export function generateClozeDeletion(text: string, answer: string, explanation: string): GeneratedCard {
  // Find key terms in the text that match the answer
  const keyTerms = answer.split(/[,;]/).map((t) => t.trim());
  const firstTerm = keyTerms[0];

  if (!text.includes(firstTerm)) {
    // Fallback to original if term not found
    return {
      question: text,
      answer,
      explanation,
      type: "free-text",
    };
  }

  // Replace first occurrence with blank
  const clozeQuestion = text.replace(firstTerm, "_".repeat(Math.max(3, Math.ceil(firstTerm.length * 0.7))));

  return {
    question: `Fill in the blank: ${clozeQuestion}`,
    answer: firstTerm,
    explanation,
    type: "cloze",
  };
}

/**
 * Generate a true/false variant from a statement
 */
export function generateTrueFalse(question: string, answer: string, isCorrect: boolean): GeneratedCard {
  return {
    question: `True or False: ${question}`,
    answer: isCorrect ? "True" : "False",
    explanation: `This statement is ${isCorrect ? "true" : "false"} because ${answer}`,
    options: ["True", "False"],
    type: "true-false",
  };
}

/**
 * Select the best question type based on content characteristics
 */
export function selectQuestionType(text: string, isDefinition: boolean): QuestionType {
  const textLength = text.length;

  // Short definitions → multiple choice or cloze
  if (isDefinition && textLength < 100) {
    return Math.random() > 0.5 ? "multiple-choice" : "cloze";
  }

  // Medium content → cloze or free-text
  if (textLength < 300) {
    return Math.random() > 0.4 ? "cloze" : "free-text";
  }

  // Long explanations → free-text or true-false
  return Math.random() > 0.5 ? "free-text" : "true-false";
}
