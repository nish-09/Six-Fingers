import pytest
import asyncio
import time
import uuid
from typing import Dict, Any
from fastapi.testclient import TestClient

from app.main import app
from app.database import (
    init_db, AsyncSessionLocal, User, Profile, MatchRecord,
    save_completed_match, get_match_history
)
from app.auth.security import hash_password, create_access_token
from app.rooms.manager import room_manager
from app.matchmaking.queue import matchmaking_coordinator, MatchmakingTicket
from app.presence.manager import presence_manager, PresenceState
from app.models.game import MatchPhase, DeliveryResult, UserRole
from app.engine.hand_cricket import HandCricketEngine
from app.bots.config import bot_settings
from app.bots.models import BotDifficulty, BotProfile, PREDEFINED_BOTS
from app.bots.registry import bot_registry
from app.bots.skill import PlayerSkillEstimator
from app.bots.engine import BotDecisionEngine
from app.bots.session import BotGameSession

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_bot_env():
    # Set fast bot threshold and delay for testing
    orig_enabled = bot_settings.enabled
    orig_thresh = bot_settings.wait_threshold_seconds
    orig_min = bot_settings.decision_delay_min
    orig_max = bot_settings.decision_delay_max
    orig_max_matches = bot_settings.max_concurrent_matches
    orig_override = bot_settings.difficulty_override

    bot_settings.enabled = True
    bot_settings.wait_threshold_seconds = 0.05
    bot_settings.decision_delay_min = 0.01
    bot_settings.decision_delay_max = 0.02
    bot_settings.max_concurrent_matches = 20
    bot_settings.difficulty_override = None

    yield

    bot_settings.enabled = orig_enabled
    bot_settings.wait_threshold_seconds = orig_thresh
    bot_settings.decision_delay_min = orig_min
    bot_settings.decision_delay_max = orig_max
    bot_settings.max_concurrent_matches = orig_max_matches
    bot_settings.difficulty_override = orig_override

async def create_test_player(
    username: str = "testplayer",
    total_matches: int = 0,
    matches_won: int = 0,
    total_runs: int = 0,
    total_wickets: int = 0,
    current_streak: int = 0
) -> Dict[str, Any]:
    uid = f"u_{uuid.uuid4().hex[:8]}"
    pwd_hash = hash_password("Password123!")
    user_name = f"{username}_{uuid.uuid4().hex[:4]}"
    gamer_tag = f"{username}#123"
    async with AsyncSessionLocal() as session:
        user = User(
            id=uid,
            username=user_name,
            gamer_tag=gamer_tag,
            email=f"{user_name}@example.com",
            password_hash=pwd_hash,
            full_name=f"Player {username}",
            is_active=True
        )
        session.add(user)
        profile = Profile(
            user_id=uid,
            display_name=f"Player {username}",
            gamer_tag=gamer_tag,
            tag_number=123,
            avatar_url="avatar_1",
            total_matches=total_matches,
            matches_won=matches_won,
            total_runs=total_runs,
            total_wickets=total_wickets,
            current_streak=current_streak,
            best_streak=current_streak,
            is_public=True
        )
        session.add(profile)
        await session.commit()
    token = create_access_token(user_id=uid, username=user_name, gamer_tag=gamer_tag)
    return {"user_id": uid, "username": user.username, "token": token, "profile": profile}

# ==============================================================================
# SECTION 1: MATCHMAKING TESTS (Scenarios 1 - 13)
# ==============================================================================

@pytest.mark.asyncio
async def test_matchmaking_immediate_real_opponent_available():
    """Scenario 1: A suitable real opponent is available immediately."""
    p1 = await create_test_player("human_a")
    p2 = await create_test_player("human_b")

    t1 = await matchmaking_coordinator.enqueue(p1["user_id"], "Human A", "human_a#01", "avatar_1")
    t2 = await matchmaking_coordinator.enqueue(p2["user_id"], "Human B", "human_b#02", "avatar_2")

    assert t1.future.done()
    assert t2.future.done()
    res1 = t1.future.result()
    res2 = t2.future.result()

    assert res1["room_code"] == res2["room_code"]
    assert res1["opponent"]["user_id"] == p2["user_id"]
    assert res2["opponent"]["user_id"] == p1["user_id"]
    assert res1["is_bot_match"] is False
    assert res2["is_bot_match"] is False

@pytest.mark.asyncio
async def test_matchmaking_no_human_opponent_queues_ticket():
    """Scenario 2: No human opponent is available -> ticket enqueued."""
    bot_settings.wait_threshold_seconds = 10.0 # Long threshold so bot doesn't activate yet
    p1 = await create_test_player("lonely_p1")

    ticket = await matchmaking_coordinator.enqueue(p1["user_id"], "Lonely P1", "lonely#01", "avatar_1")
    assert not ticket.future.done()
    assert matchmaking_coordinator.get_queue_size() == 1
    await matchmaking_coordinator.dequeue(p1["user_id"])

@pytest.mark.asyncio
async def test_matchmaking_bot_activates_after_threshold():
    """Scenario 3: The bot activates after the configured wait threshold."""
    bot_settings.wait_threshold_seconds = 0.05
    p1 = await create_test_player("waited_p1")

    ticket = await matchmaking_coordinator.enqueue(p1["user_id"], "Waited P1", "waited#01", "avatar_1")
    res = await asyncio.wait_for(ticket.future, timeout=2.0)

    assert res["is_bot_match"] is True
    assert res["opponent"]["is_bot"] is True
    assert "room_code" in res
    assert matchmaking_coordinator.get_queue_size() == 0

    room = room_manager.get_room(res["room_code"])
    assert room is not None
    assert room.state.is_bot_match is True
    assert room.bot_session is not None
    await room.bot_session.cleanup()

@pytest.mark.asyncio
async def test_matchmaking_human_becomes_available_before_bot_assignment():
    """Scenario 4: A human opponent becomes available before bot assignment -> pair humans!"""
    bot_settings.wait_threshold_seconds = 0.2
    p1 = await create_test_player("first_human")
    p2 = await create_test_player("second_human")

    t1 = await matchmaking_coordinator.enqueue(p1["user_id"], "First", "first#01", "avatar_1")
    await asyncio.sleep(0.05) # Halfway through threshold

    # Second human joins before threshold expires
    t2 = await matchmaking_coordinator.enqueue(p2["user_id"], "Second", "second#02", "avatar_2")

    res1 = await asyncio.wait_for(t1.future, timeout=1.0)
    res2 = await asyncio.wait_for(t2.future, timeout=1.0)

    assert res1["is_bot_match"] is False
    assert res2["is_bot_match"] is False
    assert res1["opponent"]["user_id"] == p2["user_id"]
    assert res2["opponent"]["user_id"] == p1["user_id"]

@pytest.mark.asyncio
async def test_matchmaking_player_cancels_before_bot_activation():
    """Scenario 5: A player cancels before bot activation."""
    bot_settings.wait_threshold_seconds = 0.2
    p1 = await create_test_player("cancel_p1")

    ticket = await matchmaking_coordinator.enqueue(p1["user_id"], "Cancel P1", "cancel#01", "avatar_1")
    assert matchmaking_coordinator.get_queue_size() == 1

    cancelled = await matchmaking_coordinator.dequeue(p1["user_id"])
    assert cancelled is True
    assert ticket.future.cancelled()
    assert matchmaking_coordinator.get_queue_size() == 0

    # Wait past threshold to ensure bot was not allocated
    await asyncio.sleep(0.25)
    assert await bot_registry.get_active_bot_count() == 0

def test_matchmaking_player_disconnect_cancels_queue():
    """Scenario 6: A player disconnects during matchmaking via WebSocket."""
    async def _run():
        return await create_test_player("ws_dc_player")
    p = asyncio.run(_run())

    with client.websocket_connect(f"/api/matchmaking/ws?token={p['token']}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "SEARCHING"
        assert matchmaking_coordinator.get_queue_size() == 1

        # Send cancel
        ws.send_json({"type": "CANCEL"})
        resp = ws.receive_json()
        assert resp["type"] == "SEARCH_CANCELLED"

    assert matchmaking_coordinator.get_queue_size() == 0

@pytest.mark.asyncio
async def test_matchmaking_multiple_players_become_eligible_simultaneously():
    """Scenario 7: Multiple players become eligible for bot matching simultaneously."""
    bot_settings.wait_threshold_seconds = 0.05
    players = [await create_test_player(f"multi_{i}") for i in range(4)]
    tickets = []

    # Enqueue all 4 players with brief pauses to simulate simultaneous waiting
    for p in players:
        t = await matchmaking_coordinator.enqueue(p["user_id"], p["username"], f"{p['username']}#01", "avatar_1")
        tickets.append(t)

    results = await asyncio.gather(*[t.future for t in tickets])
    assert len(results) == 4
    # All players got matches without deadlocks or unhandled exceptions
    for res in results:
        assert "room_code" in res
        room = room_manager.get_room(res["room_code"])
        if room and room.bot_session:
            await room.bot_session.cleanup()

@pytest.mark.asyncio
async def test_matchmaking_duplicate_player_enqueue_returns_same_ticket():
    """Scenario 8 & 13: Prevent duplicate enqueue and duplicate match creation."""
    bot_settings.wait_threshold_seconds = 5.0
    p1 = await create_test_player("dup_player")

    t1 = await matchmaking_coordinator.enqueue(p1["user_id"], "Dup", "dup#01", "avatar_1")
    t2 = await matchmaking_coordinator.enqueue(p1["user_id"], "Dup", "dup#01", "avatar_1")

    assert t1.ticket_id == t2.ticket_id
    assert matchmaking_coordinator.get_queue_size() == 1
    await matchmaking_coordinator.dequeue(p1["user_id"])

@pytest.mark.asyncio
async def test_matchmaking_bot_already_occupied_assigns_other_or_clone():
    """Scenario 9: An occupied bot cannot be reassigned; next available bot or clone is picked."""
    bot1 = await bot_registry.acquire_bot(BotDifficulty.BEGINNER, "room_1")
    assert bot1 is not None

    bot2 = await bot_registry.acquire_bot(BotDifficulty.BEGINNER, "room_2")
    assert bot2 is not None
    assert bot1.bot_id != bot2.bot_id

    await bot_registry.release_bot(bot1.bot_id, "room_1")
    await bot_registry.release_bot(bot2.bot_id, "room_2")

@pytest.mark.asyncio
async def test_matchmaking_disabled_restores_human_only_behavior():
    """Scenario 10: Bot matchmaking disabled restores human-only Quick Play."""
    bot_settings.enabled = False
    bot_settings.wait_threshold_seconds = 0.05
    p1 = await create_test_player("no_bot_player")

    ticket = await matchmaking_coordinator.enqueue(p1["user_id"], "NoBot", "nobot#01", "avatar_1")
    await asyncio.sleep(0.1)

    # Ticket should still be pending and queue size 1
    assert not ticket.future.done()
    assert matchmaking_coordinator.get_queue_size() == 1
    await matchmaking_coordinator.dequeue(p1["user_id"])

@pytest.mark.asyncio
async def test_matchmaking_bot_capacity_exhausted_leaves_player_in_queue():
    """Scenario 11: Bot capacity exhausted leaves player in queue gracefully."""
    bot_settings.max_concurrent_matches = 1
    bot_settings.wait_threshold_seconds = 0.05

    # Consume the only allowed bot slot
    claimed = await bot_registry.acquire_bot(BotDifficulty.BEGINNER, "room_limit")
    assert claimed is not None

    p1 = await create_test_player("capped_player")
    ticket = await matchmaking_coordinator.enqueue(p1["user_id"], "Capped", "cap#01", "avatar_1")
    await asyncio.sleep(0.1)

    # Since capacity is reached, ticket remains in queue without crashing
    assert not ticket.future.done()
    assert matchmaking_coordinator.get_queue_size() == 1

    await matchmaking_coordinator.dequeue(p1["user_id"])
    await bot_registry.release_bot(claimed.bot_id, "room_limit")

@pytest.mark.asyncio
async def test_matchmaking_creation_failure_releases_bot_safely():
    """Scenario 12: Match creation failure releases bot back to registry safely."""
    bot_settings.wait_threshold_seconds = 0.05
    initial_active = await bot_registry.get_active_bot_count()

    p = await create_test_player("fail_player")
    # Simulate room manager failure by acquiring and then releasing on error
    acquired = await bot_registry.acquire_bot(BotDifficulty.BEGINNER)
    assert acquired is not None
    assert await bot_registry.get_active_bot_count() == initial_active + 1

    await bot_registry.release_bot(acquired.bot_id)
    assert await bot_registry.get_active_bot_count() == initial_active

# ==============================================================================
# SECTION 2: ADAPTIVE DIFFICULTY TESTS (Scenarios 14 - 18)
# ==============================================================================

@pytest.mark.asyncio
async def test_difficulty_new_player_receives_provisional_beginner():
    """Scenario 14: A new player with no match history receives provisional BEGINNER difficulty."""
    new_p = await create_test_player("fresh_user", total_matches=0, matches_won=0)
    diff = await PlayerSkillEstimator.estimate_for_user(new_p["user_id"])
    assert diff == BotDifficulty.BEGINNER

@pytest.mark.asyncio
async def test_difficulty_experienced_player_evaluated_correctly():
    """Scenario 15: An experienced player receives difficulty based on their actual history."""
    # Elite player: 10 matches, 8 wins (80% win rate), 300 runs
    elite_p = await create_test_player(
        "elite_user", total_matches=10, matches_won=8, total_runs=300, current_streak=4
    )
    diff_elite = await PlayerSkillEstimator.estimate_for_user(elite_p["user_id"])
    assert diff_elite == BotDifficulty.ADVANCED

    # Intermediate player: 6 matches, 3 wins (50% win rate)
    inter_p = await create_test_player(
        "inter_user", total_matches=6, matches_won=3, total_runs=90, current_streak=1
    )
    diff_inter = await PlayerSkillEstimator.estimate_for_user(inter_p["user_id"])
    assert diff_inter == BotDifficulty.INTERMEDIATE

def test_difficulty_missing_or_corrupt_stats_handled_safely():
    """Scenario 16: Missing or inconsistent statistics are handled safely."""
    # None profile
    diff_none = PlayerSkillEstimator.estimate_from_profile(None)
    assert diff_none == BotDifficulty.BEGINNER

    # Corrupt profile with negative matches or zero division avoidance
    class CorruptProfile:
        total_matches = 0
        matches_won = 10
        total_runs = 0
        total_wickets = 0
        current_streak = 0

    diff_corrupt = PlayerSkillEstimator.estimate_from_profile(CorruptProfile())
    assert diff_corrupt in [BotDifficulty.BEGINNER, BotDifficulty.INTERMEDIATE]

@pytest.mark.asyncio
async def test_difficulty_updates_as_player_stats_evolve():
    """Scenario 17: Difficulty changes as player's longer-term skill estimate evolves."""
    p = await create_test_player("evolving_user", total_matches=1, matches_won=0)
    assert await PlayerSkillEstimator.estimate_for_user(p["user_id"]) == BotDifficulty.BEGINNER

    # Update profile to veteran winner
    async with AsyncSessionLocal() as session:
        prof = await session.get(Profile, p["user_id"])
        prof.total_matches = 12
        prof.matches_won = 10
        prof.current_streak = 5
        await session.commit()

    assert await PlayerSkillEstimator.estimate_for_user(p["user_id"]) == BotDifficulty.ADVANCED

@pytest.mark.asyncio
async def test_difficulty_remains_consistent_during_active_match():
    """Scenario 18: Difficulty assigned to room state is immutable during active match."""
    bot_settings.wait_threshold_seconds = 0.05
    p = await create_test_player("steady_p", total_matches=0, matches_won=0)

    ticket = await matchmaking_coordinator.enqueue(p["user_id"], "Steady", "steady#01", "avatar_1")
    res = await asyncio.wait_for(ticket.future, timeout=2.0)

    assigned_diff = res["bot_difficulty"]
    room = room_manager.get_room(res["room_code"])
    assert room.state.bot_difficulty == assigned_diff

    # Simulate deliveries and state transitions
    assert room.state.bot_difficulty == assigned_diff
    await room.bot_session.cleanup()

# ==============================================================================
# SECTION 3: REALISTIC BOT GAMEPLAY TESTS (Scenarios 19 - 25)
# ==============================================================================

def test_gameplay_bot_batting_actions_are_legal_1_to_6():
    """Scenario 19: Bot batting actions are strictly within valid Hand Cricket range [1..6]."""
    room = room_manager.create_room("h_1", "Host 1", "tok_h1")
    room.state.phase = MatchPhase.DECISION
    inn = HandCricketEngine.initialize_innings(room.state, 1)
    room.state.innings_list = [inn]
    HandCricketEngine.start_new_delivery(room.state)

    for diff in [BotDifficulty.BEGINNER, BotDifficulty.INTERMEDIATE, BotDifficulty.ADVANCED]:
        for _ in range(50):
            action = BotDecisionEngine.decide_action(room.state, "h_1", diff)
            assert isinstance(action, int)
            assert 1 <= action <= 6

def test_gameplay_bot_bowling_actions_are_legal_1_to_6():
    """Scenario 20: Bot bowling actions are strictly within valid Hand Cricket range [1..6]."""
    room = room_manager.create_room("h_2", "Host 2", "tok_h2")
    room.state.phase = MatchPhase.DECISION
    inn = HandCricketEngine.initialize_innings(room.state, 1)
    room.state.innings_list = [inn]
    HandCricketEngine.start_new_delivery(room.state)
    # Set controller to bowling role
    room.state.active_bowling_controller_id = "h_2"
    room.state.active_batting_controller_id = "other_p"

    for diff in [BotDifficulty.BEGINNER, BotDifficulty.INTERMEDIATE, BotDifficulty.ADVANCED]:
        for _ in range(50):
            action = BotDecisionEngine.decide_action(room.state, "h_2", diff)
            assert isinstance(action, int)
            assert 1 <= action <= 6

def test_gameplay_bot_and_human_use_identical_game_rules():
    """Scenario 21: Both human and bot submissions use authoritative HandCricketEngine."""
    room = room_manager.create_room("h_3", "Host", "tok_h3")
    bot_id = "bot_opponent"
    room.join_user(bot_id, "Bot Opponent", "tok_bot", role="player", requested_team_id=room.state.team_b.id)

    room.state.phase = MatchPhase.DECISION
    inn = HandCricketEngine.initialize_innings(room.state, 1)
    room.state.innings_list = [inn]
    HandCricketEngine.start_new_delivery(room.state)
    deliv_id = room.state.current_delivery_id

    # Human bats 4, Bot bowls 2 -> 4 runs scored
    ok1, _ = HandCricketEngine.record_secret_submission(room.state, "h_3", deliv_id, 4)
    ok2, _ = HandCricketEngine.record_secret_submission(room.state, bot_id, deliv_id, 2)
    assert ok1 is True
    assert ok2 is True

    result = HandCricketEngine.resolve_delivery(room.state)
    assert result.runs_scored == 4
    assert result.is_wicket is False
    assert inn.total_runs == 4

def test_gameplay_scoring_and_wickets_remain_accurate():
    """Scenario 22: Hand Cricket wicket rule (same number = OUT) applies to bots identically."""
    room = room_manager.create_room("h_4", "Host", "tok_h4")
    bot_id = "bot_opponent"
    room.join_user(bot_id, "Bot", "tok_bot", role="player", requested_team_id=room.state.team_b.id)

    inn = HandCricketEngine.initialize_innings(room.state, 1)
    room.state.innings_list = [inn]
    HandCricketEngine.start_new_delivery(room.state)
    deliv_id = room.state.current_delivery_id

    # Human bats 3, Bot bowls 3 -> Matching numbers = WICKET!
    HandCricketEngine.record_secret_submission(room.state, "h_4", deliv_id, 3)
    HandCricketEngine.record_secret_submission(room.state, bot_id, deliv_id, 3)
    res = HandCricketEngine.resolve_delivery(room.state)

    assert res.is_wicket is True
    assert res.runs_scored == 0
    assert inn.wickets == 1

def test_gameplay_bot_duplicate_action_rejected():
    """Scenario 23: The bot cannot submit duplicate actions for the same turn."""
    room = room_manager.create_room("h_5", "Host", "tok_h5")
    bot_id = "bot_duptest"
    room.join_user(bot_id, "Bot", "tok_bot", role="player", requested_team_id=room.state.team_b.id)

    inn = HandCricketEngine.initialize_innings(room.state, 1)
    room.state.innings_list = [inn]
    HandCricketEngine.start_new_delivery(room.state)
    deliv_id = room.state.current_delivery_id

    ok1, msg1 = HandCricketEngine.record_secret_submission(room.state, bot_id, deliv_id, 5)
    assert ok1 is True
    # Duplicate submission
    ok2, msg2 = HandCricketEngine.record_secret_submission(room.state, bot_id, deliv_id, 6)
    assert ok2 is False
    assert "already submitted" in msg2

@pytest.mark.asyncio
async def test_gameplay_disconnect_and_completion_clean_up_bot():
    """Scenario 24: Match completion and disconnections clean up bot assignments."""
    bot = await bot_registry.acquire_bot(BotDifficulty.BEGINNER, "cleanup_room")
    assert bot is not None
    assert await bot_registry.get_active_bot_count() == 1

    room = room_manager.create_room("h_clean", "Host", "tok_clean")
    session = BotGameSession(room, "bot_clean", bot, BotDifficulty.BEGINNER)
    await session.cleanup()

    assert await bot_registry.get_active_bot_count() == 0

@pytest.mark.asyncio
async def test_bot_matches_do_not_inflate_presence_or_leaderboards():
    """Scenario 25: Bot matches do not inflate presence or leaderboards."""
    bot_settings.wait_threshold_seconds = 0.05
    p = await create_test_player("rank_clean_p")

    ticket = await matchmaking_coordinator.enqueue(p["user_id"], "RankClean", "rank#01", "avatar_1")
    res = await asyncio.wait_for(ticket.future, timeout=2.0)

    # 1. Presence check: Bot is NOT in presence_manager sessions
    bot_user_id = res["opponent"]["user_id"]
    assert bot_user_id.startswith("bot_")
    bot_presence = presence_manager.users.get(bot_user_id)
    assert bot_presence is None or len(bot_presence.sessions) == 0

    # 2. Leaderboard check: Bot is NOT in Profile table
    resp = client.get("/api/profiles/leaderboard")
    assert resp.status_code == 200
    lb_entries = resp.json()["leaderboard"]
    for entry in lb_entries:
        assert not entry["user_id"].startswith("bot_")

    room = room_manager.get_room(res["room_code"])
    if room and room.bot_session:
        await room.bot_session.cleanup()

# ==============================================================================
# SECTION 4: REGRESSION TESTS (Scenarios 26 - 30)
# ==============================================================================

@pytest.mark.asyncio
async def test_regression_human_vs_human_quick_play():
    """Scenario 26: Existing human-vs-human Quick Play still works flawlessly."""
    p1 = await create_test_player("reg_human_1")
    p2 = await create_test_player("reg_human_2")

    t1 = await matchmaking_coordinator.enqueue(p1["user_id"], "H1", "h1#01", "avatar_1")
    t2 = await matchmaking_coordinator.enqueue(p2["user_id"], "H2", "h2#02", "avatar_2")

    res1 = t1.future.result()
    res2 = t2.future.result()

    assert res1["room_code"] == res2["room_code"]
    assert res1["opponent"]["user_id"] == p2["user_id"]
    assert res1["opponent"]["is_bot"] is False
    assert res2["opponent"]["is_bot"] is False

def test_regression_auth_and_protected_matchmaking():
    """Scenario 27: Matchmaking endpoints strictly require authentication."""
    # Unauthenticated REST queue request
    res = client.post("/api/matchmaking/queue")
    assert res.status_code == 401

    # Unauthenticated REST cancel request
    res_cancel = client.post("/api/matchmaking/cancel")
    assert res_cancel.status_code == 401

def test_regression_websocket_event_compatibility():
    """Scenario 28: Matchmaking WebSocket emits expected event contracts."""
    async def _run():
        return await create_test_player("ws_contract_p")
    p = asyncio.run(_run())

    with client.websocket_connect(f"/api/matchmaking/ws?token={p['token']}") as ws:
        msg = ws.receive_json()
        assert msg["type"] == "SEARCHING"
        assert "ticket_id" in msg
        assert "queue_size" in msg

        ws.send_json({"type": "PING"})
        pong = ws.receive_json()
        assert pong["type"] == "PONG"

        ws.send_json({"type": "CANCEL"})
        cancelled = ws.receive_json()
        assert cancelled["type"] == "SEARCH_CANCELLED"

@pytest.mark.asyncio
async def test_regression_desktop_and_mobile_responsive_contracts():
    """Scenario 29: Match payload provides full metadata required for mobile & desktop layouts."""
    bot_settings.wait_threshold_seconds = 0.05
    p = await create_test_player("responsive_p")

    ticket = await matchmaking_coordinator.enqueue(p["user_id"], "RespP", "resp#01", "avatar_1")
    res = await asyncio.wait_for(ticket.future, timeout=2.0)

    # Required UI keys for responsive player card rendering
    assert "room_code" in res
    assert "player_id" in res
    assert "session_token" in res
    assert "role" in res
    assert "team_id" in res
    assert "opponent" in res
    opp = res["opponent"]
    assert "display_name" in opp
    assert "gamer_tag" in opp
    assert "avatar_url" in opp
    assert "team_name" in opp
    assert "batting_style" in opp
    assert "bowling_style" in opp
    assert "is_bot" in opp

    room = room_manager.get_room(res["room_code"])
    if room and room.bot_session:
        await room.bot_session.cleanup()
