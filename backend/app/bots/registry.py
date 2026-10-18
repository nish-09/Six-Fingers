import asyncio
import copy
import uuid
import logging
from typing import Dict, List, Optional, Any
from .models import BotProfile, BotDifficulty, PREDEFINED_BOTS
from .config import bot_settings

logger = logging.getLogger("six_fingers.bots.registry")

class BotRegistry:
    """
    Thread-safe registry for managing the lifecycle, availability, and match assignments
    of server-side bot opponents.
    """
    def __init__(self):
        self._lock = asyncio.Lock()
        # Keyed by bot_id
        self._pool: Dict[str, BotProfile] = {
            bot.bot_id: copy.deepcopy(bot) for bot in PREDEFINED_BOTS
        }
        # Dynamic clones generated when pool capacity is exceeded (up to max_concurrent_matches)
        self._clones: Dict[str, BotProfile] = {}
        # Tracks active assignments: bot_id -> room_code
        self._active_assignments: Dict[str, str] = {}

    async def acquire_bot(
        self,
        target_difficulty: BotDifficulty,
        room_code: Optional[str] = None
    ) -> Optional[BotProfile]:
        """
        Atomically selects and claims an available bot opponent.
        Respects max_concurrent_matches limit.
        Prefers bots matching the target difficulty.
        """
        async with self._lock:
            total_active = len(self._active_assignments)
            if total_active >= bot_settings.max_concurrent_matches:
                logger.warning(
                    f"Bot matchmaking capacity reached ({total_active}/{bot_settings.max_concurrent_matches}). Cannot allocate bot."
                )
                return None

            # 1. Look for an available bot with matching base difficulty
            candidates = [
                b for b in self._pool.values()
                if b.is_available and b.base_difficulty == target_difficulty
            ]

            # 2. If no exact difficulty match, pick any available predefined bot
            if not candidates:
                candidates = [b for b in self._pool.values() if b.is_available]

            if candidates:
                chosen = candidates[0]
                chosen.is_available = False
                chosen.current_room_code = room_code
                self._active_assignments[chosen.bot_id] = room_code or ""
                return chosen

            # 3. If all predefined bots are occupied, create an isolated dynamic instance (up to limit)
            template = list(self._pool.values())[total_active % len(self._pool)]
            clone_id = f"{template.bot_id}_inst_{uuid.uuid4().hex[:6]}"
            clone = BotProfile(
                bot_id=clone_id,
                user_id=clone_id,
                display_name=template.display_name,
                gamer_tag=f"{template.gamer_tag.split('#')[0]}#{uuid.uuid4().hex[:4].upper()}",
                avatar_url=template.avatar_url,
                team_name=template.team_name,
                batting_style=template.batting_style,
                bowling_style=template.bowling_style,
                personality=template.personality,
                base_difficulty=target_difficulty,
                is_available=False,
                current_room_code=room_code
            )
            self._clones[clone_id] = clone
            self._active_assignments[clone_id] = room_code or ""
            return clone

    async def release_bot(self, bot_id: str, room_code: Optional[str] = None) -> bool:
        """
        Releases a bot assignment and returns it to the available pool.
        """
        async with self._lock:
            # Check if this assignment exists
            if bot_id in self._active_assignments:
                del self._active_assignments[bot_id]

            if bot_id in self._pool:
                self._pool[bot_id].is_available = True
                self._pool[bot_id].current_room_code = None
                return True
            elif bot_id in self._clones:
                # Remove dynamic clone instance
                del self._clones[bot_id]
                return True
            return False

    async def is_bot_available(self, bot_id: str) -> bool:
        async with self._lock:
            if bot_id in self._pool:
                return self._pool[bot_id].is_available
            return False

    async def get_active_bot_count(self) -> int:
        async with self._lock:
            return len(self._active_assignments)

    async def get_metrics(self) -> Dict[str, Any]:
        async with self._lock:
            return {
                "total_predefined": len(self._pool),
                "active_clones": len(self._clones),
                "active_matches": len(self._active_assignments),
                "max_allowed": bot_settings.max_concurrent_matches,
                "assignments": dict(self._active_assignments)
            }

    async def reset_for_testing(self):
        """Resets all bot statuses and assignments (used by test suites)."""
        async with self._lock:
            self._pool = {
                bot.bot_id: copy.deepcopy(bot) for bot in PREDEFINED_BOTS
            }
            self._clones.clear()
            self._active_assignments.clear()

bot_registry = BotRegistry()
