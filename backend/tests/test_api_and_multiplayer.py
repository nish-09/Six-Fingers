import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.rooms.manager import room_manager
from app.models.game import MatchPhase

client = TestClient(app)

def test_health():
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_create_and_join_room():
    # 1. Create room
    res1 = client.post("/api/rooms/create", json={"host_name": "Sachin"})
    assert res1.status_code == 200
    data1 = res1.json()
    room_code = data1["room_code"]
    host_id = data1["player_id"]
    host_token = data1["session_token"]
    assert len(room_code) == 6

    # 2. Join room
    res2 = client.post("/api/rooms/join", json={"room_code": room_code, "player_name": "Brian"})
    assert res2.status_code == 200
    data2 = res2.json()
    guest_id = data2["player_id"]
    guest_token = data2["session_token"]

    # 3. Third player rejection
    res3 = client.post("/api/rooms/join", json={"room_code": room_code, "player_name": "ThirdPerson"})
    assert res3.status_code == 403

    # 4. Check room info
    res4 = client.get(f"/api/rooms/{room_code}")
    assert res4.status_code == 200
    info = res4.json()
    assert info["player_1_name"] == "Sachin"
    assert info["player_2_name"] == "Brian"

def test_secret_lock_isolation_and_simultaneous_reveal():
    # Create room
    r1 = client.post("/api/rooms/create", json={"host_name": "PlayerA"}).json()
    code = r1["room_code"]
    p1_id, p1_tok = r1["player_id"], r1["session_token"]

    r2 = client.post("/api/rooms/join", json={"room_code": code, "player_name": "PlayerB"}).json()
    p2_id, p2_tok = r2["player_id"], r2["session_token"]

    room = room_manager.get_room(code)
    assert room is not None

    # Connect Player A
    with client.websocket_connect(f"/ws/{code}?player_id={p1_id}&session_token={p1_tok}") as ws_a:
        init_a = ws_a.receive_json()
        assert init_a["type"] == "INITIAL_STATE"

        # Connect Player B
        with client.websocket_connect(f"/ws/{code}?player_id={p2_id}&session_token={p2_tok}") as ws_b:
            init_b = ws_b.receive_json()
            assert init_b["type"] == "INITIAL_STATE"

            # Player A gets PLAYER_CONNECTED
            conn_msg = ws_a.receive_json()
            assert conn_msg["type"] == "PLAYER_CONNECTED"

            # Both ready in lobby
            ws_a.send_json({"type": "SET_LOBBY_READY", "ready": True})
            ws_a.receive_json() # state update A
            ws_b.receive_json() # state update B for A ready

            ws_b.send_json({"type": "SET_LOBBY_READY", "ready": True})
            ws_b.receive_json() # state update B
            ws_a.receive_json() # state update A for B ready

            # Match is now in TOSS
            ws_a.send_json({"type": "DO_TOSS", "call": "heads"})
            toss_res_a = ws_a.receive_json()
            toss_res_b = ws_b.receive_json()
            assert toss_res_a["type"] == "TOSS_RESULT"

            winner_id = toss_res_a["toss_winner_id"]
            ws_winner = ws_a if winner_id == p1_id else ws_b
            ws_loser = ws_b if winner_id == p1_id else ws_a

            ws_winner.send_json({"type": "TOSS_DECISION", "decision": "bat"})
            started_a = ws_a.receive_json()
            started_b = ws_b.receive_json()
            assert started_a["type"] == "MATCH_STARTED"

            # Now in DECISION phase!
            deliv_id = started_a["state"]["current_delivery_id"]

            # Player A submits secret choice (e.g. 6)
            ws_a.send_json({
                "type": "SUBMIT_HAND",
                "delivery_id": deliv_id,
                "chosen_number": 6
            })

            # Player A receives confirmation with their number
            ack_a = ws_a.receive_json()
            assert ack_a["type"] == "SECRET_LOCKED"
            assert ack_a["chosen_number"] == 6

            # Player B receives OPPONENT_LOCKED without Player A's number!
            opp_locked = ws_b.receive_json()
            assert opp_locked["type"] == "OPPONENT_LOCKED"
            assert "chosen_number" not in opp_locked # CRITICAL PRIVACY VERIFICATION

            # Now Player B submits (e.g. 6 -> matching numbers -> wicket)
            ws_b.send_json({
                "type": "SUBMIT_HAND",
                "delivery_id": deliv_id,
                "chosen_number": 6
            })

            ack_b = ws_b.receive_json()
            assert ack_b["type"] == "SECRET_LOCKED"

            # Player A receives OPPONENT_LOCKED for Player B locking
            opp_b_locked = ws_a.receive_json()
            assert opp_b_locked["type"] == "OPPONENT_LOCKED"

            # Both players now receive SIMULTANEOUS_REVEAL with both numbers!
            rev_a = ws_a.receive_json()
            rev_b = ws_b.receive_json()
            assert rev_a["type"] == "SIMULTANEOUS_REVEAL"
            assert rev_b["type"] == "SIMULTANEOUS_REVEAL"
            assert rev_a["delivery_result"]["batsman_number"] == 6
            assert rev_a["delivery_result"]["bowler_number"] == 6
            assert rev_a["delivery_result"]["is_wicket"] is True
            assert rev_a["delivery_result"]["runs_scored"] == 0
            assert "commentary" in rev_a
