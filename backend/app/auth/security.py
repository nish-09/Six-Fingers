import os
import re
import random
import bcrypt
import jwt
import time
from typing import Optional, Dict, Any, Tuple
from fastapi import Request, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from ..database import AsyncSessionLocal, User, Profile

JWT_SECRET = os.getenv("JWT_SECRET", "six_fingers_super_secret_jwt_key_2026_xyz_778899")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_SECONDS = 7 * 24 * 3600  # 7 days

# Simple in-memory rate limiter to prevent brute-force login attempts
# Tracks {identifier: [timestamp1, timestamp2, ...]}
_FAILED_LOGIN_ATTEMPTS: Dict[str, list] = {}
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_WINDOW_SECONDS = 300  # 5 minutes

def is_rate_limited(identifier: str) -> bool:
    now = time.time()
    attempts = _FAILED_LOGIN_ATTEMPTS.get(identifier, [])
    # Filter attempts within window
    valid_attempts = [t for t in attempts if now - t < LOCKOUT_WINDOW_SECONDS]
    _FAILED_LOGIN_ATTEMPTS[identifier] = valid_attempts
    return len(valid_attempts) >= MAX_FAILED_ATTEMPTS

def record_failed_attempt(identifier: str):
    now = time.time()
    if identifier not in _FAILED_LOGIN_ATTEMPTS:
        _FAILED_LOGIN_ATTEMPTS[identifier] = []
    _FAILED_LOGIN_ATTEMPTS[identifier].append(now)

def clear_failed_attempts(identifier: str):
    if identifier in _FAILED_LOGIN_ATTEMPTS:
        del _FAILED_LOGIN_ATTEMPTS[identifier]

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, username: str, gamer_tag: str) -> str:
    now = int(time.time())
    payload = {
        "sub": user_id,
        "username": username,
        "gamer_tag": gamer_tag,
        "iat": now,
        "exp": now + JWT_EXPIRATION_SECONDS
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None

async def generate_unique_gamer_tag(session: AsyncSession, display_name: str) -> Tuple[str, int]:
    """
    Generates a unique gamer tag in the format 'DisplayName#042'.
    Guarantees uniqueness across the platform and avoids collisions.
    """
    clean_name = re.sub(r"[^a-zA-Z0-9_]", "", display_name).strip()
    if not clean_name:
        clean_name = "Player"
    clean_name = clean_name[:20]

    # Find all occupied numbers for this clean_name
    query = select(Profile.tag_number).where(Profile.display_name.ilike(clean_name))
    result = await session.execute(query)
    used_numbers = set(result.scalars().all())

    # Try numbers 1 to 999
    # Prioritize random available number for competitive flair
    available = [n for n in range(1, 1000) if n not in used_numbers]
    if available:
        tag_num = random.choice(available)
    else:
        # Fallback to next incremental number if > 999
        tag_num = max(used_numbers) + 1 if used_numbers else 1

    gamer_tag = f"{clean_name}#{tag_num:03d}"
    return gamer_tag, tag_num

async def get_current_user(request: Request) -> User:
    """
    FastAPI dependency that extracts the authenticated user.
    Checks HTTP-only cookie 'access_token' first, then 'Authorization: Bearer ...'.
    """
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    else:
        token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to perform this action"
        )

    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired or invalid. Please log in again."
        )

    user_id = payload.get("sub")
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User account not found or suspended"
            )
        return user

async def get_optional_current_user(request: Request) -> Optional[User]:
    try:
        return await get_current_user(request)
    except HTTPException:
        return None
