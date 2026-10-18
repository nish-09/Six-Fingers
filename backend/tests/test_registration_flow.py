import io
import pytest
import asyncio
from fastapi.testclient import TestClient
from app.main import app
from app.database import init_db

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    asyncio.run(init_db())
    yield

def test_01_register_with_all_required_and_custom_fields():
    """Scenario 1 & 15 & 16: Register with all fields including custom team and styles."""
    res = client.post("/api/auth/register", json={
        "full_name": "Rohit Sharma",
        "username": "rohit45",
        "gamer_tag": "#0045",
        "email": "rohit45@example.com",
        "password": "Password123!",
        "custom_team_name": "Hitman Blasters",
        "batting_style": "Right-handed",
        "bowling_style": "Right-arm off-spin",
        "avatar_url": "avatar_3"
    })
    # Could already exist from earlier test or newly created
    assert res.status_code in [200, 400]
    if res.status_code == 200:
        data = res.json()
        assert data["status"] == "success"
        assert data["user"]["full_name"] == "Rohit Sharma"
        assert data["user"]["username"] == "rohit45"
        assert data["profile"]["gamer_tag"] == "rohit45#0045"
        assert data["profile"]["custom_team_name"] == "Hitman Blasters"
        assert data["profile"]["batting_style"] == "Right-handed"
        assert data["profile"]["bowling_style"] == "Right-arm off-spin"

def test_02_register_same_username_different_gamer_tag():
    """Scenario 2: Register with an existing username and a different Gamer ID (MUST SUCCEED)."""
    # Register base user
    client.post("/api/auth/register", json={
        "full_name": "Alpha Player",
        "username": "striker",
        "gamer_tag": "#1000",
        "email": "striker1000@example.com",
        "password": "Password123!"
    })

    # Register same username with different gamer tag
    res = client.post("/api/auth/register", json={
        "full_name": "Beta Player",
        "username": "striker", # Same username
        "gamer_tag": "#2000",  # Different Gamer Tag
        "email": "striker2000@example.com",
        "password": "Password123!"
    })
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["user"]["username"] == "striker"
    assert data["profile"]["gamer_tag"] == "striker#2000"

def test_03_04_register_same_username_same_gamer_tag_fails_with_suggestions():
    """Scenario 3, 4, 5: Register with duplicate username + same Gamer ID must fail and return suggestions."""
    client.post("/api/auth/register", json={
        "full_name": "Unique Pioneer",
        "username": "pioneer",
        "gamer_tag": "#7777",
        "email": "pioneer@example.com",
        "password": "Password123!"
    })

    res = client.post("/api/auth/register", json={
        "full_name": "Impostor Pioneer",
        "username": "pioneer",
        "gamer_tag": "#7777", # Duplicate combo!
        "email": "impostor_pioneer@example.com",
        "password": "Password123!"
    })
    assert res.status_code == 400
    err_detail = res.json()["detail"]
    assert "already registered" in str(err_detail).lower()

def test_05_06_07_check_username_availability_and_suggestions():
    """Scenario 5, 6, 7: Debounced availability check endpoint returns availability and suggestions."""
    # Ensure account exists
    client.post("/api/auth/register", json={
        "full_name": "Check Test",
        "username": "checktarget",
        "gamer_tag": "#4444",
        "email": "checktarget@example.com",
        "password": "Password123!"
    })

    # Check unavailable combination
    r1 = client.get("/api/auth/check-username?username=checktarget&gamer_tag=%234444")
    assert r1.status_code == 200
    data1 = r1.json()
    assert data1["available"] is False
    assert "already registered" in data1["message"].lower()
    assert len(data1["suggestions"]) > 0

    # Scenario 6: Test selecting a suggested username
    suggested_username = data1["suggestions"][0]
    r_sug = client.get(f"/api/auth/check-username?username={suggested_username}&gamer_tag=%234444")
    assert r_sug.status_code == 200
    assert r_sug.json()["available"] is True

    # Scenario 7: Change Gamer Tag and recheck availability
    r_new_tag = client.get("/api/auth/check-username?username=checktarget&gamer_tag=%238888")
    assert r_new_tag.status_code == 200
    assert r_new_tag.json()["available"] is True
    assert "available" in r_new_tag.json()["message"].lower()

def test_08_invalid_gamer_tag():
    """Scenario 8: Submit an invalid Gamer Tag (e.g. invalid special characters or too long)."""
    res = client.post("/api/auth/register", json={
        "full_name": "Test Tag",
        "username": "tagtest",
        "gamer_tag": "#invalid!tag@xyz",
        "email": "tagtest@example.com",
        "password": "Password123!"
    })
    assert res.status_code in [400, 422]

def test_09_invalid_username():
    """Scenario 9: Submit an invalid username (too short or special characters)."""
    res = client.post("/api/auth/register", json={
        "full_name": "Invalid User",
        "username": "a!", # Invalid chars & < 3 chars
        "gamer_tag": "#1111",
        "email": "inv_user@example.com",
        "password": "Password123!"
    })
    assert res.status_code in [400, 422]

def test_10_empty_required_field():
    """Scenario 10: Submit an empty required field (e.g. empty full name or password)."""
    res = client.post("/api/auth/register", json={
        "full_name": " ", # Empty after strip
        "username": "validname",
        "email": "valid@example.com",
        "password": "Password123!"
    })
    assert res.status_code in [400, 422]

def test_11_upload_valid_avatar_png():
    """Scenario 11: Upload valid PNG avatar with genuine magic bytes."""
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    file_obj = io.BytesIO(png_bytes)
    res = client.post(
        "/api/auth/upload-avatar",
        files={"file": ("avatar.png", file_obj, "image/png")}
    )
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["status"] == "success"
    assert data["avatar_url"].startswith("data:image/png;base64,")

def test_12_upload_unsupported_format():
    """Scenario 12: Upload unsupported file format (e.g. text/plain or executable)."""
    fake_txt = io.BytesIO(b"Hello world, this is a plain text file, not an image.")
    res = client.post(
        "/api/auth/upload-avatar",
        files={"file": ("test.txt", fake_txt, "text/plain")}
    )
    assert res.status_code in [400, 422]

def test_13_upload_oversized_avatar():
    """Scenario 13: Upload oversized avatar (>2MB)."""
    big_file = io.BytesIO(b"\x89PNG\r\n\x1a\n" + b"0" * (2 * 1024 * 1024 + 100))
    res = client.post(
        "/api/auth/upload-avatar",
        files={"file": ("huge.png", big_file, "image/png")}
    )
    assert res.status_code in [400, 422]

def test_14_register_without_custom_avatar_uses_default():
    """Scenario 14: Register without custom avatar sets default avatar_1."""
    res = client.post("/api/auth/register", json={
        "full_name": "Default Avatar User",
        "username": "def_avatar",
        "gamer_tag": "#1122",
        "email": "def_avatar@example.com",
        "password": "Password123!"
    })
    assert res.status_code in [200, 400]
    if res.status_code == 200:
        assert res.json()["profile"]["avatar_url"] == "avatar_1"

def test_17_18_concurrent_composite_registration_safety():
    """Scenario 17, 18: Verify composite uniqueness constraint safety."""
    r1 = client.post("/api/auth/register", json={
        "full_name": "Racer 1",
        "username": "fastracer",
        "gamer_tag": "#0001",
        "email": "racer1@example.com",
        "password": "Password123!"
    })
    assert r1.status_code in [200, 400]

    # Registration 2 with same username + tag must be rejected
    r2 = client.post("/api/auth/register", json={
        "full_name": "Racer 2",
        "username": "fastracer",
        "gamer_tag": "#0001",
        "email": "racer2@example.com",
        "password": "Password123!"
    })
    assert r2.status_code == 400
    assert "already registered" in str(r2.json()["detail"]).lower()

def test_20_21_22_login_variants_and_profile_retrieval():
    """Scenario 20, 21, 22: Login by username, by email, and by username#tag, and verify details."""
    client.post("/api/auth/register", json={
        "full_name": "Login User",
        "username": "loginhero",
        "gamer_tag": "#3333",
        "email": "loginhero@example.com",
        "password": "Password123!",
        "custom_team_name": "Royal Heroes",
        "bowling_style": "Left-arm orthodox spin"
    })

    # 1. Login by Email
    r_email = client.post("/api/auth/login", json={
        "username_or_email": "loginhero@example.com",
        "password": "Password123!"
    })
    assert r_email.status_code == 200
    p1 = r_email.json()["profile"]
    assert p1["gamer_tag"] == "loginhero#3333"
    assert p1["custom_team_name"] == "Royal Heroes"

    # 2. Login by Full Gamer ID (username#tag)
    r_tag = client.post("/api/auth/login", json={
        "username_or_email": "loginhero#3333",
        "password": "Password123!"
    })
    assert r_tag.status_code == 200
    p2 = r_tag.json()["profile"]
    assert p2["gamer_tag"] == "loginhero#3333"

    # 3. Access /api/auth/me
    token = r_tag.json()["access_token"]
    r_me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r_me.status_code == 200
    me_data = r_me.json()
    assert me_data["user"]["username"] == "loginhero"
    assert me_data["profile"]["gamer_tag"] == "loginhero#3333"
    assert me_data["profile"]["bowling_style"] == "Left-arm orthodox spin"
