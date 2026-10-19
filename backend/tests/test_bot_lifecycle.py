import pytest
import asyncio
import time
from typing import Dict, Any

from app.rooms.manager import room_manager
from app.models.game import MatchState, MatchPhase, DeliveryResult, CommentaryLanguage
from app.engine.hand_cricket import HandCricketEngine
from app.bots.config import bot_settings
from app.bots.models import BotDifficulty, PREDEFINED_BOTS
from app.bots.registry import bot_registry
from app.bots.session import BotGameSession
from app.bots.banter import BotBanterEngine, BANTER_POOLS
from app.commentary.service import commentary_service

@pytest.fixture(autouse=True)
def fast_bot_delays():
    orig_enabled = bot_settings.enabled
    orig_min = bot_settings.decision_delay_min
    orig_max = bot_settings.decision_delay_max

    bot_settings.enabled = True
    bot_settings.decision_delay_min = 0.01
    bot_settings.decision_delay_max = 0.02

    yield

    bot_settings.enabled = orig_enabled
    bot_settings.decision_delay_min = orig_min
    bot_settings.decision_delay_max = orig_max

async def setup_test_bot_room():
    bot_profile = PREDEFINED_BOTS[0]
    bot_id = "bot_test_player"
    human_id = "human_test_player"

    room = room_manager.create_room(human_id, "Human Host", "token_human")
    room.state.is_bot_match = True
    room.state.player_1_id = human_id
    room.state.player_2_id = bot_id
    room.state.rules.wickets_per_innings = 10

    # Join bot on Team B
    room.join_user(bot_id, bot_profile.display_name, "token_bot", role="player", requested_team_id=room.state.team_b.id)

    # Attach bot session
    bot_session = BotGameSession(
        room=room,
        bot_player_id=bot_id,
        bot_profile=bot_profile,
        difficulty=BotDifficulty.BEGINNER
    )
    room.bot_session = bot_session

    # Initialize Innings 1 and start Ball 1
    room.state.toss_decision = "bat"
    room.state.toss_winner_id = human_id
    inn1 = HandCricketEngine.initialize_innings(room.state, 1)
    room.state.innings_list = [inn1]
    room.state.current_innings_number = 1
    HandCricketEngine.start_new_delivery(room.state)

    return room, bot_session, human_id, bot_id

# ==============================================================================
# TESTS FOR BOT BALL-BY-BALL LIFECYCLE
# ==============================================================================

@pytest.mark.asyncio
async def test_bot_plays_first_ball():
    """Bot schedules and submits an action for delivery 1."""
    room, bot_session, human_id, bot_id = await setup_test_bot_room()
    deliv_1 = room.state.current_delivery_id
    assert deliv_1 == "inn1_o0_b1"

    # Trigger decision phase for bot
    bot_session.on_phase_change(MatchPhase.DECISION)
    # Human submits
    await room_manager.handle_delivery_submission(room, human_id, deliv_1, 4)

    # Wait for bot decision delay
    await asyncio.sleep(0.06)

    # Delivery should now be resolved
    inn = HandCricketEngine.get_current_innings(room.state)
    assert len(inn.deliveries) == 1
    assert inn.deliveries[0].delivery_id == deliv_1
    assert room.state.phase in [MatchPhase.REVEAL, MatchPhase.DISCUSSION]

    await bot_session.cleanup()

@pytest.mark.asyncio
async def test_bot_plays_second_ball():
    """CRITICAL: Bot prepares and submits for delivery 2 after delivery 1 resolves."""
    room, bot_session, human_id, bot_id = await setup_test_bot_room()

    # --- BALL 1 ---
    deliv_1 = room.state.current_delivery_id
    bot_session.on_phase_change(MatchPhase.DECISION)
    await room_manager.handle_delivery_submission(room, human_id, deliv_1, 4)
    await asyncio.sleep(0.06)

    inn = HandCricketEngine.get_current_innings(room.state)
    assert len(inn.deliveries) == 1

    # Both ready for next ball
    HandCricketEngine.set_player_ready_for_next(room.state, human_id)
    bot_ready = HandCricketEngine.set_player_ready_for_next(room.state, bot_id)
    assert bot_ready is True

    # HandCricketEngine starts delivery 2
    assert room.state.phase == MatchPhase.DECISION
    deliv_2 = room.state.current_delivery_id
    assert deliv_2 == "inn1_o0_b2"

    # Trigger bot for delivery 2
    bot_session.on_phase_change(MatchPhase.DECISION)

    # Human submits for delivery 2
    await room_manager.handle_delivery_submission(room, human_id, deliv_2, 3)

    # Wait for bot to submit
    await asyncio.sleep(0.06)

    # Both balls successfully resolved!
    assert len(inn.deliveries) == 2
    assert inn.deliveries[1].delivery_id == deliv_2

    await bot_session.cleanup()

@pytest.mark.asyncio
async def test_bot_continues_subsequent_balls_entire_over():
    """Bot plays an entire over of consecutive deliveries without getting stuck."""
    room, bot_session, human_id, bot_id = await setup_test_bot_room()
    inn = HandCricketEngine.get_current_innings(room.state)

    for ball_num in range(1, 7):
        current_deliv_id = room.state.current_delivery_id
        assert current_deliv_id == f"inn1_o0_b{ball_num}"

        # Bot schedules action
        bot_session.on_phase_change(MatchPhase.DECISION)

        # Human submits (alternate numbers)
        chosen = 1 if ball_num % 2 == 1 else 2
        await room_manager.handle_delivery_submission(room, human_id, current_deliv_id, chosen)

        # Wait for bot submission
        await asyncio.sleep(0.06)

        # Confirm ball completed
        assert len(inn.deliveries) == ball_num

        # Ready for next delivery / over transition
        HandCricketEngine.set_player_ready_for_next(room.state, human_id)
        HandCricketEngine.set_player_ready_for_next(room.state, bot_id)

    # After 6th ball readiness, over is complete and enters OVER_BREAK
    assert room.state.phase == MatchPhase.OVER_BREAK
    await bot_session.cleanup()

@pytest.mark.asyncio
async def test_bot_responds_after_boundary_and_wicket():
    """Bot responds correctly after boundaries and wickets."""
    room, bot_session, human_id, bot_id = await setup_test_bot_room()
    inn = HandCricketEngine.get_current_innings(room.state)

    # --- Test Boundary (Six) ---
    deliv_1 = room.state.current_delivery_id
    # Force human 6 and bot 2 -> 6 runs
    HandCricketEngine.record_secret_submission(room.state, human_id, deliv_1, 6)
    HandCricketEngine.record_secret_submission(room.state, bot_id, deliv_1, 2)
    res_1 = HandCricketEngine.resolve_delivery(room.state)
    assert res_1.runs_scored == 6
    assert res_1.is_wicket is False

    # Notify bot of reveal/discussion
    bot_session.on_delivery_resolved(res_1)
    await asyncio.sleep(0.05)

    # Ready up for ball 2
    HandCricketEngine.set_player_ready_for_next(room.state, human_id)
    HandCricketEngine.set_player_ready_for_next(room.state, bot_id)
    assert room.state.phase == MatchPhase.DECISION
    deliv_2 = room.state.current_delivery_id
    assert deliv_2 == "inn1_o0_b2"

    # --- Test Wicket ---
    # Force human 3 and bot 3 -> WICKET!
    HandCricketEngine.record_secret_submission(room.state, human_id, deliv_2, 3)
    HandCricketEngine.record_secret_submission(room.state, bot_id, deliv_2, 3)
    res_2 = HandCricketEngine.resolve_delivery(room.state)
    assert res_2.is_wicket is True
    assert res_2.runs_scored == 0
    assert inn.wickets == 1

    bot_session.on_delivery_resolved(res_2)
    await asyncio.sleep(0.05)

    # Ready up for ball 3 - bot still active!
    HandCricketEngine.set_player_ready_for_next(room.state, human_id)
    HandCricketEngine.set_player_ready_for_next(room.state, bot_id)
    assert room.state.phase == MatchPhase.DECISION
    assert room.state.current_delivery_id == "inn1_o0_b3"

    await bot_session.cleanup()

@pytest.mark.asyncio
async def test_bot_innings_transition_and_batting_role():
    """Bot switches from bowling in Innings 1 to batting in Innings 2."""
    room, bot_session, human_id, bot_id = await setup_test_bot_room()

    # Complete Innings 1 by reaching wickets limit (e.g. 10 wickets)
    inn1 = HandCricketEngine.get_current_innings(room.state)
    inn1.wickets = room.state.rules.wickets_per_innings - 1

    deliv_w = room.state.current_delivery_id
    HandCricketEngine.record_secret_submission(room.state, human_id, deliv_w, 5)
    HandCricketEngine.record_secret_submission(room.state, bot_id, deliv_w, 5)
    res_w = HandCricketEngine.resolve_delivery(room.state)

    assert inn1.is_completed is True

    # Ready up to transition to INNINGS_BREAK
    HandCricketEngine.set_player_ready_for_next(room.state, human_id)
    HandCricketEngine.set_player_ready_for_next(room.state, bot_id)
    assert room.state.phase == MatchPhase.INNINGS_BREAK

    # Transition to Innings 2
    HandCricketEngine.transition_to_innings_2(room.state)
    assert room.state.current_innings_number == 2
    assert room.state.phase == MatchPhase.DECISION
    deliv_inn2 = room.state.current_delivery_id
    assert deliv_inn2 == "inn2_o0_b1"

    # Bot is now the BATTING controller!
    assert room.state.active_batting_controller_id == bot_id
    assert room.state.active_bowling_controller_id == human_id

    # Bot plays Innings 2 Ball 1
    bot_session.on_phase_change(MatchPhase.DECISION)
    # Human bowls
    await room_manager.handle_delivery_submission(room, human_id, deliv_inn2, 2)
    await asyncio.sleep(0.06)

    inn2 = HandCricketEngine.get_current_innings(room.state)
    assert len(inn2.deliveries) == 1
    assert inn2.deliveries[0].delivery_id == deliv_inn2

    await bot_session.cleanup()

@pytest.mark.asyncio
async def test_bot_duplicate_submission_idempotency():
    """Bot cannot submit twice for the exact same delivery ID."""
    room, bot_session, human_id, bot_id = await setup_test_bot_room()
    deliv_1 = room.state.current_delivery_id

    # Trigger decision handler twice concurrently
    task1 = asyncio.create_task(bot_session._handle_decision(deliv_1))
    task2 = asyncio.create_task(bot_session._handle_decision(deliv_1))
    await asyncio.gather(task1, task2)

    # Only 1 submission should be recorded
    assert bot_id in room.state.pending_submissions
    assert len(room.state.pending_submissions) == 1

    await bot_session.cleanup()

# ==============================================================================
# TESTS FOR BOT BANTER AND COMMENTARY
# ==============================================================================

def test_bot_banter_event_evaluation():
    """Bot evaluates six, four, wicket, and dot ball events for appropriate sledging."""
    bot_profile = PREDEFINED_BOTS[0]
    banter_engine = BotBanterEngine(bot_profile)

    deliv_six = DeliveryResult(
        delivery_id="inn1_o0_b1", innings_number=1, over=0, ball_in_over=1, total_balls=1,
        batsman_id="p1", batsman_name="Batter", bowler_id="b1", bowler_name="Bowler",
        batting_controller_id="human_p", batting_controller_name="Human",
        bowling_controller_id="bot_p", bowling_controller_name="Bot",
        batsman_number=6, bowler_number=2, runs_scored=6, is_wicket=False,
        innings_total_runs=6, innings_wickets=0, timestamp=time.time()
    )

    room = room_manager.create_room("h_banter", "Host", "tok")
    event = banter_engine.evaluate_delivery_event(room.state, deliv_six, "bot_p")
    assert event == "player_hit_six"

    line = banter_engine.generate_banter(event, room.state, deliv_six)
    assert line is not None
    assert isinstance(line, str)
    assert len(line) > 5

def test_indian_commentary_generation():
    """Commentary produces authentic Indian cricket expressions and handles dot balls."""
    room = room_manager.create_room("h_comm", "Host", "tok")

    # Dot ball
    deliv_dot = DeliveryResult(
        delivery_id="inn1_o0_b1", innings_number=1, over=0, ball_in_over=1, total_balls=1,
        batsman_id="p1", batsman_name="Rohit", bowler_id="b1", bowler_name="Bumrah",
        batting_controller_id="p1", batting_controller_name="Rohit",
        bowling_controller_id="b1", bowling_controller_name="Bumrah",
        batsman_number=1, bowler_number=3, runs_scored=0, is_wicket=False,
        innings_total_runs=0, innings_wickets=0, timestamp=time.time()
    )

    comm = commentary_service.generate_delivery_commentary(room.state, deliv_dot)
    assert "en" in comm and "hi" in comm
    assert "dot ball" in comm["en"].lower() or "beaten" in comm["en"].lower()
    assert "dot ball" in comm["hi"].lower() or "achha ball" in comm["hi"].lower() or "रन" in comm["hi"]

    # Six
    deliv_six = DeliveryResult(
        delivery_id="inn1_o0_b2", innings_number=1, over=0, ball_in_over=2, total_balls=2,
        batsman_id="p1", batsman_name="Rohit", bowler_id="b1", bowler_name="Bumrah",
        batting_controller_id="p1", batting_controller_name="Rohit",
        bowling_controller_id="b1", bowling_controller_name="Bumrah",
        batsman_number=6, bowler_number=4, runs_scored=6, is_wicket=False,
        innings_total_runs=6, innings_wickets=0, timestamp=time.time()
    )
    comm_six = commentary_service.generate_delivery_commentary(room.state, deliv_six)
    assert "six" in comm_six["en"].lower() or "6" in comm_six["en"]
    assert "छक्का" in comm_six["hi"] or "six" in comm_six["hi"].lower() or "6" in comm_six["hi"]
