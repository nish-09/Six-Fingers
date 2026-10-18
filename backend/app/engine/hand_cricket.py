import time
from typing import Optional, Tuple, Dict, Any, List
from ..models.game import (
    MatchState,
    MatchPhase,
    InningsScorecard,
    DeliveryResult,
    BatterStats,
    BowlerStats,
    TeamConfig,
    PlayerRosterItem,
    PlayerRole,
    RotationMode
)

class HandCricketEngine:
    """
    Authoritative game engine for Hand Cricket.
    Handles all rule enforcement, innings transitions, scoring, wickets,
    target chasing, Super Over, delivery idempotency, and over-wise human player rotation.
    """

    @staticmethod
    def create_default_roster(team_name: str, prefix: str) -> List[PlayerRosterItem]:
        defaults = [
            ("Master Blaster", PlayerRole.BATSMAN),
            ("Thunder Striker", PlayerRole.ALL_ROUNDER),
            ("Speed Demon", PlayerRole.BOWLER),
            ("Spin Wizard", PlayerRole.BOWLER),
            ("Finisher King", PlayerRole.ALL_ROUNDER)
        ]
        return [
            PlayerRosterItem(
                id=f"{prefix}_{i+1}",
                name=f"{name} ({team_name[:3].upper()})",
                role=role,
                batting_order=i+1,
                bowling_order=i+1
            )
            for i, (name, role) in enumerate(defaults)
        ]

    @staticmethod
    def get_batting_and_bowling_teams(state: MatchState, innings: InningsScorecard) -> Tuple[TeamConfig, TeamConfig]:
        if innings.batting_team_id == state.team_a.id:
            return state.team_a, state.team_b
        return state.team_b, state.team_a

    @classmethod
    def compute_controllers_for_over(cls, state: MatchState, innings: InningsScorecard, over_index: int) -> Tuple[str, str]:
        """
        Computes (batting_controller_id, bowling_controller_id) for the given over_index.
        Respects rotation_mode:
        - AUTOMATIC: cyclic rotation through connected teammates
        - CAPTAIN_SELECTED: custom order defined by captain
        - MANUAL: manual selection (falls back to cyclic if not set)
        """
        batting_team, bowling_team = cls.get_batting_and_bowling_teams(state, innings)

        # Batting pool
        batting_pool = batting_team.batting_controller_order if batting_team.batting_controller_order else batting_team.human_player_ids
        if not batting_pool:
            fallback_bat = state.player_1_id if batting_team.id == state.player_1_team_id else (state.player_2_id or state.player_1_id)
            batting_pool = [fallback_bat]

        # Bowling pool
        bowling_pool = bowling_team.bowling_controller_order if bowling_team.bowling_controller_order else bowling_team.human_player_ids
        if not bowling_pool:
            fallback_bowl = state.player_2_id if bowling_team.id == state.player_2_team_id else state.player_1_id
            bowling_pool = [fallback_bowl or state.player_1_id]

        bat_id = batting_pool[over_index % len(batting_pool)]
        bowl_id = bowling_pool[over_index % len(bowling_pool)]
        return bat_id, bowl_id

    @classmethod
    def update_active_controllers(cls, state: MatchState) -> None:
        innings = cls.get_current_innings(state)
        if not innings:
            return
        current_over = innings.balls_bowled // state.rules.balls_per_over
        bat_id, bowl_id = cls.compute_controllers_for_over(state, innings, current_over)
        state.active_batting_controller_id = bat_id
        state.active_bowling_controller_id = bowl_id

        # Compute next controllers for upcoming over preview
        next_bat, next_bowl = cls.compute_controllers_for_over(state, innings, current_over + 1)
        state.next_batting_controller_id = next_bat
        state.next_bowling_controller_id = next_bowl

    @classmethod
    def initialize_innings(cls, state: MatchState, innings_num: int) -> InningsScorecard:
        if innings_num == 1:
            # Batting team decided by toss
            p1_team_id = state.player_1_team_id or state.team_a.id
            if state.toss_decision == "bat":
                batting_team = state.team_a if state.toss_winner_id == state.player_1_id else state.team_b
                bowling_team = state.team_b if batting_team.id == state.team_a.id else state.team_a
            else:
                bowling_team = state.team_a if state.toss_winner_id == state.player_1_id else state.team_b
                batting_team = state.team_b if bowling_team.id == state.team_a.id else state.team_a
            target = None
        else:
            # 2nd innings: swap teams
            first_innings = state.innings_list[0]
            batting_team = state.team_b if first_innings.batting_team_id == state.team_a.id else state.team_a
            bowling_team = state.team_a if batting_team.id == state.team_b.id else state.team_b
            target = first_innings.total_runs + 1

        # Initialize batter stats
        batters: Dict[str, BatterStats] = {}
        sorted_batters = sorted(batting_team.players, key=lambda p: p.batting_order)
        for p in sorted_batters:
            batters[p.id] = BatterStats(player_id=p.id, name=p.name)

        # Initialize bowler stats
        bowlers: Dict[str, BowlerStats] = {}
        for p in bowling_team.players:
            bowlers[p.id] = BowlerStats(player_id=p.id, name=p.name)

        innings = InningsScorecard(
            innings_number=innings_num,
            batting_team_id=batting_team.id,
            batting_team_name=batting_team.name,
            bowling_team_id=bowling_team.id,
            bowling_team_name=bowling_team.name,
            total_runs=0,
            wickets=0,
            balls_bowled=0,
            target=target,
            batters=batters,
            bowlers=bowlers,
            deliveries=[],
            is_completed=False
        )

        # Setup openers and opening bowler
        if len(sorted_batters) > 0:
            state.current_striker_id = sorted_batters[0].id
        if len(sorted_batters) > 1:
            state.current_non_striker_id = sorted_batters[1].id
        
        # Opening bowler
        sorted_bowlers = sorted(bowling_team.players, key=lambda p: p.bowling_order)
        if len(sorted_bowlers) > 0:
            state.current_bowler_id = sorted_bowlers[0].id

        # Update active human controllers for this innings
        cls.update_active_controllers_with_innings(state, innings)

        return innings

    @classmethod
    def update_active_controllers_with_innings(cls, state: MatchState, innings: InningsScorecard) -> None:
        current_over = innings.balls_bowled // state.rules.balls_per_over
        bat_id, bowl_id = cls.compute_controllers_for_over(state, innings, current_over)
        state.active_batting_controller_id = bat_id
        state.active_bowling_controller_id = bowl_id

        next_bat, next_bowl = cls.compute_controllers_for_over(state, innings, current_over + 1)
        state.next_batting_controller_id = next_bat
        state.next_bowling_controller_id = next_bowl

    @staticmethod
    def get_current_innings(state: MatchState) -> Optional[InningsScorecard]:
        if not state.innings_list:
            return None
        idx = state.current_innings_number - 1
        if 0 <= idx < len(state.innings_list):
            return state.innings_list[idx]
        return None

    @staticmethod
    def get_delivery_id(innings_num: int, balls_bowled: int, balls_per_over: int) -> str:
        over = balls_bowled // balls_per_over
        ball = (balls_bowled % balls_per_over) + 1
        return f"inn{innings_num}_o{over}_b{ball}"

    @classmethod
    def start_new_delivery(cls, state: MatchState) -> None:
        innings = cls.get_current_innings(state)
        if not innings or innings.is_completed or state.is_match_over:
            return

        cls.update_active_controllers(state)

        state.current_delivery_id = cls.get_delivery_id(
            state.current_innings_number,
            innings.balls_bowled,
            state.rules.balls_per_over
        )
        state.phase = MatchPhase.DECISION
        state.decision_deadline = time.time() + state.rules.decision_timer_seconds
        state.pending_submissions.clear()
        state.ready_for_next_ball.clear()
        state.over_transition_ready.clear()

    @classmethod
    def record_secret_submission(
        cls, state: MatchState, player_id: str, delivery_id: str, chosen_number: int
    ) -> Tuple[bool, str]:
        """
        Records an active controller's secret number.
        Returns (success, message).
        Guarantees that the secret number is stored securely on the server
        and not broadcast before both players have locked.
        Enforces strict participant authorization: ONLY the active batting
        and bowling controllers can submit numbers for this delivery!
        """
        if state.phase != MatchPhase.DECISION:
            return False, "Decision phase is not active"

        if delivery_id != state.current_delivery_id:
            return False, f"Stale delivery ID ({delivery_id} != {state.current_delivery_id})"

        if chosen_number not in state.rules.allowed_numbers:
            return False, f"Number {chosen_number} is not in allowed numbers: {state.rules.allowed_numbers}"

        # Permitted controllers
        permitted = [p for p in [state.active_batting_controller_id, state.active_bowling_controller_id] if p]
        if not permitted:
            permitted = [p for p in [state.player_1_id, state.player_2_id] if p]

        if player_id not in permitted:
            return False, "Only active batting and bowling controllers can submit numbers for this delivery"

        if player_id in state.pending_submissions:
            return False, "Player already submitted a choice for this delivery"

        state.pending_submissions[player_id] = chosen_number
        return True, "Selection locked successfully"

    @classmethod
    def are_both_submissions_ready(cls, state: MatchState) -> bool:
        bat_id = state.active_batting_controller_id or state.player_1_id
        bowl_id = state.active_bowling_controller_id or state.player_2_id
        if not bat_id or not bowl_id:
            return False
        return (bat_id in state.pending_submissions and bowl_id in state.pending_submissions)

    @classmethod
    def resolve_delivery(cls, state: MatchState) -> Optional[DeliveryResult]:
        """
        Calculates the delivery outcome simultaneously once both numbers are locked.
        Updates state, runs, wickets, overs, match status, and rotates controllers at over boundaries.
        """
        if not cls.are_both_submissions_ready(state):
            return None

        innings = cls.get_current_innings(state)
        if not innings or innings.is_completed:
            return None

        bat_controller_id = state.active_batting_controller_id or (
            state.player_1_id if state.player_1_team_id == innings.batting_team_id else (state.player_2_id or state.player_1_id)
        )
        bowl_controller_id = state.active_bowling_controller_id or (
            state.player_2_id if state.player_1_team_id == innings.batting_team_id else state.player_1_id
        )

        batsman_number = state.pending_submissions.get(bat_controller_id, 0)
        bowler_number = state.pending_submissions.get(bowl_controller_id, 0)

        # Get batsman and bowler models (in-game identities)
        striker_id = state.current_striker_id or "p1"
        bowler_id = state.current_bowler_id or "p2"

        striker_stats = innings.batters.get(striker_id)
        if not striker_stats:
            striker_stats = BatterStats(player_id=striker_id, name="Striker")
            innings.batters[striker_id] = striker_stats

        bowler_stats = innings.bowlers.get(bowler_id)
        if not bowler_stats:
            bowler_stats = BowlerStats(player_id=bowler_id, name="Bowler")
            innings.bowlers[bowler_id] = bowler_stats

        # Human controller names
        bat_ctrl_name = state.participants.get(bat_controller_id).name if bat_controller_id in state.participants else "Batter"
        bowl_ctrl_name = state.participants.get(bowl_controller_id).name if bowl_controller_id in state.participants else "Bowler"

        # Core hand-cricket logic
        is_wicket = (batsman_number == bowler_number)
        runs_scored = 0 if is_wicket else batsman_number

        # Update stats
        innings.balls_bowled += 1
        striker_stats.balls_faced += 1
        bowler_stats.balls_bowled += 1

        if is_wicket:
            innings.wickets += 1
            striker_stats.is_out = True
            striker_stats.dismissal_info = f"c & b {bowler_stats.name}"
            bowler_stats.wickets += 1
            dismissal_type = "HAND_CATCH"
        else:
            innings.total_runs += runs_scored
            striker_stats.runs += runs_scored
            bowler_stats.runs_conceded += runs_scored
            dismissal_type = None
            if runs_scored == 4:
                striker_stats.fours += 1
            elif runs_scored == 6:
                striker_stats.sixes += 1

        # Calculate over & ball
        balls_in_over = state.rules.balls_per_over
        over_num = (innings.balls_bowled - 1) // balls_in_over
        ball_in_over = ((innings.balls_bowled - 1) % balls_in_over) + 1

        delivery_res = DeliveryResult(
            delivery_id=state.current_delivery_id,
            innings_number=state.current_innings_number,
            over=over_num,
            ball_in_over=ball_in_over,
            total_balls=innings.balls_bowled,
            batsman_id=striker_id,
            batsman_name=striker_stats.name,
            bowler_id=bowler_id,
            bowler_name=bowler_stats.name,
            batting_controller_id=bat_controller_id,
            batting_controller_name=bat_ctrl_name,
            bowling_controller_id=bowl_controller_id,
            bowling_controller_name=bowl_ctrl_name,
            batsman_number=batsman_number,
            bowler_number=bowler_number,
            runs_scored=runs_scored,
            is_wicket=is_wicket,
            dismissal_type=dismissal_type,
            innings_total_runs=innings.total_runs,
            innings_wickets=innings.wickets,
            timestamp=time.time()
        )

        innings.deliveries.append(delivery_res)

        # Handle batsman change on wicket
        if is_wicket and innings.wickets < state.rules.wickets_per_innings:
            batting_team = state.team_a if innings.batting_team_id == state.team_a.id else state.team_b
            sorted_roster = sorted(batting_team.players, key=lambda p: p.batting_order)
            for p in sorted_roster:
                b_stat = innings.batters.get(p.id)
                if b_stat and not b_stat.is_out and p.id != state.current_non_striker_id and p.id != striker_id:
                    state.current_striker_id = p.id
                    break

        # Check over completion & in-game bowler rotation
        if ball_in_over == balls_in_over:
            state.last_bowler_id = state.current_bowler_id
            bowling_team = state.team_a if innings.bowling_team_id == state.team_a.id else state.team_b
            other_bowlers = [p.id for p in bowling_team.players if p.id != state.last_bowler_id]
            if other_bowlers:
                state.current_bowler_id = other_bowlers[0]
            # Strike rotation at end of over
            if state.current_non_striker_id and state.current_striker_id:
                state.current_striker_id, state.current_non_striker_id = (
                    state.current_non_striker_id, state.current_striker_id
                )

        # Check innings / match completion conditions
        cls._check_innings_and_match_state(state, innings)

        # Transition phase to REVEAL
        state.phase = MatchPhase.REVEAL
        return delivery_res

    @classmethod
    def _check_innings_and_match_state(cls, state: MatchState, innings: InningsScorecard):
        max_balls = state.rules.overs_per_innings * state.rules.balls_per_over
        innings_ended = False

        # Wickets limit reached
        if innings.wickets >= state.rules.wickets_per_innings:
            innings_ended = True

        # Balls limit reached
        if innings.balls_bowled >= max_balls:
            innings_ended = True

        # Second innings chase check
        if state.current_innings_number == 2 and innings.target is not None:
            if innings.total_runs >= innings.target:
                # Target achieved! Batting team wins
                innings_ended = True
                innings.is_completed = True
                state.is_match_over = True
                state.winner_team_id = innings.batting_team_id
                wickets_left = state.rules.wickets_per_innings - innings.wickets
                state.win_margin_description = f"{innings.batting_team_name} won by {wickets_left} wicket{'s' if wickets_left > 1 else ''}!"
                return

        if innings_ended:
            innings.is_completed = True
            if state.current_innings_number == 1:
                state.phase = MatchPhase.INNINGS_BREAK
            else:
                state.is_match_over = True
                first_innings = state.innings_list[0]
                if innings.total_runs > first_innings.total_runs:
                    state.winner_team_id = innings.batting_team_id
                    state.win_margin_description = f"{innings.batting_team_name} won the match!"
                elif innings.total_runs < first_innings.total_runs:
                    state.winner_team_id = innings.bowling_team_id
                    runs_margin = first_innings.total_runs - innings.total_runs
                    state.win_margin_description = f"{innings.bowling_team_name} won by {runs_margin} run{'s' if runs_margin > 1 else ''}!"
                else:
                    if state.rules.super_over_on_tie and not state.is_super_over:
                        state.is_super_over = True
                        state.win_margin_description = "Match Tied! Super Over begins!"
                    else:
                        state.winner_team_id = None
                        state.win_margin_description = "Match Tied!"

    @classmethod
    def transition_to_innings_2(cls, state: MatchState) -> None:
        if state.current_innings_number == 1:
            state.current_innings_number = 2
            innings_2 = cls.initialize_innings(state, 2)
            state.innings_list.append(innings_2)
            cls.start_new_delivery(state)

    @classmethod
    def set_player_ready_for_next(cls, state: MatchState, player_id: str) -> bool:
        """
        Marks a player ready during discussion phase.
        When active controllers are ready:
        - If innings/match finished -> transitions appropriately.
        - If over completed -> rotates controllers and transitions to OVER_BREAK so next controllers can prepare.
        - Otherwise -> starts next delivery.
        """
        if state.phase not in [MatchPhase.REVEAL, MatchPhase.DISCUSSION]:
            return False

        state.phase = MatchPhase.DISCUSSION
        state.ready_for_next_ball[player_id] = True

        # Controllers that must be ready
        req = [p for p in [state.active_batting_controller_id, state.active_bowling_controller_id] if p]
        if not req:
            req = [p for p in [state.player_1_id, state.player_2_id] if p]

        all_ready = all(state.ready_for_next_ball.get(pid, False) for pid in req)
        if all_ready:
            curr_innings = cls.get_current_innings(state)
            if state.is_match_over:
                state.phase = MatchPhase.MATCH_END
            elif curr_innings and curr_innings.is_completed:
                if state.current_innings_number == 1:
                    state.phase = MatchPhase.INNINGS_BREAK
                else:
                    state.phase = MatchPhase.MATCH_END
            elif curr_innings and (curr_innings.balls_bowled % state.rules.balls_per_over == 0):
                # Over is complete! Rotate controllers to the next over and enter OVER_BREAK
                cls.update_active_controllers(state)
                state.phase = MatchPhase.OVER_BREAK
                state.over_transition_ready.clear()
            else:
                cls.start_new_delivery(state)
            return True
        return False

    @classmethod
    def set_over_transition_ready(cls, state: MatchState, player_id: str) -> bool:
        """
        Marks next controller ready during OVER_BREAK.
        Once ready, begins the new over!
        """
        if state.phase != MatchPhase.OVER_BREAK:
            return False
        state.over_transition_ready[player_id] = True

        req = [p for p in [state.active_batting_controller_id, state.active_bowling_controller_id] if p]
        if not req:
            req = [p for p in [state.player_1_id, state.player_2_id] if p]

        all_ready = all(state.over_transition_ready.get(pid, False) for pid in req)
        if all_ready:
            state.over_transition_ready.clear()
            cls.start_new_delivery(state)
            return True
        return False
