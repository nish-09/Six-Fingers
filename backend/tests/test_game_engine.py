import pytest
from app.models.game import (
    MatchState,
    MatchPhase,
    MatchRules,
    TeamConfig,
    PlayerRosterItem
)
from app.engine.hand_cricket import HandCricketEngine

def create_test_state() -> MatchState:
    team_a = TeamConfig(
        id="t_mumbai",
        name="Mumbai Blasters",
        players=HandCricketEngine.create_default_roster("Mumbai Blasters", "mum")
    )
    team_b = TeamConfig(
        id="t_chennai",
        name="Chennai Kings",
        players=HandCricketEngine.create_default_roster("Chennai Kings", "chn")
    )

    state = MatchState(
        match_id="test_m1",
        room_code="TEST01",
        phase=MatchPhase.LOBBY,
        rules=MatchRules(overs_per_innings=1, wickets_per_innings=2, balls_per_over=6),
        team_a=team_a,
        team_b=team_b,
        player_1_id="u_host",
        player_1_team_id="t_mumbai",
        player_1_ready=True,
        player_2_id="u_guest",
        player_2_team_id="t_chennai",
        player_2_ready=True,
        toss_winner_id="u_host",
        toss_decision="bat"
    )

    # Initialize 1st innings
    inn1 = HandCricketEngine.initialize_innings(state, 1)
    state.innings_list.append(inn1)
    HandCricketEngine.start_new_delivery(state)
    return state

def test_different_numbers_score_runs():
    state = create_test_state()
    # Host is batting, Guest is bowling
    deliv_id = state.current_delivery_id
    
    # Host chooses 4, Guest chooses 2
    ok1, _ = HandCricketEngine.record_secret_submission(state, "u_host", deliv_id, 4)
    assert ok1 is True
    assert not HandCricketEngine.are_both_submissions_ready(state)

    ok2, _ = HandCricketEngine.record_secret_submission(state, "u_guest", deliv_id, 2)
    assert ok2 is True
    assert HandCricketEngine.are_both_submissions_ready(state)

    res = HandCricketEngine.resolve_delivery(state)
    assert res is not None
    assert res.runs_scored == 4
    assert res.is_wicket is False
    assert res.innings_total_runs == 4
    assert res.innings_wickets == 0
    assert state.phase == MatchPhase.REVEAL

def test_matching_numbers_produce_wicket_and_zero_runs():
    state = create_test_state()
    deliv_id = state.current_delivery_id

    # Host chooses 6, Guest chooses 6
    HandCricketEngine.record_secret_submission(state, "u_host", deliv_id, 6)
    HandCricketEngine.record_secret_submission(state, "u_guest", deliv_id, 6)

    res = HandCricketEngine.resolve_delivery(state)
    assert res is not None
    assert res.runs_scored == 0
    assert res.is_wicket is True
    assert res.innings_total_runs == 0
    assert res.innings_wickets == 1

def test_reject_invalid_number_and_duplicate():
    state = create_test_state()
    deliv_id = state.current_delivery_id

    # Invalid number 9
    ok, msg = HandCricketEngine.record_secret_submission(state, "u_host", deliv_id, 9)
    assert ok is False

    # Valid number
    ok, _ = HandCricketEngine.record_secret_submission(state, "u_host", deliv_id, 3)
    assert ok is True

    # Duplicate submission
    ok_dup, msg_dup = HandCricketEngine.record_secret_submission(state, "u_host", deliv_id, 5)
    assert ok_dup is False
    assert "already submitted" in msg_dup

def test_stale_delivery_id_rejected():
    state = create_test_state()
    ok, msg = HandCricketEngine.record_secret_submission(state, "u_host", "stale_id_xyz", 3)
    assert ok is False
    assert "Stale delivery" in msg

def test_innings_and_target_chase_win():
    state = create_test_state()
    # Innings 1: 1 over (6 balls)
    for b in range(6):
        deliv_id = state.current_delivery_id
        HandCricketEngine.record_secret_submission(state, "u_host", deliv_id, 4)
        HandCricketEngine.record_secret_submission(state, "u_guest", deliv_id, 1)
        res = HandCricketEngine.resolve_delivery(state)
        assert res.runs_scored == 4
        HandCricketEngine.set_player_ready_for_next(state, "u_host")
        HandCricketEngine.set_player_ready_for_next(state, "u_guest")

    inn1 = state.innings_list[0]
    assert inn1.total_runs == 24 # 6 * 4
    assert inn1.is_completed is True
    assert state.phase == MatchPhase.INNINGS_BREAK

    # Transition to Innings 2
    HandCricketEngine.transition_to_innings_2(state)
    assert state.current_innings_number == 2
    inn2 = state.innings_list[1]
    assert inn2.target == 25

    # Innings 2: Guest is now batting! Let guest score 6 on each ball
    # Ball 1
    d1 = state.current_delivery_id
    HandCricketEngine.record_secret_submission(state, "u_guest", d1, 6)
    HandCricketEngine.record_secret_submission(state, "u_host", d1, 2)
    HandCricketEngine.resolve_delivery(state)
    HandCricketEngine.set_player_ready_for_next(state, "u_guest")
    HandCricketEngine.set_player_ready_for_next(state, "u_host")

    # Ball 2
    d2 = state.current_delivery_id
    HandCricketEngine.record_secret_submission(state, "u_guest", d2, 6)
    HandCricketEngine.record_secret_submission(state, "u_host", d2, 3)
    HandCricketEngine.resolve_delivery(state)
    HandCricketEngine.set_player_ready_for_next(state, "u_guest")
    HandCricketEngine.set_player_ready_for_next(state, "u_host")

    # Ball 3
    d3 = state.current_delivery_id
    HandCricketEngine.record_secret_submission(state, "u_guest", d3, 6)
    HandCricketEngine.record_secret_submission(state, "u_host", d3, 1)
    HandCricketEngine.resolve_delivery(state)
    HandCricketEngine.set_player_ready_for_next(state, "u_guest")
    HandCricketEngine.set_player_ready_for_next(state, "u_host")

    # Ball 4 (Guest has 18 runs now, needs 7 more. Hits 6 -> 24)
    d4 = state.current_delivery_id
    HandCricketEngine.record_secret_submission(state, "u_guest", d4, 6)
    HandCricketEngine.record_secret_submission(state, "u_host", d4, 4)
    HandCricketEngine.resolve_delivery(state)
    HandCricketEngine.set_player_ready_for_next(state, "u_guest")
    HandCricketEngine.set_player_ready_for_next(state, "u_host")

    # Ball 5 (Guest at 24 runs, needs 1 run to reach 25. Hits 2 -> 26 runs >= target)
    d5 = state.current_delivery_id
    HandCricketEngine.record_secret_submission(state, "u_guest", d5, 2)
    HandCricketEngine.record_secret_submission(state, "u_host", d5, 5)
    HandCricketEngine.resolve_delivery(state)

    assert inn2.total_runs == 26
    assert state.is_match_over is True
    assert state.winner_team_id == state.team_b.id
    assert "Chennai Kings won by 2 wickets" in state.win_margin_description
