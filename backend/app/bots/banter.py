import time
import random
from typing import Optional, Dict, Any, List
from ..models.game import MatchState, DeliveryResult
from .models import BotProfile

class BotPersonalityStyle:
    FRIENDLY = "friendly"
    CONFIDENT = "confident"
    STREET_CRICKET = "street"
    TACTICAL = "tactical"

# Curated pools of contextual cricket banter messages (Hinglish + English)
BANTER_POOLS = {
    "player_hit_six": [
        "Arre bhai, ball ko stadium ke bahar hi bhej diya! 🚀",
        "Achha shot tha boss! Par agla ball wicket hai, dekh lena! 😉",
        "Ek six se kya hoga boss? Consistency dikhao! 🏏",
        "Whoa! Clean hit over the ropes! Respect boss! 🔥",
        "Power shot! Par fielding ab tight hone wali hai! 🎯",
        "Kamaal ka timing tha! Ab dekho meri agli delivery! ⚡",
        "Bhai stadium ki light todoge kya? What a hit! 💥",
    ],
    "player_hit_four": [
        "Khubsurat timing! Fielder sirf dekhte reh gaya! ⚡",
        "Gap mein nikaal diya! Class batsman lagte ho boss! 👏",
        "Four runs! Bullet ki tarah boundary paar! 🏏",
        "Nice shot yaar, perfect placement through the covers! 👌",
        "Chauka lag gaya! Ab thoda pace badhana padega! 🎯",
    ],
    "player_out": [
        "Arre wah, seedha pavilion! ☝️ Out ho gaye boss!",
        "Bhai, timing thodi jaldi ho gayi! Pavilion ka raasta pakdo! 🏏",
        "Finger match ho gayi boss! Game over for the striker! ☝️",
        "Clean catch! That was the setup delivery, trapped! 🎯",
        "Chalo, ab meri batting ka time! Mast wicket tha! 😎",
        "Got him! Pressure banaya aur wicket mil gaya! ☝️",
    ],
    "bot_hit_six": [
        "YEH GAYA! Seedha stands mein! 6 runs! 🚀",
        "Bhai, ball dhoondte reh jaoge! Kya timing tha! 💥",
        "Aaj toh batting ka full mood hai! That is a maximum! 🔥",
        "Out of the ground! Clean strike over long-on! 🏏",
        "Shot of the day boss! Kaisi lagi delivery? 😎",
    ],
    "bot_hit_four": [
        "Gap dhoondh ke maara hai! Four runs! ⚡",
        "Boundary rope ko salute! Sweet sound off the hand! 🏏",
        "Fielding thodi aur tight karni padegi boss! 4 runs! 😉",
        "Pierced the gap with pure precision! Boundary! 🎯",
    ],
    "bot_out": [
        "Arre yaar! Number match ho gaya! Good bowling boss! 👏",
        "Bhai, ye delivery predictable nahi thi! Well bowled! 🤝",
        "Fair play! Wicket mil gaya tumhe, ab dekhna meri bowling! 🎯",
        "Timing miss ho gayi! Well played on that wicket! 👍",
    ],
    "dot_ball": [
        "Kahan ja rahe ho bhai? Ball toh idhar hai! 🎯",
        "Dot ball! Pressure is building up boss! ⏳",
        "Patience test chal raha hai yahan! No run! 🏏",
        "Beaten completely! Ek dum dot ball! 😎",
        "Good ball, right on the money. Zero runs! 🔒",
    ],
    "player_winning": [
        "Scoreboard dekh raha hoon bhai. Abhi comeback baaki hai! ⚡",
        "Zyada celebrate mat karo boss, match abhi khatam nahi hua! 😉",
        "Achha lead hai tumhara, par last over tak picture badal sakti hai! 🏏",
        "Pressure toh hai, par match jeet ke dikhayenge! 🔥",
    ],
    "bot_winning": [
        "Game control mein hai boss! Match hamari taraf jhuk raha hai! 😎",
        "Pressure feel ho raha hai kya? Keep your cool! 🎯",
        "Consistent play pays off! Focus nahi khona hai! 🏏",
    ],
    "close_finish": [
        "Ab har ball important hai! Nerves of steel chahiye! ⚡",
        "Last few balls! Dil ki dhadkan tez ho gayi hai! 😱",
        "Nail-biting finish! Agli ball match ka momentum badal sakti hai! 🔥",
        "Game abhi baaki hai dosto! Final over thriller! 🏏",
    ],
    "match_start": [
        "Game on boss! Let's see who has the best hand cricket skills! 🏏",
        "Toss ho gaya, ab pitch par baat hogi! Good luck! 🤝",
        "Six Fingers arena mein swagat hai! Let's have a cracking match! ⚡",
    ],
    "match_won_by_player": [
        "Kamaal ka khela bhai! Well deserved victory! Respect! 👏🏆",
        "Superb game! Aaj tumhara din tha, rematch soon! 🤝",
    ],
    "match_won_by_bot": [
        "Great match bhai! Nerves control mein rakhni padti hain! Better luck next time! 🏆",
        "Shandar fight thi! Well played boss, see you in the next match! 🤝",
    ]
}

# Bot-specific banter styles (mapping bot IDs to tone)
BOT_STYLE_MAP = {
    "bot_arjun_viper": BotPersonalityStyle.FRIENDLY,
    "bot_zara_lightning": BotPersonalityStyle.CONFIDENT,
    "bot_dev_anchor": BotPersonalityStyle.TACTICAL,
    "bot_marcus_titan": BotPersonalityStyle.CONFIDENT,
    "bot_kabir_spin": BotPersonalityStyle.STREET_CRICKET,
    "bot_rohan_phoenix": BotPersonalityStyle.TACTICAL,
    "bot_tanya_crown": BotPersonalityStyle.CONFIDENT,
    "bot_sam_cyber": BotPersonalityStyle.FRIENDLY,
}

class BotBanterEngine:
    """
    Context-aware personality engine for cricket bot banter and sledging.
    Evaluates live match context, score pressure, boundaries, wickets, and
    generates authentic Hinglish/English live chat commentary.
    """

    def __init__(self, bot_profile: BotProfile):
        self.bot_profile = bot_profile
        self.style = BOT_STYLE_MAP.get(bot_profile.bot_id, BotPersonalityStyle.FRIENDLY)
        self.last_banter_time = 0.0
        self.min_cooldown_seconds = 4.5
        self.recent_messages: List[str] = []

    def should_trigger_banter(self, event_type: str) -> bool:
        """Determines if the bot should speak on this event with natural probability."""
        now = time.time()
        if now - self.last_banter_time < self.min_cooldown_seconds:
            return False

        # Event probabilities
        probs = {
            "player_hit_six": 0.70,
            "bot_hit_six": 0.75,
            "player_out": 0.80,
            "bot_out": 0.60,
            "player_hit_four": 0.45,
            "bot_hit_four": 0.50,
            "dot_ball": 0.25,
            "close_finish": 0.65,
            "match_start": 0.85,
            "match_end": 0.90,
        }
        chance = probs.get(event_type, 0.35)
        return random.random() < chance

    def generate_banter(
        self,
        event_type: str,
        state: Optional[MatchState] = None,
        delivery: Optional[DeliveryResult] = None
    ) -> Optional[str]:
        """Selects a context-aware line from the message pool, preventing repetition."""
        pool = BANTER_POOLS.get(event_type, [])
        if not pool:
            return None

        # Filter out recently used messages
        candidates = [m for m in pool if m not in self.recent_messages]
        if not candidates:
            candidates = pool

        selected = random.choice(candidates)
        self.recent_messages.append(selected)
        if len(self.recent_messages) > 6:
            self.recent_messages.pop(0)

        self.last_banter_time = time.time()
        return selected

    def evaluate_delivery_event(
        self,
        state: MatchState,
        delivery: DeliveryResult,
        bot_player_id: str
    ) -> Optional[str]:
        """
        Evaluates a completed delivery to determine the most meaningful contextual banter event.
        """
        is_bot_batting = (delivery.batting_controller_id == bot_player_id)
        is_bot_bowling = (delivery.bowling_controller_id == bot_player_id)

        # 1. Wicket event
        if delivery.is_wicket:
            if is_bot_bowling:
                return "player_out"
            else:
                return "bot_out"

        # 2. Six event
        if delivery.runs_scored == 6:
            if is_bot_batting:
                return "bot_hit_six"
            else:
                return "player_hit_six"

        # 3. Four event
        if delivery.runs_scored == 4:
            if is_bot_batting:
                return "bot_hit_four"
            else:
                return "player_hit_four"

        # 4. Close finish detection in 2nd innings
        if state.current_innings_number == 2:
            innings = state.innings_list[1] if len(state.innings_list) > 1 else None
            if innings and innings.target is not None:
                runs_left = max(0, innings.target - innings.total_runs)
                max_balls = state.rules.overs_per_innings * state.rules.balls_per_over
                balls_left = max(0, max_balls - innings.balls_bowled)
                if runs_left <= 8 and balls_left <= 6:
                    return "close_finish"

        # 5. Dot ball event
        if delivery.runs_scored == 0:
            return "dot_ball"

        return None
