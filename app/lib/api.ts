import Constants from "expo-constants";
import type {
  DocumentDetail,
  DocumentSummary,
  DueCard,
  NotificationPrefs,
  ReviewStats,
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
  documents: {
    list: () => request<{ documents: DocumentSummary[] }>("/documents"),
    get: (id: string) => request<DocumentDetail>(`/documents/${id}`),
    upload: (form: FormData) => request<{ document: DocumentSummary }>("/documents", { method: "POST", body: form }),
    remove: (id: string) => request<void>(`/documents/${id}`, { method: "DELETE" }),
  },
  review: {
    due: (limit = 20, documentId?: string) =>
      request<{ cards: DueCard[] }>(`/review/due?limit=${limit}${documentId ? `&documentId=${documentId}` : ""}`),
    stats: () => request<ReviewStats>("/review/stats"),
    submit: (cardId: string, rating: 1 | 2 | 3 | 4, confidence?: number) =>
      request<{ dueAt: string; intervalDays: number }>(`/review/${cardId}`, {
        method: "POST",
        body: JSON.stringify({ rating, confidencePre: confidence }),
      }),
  },
  notifications: {
    register: (expoPushToken: string) =>
      request<void>("/notifications/register", { method: "POST", body: JSON.stringify({ expoPushToken }) }),
    getPrefs: () => request<{ prefs: NotificationPrefs | null }>("/notifications/prefs"),
    updatePrefs: (body: Partial<{ enabled: boolean; reminderHourLocal: number; timezone: string }>) =>
      request<void>("/notifications/prefs", { method: "PATCH", body: JSON.stringify(body) }),
  },
  progress: {
    heatmap: (days = 90) => request<{ heatmap: { date: string; count: number }[] }>(`/progress/heatmap?days=${days}`),
    retention: () =>
      request<{ studied: number; mastered: number; lapsed: number; avgReps: number; retentionRate: number }>("/progress/retention"),
  },
};
