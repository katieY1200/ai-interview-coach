from pydantic import BaseModel
from datetime import datetime


# ── Member ──────────────────────────────────────────────────────────────
class MemberResponse(BaseModel):
    member_code: str
    created_at: datetime

    model_config = {"from_attributes": True}


class MemberVerify(BaseModel):
    member_code: str


# ── Session ──────────────────────────────────────────────────────────────
class SessionCreate(BaseModel):
    company_type: str        # 'large' | 'startup'
    job_category: str        # '개발' | '디자인' | '기획' | '마케팅' | '영업' | '인사'
    mode: str = "normal"     # 'normal' | 'light'
    save_recording: bool = False
    cover_letter: str
    member_code: str | None = None


class QuestionOut(BaseModel):
    id: int
    question_text: str
    question_type: str
    question_order: int


class SessionStartResponse(BaseModel):
    session_id: str
    first_question: QuestionOut
    total_questions: int
    interviewer_tone: str


# ── Answer ───────────────────────────────────────────────────────────────
class AnswerSubmit(BaseModel):
    session_id: str
    question_id: int
    answer_text: str
    answer_duration: int  # seconds


class AnswerResponse(BaseModel):
    next_question: QuestionOut | None = None
    is_complete: bool = False
    followup_reason: str | None = None


# ── Warning ───────────────────────────────────────────────────────────────
class WarningCreate(BaseModel):
    session_id: str
    warning_type: str
    warning_label: str
    timestamp_seconds: int


# ── Result ────────────────────────────────────────────────────────────────
class SessionResult(BaseModel):
    session_id: str
    score: int | None
    strengths: list[str] | None
    improvements: list[str] | None
    attitude_summary: str | None
    answer_analysis: list[dict] | None
    questions: list[dict]
    warnings: list[dict]
    company_type: str
    job_category: str
    mode: str
    interviewer_tone: str
    created_at: datetime
    completed_at: datetime | None


# ── Coach Chat ────────────────────────────────────────────────────────────
class ChatTurn(BaseModel):
    role: str    # 'user' | 'assistant'
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatTurn] = []

class ChatResponse(BaseModel):
    reply: str


# ── History ───────────────────────────────────────────────────────────────
class HistoryItem(BaseModel):
    session_id: str
    company_type: str
    job_category: str
    mode: str
    score: int | None
    created_at: datetime
    status: str
