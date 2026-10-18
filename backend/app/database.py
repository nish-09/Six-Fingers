import os
import json
import time
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, Float, Text, select, desc, text

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./hand_cricket.db")

# Normalize postgres:// to postgresql+asyncpg:// if provided in env
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif DATABASE_URL.startswith("postgresql://") and not DATABASE_URL.startswith("postgresql+asyncpg://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)

# Connection engine with appropriate pool configuration
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

class SavedTeam(Base):
    __tablename__ = "saved_teams"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    color: Mapped[str] = mapped_column(String(32), default="#6500C8")
    accent_color: Mapped[str] = mapped_column(String(32), default="#FFD900")
    players_json: Mapped[str] = mapped_column(Text) # JSON string of players
    created_at: Mapped[float] = mapped_column(Float, default=time.time)

class MatchRecord(Base):
    __tablename__ = "match_records"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    room_code: Mapped[str] = mapped_column(String(16), index=True)
    team_a_name: Mapped[str] = mapped_column(String(100))
    team_b_name: Mapped[str] = mapped_column(String(100))
    winner_team_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    win_description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    first_innings_runs: Mapped[int] = mapped_column(Integer, default=0)
    first_innings_wickets: Mapped[int] = mapped_column(Integer, default=0)
    second_innings_runs: Mapped[int] = mapped_column(Integer, default=0)
    second_innings_wickets: Mapped[int] = mapped_column(Integer, default=0)
    total_deliveries: Mapped[int] = mapped_column(Integer, default=0)
    scorecard_json: Mapped[str] = mapped_column(Text) # Complete match state & scorecard
    created_at: Mapped[float] = mapped_column(Float, default=time.time)

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def check_db_health() -> bool:
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            return True
    except Exception:
        return False

async def save_completed_match(state_dict: Dict[str, Any]):
    match_id = state_dict.get("match_id", f"m_{int(time.time())}")
    room_code = state_dict.get("room_code", "UNKNOWN")
    team_a = state_dict.get("team_a", {})
    team_b = state_dict.get("team_b", {})
    team_a_name = team_a.get("name", "Team A")
    team_b_name = team_b.get("name", "Team B")
    winner_team_id = state_dict.get("winner_team_id")
    win_desc = state_dict.get("win_margin_description", "")
    
    winner_name = None
    if winner_team_id == team_a.get("id"):
        winner_name = team_a_name
    elif winner_team_id == team_b.get("id"):
        winner_name = team_b_name

    inn_list = state_dict.get("innings_list", [])
    inn1_runs = inn_list[0].get("total_runs", 0) if len(inn_list) > 0 else 0
    inn1_wkt = inn_list[0].get("wickets", 0) if len(inn_list) > 0 else 0
    inn2_runs = inn_list[1].get("total_runs", 0) if len(inn_list) > 1 else 0
    inn2_wkt = inn_list[1].get("wickets", 0) if len(inn_list) > 1 else 0
    
    deliv_count = sum(len(inn.get("deliveries", [])) for inn in inn_list)

    async with AsyncSessionLocal() as session:
        # Safe Upsert: Check if record exists
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
        else:
            record = MatchRecord(
                id=match_id,
                room_code=room_code,
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
        await session.commit()

async def get_match_history(limit: int = 20, offset: int = 0) -> List[Dict[str, Any]]:
    async with AsyncSessionLocal() as session:
        query = select(MatchRecord).order_by(desc(MatchRecord.created_at)).offset(offset).limit(limit)
        result = await session.execute(query)
        records = result.scalars().all()
        return [
            {
                "id": r.id,
                "room_code": r.room_code,
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

