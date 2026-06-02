export interface Question {
  id: number;
  question_text: string;
  question_type: 'cover_letter' | 'personality' | 'followup';
  question_order: number;
}

export interface SessionStartResponse {
  session_id: string;
  first_question: Question;
  total_questions: number;
  interviewer_tone: 'strict' | 'neutral' | 'friendly';
}

export interface AnswerResponse {
  next_question: Question | null;
  is_complete: boolean;
  followup_reason: string | null;
}

export interface AnswerAnalysis {
  question: string;
  feedback: string;
  level: 'good' | 'warning' | 'danger';
}

export interface SessionResult {
  session_id: string;
  score: number | null;
  strengths: string[];
  improvements: string[];
  attitude_summary: string;
  answer_analysis: AnswerAnalysis[];
  questions: {
    id: number;
    question_text: string;
    question_type: string;
    answer_text: string | null;
    answer_duration: number | null;
    question_order: number;
  }[];
  warnings: {
    warning_type: string;
    warning_label: string;
    timestamp_seconds: number;
  }[];
  company_type: string;
  job_category: string;
  mode: string;
  interviewer_tone: string;
  created_at: string;
  completed_at: string | null;
}

export interface HistoryItem {
  session_id: string;
  company_type: string;
  job_category: string;
  mode: string;
  score: number | null;
  created_at: string;
  status: string;
}

export interface ChatMessage {
  id: string;
  role: 'ai' | 'user';
  text: string;
  questionType?: string;
  questionId?: number;
  duration?: number;
  isTyping?: boolean;
}

export type CompanyType = 'large' | 'startup';
export type JobCategory = '개발' | '디자인' | '기획' | '마케팅' | '영업' | '인사';
export type InterviewMode = 'normal' | 'light';
