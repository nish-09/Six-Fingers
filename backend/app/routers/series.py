import uuid
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, or_, and_, desc

from ..database import (
    AsyncSessionLocal, User, Profile, Series, SeriesMatch, MatchRecord
)
from ..auth.security import get_current_user
from ..rooms.manager import room_manager
from ..models.game import MatchRules

router = APIRouter(prefix="/api/series", tags=["series"])

class CreateSeriesRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    opponent_id: Optional[str] = None
    series_format: str = "BEST_OF_3" # BEST_OF_3, BEST_OF_5, BEST_OF_7, FIRST_TO_N, FIXED_MATCHES
    total_scheduled_matches: int = 3
    target_wins: int = 2
    overs_per_match: int = 2
    wickets_per_match: int = 3

@router.post("/create")
async def create_series(
    payload: CreateSeriesRequest,
    current_user: User = Depends(get_current_user)
):
    series_id = f"ser_{uuid.uuid4().hex[:10]}"
    
    # Calculate target_wins and total_scheduled_matches based on format
    fmt = payload.series_format.upper()
    tot_matches = payload.total_scheduled_matches
    tgt_wins = payload.target_wins

    if fmt == "BEST_OF_3":
        tot_matches = 3
        tgt_wins = 2
    elif fmt == "BEST_OF_5":
        tot_matches = 5
        tgt_wins = 3
    elif fmt == "BEST_OF_7":
        tot_matches = 7
        tgt_wins = 4
    elif fmt == "FIRST_TO_N":
        tgt_wins = max(1, min(payload.target_wins, 20))
        tot_matches = tgt_wins * 2 - 1
    elif fmt == "FIXED_MATCHES":
        tot_matches = max(1, min(payload.total_scheduled_matches, 20))
        tgt_wins = (tot_matches // 2) + 1

    overs = max(1, min(payload.overs_per_match, 50))
    wickets = max(1, min(payload.wickets_per_match, 10))

    async with AsyncSessionLocal() as session:
        # Get creator profile
        creator_profile = await session.get(Profile, current_user.id)
        creator_name = creator_profile.display_name if creator_profile else current_user.username

        opponent_name = "Opponent"
        if payload.opponent_id:
            opp_profile = await session.get(Profile, payload.opponent_id)
            if opp_profile:
                opponent_name = opp_profile.display_name

        # Create initial room for Match 1
        session_token = f"tok_{uuid.uuid4().hex}"
        room = room_manager.create_room(
            host_id=current_user.id,
            host_name=creator_name,
            session_token=session_token
        )
        room_code = room.room_code
        host_token = session_token
        if room:
            room.state.match_type = "SERIES"
            room.state.series_id = series_id
            room.state.player_1_user_id = current_user.id
            room.state.player_2_user_id = payload.opponent_id
            room.state.rules.overs_per_innings = overs
            room.state.rules.wickets_per_innings = wickets

        new_series = Series(
            id=series_id,
            title=payload.title.strip(),
            creator_id=current_user.id,
            opponent_id=payload.opponent_id,
            creator_name=creator_name,
            opponent_name=opponent_name,
            series_format=fmt,
            total_scheduled_matches=tot_matches,
            target_wins=tgt_wins,
            overs_per_match=overs,
            wickets_per_match=wickets,
            creator_wins=0,
            opponent_wins=0,
            draws=0,
            matches_played=0,
            status="ACTIVE",
            current_room_code=room_code,
            created_at=time.time(),
            updated_at=time.time()
        )
        session.add(new_series)
        await session.commit()

        return {
            "series_id": series_id,
            "title": new_series.title,
            "series_format": fmt,
            "total_scheduled_matches": tot_matches,
            "target_wins": tgt_wins,
            "room_code": room_code,
            "host_token": host_token,
            "creator_name": creator_name,
            "opponent_name": opponent_name
        }

@router.get("/user/active")
async def get_user_series(
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        stmt = (
            select(Series)
            .where(
                or_(
                    Series.creator_id == current_user.id,
                    Series.opponent_id == current_user.id
                )
            )
            .order_by(desc(Series.updated_at))
            .limit(20)
        )
        res = await session.execute(stmt)
        series_list = res.scalars().all()

        return {
            "series": [
                {
                    "id": s.id,
                    "title": s.title,
                    "creator_id": s.creator_id,
                    "creator_name": s.creator_name,
                    "opponent_id": s.opponent_id,
                    "opponent_name": s.opponent_name,
                    "series_format": s.series_format,
                    "total_scheduled_matches": s.total_scheduled_matches,
                    "target_wins": s.target_wins,
                    "overs_per_match": s.overs_per_match,
                    "wickets_per_match": s.wickets_per_match,
                    "creator_wins": s.creator_wins,
                    "opponent_wins": s.opponent_wins,
                    "draws": s.draws,
                    "matches_played": s.matches_played,
                    "status": s.status,
                    "winner_id": s.winner_id,
                    "winner_name": s.winner_name,
                    "current_room_code": s.current_room_code,
                    "created_at": s.created_at,
                    "updated_at": s.updated_at
                }
                for s in series_list
            ]
        }

@router.get("/{series_id}")
async def get_series_detail(
    series_id: str,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        series = await session.get(Series, series_id)
        if not series:
            raise HTTPException(status_code=404, detail="Series not found")

        stmt_m = select(SeriesMatch).where(SeriesMatch.series_id == series_id).order_by(SeriesMatch.match_number)
        matches = (await session.execute(stmt_m)).scalars().all()

        return {
            "series": {
                "id": series.id,
                "title": series.title,
                "creator_id": series.creator_id,
                "creator_name": series.creator_name,
                "opponent_id": series.opponent_id,
                "opponent_name": series.opponent_name,
                "series_format": series.series_format,
                "total_scheduled_matches": series.total_scheduled_matches,
                "target_wins": series.target_wins,
                "overs_per_match": series.overs_per_match,
                "wickets_per_match": series.wickets_per_match,
                "creator_wins": series.creator_wins,
                "opponent_wins": series.opponent_wins,
                "draws": series.draws,
                "matches_played": series.matches_played,
                "status": series.status,
                "winner_id": series.winner_id,
                "winner_name": series.winner_name,
                "current_room_code": series.current_room_code,
                "created_at": series.created_at,
                "updated_at": series.updated_at
            },
            "matches": [
                {
                    "id": m.id,
                    "match_number": m.match_number,
                    "room_code": m.room_code,
                    "match_id": m.match_id,
                    "winner_id": m.winner_id,
                    "winner_name": m.winner_name,
                    "score_summary": m.score_summary,
                    "created_at": m.created_at
                }
                for m in matches
            ]
        }

@router.post("/{series_id}/next-match")
async def start_next_series_match(
    series_id: str,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        series = await session.get(Series, series_id)
        if not series:
            raise HTTPException(status_code=404, detail="Series not found")
        if series.status != "ACTIVE":
            raise HTTPException(status_code=400, detail="Series is already completed or inactive")
        if current_user.id not in [series.creator_id, series.opponent_id]:
            raise HTTPException(status_code=403, detail="Not authorized to start matches for this series")

        # Get creator profile name
        creator_profile = await session.get(Profile, series.creator_id)
        creator_name = creator_profile.display_name if creator_profile else series.creator_name

        # Create new room
        session_token = f"tok_{uuid.uuid4().hex}"
        room = room_manager.create_room(
            host_id=series.creator_id,
            host_name=creator_name,
            session_token=session_token
        )
        room_code = room.room_code
        host_token = session_token
        if room:
            room.state.match_type = "SERIES"
            room.state.series_id = series.id
            room.state.player_1_user_id = series.creator_id
            room.state.player_2_user_id = series.opponent_id
            room.state.rules.overs_per_innings = series.overs_per_match
            room.state.rules.wickets_per_innings = series.wickets_per_match

        series.current_room_code = room_code
        series.updated_at = time.time()
        await session.commit()

        return {
            "series_id": series.id,
            "match_number": series.matches_played + 1,
            "room_code": room_code,
            "host_token": host_token if current_user.id == series.creator_id else None
        }
