import random
from typing import Optional, List, Dict, Tuple
from .models import BotDifficulty
from ..models.game import MatchState, MatchPhase, InningsScorecard, DeliveryResult
from ..engine.hand_cricket import HandCricketEngine

class BotDecisionEngine:
    """
    Authoritative decision engine for Hand Cricket bots.
    Calculates tactical batting and bowling decisions for each difficulty band
    using legitimately available game context without ever accessing unrevealed
    player inputs.
    """

    @classmethod
    def decide_action(
        cls,
        state: MatchState,
        bot_controller_id: str,
        difficulty: BotDifficulty,
        random_seed: Optional[int] = None
    ) -> int:
        rng = random.Random(random_seed) if random_seed is not None else random

        allowed = state.rules.allowed_numbers if state.rules and state.rules.allowed_numbers else [1, 2, 3, 4, 5, 6]
        innings = HandCricketEngine.get_current_innings(state)

        if not innings:
            return rng.choice(allowed)

        # Determine if bot is batting or bowling
        active_bat = state.active_batting_controller_id or (
            state.player_1_id if state.player_1_team_id == innings.batting_team_id else (state.player_2_id or state.player_1_id)
        )
        is_batting = (bot_controller_id == active_bat)

        if is_batting:
            return cls._decide_batting(state, innings, allowed, difficulty, rng)
        else:
            return cls._decide_bowling(state, innings, allowed, difficulty, rng)

    @classmethod
    def _decide_batting(
        cls,
        state: MatchState,
        innings: InningsScorecard,
        allowed: List[int],
        difficulty: BotDifficulty,
        rng: random.Random
    ) -> int:
        balls_in_innings = state.rules.overs_per_innings * state.rules.balls_per_over
        balls_left = max(0, balls_in_innings - innings.balls_bowled)
        wickets_left = max(1, state.rules.wickets_per_innings - innings.wickets)
        past_deliveries = innings.deliveries

        # ----------------------------------------------------
        # 1. BEGINNER BATTING: Conservative, steady, readable
        # ----------------------------------------------------
        if difficulty == BotDifficulty.BEGINNER:
            # Heavily favors safe singles/twos, rarely takes huge risks
            weights = {1: 0.28, 2: 0.28, 3: 0.20, 4: 0.12, 5: 0.04, 6: 0.08}
            return cls._weighted_choice(allowed, weights, rng)

        # ----------------------------------------------------
        # 2. INTERMEDIATE BATTING: Situational risk management
        # ----------------------------------------------------
        if difficulty == BotDifficulty.INTERMEDIATE:
            # Chasing in 2nd Innings
            if innings.target is not None:
                runs_needed = max(0, innings.target - innings.total_runs)
                # Very close to victory (1-3 runs needed) -> Play safe!
                if runs_needed <= 2:
                    weights = {1: 0.50, 2: 0.35, 3: 0.10, 4: 0.03, 5: 0.01, 6: 0.01}
                    return cls._weighted_choice(allowed, weights, rng)
                elif runs_needed <= 4:
                    weights = {1: 0.30, 2: 0.35, 3: 0.20, 4: 0.10, 5: 0.02, 6: 0.03}
                    return cls._weighted_choice(allowed, weights, rng)

                # Required Run Rate check
                rrr = (runs_needed / balls_left) if balls_left > 0 else 6.0
                if rrr > 4.0:
                    # High run rate required: increase boundary aggression (4 and 6)
                    weights = {1: 0.10, 2: 0.15, 3: 0.15, 4: 0.30, 5: 0.05, 6: 0.25}
                    return cls._weighted_choice(allowed, weights, rng)

            # Last wicket protection
            if wickets_left == 1 and (innings.target is None or (innings.target - innings.total_runs) > 6):
                weights = {1: 0.30, 2: 0.30, 3: 0.20, 4: 0.12, 5: 0.03, 6: 0.05}
                return cls._weighted_choice(allowed, weights, rng)

            # Standard balanced batting: healthy mix of singles and boundaries
            weights = {1: 0.20, 2: 0.22, 3: 0.18, 4: 0.20, 5: 0.05, 6: 0.15}
            # Anti-repetition: avoid playing the exact same number three times in a row
            if len(past_deliveries) >= 2:
                last_two = [d.batsman_number for d in past_deliveries[-2:]]
                if last_two[0] == last_two[1] and last_two[0] in weights:
                    weights[last_two[0]] *= 0.2

            return cls._weighted_choice(allowed, weights, rng)

        # ----------------------------------------------------
        # 3. ADVANCED BATTING: High tactical acuity & Game Theory
        # ----------------------------------------------------
        # Chasing endgame analysis
        if innings.target is not None:
            runs_needed = max(0, innings.target - innings.total_runs)
            if runs_needed == 1:
                # Bowlers expect 1: alternate between 1, 2, and a surprise 3
                weights = {1: 0.40, 2: 0.40, 3: 0.15, 4: 0.03, 5: 0.01, 6: 0.01}
                return cls._weighted_choice(allowed, weights, rng)
            elif runs_needed <= 3:
                weights = {1: 0.35, 2: 0.35, 3: 0.20, 4: 0.06, 5: 0.02, 6: 0.02}
                return cls._weighted_choice(allowed, weights, rng)

            rrr = (runs_needed / balls_left) if balls_left > 0 else 6.0
            if rrr >= 4.5:
                # Need explosive boundaries: smart mix of 4, 6, and tricky 5
                weights = {1: 0.08, 2: 0.12, 3: 0.15, 4: 0.32, 5: 0.08, 6: 0.25}
                return cls._weighted_choice(allowed, weights, rng)

        # Read opponent bowler's past tendencies from completed deliveries
        bowler_history = [d.bowler_number for d in past_deliveries if d.bowler_number in allowed]
        weights = {1: 0.18, 2: 0.20, 3: 0.18, 4: 0.22, 5: 0.07, 6: 0.15}

        if bowler_history:
            # If the human bowler has a clear favorite delivery, avoid playing that number!
            from collections import Counter
            counts = Counter(bowler_history)
            most_common_num, freq = counts.most_common(1)[0]
            if freq >= 2 and most_common_num in weights:
                # Heavily discount the bowler's favorite number to dodge the catch
                weights[most_common_num] *= 0.15

        # Anti-pattern: ensure unpredictable variance
        if past_deliveries:
            last_bot_move = past_deliveries[-1].batsman_number
            if last_bot_move in weights:
                weights[last_bot_move] *= 0.35

        return cls._weighted_choice(allowed, weights, rng)

    @classmethod
    def _decide_bowling(
        cls,
        state: MatchState,
        innings: InningsScorecard,
        allowed: List[int],
        difficulty: BotDifficulty,
        rng: random.Random
    ) -> int:
        balls_in_innings = state.rules.overs_per_innings * state.rules.balls_per_over
        balls_left = max(0, balls_in_innings - innings.balls_bowled)
        past_deliveries = innings.deliveries

        # ----------------------------------------------------
        # 1. BEGINNER BOWLING: Predictable, simple deliveries
        # ----------------------------------------------------
        if difficulty == BotDifficulty.BEGINNER:
            weights = {1: 0.24, 2: 0.26, 3: 0.24, 4: 0.14, 5: 0.04, 6: 0.08}
            return cls._weighted_choice(allowed, weights, rng)

        # ----------------------------------------------------
        # 2. INTERMEDIATE BOWLING: Situational fielding
        # ----------------------------------------------------
        if difficulty == BotDifficulty.INTERMEDIATE:
            # If human is chasing in 2nd Innings
            if innings.target is not None:
                runs_needed = max(0, innings.target - innings.total_runs)
                if runs_needed <= 2:
                    # Human only needs 1 or 2 to win -> Bowl 1 or 2 to catch them!
                    weights = {1: 0.42, 2: 0.38, 3: 0.10, 4: 0.05, 5: 0.02, 6: 0.03}
                    return cls._weighted_choice(allowed, weights, rng)

                rrr = (runs_needed / balls_left) if balls_left > 0 else 6.0
                if rrr >= 4.0:
                    # Human must hit 4 or 6 -> Target boundaries!
                    weights = {1: 0.12, 2: 0.14, 3: 0.14, 4: 0.32, 5: 0.06, 6: 0.22}
                    return cls._weighted_choice(allowed, weights, rng)

            # Standard intermediate delivery spread
            weights = {1: 0.20, 2: 0.22, 3: 0.20, 4: 0.18, 5: 0.06, 6: 0.14}
            return cls._weighted_choice(allowed, weights, rng)

        # ----------------------------------------------------
        # 3. ADVANCED BOWLING: Tactical hunting of batsman's habits
        # ----------------------------------------------------
        if innings.target is not None:
            runs_needed = max(0, innings.target - innings.total_runs)
            if runs_needed == 1:
                # Target is 1 run away: batsman will almost certainly play 1, 2, or 3
                weights = {1: 0.45, 2: 0.35, 3: 0.14, 4: 0.03, 5: 0.01, 6: 0.02}
                return cls._weighted_choice(allowed, weights, rng)

            rrr = (runs_needed / balls_left) if balls_left > 0 else 6.0
            if rrr >= 4.0:
                weights = {1: 0.10, 2: 0.12, 3: 0.12, 4: 0.36, 5: 0.06, 6: 0.24}
                return cls._weighted_choice(allowed, weights, rng)

        # Read human batsman's past scoring habits from completed deliveries
        batsman_history = [d.batsman_number for d in past_deliveries if d.batsman_number in allowed]
        weights = {1: 0.18, 2: 0.20, 3: 0.18, 4: 0.22, 5: 0.06, 6: 0.16}

        if batsman_history:
            from collections import Counter
            counts = Counter(batsman_history)
            most_frequent, freq = counts.most_common(1)[0]
            # If the batsman plays a particular number repeatedly, boost that delivery to take the wicket!
            if freq >= 2 and most_frequent in weights:
                weights[most_frequent] = min(0.48, weights[most_frequent] * 1.8)

            # Pressure detection: if last ball was a dot/single, batsman might try a boundary (4 or 6)
            if past_deliveries[-1].runs_scored <= 1:
                weights[4] = weights.get(4, 0.18) * 1.3
                weights[6] = weights.get(6, 0.16) * 1.3

        return cls._weighted_choice(allowed, weights, rng)

    @staticmethod
    def _weighted_choice(
        allowed: List[int],
        weights_dict: Dict[int, float],
        rng: random.Random
    ) -> int:
        population = [num for num in allowed if num in weights_dict]
        if not population:
            return rng.choice(allowed)

        raw_weights = [weights_dict[num] for num in population]
        total_w = sum(raw_weights)
        if total_w <= 0:
            return rng.choice(population)

        norm_weights = [w / total_w for w in raw_weights]
        return rng.choices(population, weights=norm_weights, k=1)[0]
