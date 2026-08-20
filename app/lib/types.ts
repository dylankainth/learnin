export interface User {
  id: string;
  email: string;
  name: string;
  goal: string | null;
}

export interface Topic {
  id: string;
  name: string;
  description?: string;
  color_accent?: string;
  created_at: string;
  content_count: number;
  card_count: number;
  due_count: number;
}

export interface DocumentSummary {
  id: string;
  title: string;
  source_type: "pdf" | "video";
  status: "pending" | "processing" | "ready" | "error";
  created_at: string;
  card_count: string;
  due_count: string;
  topic_id?: string;
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
  topic_id?: string;
  topic_name?: string;
  question_type?: "multiple-choice" | "free-text" | "cloze" | "true-false";
  elaboration_prompt?: string;
  difficulty?: number;
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

export interface TopicDetail {
  topic: Topic;
  contents: DocumentSummary[];
}

export interface TopicBlock {
  id: string;
  type: "explainer" | "quiz";
  topic_order_index: number;
  locked: boolean;
  // explainer fields
  markdown?: string;
  // quiz fields
  question?: string;
  options?: string[] | null;
  answer?: string;
  explanation?: string;
  cardId?: string;
  dueAt?: string;
  reps?: number;
}

export interface TopicStudyDetail {
  topic: {
    id: string;
    name: string;
    description?: string;
    color_accent?: string;
  };
  processingCount: number;
  blocks: TopicBlock[];
}
