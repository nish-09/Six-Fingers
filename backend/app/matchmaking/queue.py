import time
import asyncio
import uuid
from typing import Dict, Optional, List, Any
from ..rooms.manager import room_manager
from ..presence.manager import presence_manager, PresenceState

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

class MatchmakingCoordinator:
    def __init__(self):
        self.queue: List[MatchmakingTicket] = []
        self._lock = asyncio.Lock()

    async def enqueue(
        self,
        user_id: str,
        display_name: str,
        gamer_tag: str,
        avatar_url: str
    ) -> MatchmakingTicket:
        async with self._lock:
            # Check if user already queued
            for t in self.queue:
                if t.user_id == user_id:
                    return t

            ticket = MatchmakingTicket(user_id, display_name, gamer_tag, avatar_url)

            # Check if we have an available opponent waiting
            if len(self.queue) > 0:
                opponent_ticket = self.queue.pop(0)

                # Ensure opponent ticket isn't cancelled
                while opponent_ticket.future.done() and len(self.queue) > 0:
                    opponent_ticket = self.queue.pop(0)

                if not opponent_ticket.future.done():
                    # Match found! Create a public match room
                    host_id = f"p_{uuid.uuid4().hex[:8]}"
                    guest_id = f"p_{uuid.uuid4().hex[:8]}"
                    host_tok = f"tok_{uuid.uuid4().hex}"
                    guest_tok = f"tok_{uuid.uuid4().hex}"

                    room = room_manager.create_room(
                        host_id=host_id,
                        host_name=opponent_ticket.display_name,
                        session_token=host_tok
                    )
                    # Mark room as public match and link user IDs
                    room.state.player_1_user_id = opponent_ticket.user_id
                    room.state.player_2_user_id = ticket.user_id

                    # Join guest
                    ok, msg, meta = room.join_user(
                        user_id=guest_id,
                        user_name=ticket.display_name,
                        session_token=guest_tok,
                        role="player",
                        requested_team_id=room.state.team_b.id
                    )

                    # Opponent result
                    res_opponent = {
                        "room_code": room.room_code,
                        "player_id": host_id,
                        "session_token": host_tok,
                        "role": "host",
                        "team_id": room.state.team_a.id,
                        "match_type": "PUBLIC",
                        "opponent": {
                            "user_id": ticket.user_id,
                            "display_name": ticket.display_name,
                            "gamer_tag": ticket.gamer_tag,
                            "avatar_url": ticket.avatar_url
                        }
                    }

                    # My result
                    res_me = {
                        "room_code": room.room_code,
                        "player_id": guest_id,
                        "session_token": guest_tok,
                        "role": "player",
                        "team_id": meta.get("team_id", room.state.team_b.id),
                        "match_type": "PUBLIC",
                        "opponent": {
                            "user_id": opponent_ticket.user_id,
                            "display_name": opponent_ticket.display_name,
                            "gamer_tag": opponent_ticket.gamer_tag,
                            "avatar_url": opponent_ticket.avatar_url
                        }
                    }

                    opponent_ticket.future.set_result(res_opponent)
                    ticket.future.set_result(res_me)

                    # Update presences
                    asyncio.create_task(presence_manager.set_user_activity(
                        opponent_ticket.user_id,
                        PresenceState.IN_MATCH,
                        "Playing Six Fingers (Quick Play)",
                        room.room_code
                    ))
                    asyncio.create_task(presence_manager.set_user_activity(
                        ticket.user_id,
                        PresenceState.IN_MATCH,
                        "Playing Six Fingers (Quick Play)",
                        room.room_code
                    ))

                    return ticket

            # No opponent yet, add to queue
            self.queue.append(ticket)
            asyncio.create_task(presence_manager.set_user_activity(
                user_id,
                PresenceState.IN_LOBBY,
                "In Matchmaking Queue",
                None
            ))
            return ticket

    async def dequeue(self, user_id: str) -> bool:
        async with self._lock:
            for i, t in enumerate(self.queue):
                if t.user_id == user_id:
                    self.queue.pop(i)
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

matchmaking_coordinator = MatchmakingCoordinator()
