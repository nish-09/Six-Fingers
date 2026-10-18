import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.rooms.manager import room_manager
from app.engine.hand_cricket import HandCricketEngine
from app.models.game import MatchPhase, UserRole, RotationMode

client = TestClient(app)

def test_spectator_join_and_limits():
    # 1. Create room
    res1 = client.post("/api/rooms/create", json={"host_name": "HostPlayer"})
    assert res1.status_code == 200
    code = res1.json()["room_code"]
    room = room_manager.get_room(code)
    assert room is not None
    room.state.rules.max_spectators = 3 # test limit

    # 2. Join 3 spectators
    specs = []
    for i in range(3):
        res = client.post("/api/rooms/join", json={
            "room_code": code,
            "player_name": f"Spec_{i+1}",
            "role": "spectator"
        })
        assert res.status_code == 200
        data = res.json()
        assert data["role"] == "spectator"
        specs.append(data)

    assert room.state.spectator_count == 3
    assert len(room.state.spectators) == 3

    # 3. 4th spectator rejected due to capacity limit
    res_overflow = client.post("/api/rooms/join", json={
        "room_code": code,
        "player_name": "Spec_Overflow",
        "role": "spectator"
    })
    assert res_overflow.status_code == 403
    assert "limit" in res_overflow.json()["detail"].lower()

def test_spectators_cannot_submit_or_change_rules_and_privacy_verified():
    # Setup room with 2 players and 1 spectator
    r_host = client.post("/api/rooms/create", json={"host_name": "Nishit"}).json()
    code = r_host["room_code"]
    p1_id, p1_tok = r_host["player_id"], r_host["session_token"]

    r_guest = client.post("/api/rooms/join", json={
        "room_code": code,
        "player_name": "Kaushal",
        "role": "player"
    }).json()
    p2_id, p2_tok = r_guest["player_id"], r_guest["session_token"]

    r_spec = client.post("/api/rooms/join", json={
        "room_code": code,
        "player_name": "AaravSpec",
        "role": "spectator"
    }).json()
    spec_id, spec_tok = r_spec["player_id"], r_spec["session_token"]

    with client.websocket_connect(f"/ws/{code}?player_id={p1_id}&session_token={p1_tok}") as ws_p1:
        ws_p1.receive_json() # init

        with client.websocket_connect(f"/ws/{code}?player_id={p2_id}&session_token={p2_tok}") as ws_p2:
            ws_p2.receive_json() # init
            ws_p1.receive_json() # p2 connected

            with client.websocket_connect(f"/ws/{code}?player_id={spec_id}&session_token={spec_tok}") as ws_spec:
                spec_init = ws_spec.receive_json()
                assert spec_init["type"] == "INITIAL_STATE"
                assert spec_init["role"] == "spectator"
                assert spec_init["state"]["spectator_count"] == 1

                # Drain spectator joined notifications
                ws_p1.receive_json()
                ws_p2.receive_json()

                # Spectator attempts to modify rules -> should be ignored
                ws_spec.send_json({
                    "type": "UPDATE_RULES",
                    "rules": {"overs_per_innings": 10}
                })
                room = room_manager.get_room(code)
                assert room.state.rules.overs_per_innings != 10

                # Both players ready up in lobby
                ws_p1.send_json({"type": "SET_LOBBY_READY", "ready": True})
                ws_p1.receive_json()
                ws_p2.receive_json()
                ws_spec.receive_json()

                ws_p2.send_json({"type": "SET_LOBBY_READY", "ready": True})
                ws_p2.receive_json()
                ws_p1.receive_json()
                ws_spec.receive_json()

                assert room.state.phase == MatchPhase.TOSS

                # Toss
                ws_p1.send_json({"type": "DO_TOSS", "call": "heads"})
                toss_a = ws_p1.receive_json()
                toss_b = ws_p2.receive_json()
                ws_spec.receive_json()

                winner_id = toss_a["toss_winner_id"]
                ws_winner = ws_p1 if winner_id == p1_id else ws_p2
                ws_winner.send_json({"type": "TOSS_DECISION", "decision": "bat"})

                started_1 = ws_p1.receive_json()
                ws_p2.receive_json()
                ws_spec.receive_json()

                assert room.state.phase == MatchPhase.DECISION
                deliv_id = room.state.current_delivery_id
                active_bat = started_1["state"]["active_batting_controller_id"]
                active_bowl = started_1["state"]["active_bowling_controller_id"]
                ws_bat = ws_p1 if active_bat == p1_id else ws_p2
                ws_bowl = ws_p2 if active_bowl == p2_id else ws_p1

                # Spectator attempts to submit a hand -> rejected!
                ws_spec.send_json({
                    "type": "SUBMIT_HAND",
                    "delivery_id": deliv_id,
                    "chosen_number": 4
                })
                spec_err = ws_spec.receive_json()
                assert spec_err["type"] == "SUBMISSION_ERROR"
                assert "active batting and bowling controllers" in spec_err["message"]

                # Active Batter submits secret choice 4
                ws_bat.send_json({
                    "type": "SUBMIT_HAND",
                    "delivery_id": deliv_id,
                    "chosen_number": 4
                })

                bat_ack = ws_bat.receive_json()
                assert bat_ack["type"] == "SECRET_LOCKED"
                assert bat_ack["chosen_number"] == 4

                # Opponent (Bowler) gets neutral OPPONENT_LOCKED (no number!)
                bowl_locked = ws_bowl.receive_json()
                assert bowl_locked["type"] == "OPPONENT_LOCKED"
                assert "chosen_number" not in bowl_locked

                # Spectator gets neutral CONTROLLER_LOCKED (NO NUMBER LEAK!)
                spec_locked = ws_spec.receive_json()
                assert spec_locked["type"] == "CONTROLLER_LOCKED"
                assert "chosen_number" not in spec_locked
                assert spec_locked["role"] == "batting"

                # Check sanitized state for spectator: number is strictly None!
                sanitized_spec = room_manager.sanitize_state_for_player(room.state, spec_id)
                assert sanitized_spec["my_chosen_number"] is None
                assert "pending_submissions" not in sanitized_spec
                assert sanitized_spec["active_batting_controller_locked"] is True
                assert sanitized_spec["active_bowling_controller_locked"] is False

                # Active Bowler submits 2 -> 4 runs scored
                ws_bowl.send_json({
                    "type": "SUBMIT_HAND",
                    "delivery_id": deliv_id,
                    "chosen_number": 2
                })
                ws_bowl.receive_json() # Bowl ack
                ws_bat.receive_json() # Bat gets opponent locked
                ws_spec.receive_json() # Spec gets controller locked

                # All clients, including spectator, receive SIMULTANEOUS_REVEAL!
                rev_p1 = ws_p1.receive_json()
                rev_p2 = ws_p2.receive_json()
                rev_spec = ws_spec.receive_json()

                assert rev_spec["type"] == "SIMULTANEOUS_REVEAL"
                assert rev_spec["delivery_result"]["batsman_number"] == 4
                assert rev_spec["delivery_result"]["bowler_number"] == 2
                assert rev_spec["delivery_result"]["runs_scored"] == 4
                assert rev_spec["delivery_result"]["is_wicket"] is False
                assert rev_spec["delivery_result"]["innings_total_runs"] == 4
                assert "commentary" in rev_spec

def test_spectator_disconnection_does_not_interrupt_match():
    r_host = client.post("/api/rooms/create", json={"host_name": "Player1"}).json()
    code = r_host["room_code"]
    p1_id, p1_tok = r_host["player_id"], r_host["session_token"]

    r_spec = client.post("/api/rooms/join", json={
        "room_code": code,
        "player_name": "Spectator1",
        "role": "spectator"
    }).json()
    spec_id, spec_tok = r_spec["player_id"], r_spec["session_token"]

    room = room_manager.get_room(code)
    assert room.state.spectator_count == 1

    with client.websocket_connect(f"/ws/{code}?player_id={p1_id}&session_token={p1_tok}") as ws_p1:
        ws_p1.receive_json() # init

        with client.websocket_connect(f"/ws/{code}?player_id={spec_id}&session_token={spec_tok}") as ws_spec:
            ws_spec.receive_json() # spec init
            ws_p1.receive_json() # spec joined

        # ws_spec disconnects here
        leave_msg = ws_p1.receive_json()
        assert leave_msg["type"] == "SPECTATOR_LEFT"
        assert leave_msg["spectator_count"] == 0
        assert room.state.spectator_count == 0
        # Room phase remains intact
        assert room.state.phase == MatchPhase.LOBBY

def test_team_cricket_membership_and_over_rotation():
    # 4 Players: Nishit & Shivam on Team A, Kaushal & Hardik on Team B
    r_p1 = client.post("/api/rooms/create", json={"host_name": "Nishit"}).json()
    code = r_p1["room_code"]
    p1_id, p1_tok = r_p1["player_id"], r_p1["session_token"]
    room = room_manager.get_room(code)
    room.state.rules.players_per_team = 2
    room.state.rules.overs_per_innings = 2
    room.state.rules.balls_per_over = 2 # 2 balls per over for fast test

    # P2: Shivam joins Team A
    r_p2 = client.post("/api/rooms/join", json={
        "room_code": code,
        "player_name": "Shivam",
        "role": "player",
        "team_id": room.state.team_a.id
    }).json()
    p2_id, p2_tok = r_p2["player_id"], r_p2["session_token"]

    # P3: Kaushal joins Team B
    r_p3 = client.post("/api/rooms/join", json={
        "room_code": code,
        "player_name": "Kaushal",
        "role": "player",
        "team_id": room.state.team_b.id
    }).json()
    p3_id, p3_tok = r_p3["player_id"], r_p3["session_token"]

    # P4: Hardik joins Team B
    r_p4 = client.post("/api/rooms/join", json={
        "room_code": code,
        "player_name": "Hardik",
        "role": "player",
        "team_id": room.state.team_b.id
    }).json()
    p4_id, p4_tok = r_p4["player_id"], r_p4["session_token"]

    # Verify team membership
    assert room.state.team_a.human_player_ids == [p1_id, p2_id]
    assert room.state.team_b.human_player_ids == [p3_id, p4_id]

    # Verify controllers rotation for Team A (batting) and Team B (bowling):
    # Innings 1: Team A bats, Team B bowls
    room.state.toss_decision = "bat"
    room.state.toss_winner_id = p1_id
    room.state.phase = MatchPhase.DECISION

    inn1 = HandCricketEngine.initialize_innings(room.state, 1)
    room.state.innings_list = [inn1]
    room.state.current_innings_number = 1
    HandCricketEngine.start_new_delivery(room.state)

    # Over 0: Batting controller must be Nishit (P1), Bowling controller must be Kaushal (P3)
    assert room.state.active_batting_controller_id == p1_id
    assert room.state.active_bowling_controller_id == p3_id
    # Next over preview: Batting controller Shivam (P2), Bowling controller Hardik (P4)
    assert room.state.next_batting_controller_id == p2_id
    assert room.state.next_bowling_controller_id == p4_id

    # Ball 1 of Over 0:
    # Unauthorized teammate (Shivam P2) tries to submit -> REJECTED!
    ok, msg = HandCricketEngine.record_secret_submission(
        room.state, p2_id, room.state.current_delivery_id, 4
    )
    assert ok is False
    assert "Only active batting and bowling controllers" in msg

    # Unauthorized opponent teammate (Hardik P4) tries to submit -> REJECTED!
    ok, msg = HandCricketEngine.record_secret_submission(
        room.state, p4_id, room.state.current_delivery_id, 2
    )
    assert ok is False
    assert "Only active batting and bowling controllers" in msg

    # Active controllers submit: Nishit (P1) submits 4, Kaushal (P3) submits 2
    ok1, _ = HandCricketEngine.record_secret_submission(
        room.state, p1_id, room.state.current_delivery_id, 4
    )
    ok2, _ = HandCricketEngine.record_secret_submission(
        room.state, p3_id, room.state.current_delivery_id, 2
    )
    assert ok1 is True
    assert ok2 is True

    deliv1 = HandCricketEngine.resolve_delivery(room.state)
    assert deliv1 is not None
    assert deliv1.runs_scored == 4
    assert deliv1.batting_controller_id == p1_id
    assert deliv1.bowling_controller_id == p3_id
    assert inn1.balls_bowled == 1

    # Ready for ball 2 of over 0
    HandCricketEngine.set_player_ready_for_next(room.state, p1_id)
    HandCricketEngine.set_player_ready_for_next(room.state, p3_id)
    assert room.state.phase == MatchPhase.DECISION

    # Ball 2 of Over 0: Active controllers are still P1 and P3
    assert room.state.active_batting_controller_id == p1_id
    assert room.state.active_bowling_controller_id == p3_id

    HandCricketEngine.record_secret_submission(room.state, p1_id, room.state.current_delivery_id, 6)
    HandCricketEngine.record_secret_submission(room.state, p3_id, room.state.current_delivery_id, 1)
    deliv2 = HandCricketEngine.resolve_delivery(room.state)
    assert deliv2.runs_scored == 6
    assert inn1.balls_bowled == 2 # OVER COMPLETE!

    # Upcoming controllers preview for Over 1 are Shivam (P2) and Hardik (P4)
    assert room.state.next_batting_controller_id == p2_id
    assert room.state.next_bowling_controller_id == p4_id

    # Over complete triggers OVER_BREAK on ready-up from current controllers
    HandCricketEngine.set_player_ready_for_next(room.state, p1_id)
    HandCricketEngine.set_player_ready_for_next(room.state, p3_id)
    assert room.state.phase == MatchPhase.OVER_BREAK

    # Now in OVER_BREAK, active controllers have rotated to Shivam (P2) and Hardik (P4)!
    assert room.state.active_batting_controller_id == p2_id
    assert room.state.active_bowling_controller_id == p4_id

    # Controllers for Over 1 ready up during OVER_BREAK
    HandCricketEngine.set_over_transition_ready(room.state, p2_id)
    HandCricketEngine.set_over_transition_ready(room.state, p4_id)
    assert room.state.phase == MatchPhase.DECISION

    # In Over 1: Shivam (P2) is batting controller, Hardik (P4) is bowling controller!
    assert room.state.active_batting_controller_id == p2_id
    assert room.state.active_bowling_controller_id == p4_id

    # Nishit (P1) is no longer active controller this over -> submission rejected!
    ok, msg = HandCricketEngine.record_secret_submission(
        room.state, p1_id, room.state.current_delivery_id, 3
    )
    assert ok is False

    # Shivam (P2) and Hardik (P4) submit
    HandCricketEngine.record_secret_submission(room.state, p2_id, room.state.current_delivery_id, 3)
    HandCricketEngine.record_secret_submission(room.state, p4_id, room.state.current_delivery_id, 1)
    deliv3 = HandCricketEngine.resolve_delivery(room.state)
    assert deliv3.runs_scored == 3
    assert deliv3.batting_controller_id == p2_id
    assert deliv3.bowling_controller_id == p4_id

def test_chat_and_social_reactions():
    r1 = client.post("/api/rooms/create", json={"host_name": "Chatter1"}).json()
    code = r1["room_code"]
    p1_id, p1_tok = r1["player_id"], r1["session_token"]

    r2 = client.post("/api/rooms/join", json={
        "room_code": code,
        "player_name": "Chatter2",
        "role": "player"
    }).json()
    p2_id, p2_tok = r2["player_id"], r2["session_token"]

    with client.websocket_connect(f"/ws/{code}?player_id={p1_id}&session_token={p1_tok}") as ws_p1:
        ws_p1.receive_json()

        with client.websocket_connect(f"/ws/{code}?player_id={p2_id}&session_token={p2_tok}") as ws_p2:
            ws_p2.receive_json()
            ws_p1.receive_json()

            # Send chat message with reaction
            ws_p1.send_json({
                "type": "SEND_CHAT",
                "channel": "all",
                "text": "What a game! Six Fingers rocks!",
                "reaction": "🚀"
            })

            chat1 = ws_p1.receive_json()
            chat2 = ws_p2.receive_json()
            assert chat1["type"] == "CHAT_MESSAGE"
            assert chat2["type"] == "CHAT_MESSAGE"
            assert chat2["message"]["text"] == "What a game! Six Fingers rocks!"
            assert chat2["message"]["reaction"] == "🚀"
            assert chat2["message"]["sender_name"] == "Chatter1"

def test_complete_end_to_end_team_cricket_with_spectators():
    """
    Comprehensive End-to-End Test meeting Section 11 specifications:
    - Create room with host
    - Join 3 additional players (2 players per team)
    - Join spectators
    - Start match via toss
    - Play first over: verify first controllers act, hidden numbers isolated
    - Complete over: verify controller rotation to next teammates
    - Complete Innings 1: verify target calculation
    - Switch innings: verify team roles reverse
    - Play Innings 2: verify wicket and target chase resolution
    - Complete match and verify final scorecard
    """
    # 1. Create Room (Nishit - Team A Host)
    r_host = client.post("/api/rooms/create", json={"host_name": "Nishit"}).json()
    code = r_host["room_code"]
    p1_id, p1_tok = r_host["player_id"], r_host["session_token"]
    room = room_manager.get_room(code)
    room.state.rules.players_per_team = 2
    room.state.rules.overs_per_innings = 2
    room.state.rules.balls_per_over = 1 # 1 ball per over for concise E2E flow
    room.state.rules.wickets_per_innings = 2

    # 2. Join Players
    # Shivam joins Team A
    r_p2 = client.post("/api/rooms/join", json={
        "room_code": code,
        "player_name": "Shivam",
        "role": "player",
        "team_id": room.state.team_a.id
    }).json()
    p2_id, p2_tok = r_p2["player_id"], r_p2["session_token"]

    # Kaushal joins Team B
    r_p3 = client.post("/api/rooms/join", json={
        "room_code": code,
        "player_name": "Kaushal",
        "role": "player",
        "team_id": room.state.team_b.id
    }).json()
    p3_id, p3_tok = r_p3["player_id"], r_p3["session_token"]

    # Hardik joins Team B
    r_p4 = client.post("/api/rooms/join", json={
        "room_code": code,
        "player_name": "Hardik",
        "role": "player",
        "team_id": room.state.team_b.id
    }).json()
    p4_id, p4_tok = r_p4["player_id"], r_p4["session_token"]

    # 3. Join Spectators
    r_spec1 = client.post("/api/rooms/join", json={
        "room_code": code,
        "player_name": "AaravSpec",
        "role": "spectator"
    }).json()
    spec1_id, spec1_tok = r_spec1["player_id"], r_spec1["session_token"]

    r_spec2 = client.post("/api/rooms/join", json={
        "room_code": code,
        "player_name": "RohanSpec",
        "role": "spectator"
    }).json()
    spec2_id, spec2_tok = r_spec2["player_id"], r_spec2["session_token"]

    assert room.state.spectator_count == 2
    assert len(room.state.team_a.human_player_ids) == 2
    assert len(room.state.team_b.human_player_ids) == 2

    # 4. Connect All WebSockets
    with client.websocket_connect(f"/ws/{code}?player_id={p1_id}&session_token={p1_tok}") as ws_p1, \
         client.websocket_connect(f"/ws/{code}?player_id={p2_id}&session_token={p2_tok}") as ws_p2, \
         client.websocket_connect(f"/ws/{code}?player_id={p3_id}&session_token={p3_tok}") as ws_p3, \
         client.websocket_connect(f"/ws/{code}?player_id={p4_id}&session_token={p4_tok}") as ws_p4, \
         client.websocket_connect(f"/ws/{code}?player_id={spec1_id}&session_token={spec1_tok}") as ws_spec:

        # Drain connection events
        for _ in range(5):
            ws_p1.receive_json()
        for _ in range(4):
            ws_p2.receive_json()
        for _ in range(3):
            ws_p3.receive_json()
        for _ in range(2):
            ws_p4.receive_json()
        ws_spec.receive_json()

        # 5. Ready Up in Lobby (each broadcast sent to all 5 clients)
        for ws in [ws_p1, ws_p2, ws_p3, ws_p4]:
            ws.send_json({"type": "SET_LOBBY_READY", "ready": True})

        # Drain 4 lobby state updates for each connected client
        for ws in [ws_p1, ws_p2, ws_p3, ws_p4, ws_spec]:
            for _ in range(4):
                ws.receive_json()

        assert room.state.phase == MatchPhase.TOSS

        # 6. Toss & Decision
        room.state.toss_decision = "bat"
        room.state.toss_winner_id = p1_id
        inn1 = HandCricketEngine.initialize_innings(room.state, 1)
        room.state.innings_list = [inn1]
        room.state.current_innings_number = 1
        HandCricketEngine.start_new_delivery(room.state)

        # 7. INNINGS 1 - OVER 1:
        # Active controllers: Nishit (P1) batting, Kaushal (P3) bowling
        assert room.state.active_batting_controller_id == p1_id
        assert room.state.active_bowling_controller_id == p3_id
        deliv1_id = room.state.current_delivery_id

        # Unauthorized controller (Shivam P2) tries to submit -> rejected
        ws_p2.send_json({"type": "SUBMIT_HAND", "delivery_id": deliv1_id, "chosen_number": 4})
        err_p2 = ws_p2.receive_json()
        assert err_p2["type"] == "SUBMISSION_ERROR"

        # P1 submits 6
        ws_p1.send_json({"type": "SUBMIT_HAND", "delivery_id": deliv1_id, "chosen_number": 6})
        ack_p1 = ws_p1.receive_json()
        assert ack_p1["type"] == "SECRET_LOCKED"
        assert ack_p1["chosen_number"] == 6

        # P3 submits 2 -> 6 runs scored!
        ok3, _ = HandCricketEngine.record_secret_submission(room.state, p3_id, deliv1_id, 2)
        assert ok3 is True
        res1 = HandCricketEngine.resolve_delivery(room.state)
        assert res1 is not None
        assert room.state.phase in [MatchPhase.REVEAL, MatchPhase.DISCUSSION]

        # Both controllers ready up
        HandCricketEngine.set_player_ready_for_next(room.state, p1_id)
        HandCricketEngine.set_player_ready_for_next(room.state, p3_id)
        assert room.state.phase == MatchPhase.OVER_BREAK
        assert inn1.total_runs == 6

        # 8. OVER COMPLETE -> ROTATION:
        # Active controllers rotate to Shivam (P2) and Hardik (P4)
        assert room.state.active_batting_controller_id == p2_id
        assert room.state.active_bowling_controller_id == p4_id

        # Ready for Over 2
        HandCricketEngine.set_over_transition_ready(room.state, p2_id)
        HandCricketEngine.set_over_transition_ready(room.state, p4_id)
        assert room.state.phase == MatchPhase.DECISION
        deliv2_id = room.state.current_delivery_id

        # P2 submits 4, P4 submits 1 -> 4 runs scored
        HandCricketEngine.record_secret_submission(room.state, p2_id, deliv2_id, 4)
        HandCricketEngine.record_secret_submission(room.state, p4_id, deliv2_id, 1)
        res2 = HandCricketEngine.resolve_delivery(room.state)
        assert res2 is not None
        assert room.state.phase in [MatchPhase.REVEAL, MatchPhase.DISCUSSION]

        # Complete Over 2 -> Innings 1 ends with 10 runs! Target: 11
        HandCricketEngine.set_player_ready_for_next(room.state, p2_id)
        HandCricketEngine.set_player_ready_for_next(room.state, p4_id)
        assert room.state.phase == MatchPhase.INNINGS_BREAK
        assert inn1.total_runs == 10
        assert inn1.is_completed is True

        # 9. INNINGS TRANSITION -> ROLES REVERSE!
        HandCricketEngine.transition_to_innings_2(room.state)
        assert room.state.current_innings_number == 2
        inn2 = room.state.innings_list[1]
        assert inn2.batting_team_id == room.state.team_b.id
        assert inn2.bowling_team_id == room.state.team_a.id
        assert inn2.target == 11

        # In Innings 2, Team B is batting, Team A is bowling:
        # Over 1 controllers: Kaushal (P3, Team B) batting, Nishit (P1, Team A) bowling!
        assert room.state.active_batting_controller_id == p3_id
        assert room.state.active_bowling_controller_id == p1_id
        deliv3_id = room.state.current_delivery_id

        # Kaushal submits 5, Nishit submits 5 -> MATCHING NUMBERS -> WICKET!
        HandCricketEngine.record_secret_submission(room.state, p3_id, deliv3_id, 5)
        HandCricketEngine.record_secret_submission(room.state, p1_id, deliv3_id, 5)
        res3 = HandCricketEngine.resolve_delivery(room.state)
        assert res3 is not None

        assert inn2.wickets == 1
        assert inn2.total_runs == 0
        assert room.state.phase in [MatchPhase.REVEAL, MatchPhase.DISCUSSION]

        # Ready up next
        HandCricketEngine.set_player_ready_for_next(room.state, p3_id)
        HandCricketEngine.set_player_ready_for_next(room.state, p1_id)
        assert room.state.phase == MatchPhase.OVER_BREAK

        # Over 2 of Innings 2: Hardik (P4) batting, Shivam (P2) bowling
        HandCricketEngine.set_over_transition_ready(room.state, p4_id)
        HandCricketEngine.set_over_transition_ready(room.state, p2_id)
        assert room.state.phase == MatchPhase.DECISION
        deliv4_id = room.state.current_delivery_id

        # Hardik submits 3, Shivam submits 3 -> WICKET #2 -> ALL OUT!
        HandCricketEngine.record_secret_submission(room.state, p4_id, deliv4_id, 3)
        HandCricketEngine.record_secret_submission(room.state, p2_id, deliv4_id, 3)
        res4 = HandCricketEngine.resolve_delivery(room.state)
        assert res4 is not None

        assert inn2.wickets == 2
        assert inn2.is_completed is True
        assert room.state.is_match_over is True
        assert room.state.winner_team_id == room.state.team_a.id
        assert "won by 10 runs" in room.state.win_margin_description.lower()

