import type {
  SessionStartResponse,
  AnswerResponse,
  SessionResult,
  HistoryItem,
} from '../types';

const BASE = 'http://127.0.0.1:8000/api';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `요청 실패 (${res.status})`);
  }
  return res.json();
}

export const api = {
  members: {
    create: () => request<{ member_code: string; created_at: string }>('/members/create', { method: 'POST' }),
    verify: (code: string) =>
      request<{ valid: boolean; member_id: string; created_at: string }>('/members/verify', {
        method: 'POST',
        body: JSON.stringify({ member_code: code }),
      }),
  },

  sessions: {
    start: (data: {
      company_type: string;
      job_category: string;
      mode: string;
      save_recording: boolean;
      cover_letter: string;
      member_code?: string;
    }) =>
      request<SessionStartResponse>('/sessions/start', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    answer: (data: {
      session_id: string;
      question_id: number;
      answer_text: string;
      answer_duration: number;
    }) =>
      request<AnswerResponse>('/sessions/answer', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    complete: (sessionId: string) =>
      request<SessionResult>(`/sessions/complete/${sessionId}`, { method: 'POST' }),

    getResult: (sessionId: string) =>
      request<SessionResult>(`/sessions/${sessionId}/result`),

    addWarning: (data: {
      session_id: string;
      warning_type: string;
      warning_label: string;
      timestamp_seconds: number;
    }) =>
      request<{ ok: boolean }>('/sessions/warnings', {
        method: 'POST',
        body: JSON.stringify(data),
      }),

    getHistory: (memberCode: string) =>
      request<HistoryItem[]>(`/sessions/history/${memberCode}`),

    chat: (
      sessionId: string,
      data: { message: string; history: { role: string; content: string }[] }
    ) =>
      request<{ reply: string }>(`/sessions/${sessionId}/chat`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },
};
