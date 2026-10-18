import uuid
import time
import re
from typing import Optional
from fastapi import APIRouter, Response, Request, HTTPException, status, Depends
from pydantic import BaseModel, Field, EmailStr
from sqlalchemy import select, or_

from ..database import AsyncSessionLocal, User, Profile
from .security import (
    hash_password,
    verify_password,
    create_access_token,
    generate_unique_gamer_tag,
    get_current_user,
    is_rate_limited,
    record_failed_attempt,
    clear_failed_attempts
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    username: str = Field(..., min_length=3, max_length=24)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    date_of_birth: Optional[str] = None
    avatar_url: Optional[str] = "avatar_1"
    favorite_team: Optional[str] = "Mumbai Blasters"
    batting_style: Optional[str] = "Aggressive Six-Hitter"

class LoginRequest(BaseModel):
    username_or_email: str
    password: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=128)

def validate_password_strength(password: str):
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long."
        )
    if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one letter and one number."
        )

@router.post("/register")
async def register(req: RegisterRequest, response: Response):
    # Normalize inputs
    clean_username = req.username.strip().lower()
    clean_email = req.email.strip().lower()

    if not re.match(r"^[a-zA-Z0-9_]{3,24}$", clean_username):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username must be 3-24 characters and only contain letters, numbers, and underscores."
        )

    validate_password_strength(req.password)

    async with AsyncSessionLocal() as session:
        # Check duplicate username or email
        existing = await session.execute(
            select(User).where(or_(User.username == clean_username, User.email == clean_email))
        )
        found = existing.scalars().first()
        if found:
            if found.username == clean_username:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This username is already taken. Please choose another."
                )
            if found.email == clean_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An account with this email address already exists."
                )

        # Generate unique gamer tag
        gamer_tag, tag_num = await generate_unique_gamer_tag(session, req.full_name or clean_username)

        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        now = time.time()
        pwd_hash = hash_password(req.password)

        new_user = User(
            id=user_id,
            username=clean_username,
            email=clean_email,
            password_hash=pwd_hash,
            full_name=req.full_name.strip(),
            date_of_birth=req.date_of_birth,
            created_at=now,
            last_login_at=now
        )
        session.add(new_user)

        new_profile = Profile(
            user_id=user_id,
            display_name=req.full_name.strip(),
            gamer_tag=gamer_tag,
            tag_number=tag_num,
            avatar_url=req.avatar_url or "avatar_1",
            favorite_team=req.favorite_team or "Mumbai Blasters",
            batting_style=req.batting_style or "Aggressive Six-Hitter",
            updated_at=now
        )
        session.add(new_profile)

        await session.commit()

        # Generate JWT session token
        token = create_access_token(user_id=user_id, username=clean_username, gamer_tag=gamer_tag)

        # Set secure HTTP-only cookie
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            max_age=7 * 24 * 3600,
            samesite="lax",
            secure=False # Set to True in HTTPS production
        )

        return {
            "status": "success",
            "message": "Account created successfully",
            "access_token": token,
            "user": {
                "id": user_id,
                "username": clean_username,
                "email": clean_email,
                "full_name": req.full_name.strip(),
            },
            "profile": {
                "user_id": user_id,
                "display_name": req.full_name.strip(),
                "gamer_tag": gamer_tag,
                "avatar_url": new_profile.avatar_url,
                "favorite_team": new_profile.favorite_team,
                "batting_style": new_profile.batting_style,
                "total_matches": 0,
                "matches_won": 0,
                "matches_lost": 0,
                "win_rate": 0.0,
                "total_runs": 0,
                "total_wickets": 0,
                "current_streak": 0,
                "best_streak": 0
            }
        }

@router.post("/login")
async def login(req: LoginRequest, request: Request, response: Response):
    client_ip = request.client.host if request.client else "unknown"
    rate_limit_key = f"{client_ip}_{req.username_or_email.lower().strip()}"

    if is_rate_limited(rate_limit_key):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please wait 5 minutes before trying again."
        )

    identifier = req.username_or_email.strip().lower()

    async with AsyncSessionLocal() as session:
        query = select(User).where(or_(User.username == identifier, User.email == identifier))
        res = await session.execute(query)
        user = res.scalars().first()

        if not user or not verify_password(req.password, user.password_hash):
            record_failed_attempt(rate_limit_key)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username/email or password."
            )

        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Your account has been deactivated. Please contact support."
            )

        clear_failed_attempts(rate_limit_key)

        # Update last login
        user.last_login_at = time.time()

        profile = await session.get(Profile, user.id)
        if not profile:
            # Create default profile if missing
            gamer_tag, tag_num = await generate_unique_gamer_tag(session, user.full_name or user.username)
            profile = Profile(
                user_id=user.id,
                display_name=user.full_name or user.username,
                gamer_tag=gamer_tag,
                tag_number=tag_num
            )
            session.add(profile)

        await session.commit()

        token = create_access_token(user_id=user.id, username=user.username, gamer_tag=profile.gamer_tag)

        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            max_age=7 * 24 * 3600,
            samesite="lax",
            secure=False
        )

        win_rate = round((profile.matches_won / profile.total_matches * 100), 1) if profile.total_matches > 0 else 0.0

        return {
            "status": "success",
            "message": "Welcome back!",
            "access_token": token,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
            },
            "profile": {
                "user_id": user.id,
                "display_name": profile.display_name,
                "gamer_tag": profile.gamer_tag,
                "avatar_url": profile.avatar_url,
                "bio": profile.bio,
                "country": profile.country,
                "favorite_team": profile.favorite_team,
                "batting_style": profile.batting_style,
                "total_matches": profile.total_matches,
                "matches_won": profile.matches_won,
                "matches_lost": profile.matches_lost,
                "win_rate": win_rate,
                "total_runs": profile.total_runs,
                "total_wickets": profile.total_wickets,
                "current_streak": profile.current_streak,
                "best_streak": profile.best_streak,
                "is_public": profile.is_public
            }
        }

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token")
    return {"status": "success", "message": "Logged out successfully"}

@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        profile = await session.get(Profile, user.id)
        if not profile:
            gamer_tag, tag_num = await generate_unique_gamer_tag(session, user.full_name or user.username)
            profile = Profile(
                user_id=user.id,
                display_name=user.full_name or user.username,
                gamer_tag=gamer_tag,
                tag_number=tag_num
            )
            session.add(profile)
            await session.commit()

        win_rate = round((profile.matches_won / profile.total_matches * 100), 1) if profile.total_matches > 0 else 0.0

        return {
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "full_name": user.full_name,
                "created_at": user.created_at,
                "last_login_at": user.last_login_at
            },
            "profile": {
                "user_id": user.id,
                "display_name": profile.display_name,
                "gamer_tag": profile.gamer_tag,
                "tag_number": profile.tag_number,
                "avatar_url": profile.avatar_url,
                "bio": profile.bio,
                "age": profile.age if profile.show_age else None,
                "country": profile.country,
                "favorite_team": profile.favorite_team,
                "batting_style": profile.batting_style,
                "total_matches": profile.total_matches,
                "matches_won": profile.matches_won,
                "matches_lost": profile.matches_lost,
                "win_rate": win_rate,
                "total_runs": profile.total_runs,
                "total_wickets": profile.total_wickets,
                "current_streak": profile.current_streak,
                "best_streak": profile.best_streak,
                "is_public": profile.is_public,
                "show_age": profile.show_age,
                "show_stats": profile.show_stats
            }
        }

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest):
    # Security: Do not reveal whether email exists
    async with AsyncSessionLocal() as session:
        query = select(User).where(User.email == req.email.strip().lower())
        res = await session.execute(query)
        user = res.scalars().first()
        # In a real email flow, an email would be dispatched here with a signed reset token.
        return {
            "status": "success",
            "message": "If an account exists with this email, password reset instructions have been sent."
        }
