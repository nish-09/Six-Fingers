import time
import asyncio
import uuid
import logging
from typing import Dict, Optional, List, Any
from ..rooms.manager import room_manager
from ..presence.manager import presence_manager, PresenceState
from ..bots.config import bot_settings
from ..bots.models import BotDifficulty
from ..bots.registry import bot_registry
from ..bots.skill import PlayerSkillEstimator
from ..bots.session import BotGameSession

logger = logging.getLogger("six_fingers.matchmaking.queue")

class MatchmakingTicket:
    def __init__(
        self,
        user_id: str,
        display_name: str,
        gamer_tag: str,
        avatar_url: str
    ):
        self.ticket_id = f"tkt_{uuid.uuid4().hex[:8]}"
        self.user_id = user_id
        self.display_name = display_name
        self.gamer_tag = gamer_tag
        self.avatar_url = avatar_url
        self.joined_at = time.time()
        self.future: asyncio.Future = asyncio.get_event_loop().create_future()
        self.bot_timer_task: Optional[asyncio.Task] = None

class MatchmakingCoordinator:
    def __init__(self):
        self.queue: List[MatchmakingTicket] = []
        self._lock = asyncio.Lock()

    def _pair_human_tickets(self, host_ticket: MatchmakingTicket, guest_ticket: MatchmakingTicket):
        """Pairs two real players and sets their future results."""
        if host_ticket.bot_timer_task and not host_ticket.bot_timer_task.done():
            host_ticket.bot_timer_task.cancel()
        if guest_ticket.bot_timer_task and not guest_ticket.bot_timer_task.done():
            guest_ticket.bot_timer_task.cancel()

        host_id = f"p_{uuid.uuid4().hex[:8]}"
        guest_id = f"p_{uuid.uuid4().hex[:8]}"
        host_tok = f"tok_{uuid.uuid4().hex}"
        guest_tok = f"tok_{uuid.uuid4().hex}"

        room = room_manager.create_room(
            host_id=host_id,
            host_name=host_ticket.display_name,
            session_token=host_tok
        )
        room.state.player_1_user_id = host_ticket.user_id
        room.state.player_2_user_id = guest_ticket.user_id
        room.state.is_bot_match = False

        ok, msg, meta = room.join_user(
            user_id=guest_id,
            user_name=guest_ticket.display_name,
            session_token=guest_tok,
            role="player",
            requested_team_id=room.state.team_b.id
        )

        res_host = {
            "room_code": room.room_code,
            "player_id": host_id,
            "session_token": host_tok,
            "role": "host",
            "team_id": room.state.team_a.id,
            "match_type": "PUBLIC",
            "opponent": {
                "user_id": guest_ticket.user_id,
                "display_name": guest_ticket.display_name,
                "gamer_tag": guest_ticket.gamer_tag,
                "avatar_url": guest_ticket.avatar_url,
                "is_bot": False
            },
            "is_bot_match": False
        }

        res_guest = {
            "room_code": room.room_code,
            "player_id": guest_id,
            "session_token": guest_tok,
            "role": "player",
            "team_id": meta.get("team_id", room.state.team_b.id),
            "match_type": "PUBLIC",
            "opponent": {
                "user_id": host_ticket.user_id,
                "display_name": host_ticket.display_name,
                "gamer_tag": host_ticket.gamer_tag,
                "avatar_url": host_ticket.avatar_url,
                "is_bot": False
            },
            "is_bot_match": False
        }

        host_ticket.future.set_result(res_host)
        guest_ticket.future.set_result(res_guest)

        asyncio.create_task(presence_manager.set_user_activity(
            host_ticket.user_id,
            PresenceState.IN_MATCH,
            "Playing Six Fingers (Quick Play)",
            room.room_code
        ))
        asyncio.create_task(presence_manager.set_user_activity(
            guest_ticket.user_id,
            PresenceState.IN_MATCH,
            "Playing Six Fingers (Quick Play)",
            room.room_code
        ))

    async def _wait_and_match_bot(self, ticket: MatchmakingTicket):
        """Waits for configured threshold and pairs player with an adaptive bot if no human joined."""
        try:
            await asyncio.sleep(bot_settings.wait_threshold_seconds)
        except asyncio.CancelledError:
            return

        async with self._lock:
            # 1. Ticket validation
            if ticket.future.done() or ticket not in self.queue:
                return
            if not bot_settings.enabled:
                return

            # 2. Strict Real Player Priority: Check if another human arrived
            other_human_candidates = [
                t for t in self.queue
                if t.user_id != ticket.user_id and not t.future.done()
            ]
            if other_human_candidates:
                opponent_ticket = other_human_candidates[0]
                self.queue.remove(ticket)
                self.queue.remove(opponent_ticket)
                self._pair_human_tickets(opponent_ticket, ticket)
                return

            # 3. Estimate player skill and acquire bot
            difficulty = await PlayerSkillEstimator.estimate_for_user(ticket.user_id)
            bot_profile = await bot_registry.acquire_bot(difficulty)

            if not bot_profile:
                logger.warning(
                    f"Bot matchmaking capacity reached or no bot available for user {ticket.user_id}. Leaving in queue."
                )
                # Reschedule check in 5 seconds to retry bot acquisition or wait for human
                ticket.bot_timer_task = asyncio.create_task(self._wait_and_match_bot(ticket))
                return

            # 4. Remove ticket from queue atomically
            if ticket in self.queue:
                self.queue.remove(ticket)

            # 5. Create authoritative match room
            try:
                host_id = f"p_{uuid.uuid4().hex[:8]}"
                bot_player_id = f"bot_{uuid.uuid4().hex[:8]}"
                host_tok = f"tok_{uuid.uuid4().hex}"
                bot_tok = f"tok_bot_{uuid.uuid4().hex}"

                room = room_manager.create_room(
                    host_id=host_id,
                    host_name=ticket.display_name,
                    session_token=host_tok
                )

                room.state.player_1_user_id = ticket.user_id
                room.state.player_2_user_id = bot_profile.user_id
                room.state.is_bot_match = True
                room.state.bot_difficulty = difficulty.value

                # Join bot as player on team B
                ok, msg, meta = room.join_user(
                    user_id=bot_player_id,
                    user_name=bot_profile.display_name,
                    session_token=bot_tok,
                    role="player",
                    requested_team_id=room.state.team_b.id
                )

                # Set bot connection and participant status
                bot_conn = room.get_connection(bot_player_id)
                if bot_conn:
                    bot_conn.is_bot = True
                    bot_conn.is_connected = True

                if bot_player_id in room.state.participants:
                    room.state.participants[bot_player_id].is_ready = True
                    room.state.participants[bot_player_id].is_connected = True
                room.state.player_2_ready = True
                room.state.player_2_connected = True

                if bot_profile.team_name:
                    room.state.team_b.name = bot_profile.team_name

                # Attach active BotGameSession
                bot_session = BotGameSession(
                    room=room,
                    bot_player_id=bot_player_id,
                    bot_profile=bot_profile,
                    difficulty=difficulty
                )
                room.bot_session = bot_session

                res_me = {
                    "room_code": room.room_code,
                    "player_id": host_id,
                    "session_token": host_tok,
                    "role": "host",
                    "team_id": room.state.team_a.id,
                    "match_type": "PUBLIC",
                    "opponent": bot_profile.to_opponent_dict(difficulty),
                    "is_bot_match": True,
                    "bot_difficulty": difficulty.value
                }

                ticket.future.set_result(res_me)

                # Presence updated only for the real human
                asyncio.create_task(presence_manager.set_user_activity(
                    ticket.user_id,
                    PresenceState.IN_MATCH,
                    "Playing Six Fingers (Quick Play)",
                    room.room_code
                ))
                logger.info(
                    f"Bot match created: Room {room.room_code}, User {ticket.user_id} vs Bot {bot_profile.display_name} ({difficulty.value})"
                )

            except Exception as e:
                logger.error(f"Failed to initialize bot match for ticket {ticket.ticket_id}: {e}")
                await bot_registry.release_bot(bot_profile.bot_id)
                if not ticket.future.done():
                    ticket.future.set_exception(e)

    async def enqueue(
        self,
        user_id: str,
        display_name: str,
        gamer_tag: str,
        avatar_url: str
    ) -> MatchmakingTicket:
        async with self._lock:
            # 1. Prevent duplicate enqueue
            for t in self.queue:
                if t.user_id == user_id:
                    return t

            ticket = MatchmakingTicket(user_id, display_name, gamer_tag, avatar_url)

            # 2. Check for an eligible real-player opponent waiting
            if len(self.queue) > 0:
                opponent_ticket = self.queue.pop(0)

                # Purge any cancelled tickets
                while opponent_ticket.future.done() and len(self.queue) > 0:
                    opponent_ticket = self.queue.pop(0)

                if not opponent_ticket.future.done():
                    self._pair_human_tickets(opponent_ticket, ticket)
                    return ticket

            # 3. No opponent yet, add to queue
            self.queue.append(ticket)
            asyncio.create_task(presence_manager.set_user_activity(
                user_id,
                PresenceState.IN_LOBBY,
                "In Matchmaking Queue",
                None
            ))

            # 4. Schedule server-controlled bot matchmaking timeout if enabled
            if bot_settings.enabled:
                ticket.bot_timer_task = asyncio.create_task(self._wait_and_match_bot(ticket))

            return ticket

    async def dequeue(self, user_id: str) -> bool:
        async with self._lock:
            for i, t in enumerate(self.queue):
                if t.user_id == user_id:
                    self.queue.pop(i)
                    if t.bot_timer_task and not t.bot_timer_task.done():
                        t.bot_timer_task.cancel()
                    if not t.future.done():
                        t.future.cancel()
                    asyncio.create_task(presence_manager.set_user_activity(
                        user_id,
                        PresenceState.ONLINE,
                        "Online · Available to play",
                        None
                    ))
                    return True
        return False

    def get_queue_size(self) -> int:
        return len(self.queue)

    async def reset_for_testing(self):
        """Cleans up all queue tickets and cancels bot tasks (used by test suite)."""
        async with self._lock:
            for t in self.queue:
                if t.bot_timer_task and not t.bot_timer_task.done():
                    t.bot_timer_task.cancel()
                if not t.future.done():
                    t.future.cancel()
            self.queue.clear()

matchmaking_coordinator = MatchmakingCoordinator()
