import uuid
import time
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, or_, and_, desc

from ..database import (
    AsyncSessionLocal, User, Profile, Tournament, TournamentParticipant, TournamentFixture
)
from ..auth.security import get_current_user
from ..rooms.manager import room_manager

router = APIRouter(prefix="/api/tournaments", tags=["tournaments"])

class CreateTournamentRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=100)
    description: Optional[str] = "Six Fingers Hand Cricket Championship"
    tournament_format: str = "KNOCKOUT" # KNOCKOUT or ROUND_ROBIN
    max_participants: int = 4 # 4, 8, 16
    overs_per_match: int = 2
    wickets_per_match: int = 3

@router.post("/create")
async def create_tournament(
    payload: CreateTournamentRequest,
    current_user: User = Depends(get_current_user)
):
    tourn_id = f"trn_{uuid.uuid4().hex[:10]}"
    max_parts = 4 if payload.max_participants not in [4, 8, 16] else payload.max_participants
    overs = max(1, min(payload.overs_per_match, 20))
    wickets = max(1, min(payload.wickets_per_match, 10))
    fmt = "ROUND_ROBIN" if payload.tournament_format.upper() == "ROUND_ROBIN" else "KNOCKOUT"

    async with AsyncSessionLocal() as session:
        org_profile = await session.get(Profile, current_user.id)
        org_name = org_profile.display_name if org_profile else current_user.username
        gamer_tag = org_profile.gamer_tag if org_profile else f"{current_user.username}#001"
        avatar = org_profile.avatar_url if org_profile else "avatar_1"

        tourn = Tournament(
            id=tourn_id,
            title=payload.title.strip(),
            description=payload.description or "Six Fingers Hand Cricket Championship",
            organizer_id=current_user.id,
            organizer_name=org_name,
            tournament_format=fmt,
            max_participants=max_parts,
            overs_per_match=overs,
            wickets_per_match=wickets,
            status="REGISTRATION",
            current_round=1,
            created_at=time.time(),
            updated_at=time.time()
        )
        session.add(tourn)

        # Organizer joins as Seed 1
        part = TournamentParticipant(
            id=f"tp_{uuid.uuid4().hex[:8]}",
            tournament_id=tourn_id,
            user_id=current_user.id,
            user_name=org_name,
            gamer_tag=gamer_tag,
            avatar_url=avatar,
            seed=1,
            is_eliminated=False,
            matches_played=0,
            matches_won=0,
            matches_lost=0,
            points=0,
            joined_at=time.time()
        )
        session.add(part)
        await session.commit()

        return {
            "tournament_id": tourn_id,
            "title": tourn.title,
            "tournament_format": fmt,
            "max_participants": max_parts,
            "organizer_name": org_name,
            "status": "REGISTRATION"
        }

@router.get("")
async def list_tournaments(
    limit: int = Query(20, ge=1, le=50)
):
    async with AsyncSessionLocal() as session:
        stmt = select(Tournament).order_by(desc(Tournament.created_at)).limit(limit)
        tourns = (await session.execute(stmt)).scalars().all()

        results = []
        for t in tourns:
            stmt_p = select(TournamentParticipant).where(TournamentParticipant.tournament_id == t.id)
            parts = (await session.execute(stmt_p)).scalars().all()
            results.append({
                "id": t.id,
                "title": t.title,
                "description": t.description,
                "organizer_id": t.organizer_id,
                "organizer_name": t.organizer_name,
                "tournament_format": t.tournament_format,
                "max_participants": t.max_participants,
                "current_participants": len(parts),
                "overs_per_match": t.overs_per_match,
                "wickets_per_match": t.wickets_per_match,
                "status": t.status,
                "current_round": t.current_round,
                "winner_id": t.winner_id,
                "winner_name": t.winner_name,
                "created_at": t.created_at
            })
        return {"tournaments": results}

@router.get("/{tournament_id}")
async def get_tournament_detail(tournament_id: str):
    async with AsyncSessionLocal() as session:
        tourn = await session.get(Tournament, tournament_id)
        if not tourn:
            raise HTTPException(status_code=404, detail="Tournament not found")

        # Participants
        stmt_p = select(TournamentParticipant).where(TournamentParticipant.tournament_id == tournament_id).order_by(TournamentParticipant.seed)
        participants = (await session.execute(stmt_p)).scalars().all()

        # Fixtures
        stmt_f = select(TournamentFixture).where(TournamentFixture.tournament_id == tournament_id).order_by(TournamentFixture.round_number, TournamentFixture.match_index)
        fixtures = (await session.execute(stmt_f)).scalars().all()

        return {
            "tournament": {
                "id": tourn.id,
                "title": tourn.title,
                "description": tourn.description,
                "organizer_id": tourn.organizer_id,
                "organizer_name": tourn.organizer_name,
                "tournament_format": tourn.tournament_format,
                "max_participants": tourn.max_participants,
                "overs_per_match": tourn.overs_per_match,
                "wickets_per_match": tourn.wickets_per_match,
                "status": tourn.status,
                "current_round": tourn.current_round,
                "winner_id": tourn.winner_id,
                "winner_name": tourn.winner_name,
                "created_at": tourn.created_at,
                "updated_at": tourn.updated_at
            },
            "participants": [
                {
                    "id": p.id,
                    "user_id": p.user_id,
                    "user_name": p.user_name,
                    "gamer_tag": p.gamer_tag,
                    "avatar_url": p.avatar_url,
                    "seed": p.seed,
                    "is_eliminated": p.is_eliminated,
                    "matches_played": p.matches_played,
                    "matches_won": p.matches_won,
                    "matches_lost": p.matches_lost,
                    "points": p.points
                }
                for p in participants
            ],
            "fixtures": [
                {
                    "id": f.id,
                    "round_number": f.round_number,
                    "match_index": f.match_index,
                    "player_1_id": f.player_1_id,
                    "player_1_name": f.player_1_name,
                    "player_2_id": f.player_2_id,
                    "player_2_name": f.player_2_name,
                    "room_code": f.room_code,
                    "status": f.status,
                    "winner_id": f.winner_id,
                    "winner_name": f.winner_name,
                    "score_summary": f.score_summary,
                    "next_fixture_id": f.next_fixture_id
                }
                for f in fixtures
            ]
        }

@router.post("/{tournament_id}/join")
async def join_tournament(
    tournament_id: str,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        tourn = await session.get(Tournament, tournament_id)
        if not tourn:
            raise HTTPException(status_code=404, detail="Tournament not found")
        if tourn.status != "REGISTRATION":
            raise HTTPException(status_code=400, detail="Tournament is no longer accepting registrations")

        stmt_p = select(TournamentParticipant).where(TournamentParticipant.tournament_id == tournament_id)
        current_participants = (await session.execute(stmt_p)).scalars().all()

        if any(p.user_id == current_user.id for p in current_participants):
            raise HTTPException(status_code=400, detail="You have already joined this tournament")

        if len(current_participants) >= tourn.max_participants:
            raise HTTPException(status_code=400, detail="Tournament is already full")

        user_profile = await session.get(Profile, current_user.id)
        name = user_profile.display_name if user_profile else current_user.username
        tag = user_profile.gamer_tag if user_profile else f"{current_user.username}#001"
        avatar = user_profile.avatar_url if user_profile else "avatar_1"

        new_part = TournamentParticipant(
            id=f"tp_{uuid.uuid4().hex[:8]}",
            tournament_id=tournament_id,
            user_id=current_user.id,
            user_name=name,
            gamer_tag=tag,
            avatar_url=avatar,
            seed=len(current_participants) + 1,
            is_eliminated=False,
            matches_played=0,
            matches_won=0,
            matches_lost=0,
            points=0,
            joined_at=time.time()
        )
        session.add(new_part)
        tourn.updated_at = time.time()
        await session.commit()

        return {"message": "Joined tournament successfully", "seed": new_part.seed}

@router.post("/{tournament_id}/start")
async def start_tournament(
    tournament_id: str,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        tourn = await session.get(Tournament, tournament_id)
        if not tourn:
            raise HTTPException(status_code=404, detail="Tournament not found")
        if tourn.organizer_id != current_user.id:
            raise HTTPException(status_code=403, detail="Only tournament organizer can start the tournament")
        if tourn.status != "REGISTRATION":
            raise HTTPException(status_code=400, detail="Tournament has already started")

        stmt_p = select(TournamentParticipant).where(TournamentParticipant.tournament_id == tournament_id).order_by(TournamentParticipant.seed)
        participants = (await session.execute(stmt_p)).scalars().all()

        if len(participants) < 2:
            raise HTTPException(status_code=400, detail="Need at least 2 participants to start tournament")

        tourn.status = "IN_PROGRESS"
        tourn.updated_at = time.time()

        if tourn.tournament_format == "KNOCKOUT":
            # Generate Knockout Bracket
            num_players = len(participants)
            # Create Final first if needed to link next_fixture_id
            final_fixture = TournamentFixture(
                id=f"tf_{uuid.uuid4().hex[:8]}",
                tournament_id=tournament_id,
                round_number=2 if num_players <= 4 else 3,
                match_index=1,
                player_1_id=None,
                player_2_id=None,
                status="SCHEDULED",
                created_at=time.time()
            )
            session.add(final_fixture)

            # Round 1 fixtures
            if num_players <= 4:
                # 2 Semifinals feeding into Final
                sf1 = TournamentFixture(
                    id=f"tf_{uuid.uuid4().hex[:8]}",
                    tournament_id=tournament_id,
                    round_number=1,
                    match_index=1,
                    player_1_id=participants[0].user_id,
                    player_1_name=participants[0].user_name,
                    player_2_id=participants[1].user_id if len(participants) > 1 else None,
                    player_2_name=participants[1].user_name if len(participants) > 1 else None,
                    status="READY" if len(participants) > 1 else "COMPLETED",
                    next_fixture_id=final_fixture.id,
                    created_at=time.time()
                )
                session.add(sf1)

                sf2 = TournamentFixture(
                    id=f"tf_{uuid.uuid4().hex[:8]}",
                    tournament_id=tournament_id,
                    round_number=1,
                    match_index=2,
                    player_1_id=participants[2].user_id if len(participants) > 2 else None,
                    player_1_name=participants[2].user_name if len(participants) > 2 else None,
                    player_2_id=participants[3].user_id if len(participants) > 3 else None,
                    player_2_name=participants[3].user_name if len(participants) > 3 else None,
                    status="READY" if len(participants) > 3 else "SCHEDULED",
                    next_fixture_id=final_fixture.id,
                    created_at=time.time()
                )
                session.add(sf2)
            else:
                # 4 Quarterfinals feeding into Semifinals
                sf1 = TournamentFixture(
                    id=f"tf_{uuid.uuid4().hex[:8]}",
                    tournament_id=tournament_id,
                    round_number=2,
                    match_index=1,
                    status="SCHEDULED",
                    next_fixture_id=final_fixture.id,
                    created_at=time.time()
                )
                sf2 = TournamentFixture(
                    id=f"tf_{uuid.uuid4().hex[:8]}",
                    tournament_id=tournament_id,
                    round_number=2,
                    match_index=2,
                    status="SCHEDULED",
                    next_fixture_id=final_fixture.id,
                    created_at=time.time()
                )
                session.add_all([sf1, sf2])

                for i in range(4):
                    p1 = participants[i * 2] if len(participants) > i * 2 else None
                    p2 = participants[i * 2 + 1] if len(participants) > i * 2 + 1 else None
                    qf = TournamentFixture(
                        id=f"tf_{uuid.uuid4().hex[:8]}",
                        tournament_id=tournament_id,
                        round_number=1,
                        match_index=i + 1,
                        player_1_id=p1.user_id if p1 else None,
                        player_1_name=p1.user_name if p1 else None,
                        player_2_id=p2.user_id if p2 else None,
                        player_2_name=p2.user_name if p2 else None,
                        status="READY" if (p1 and p2) else "SCHEDULED",
                        next_fixture_id=sf1.id if i < 2 else sf2.id,
                        created_at=time.time()
                    )
                    session.add(qf)

        else:
            # Round Robin: every participant plays every other participant
            match_idx = 1
            n = len(participants)
            for i in range(n):
                for j in range(i + 1, n):
                    p1 = participants[i]
                    p2 = participants[j]
                    fix = TournamentFixture(
                        id=f"tf_{uuid.uuid4().hex[:8]}",
                        tournament_id=tournament_id,
                        round_number=1,
                        match_index=match_idx,
                        player_1_id=p1.user_id,
                        player_1_name=p1.user_name,
                        player_2_id=p2.user_id,
                        player_2_name=p2.user_name,
                        status="READY",
                        created_at=time.time()
                    )
                    session.add(fix)
                    match_idx += 1

        await session.commit()
        return {"message": "Tournament started and fixtures generated successfully"}

@router.post("/fixture/{fixture_id}/create-room")
async def create_fixture_room(
    fixture_id: str,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        fixture = await session.get(TournamentFixture, fixture_id)
        if not fixture:
            raise HTTPException(status_code=404, detail="Fixture not found")

        tourn = await session.get(Tournament, fixture.tournament_id)
        if not tourn:
            raise HTTPException(status_code=404, detail="Tournament not found")

        if current_user.id not in [fixture.player_1_id, fixture.player_2_id, tourn.organizer_id]:
            raise HTTPException(status_code=403, detail="Not authorized to launch this tournament fixture")

        # If room already exists and is active, return it
        if fixture.room_code and room_manager.get_room(fixture.room_code):
            return {"room_code": fixture.room_code, "status": fixture.status}

        host_name = fixture.player_1_name or "Tournament Player"
        host_id = fixture.player_1_id or current_user.id

        session_token = f"tok_{uuid.uuid4().hex}"
        room = room_manager.create_room(
            host_id=host_id,
            host_name=host_name,
            session_token=session_token
        )
        room_code = room.room_code
        host_token = session_token
        if room:
            room.state.match_type = "TOURNAMENT"
            room.state.tournament_id = tourn.id
            room.state.player_1_user_id = fixture.player_1_id
            room.state.player_2_user_id = fixture.player_2_id
            room.state.rules.overs_per_innings = tourn.overs_per_match
            room.state.rules.wickets_per_innings = tourn.wickets_per_match

        fixture.room_code = room_code
        fixture.status = "IN_PROGRESS"
        await session.commit()

        return {
            "room_code": room_code,
            "host_token": host_token if current_user.id == host_id else None,
            "player_1_id": fixture.player_1_id,
            "player_2_id": fixture.player_2_id
        }
