import logging
from typing import Optional, Dict, Any, List
from .models import BotDifficulty
from .config import bot_settings
from ..database import Profile, AsyncSessionLocal

logger = logging.getLogger("six_fingers.bots.skill")

class PlayerSkillEstimator:
    """
    Evaluates player match statistics to dynamically calibrate the appropriate
    bot opponent difficulty (BEGINNER, INTERMEDIATE, or ADVANCED).
    """

    @classmethod
    def estimate_from_profile(cls, profile: Optional[Profile]) -> BotDifficulty:
        """
        Determines the appropriate difficulty band given a player's profile stats.
        """
        # 1. Config override takes precedence (useful for testing and ops)
        if bot_settings.difficulty_override:
            try:
                return BotDifficulty(bot_settings.difficulty_override.upper())
            except ValueError:
                pass

        # 2. Safe handling of missing or anonymous profile -> provisional beginner
        if not profile:
            return BotDifficulty.BEGINNER

        total_matches = getattr(profile, "total_matches", 0) or 0
        matches_won = getattr(profile, "matches_won", 0) or 0
        total_runs = getattr(profile, "total_runs", 0) or 0
        total_wickets = getattr(profile, "total_wickets", 0) or 0
        current_streak = getattr(profile, "current_streak", 0) or 0

        # 3. New / Provisional Players (< 3 matches)
        if total_matches < 3:
            # Won first 2 matches -> gentle step up to intermediate
            if matches_won >= 2:
                return BotDifficulty.INTERMEDIATE
            return BotDifficulty.BEGINNER

        # 4. Experienced Players (>= 3 matches)
        win_rate = matches_won / total_matches if total_matches > 0 else 0.0
        avg_runs = total_runs / total_matches if total_matches > 0 else 0.0
        avg_wickets = total_wickets / total_matches if total_matches > 0 else 0.0

        # High skill signals:
        # - Win rate >= 65% with at least 5 matches
        # - Active win streak >= 3
        # - Dominant scoring (avg runs >= 22) or bowling (avg wickets >= 2) with win rate >= 55%
        is_elite = (
            (total_matches >= 5 and win_rate >= 0.65)
            or (current_streak >= 3)
            or (win_rate >= 0.55 and (avg_runs >= 22.0 or avg_wickets >= 2.0))
        )
        if is_elite:
            return BotDifficulty.ADVANCED

        # Moderate / Intermediate skill signals:
        # - Win rate >= 35% or solid experience (>= 5 matches)
        is_intermediate = (
            win_rate >= 0.35
            or total_matches >= 5
            or avg_runs >= 12.0
            or matches_won >= 1
        )
        if is_intermediate:
            return BotDifficulty.INTERMEDIATE

        # Default / Beginner band:
        return BotDifficulty.BEGINNER

    @classmethod
    async def estimate_for_user(cls, user_id: Optional[str]) -> BotDifficulty:
        """
        Asynchronously loads the user's profile from the database and derives the skill rating.
        """
        if not user_id:
            return BotDifficulty.BEGINNER

        try:
            async with AsyncSessionLocal() as session:
                profile = await session.get(Profile, user_id)
                return cls.estimate_from_profile(profile)
        except Exception as err:
            logger.warning(f"Error fetching profile for skill estimation ({user_id}): {err}. Defaulting to BEGINNER.")
            return BotDifficulty.BEGINNER
