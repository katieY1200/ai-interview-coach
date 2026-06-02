# 개발 환경 세팅

## 사전 요구사항

- Python 3.11+
- Node.js 18+
- MySQL 8.0+
- 크롬 브라우저 (STT 음성 인식)

---

## 1. MySQL 데이터베이스 생성

```bash
# MySQL 접속
mysql -u root -p

# DB 생성
CREATE DATABASE myeonkkakal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

MySQL 서비스 시작 (Windows):
```bash
net start MySQL80   # 버전에 따라 MySQL57 등 다를 수 있음
```

권장 클라이언트: **HeidiSQL** (MySQL Workbench보다 가볍고 안정적)

---

## 2. 환경 변수 설정

`backend/.env` 파일 생성:

```
GOOGLE_API_KEY=your_gemini_api_key   # aistudio.google.com에서 발급 (AIzaSy...로 시작)
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=myeonkkakal
```

Gemini API 키 발급: [aistudio.google.com](https://aistudio.google.com) → Get API key → Create API key

---

## 3. 백엔드 실행

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0
```

테이블은 첫 실행 시 SQLAlchemy가 자동 생성합니다.

---

## 4. 프론트엔드 실행

```bash
cd frontend
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 접속 (포트가 다를 경우 터미널 출력 확인)

---

## 데이터베이스 구조

| 테이블 | 설명 |
|--------|------|
| `members` | 회원 코드 (8자리 랜덤, 대문자+숫자) |
| `interview_sessions` | 면접 세션 (기업유형, 직무, 모드, 점수, 피드백 등) |
| `interview_questions` | 질문 및 답변 (꼬리질문 포함, 순서 동적 관리) |
| `behavior_warnings` | 실시간 태도 경고 기록 (타임스탬프 포함) |

---

## 참고

- STT(음성 인식)는 크롬 브라우저에서만 안정적으로 동작합니다
- MediaPipe 모델은 첫 실행 시 CDN에서 다운로드되어 10~20초 로딩이 있을 수 있습니다
- 백엔드 `.env` 수정 후에는 uvicorn을 반드시 재시작해야 합니다
