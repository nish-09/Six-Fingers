import pytest
import asyncio
import time
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db, AsyncSessionLocal, User, Profile
from app.rooms.manager import room_manager
from app.matchmaking.queue import matchmaking_coordinator

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_suite():
    asyncio.run(init_db())
    room_manager.rooms.clear()
    matchmaking_coordinator.queue.clear()
    yield

def test_auth_registration_and_validation():
    # 1. Successful registration
    r = client.post("/api/auth/register", json={
        "full_name": "Nishit Patel",
        "username": "nishit09",
        "email": "nishit@example.com",
        "password": "Password123!",
        "favorite_team": "Mumbai Blasters"
    })
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "success"
    assert "access_token" in data
    assert data["user"]["username"] == "nishit09"
    assert data["profile"]["display_name"] == "Nishit Patel"
    assert "#" in data["profile"]["gamer_tag"]

    # 2. Test composite uniqueness: Same username with same gamer_tag fails, different gamer_tag succeeds
    r_custom = client.post("/api/auth/register", json={
        "full_name": "Player One",
        "username": "legend",
        "gamer_tag": "#4821",
        "email": "legend1@example.com",
        "password": "Password123!"
    })
    assert r_custom.status_code == 200
    assert r_custom.json()["profile"]["gamer_tag"] == "legend#4821"

    # Same username + same gamer tag -> MUST FAIL
    r_dup_combo = client.post("/api/auth/register", json={
        "full_name": "Player Two",
        "username": "legend",
        "gamer_tag": "#4821",
        "email": "legend2@example.com",
        "password": "Password123!"
    })
    assert r_dup_combo.status_code == 400
    assert "already registered" in str(r_dup_combo.json()["detail"]).lower()

    # Same username + DIFFERENT gamer tag -> MUST SUCCEED (Section 5 requirement)
    r_diff_tag = client.post("/api/auth/register", json={
        "full_name": "Player Three",
        "username": "legend",
        "gamer_tag": "#9375",
        "email": "legend3@example.com",
        "password": "Password123!"
    })
    assert r_diff_tag.status_code == 200
    assert r_diff_tag.json()["profile"]["gamer_tag"] == "legend#9375"

    # 3. Reject duplicate email
    r_dup_email = client.post("/api/auth/register", json={
        "full_name": "Another Nishit",
        "username": "nishit_other",
        "email": "nishit@example.com",
        "password": "Password123!"
    })
    assert r_dup_email.status_code == 400
    assert "email" in r_dup_email.json()["detail"].lower()

    # 4. Reject weak password
    r_weak = client.post("/api/auth/register", json={
        "full_name": "Weak User",
        "username": "weakuser",
        "email": "weak@example.com",
        "password": "weak"
    })
    assert r_weak.status_code in [400, 422]

def test_auth_login_me_and_logout():
    # Register test user
    client.post("/api/auth/register", json={
        "full_name": "Gamer One",
        "username": "gamerone",
        "email": "gamerone@example.com",
        "password": "Password123!"
    })

    # Login with valid credentials
    r_login = client.post("/api/auth/login", json={
        "username_or_email": "gamerone",
        "password": "Password123!"
    })
    assert r_login.status_code == 200
    token = r_login.json()["access_token"]
    assert token is not None

    # Access /api/auth/me with Bearer token
    r_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r_me.status_code == 200
    me_data = r_me.json()
    assert me_data["user"]["username"] == "gamerone"
    assert me_data["profile"]["gamer_tag"].startswith("gamerone#")

    # Reject invalid password
    r_bad = client.post("/api/auth/login", json={
        "username_or_email": "gamerone",
        "password": "WrongPassword99!"
    })
    assert r_bad.status_code == 401

    # Logout
    r_out = client.post("/api/auth/logout")
    assert r_out.status_code == 200

def test_gamer_tag_collision_safety():
    # Register two users with the same display name
    r1 = client.post("/api/auth/register", json={
        "full_name": "ShadowStriker",
        "username": "striker1",
        "email": "striker1@example.com",
        "password": "Password123!"
    })
    r2 = client.post("/api/auth/register", json={
        "full_name": "ShadowStriker",
        "username": "striker2",
        "email": "striker2@example.com",
        "password": "Password123!"
    })
    tag1 = r1.json()["profile"]["gamer_tag"]
    tag2 = r2.json()["profile"]["gamer_tag"]

    assert tag1.startswith("striker1#")
    assert tag2.startswith("striker2#")
    assert tag1 != tag2 # Collision prevention guaranteed!

def test_profile_update_and_public_view():
    reg = client.post("/api/auth/register", json={
        "full_name": "Virat Fan",
        "username": "viratfan",
        "email": "virat@example.com",
        "password": "Password123!"
    }).json()
    token = reg["access_token"]
    gamer_tag = reg["profile"]["gamer_tag"]

    # Update profile
    r_up = client.put(
        "/api/profiles/me",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "bio": "Chasing targets since 2011",
            "country": "India",
            "batting_style": "Classic Anchor"
        }
    )
    assert r_up.status_code == 200
    assert r_up.json()["profile"]["bio"] == "Chasing targets since 2011"

    # View public profile by gamer tag
    r_pub = client.get(f"/api/profiles/{gamer_tag}")
    assert r_pub.status_code == 200
    assert r_pub.json()["gamer_tag"] == gamer_tag
    assert r_pub.json()["batting_style"] == "Classic Anchor"

def test_friend_system_lifecycle():
    # User A
    u_a = client.post("/api/auth/register", json={
        "full_name": "Alice Cricket",
        "username": "alice",
        "email": "alice@example.com",
        "password": "Password123!"
    }).json()
    tok_a = u_a["access_token"]
    id_a = u_a["user"]["id"]

    # User B
    u_b = client.post("/api/auth/register", json={
        "full_name": "Bob Cricket",
        "username": "bob",
        "email": "bob@example.com",
        "password": "Password123!"
    }).json()
    tok_b = u_b["access_token"]
    id_b = u_b["user"]["id"]

    # 1. Search player
    r_search = client.get("/api/friends/search?q=bob", headers={"Authorization": f"Bearer {tok_a}"})
    assert r_search.status_code == 200
    assert any(p["user_id"] == id_b for p in r_search.json()["results"])

    # 2. Cannot send friend request to oneself
    r_self = client.post(
        "/api/friends/request",
        headers={"Authorization": f"Bearer {tok_a}"},
        json={"target_user_id": id_a}
    )
    assert r_self.status_code == 400

    # 3. Send friend request from Alice to Bob
    r_req = client.post(
        "/api/friends/request",
        headers={"Authorization": f"Bearer {tok_a}"},
        json={"target_user_id": id_b}
    )
    assert r_req.status_code == 200
    req_id = r_req.json()["request_id"]

    # 4. Bob checks incoming requests
    r_inc = client.get("/api/friends/requests/incoming", headers={"Authorization": f"Bearer {tok_b}"})
    assert r_inc.status_code == 200
    assert any(r["request_id"] == req_id for r in r_inc.json()["incoming_requests"])

    # 5. Bob accepts request
    r_acc = client.post(
        "/api/friends/respond",
        headers={"Authorization": f"Bearer {tok_b}"},
        json={"request_id": req_id, "action": "accept"}
    )
    assert r_acc.status_code == 200

    # 6. Check friends list for both
    r_flist_a = client.get("/api/friends/list", headers={"Authorization": f"Bearer {tok_a}"})
    r_flist_b = client.get("/api/friends/list", headers={"Authorization": f"Bearer {tok_b}"})
    assert any(f["user_id"] == id_b for f in r_flist_a.json()["friends"])
    assert any(f["user_id"] == id_a for f in r_flist_b.json()["friends"])

    # 7. Remove friend
    r_rem = client.post(
        "/api/friends/remove",
        headers={"Authorization": f"Bearer {tok_a}"},
        json={"friend_id": id_b}
    )
    assert r_rem.status_code == 200
    r_flist_after = client.get("/api/friends/list", headers={"Authorization": f"Bearer {tok_a}"})
    assert len(r_flist_after.json()["friends"]) == 0

def test_public_matchmaking_pairing():
    # User 1
    u1 = client.post("/api/auth/register", json={
        "full_name": "Player Alpha",
        "username": "alpha",
        "email": "alpha@example.com",
        "password": "Password123!"
    }).json()
    tok1 = u1["access_token"]
    id1 = u1["user"]["id"]

    # User 2
    u2 = client.post("/api/auth/register", json={
        "full_name": "Player Beta",
        "username": "beta",
        "email": "beta@example.com",
        "password": "Password123!"
    }).json()
    tok2 = u2["access_token"]
    id2 = u2["user"]["id"]

    # Enqueue Player 1 via coordinator
    async def match_flow():
        t1 = await matchmaking_coordinator.enqueue(id1, "Player Alpha", "Alpha#001", "avatar_1")
        assert not t1.future.done()
        assert matchmaking_coordinator.get_queue_size() == 1

        # Enqueue Player 2 -> immediate pair!
        t2 = await matchmaking_coordinator.enqueue(id2, "Player Beta", "Beta#002", "avatar_2")
        assert t1.future.done()
        assert t2.future.done()
        assert matchmaking_coordinator.get_queue_size() == 0

        res1 = t1.future.result()
        res2 = t2.future.result()

        assert res1["room_code"] == res2["room_code"]
        assert res1["match_type"] == "PUBLIC"
        assert res1["opponent"]["user_id"] == id2
        assert res2["opponent"]["user_id"] == id1

        # Check room exists in room_manager
        room = room_manager.get_room(res1["room_code"])
        assert room is not None
        assert room.state.player_1_user_id == id1
        assert room.state.player_2_user_id == id2

    asyncio.run(match_flow())

def test_match_invitations_and_notifications():
    # Sender
    u1 = client.post("/api/auth/register", json={
        "full_name": "Host Player",
        "username": "hostplayer",
        "email": "host@example.com",
        "password": "Password123!"
    }).json()
    tok1 = u1["access_token"]

    # Recipient
    u2 = client.post("/api/auth/register", json={
        "full_name": "Guest Player",
        "username": "guestplayer",
        "email": "guest@example.com",
        "password": "Password123!"
    }).json()
    tok2 = u2["access_token"]
    id2 = u2["user"]["id"]

    # Create room
    r_room = client.post(
        "/api/rooms/create",
        headers={"Authorization": f"Bearer {tok1}"},
        json={"host_name": "Host Player"}
    ).json()
    code = r_room["room_code"]

    # Send invitation
    r_inv = client.post(
        "/api/invitations/send",
        headers={"Authorization": f"Bearer {tok1}"},
        json={"recipient_user_id": id2, "room_code": code}
    )
    assert r_inv.status_code == 200
    inv_id = r_inv.json()["invitation_id"]

    # Recipient checks notifications
    r_notifs = client.get("/api/invitations/notifications", headers={"Authorization": f"Bearer {tok2}"})
    assert r_notifs.status_code == 200
    assert r_notifs.json()["unread_count"] >= 1

    # Recipient accepts invitation
    r_join = client.post(
        "/api/invitations/respond",
        headers={"Authorization": f"Bearer {tok2}"},
        json={"invitation_id": inv_id, "action": "accept"}
    )
    assert r_join.status_code == 200
    assert r_join.json()["room_code"] == code

    # Mark notifications as read
    r_read = client.post("/api/invitations/notifications/read-all", headers={"Authorization": f"Bearer {tok2}"})
    assert r_read.status_code == 200
    r_notifs_after = client.get("/api/invitations/notifications", headers={"Authorization": f"Bearer {tok2}"})
    assert r_notifs_after.json()["unread_count"] == 0
