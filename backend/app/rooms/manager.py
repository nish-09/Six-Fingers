import random
import string
import time
import asyncio
from typing import Dict, Optional, Set, Any, List, Tuple
from fastapi import WebSocket
from ..models.game import (
    MatchState,
    MatchPhase,
    MatchRules,
    TeamConfig,
    DeliveryResult,
    PlayerRosterItem,
    RoomParticipant,
    UserRole,
    ChatMessage
)
from ..engine.hand_cricket import HandCricketEngine
from ..commentary.service import commentary_service

class RoomUserConnection:
    def __init__(
        self,
        user_id: str,
        user_name: str,
        session_token: str,
        role: str = "player",
        team_id: Optional[str] = None,
        is_host: bool = False,
        is_captain: bool = False
    ):
        self.user_id = user_id
        self.player_id = user_id # alias for backward compatibility
        self.user_name = user_name
        self.player_name = user_name # alias for backward compatibility
        self.session_token = session_token
        self.role = role # "player" or "spectator"
        self.team_id = team_id
        self.is_host = is_host
        self.is_captain = is_captain
        self.websocket: Optional[WebSocket] = None
        self.is_connected = False
        self.is_camera_ready = False
        self.is_mic_ready = False
        self.last_chat_time = 0.0
        self.chat_count_window = 0

class MatchRoom:
    def __init__(self, room_code: str, host_id: str, host_name: str, host_session_token: str):
        self.room_code = room_code
        self.created_at = time.time()
        self.last_activity = time.time()
        self.host_id = host_id
        
        # All user connections (keyed by user_id)
        self.connections: Dict[str, RoomUserConnection] = {}

        # Default teams
        team_a = TeamConfig(
            id=f"team_{host_id[:6]}",
            name=f"{host_name}'s Blasters",
            color="#6500C8",
            accent_color="#FFD900",
            captain_id=host_id,
            players=HandCricketEngine.create_default_roster(host_name, "t1"),
            human_player_ids=[host_id],
            batting_controller_order=[host_id],
            bowling_controller_order=[host_id]
        )
        team_b = TeamConfig(
            id="team_opponent",
            name="Super Challengers",
            color="#F000A8",
            accent_color="#9BE52E",
            captain_id=None,
            players=HandCricketEngine.create_default_roster("Challengers", "t2"),
            human_player_ids=[],
            batting_controller_order=[],
            bowling_controller_order=[]
        )

        # Host connection
        host_conn = RoomUserConnection(
            user_id=host_id,
            user_name=host_name,
            session_token=host_session_token,
            role="player",
            team_id=team_a.id,
            is_host=True,
            is_captain=True
        )
        self.connections[host_id] = host_conn

        # Host participant
        host_participant = RoomParticipant(
            id=host_id,
            name=host_name,
            role=UserRole.PLAYER,
            team_id=team_a.id,
            is_captain=True,
            is_host=True,
            is_ready=False,
            is_connected=True,
            joined_at=time.time()
        )

        self.state = MatchState(
            match_id=f"match_{room_code}_{int(time.time())}",
            room_code=room_code,
            phase=MatchPhase.LOBBY,
            rules=MatchRules(),
            host_id=host_id,
            team_a=team_a,
            team_b=team_b,
            participants={host_id: host_participant},
            spectators=[],
            spectator_count=0,
            player_1_id=host_id,
            player_1_name=host_name,
            player_1_team_id=team_a.id,
            player_1_ready=False,
            player_1_connected=True,
            active_batting_controller_id=host_id,
            active_bowling_controller_id=None
        )

    @property
    def player_1(self) -> Optional[RoomUserConnection]:
        return self.connections.get(self.state.player_1_id)

    @property
    def player_2(self) -> Optional[RoomUserConnection]:
        if self.state.player_2_id:
            return self.connections.get(self.state.player_2_id)
        return None

    def join_user(
        self,
        user_id: str,
        user_name: str,
        session_token: str,
        role: str = "player",
        requested_team_id: Optional[str] = None
    ) -> Tuple[bool, str, Dict[str, Any]]:
        self.last_activity = time.time()

        # Reconnection check
        if user_id in self.connections:
            conn = self.connections[user_id]
            conn.is_connected = True
            if user_id in self.state.participants:
                self.state.participants[user_id].is_connected = True
            if user_id == self.state.player_1_id:
                self.state.player_1_connected = True
            elif user_id == self.state.player_2_id:
                self.state.player_2_connected = True
            return True, "Reconnected to room", {
                "role": conn.role,
                "team_id": conn.team_id,
                "is_host": conn.is_host,
                "is_captain": conn.is_captain
            }

        # Also check session token reconnect
        for existing_id, existing_conn in self.connections.items():
            if existing_conn.session_token == session_token:
                existing_conn.is_connected = True
                if existing_id in self.state.participants:
                    self.state.participants[existing_id].is_connected = True
                return True, "Reconnected to room", {
                    "role": existing_conn.role,
                    "team_id": existing_conn.team_id,
                    "is_host": existing_conn.is_host,
                    "is_captain": existing_conn.is_captain
                }

        # 1. Join as Spectator
        if role == "spectator":
            if self.state.spectator_count >= self.state.rules.max_spectators:
                return False, f"Room spectator limit ({self.state.rules.max_spectators}) reached.", {}

            conn = RoomUserConnection(
                user_id=user_id,
                user_name=user_name,
                session_token=session_token,
                role="spectator",
                team_id=None,
                is_host=False,
                is_captain=False
            )
            self.connections[user_id] = conn
            
            participant = RoomParticipant(
                id=user_id,
                name=user_name,
                role=UserRole.SPECTATOR,
                team_id=None,
                is_captain=False,
                is_host=False,
                is_ready=True,
                is_connected=True,
                joined_at=time.time()
            )
            self.state.participants[user_id] = participant
            self.state.spectators.append(participant)
            self.state.spectator_count = len(self.state.spectators)
            return True, "Joined room as spectator", {
                "role": "spectator",
                "team_id": None,
                "is_host": False,
                "is_captain": False
            }

        # 2. Join as Player
        total_players = len([c for c in self.connections.values() if c.role == "player"])
        max_players = max(2, self.state.rules.players_per_team * 2)

        if total_players >= max_players:
            return False, "Room player capacity is full. You can join as a spectator.", {}

        # Determine team assignment
        target_team = None
        if requested_team_id == self.state.team_a.id and len(self.state.team_a.human_player_ids) < self.state.rules.players_per_team:
            target_team = self.state.team_a
        elif requested_team_id == self.state.team_b.id and len(self.state.team_b.human_player_ids) < self.state.rules.players_per_team:
            target_team = self.state.team_b
        else:
            # Auto-balance: pick team with fewer players
            if len(self.state.team_b.human_player_ids) < len(self.state.team_a.human_player_ids):
                target_team = self.state.team_b
            elif len(self.state.team_a.human_player_ids) < self.state.rules.players_per_team:
                target_team = self.state.team_a
            else:
                target_team = self.state.team_b

        is_captain = (len(target_team.human_player_ids) == 0)
        if is_captain:
            target_team.captain_id = user_id
            if target_team.id == self.state.team_b.id:
                target_team.name = f"{user_name}'s Kings"

        target_team.human_player_ids.append(user_id)
        if user_id not in target_team.batting_controller_order:
            target_team.batting_controller_order.append(user_id)
        if user_id not in target_team.bowling_controller_order:
            target_team.bowling_controller_order.append(user_id)

        conn = RoomUserConnection(
            user_id=user_id,
            user_name=user_name,
            session_token=session_token,
            role="player",
            team_id=target_team.id,
            is_host=False,
            is_captain=is_captain
        )
        self.connections[user_id] = conn

        participant = RoomParticipant(
            id=user_id,
            name=user_name,
            role=UserRole.PLAYER,
            team_id=target_team.id,
            is_captain=is_captain,
            is_host=False,
            is_ready=False,
            is_connected=True,
            joined_at=time.time()
        )
        self.state.participants[user_id] = participant

        # Keep legacy player_2 fields updated for guest
        if target_team.id == self.state.team_b.id and (self.state.player_2_id is None or self.state.player_2_id == user_id):
            self.state.player_2_id = user_id
            self.state.player_2_name = user_name
            self.state.player_2_team_id = self.state.team_b.id
            self.state.player_2_connected = True
            if not self.state.active_bowling_controller_id:
                self.state.active_bowling_controller_id = user_id

        return True, "Joined room as player", {
            "role": "player",
            "team_id": target_team.id,
            "is_host": False,
            "is_captain": is_captain
        }

    def join_guest(self, guest_id: str, guest_name: str, session_token: str) -> bool:
        """Legacy helper for backward compatibility."""
        ok, _, _ = self.join_user(guest_id, guest_name, session_token, role="player", requested_team_id=self.state.team_b.id)
        return ok

    def get_connection(self, user_id: str) -> Optional[RoomUserConnection]:
        return self.connections.get(user_id)

    def get_player(self, player_id: str) -> Optional[RoomUserConnection]:
        return self.connections.get(player_id)

    def get_opponent(self, player_id: str) -> Optional[RoomUserConnection]:
        conn = self.connections.get(player_id)
        if not conn or not conn.team_id:
            # For spectators, default to player_1 or player_2
            return self.player_2 if player_id == self.state.player_1_id else self.player_1
        
        opp_team_id = self.state.team_b.id if conn.team_id == self.state.team_a.id else self.state.team_a.id
        # Find active controller of opp team, or first player
        for c in self.connections.values():
            if c.team_id == opp_team_id and c.is_connected:
                return c
        return None

    def assign_player_team(self, user_id: str, target_team_id: str) -> Tuple[bool, str]:
        conn = self.connections.get(user_id)
        if not conn or conn.role != "player":
            return False, "User is not a playing participant."
        
        if conn.team_id == target_team_id:
            return True, "Already in target team"

        target_team = self.state.team_a if target_team_id == self.state.team_a.id else self.state.team_b
        curr_team = self.state.team_b if target_team_id == self.state.team_a.id else self.state.team_a

        if len(target_team.human_player_ids) >= self.state.rules.players_per_team:
            return False, f"Target team has reached maximum player capacity ({self.state.rules.players_per_team})."

        # Move player
        if user_id in curr_team.human_player_ids:
            curr_team.human_player_ids.remove(user_id)
        if user_id in curr_team.batting_controller_order:
            curr_team.batting_controller_order.remove(user_id)
        if user_id in curr_team.bowling_controller_order:
            curr_team.bowling_controller_order.remove(user_id)
        if curr_team.captain_id == user_id:
            curr_team.captain_id = curr_team.human_player_ids[0] if curr_team.human_player_ids else None

        target_team.human_player_ids.append(user_id)
        target_team.batting_controller_order.append(user_id)
        target_team.bowling_controller_order.append(user_id)
        if not target_team.captain_id:
            target_team.captain_id = user_id

        conn.team_id = target_team.id
        conn.is_captain = (target_team.captain_id == user_id)
        if user_id in self.state.participants:
            self.state.participants[user_id].team_id = target_team.id
            self.state.participants[user_id].is_captain = conn.is_captain

        return True, f"Assigned to {target_team.name}"

    def assign_captain(self, user_id: str, team_id: str) -> Tuple[bool, str]:
        team = self.state.team_a if team_id == self.state.team_a.id else self.state.team_b
        if user_id not in team.human_player_ids:
            return False, "Player is not on this team."
        
        team.captain_id = user_id
        for p_id in team.human_player_ids:
            c = self.connections.get(p_id)
            if c:
                c.is_captain = (p_id == user_id)
            if p_id in self.state.participants:
                self.state.participants[p_id].is_captain = (p_id == user_id)

        return True, f"Captain assigned for {team.name}"

    def update_team_rotation(
        self, team_id: str, batting_order: List[str], bowling_order: List[str]
    ) -> Tuple[bool, str]:
        team = self.state.team_a if team_id == self.state.team_a.id else self.state.team_b
        # Validate that all IDs in orders are members of this team
        valid_members = set(team.human_player_ids)
        if not all(uid in valid_members for uid in batting_order):
            return False, "Batting rotation contains non-team members"
        if not all(uid in valid_members for uid in bowling_order):
            return False, "Bowling rotation contains non-team members"

        if batting_order:
            team.batting_controller_order = batting_order
        if bowling_order:
            team.bowling_controller_order = bowling_order

        # Recalculate controllers
        HandCricketEngine.update_active_controllers(self.state)
        return True, "Rotation order updated"

    def set_manual_controller(self, role: str, controller_id: str) -> Tuple[bool, str]:
        """Captain sets manual controller for upcoming over."""
        innings = HandCricketEngine.get_current_innings(self.state)
        if not innings:
            return False, "No active innings"
        batting_team, bowling_team = HandCricketEngine.get_batting_and_bowling_teams(self.state, innings)

        if role == "batting":
            if controller_id not in batting_team.human_player_ids:
                return False, "Selected controller is not a batting team member"
            self.state.active_batting_controller_id = controller_id
        elif role == "bowling":
            if controller_id not in bowling_team.human_player_ids:
                return False, "Selected controller is not a bowling team member"
            self.state.active_bowling_controller_id = controller_id
        else:
            return False, "Invalid role (must be batting or bowling)"

        return True, f"Manual {role} controller set to {controller_id}"


    def touch(self):
        self.last_activity = time.time()


class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, MatchRoom] = {}

    def generate_room_code(self) -> str:
        chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        for _ in range(100):
            code = "".join(random.choices(chars, k=6))
            if code not in self.rooms:
                return code
        return f"CRIC{random.randint(10, 99)}"

    def create_room(self, host_id: str, host_name: str, session_token: str) -> MatchRoom:
        code = self.generate_room_code()
        room = MatchRoom(code, host_id, host_name, session_token)
        self.rooms[code] = room
        return room

    def get_room(self, room_code: str) -> Optional[MatchRoom]:
        if not room_code:
            return None
        return self.rooms.get(room_code.strip().upper())

    def cleanup_inactive_rooms(self, max_idle_seconds: float = 14400.0) -> int:
        """
        Cleans up rooms that have had no connected clients and no activity for max_idle_seconds.
        Default: 4 hours of complete inactivity.
        """
        now = time.time()
        to_delete = []
        for code, room in self.rooms.items():
            has_connected = any(c.is_connected for c in room.connections.values())
            has_recent_participants = len(room.connections) > 0 and (now - room.created_at < 300.0)
            if not has_connected and not has_recent_participants and (now - room.last_activity > max_idle_seconds):
                to_delete.append(code)
        for code in to_delete:
            del self.rooms[code]
        return len(to_delete)

    def get_metrics(self) -> Dict[str, Any]:
        """Returns live multi-room operational metrics."""
        total_rooms = len(self.rooms)
        active_ws = sum(
            sum(1 for c in r.connections.values() if c.is_connected)
            for r in self.rooms.values()
        )
        total_players = sum(
            sum(1 for c in r.connections.values() if c.role == "player" and c.is_connected)
            for r in self.rooms.values()
        )
        total_spectators = sum(r.state.spectator_count for r in self.rooms.values())
        return {
            "active_rooms": total_rooms,
            "connected_clients": active_ws,
            "connected_players": total_players,
            "spectators": total_spectators,
            "rooms": [
                {
                    "code": r.room_code,
                    "phase": r.state.phase,
                    "connected": sum(1 for c in r.connections.values() if c.is_connected),
                    "spectators": r.state.spectator_count,
                    "idle_seconds": int(time.time() - r.last_activity)
                }
                for r in list(self.rooms.values())[:50]
            ]
        }

    async def broadcast_to_room(
        self,
        room: MatchRoom,
        message: Dict[str, Any],
        channel: str = "all",
        team_id: Optional[str] = None
    ):
        """Broadcasts a message to all connected clients or filtered by channel."""
        tasks = []
        for conn in room.connections.values():
            if not conn.websocket or not conn.is_connected:
                continue
            if channel == "team" and team_id and conn.team_id != team_id:
                continue
            if channel == "spectator" and conn.role != "spectator":
                continue
            tasks.append(conn.websocket.send_json(message))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def send_to_user(self, user_conn: RoomUserConnection, message: Dict[str, Any]):
        if user_conn.websocket and user_conn.is_connected:
            try:
                await user_conn.websocket.send_json(message)
            except Exception:
                user_conn.is_connected = False

    async def send_to_player(self, player: RoomUserConnection, message: Dict[str, Any]):
        """Alias for backward compatibility."""
        await self.send_to_user(player, message)

    def sanitize_state_for_player(self, state: MatchState, user_id: str) -> Dict[str, Any]:
        """
        CRITICAL PRIVACY RULE:
        1. NEVER expose any pending secret submission numbers before simultaneous reveal!
        2. Only the active submitter gets their own submitted number.
        3. Spectators and other teammates receive only neutral status flags.
        4. Neither the opponent nor spectators can inspect network payloads to discover hidden numbers.
        """
        raw = state.model_dump()
        raw.pop("pending_submissions", None)

        active_bat_id = state.active_batting_controller_id or state.player_1_id
        active_bowl_id = state.active_bowling_controller_id or state.player_2_id

        is_active_bat = (user_id == active_bat_id)
        is_active_bowl = (user_id == active_bowl_id)
        is_active_ctrl = is_active_bat or is_active_bowl

        # Locked booleans
        has_this_user_locked = (user_id in state.pending_submissions)
        bat_locked = bool(active_bat_id and active_bat_id in state.pending_submissions)
        bowl_locked = bool(active_bowl_id and active_bowl_id in state.pending_submissions)

        if is_active_bat:
            opponent_locked = bowl_locked
        elif is_active_bowl:
            opponent_locked = bat_locked
        else:
            opponent_locked = False

        raw["my_locked"] = has_this_user_locked
        raw["opponent_locked"] = opponent_locked
        raw["active_batting_controller_locked"] = bat_locked
        raw["active_bowling_controller_locked"] = bowl_locked
        raw["both_controllers_locked"] = bool(bat_locked and bowl_locked)

        # Number privacy: ONLY the user who submitted sees their chosen number
        if has_this_user_locked and is_active_ctrl:
            raw["my_chosen_number"] = state.pending_submissions[user_id]
        else:
            raw["my_chosen_number"] = None

        # User role and permissions
        participant = state.participants.get(user_id)
        raw["user_role"] = participant.role if participant else "spectator"
        raw["is_host"] = (user_id == state.host_id or user_id == state.player_1_id)
        raw["is_captain"] = participant.is_captain if participant else False
        raw["is_active_controller"] = is_active_ctrl
        raw["is_active_batting_controller"] = is_active_bat
        raw["is_active_bowling_controller"] = is_active_bowl
        raw["spectator_count"] = state.spectator_count

        return raw

    async def broadcast_to_room(
        self,
        room: MatchRoom,
        message: Dict[str, Any],
        channel: str = "all",
        team_id: Optional[str] = None
    ):
        """
        Broadcasts a message to connected clients, optionally filtered by channel and team.
        """
        tasks = []
        for conn in room.connections.values():
            if not conn.websocket or not conn.is_connected:
                continue
            if channel == "team" and team_id and conn.team_id != team_id:
                continue
            if channel == "spectator" and conn.role != "spectator":
                continue
            tasks.append(conn.websocket.send_json(message))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def broadcast_state_to_all(
        self,
        room: MatchRoom,
        event_type: str = "STATE_UPDATE",
        extra: Optional[Dict[str, Any]] = None
    ):
        """
        Sends state update to every connected participant and spectator,
        ensuring each client receives an individually sanitized payload with
        strict privacy isolation.
        """
        tasks = []
        for conn in room.connections.values():
            if not conn.websocket or not conn.is_connected:
                continue
            payload = {
                "type": event_type,
                "state": self.sanitize_state_for_player(room.state, conn.user_id)
            }
            if extra:
                payload.update(extra)
            tasks.append(conn.websocket.send_json(payload))
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    async def handle_delivery_submission(
        self, room: MatchRoom, player_id: str, delivery_id: str, chosen_number: int
    ):
        """
        Handles secret choice submission.
        1. Validates active controller permission on server.
        2. Records secret number securely.
        3. Acknowledges submitter privately.
        4. Notifies opponent & spectators neutrally (NO numbers!).
        5. If both locked -> resolves simultaneously and broadcasts reveal!
        """
        state = room.state
        ok, msg = HandCricketEngine.record_secret_submission(
            state, player_id, delivery_id, chosen_number
        )
        submitting_user = room.get_connection(player_id)

        if not ok:
            if submitting_user:
                await self.send_to_user(submitting_user, {
                    "type": "SUBMISSION_ERROR",
                    "delivery_id": delivery_id,
                    "message": msg
                })
            return

        # 1. Private acknowledgement to submitter
        if submitting_user:
            await self.send_to_user(submitting_user, {
                "type": "SECRET_LOCKED",
                "delivery_id": delivery_id,
                "chosen_number": chosen_number
            })

        # 2. Determine active controllers
        active_bat = state.active_batting_controller_id or state.player_1_id
        active_bowl = state.active_bowling_controller_id or state.player_2_id

        other_controller_id = active_bowl if player_id == active_bat else active_bat
        other_controller = room.get_connection(other_controller_id)

        # 3. Notify other active controller neutrally (OPPONENT_LOCKED)
        if other_controller and other_controller.is_connected:
            await self.send_to_user(other_controller, {
                "type": "OPPONENT_LOCKED",
                "delivery_id": delivery_id
            })

        # 4. Notify all teammates & spectators neutrally (NO numbers broadcast)
        for conn in room.connections.values():
            if conn.user_id not in [player_id, other_controller_id] and conn.is_connected:
                await self.send_to_user(conn, {
                    "type": "CONTROLLER_LOCKED",
                    "delivery_id": delivery_id,
                    "role": "batting" if player_id == active_bat else "bowling",
                    "controller_id": player_id
                })

        # 5. Check if both active controllers have submitted
        if HandCricketEngine.are_both_submissions_ready(state):
            delivery_res = HandCricketEngine.resolve_delivery(state)
            if delivery_res:
                commentary_dict = commentary_service.generate_delivery_commentary(
                    state=state,
                    delivery=delivery_res
                )
                delivery_res.commentary_text = commentary_dict

                # Broadcast simultaneous reveal with numbers and updated score to ALL
                await self.broadcast_to_room(room, {
                    "type": "SIMULTANEOUS_REVEAL",
                    "delivery_result": delivery_res.model_dump(),
                    "state": state.model_dump(exclude={"pending_submissions"}),
                    "commentary": commentary_dict
                })

    async def handle_chat_message(
        self,
        room: MatchRoom,
        sender_id: str,
        channel: str,
        text: str,
        reaction: Optional[str] = None
    ) -> Tuple[bool, str]:
        conn = room.get_connection(sender_id)
        if not conn:
            return False, "User not found"

        # Rate limiting: max 5 messages per 3 seconds
        now = time.time()
        if now - conn.last_chat_time < 3.0:
            conn.chat_count_window += 1
            if conn.chat_count_window > 5:
                return False, "Rate limit exceeded. Please wait a moment."
        else:
            conn.last_chat_time = now
            conn.chat_count_window = 1

        # Text limit
        cleaned_text = (text or "").strip()[:200]
        if not cleaned_text and not reaction:
            return False, "Message is empty"

        chat_msg = ChatMessage(
            id=f"chat_{int(now * 1000)}_{random.randint(100, 999)}",
            sender_id=sender_id,
            sender_name=conn.user_name,
            sender_role=conn.role,
            team_id=conn.team_id,
            channel=channel if channel in ["all", "team", "spectator"] else "all",
            text=cleaned_text,
            reaction=reaction[:8] if reaction else None,
            timestamp=now
        )

        room.state.recent_chats.append(chat_msg)
        if len(room.state.recent_chats) > 50:
            room.state.recent_chats = room.state.recent_chats[-50:]

        # Broadcast based on channel
        if chat_msg.channel == "team" and conn.team_id:
            await self.broadcast_to_room(
                room,
                {"type": "CHAT_MESSAGE", "message": chat_msg.model_dump()},
                channel="team",
                team_id=conn.team_id
            )
        elif chat_msg.channel == "spectator":
            await self.broadcast_to_room(
                room,
                {"type": "CHAT_MESSAGE", "message": chat_msg.model_dump()},
                channel="spectator"
            )
        else:
            await self.broadcast_to_room(
                room,
                {"type": "CHAT_MESSAGE", "message": chat_msg.model_dump()},
                channel="all"
            )

        return True, "Chat sent"

room_manager = RoomManager()
