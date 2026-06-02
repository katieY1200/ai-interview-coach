from sqlalchemy import Column, String, Integer, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base
from datetime import datetime
import uuid


def _uuid() -> str:
    return str(uuid.uuid4())


class Member(Base):
    __tablename__ = "members"

    id = Column(String(36), primary_key=True, default=_uuid)
    member_code = Column(String(8), unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    sessions = relationship("InterviewSession", back_populates="member")


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    id = Column(String(36), primary_key=True, default=_uuid)
    member_id = Column(String(36), ForeignKey("members.id", ondelete="SET NULL"), nullable=True)
    company_type = Column(String(20), nullable=False)   # 'large' | 'startup'
    job_category = Column(String(20), nullable=False)   # '개발' | '디자인' | ...
    mode = Column(String(10), nullable=False, default="normal")  # 'normal' | 'light'
    interviewer_tone = Column(String(10), nullable=False)        # 'strict' | 'neutral' | 'friendly'
    save_recording = Column(Boolean, default=False)
    cover_letter = Column(Text, nullable=False)
    score = Column(Integer, nullable=True)
    strengths = Column(JSON, nullable=True)
    improvements = Column(JSON, nullable=True)
    attitude_summary = Column(Text, nullable=True)
    answer_analysis = Column(JSON, nullable=True)
    status = Column(String(20), default="in_progress")  # 'in_progress' | 'completed'
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    member = relationship("Member", back_populates="sessions")
    questions = relationship(
        "InterviewQuestion",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="InterviewQuestion.question_order",
    )
    warnings = relationship(
        "BehaviorWarning",
        back_populates="session",
        cascade="all, delete-orphan",
    )


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(String(20), nullable=False)  # 'cover_letter' | 'personality' | 'followup'
    parent_question_id = Column(Integer, ForeignKey("interview_questions.id", ondelete="SET NULL"), nullable=True)
    answer_text = Column(Text, nullable=True)
    answer_duration = Column(Integer, nullable=True)  # seconds
    question_order = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("InterviewSession", back_populates="questions")


class BehaviorWarning(Base):
    __tablename__ = "behavior_warnings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(36), ForeignKey("interview_sessions.id", ondelete="CASCADE"), nullable=False)
    warning_type = Column(String(50), nullable=False)
    warning_label = Column(String(100), nullable=False)
    timestamp_seconds = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("InterviewSession", back_populates="warnings")
