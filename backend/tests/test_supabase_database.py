import pytest
import os
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError
from app.database import (
    Base,
    configure_database,
    check_db_health,
    init_db,
    _migrate_match_records_columns,
    AsyncSessionLocal,
    User,
    Profile,
    MatchRecord
)
from scripts.migrate_sqlite_to_supabase import migrate_data

def test_database_url_normalization_direct():
    """Verify standard postgresql:// URL is normalized to postgresql+asyncpg://."""
    url = "postgresql://postgres:secretpassword@db.abcdefgh.supabase.co:5432/postgres"
    clean_url, kwargs = configure_database(url, environment="production")
    assert clean_url.startswith("postgresql+asyncpg://")
    assert "statement_cache_size" in kwargs["connect_args"]
    assert kwargs["connect_args"]["statement_cache_size"] == 0
    assert kwargs["connect_args"].get("ssl") == "require"

def test_database_url_normalization_pooler():
    """Verify Supabase PgBouncer/Supavisor pooler URLs disable prepared statements and enforce SSL."""
    url = "postgres://postgres.abcdefgh:secretpassword@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
    clean_url, kwargs = configure_database(url, environment="production")
    assert clean_url.startswith("postgresql+asyncpg://")
    assert kwargs["connect_args"]["statement_cache_size"] == 0
    assert kwargs["connect_args"]["ssl"] == "require"
    assert kwargs["pool_pre_ping"] is True
    assert kwargs["pool_recycle"] == 300

def test_database_url_normalization_psycopg2_prefix():
    """Verify legacy psycopg2 URL prefix is rewritten for asyncpg compatibility."""
    url = "postgresql+psycopg2://user:pass@localhost:5432/six_fingers"
    clean_url, kwargs = configure_database(url, environment="development")
    assert clean_url.startswith("postgresql+asyncpg://")
    assert kwargs["connect_args"]["statement_cache_size"] == 0

def test_database_url_strips_sslmode_and_channel_binding():
    """Verify query parameters that crash asyncpg (sslmode, channel_binding) are cleanly stripped."""
    url = "postgresql://postgres:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres?sslmode=require&channel_binding=prefer"
    clean_url, kwargs = configure_database(url, environment="production")
    assert clean_url == "postgresql+asyncpg://postgres:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
    assert kwargs["connect_args"]["ssl"] == "require"
    assert kwargs["connect_args"]["statement_cache_size"] == 0

def test_database_url_strips_surrounding_quotes_and_whitespace():
    """Verify surrounding quotes and whitespace from environment configs are stripped."""
    url = '  "postgresql://postgres:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres"  '
    clean_url, kwargs = configure_database(url, environment="production")
    assert clean_url.startswith("postgresql+asyncpg://")

def test_database_url_detects_unsubstituted_password_placeholder():
    """Verify copying template placeholder [YOUR-PASSWORD] raises an immediate clear error."""
    url = "postgresql://postgres:[YOUR-PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
    with pytest.raises(RuntimeError, match="template placeholder '\\[YOUR-PASSWORD\\]'"):
        configure_database(url, environment="production")

def test_safe_database_description_masks_credentials():
    """Verify passwords are redacted when logging database connection targets."""
    from app.database import get_safe_database_description
    url = "postgresql://postgres.myref:super_secret_pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
    safe = get_safe_database_description(url)
    assert "super_secret_pass" not in safe
    assert "postgres.myref" in safe
    assert "aws-0-us-east-1.pooler.supabase.com" in safe

def test_production_sqlite_rejection():
    """Verify production startup strictly forbids SQLite database fallback."""
    with pytest.raises(RuntimeError, match="SQLite URL.*is not permitted in production"):
        configure_database("sqlite:///./hand_cricket.db", environment="production")

    with pytest.raises(RuntimeError, match="DATABASE_URL is not configured"):
        configure_database("", environment="production")

def test_development_sqlite_default():
    """Verify local development seamlessly defaults to async SQLite."""
    clean_url, kwargs = configure_database("", environment="development")
    assert clean_url.startswith("sqlite+aiosqlite:///")
    assert "connect_args" in kwargs
    assert kwargs["connect_args"].get("check_same_thread") is False

@pytest.mark.asyncio
async def test_database_health_check_operational():
    """Verify check_db_health executes SELECT 1 successfully."""
    is_healthy = await check_db_health()
    assert is_healthy is True

@pytest.mark.asyncio
async def test_model_crud_and_transaction_rollback():
    """Verify transactional commit and integrity rollback behavior."""
    from sqlalchemy.pool import StaticPool
    test_engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
        echo=False
    )
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    TestSession = async_sessionmaker(test_engine, expire_on_commit=False, class_=AsyncSession)

    async with TestSession() as session:
        # Create user
        user = User(
            id="u_test_tx_1",
            username="test_tx_user",
            email="tx_user@example.com",
            password_hash="argon2_fake_hash",
            full_name="Transaction Test",
            created_at=1000.0
        )
        session.add(user)
        await session.commit()

        # Attempt to insert duplicate username in a new session/transaction
        duplicate_user = User(
            id="u_test_tx_2",
            username="test_tx_user", # Duplicate!
            email="another_email@example.com",
            password_hash="argon2_fake_hash_2",
            full_name="Duplicate User",
            created_at=1001.0
        )
        session.add(duplicate_user)
        with pytest.raises(IntegrityError):
            await session.commit()
        await session.rollback()

        # Verify original user remains unaffected
        fetched = await session.get(User, "u_test_tx_1")
        assert fetched is not None
        assert fetched.username == "test_tx_user"

    await test_engine.dispose()

@pytest.mark.asyncio
async def test_dialect_agnostic_inspector_migration():
    """Verify _migrate_match_records_columns runs without errors using SQLAlchemy inspect."""
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Re-running inspection on an existing table should safely discover all columns
        await conn.run_sync(_migrate_match_records_columns)
    await test_engine.dispose()

@pytest.mark.asyncio
async def test_sqlite_to_supabase_migration_script(tmp_path):
    """Verify data migration script idempotently transfers records between databases."""
    src_db_file = tmp_path / "source.db"
    src_url = f"sqlite+aiosqlite:///{src_db_file}"
    tgt_db_file = tmp_path / "target.db"
    tgt_url = f"sqlite+aiosqlite:///{tgt_db_file}"

    src_engine = create_async_engine(src_url, echo=False)
    async with src_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Populate source with test data
    SrcSession = async_sessionmaker(src_engine, expire_on_commit=False, class_=AsyncSession)
    async with SrcSession() as session:
        session.add(User(
            id="u_mig_1",
            username="mig_champ",
            email="mig@example.com",
            password_hash="hash123",
            full_name="Migration Champion",
            created_at=2000.0
        ))
        session.add(Profile(
            user_id="u_mig_1",
            display_name="Mig Champion",
            gamer_tag="MigChamp#001",
            tag_number=1,
            avatar_url="avatar_1",
            bio="Migrated player",
            country="India",
            favorite_team="Mumbai Blasters",
            batting_style="Aggressive",
            total_matches=5,
            matches_won=4,
            matches_lost=1,
            total_runs=120,
            total_wickets=8,
            current_streak=3,
            best_streak=4,
            updated_at=2000.0
        ))
        await session.commit()
    await src_engine.dispose()

    # Run migration into target
    success = await migrate_data(str(src_db_file), tgt_url, environment="test")
    assert success is True

    # Validate target data
    tgt_engine = create_async_engine(tgt_url, echo=False)
    TgtSession = async_sessionmaker(tgt_engine, expire_on_commit=False, class_=AsyncSession)
    async with TgtSession() as session:
        migrated_user = await session.get(User, "u_mig_1")
        assert migrated_user is not None
        assert migrated_user.username == "mig_champ"

        migrated_profile = await session.get(Profile, "u_mig_1")
        assert migrated_profile is not None
        assert migrated_profile.gamer_tag == "MigChamp#001"
        assert migrated_profile.total_runs == 120

    await tgt_engine.dispose()
