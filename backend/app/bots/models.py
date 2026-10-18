from enum import Enum
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field

class BotDifficulty(str, Enum):
    BEGINNER = "BEGINNER"
    INTERMEDIATE = "INTERMEDIATE"
    ADVANCED = "ADVANCED"

class BotProfile(BaseModel):
    bot_id: str
    user_id: str
    display_name: str
    gamer_tag: str
    avatar_url: str
    team_name: str
    batting_style: str
    bowling_style: str
    personality: str
    base_difficulty: BotDifficulty
    is_available: bool = True
    current_room_code: Optional[str] = None

    def to_opponent_dict(self, assigned_difficulty: Optional[BotDifficulty] = None) -> Dict[str, Any]:
        """Formats the bot's identity for the frontend match payload."""
        diff = assigned_difficulty.value if assigned_difficulty else self.base_difficulty.value
        return {
            "user_id": self.user_id,
            "display_name": self.display_name,
            "gamer_tag": self.gamer_tag,
            "avatar_url": self.avatar_url,
            "team_name": self.team_name,
            "batting_style": self.batting_style,
            "bowling_style": self.bowling_style,
            "is_bot": True,
            "bot_difficulty": diff
        }

# Curated pool of 8 distinct bot personas with realistic cricket handles, teams, and styles
PREDEFINED_BOTS: List[BotProfile] = [
    BotProfile(
        bot_id="bot_arjun_viper",
        user_id="bot_arjun_viper",
        display_name="Arjun 'Viper' Rao",
        gamer_tag="viper_bot#1001",
        avatar_url="avatar_5",
        team_name="Viper Strikers",
        batting_style="Right-handed",
        bowling_style="Right-arm leg-spin",
        personality="Attacking leg-spinner who builds pressure with tactical spin variations",
        base_difficulty=BotDifficulty.INTERMEDIATE
    ),
    BotProfile(
        bot_id="bot_zara_lightning",
        user_id="bot_zara_lightning",
        display_name="Zara 'Lightning' Khan",
        gamer_tag="zara_speed#2002",
        avatar_url="avatar_3",
        team_name="Delhi Dynamos",
        batting_style="Right-handed",
        bowling_style="Right-arm fast",
        personality="Express pace bowler with high-tempo deliveries and swift counter-attacks",
        base_difficulty=BotDifficulty.ADVANCED
    ),
    BotProfile(
        bot_id="bot_dev_anchor",
        user_id="bot_dev_anchor",
        display_name="Dev 'Anchor' Sharma",
        gamer_tag="dev_anchor#3003",
        avatar_url="avatar_4",
        team_name="Chennai Superstars",
        batting_style="Right-handed",
        bowling_style="Right-arm medium",
        personality="Disciplined, patient anchor who takes minimal risks and accumulates steady singles",
        base_difficulty=BotDifficulty.BEGINNER
    ),
    BotProfile(
        bot_id="bot_marcus_titan",
        user_id="bot_marcus_titan",
        display_name="Marcus 'Titan' Steel",
        gamer_tag="titan_marcus#4004",
        avatar_url="avatar_6",
        team_name="Bangalore Strikers",
        batting_style="Right-handed",
        bowling_style="Left-arm fast",
        personality="Power-hitter with heavy deliveries who looks to hit the boundary early",
        base_difficulty=BotDifficulty.INTERMEDIATE
    ),
    BotProfile(
        bot_id="bot_kabir_spin",
        user_id="bot_kabir_spin",
        display_name="Kabir 'SpinMaster' Joshi",
        gamer_tag="spin_kabir#5005",
        avatar_url="avatar_2",
        team_name="Mumbai Blasters",
        batting_style="Left-handed",
        bowling_style="Right-arm off-spin",
        personality="Astute off-spinner who reads pitch dynamics and varies delivery pace",
        base_difficulty=BotDifficulty.ADVANCED
    ),
    BotProfile(
        bot_id="bot_rohan_phoenix",
        user_id="bot_rohan_phoenix",
        display_name="Rohan 'Phoenix' Verma",
        gamer_tag="phoenix_rohan#7007",
        avatar_url="avatar_7",
        team_name="Kolkata Knights",
        batting_style="Left-handed",
        bowling_style="Left-arm orthodox spin",
        personality="Resilient middle-order finisher who accelerates during late-innings chases",
        base_difficulty=BotDifficulty.INTERMEDIATE
    ),
    BotProfile(
        bot_id="bot_tanya_crown",
        user_id="bot_tanya_crown",
        display_name="Tanya 'Crown' Malhotra",
        gamer_tag="tanya_crown#8008",
        avatar_url="avatar_8",
        team_name="Punjab Kings",
        batting_style="Right-handed",
        bowling_style="Left-arm wrist spin",
        personality="Versatile all-rounder who balances aggressive boundary hitting with clever spin",
        base_difficulty=BotDifficulty.ADVANCED
    ),
    BotProfile(
        bot_id="bot_sam_cyber",
        user_id="bot_sam_cyber",
        display_name="Sam 'Cyber' Patel",
        gamer_tag="cyber_sam#9009",
        avatar_url="avatar_1",
        team_name="Gujarat Titans",
        batting_style="Right-handed",
        bowling_style="Right-arm medium",
        personality="Balanced beginner-friendly opponent with consistent, readable delivery patterns",
        base_difficulty=BotDifficulty.BEGINNER
    )
]
