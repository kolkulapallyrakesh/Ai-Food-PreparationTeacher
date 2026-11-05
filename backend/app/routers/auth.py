from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import get_db
from ..limiter import limiter
from ..models import User
from ..schemas import Credentials, Token
from ..security import check_pw, hash_pw, make_token

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=Token, status_code=201)
@limiter.limit("5/minute")
async def register(request: Request, body: Credentials, db: AsyncSession = Depends(get_db)):
    user = User(email=body.email.lower(), password_hash=hash_pw(body.password))
    db.add(user)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, "Email already registered")
    return Token(access_token=make_token(user.id))


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")
async def login(request: Request, body: Credentials, db: AsyncSession = Depends(get_db)):
    user = await db.scalar(select(User).where(User.email == body.email.lower()))
    if not user or not check_pw(body.password, user.password_hash):
        raise HTTPException(401, "Invalid email or password")
    return Token(access_token=make_token(user.id))
