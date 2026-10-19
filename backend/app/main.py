import os
import sys
import json
import uuid
import time
import random
import asyncio
from typing import Dict, Any, Optional, List
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .models.game import (
    MatchPhase,
    MatchRules,
    TeamConfig,
    PlayerRosterItem,
    PlayerRole,
    UserRole
)
from .rooms.manager import room_manager
from .engine.hand_cricket import HandCricketEngine
from .commentary.service import commentary_service
from .database import (
    init_db,
    save_completed_match,
    get_match_history,
    get_match_detail,
    check_db_health,
    get_safe_database_description,
    DATABASE_URL,
    User
)
from .auth.security import get_optional_current_user
from .auth.router import router as auth_router
from .routers.profiles import router as profiles_router
from .routers.friends import router as friends_router
from .routers.presence import router as presence_router
from .routers.matchmaking import router as matchmaking_router
from .routers.invitations import router as invitations_router
from .routers.series import router as series_router
from .routers.tournaments import router as tournaments_router
from .presence.manager import presence_manager, PresenceState
from fastapi import Depends

async def periodic_room_cleanup():
    """Background task running every 15 minutes to clean up rooms idle for > 4 hours."""
    while True:
        try:
            await asyncio.sleep(900)
            cleaned = room_manager.cleanup_inactive_rooms(max_idle_seconds=14400.0)
            if cleaned > 0:
                print(f"[Cleanup] Cleaned up {cleaned} stale rooms")
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Cleanup Error] {e}")

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[Lifespan] Starting up Six Fingers backend...", flush=True)
    try:
        await init_db()
        print("[Lifespan] Database initialization complete.", flush=True)
    except Exception as exc:
        print(
            f"[Lifespan Fatal] Application startup aborted: Database initialization failed "
            f"({type(exc).__name__}: {exc}). Target: {get_safe_database_description(DATABASE_URL)}",
            file=sys.stderr,
            flush=True
        )
        sys.stderr.flush()
        sys.stdout.flush()
        raise exc

    cleanup_task = asyncio.create_task(periodic_room_cleanup())
    yield
    cleanup_task.cancel()

app = FastAPI(title="Six Fingers - Hand Cricket API", lifespan=lifespan)

cors_origins_raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
allowed_origins = [o.strip() for o in cors_origins_raw.split(",")] if cors_origins_raw != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins != ["*"] else ["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_origin_regex=r"^https?://.*" if allowed_origins == ["*"] else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(profiles_router)
app.include_router(friends_router)
app.include_router(presence_router)
app.include_router(matchmaking_router)
app.include_router(invitations_router)
app.include_router(series_router)
app.include_router(tournaments_router)

class CreateRoomRequest(BaseModel):
    host_name: str = "Player 1"
    players_per_team: Optional[int] = 1
    max_spectators: Optional[int] = 20
    rules: Optional[MatchRules] = None

class JoinRoomRequest(BaseModel):
    room_code: str
    player_name: str = "Player"
    role: str = "player" # "player" | "spectator"
    team_id: Optional[str] = None

class UpdateRulesRequest(BaseModel):
    room_code: str
    rules: MatchRules

@app.get("/health")
@app.get("/health/live")
async def health():
    return {"status": "ok", "app": "Six Fingers Hand Cricket"}

@app.get("/health/ready")
async def readiness_check(response: Response):
    db_ok = await check_db_health()
    if not db_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "unhealthy", "database": "unavailable"}
    return {
        "status": "ready",
        "database": "connected",
        "active_rooms": len(room_manager.rooms)
    }

@app.get("/api/metrics")
async def get_metrics():
    """Operational observability metrics for active matches and connections."""
    metrics = room_manager.get_metrics()
    return metrics

@app.post("/api/rooms/create")
async def create_room(req: CreateRoomRequest, current_user: Optional[User] = Depends(get_optional_current_user)):
    host_id = f"p_{uuid.uuid4().hex[:8]}"
    session_token = f"tok_{uuid.uuid4().hex}"
    host_name = req.host_name
    if current_user and req.host_name in ["Player 1", ""]:
        host_name = current_user.full_name or current_user.username
    room = room_manager.create_room(host_id, host_name, session_token)
    if current_user:
        room.state.player_1_user_id = current_user.id
    if req.players_per_team:
        room.state.rules.players_per_team = req.players_per_team
    if req.max_spectators:
        room.state.rules.max_spectators = req.max_spectators
    if req.rules:
        room.state.rules = req.rules
    return {
        "room_code": room.room_code,
        "player_id": host_id,
        "session_token": session_token,
        "role": "host",
        "team_id": room.state.team_a.id
    }

@app.post("/api/rooms/join")
async def join_room(req: JoinRoomRequest, current_user: Optional[User] = Depends(get_optional_current_user)):
    room = room_manager.get_room(req.room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found. Check the code and try again.")
    
    player_name = req.player_name
    if current_user and req.player_name in ["Player", ""]:
        player_name = current_user.full_name or current_user.username

    user_id = f"u_{uuid.uuid4().hex[:8]}"
    session_token = f"tok_{uuid.uuid4().hex}"
    ok, msg, metadata = room.join_user(
        user_id=user_id,
        user_name=player_name,
        session_token=session_token,
        role=req.role,
        requested_team_id=req.team_id
    )
    if not ok:
        raise HTTPException(status_code=403, detail=msg)

    if current_user and req.role == "player" and not room.state.player_2_user_id:
        room.state.player_2_user_id = current_user.id
    
    return {
        "room_code": room.room_code,
        "player_id": user_id,
        "session_token": session_token,
        "role": metadata.get("role", req.role),
        "team_id": metadata.get("team_id"),
        "is_host": metadata.get("is_host", False),
        "is_captain": metadata.get("is_captain", False),
        "message": msg
    }

@app.get("/api/rooms/{room_code}")
async def get_room_info(room_code: str):
    room = room_manager.get_room(room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    return {
        "room_code": room.room_code,
        "phase": room.state.phase,
        "host_id": room.state.host_id,
        "team_a": room.state.team_a.model_dump(),
        "team_b": room.state.team_b.model_dump(),
        "spectator_count": room.state.spectator_count,
        "spectators": [s.model_dump() for s in room.state.spectators],
        "player_1_name": room.state.player_1_name,
        "player_2_name": room.state.player_2_name,
        "player_2_connected": room.state.player_2_connected,
        "active_batting_controller_id": room.state.active_batting_controller_id,
        "active_bowling_controller_id": room.state.active_bowling_controller_id,
        "rules": room.state.rules.model_dump()
    }

@app.get("/api/history")
async def match_history(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    history = await get_match_history(limit=limit, offset=offset)
    return {"history": history, "limit": limit, "offset": offset}

@app.get("/api/matches/{match_id}")
async def match_detail(match_id: str):
    detail = await get_match_detail(match_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Match record not found")
    return {"match": detail}

@app.get("/api/teams/default")
async def default_teams():
    team_a = TeamConfig(
        id="t_mumbai",
        name="Mumbai Blasters",
        color="#6500C8",
        accent_color="#FFD900",
        players=HandCricketEngine.create_default_roster("Mumbai Blasters", "mum")
    )
    team_b = TeamConfig(
        id="t_chennai",
        name="Chennai Superstars",
        color="#F000A8",
        accent_color="#9BE52E",
        players=HandCricketEngine.create_default_roster("Chennai Superstars", "chn")
    )
    return {"teams": [team_a.model_dump(), team_b.model_dump()]}

@app.websocket("/ws/{room_code}")
async def websocket_endpoint(
    websocket: WebSocket,
    room_code: str,
    player_id: str = Query(...),
    session_token: str = Query(...)
):
    await websocket.accept()
    room = room_manager.get_room(room_code)
    if not room:
        await websocket.send_json({"type": "ERROR", "message": "Room not found"})
        await websocket.close()
        return

    user_conn = room.get_connection(player_id)
    if not user_conn or user_conn.session_token != session_token:
        await websocket.send_json({"type": "ERROR", "message": "Invalid player session credentials"})
        await websocket.close()
        return

    # Attach active websocket
    user_conn.websocket = websocket
    user_conn.is_connected = True
    if player_id in room.state.participants:
        room.state.participants[player_id].is_connected = True

    if player_id == room.state.player_1_id:
        room.state.player_1_connected = True
    elif player_id == room.state.player_2_id:
        room.state.player_2_connected = True

    # Send initial state securely with sanitization
    await websocket.send_json({
        "type": "INITIAL_STATE",
        "state": room_manager.sanitize_state_for_player(room.state, player_id),
        "player_id": player_id,
        "is_host": user_conn.is_host,
        "role": user_conn.role,
        "team_id": user_conn.team_id,
        "is_captain": user_conn.is_captain
    })

    # Broadcast player/spectator joined to other connected clients
    for other_conn in room.connections.values():
        if other_conn.user_id != player_id and other_conn.websocket and other_conn.is_connected:
            await other_conn.websocket.send_json({
                "type": "PLAYER_CONNECTED" if user_conn.role == "player" else "SPECTATOR_JOINED",
                "player_id": player_id,
                "player_name": user_conn.user_name,
                "role": user_conn.role,
                "state": room_manager.sanitize_state_for_player(room.state, other_conn.user_id)
            })

    try:
        while True:
            data = await websocket.receive_json()
            room.touch()
            msg_type = data.get("type")

            # 1. WebRTC Signaling pass-through
            if msg_type in ["RTC_OFFER", "RTC_ANSWER", "RTC_ICE_CANDIDATE"]:
                target_id = data.get("target_id")
                target_conn = room.get_connection(target_id) if target_id else room.get_opponent(player_id)
                if target_conn and target_conn.websocket and target_conn.is_connected:
                    await target_conn.websocket.send_json({
                        "type": msg_type,
                        "from_player_id": player_id,
                        "payload": data.get("payload")
                    })

            # 2. Camera / Audio readiness
            elif msg_type == "MEDIA_STATUS":
                user_conn.is_camera_ready = data.get("camera", False)
                user_conn.is_mic_ready = data.get("mic", False)
                await room_manager.broadcast_to_room(room, {
                    "type": "MEDIA_STATUS_UPDATE",
                    "player_id": player_id,
                    "camera": user_conn.is_camera_ready,
                    "mic": user_conn.is_mic_ready
                })

            # 3. Update Match Rules (Host only, during lobby)
            elif msg_type == "UPDATE_RULES":
                if user_conn.is_host and room.state.phase == MatchPhase.LOBBY:
                    rules_data = data.get("rules", {})
                    if "overs_per_innings" in rules_data:
                        rules_data["overs_per_innings"] = max(1, min(int(rules_data["overs_per_innings"]), 50))
                    if "wickets_per_innings" in rules_data:
                        rules_data["wickets_per_innings"] = max(1, min(int(rules_data["wickets_per_innings"]), 10))
                    if "decision_timer_seconds" in rules_data:
                        rules_data["decision_timer_seconds"] = max(3, min(int(rules_data["decision_timer_seconds"]), 30))
                    room.state.rules = MatchRules(**rules_data)
                    await room_manager.broadcast_state_to_all(room, "STATE_UPDATE")

            # 3b. Update Custom Team Details & Roster (Host or Captain)
            elif msg_type == "UPDATE_TEAM_CUSTOM":
                team_key = data.get("team") # "team_a" or "team_b"
                is_authorized = user_conn.is_host or (user_conn.is_captain and (
                    (team_key == "team_a" and user_conn.team_id == room.state.team_a.id) or
                    (team_key == "team_b" and user_conn.team_id == room.state.team_b.id)
                ))
                if is_authorized and room.state.phase == MatchPhase.LOBBY:
                    team_target = room.state.team_a if team_key == "team_a" else room.state.team_b
                    if "name" in data and data["name"]:
                        team_target.name = str(data["name"])[:50]
                    if "color" in data and data["color"]:
                        team_target.color = str(data["color"])[:16]
                    if "accent_color" in data and data["accent_color"]:
                        team_target.accent_color = str(data["accent_color"])[:16]
                    if "players" in data and isinstance(data["players"], list):
                        new_roster = []
                        for idx, p in enumerate(data["players"][:11]):
                            new_roster.append(PlayerRosterItem(
                                id=str(p.get("id", f"p_{idx+1}")),
                                name=str(p.get("name", f"Player {idx+1}"))[:30],
                                role=p.get("role", PlayerRole.ALL_ROUNDER),
                                batting_order=int(p.get("batting_order", idx + 1)),
                                bowling_order=int(p.get("bowling_order", idx + 1))
                            ))
                        if new_roster:
                            team_target.players = new_roster
                    await room_manager.broadcast_state_to_all(room, "STATE_UPDATE")

            # 4. Team assignment (Host or self during lobby)
            elif msg_type == "ASSIGN_TEAM":
                target_user = data.get("user_id", player_id)
                target_team = data.get("team_id")
                if room.state.phase == MatchPhase.LOBBY:
                    if user_conn.is_host or target_user == player_id:
                        ok, msg = room.assign_player_team(target_user, target_team)
                        if ok:
                            await room_manager.broadcast_state_to_all(room, "STATE_UPDATE")

            # 5. Captain assignment (Host only)
            elif msg_type == "ASSIGN_CAPTAIN":
                target_user = data.get("captain_id")
                team_id = data.get("team_id")
                if user_conn.is_host and room.state.phase == MatchPhase.LOBBY:
                    ok, msg = room.assign_captain(target_user, team_id)
                    if ok:
                        await room_manager.broadcast_state_to_all(room, "STATE_UPDATE")

            # 6. Update Controller Rotation Order (Captain of team or Host)
            elif msg_type == "UPDATE_ROTATION":
                team_id = data.get("team_id")
                batting_order = data.get("batting_order", [])
                bowling_order = data.get("bowling_order", [])
                is_authorized = user_conn.is_host or (user_conn.is_captain and user_conn.team_id == team_id)
                if is_authorized and room.state.phase in [MatchPhase.LOBBY, MatchPhase.INNINGS_BREAK]:
                    ok, msg = room.update_team_rotation(team_id, batting_order, bowling_order)
                    if ok:
                        await room_manager.broadcast_state_to_all(room, "STATE_UPDATE")

            # 7. Set Manual Controller for Over (Captain or Host)
            elif msg_type == "SET_MANUAL_CONTROLLER":
                ctrl_role = data.get("role") # "batting" or "bowling"
                ctrl_id = data.get("controller_id")
                innings = HandCricketEngine.get_current_innings(room.state)
                if innings:
                    b_team, bl_team = HandCricketEngine.get_batting_and_bowling_teams(room.state, innings)
                    target_team_id = b_team.id if ctrl_role == "batting" else bl_team.id
                    if user_conn.is_host or (user_conn.is_captain and user_conn.team_id == target_team_id):
                        room.set_manual_controller(ctrl_role, ctrl_id)
                        await room_manager.broadcast_state_to_all(room, "STATE_UPDATE")

            # 8. Ready in Lobby
            elif msg_type == "SET_LOBBY_READY":
                if user_conn.role == "spectator":
                    continue # Spectators cannot trigger match start

                is_ready = data.get("ready", True)
                if player_id in room.state.participants:
                    room.state.participants[player_id].is_ready = is_ready
                if player_id == room.state.player_1_id:
                    room.state.player_1_ready = is_ready
                elif player_id == room.state.player_2_id:
                    room.state.player_2_ready = is_ready

                # Check if playing participants are ready for Toss
                players = [p for p in room.state.participants.values() if p.role == UserRole.PLAYER and p.is_connected]
                all_players_ready = len(players) >= 2 and all(p.is_ready for p in players)

                # Fallback to legacy check if only 2 players
                if (room.state.player_1_ready and room.state.player_2_ready) or all_players_ready:
                    room.state.phase = MatchPhase.TOSS
                    if room.bot_session:
                        room.bot_session.on_phase_change(MatchPhase.TOSS)

                await room_manager.broadcast_state_to_all(room, "STATE_UPDATE")

            # 9. Toss Execution
            elif msg_type == "DO_TOSS":
                if room.state.phase == MatchPhase.TOSS:
                    toss_caller = room.state.player_2_id or "p2"
                    call_choice = data.get("call", "heads").lower()
                    coin_flip = "heads" if random.random() > 0.5 else "tails"
                    winner_id = toss_caller if call_choice == coin_flip else room.state.player_1_id
                    room.state.toss_winner_id = winner_id

                    await room_manager.broadcast_to_room(room, {
                        "type": "TOSS_RESULT",
                        "coin_flip": coin_flip,
                        "toss_winner_id": winner_id,
                        "state": room.state.model_dump(exclude={"pending_submissions"})
                    })

            # 10. Toss Decision
            elif msg_type == "TOSS_DECISION":
                if room.state.phase == MatchPhase.TOSS and (player_id == room.state.toss_winner_id or user_conn.is_host):
                    decision = data.get("decision", "bat")
                    room.state.toss_decision = decision

                    # Initialize Innings 1 and start match!
                    inn1 = HandCricketEngine.initialize_innings(room.state, 1)
                    room.state.innings_list = [inn1]
                    room.state.current_innings_number = 1
                    HandCricketEngine.start_new_delivery(room.state)

                    if room.state.player_1_user_id:
                        asyncio.create_task(presence_manager.set_user_activity(
                            room.state.player_1_user_id, PresenceState.IN_MATCH, "Playing Six Fingers", room.room_code
                        ))
                    if room.state.player_2_user_id:
                        asyncio.create_task(presence_manager.set_user_activity(
                            room.state.player_2_user_id, PresenceState.IN_MATCH, "Playing Six Fingers", room.room_code
                        ))

                    await room_manager.broadcast_state_to_all(room, "MATCH_STARTED")
                    if room.bot_session:
                        room.bot_session.on_phase_change(MatchPhase.DECISION)

            # 11. Private Delivery Hand Submission (Webcam or Fallback Keypad)
            elif msg_type == "SUBMIT_HAND":
                delivery_id = data.get("delivery_id")
                chosen_number = int(data.get("chosen_number", 0))
                # Server-authoritative check: only active controllers can submit!
                await room_manager.handle_delivery_submission(
                    room, player_id, delivery_id, chosen_number
                )

            # 12. Next Ball Ready (Discussion phase)
            elif msg_type == "READY_NEXT_BALL":
                both_ready = HandCricketEngine.set_player_ready_for_next(room.state, player_id)
                await room_manager.broadcast_state_to_all(room, "STATE_UPDATE", {
                    "ready_player_id": player_id,
                    "both_ready": both_ready
                })

                if room.state.is_match_over:
                    if room.bot_session:
                        asyncio.create_task(room.bot_session.cleanup())
                    asyncio.create_task(save_completed_match(
                        room.state.model_dump(),
                        player_1_user_id=room.state.player_1_user_id,
                        player_2_user_id=room.state.player_2_user_id,
                        match_type=getattr(room.state, "match_type", "PRIVATE")
                    ))
                    if room.state.player_1_user_id:
                        asyncio.create_task(presence_manager.set_user_activity(
                            room.state.player_1_user_id, PresenceState.ONLINE, "Online · Available to play", None
                        ))
                    if room.state.player_2_user_id and not getattr(room.state, "is_bot_match", False):
                        asyncio.create_task(presence_manager.set_user_activity(
                            room.state.player_2_user_id, PresenceState.ONLINE, "Online · Available to play", None
                        ))
                elif both_ready:
                    if room.bot_session:
                        if room.state.phase == MatchPhase.DECISION:
                            room.bot_session.on_phase_change(MatchPhase.DECISION)
                        elif room.state.phase == MatchPhase.OVER_BREAK:
                            room.bot_session.on_phase_change(MatchPhase.OVER_BREAK)
                        elif room.state.phase == MatchPhase.INNINGS_BREAK:
                            room.bot_session.on_phase_change(MatchPhase.INNINGS_BREAK)

            # 13. Over Transition Ready (OVER_BREAK phase)
            elif msg_type == "READY_OVER_TRANSITION":
                ready = HandCricketEngine.set_over_transition_ready(room.state, player_id)
                await room_manager.broadcast_state_to_all(room, "STATE_UPDATE", {
                    "over_ready": ready
                })
                if ready and room.bot_session:
                    room.bot_session.on_phase_change(MatchPhase.DECISION)

            # 14. Start Innings 2 (from Innings Break)
            elif msg_type == "START_INNINGS_2":
                if room.state.phase == MatchPhase.INNINGS_BREAK and (user_conn.is_host or user_conn.is_captain):
                    HandCricketEngine.transition_to_innings_2(room.state)
                    await room_manager.broadcast_state_to_all(room, "STATE_UPDATE")
                    if room.bot_session:
                        room.bot_session.on_phase_change(MatchPhase.DECISION)

            # 15. Rematch
            elif msg_type == "REQUEST_REMATCH":
                if user_conn.is_host or user_conn.is_captain:
                    room.state.phase = MatchPhase.TOSS
                    room.state.current_innings_number = 1
                    room.state.innings_list.clear()
                    room.state.is_match_over = False
                    room.state.winner_team_id = None
                    room.state.win_margin_description = None
                    room.state.pending_submissions.clear()
                    room.state.ready_for_next_ball.clear()
                    room.state.over_transition_ready.clear()
                    await room_manager.broadcast_state_to_all(room, "REMATCH_STARTED")

            # 16. Chat & Social Reactions
            elif msg_type == "SEND_CHAT":
                channel = data.get("channel", "all")
                text = data.get("text", "")
                reaction = data.get("reaction")
                await room_manager.handle_chat_message(
                    room=room,
                    sender_id=player_id,
                    channel=channel,
                    text=text,
                    reaction=reaction
                )

    except WebSocketDisconnect:
        user_conn.is_connected = False
        if player_id in room.state.participants:
            room.state.participants[player_id].is_connected = False

        if user_conn.role == "spectator":
            # Spectator disconnection does NOT interrupt the match!
            room.state.spectators = [s for s in room.state.spectators if s.id != player_id]
            room.state.spectator_count = len(room.state.spectators)
            await room_manager.broadcast_to_room(room, {
                "type": "SPECTATOR_LEFT",
                "player_id": player_id,
                "spectator_count": room.state.spectator_count
            })
        else:
            # Player disconnected
            if room.bot_session:
                asyncio.create_task(room.bot_session.cleanup())
            if player_id == room.state.player_1_id:
                room.state.player_1_connected = False
            elif player_id == room.state.player_2_id:
                room.state.player_2_connected = False

            await room_manager.broadcast_state_to_all(room, "PLAYER_DISCONNECTED", {
                "disconnected_player_id": player_id
            })
