import pytest
import asyncio
import time
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, save_completed_match
from app.rooms.manager import room_manager
from app.matchmaking.queue import matchmaking_coordinator

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_suite():
    asyncio.run(init_db())
    room_manager.rooms.clear()
    matchmaking_coordinator.queue.clear()
    yield

def register_user(username: str, email: str, display_name: str) -> str:
    r = client.post("/api/auth/register", json={
        "full_name": display_name,
        "username": username,
        "email": email,
        "password": "Password123!"
    })
    assert r.status_code == 200, r.text
    return r.json()["access_token"]

def test_series_creation_and_progression():
    token_a = register_user("series_user_a", "series_a@test.com", "Series Player A")
    token_b = register_user("series_user_b", "series_b@test.com", "Series Player B")

    # Get User B ID
    r_me_b = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_b}"})
    assert r_me_b.status_code == 200
    user_b_id = r_me_b.json()["user"]["id"]

    r_me_a = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token_a}"})
    assert r_me_a.status_code == 200
    user_a_id = r_me_a.json()["user"]["id"]

    # 1. Create Best-of-3 Series
    r_create = client.post("/api/series/create", json={
        "title": "Neon Rivals Derby",
        "opponent_id": user_b_id,
        "series_format": "BEST_OF_3",
        "overs_per_match": 3,
        "wickets_per_match": 2
    }, headers={"Authorization": f"Bearer {token_a}"})
    assert r_create.status_code == 200, r_create.text
    ser_data = r_create.json()
    series_id = ser_data["series_id"]
    room_code_1 = ser_data["room_code"]
    assert ser_data["total_scheduled_matches"] == 3
    assert ser_data["target_wins"] == 2

    # Verify series details
    r_get = client.get(f"/api/series/{series_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert r_get.status_code == 200
    assert r_get.json()["series"]["status"] == "ACTIVE"
    assert r_get.json()["series"]["creator_wins"] == 0

    # 2. Simulate Match 1 Completion: Player A wins
    mock_state_1 = {
        "match_id": f"m_ser_1_{int(time.time())}",
        "room_code": room_code_1,
        "series_id": series_id,
        "player_1_user_id": user_a_id,
        "player_2_user_id": user_b_id,
        "team_a": {"id": "t1", "name": "Team Alpha"},
        "team_b": {"id": "t2", "name": "Team Beta"},
        "winner_team_id": "t1",
        "win_margin_description": "Team Alpha won by 15 runs",
        "innings_list": []
    }
    asyncio.run(save_completed_match(mock_state_1, player_1_user_id=user_a_id, player_2_user_id=user_b_id, match_type="SERIES"))

    # Check series scoreline: Player A has 1 win
    r_check_1 = client.get(f"/api/series/{series_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert r_check_1.status_code == 200
    s1 = r_check_1.json()["series"]
    assert s1["matches_played"] == 1
    assert s1["creator_wins"] == 1
    assert s1["opponent_wins"] == 0
    assert s1["status"] == "ACTIVE"

    # 3. Start Next Match (Match 2)
    r_next = client.post(f"/api/series/{series_id}/next-match", headers={"Authorization": f"Bearer {token_a}"})
    assert r_next.status_code == 200
    room_code_2 = r_next.json()["room_code"]
    assert room_code_2 != room_code_1

    # 4. Simulate Match 2 Completion: Player A wins again -> Best of 3 Won!
    mock_state_2 = {
        "match_id": f"m_ser_2_{int(time.time())}",
        "room_code": room_code_2,
        "series_id": series_id,
        "player_1_user_id": user_a_id,
        "player_2_user_id": user_b_id,
        "team_a": {"id": "t1", "name": "Team Alpha"},
        "team_b": {"id": "t2", "name": "Team Beta"},
        "winner_team_id": "t1",
        "win_margin_description": "Team Alpha won by 4 wickets",
        "innings_list": []
    }
    asyncio.run(save_completed_match(mock_state_2, player_1_user_id=user_a_id, player_2_user_id=user_b_id, match_type="SERIES"))

    # Check series: should now be COMPLETED with winner_id == user_a_id
    r_check_2 = client.get(f"/api/series/{series_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert r_check_2.status_code == 200
    s2 = r_check_2.json()["series"]
    assert s2["matches_played"] == 2
    assert s2["creator_wins"] == 2
    assert s2["status"] == "COMPLETED"
    assert s2["winner_id"] == user_a_id

def test_tournament_knockout_lifecycle():
    token_1 = register_user("tourn_p1", "tp1@test.com", "Tournament P1")
    token_2 = register_user("tourn_p2", "tp2@test.com", "Tournament P2")
    token_3 = register_user("tourn_p3", "tp3@test.com", "Tournament P3")
    token_4 = register_user("tourn_p4", "tp4@test.com", "Tournament P4")

    # 1. Organizer creates 4-player Knockout Tournament
    r_create = client.post("/api/tournaments/create", json={
        "title": "Championship Cup",
        "tournament_format": "KNOCKOUT",
        "max_participants": 4,
        "overs_per_match": 2,
        "wickets_per_match": 3
    }, headers={"Authorization": f"Bearer {token_1}"})
    assert r_create.status_code == 200, r_create.text
    t_data = r_create.json()
    t_id = t_data["tournament_id"]

    # 2. Players 2, 3, 4 join
    r_j2 = client.post(f"/api/tournaments/{t_id}/join", headers={"Authorization": f"Bearer {token_2}"})
    assert r_j2.status_code == 200
    r_j3 = client.post(f"/api/tournaments/{t_id}/join", headers={"Authorization": f"Bearer {token_3}"})
    assert r_j3.status_code == 200
    r_j4 = client.post(f"/api/tournaments/{t_id}/join", headers={"Authorization": f"Bearer {token_4}"})
    assert r_j4.status_code == 200

    # 3. Start tournament
    r_start = client.post(f"/api/tournaments/{t_id}/start", headers={"Authorization": f"Bearer {token_1}"})
    assert r_start.status_code == 200

    # 4. Inspect fixtures
    r_detail = client.get(f"/api/tournaments/{t_id}")
    assert r_detail.status_code == 200
    fixtures = r_detail.json()["fixtures"]
    assert len(fixtures) == 3 # 2 Semifinals + 1 Final

    # Find Semifinal 1
    sf1 = [f for f in fixtures if f["round_number"] == 1 and f["match_index"] == 1][0]
    assert sf1["status"] == "READY"
    assert sf1["player_1_id"] is not None
    assert sf1["player_2_id"] is not None

    # 5. Launch room for Semifinal 1
    r_room = client.post(f"/api/tournaments/fixture/{sf1['id']}/create-room", headers={"Authorization": f"Bearer {token_1}"})
    assert r_room.status_code == 200
    room_code = r_room.json()["room_code"]

    # 6. Complete Semifinal 1: Player 1 wins
    p1_id = sf1["player_1_id"]
    p2_id = sf1["player_2_id"]
    mock_state = {
        "match_id": f"m_trn_sf1_{int(time.time())}",
        "room_code": room_code,
        "tournament_id": t_id,
        "player_1_user_id": p1_id,
        "player_2_user_id": p2_id,
        "team_a": {"id": "t1", "name": "Player 1 Team"},
        "team_b": {"id": "t2", "name": "Player 2 Team"},
        "winner_team_id": "t1",
        "win_margin_description": "Player 1 Team won by 10 runs",
        "innings_list": []
    }
    asyncio.run(save_completed_match(mock_state, player_1_user_id=p1_id, player_2_user_id=p2_id, match_type="TOURNAMENT"))

    # Verify that SF1 is completed and Player 1 is advanced into the Final fixture!
    r_after = client.get(f"/api/tournaments/{t_id}")
    fixtures_after = r_after.json()["fixtures"]
    sf1_after = [f for f in fixtures_after if f["id"] == sf1["id"]][0]
    assert sf1_after["status"] == "COMPLETED"
    assert sf1_after["winner_id"] == p1_id

    final_fix = [f for f in fixtures_after if f["round_number"] == 2][0]
    assert final_fix["player_1_id"] == p1_id # Winner advanced!

def test_custom_match_settings_and_team_customization():
    token_host = register_user("settings_host", "shost@test.com", "Settings Host")

    # 1. Create Room
    r_create = client.post("/api/rooms/create", json={
        "host_name": "Settings Host",
        "rules": {
            "overs_per_innings": 5,
            "wickets_per_innings": 4,
            "decision_timer_seconds": 8
        }
    }, headers={"Authorization": f"Bearer {token_host}"})
    assert r_create.status_code == 200
    room_code = r_create.json()["room_code"]
    host_token = r_create.json()["session_token"]
    player_id = r_create.json()["player_id"]

    # 2. Connect via WebSocket and test UPDATE_RULES and UPDATE_TEAM_CUSTOM
    with client.websocket_connect(f"/ws/{room_code}?player_id={player_id}&session_token={host_token}") as ws:
        init_msg = ws.receive_json()
        assert init_msg["type"] == "INITIAL_STATE"
        assert init_msg["state"]["rules"]["overs_per_innings"] == 5

        # Update rules to custom values with bounds checking
        ws.send_json({
            "type": "UPDATE_RULES",
            "rules": {
                "overs_per_innings": 20,
                "wickets_per_innings": 10,
                "decision_timer_seconds": 10
            }
        })
        upd_msg = ws.receive_json()
        assert upd_msg["type"] == "STATE_UPDATE"
        assert upd_msg["state"]["rules"]["overs_per_innings"] == 20
        assert upd_msg["state"]["rules"]["wickets_per_innings"] == 10
        assert upd_msg["state"]["rules"]["decision_timer_seconds"] == 10

        # Update custom team details and custom player roster
        ws.send_json({
            "type": "UPDATE_TEAM_CUSTOM",
            "team": "team_a",
            "name": "Mumbai Mavericks",
            "color": "#FFD900",
            "accent_color": "#6500C8",
            "players": [
                {"id": "p1", "name": "Nishit Parikh", "role": "batsman", "batting_order": 1, "bowling_order": 5},
                {"id": "p2", "name": "Shadow Striker", "role": "all_rounder", "batting_order": 2, "bowling_order": 1}
            ]
        })
        team_msg = ws.receive_json()
        assert team_msg["type"] == "STATE_UPDATE"
        assert team_msg["state"]["team_a"]["name"] == "Mumbai Mavericks"
        assert team_msg["state"]["team_a"]["color"] == "#FFD900"
        assert len(team_msg["state"]["team_a"]["players"]) == 2
        assert team_msg["state"]["team_a"]["players"][0]["name"] == "Nishit Parikh"

