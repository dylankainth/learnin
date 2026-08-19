export interface User {
  id: string;
  email: string;
  name: string;
  goal: string | null;
}

export interface DocumentSummary {
  id: string;
  title: string;
  source_type: "pdf" | "video";
  status: "pending" | "processing" | "ready" | "error";
  created_at: string;
  card_count: string;
  due_count: string;
}

export interface ExplainerBlock {
  id: string;
  type: "explainer";
  markdown: string;
}

export interface QuizBlockView {
  id: string;
  type: "quiz";
  question: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  cardId?: string;
  dueAt?: string;
  reps?: number;
  question_type?: "multiple-choice" | "free-text" | "cloze" | "true-false";
}

export type DocBlock = ExplainerBlock | QuizBlockView;

export interface DocumentDetail {
  document: {
    id: string;
    title: string;
    sourceType: "pdf" | "video";
    status: "pending" | "processing" | "ready" | "error";
    errorMessage?: string;
    createdAt: string;
  };
  blocks: DocBlock[];
}

export interface DueCard {
  id: string;
  question: string;
  options: string[] | null;
  answer: string;
  explanation: string;
  due_at: string;
  document_title: string;
  question_type?: "multiple-choice" | "free-text" | "cloze" | "true-false";
}

export interface ReviewStats {
  due_now: string;
  total_cards: string;
  studied: string;
  streak: number;
}

export interface NotificationPrefs {
  enabled: boolean;
  reminder_hour_local: number;
  timezone: string;
}
