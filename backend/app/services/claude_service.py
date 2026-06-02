import json
import random
from google import genai
from app.database import settings

_client = genai.Client(api_key=settings.GOOGLE_API_KEY)

TONES = {
    "strict": (
        "당신은 매우 엄격하고 형식적인 면접관입니다. "
        "간결하고 직접적으로 질문하며 감정적 표현 없이 전문적으로 대화합니다."
    ),
    "neutral": (
        "당신은 중립적이고 전문적인 면접관입니다. "
        "표준적인 면접 방식으로 진행하며 적절한 예의를 갖춥니다."
    ),
    "friendly": (
        "당신은 따뜻하고 편안한 분위기를 만드는 면접관입니다. "
        "지원자가 편하게 답변할 수 있도록 부드럽게 대화합니다."
    ),
}


def pick_random_tone() -> str:
    return random.choice(list(TONES.keys()))


def _company_label(company_type: str) -> str:
    return "스타트업" if company_type == "startup" else "대기업/중견기업"


def _call(prompt: str) -> str:
    # TODO: 현재 동기 호출이라 Gemini 응답 대기 중 이벤트 루프가 블로킹됨
    # 트래픽이 늘면 asyncio.to_thread() 또는 httpx 비동기 클라이언트로 전환 필요
    response = _client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )
    return response.text.strip()


def _parse_json(text: str) -> dict:
    """Gemini가 JSON을 마크다운 코드펜스로 감싸서 응답하는 경우도 처리."""
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    return json.loads(text.strip())


def generate_interview_questions(
    cover_letter: str,
    company_type: str,
    job_category: str,
    mode: str,
    personality_fallback: list[str],
) -> dict | None:
    personality_section = ""
    if mode == "normal":
        examples = ", ".join(personality_fallback[:3])
        personality_section = (
            f"\n2. {_company_label(company_type)} 지원자에게 적합한 인성 질문 2개\n"
            f"   - {_company_label(company_type)}의 문화와 가치관을 파악할 수 있는 질문\n"
            f"   - 참고 예시 (그대로 쓰지 말고 변형): {examples}"
        )

    prompt = f"""아래 자기소개서를 분석하여 면접 질문을 생성해주세요.

자기소개서:
{cover_letter}

지원 정보:
- 기업 유형: {_company_label(company_type)}
- 직무: {job_category}
- 면접 모드: {"일반" if mode == "normal" else "가벼운 모드"}

생성해주세요:
1. 자기소개서 기반 예상 질문 2개
   - 지원자의 경험·역량·가치관을 구체적으로 파악할 수 있는 날카로운 질문{personality_section}

반드시 아래 JSON 형식으로만 응답해주세요 (다른 텍스트 없이):
{{
  "cover_letter_questions": ["질문1", "질문2"],
  "personality_questions": ["질문1", "질문2"]
}}

light 모드이면 personality_questions는 빈 배열로 반환하세요."""

    try:
        return _parse_json(_call(prompt))
    except Exception:
        return None


def check_followup_needed(
    original_question: str,
    answer: str,
    followup_count: int,
    max_followup: int,
    tone: str,
) -> dict:
    if followup_count >= max_followup:
        return {"need_followup": False, "followup_question": None, "reason": "최대 꼬리질문 횟수 도달"}

    char_count = len(answer.replace(" ", ""))
    tone_desc = TONES.get(tone, TONES["neutral"])

    prompt = f"""당신은 면접관입니다. {tone_desc}

원래 질문: {original_question}
지원자 답변: {answer}
답변 글자수: {char_count}자
현재 꼬리질문 횟수: {followup_count}/{max_followup}

꼬리질문 필요 여부를 판단해주세요.

필요한 경우: 답변이 너무 짧거나 모호하거나 구체적 사례/수치가 없는 경우
불필요한 경우: 충분히 구체적이고 논리적인 답변 (STAR 구조가 잘 갖춰진 경우)

반드시 아래 JSON 형식으로만 응답해주세요:
{{
  "need_followup": true 또는 false,
  "followup_question": "꼬리질문 내용 (need_followup이 false이면 null)",
  "reason": "판단 이유 한 줄"
}}"""

    try:
        return _parse_json(_call(prompt))
    except Exception:
        return {"need_followup": False, "followup_question": None, "reason": "분석 오류"}


def generate_final_feedback(
    questions_and_answers: list[dict],
    warnings: list[dict],
    company_type: str,
    job_category: str,
    tone: str,
) -> dict:
    qa_text = "\n".join(
        f"Q{i + 1} ({qa.get('type', '')}): {qa['question']}\nA: {qa['answer'] or '(답변 없음)'}"
        for i, qa in enumerate(questions_and_answers)
    )
    warning_text = (
        "\n".join(f"- {w['warning_label']} ({w['timestamp_seconds']}초 시점)" for w in warnings)
        if warnings else "없음"
    )

    prompt = f"""당신은 전문 면접 코치입니다. 아래 모의 면접 결과를 분석하여 종합 피드백을 제공해주세요.

지원 정보:
- 기업 유형: {_company_label(company_type)}
- 직무: {job_category}

면접 Q&A:
{qa_text}

태도 경고 기록:
{warning_text}

분석 기준:
1. 답변의 두괄식 구성 여부
2. 구체적 사례·수치 활용 여부
3. STAR 구조 충족도 (상황-과제-행동-결과)
4. 질문 핵심에 대한 답변 여부
5. 전반적 태도 (경고 기록 반영)

반드시 아래 JSON 형식으로만 응답해주세요:
{{
  "score": 0~100 사이 정수,
  "strengths": ["잘한점1", "잘한점2", "잘한점3"],
  "improvements": ["보완점1", "보완점2", "보완점3"],
  "attitude_summary": "태도에 대한 종합 코멘트",
  "answer_analysis": [
    {{
      "question": "질문 내용 (짧게 요약)",
      "feedback": "이 답변에 대한 피드백",
      "level": "good 또는 warning 또는 danger"
    }}
  ]
}}"""

    try:
        return _parse_json(_call(prompt))
    except Exception:
        return {
            "score": None,
            "strengths": ["분석 중 오류가 발생했습니다."],
            "improvements": ["잠시 후 다시 시도해주세요."],
            "attitude_summary": "분석 오류",
            "answer_analysis": [],
        }


def chat_with_coach(
    session_context: dict,
    history: list[dict],
    user_message: str,
) -> str:
    qa_text = "\n".join(
        f"Q: {q['question_text']}\nA: {q['answer_text'] or '(답변 없음)'}"
        for q in session_context.get("questions", [])
    )
    warnings_text = (
        "\n".join(f"- {w['warning_label']}" for w in session_context.get("warnings", []))
        or "없음"
    )
    strengths = "\n".join(f"• {s}" for s in (session_context.get("strengths") or []))
    improvements = "\n".join(f"• {s}" for s in (session_context.get("improvements") or []))

    context_block = f"""[면접 결과 요약]
기업 유형: {_company_label(session_context.get('company_type', ''))}
직무: {session_context.get('job_category', '')}
종합 점수: {session_context.get('score', '없음')}점

[Q&A]
{qa_text}

[태도 경고]
{warnings_text}

[잘한 점]
{strengths or '없음'}

[보완 포인트]
{improvements or '없음'}

[태도 피드백]
{session_context.get('attitude_summary') or '없음'}"""

    history_text = ""
    if history:
        history_text = "\n\n[이전 대화]\n" + "\n".join(
            f"{'지원자' if h['role'] == 'user' else '코치'}: {h['content']}"
            for h in history
        )

    prompt = f"""당신은 친절하고 전문적인 면접 코치입니다.
아래 면접 결과를 바탕으로 지원자의 질문에 답해주세요.

{context_block}{history_text}

지원자: {user_message}

답변 지침:
- 구체적이고 실용적으로 답변하세요.
- 점수 이유를 물으면 Q&A와 태도 경고 기록을 근거로 설명하세요.
- 면접 팁을 요청하면 해당 직무/기업 유형에 맞는 실용적인 팁을 주세요.
- 모범 답안을 요청하면 STAR 구조 (상황-과제-행동-결과) 예시를 제공하세요.
- 답변은 너무 길지 않게 핵심만 전달하세요 (300자 내외).

코치:"""

    try:
        return _call(prompt)
    except Exception:
        return "죄송합니다, 잠시 오류가 발생했습니다. 다시 시도해 주세요."
