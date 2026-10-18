import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, desc, or_, and_

from ..database import AsyncSessionLocal, User, Profile, MatchRecord
from ..auth.security import get_current_user, generate_unique_gamer_tag

router = APIRouter(prefix="/api/profiles", tags=["profiles"])

class UpdateProfileRequest(BaseModel):
    display_name: Optional[str] = Field(None, min_length=2, max_length=32)
    avatar_url: Optional[str] = None
    bio: Optional[str] = Field(None, max_length=255)
    age: Optional[int] = Field(None, ge=10, le=120)
    country: Optional[str] = Field(None, max_length=64)
    favorite_team: Optional[str] = Field(None, max_length=64)
    batting_style: Optional[str] = Field(None, max_length=64)
    is_public: Optional[bool] = None
    show_age: Optional[bool] = None
    show_stats: Optional[bool] = None

@router.get("/leaderboard")
async def get_leaderboard(
    sort_by: str = Query("wins", pattern="^(wins|win_rate|runs|wickets)$"),
    limit: int = Query(25, ge=1, le=100)
):
    async with AsyncSessionLocal() as session:
        query = select(Profile).where(Profile.is_public == True)
        
        if sort_by == "wins":
            query = query.order_by(desc(Profile.matches_won), desc(Profile.total_matches))
        elif sort_by == "runs":
            query = query.order_by(desc(Profile.total_runs))
        elif sort_by == "wickets":
            query = query.order_by(desc(Profile.total_wickets))
        else: # win_rate
            query = query.where(Profile.total_matches >= 3).order_by(
                desc(Profile.matches_won * 1.0 / Profile.total_matches)
            )

        query = query.limit(limit)
        res = await session.execute(query)
        profiles = res.scalars().all()

        leaderboard = []
        for rank, p in enumerate(profiles, start=1):
            win_rate = round((p.matches_won / p.total_matches * 100), 1) if p.total_matches > 0 else 0.0
            leaderboard.append({
                "rank": rank,
                "user_id": p.user_id,
                "display_name": p.display_name,
                "gamer_tag": p.gamer_tag,
                "avatar_url": p.avatar_url,
                "favorite_team": p.favorite_team,
                "total_matches": p.total_matches,
                "matches_won": p.matches_won,
                "matches_lost": p.matches_lost,
                "win_rate": win_rate,
                "total_runs": p.total_runs,
                "total_wickets": p.total_wickets,
                "current_streak": p.current_streak,
                "best_streak": p.best_streak
            })

        return {"leaderboard": leaderboard, "sort_by": sort_by}

@router.get("/{identifier}")
async def get_public_profile(identifier: str):
    """
    Get player profile by gamer_tag (e.g. 'Nishit#009') or username or user_id.
    """
    clean_id = identifier.strip()

    async with AsyncSessionLocal() as session:
        # Check by gamer_tag
        query = select(Profile).where(Profile.gamer_tag.ilike(clean_id))
        res = await session.execute(query)
        profile = res.scalars().first()

        # If not found by gamer tag, check by user_id
        if not profile:
            profile = await session.get(Profile, clean_id)

        # If not found by user_id, check by username
        if not profile:
            u_query = select(User).where(User.username == clean_id.lower())
            u_res = await session.execute(u_query)
            user = u_res.scalars().first()
            if user:
                profile = await session.get(Profile, user.id)

        if not profile:
            raise HTTPException(status_code=404, detail="Player profile not found")

        # Check privacy
        if not profile.is_public:
            return {
                "display_name": profile.display_name,
                "gamer_tag": profile.gamer_tag,
                "avatar_url": profile.avatar_url,
                "is_public": False,
                "message": "This player profile is private."
            }

        win_rate = round((profile.matches_won / profile.total_matches * 100), 1) if profile.total_matches > 0 else 0.0

        # Query recent match records for this player
        m_query = select(MatchRecord).where(
            or_(
                MatchRecord.player_1_user_id == profile.user_id,
                MatchRecord.player_2_user_id == profile.user_id
            )
        ).order_by(desc(MatchRecord.created_at)).limit(10)
        m_res = await session.execute(m_query)
        matches = m_res.scalars().all()

        recent_matches = [
            {
                "id": m.id,
                "room_code": m.room_code,
                "match_type": m.match_type,
                "team_a_name": m.team_a_name,
                "team_b_name": m.team_b_name,
                "winner_team_name": m.winner_team_name,
                "win_description": m.win_description,
                "first_innings": f"{m.first_innings_runs}/{m.first_innings_wickets}",
                "second_innings": f"{m.second_innings_runs}/{m.second_innings_wickets}",
                "total_deliveries": m.total_deliveries,
                "created_at": m.created_at
            }
            for m in matches
        ]

        return {
            "user_id": profile.user_id,
            "display_name": profile.display_name,
            "gamer_tag": profile.gamer_tag,
            "avatar_url": profile.avatar_url,
            "bio": profile.bio,
            "country": profile.country,
            "favorite_team": profile.favorite_team,
            "batting_style": profile.batting_style,
            "age": profile.age if profile.show_age else None,
            "total_matches": profile.total_matches if profile.show_stats else None,
            "matches_won": profile.matches_won if profile.show_stats else None,
            "matches_lost": profile.matches_lost if profile.show_stats else None,
            "win_rate": win_rate if profile.show_stats else None,
            "total_runs": profile.total_runs if profile.show_stats else None,
            "total_wickets": profile.total_wickets if profile.show_stats else None,
            "current_streak": profile.current_streak if profile.show_stats else None,
            "best_streak": profile.best_streak if profile.show_stats else None,
            "is_public": True,
            "recent_matches": recent_matches
        }

@router.put("/me")
async def update_my_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        profile = await session.get(Profile, current_user.id)
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        # Update fields if provided
        if req.display_name and req.display_name.strip() != profile.display_name:
            new_disp = req.display_name.strip()
            profile.display_name = new_disp
            # Recompute gamer tag with new display name and existing or newly allocated tag number
            gamer_tag, tag_num = await generate_unique_gamer_tag(session, new_disp)
            profile.gamer_tag = gamer_tag
            profile.tag_number = tag_num

        if req.avatar_url is not None:
            profile.avatar_url = req.avatar_url.strip()
        if req.bio is not None:
            profile.bio = req.bio.strip()
        if req.age is not None:
            profile.age = req.age
        if req.country is not None:
            profile.country = req.country.strip()
        if req.favorite_team is not None:
            profile.favorite_team = req.favorite_team.strip()
        if req.batting_style is not None:
            profile.batting_style = req.batting_style.strip()
        if req.is_public is not None:
            profile.is_public = req.is_public
        if req.show_age is not None:
            profile.show_age = req.show_age
        if req.show_stats is not None:
            profile.show_stats = req.show_stats

        profile.updated_at = time.time()
        await session.commit()

        win_rate = round((profile.matches_won / profile.total_matches * 100), 1) if profile.total_matches > 0 else 0.0

        return {
            "status": "success",
            "message": "Profile updated successfully",
            "profile": {
                "user_id": profile.user_id,
                "display_name": profile.display_name,
                "gamer_tag": profile.gamer_tag,
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
