import pytest
import asyncio
from app.rooms.manager import room_manager
from app.matchmaking.queue import matchmaking_coordinator
from app.database import init_db, AsyncSessionLocal
from sqlalchemy import text

@pytest.fixture(autouse=True)
def clean_room_manager_and_db():
    async def cleanup():
        await init_db()
        async with AsyncSessionLocal() as session:
            await session.execute(text("DELETE FROM friendships"))
            await session.execute(text("DELETE FROM match_invitations"))
            await session.execute(text("DELETE FROM notifications"))
            await session.execute(text("DELETE FROM profiles"))
            await session.execute(text("DELETE FROM users"))
            await session.execute(text("DELETE FROM match_records"))
            await session.commit()
    asyncio.run(cleanup())
    room_manager.rooms.clear()
    matchmaking_coordinator.queue.clear()
    yield
    room_manager.rooms.clear()
    matchmaking_coordinator.queue.clear()
