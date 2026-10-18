import os
from typing import Optional

class BotSettings:
    """
    Centralized configuration settings for Six Fingers Adaptive Bot Matchmaking.
    All parameters are configurable via environment variables with safe defaults.
    """
    def __init__(self):
        self.enabled: bool = os.getenv("BOT_MATCHMAKING_ENABLED", "true").lower() in ("true", "1", "yes")
        self.wait_threshold_seconds: float = float(os.getenv("BOT_WAIT_THRESHOLD_SECONDS", "15.0"))
        self.max_concurrent_matches: int = int(os.getenv("BOT_MAX_CONCURRENT_MATCHES", "20"))
        self.decision_delay_min: float = float(os.getenv("BOT_DECISION_DELAY_MIN", "1.2"))
        self.decision_delay_max: float = float(os.getenv("BOT_DECISION_DELAY_MAX", "2.5"))
        self.difficulty_override: Optional[str] = os.getenv("BOT_DIFFICULTY_OVERRIDE", None)

    def reload_from_env(self):
        self.enabled = os.getenv("BOT_MATCHMAKING_ENABLED", "true").lower() in ("true", "1", "yes")
        self.wait_threshold_seconds = float(os.getenv("BOT_WAIT_THRESHOLD_SECONDS", "15.0"))
        self.max_concurrent_matches = int(os.getenv("BOT_MAX_CONCURRENT_MATCHES", "20"))
        self.decision_delay_min = float(os.getenv("BOT_DECISION_DELAY_MIN", "1.2"))
        self.decision_delay_max = float(os.getenv("BOT_DECISION_DELAY_MAX", "2.5"))
        self.difficulty_override = os.getenv("BOT_DIFFICULTY_OVERRIDE", None)

bot_settings = BotSettings()
