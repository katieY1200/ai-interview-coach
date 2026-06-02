from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import members, sessions

Base.metadata.create_all(bind=engine)

app = FastAPI(title="면까알 API", version="1.0.0")

# 개발 환경에서는 allow_origins=["*"]로 편의상 열어둠
# 배포 시에는 프론트엔드 도메인으로 좁혀야 한다
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(members.router, prefix="/api/members", tags=["members"])
app.include_router(sessions.router, prefix="/api/sessions", tags=["sessions"])


@app.get("/")
def root():
    return {"message": "면까알 API 실행 중"}
