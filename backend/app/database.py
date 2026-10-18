import os
import sys
import json
import time
import asyncio
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Float, Boolean, Text, select, desc, or_, and_, text, inspect, UniqueConstraint
from sqlalchemy.engine import make_url

def get_safe_database_description(url_str: str) -> str:
    """Returns a masked database description safe for logging, hiding passwords."""
    try:
        u = make_url(url_str)
        return u.render_as_string(hide_password=True)
    except Exception:
        if "@" in url_str:
            prefix, rest = url_str.split("@", 1)
            return f"...@{rest}"
        return "database"

def configure_database(
    raw_url: Optional[str] = None,
    environment: Optional[str] = None
) -> Tuple[str, Dict[str, Any]]:
    """
    Validates and normalizes database configuration for SQLite and Supabase PostgreSQL.

    Supports:
    - Direct connections (port 5432)
    - Supabase Transaction Pooling (PgBouncer/Supavisor, port 6543)
    - Supabase Session Pooling (port 5432)
    - Local development SQLite fallback

    Critically strips libpq query parameters like `sslmode` and `channel_binding`
    that cause asyncpg to raise `TypeError: connect() got an unexpected keyword argument`.
    """
    env = (environment or os.getenv("ENVIRONMENT", os.getenv("NODE_ENV", "development"))).lower()
    url = raw_url if raw_url is not None else os.getenv("DATABASE_URL")
    is_render = os.getenv("RENDER", "").lower() in ("true", "1")

    # Production / Render safety check: enforce PostgreSQL
    if env == "production" or (environment is None and is_render):
        if not url:
            raise RuntimeError(
                "DATABASE_URL is not configured. Production environment requires a valid "
                "Supabase PostgreSQL connection string."
            )
        if "sqlite" in url.lower():
            raise RuntimeError(
                f"Production environment requires a PostgreSQL connection string (Supabase). "
                f"SQLite URL '{url}' is not permitted in production."
            )

    # Default to async SQLite for local development if not specified
    if not url:
        url = "sqlite+aiosqlite:///./hand_cricket.db"

    clean_url = url.strip().strip("'\"").strip()

    if "[YOUR-PASSWORD]" in clean_url or "<password>" in clean_url.lower():
        raise RuntimeError(
            "DATABASE_URL contains the template placeholder '[YOUR-PASSWORD]'. "
            "Please replace it with your actual Supabase database password in Render environment variables."
        )

    # Normalize driver prefixes for SQLAlchemy 2.0 + asyncpg
    if clean_url.startswith("sqlite:///") and not clean_url.startswith("sqlite+aiosqlite:///"):
        clean_url = clean_url.replace("sqlite:///", "sqlite+aiosqlite:///", 1)
    elif clean_url.startswith("postgres://"):
        clean_url = clean_url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif clean_url.startswith("postgres+asyncpg://"):
        clean_url = clean_url.replace("postgres+asyncpg://", "postgresql+asyncpg://", 1)
    elif clean_url.startswith("postgresql://") and not clean_url.startswith("postgresql+asyncpg://"):
        clean_url = clean_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif clean_url.startswith("postgresql+psycopg2://"):
        clean_url = clean_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://", 1)
    elif clean_url.startswith("postgresql+psycopg://"):
        clean_url = clean_url.replace("postgresql+psycopg://", "postgresql+asyncpg://", 1)

    is_sqlite = "sqlite" in clean_url.lower()

    if is_sqlite:
        engine_kwargs: Dict[str, Any] = {
            "echo": False,
            "connect_args": {"check_same_thread": False}
        }
    else:
        # PostgreSQL / Supabase configuration
        connect_args: Dict[str, Any] = {
            # Disable asyncpg prepared statement caching.
            # CRITICAL for Supabase PgBouncer / Supavisor transaction pooler (port 6543)
            # and prevents statement collisions across pooled connections.
            "statement_cache_size": 0,
        }

        # Parse URL and strip libpq query parameters that cause asyncpg to crash
        is_supabase_host = "supabase.co" in clean_url or "pooler.supabase.com" in clean_url
        force_ssl = os.getenv("DB_SSL", "true").lower() in ("true", "1", "yes")
        wants_ssl = True

        try:
            sa_url = make_url(clean_url)
            query_dict = dict(sa_url.query)
            sslmode_val = query_dict.pop("sslmode", None)
            ssl_val = query_dict.pop("ssl", None)

            # Strip known libpq / pooler parameters that asyncpg does not accept as kwargs
            query_dict.pop("channel_binding", None)
            query_dict.pop("pgbouncer", None)
            query_dict.pop("gssencmode", None)

            # Only retain params that asyncpg.connect natively accepts as kwargs
            recognized_asyncpg_params = {
                "command_timeout", "timeout", "server_settings"
            }
            clean_query = {k: v for k, v in query_dict.items() if k in recognized_asyncpg_params}

            if sslmode_val in ("disable", "none", "off") or ssl_val in ("disable", "false", "0"):
                wants_ssl = False
            elif is_supabase_host or force_ssl or sslmode_val or ssl_val:
                wants_ssl = True

            clean_url = sa_url.set(drivername="postgresql+asyncpg", query=clean_query).render_as_string(hide_password=False)

            # Check for direct Supabase host vs pooler host and log helpful diagnostics
            host = sa_url.host or ""
            if "supabase.co" in host and host.startswith("db."):
                print(
                    "[Database Config Notice] Direct Supabase host detected ('db.*.supabase.co'). "
                    "Supabase direct connections are IPv6-only on the free tier. Render does not support "
                    "outbound IPv6 on standard services. If connection times out or fails, switch your "
                    "DATABASE_URL in Render to the Supabase Connection Pooler: "
                    "aws-0-<region>.pooler.supabase.com:6543 with username 'postgres.<project-ref>'.",
                    file=sys.stderr,
                    flush=True
                )
            elif "pooler.supabase.com" in host:
                user = sa_url.username or ""
                if user == "postgres":
                    print(
                        "[Database Config Notice] Supabase Pooler host detected ('pooler.supabase.com'), but the "
                        "username is 'postgres' without a project reference. The Supabase connection pooler "
                        "requires the username format 'postgres.<project-ref>'. If connection fails with "
                        "'(ENOIDENTIFIER) no tenant identifier', update your DATABASE_URL in Render.",
                        file=sys.stderr,
                        flush=True
                    )
        except Exception:
            # Fallback string stripping if make_url encounters special syntax
            import re
            clean_url = re.sub(r"[?&]sslmode=[^&]+", "", clean_url)
            clean_url = re.sub(r"[?&]channel_binding=[^&]+", "", clean_url)
            clean_url = re.sub(r"[?&]pgbouncer=[^&]+", "", clean_url)
            if "?" not in clean_url and "&" in clean_url:
                clean_url = clean_url.replace("&", "?", 1)

        if wants_ssl:
            connect_args["ssl"] = "require"

        pool_size = int(os.getenv("DB_POOL_SIZE", "10"))
        max_overflow = int(os.getenv("DB_MAX_OVERFLOW", "20"))
        pool_recycle = int(os.getenv("DB_POOL_RECYCLE", "300"))
        pool_timeout = int(os.getenv("DB_POOL_TIMEOUT", "30"))

        engine_kwargs = {
            "echo": False,
            "pool_size": pool_size,
            "max_overflow": max_overflow,
            "pool_pre_ping": True,
            "pool_recycle": pool_recycle,
            "pool_timeout": pool_timeout,
            "connect_args": connect_args,
        }

    return clean_url, engine_kwargs

DATABASE_URL, engine_kwargs = configure_database()
engine = create_async_engine(DATABASE_URL, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("username", "gamer_tag", name="uq_users_username_gamer_tag"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(32), index=True)
    gamer_tag: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(100))
    date_of_birth: Mapped[Optional[str]] = mapped_column(String(32), nullable=True) # YYYY-MM-DD
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)
    last_login_at: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

class Profile(Base):
    __tablename__ = "profiles"

    user_id: Mapped[str] = mapped_column(String(64), primary_key=True, index=True)
    display_name: Mapped[str] = mapped_column(String(64), index=True)
    gamer_tag: Mapped[str] = mapped_column(String(64), unique=True, index=True) # e.g. player123#4821
    tag_number: Mapped[int] = mapped_column(Integer, index=True)
    avatar_url: Mapped[str] = mapped_column(Text, default="avatar_1")
    bio: Mapped[str] = mapped_column(String(255), default="Hand Cricket champion ready to dominate the pitch!")
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    country: Mapped[str] = mapped_column(String(64), default="India")
    favorite_team: Mapped[str] = mapped_column(String(64), default="Mumbai Blasters")
    custom_team_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    batting_style: Mapped[str] = mapped_column(String(64), default="Right-handed")
    bowling_style: Mapped[str] = mapped_column(String(64), default="Right-arm medium")
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    show_age: Mapped[bool] = mapped_column(Boolean, default=False)
    show_stats: Mapped[bool] = mapped_column(Boolean, default=True)

    # Competitive statistics
    total_matches: Mapped[int] = mapped_column(Integer, default=0)
    matches_won: Mapped[int] = mapped_column(Integer, default=0)
    matches_lost: Mapped[int] = mapped_column(Integer, default=0)
    total_runs: Mapped[int] = mapped_column(Integer, default=0)
    total_wickets: Mapped[int] = mapped_column(Integer, default=0)
    current_streak: Mapped[int] = mapped_column(Integer, default=0)
    best_streak: Mapped[int] = mapped_column(Integer, default=0)
    updated_at: Mapped[float] = mapped_column(Float, default=time.time)

class Friendship(Base):
    __tablename__ = "friendships"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    requester_id: Mapped[str] = mapped_column(String(64), index=True)
    addressee_id: Mapped[str] = mapped_column(String(64), index=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING", index=True) # PENDING, ACCEPTED, DECLINED, BLOCKED
    created_at: Mapped[float] = mapped_column(Float, default=time.time)
    updated_at: Mapped[float] = mapped_column(Float, default=time.time)

class MatchInvitation(Base):
    __tablename__ = "match_invitations"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    sender_id: Mapped[str] = mapped_column(String(64), index=True)
    recipient_id: Mapped[str] = mapped_column(String(64), index=True)
    room_code: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(20), default="PENDING") # PENDING, ACCEPTED, DECLINED, EXPIRED, CANCELLED
    expires_at: Mapped[float] = mapped_column(Float)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)

class Notification(Base):
    __tablename__ = "notifications"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    type: Mapped[str] = mapped_column(String(32)) # FRIEND_REQUEST, FRIEND_ACCEPTED, MATCH_INVITE, SYSTEM
    title: Mapped[str] = mapped_column(String(128))
    message: Mapped[str] = mapped_column(String(255))
    data_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)

class SavedTeam(Base):
    __tablename__ = "saved_teams"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str] = mapped_column(String(32), default="#6500C8")
    accent_color: Mapped[str] = mapped_column(String(32), default="#FFD900")
    players_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)

class MatchRecord(Base):
    __tablename__ = "match_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    room_code: Mapped[str] = mapped_column(String(16), index=True)
    match_type: Mapped[str] = mapped_column(String(20), default="PRIVATE") # PUBLIC, PRIVATE, SERIES, TOURNAMENT
    series_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    tournament_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    player_1_user_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    player_2_user_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    team_a_name: Mapped[str] = mapped_column(String(100))
    team_b_name: Mapped[str] = mapped_column(String(100))
    winner_team_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    win_description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    first_innings_runs: Mapped[int] = mapped_column(Integer, default=0)
    first_innings_wickets: Mapped[int] = mapped_column(Integer, default=0)
    second_innings_runs: Mapped[int] = mapped_column(Integer, default=0)
    second_innings_wickets: Mapped[int] = mapped_column(Integer, default=0)
    total_deliveries: Mapped[int] = mapped_column(Integer, default=0)
    scorecard_json: Mapped[str] = mapped_column(Text)
    is_bot_match: Mapped[bool] = mapped_column(Boolean, default=False)
    bot_difficulty: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)

class Series(Base):
    __tablename__ = "series"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(128))
    creator_id: Mapped[str] = mapped_column(String(64), index=True)
    opponent_id: Mapped[Optional[str]] = mapped_column(String(64), index=True, nullable=True)
    creator_name: Mapped[str] = mapped_column(String(64))
    opponent_name: Mapped[str] = mapped_column(String(64), default="Opponent")
    series_format: Mapped[str] = mapped_column(String(32), default="BEST_OF_3") # BEST_OF_3, BEST_OF_5, BEST_OF_7, FIRST_TO_N, FIXED_MATCHES
    total_scheduled_matches: Mapped[int] = mapped_column(Integer, default=3)
    target_wins: Mapped[int] = mapped_column(Integer, default=2)
    overs_per_match: Mapped[int] = mapped_column(Integer, default=2)
    wickets_per_match: Mapped[int] = mapped_column(Integer, default=3)
    creator_wins: Mapped[int] = mapped_column(Integer, default=0)
    opponent_wins: Mapped[int] = mapped_column(Integer, default=0)
    draws: Mapped[int] = mapped_column(Integer, default=0)
    matches_played: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVE", index=True) # ACTIVE, COMPLETED, CANCELLED
    winner_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    winner_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    current_room_code: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)
    updated_at: Mapped[float] = mapped_column(Float, default=time.time)

class SeriesMatch(Base):
    __tablename__ = "series_matches"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    series_id: Mapped[str] = mapped_column(String(64), index=True)
    match_number: Mapped[int] = mapped_column(Integer)
    room_code: Mapped[str] = mapped_column(String(16))
    match_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    winner_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    winner_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    score_summary: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)

class Tournament(Base):
    __tablename__ = "tournaments"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    title: Mapped[str] = mapped_column(String(128))
    description: Mapped[str] = mapped_column(String(255), default="Six Fingers Hand Cricket Championship")
    organizer_id: Mapped[str] = mapped_column(String(64), index=True)
    organizer_name: Mapped[str] = mapped_column(String(64))
    tournament_format: Mapped[str] = mapped_column(String(32), default="KNOCKOUT") # KNOCKOUT or ROUND_ROBIN
    max_participants: Mapped[int] = mapped_column(Integer, default=4) # 4, 8, 16
    overs_per_match: Mapped[int] = mapped_column(Integer, default=2)
    wickets_per_match: Mapped[int] = mapped_column(Integer, default=3)
    status: Mapped[str] = mapped_column(String(20), default="REGISTRATION", index=True) # REGISTRATION, IN_PROGRESS, COMPLETED
    current_round: Mapped[int] = mapped_column(Integer, default=1)
    winner_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    winner_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)
    updated_at: Mapped[float] = mapped_column(Float, default=time.time)

class TournamentParticipant(Base):
    __tablename__ = "tournament_participants"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tournament_id: Mapped[str] = mapped_column(String(64), index=True)
    user_id: Mapped[str] = mapped_column(String(64), index=True)
    user_name: Mapped[str] = mapped_column(String(64))
    gamer_tag: Mapped[str] = mapped_column(String(64))
    avatar_url: Mapped[str] = mapped_column(String(255), default="avatar_1")
    seed: Mapped[int] = mapped_column(Integer, default=0)
    is_eliminated: Mapped[bool] = mapped_column(Boolean, default=False)
    matches_played: Mapped[int] = mapped_column(Integer, default=0)
    matches_won: Mapped[int] = mapped_column(Integer, default=0)
    matches_lost: Mapped[int] = mapped_column(Integer, default=0)
    points: Mapped[int] = mapped_column(Integer, default=0)
    joined_at: Mapped[float] = mapped_column(Float, default=time.time)

class TournamentFixture(Base):
    __tablename__ = "tournament_fixtures"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    tournament_id: Mapped[str] = mapped_column(String(64), index=True)
    round_number: Mapped[int] = mapped_column(Integer, default=1)
    match_index: Mapped[int] = mapped_column(Integer, default=1)
    player_1_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    player_1_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    player_2_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    player_2_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    room_code: Mapped[Optional[str]] = mapped_column(String(16), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="SCHEDULED") # SCHEDULED, READY, IN_PROGRESS, COMPLETED
    winner_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    winner_name: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    score_summary: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    next_fixture_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[float] = mapped_column(Float, default=time.time)

def _migrate_match_records_columns(sync_conn):
    insp = inspect(sync_conn)
    table_names = insp.get_table_names()
    if "match_records" in table_names:
        existing_cols = {c["name"] for c in insp.get_columns("match_records")}
        if "match_type" not in existing_cols:
            sync_conn.execute(text("ALTER TABLE match_records ADD COLUMN match_type VARCHAR(20) DEFAULT 'PRIVATE'"))
        if "player_1_user_id" not in existing_cols:
            sync_conn.execute(text("ALTER TABLE match_records ADD COLUMN player_1_user_id VARCHAR(64)"))
        if "player_2_user_id" not in existing_cols:
            sync_conn.execute(text("ALTER TABLE match_records ADD COLUMN player_2_user_id VARCHAR(64)"))
        if "series_id" not in existing_cols:
            sync_conn.execute(text("ALTER TABLE match_records ADD COLUMN series_id VARCHAR(64)"))
        if "tournament_id" not in existing_cols:
            sync_conn.execute(text("ALTER TABLE match_records ADD COLUMN tournament_id VARCHAR(64)"))
        if "is_bot_match" not in existing_cols:
            sync_conn.execute(text("ALTER TABLE match_records ADD COLUMN is_bot_match BOOLEAN DEFAULT FALSE"))
        if "bot_difficulty" not in existing_cols:
            sync_conn.execute(text("ALTER TABLE match_records ADD COLUMN bot_difficulty VARCHAR(32)"))

def _migrate_auth_and_profile_columns(sync_conn):
    insp = inspect(sync_conn)
    table_names = insp.get_table_names()
    dialect_name = getattr(sync_conn.dialect, "name", "").lower()
    is_pg = "postgresql" in dialect_name or "postgres" in dialect_name

    if "users" in table_names:
        user_cols = {c["name"] for c in insp.get_columns("users")}
        if "gamer_tag" not in user_cols:
            sync_conn.execute(text("ALTER TABLE users ADD COLUMN gamer_tag VARCHAR(64)"))
        if is_pg:
            try:
                sync_conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_username_key"))
                sync_conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS uq_users_username"))
                sync_conn.execute(text("DROP INDEX IF EXISTS ix_users_username"))
                sync_conn.execute(text("CREATE INDEX IF NOT EXISTS ix_users_username ON users (username)"))
            except Exception as e:
                print(f"[Schema Migration Info] Username constraint relax note: {e}", flush=True)

    if "profiles" in table_names:
        prof_cols = {c["name"] for c in insp.get_columns("profiles")}
        if "custom_team_name" not in prof_cols:
            sync_conn.execute(text("ALTER TABLE profiles ADD COLUMN custom_team_name VARCHAR(64)"))
        if "bowling_style" not in prof_cols:
            sync_conn.execute(text("ALTER TABLE profiles ADD COLUMN bowling_style VARCHAR(64) DEFAULT 'Right-arm medium'"))
        if is_pg:
            try:
                sync_conn.execute(text("ALTER TABLE profiles ALTER COLUMN avatar_url TYPE TEXT"))
            except Exception as e:
                print(f"[Schema Migration Info] Avatar column type note: {e}", flush=True)

async def init_db(max_retries: int = 3, retry_delay: float = 2.0):
    """
    Initializes database schema with retry resilience for cold-starts and connection handshakes.
    Logs masked diagnostic progress to assist with cloud deployment troubleshooting.
    """
    safe_db = get_safe_database_description(DATABASE_URL)
    print(f"[Database] Initializing connection to {safe_db}...", flush=True)

    last_err: Optional[Exception] = None
    for attempt in range(1, max_retries + 1):
        try:
            if attempt > 1:
                print(f"[Database] Connection retry attempt {attempt}/{max_retries}...", flush=True)

            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                try:
                    await conn.run_sync(_migrate_match_records_columns)
                except Exception as e:
                    print(f"[Database Schema Warning] {e}", flush=True)
                try:
                    await conn.run_sync(_migrate_auth_and_profile_columns)
                except Exception as e:
                    print(f"[Database Schema Warning] {e}", flush=True)

            print(f"[Database] Successfully connected and database schema verified.", flush=True)
            return
        except Exception as exc:
            last_err = exc
            print(
                f"[Database Connection Error] Attempt {attempt}/{max_retries} failed: "
                f"{type(exc).__name__}: {exc}",
                file=sys.stderr,
                flush=True
            )
            if attempt < max_retries:
                await asyncio.sleep(retry_delay)

    # All retries failed - provide helpful diagnostic guidance without exposing credentials
    print(
        f"[Database Fatal] Unable to establish connection to database after {max_retries} attempts.",
        file=sys.stderr,
        flush=True
    )
    err_str = str(last_err)
    if "ENOIDENTIFIER" in err_str:
        print(
            "[Database Fatal Tip] Supabase pooler rejected connection: '(ENOIDENTIFIER) no tenant identifier provided'. "
            "When connecting to 'pooler.supabase.com:6543', your username in DATABASE_URL MUST be 'postgres.<project-ref>', not just 'postgres'.",
            file=sys.stderr,
            flush=True
        )
    elif "getaddrinfo" in err_str or "Network is unreachable" in err_str or "101" in err_str:
        print(
            "[Database Fatal Tip] Network unreachable: Supabase direct connections ('db.<project-ref>.supabase.co') are "
            "IPv6-only on the free tier. Render web services do not support outbound IPv6. "
            "Use the Supabase Connection Pooler ('aws-0-<region>.pooler.supabase.com:6543') which supports dual-stack IPv4.",
            file=sys.stderr,
            flush=True
        )
    elif "password authentication failed" in err_str.lower():
        print(
            "[Database Fatal Tip] Password authentication failed. Please verify the database password in your Render DATABASE_URL.",
            file=sys.stderr,
            flush=True
        )

    sys.stderr.flush()
    sys.stdout.flush()
    if last_err:
        raise last_err

async def check_db_health() -> bool:
    try:
        async with AsyncSessionLocal() as session:
            await asyncio.wait_for(session.execute(text("SELECT 1")), timeout=5.0)
            return True
    except Exception:
        return False

async def save_completed_match(
    state_dict: Dict[str, Any],
    player_1_user_id: Optional[str] = None,
    player_2_user_id: Optional[str] = None,
    match_type: str = "PRIVATE"
):
    match_id = state_dict.get("match_id", f"m_{int(time.time())}")
    room_code = state_dict.get("room_code", "UNKNOWN")
    team_a = state_dict.get("team_a", {})
    team_b = state_dict.get("team_b", {})
    team_a_name = team_a.get("name", "Team A")
    team_b_name = team_b.get("name", "Team B")
    winner_team_id = state_dict.get("winner_team_id")
    win_desc = state_dict.get("win_margin_description", "")

    winner_name = None
    winner_team_is_a = False
    if winner_team_id == team_a.get("id"):
        winner_name = team_a_name
        winner_team_is_a = True
    elif winner_team_id == team_b.get("id"):
        winner_name = team_b_name
        winner_team_is_a = False

    inn_list = state_dict.get("innings_list", [])
    inn1_runs = inn_list[0].get("total_runs", 0) if len(inn_list) > 0 else 0
    inn1_wkt = inn_list[0].get("wickets", 0) if len(inn_list) > 0 else 0
    inn2_runs = inn_list[1].get("total_runs", 0) if len(inn_list) > 1 else 0
    inn2_wkt = inn_list[1].get("wickets", 0) if len(inn_list) > 1 else 0

    deliv_count = sum(len(inn.get("deliveries", [])) for inn in inn_list)

    series_id = state_dict.get("series_id")
    tournament_id = state_dict.get("tournament_id")
    is_bot_match = bool(state_dict.get("is_bot_match", False))
    bot_difficulty = state_dict.get("bot_difficulty")

    # Detect user IDs from state if not passed explicitly
    p1_uid = player_1_user_id or state_dict.get("player_1_user_id")
    p2_uid = player_2_user_id or state_dict.get("player_2_user_id")

    async with AsyncSessionLocal() as session:
        existing = await session.get(MatchRecord, match_id)
        if existing:
            existing.team_a_name = team_a_name
            existing.team_b_name = team_b_name
            existing.winner_team_name = winner_name
            existing.win_description = win_desc
            existing.first_innings_runs = inn1_runs
            existing.first_innings_wickets = inn1_wkt
            existing.second_innings_runs = inn2_runs
            existing.second_innings_wickets = inn2_wkt
            existing.total_deliveries = deliv_count
            existing.scorecard_json = json.dumps(state_dict)
            existing.is_bot_match = is_bot_match
            existing.bot_difficulty = bot_difficulty
            if p1_uid:
                existing.player_1_user_id = p1_uid
            if p2_uid:
                existing.player_2_user_id = p2_uid
            if series_id:
                existing.series_id = series_id
            if tournament_id:
                existing.tournament_id = tournament_id
        else:
            record = MatchRecord(
                id=match_id,
                room_code=room_code,
                match_type=match_type,
                series_id=series_id,
                tournament_id=tournament_id,
                player_1_user_id=p1_uid,
                player_2_user_id=p2_uid,
                team_a_name=team_a_name,
                team_b_name=team_b_name,
                winner_team_name=winner_name,
                win_description=win_desc,
                first_innings_runs=inn1_runs,
                first_innings_wickets=inn1_wkt,
                second_innings_runs=inn2_runs,
                second_innings_wickets=inn2_wkt,
                total_deliveries=deliv_count,
                scorecard_json=json.dumps(state_dict),
                is_bot_match=is_bot_match,
                bot_difficulty=bot_difficulty,
                created_at=time.time()
            )
            session.add(record)

        # Update Series progression if part of a multi-match series
        if series_id:
            series = await session.get(Series, series_id)
            if series and series.status == "ACTIVE":
                stmt = select(SeriesMatch).where(and_(SeriesMatch.series_id == series_id, SeriesMatch.match_id == match_id))
                existing_sm = (await session.execute(stmt)).scalar_one_or_none()
                if not existing_sm:
                    series.matches_played += 1
                    winner_uid = p1_uid if (winner_name == team_a_name) else (p2_uid if winner_name == team_b_name else None)
                    if winner_uid == series.creator_id:
                        series.creator_wins += 1
                    elif winner_uid == series.opponent_id:
                        series.opponent_wins += 1
                    else:
                        series.draws += 1

                    fmt = series.series_format
                    if fmt == "BEST_OF_3":
                        if series.creator_wins >= 2:
                            series.winner_id = series.creator_id
                            series.winner_name = series.creator_name
                            series.status = "COMPLETED"
                        elif series.opponent_wins >= 2:
                            series.winner_id = series.opponent_id
                            series.winner_name = series.opponent_name
                            series.status = "COMPLETED"
                    elif fmt == "BEST_OF_5":
                        if series.creator_wins >= 3:
                            series.winner_id = series.creator_id
                            series.winner_name = series.creator_name
                            series.status = "COMPLETED"
                        elif series.opponent_wins >= 3:
                            series.winner_id = series.opponent_id
                            series.winner_name = series.opponent_name
                            series.status = "COMPLETED"
                    elif fmt == "BEST_OF_7":
                        if series.creator_wins >= 4:
                            series.winner_id = series.creator_id
                            series.winner_name = series.creator_name
                            series.status = "COMPLETED"
                        elif series.opponent_wins >= 4:
                            series.winner_id = series.opponent_id
                            series.winner_name = series.opponent_name
                            series.status = "COMPLETED"
                    elif fmt == "FIRST_TO_N":
                        if series.creator_wins >= series.target_wins:
                            series.winner_id = series.creator_id
                            series.winner_name = series.creator_name
                            series.status = "COMPLETED"
                        elif series.opponent_wins >= series.target_wins:
                            series.winner_id = series.opponent_id
                            series.winner_name = series.opponent_name
                            series.status = "COMPLETED"
                    elif fmt == "FIXED_MATCHES":
                        if series.matches_played >= series.total_scheduled_matches:
                            series.status = "COMPLETED"
                            if series.creator_wins > series.opponent_wins:
                                series.winner_id = series.creator_id
                                series.winner_name = series.creator_name
                            elif series.opponent_wins > series.creator_wins:
                                series.winner_id = series.opponent_id
                                series.winner_name = series.opponent_name

                    series.updated_at = time.time()
                    sm = SeriesMatch(
                        id=f"sm_{int(time.time())}_{series.matches_played}",
                        series_id=series_id,
                        match_number=series.matches_played,
                        room_code=room_code,
                        match_id=match_id,
                        winner_id=winner_uid,
                        winner_name=winner_name,
                        score_summary=win_desc or f"{team_a_name} vs {team_b_name}",
                        created_at=time.time()
                    )
                    session.add(sm)

        # Update Tournament progression if part of a tournament
        if tournament_id:
            tourn = await session.get(Tournament, tournament_id)
            if tourn and tourn.status in ["IN_PROGRESS", "REGISTRATION"]:
                stmt = select(TournamentFixture).where(
                    and_(TournamentFixture.tournament_id == tournament_id, TournamentFixture.room_code == room_code)
                )
                fixture = (await session.execute(stmt)).scalar_one_or_none()
                if not fixture:
                    stmt2 = select(TournamentFixture).where(
                        and_(
                            TournamentFixture.tournament_id == tournament_id,
                            TournamentFixture.status != "COMPLETED",
                            or_(TournamentFixture.player_1_id == p1_uid, TournamentFixture.player_2_id == p1_uid)
                        )
                    )
                    fixture = (await session.execute(stmt2)).scalar_one_or_none()

                if fixture and fixture.status != "COMPLETED":
                    winner_uid = p1_uid if (winner_name == team_a_name) else (p2_uid if winner_name == team_b_name else None)
                    loser_uid = p2_uid if winner_uid == p1_uid else (p1_uid if winner_uid == p2_uid else None)

                    fixture.status = "COMPLETED"
                    fixture.winner_id = winner_uid
                    fixture.winner_name = winner_name
                    fixture.score_summary = win_desc or f"{team_a_name} won"

                    if winner_uid:
                        p_win = (await session.execute(select(TournamentParticipant).where(
                            and_(TournamentParticipant.tournament_id == tournament_id, TournamentParticipant.user_id == winner_uid)
                        ))).scalar_one_or_none()
                        if p_win:
                            p_win.matches_played += 1
                            p_win.matches_won += 1
                            p_win.points += 2

                    if loser_uid:
                        p_lose = (await session.execute(select(TournamentParticipant).where(
                            and_(TournamentParticipant.tournament_id == tournament_id, TournamentParticipant.user_id == loser_uid)
                        ))).scalar_one_or_none()
                        if p_lose:
                            p_lose.matches_played += 1
                            p_lose.matches_lost += 1
                            if tourn.tournament_format == "KNOCKOUT":
                                p_lose.is_eliminated = True

                    if tourn.tournament_format == "KNOCKOUT" and fixture.next_fixture_id and winner_uid:
                        next_fix = await session.get(TournamentFixture, fixture.next_fixture_id)
                        if next_fix:
                            if not next_fix.player_1_id:
                                next_fix.player_1_id = winner_uid
                                next_fix.player_1_name = winner_name
                            elif not next_fix.player_2_id:
                                next_fix.player_2_id = winner_uid
                                next_fix.player_2_name = winner_name
                            if next_fix.player_1_id and next_fix.player_2_id:
                                next_fix.status = "READY"

                    stmt_all = select(TournamentFixture).where(TournamentFixture.tournament_id == tournament_id)
                    all_fixtures = (await session.execute(stmt_all)).scalars().all()
                    if all_fixtures and all(f.status == "COMPLETED" for f in all_fixtures):
                        tourn.status = "COMPLETED"
                        tourn.winner_id = winner_uid
                        tourn.winner_name = winner_name
                    tourn.updated_at = time.time()

        # Authoritatively update user profiles if user IDs are present
        if p1_uid or p2_uid:
            p1_won = winner_team_is_a if winner_team_id else None
            p2_won = (not winner_team_is_a) if winner_team_id else None

            # Calculate individual runs & wickets from deliveries
            p1_runs = 0
            p1_wkts = 0
            p2_runs = 0
            p2_wkts = 0

            p1_id = state_dict.get("player_1_id")
            p2_id = state_dict.get("player_2_id")

            for inn in inn_list:
                for deliv in inn.get("deliveries", []):
                    bat_ctrl = deliv.get("batting_controller_id")
                    bowl_ctrl = deliv.get("bowling_controller_id")
                    runs = deliv.get("runs_scored", 0)
                    is_wkt = deliv.get("is_wicket", False)

                    if bat_ctrl == p1_id:
                        p1_runs += runs
                    elif bat_ctrl == p2_id:
                        p2_runs += runs

                    if bowl_ctrl == p1_id and is_wkt:
                        p1_wkts += 1
                    elif bowl_ctrl == p2_id and is_wkt:
                        p2_wkts += 1

            if p1_uid:
                prof1 = await session.get(Profile, p1_uid)
                if prof1:
                    prof1.total_matches += 1
                    prof1.total_runs += p1_runs
                    prof1.total_wickets += p1_wkts
                    if p1_won is True:
                        prof1.matches_won += 1
                        prof1.current_streak += 1
                        prof1.best_streak = max(prof1.best_streak, prof1.current_streak)
                    elif p1_won is False:
                        prof1.matches_lost += 1
                        prof1.current_streak = 0
                    prof1.updated_at = time.time()

            if p2_uid:
                prof2 = await session.get(Profile, p2_uid)
                if prof2:
                    prof2.total_matches += 1
                    prof2.total_runs += p2_runs
                    prof2.total_wickets += p2_wkts
                    if p2_won is True:
                        prof2.matches_won += 1
                        prof2.current_streak += 1
                        prof2.best_streak = max(prof2.best_streak, prof2.current_streak)
                    elif p2_won is False:
                        prof2.matches_lost += 1
                        prof2.current_streak = 0
                    prof2.updated_at = time.time()

        await session.commit()

async def get_match_history(limit: int = 20, offset: int = 0, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        query = select(MatchRecord)
        if user_id:
            query = query.where(
                or_(MatchRecord.player_1_user_id == user_id, MatchRecord.player_2_user_id == user_id)
            )
        query = query.order_by(desc(MatchRecord.created_at)).offset(offset).limit(limit)
        result = await session.execute(query)
        records = result.scalars().all()
        return [
            {
                "id": r.id,
                "room_code": r.room_code,
                "match_type": r.match_type,
                "player_1_user_id": r.player_1_user_id,
                "player_2_user_id": r.player_2_user_id,
                "team_a_name": r.team_a_name,
                "team_b_name": r.team_b_name,
                "winner_team_name": r.winner_team_name,
                "win_description": r.win_description,
                "first_innings": f"{r.first_innings_runs}/{r.first_innings_wickets}",
                "second_innings": f"{r.second_innings_runs}/{r.second_innings_wickets}",
                "total_deliveries": r.total_deliveries,
                "is_bot_match": getattr(r, "is_bot_match", False),
                "bot_difficulty": getattr(r, "bot_difficulty", None),
                "created_at": r.created_at
            }
            for r in records
        ]

async def get_match_detail(match_id: str) -> Optional[Dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        record = await session.get(MatchRecord, match_id)
        if not record:
            return None
        return json.loads(record.scorecard_json)
