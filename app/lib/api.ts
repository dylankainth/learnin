import Constants from "expo-constants";
import { cachedRequest } from "./offlineCache";
import type {
  DocumentDetail,
  DocumentSummary,
  DueCard,
  LongformGradeResult,
  LongformQuestion,
  NotificationPrefs,
  ReviewStats,
  Topic,
  TopicDetail,
  TopicStudyDetail,
  User,
} from "./types";

const API_URL = (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? "http://localhost:4000";

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

class ApiError extends Error {}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string> | undefined) };
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (typeof data.error === "string") message = data.error;
    } catch {
      // response had no JSON body
    }
    throw new ApiError(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  me: () => request<{ user: User }>("/me"),
  updateMe: (body: Partial<{ name: string; goal: string | null }>) =>
    request<void>("/me", { method: "PATCH", body: JSON.stringify(body) }),
  topics: {
    list: () => cachedRequest("topics:list", () => request<{ topics: Topic[] }>("/topics")),
    get: (id: string) => cachedRequest(`topics:get:${id}`, () => request<TopicDetail>(`/topics/${id}`)),
    create: (name: string, description?: string) =>
      request<{ topic: Topic }>("/topics", {
        method: "POST",
        body: JSON.stringify({ name, description }),
      }),
    update: (id: string, name: string, description?: string) =>
      request<{ topic: Topic }>(`/topics/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name, description }),
      }),
    delete: (id: string) => request<void>(`/topics/${id}`, { method: "DELETE" }),
    study: (id: string) => cachedRequest(`topics:study:${id}`, () => request<TopicStudyDetail>(`/topics/${id}/study`)),
    saveScroll: (id: string, blockId: string, fraction: number) =>
      request<{ ok: boolean }>(`/topics/${id}/scroll`, {
        method: "PATCH",
        body: JSON.stringify({ blockId, fraction }),
      }),
  },
  blocks: {
    lock: (id: string) => request<{ ok: boolean }>(`/blocks/${id}/lock`, { method: "PATCH" }),
    toggleParagraph: (blockId: string, index: number) =>
      request<{ paragraphIndices: number[] }>(`/blocks/${blockId}/paragraphs/${index}/toggle`, { method: "PATCH" }),
  },
  documents: {
    list: (topicId?: string) =>
      cachedRequest(`documents:list:${topicId ?? "all"}`, () =>
        request<{ documents: DocumentSummary[] }>(`/documents${topicId ? `?topicId=${topicId}` : ""}`),
      ),
    get: (id: string) => cachedRequest(`documents:get:${id}`, () => request<DocumentDetail>(`/documents/${id}`)),
    upload: (form: FormData) => request<{ document: DocumentSummary }>("/documents", { method: "POST", body: form }),
    remove: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),
  },
  review: {
    due: (limit = 20, filters?: { documentId?: string; topicId?: string }) => {
      const params = new URLSearchParams({ limit: String(limit) });
      if (filters?.documentId) params.append("documentId", filters.documentId);
      if (filters?.topicId) params.append("topicId", filters.topicId);
      return cachedRequest(`review:due:${params.toString()}`, () =>
        request<{ cards: DueCard[] }>(`/review/due?${params.toString()}`),
      );
    },
    stats: () => cachedRequest("review:stats", () => request<ReviewStats>("/review/stats")),
    submit: (cardId: string, rating: 1 | 2 | 3 | 4, confidence?: number) =>
      request<{ dueAt: string; intervalDays: number }>(`/review/${cardId}`, {
        method: "POST",
        body: JSON.stringify({ rating, confidencePre: confidence }),
      }),
    quiz: (topicId: string, limit = 5, documentId?: string) => {
      const params = new URLSearchParams({ topicId, limit: String(limit) });
      if (documentId) params.append("documentId", documentId);
      return request<{ cards: { id: string; question: string; options: string[] | null; answer: string; explanation: string; question_type: string }[] }>(
        `/review/quiz?${params.toString()}`
      );
    },
    longform: {
      generate: (topicId: string, documentId?: string, count = 3) =>
        request<{ questions: LongformQuestion[] }>("/review/longform/generate", {
          method: "POST",
          body: JSON.stringify({ topicId, documentId, count }),
        }),
      submit: (id: string, answer: string) =>
        request<LongformGradeResult>(`/review/longform/${id}/submit`, {
          method: "POST",
          body: JSON.stringify({ answer }),
        }),
    },
  },
  notifications: {
    register: (expoPushToken: string) =>
      request<void>("/notifications/register", { method: "POST", body: JSON.stringify({ expoPushToken }) }),
    getPrefs: () => request<{ prefs: NotificationPrefs | null }>("/notifications/prefs"),
    updatePrefs: (body: Partial<{ enabled: boolean; reminderHourLocal: number; timezone: string }>) =>
      request<void>("/notifications/prefs", { method: "PATCH", body: JSON.stringify(body) }),
    quizComplete: (body: { failedCount: number }) =>
      request<void>("/notifications/quiz-complete", { method: "POST", body: JSON.stringify(body) }),
  },
  progress: {
    heatmap: (days = 90) =>
      cachedRequest(`progress:heatmap:${days}`, () =>
        request<{ heatmap: { date: string; count: number }[] }>(`/progress/heatmap?days=${days}`),
      ),
    retention: () =>
      cachedRequest("progress:retention", () =>
        request<{ studied: number; lapsed: number; avgReps: number; retentionRate: number; total: number; correct: number }>(
          "/progress/retention",
        ),
      ),
    seedSampleData: () => request<{ seeded: number }>("/progress/seed-sample-data", { method: "POST" }),
    firstUnderstanding: () =>
      cachedRequest("progress:first-understanding", () =>
        request<{ rate: number; correct: number; total: number }>("/progress/first-understanding"),
      ),
  },
  chat: {
    start: (documentId: string) =>
      request<{ sessionId: string; initialPrompt: string; systemPrompt: string }>("/chat/start", {
        method: "POST",
        body: JSON.stringify({ documentId }),
      }),
    message: (userMessage: string, documentId: string, history?: { role: "user" | "assistant"; content: string }[]) =>
      request<{ response: string }>("/chat/message", {
        method: "POST",
        body: JSON.stringify({ userMessage, documentId, history }),
      }),
  },
};
