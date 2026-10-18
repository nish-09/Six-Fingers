import pytest
import time
from fastapi.testclient import TestClient
from app.main import app
from app.rooms.manager import room_manager
from app.engine.hand_cricket import HandCricketEngine
from app.models.game import MatchPhase
from app.database import save_completed_match

client = TestClient(app)

def test_production_health_and_readiness():
    # 1. Liveness
    r_live = client.get("/health/live")
    assert r_live.status_code == 200
    assert r_live.json()["status"] == "ok"

    # 2. Readiness (verifies DB connectivity)
    r_ready = client.get("/health/ready")
    assert r_ready.status_code == 200
    data = r_ready.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"

def test_operational_metrics_endpoint():
    r_metrics = client.get("/api/metrics")
    assert r_metrics.status_code == 200
    data = r_metrics.json()
    assert "active_rooms" in data
    assert "connected_clients" in data
    assert "connected_players" in data
    assert "spectators" in data
    assert "rooms" in data

def test_match_history_pagination_and_detail():
    # Save a test match
    from app.database import init_db
    import asyncio
    asyncio.run(init_db())

    sample_match_id = f"test_match_{int(time.time())}"
    sample_state = {
        "match_id": sample_match_id,
        "room_code": "TEST88",
        "team_a": {"id": "t1", "name": "Titans"},
        "team_b": {"id": "t2", "name": "Warriors"},
        "winner_team_id": "t1",
        "win_margin_description": "Titans won by 15 runs!",
        "innings_list": [
            {"total_runs": 25, "wickets": 1, "deliveries": [{"runs_scored": 6}]},
            {"total_runs": 10, "wickets": 2, "deliveries": [{"runs_scored": 0}]}
        ]
    }

    # 1. Test safe upsert: Call twice to ensure no duplicate key crash
    asyncio.run(save_completed_match(sample_state))
    sample_state["win_margin_description"] = "Titans won by 15 runs! (Updated)"
    asyncio.run(save_completed_match(sample_state))

    # 2. Query history with pagination
    r_hist = client.get("/api/history?limit=10&offset=0")
    assert r_hist.status_code == 200
    hist_data = r_hist.json()
    assert "history" in hist_data
    assert hist_data["limit"] == 10
    assert hist_data["offset"] == 0
    assert any(m["id"] == sample_match_id for m in hist_data["history"])

    # 3. Query match detail
    r_detail = client.get(f"/api/matches/{sample_match_id}")
    assert r_detail.status_code == 200
    detail_data = r_detail.json()
    assert detail_data["match"]["match_id"] == sample_match_id
    assert "Titans" in detail_data["match"]["team_a"]["name"]

    # 4. Non-existent match returns 404
    r_404 = client.get("/api/matches/non_existent_id")
    assert r_404.status_code == 404

def test_multiple_simultaneous_rooms_isolation():
    """
    Verifies that multiple rooms (Room A, Room B, Room C) run concurrently
    with independent states, deliveries, and spectators without cross-contamination.
    """
    # Create Room A
    r_a = client.post("/api/rooms/create", json={"host_name": "Alice"}).json()
    code_a = r_a["room_code"]
    p_a1, tok_a1 = r_a["player_id"], r_a["session_token"]

    r_a2 = client.post("/api/rooms/join", json={"room_code": code_a, "player_name": "Bob"}).json()
    p_a2, tok_a2 = r_a2["player_id"], r_a2["session_token"]

    # Create Room B
    r_b = client.post("/api/rooms/create", json={"host_name": "Charlie"}).json()
    code_b = r_b["room_code"]
    p_b1, tok_b1 = r_b["player_id"], r_b["session_token"]

    r_b2 = client.post("/api/rooms/join", json={"room_code": code_b, "player_name": "David"}).json()
    p_b2, tok_b2 = r_b2["player_id"], r_b2["session_token"]

    # Add spectator to Room A
    r_spec_a = client.post("/api/rooms/join", json={"room_code": code_a, "player_name": "WatcherA", "role": "spectator"}).json()

    room_a = room_manager.get_room(code_a)
    room_b = room_manager.get_room(code_b)

    assert room_a.state.spectator_count == 1
    assert room_b.state.spectator_count == 0

    # Initialize Innings on Room A only
    room_a.state.toss_decision = "bat"
    room_a.state.toss_winner_id = p_a1
    inn_a = HandCricketEngine.initialize_innings(room_a.state, 1)
    room_a.state.innings_list = [inn_a]
    room_a.state.current_innings_number = 1
    HandCricketEngine.start_new_delivery(room_a.state)

    # Room B remains in LOBBY with no innings started
    assert room_a.state.phase == MatchPhase.DECISION
    assert room_b.state.phase == MatchPhase.LOBBY
    assert len(room_b.state.innings_list) == 0

    # Delivery in Room A does NOT affect Room B
    deliv_a = room_a.state.current_delivery_id
    HandCricketEngine.record_secret_submission(room_a.state, p_a1, deliv_a, 6)
    HandCricketEngine.record_secret_submission(room_a.state, p_a2, deliv_a, 4)
    res_a = HandCricketEngine.resolve_delivery(room_a.state)

    assert res_a.runs_scored == 6
    assert inn_a.total_runs == 6
    assert room_b.state.phase == MatchPhase.LOBBY
    assert len(room_b.state.innings_list) == 0

    # Inactive room cleanup check: Room with active clients is NOT deleted
    cleaned = room_manager.cleanup_inactive_rooms(max_idle_seconds=0.0001)
    # Both rooms have connections, so neither should be deleted
    assert room_manager.get_room(code_a) is not None
    assert room_manager.get_room(code_b) is not None
