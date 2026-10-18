import os
import json
import time
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Float, Boolean, Text, select, desc, or_, and_, text

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./hand_cricket.db")

# Normalize postgres:// to postgresql+asyncpg:// if provided in env
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

engine_kwargs = {"echo": False}
if "sqlite" in DATABASE_URL:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    engine_kwargs["pool_pre_ping"] = True

engine = create_async_engine(DATABASE_URL, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
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
    gamer_tag: Mapped[str] = mapped_column(String(64), unique=True, index=True) # e.g. Nishit#009
    tag_number: Mapped[int] = mapped_column(Integer, index=True)
    avatar_url: Mapped[str] = mapped_column(String(255), default="avatar_1")
    bio: Mapped[str] = mapped_column(String(255), default="Hand Cricket champion ready to dominate the pitch!")
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    country: Mapped[str] = mapped_column(String(64), default="India")
    favorite_team: Mapped[str] = mapped_column(String(64), default="Mumbai Blasters")
    batting_style: Mapped[str] = mapped_column(String(64), default="Aggressive Six-Hitter")
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
    match_type: Mapped[str] = mapped_column(String(20), default="PRIVATE") # PUBLIC or PRIVATE
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
    created_at: Mapped[float] = mapped_column(Float, default=time.time)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
        # Safe migration for sqlite if columns don't exist yet
        try:
            result = await conn.execute(text("PRAGMA table_info(match_records)"))
            existing_cols = {row[1] for row in result.fetchall()}
            if "match_type" not in existing_cols:
                await conn.execute(text("ALTER TABLE match_records ADD COLUMN match_type VARCHAR(20) DEFAULT 'PRIVATE'"))
            if "player_1_user_id" not in existing_cols:
                await conn.execute(text("ALTER TABLE match_records ADD COLUMN player_1_user_id VARCHAR(64)"))
            if "player_2_user_id" not in existing_cols:
                await conn.execute(text("ALTER TABLE match_records ADD COLUMN player_2_user_id VARCHAR(64)"))
        except Exception as e:
            print(f"[Migration Warning] {e}")

async def check_db_health() -> bool:
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
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
            if p1_uid:
                existing.player_1_user_id = p1_uid
            if p2_uid:
                existing.player_2_user_id = p2_uid
        else:
            record = MatchRecord(
                id=match_id,
                room_code=room_code,
                match_type=match_type,
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
                created_at=time.time()
            )
            session.add(record)

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
