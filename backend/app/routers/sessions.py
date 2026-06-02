from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas
from app.services import claude_service, question_bank

router = APIRouter()

MAX_FOLLOWUP = 2  # normal mode per base question


# ── helpers ──────────────────────────────────────────────────────────────

def _question_out(q: models.InterviewQuestion) -> schemas.QuestionOut:
    return schemas.QuestionOut(
        id=q.id,
        question_text=q.question_text,
        question_type=q.question_type,
        question_order=q.question_order,
    )


def _session_result(
    session: models.InterviewSession,
    questions: list[models.InterviewQuestion],
    warnings: list[models.BehaviorWarning],
) -> schemas.SessionResult:
    return schemas.SessionResult(
        session_id=session.id,
        score=session.score,
        strengths=session.strengths,
        improvements=session.improvements,
        attitude_summary=session.attitude_summary,
        answer_analysis=session.answer_analysis,
        questions=[
            {
                "id": q.id,
                "question_text": q.question_text,
                "question_type": q.question_type,
                "answer_text": q.answer_text,
                "answer_duration": q.answer_duration,
                "question_order": q.question_order,
            }
            for q in questions
        ],
        warnings=[
            {
                "warning_type": w.warning_type,
                "warning_label": w.warning_label,
                "timestamp_seconds": w.timestamp_seconds,
            }
            for w in warnings
        ],
        company_type=session.company_type,
        job_category=session.job_category,
        mode=session.mode,
        interviewer_tone=session.interviewer_tone,
        created_at=session.created_at,
        completed_at=session.completed_at,
    )


# ── endpoints ────────────────────────────────────────────────────────────

# AI 호출(claude_service)이 동기 블로킹이므로 async def 대신 def 사용
# FastAPI는 def 엔드포인트를 threadpool에서 실행해 이벤트 루프를 막지 않는다
@router.post("/start", response_model=schemas.SessionStartResponse)
def start_session(payload: schemas.SessionCreate, db: Session = Depends(get_db)):
    # Resolve member
    member_id = None
    if payload.member_code:
        member = (
            db.query(models.Member)
            .filter(models.Member.member_code == payload.member_code.upper())
            .first()
        )
        if member:
            member_id = member.id

    tone = claude_service.pick_random_tone()

    session = models.InterviewSession(
        member_id=member_id,
        company_type=payload.company_type,
        job_category=payload.job_category,
        mode=payload.mode,
        interviewer_tone=tone,
        save_recording=payload.save_recording,
        cover_letter=payload.cover_letter,
    )
    db.add(session)
    db.flush()

    # Generate questions via Claude; fall back to question bank on failure
    p_fallback = question_bank.get_personality_questions(payload.company_type, 4)
    ai_result = claude_service.generate_interview_questions(
        cover_letter=payload.cover_letter,
        company_type=payload.company_type,
        job_category=payload.job_category,
        mode=payload.mode,
        personality_fallback=p_fallback,
    )

    if ai_result:
        cl_qs = ai_result.get("cover_letter_questions", [])[:2]
        p_qs = ai_result.get("personality_questions", [])[:2] if payload.mode == "normal" else []
    else:
        cl_qs = question_bank.get_fallback_questions(payload.job_category, 2)
        p_qs = p_fallback[:2] if payload.mode == "normal" else []

    # Light mode: use 3-4 cover-letter questions, no personality
    if payload.mode == "light":
        if len(cl_qs) < 3:
            extra = question_bank.get_fallback_questions(payload.job_category, 4)
            seen = set(cl_qs)
            for q in extra:
                if q not in seen:
                    cl_qs.append(q)
                    seen.add(q)
                if len(cl_qs) >= 4:
                    break
        p_qs = []

    order = 0
    all_qs: list[models.InterviewQuestion] = []
    for text in cl_qs:
        q = models.InterviewQuestion(
            session_id=session.id,
            question_text=text,
            question_type="cover_letter",
            question_order=order,
        )
        db.add(q)
        all_qs.append(q)
        order += 1

    for text in p_qs:
        q = models.InterviewQuestion(
            session_id=session.id,
            question_text=text,
            question_type="personality",
            question_order=order,
        )
        db.add(q)
        all_qs.append(q)
        order += 1

    db.commit()
    db.refresh(session)

    first_q = (
        db.query(models.InterviewQuestion)
        .filter(models.InterviewQuestion.session_id == session.id)
        .order_by(models.InterviewQuestion.question_order)
        .first()
    )

    return schemas.SessionStartResponse(
        session_id=session.id,
        first_question=_question_out(first_q),
        total_questions=len(all_qs),
        interviewer_tone=tone,
    )


@router.post("/answer", response_model=schemas.AnswerResponse)
def submit_answer(payload: schemas.AnswerSubmit, db: Session = Depends(get_db)):
    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == payload.session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")
    if session.status == "completed":
        raise HTTPException(status_code=400, detail="이미 완료된 면접입니다.")

    question = db.query(models.InterviewQuestion).filter(
        models.InterviewQuestion.id == payload.question_id,
        models.InterviewQuestion.session_id == payload.session_id,
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="질문을 찾을 수 없습니다.")

    question.answer_text = payload.answer_text
    question.answer_duration = payload.answer_duration

    # Check for followup (normal mode, non-followup questions only)
    if session.mode == "normal" and question.question_type != "followup":
        existing_followups = db.query(models.InterviewQuestion).filter(
            models.InterviewQuestion.session_id == payload.session_id,
            models.InterviewQuestion.parent_question_id == question.id,
        ).count()

        if existing_followups < MAX_FOLLOWUP:
            fu = claude_service.check_followup_needed(
                original_question=question.question_text,
                answer=payload.answer_text,
                followup_count=existing_followups,
                max_followup=MAX_FOLLOWUP,
                tone=session.interviewer_tone,
            )

            if fu.get("need_followup") and fu.get("followup_question"):
                # Shift subsequent questions to make room
                db.query(models.InterviewQuestion).filter(
                    models.InterviewQuestion.session_id == payload.session_id,
                    models.InterviewQuestion.question_order > question.question_order,
                ).update(
                    {"question_order": models.InterviewQuestion.question_order + 1},
                    synchronize_session=False,
                )

                followup_q = models.InterviewQuestion(
                    session_id=payload.session_id,
                    question_text=fu["followup_question"],
                    question_type="followup",
                    parent_question_id=question.id,
                    question_order=question.question_order + 1,
                )
                db.add(followup_q)
                db.commit()
                db.refresh(followup_q)

                return schemas.AnswerResponse(
                    next_question=_question_out(followup_q),
                    is_complete=False,
                    followup_reason=fu.get("reason"),
                )

    # Move to next unanswered question
    next_q = (
        db.query(models.InterviewQuestion)
        .filter(
            models.InterviewQuestion.session_id == payload.session_id,
            models.InterviewQuestion.question_order > question.question_order,
            models.InterviewQuestion.answer_text.is_(None),
        )
        .order_by(models.InterviewQuestion.question_order)
        .first()
    )

    db.commit()

    if next_q:
        return schemas.AnswerResponse(next_question=_question_out(next_q), is_complete=False)
    return schemas.AnswerResponse(is_complete=True)


@router.post("/complete/{session_id}", response_model=schemas.SessionResult)
def complete_session(session_id: str, db: Session = Depends(get_db)):
    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    questions = (
        db.query(models.InterviewQuestion)
        .filter(models.InterviewQuestion.session_id == session_id)
        .order_by(models.InterviewQuestion.question_order)
        .all()
    )
    warnings = (
        db.query(models.BehaviorWarning)
        .filter(models.BehaviorWarning.session_id == session_id)
        .order_by(models.BehaviorWarning.timestamp_seconds)
        .all()
    )

    qa_pairs = [
        {"question": q.question_text, "answer": q.answer_text, "type": q.question_type}
        for q in questions
    ]
    warning_list = [
        {"warning_label": w.warning_label, "timestamp_seconds": w.timestamp_seconds}
        for w in warnings
    ]

    feedback = claude_service.generate_final_feedback(
        questions_and_answers=qa_pairs,
        warnings=warning_list,
        company_type=session.company_type,
        job_category=session.job_category,
        tone=session.interviewer_tone,
    )

    session.score = feedback.get("score")
    session.strengths = feedback.get("strengths", [])
    session.improvements = feedback.get("improvements", [])
    session.attitude_summary = feedback.get("attitude_summary", "")
    session.answer_analysis = feedback.get("answer_analysis", [])
    session.status = "completed"
    session.completed_at = datetime.utcnow()
    db.commit()

    return _session_result(session, questions, warnings)


@router.post("/warnings")
def add_warning(payload: schemas.WarningCreate, db: Session = Depends(get_db)):
    warning = models.BehaviorWarning(
        session_id=payload.session_id,
        warning_type=payload.warning_type,
        warning_label=payload.warning_label,
        timestamp_seconds=payload.timestamp_seconds,
    )
    db.add(warning)
    db.commit()
    return {"ok": True}


@router.get("/{session_id}/result", response_model=schemas.SessionResult)
def get_result(session_id: str, db: Session = Depends(get_db)):
    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    questions = (
        db.query(models.InterviewQuestion)
        .filter(models.InterviewQuestion.session_id == session_id)
        .order_by(models.InterviewQuestion.question_order)
        .all()
    )
    warnings = (
        db.query(models.BehaviorWarning)
        .filter(models.BehaviorWarning.session_id == session_id)
        .all()
    )
    return _session_result(session, questions, warnings)


@router.post("/{session_id}/chat", response_model=schemas.ChatResponse)
def chat_with_coach(
    session_id: str,
    payload: schemas.ChatRequest,
    db: Session = Depends(get_db),
):
    session = db.query(models.InterviewSession).filter(
        models.InterviewSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    questions = (
        db.query(models.InterviewQuestion)
        .filter(models.InterviewQuestion.session_id == session_id)
        .order_by(models.InterviewQuestion.question_order)
        .all()
    )
    warnings = (
        db.query(models.BehaviorWarning)
        .filter(models.BehaviorWarning.session_id == session_id)
        .all()
    )

    context = {
        "company_type": session.company_type,
        "job_category": session.job_category,
        "score": session.score,
        "strengths": session.strengths,
        "improvements": session.improvements,
        "attitude_summary": session.attitude_summary,
        "questions": [
            {"question_text": q.question_text, "answer_text": q.answer_text}
            for q in questions
        ],
        "warnings": [
            {"warning_label": w.warning_label}
            for w in warnings
        ],
    }

    reply = claude_service.chat_with_coach(
        session_context=context,
        history=[{"role": h.role, "content": h.content} for h in payload.history],
        user_message=payload.message,
    )
    return schemas.ChatResponse(reply=reply)


@router.get("/history/{member_code}")
def get_history(member_code: str, db: Session = Depends(get_db)):
    member = (
        db.query(models.Member)
        .filter(models.Member.member_code == member_code.upper())
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="존재하지 않는 회원 코드입니다.")

    sessions = (
        db.query(models.InterviewSession)
        .filter(
            models.InterviewSession.member_id == member.id,
            models.InterviewSession.status == "completed",
        )
        .order_by(models.InterviewSession.created_at.desc())
        .all()
    )
    return [
        {
            "session_id": s.id,
            "company_type": s.company_type,
            "job_category": s.job_category,
            "mode": s.mode,
            "score": s.score,
            "created_at": s.created_at,
            "status": s.status,
        }
        for s in sessions
    ]
