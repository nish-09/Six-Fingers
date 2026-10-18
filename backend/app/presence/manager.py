import time
import asyncio
from typing import Dict, Set, Optional, Any, List
from fastapi import WebSocket
from sqlalchemy import select, or_, and_

from ..database import AsyncSessionLocal, Friendship, Profile, User

class PresenceState:
    ONLINE = "ONLINE"
    IN_LOBBY = "IN_LOBBY"
    IN_MATCH = "IN_MATCH"
    SPECTATING = "SPECTATING"
    OFFLINE = "OFFLINE"

class UserPresence:
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.state: str = PresenceState.OFFLINE
        self.activity: str = "Offline"
        self.room_code: Optional[str] = None
        self.last_seen: float = time.time()
        self.sessions: Dict[str, WebSocket] = {} # session_id -> ws

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "state": self.state,
            "activity": self.activity,
            "room_code": self.room_code,
            "last_seen": self.last_seen,
            "is_online": self.state != PresenceState.OFFLINE
        }

class PresenceManager:
    def __init__(self):
        # user_id -> UserPresence
        self.users: Dict[str, UserPresence] = {}
        self._lock = asyncio.Lock()

    def get_or_create(self, user_id: str) -> UserPresence:
        if user_id not in self.users:
            self.users[user_id] = UserPresence(user_id)
        return self.users[user_id]

    async def get_user_friend_ids(self, user_id: str) -> List[str]:
        """Fetch accepted friends for a user from database."""
        async with AsyncSessionLocal() as session:
            query = select(Friendship).where(
                and_(
                    or_(Friendship.requester_id == user_id, Friendship.addressee_id == user_id),
                    Friendship.status == "ACCEPTED"
                )
            )
            res = await session.execute(query)
            friendships = res.scalars().all()
            friend_ids = []
            for f in friendships:
                friend_id = f.addressee_id if f.requester_id == user_id else f.requester_id
                friend_ids.append(friend_id)
            return friend_ids

    async def connect_user(self, user_id: str, session_id: str, websocket: WebSocket):
        async with self._lock:
            p = self.get_or_create(user_id)
            p.sessions[session_id] = websocket
            p.last_seen = time.time()
            # If transitioning from OFFLINE to ONLINE
            if p.state == PresenceState.OFFLINE:
                p.state = PresenceState.ONLINE
                p.activity = "Online · Available to play"

        # Broadcast state change to friends
        await self.broadcast_to_friends(user_id)

    async def disconnect_user(self, user_id: str, session_id: str):
        should_broadcast = False
        async with self._lock:
            if user_id in self.users:
                p = self.users[user_id]
                p.sessions.pop(session_id, None)
                p.last_seen = time.time()
                if len(p.sessions) == 0:
                    p.state = PresenceState.OFFLINE
                    p.activity = "Offline"
                    p.room_code = None
                    should_broadcast = True

        if should_broadcast:
            await self.broadcast_to_friends(user_id)

    async def set_user_activity(
        self,
        user_id: str,
        state: str,
        activity: str,
        room_code: Optional[str] = None
    ):
        async with self._lock:
            p = self.get_or_create(user_id)
            p.state = state
            p.activity = activity
            p.room_code = room_code
            p.last_seen = time.time()

        await self.broadcast_to_friends(user_id)

    async def broadcast_to_friends(self, user_id: str):
        """Notify all online friends of user_id about their presence change."""
        p = self.users.get(user_id)
        if not p:
            return

        presence_data = p.to_dict()
        message = {
            "type": "FRIEND_PRESENCE_UPDATE",
            "presence": presence_data
        }

        friend_ids = await self.get_user_friend_ids(user_id)
        for f_id in friend_ids:
            if f_id in self.users:
                f_presence = self.users[f_id]
                for s_id, ws in list(f_presence.sessions.items()):
                    try:
                        await ws.send_json(message)
                    except Exception:
                        pass

    async def get_friends_presence(self, user_id: str) -> List[Dict[str, Any]]:
        friend_ids = await self.get_user_friend_ids(user_id)
        results = []
        for f_id in friend_ids:
            if f_id in self.users:
                results.append(self.users[f_id].to_dict())
            else:
                results.append({
                    "user_id": f_id,
                    "state": PresenceState.OFFLINE,
                    "activity": "Offline",
                    "room_code": None,
                    "last_seen": 0,
                    "is_online": False
                })
        return results

presence_manager = PresenceManager()
