import uuid
import time
import re
import base64
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Response, Request, HTTPException, status, Depends, UploadFile, File, Query
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
    gamer_tag: Optional[str] = None
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    date_of_birth: Optional[str] = None
    avatar_url: Optional[str] = "avatar_1"
    favorite_team: Optional[str] = "Mumbai Blasters"
    custom_team_name: Optional[str] = None
    batting_style: Optional[str] = "Right-handed"
    bowling_style: Optional[str] = "Right-arm medium"

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

ALLOWED_IMAGE_TYPES = {
    "image/png": b"\x89PNG\r\n\x1a\n",
    "image/jpeg": b"\xff\xd8\xff",
    "image/jpg": b"\xff\xd8\xff",
    "image/webp": b"RIFF"
}
MAX_AVATAR_SIZE = 2 * 1024 * 1024  # 2MB

@router.get("/check-username")
async def check_username(
    username: str = Query(..., min_length=1, max_length=32),
    gamer_tag: Optional[str] = Query(None, max_length=16)
):
    clean_username = username.strip().lower()
    if not re.match(r"^[a-zA-Z0-9_]{3,24}$", clean_username):
        return {
            "available": False,
            "username": clean_username,
            "gamer_tag": gamer_tag or "",
            "gamer_id": f"{clean_username}#{gamer_tag.lstrip('#') if gamer_tag else '0000'}",
            "message": "Username must be 3-24 characters and only contain letters, numbers, and underscores.",
            "suggestions": []
        }

    clean_tag = gamer_tag.strip().lstrip("#").upper() if gamer_tag and gamer_tag.strip() else "0001"
    if not re.match(r"^[a-zA-Z0-9]{2,8}$", clean_tag):
        return {
            "available": False,
            "username": clean_username,
            "gamer_tag": f"#{clean_tag}",
            "gamer_id": f"{clean_username}#{clean_tag}",
            "message": "Gamer tag must be 2-8 alphanumeric characters (e.g. #4821).",
            "suggestions": []
        }

    target_gamer_id = f"{clean_username}#{clean_tag}"

    async with AsyncSessionLocal() as session:
        existing = await session.execute(
            select(Profile).where(Profile.gamer_tag.ilike(target_gamer_id))
        )
        found = existing.scalars().first()

        if found:
            # Generate available suggestions
            candidates = [
                f"{clean_username}_{r}" for r in range(1, 10)
            ] + [
                f"{clean_username}{r}" for r in [7, 9, 21, 99, 101, 777]
            ] + [f"{clean_username}x", f"real_{clean_username}"]

            suggestions: List[str] = []
            for cand in candidates:
                cand_id = f"{cand}#{clean_tag}"
                res = await session.execute(
                    select(Profile).where(Profile.gamer_tag.ilike(cand_id))
                )
                if not res.scalars().first():
                    suggestions.append(cand)
                    if len(suggestions) >= 4:
                        break

            return {
                "available": False,
                "username": clean_username,
                "gamer_tag": f"#{clean_tag}",
                "gamer_id": target_gamer_id,
                "message": f"'{target_gamer_id}' is already registered.",
                "suggestions": suggestions
            }
        else:
            return {
                "available": True,
                "username": clean_username,
                "gamer_tag": f"#{clean_tag}",
                "gamer_id": target_gamer_id,
                "message": f"'{target_gamer_id}' is available!"
            }

@router.post("/upload-avatar")
async def upload_avatar(file: UploadFile = File(...)):
    if not file or not file.filename:
        raise HTTPException(status_code=400, detail="No image file provided.")

    contents = await file.read()
    if len(contents) > MAX_AVATAR_SIZE:
        raise HTTPException(
            status_code=400,
            detail="Avatar image size exceeds the 2MB limit. Please upload a smaller image."
        )

    content_type = (file.content_type or "").lower().split(";")[0].strip()
    is_valid_magic = False

    if contents.startswith(b"\x89PNG\r\n\x1a\n"):
        content_type = "image/png"
        is_valid_magic = True
    elif contents.startswith(b"\xff\xd8\xff"):
        content_type = "image/jpeg"
        is_valid_magic = True
    elif contents.startswith(b"RIFF") and len(contents) >= 12 and contents[8:12] == b"WEBP":
        content_type = "image/webp"
        is_valid_magic = True

    if not is_valid_magic:
        raise HTTPException(
            status_code=400,
            detail="Unsupported image format. Only genuine PNG, JPEG, and WebP images are allowed."
        )

    encoded = base64.b64encode(contents).decode("ascii")
    data_url = f"data:{content_type};base64,{encoded}"

    return {
        "status": "success",
        "avatar_url": data_url,
        "filename": file.filename,
        "content_type": content_type,
        "size_bytes": len(contents)
    }

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
        # Check duplicate email
        existing_email = await session.execute(
            select(User).where(User.email == clean_email)
        )
        if existing_email.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="An account with this email address already exists."
            )

        # Gamer tag handling
        if req.gamer_tag and req.gamer_tag.strip():
            clean_tag = req.gamer_tag.strip().lstrip("#").upper()
            if not re.match(r"^[a-zA-Z0-9]{2,8}$", clean_tag):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Gamer tag must be 2-8 alphanumeric characters (e.g. #4821)."
                )
            full_gamer_tag = f"{clean_username}#{clean_tag}"
            tag_num = int(clean_tag) if clean_tag.isdigit() else 1
        else:
            full_gamer_tag, tag_num = await generate_unique_gamer_tag(session, clean_username)
            clean_tag = f"{tag_num:03d}"

        # Enforce composite uniqueness: username + gamer_tag combination must be unique
        existing_identity = await session.execute(
            select(Profile).where(Profile.gamer_tag.ilike(full_gamer_tag))
        )
        if existing_identity.scalars().first():
            # Generate available suggestions
            candidates = [
                f"{clean_username}_{r}" for r in range(1, 10)
            ] + [
                f"{clean_username}{r}" for r in [7, 9, 21, 99, 101, 777]
            ] + [f"{clean_username}x", f"real_{clean_username}"]

            suggestions = []
            for cand in candidates:
                cand_id = f"{cand}#{clean_tag}"
                res = await session.execute(
                    select(Profile).where(Profile.gamer_tag.ilike(cand_id))
                )
                if not res.scalars().first():
                    suggestions.append(cand)
                    if len(suggestions) >= 4:
                        break

            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"The identity '{full_gamer_tag}' is already registered. Suggested alternatives: {', '.join(suggestions) if suggestions else 'Try a different gamer tag'}"
            )

        user_id = f"usr_{uuid.uuid4().hex[:12]}"
        now = time.time()
        pwd_hash = hash_password(req.password)

        new_user = User(
            id=user_id,
            username=clean_username,
            gamer_tag=full_gamer_tag,
            email=clean_email,
            password_hash=pwd_hash,
            full_name=req.full_name.strip(),
            date_of_birth=req.date_of_birth,
            created_at=now,
            last_login_at=now
        )
        session.add(new_user)

        team_name = (req.custom_team_name or req.favorite_team or "Mumbai Blasters").strip()
        new_profile = Profile(
            user_id=user_id,
            display_name=req.full_name.strip(),
            gamer_tag=full_gamer_tag,
            tag_number=tag_num,
            avatar_url=req.avatar_url or "avatar_1",
            favorite_team=team_name,
            custom_team_name=team_name,
            batting_style=req.batting_style or "Right-handed",
            bowling_style=req.bowling_style or "Right-arm medium",
            updated_at=now
        )
        session.add(new_profile)

        await session.commit()

        # Generate JWT session token
        token = create_access_token(user_id=user_id, username=clean_username, gamer_tag=full_gamer_tag)

        # Set secure HTTP-only cookie
        response.set_cookie(
            key="access_token",
            value=token,
            httponly=True,
            max_age=7 * 24 * 3600,
            samesite="lax",
            secure=False
        )

        return {
            "status": "success",
            "message": "Account created successfully",
            "access_token": token,
            "user": {
                "id": user_id,
                "username": clean_username,
                "gamer_tag": full_gamer_tag,
                "email": clean_email,
                "full_name": req.full_name.strip(),
            },
            "profile": {
                "user_id": user_id,
                "display_name": req.full_name.strip(),
                "gamer_tag": full_gamer_tag,
                "avatar_url": new_profile.avatar_url,
                "favorite_team": new_profile.favorite_team,
                "custom_team_name": new_profile.custom_team_name,
                "batting_style": new_profile.batting_style,
                "bowling_style": new_profile.bowling_style,
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
        user = None
        # 1. Email check
        if "@" in identifier:
            query = select(User).where(User.email == identifier)
            res = await session.execute(query)
            user = res.scalars().first()
        # 2. Complete Gamer ID check (username#tag)
        elif "#" in identifier:
            p_res = await session.execute(select(Profile).where(Profile.gamer_tag.ilike(identifier)))
            prof = p_res.scalars().first()
            if prof:
                user = await session.get(User, prof.user_id)
            if not user:
                u_res = await session.execute(select(User).where(User.gamer_tag.ilike(identifier)))
                user = u_res.scalars().first()
        # 3. Username check
        else:
            u_query = select(User).where(User.username == identifier)
            u_res = await session.execute(u_query)
            matching_users = u_res.scalars().all()
            if len(matching_users) == 1:
                user = matching_users[0]
            elif len(matching_users) > 1:
                for cand_user in matching_users:
                    if verify_password(req.password, cand_user.password_hash):
                        user = cand_user
                        break
                if not user:
                    record_failed_attempt(rate_limit_key)
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Multiple accounts share this username. Please log in using your full Gamer ID (e.g. username#tag) or email."
                    )

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
                "gamer_tag": profile.gamer_tag,
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
                "custom_team_name": profile.custom_team_name or profile.favorite_team,
                "batting_style": profile.batting_style,
                "bowling_style": profile.bowling_style,
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
                "gamer_tag": profile.gamer_tag,
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
                "custom_team_name": profile.custom_team_name or profile.favorite_team,
                "batting_style": profile.batting_style,
                "bowling_style": profile.bowling_style,
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
