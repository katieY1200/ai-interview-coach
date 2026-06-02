import secrets
import string
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app import models, schemas

router = APIRouter()


def _generate_code(db: Session) -> str:
    chars = string.ascii_uppercase + string.digits
    for _ in range(20):
        code = "".join(secrets.choice(chars) for _ in range(8))
        if not db.query(models.Member).filter(models.Member.member_code == code).first():
            return code
    raise HTTPException(status_code=500, detail="코드 생성에 실패했습니다. 다시 시도해주세요.")


@router.post("/create", response_model=schemas.MemberResponse)
def create_member(db: Session = Depends(get_db)):
    code = _generate_code(db)
    member = models.Member(member_code=code)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


@router.post("/verify")
def verify_member(payload: schemas.MemberVerify, db: Session = Depends(get_db)):
    member = (
        db.query(models.Member)
        .filter(models.Member.member_code == payload.member_code.upper())
        .first()
    )
    if not member:
        raise HTTPException(status_code=404, detail="존재하지 않는 회원 코드입니다.")
    return {"valid": True, "member_id": member.id, "created_at": member.created_at}
