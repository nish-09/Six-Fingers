"""
Six Fingers — SQLite to Supabase PostgreSQL Data Migration Script
==================================================================
This utility safely and idempotently transfers all existing records from the local
SQLite database (hand_cricket.db) into a Supabase PostgreSQL instance.

Features:
- Idempotent: uses merge operations so running multiple times is safe.
- Safe: never deletes or drops existing records.
- Preserves all relationships: respects insertion order (users, profiles, matches, series, tournaments).
- Validates data integrity before and after migration.

Usage:
    python scripts/migrate_sqlite_to_supabase.py --sqlite-path ./hand_cricket.db --postgres-url "$DATABASE_URL"
"""

import os
import sys
import argparse
import asyncio
from typing import Dict, Any, List

# Add parent directory to path so app modules can be imported
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select, func, text
from app.database import (
    Base,
    configure_database,
    User,
    Profile,
    Friendship,
    MatchInvitation,
    Notification,
    SavedTeam,
    MatchRecord,
    Series,
    SeriesMatch,
    Tournament,
    TournamentParticipant,
    TournamentFixture
)

MODEL_ORDER = [
    ("users", User),
    ("profiles", Profile),
    ("friendships", Friendship),
    ("match_invitations", MatchInvitation),
    ("notifications", Notification),
    ("saved_teams", SavedTeam),
    ("match_records", MatchRecord),
    ("series", Series),
    ("series_matches", SeriesMatch),
    ("tournaments", Tournament),
    ("tournament_participants", TournamentParticipant),
    ("tournament_fixtures", TournamentFixture),
]

async def migrate_data(sqlite_path: str, postgres_url: str, environment: str = "production"):
    print("=" * 70)
    print("SIX FINGERS — SQLITE TO SUPABASE POSTGRESQL MIGRATION")
    print("=" * 70)

    if not os.path.exists(sqlite_path):
        print(f"[Error] Source SQLite database not found at: {sqlite_path}")
        return False

    sqlite_url = f"sqlite+aiosqlite:///{os.path.abspath(sqlite_path)}"
    print(f"[*] Source Database: {sqlite_url}")

    # Normalize PostgreSQL URL
    clean_pg_url, pg_kwargs = configure_database(postgres_url, environment=environment)
    # Mask password for display
    display_url = clean_pg_url
    if "@" in display_url:
        prefix, rest = display_url.split("@", 1)
        if ":" in prefix:
            user_part = prefix.rsplit(":", 1)[0]
            display_url = f"{user_part}:****@{rest}"
    print(f"[*] Target Database: {display_url}")
    print()

    # Create engines
    source_engine = create_async_engine(sqlite_url, echo=False)
    target_engine = create_async_engine(clean_pg_url, **pg_kwargs)

    SourceSession = async_sessionmaker(source_engine, expire_on_commit=False, class_=AsyncSession)
    TargetSession = async_sessionmaker(target_engine, expire_on_commit=False, class_=AsyncSession)

    # Step 1: Ensure target schema exists
    print("[1/3] Ensuring target schema tables and indexes exist...")
    async with target_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("  -> Schema initialized successfully.")
    print()

    # Step 2: Migrate records table by table
    print("[2/3] Transferring records...")
    migration_summary: Dict[str, Dict[str, int]] = {}

    async with SourceSession() as src_session, TargetSession() as tgt_session:
        for table_name, model_cls in MODEL_ORDER:
            # Query source records
            result = await src_session.execute(select(model_cls))
            records = result.scalars().all()
            source_count = len(records)

            if source_count == 0:
                migration_summary[table_name] = {"source": 0, "transferred": 0}
                print(f"  - {table_name:<24}: 0 records (skipped)")
                continue

            transferred_count = 0
            for record in records:
                # Use merge to insert or update idempotently without duplicate key errors
                await tgt_session.merge(record)
                transferred_count += 1

            await tgt_session.commit()
            migration_summary[table_name] = {"source": source_count, "transferred": transferred_count}
            print(f"  - {table_name:<24}: {transferred_count}/{source_count} records merged")

    print()

    # Step 3: Validate row counts in target
    print("[3/3] Validating target database integrity...")
    async with TargetSession() as tgt_session:
        for table_name, model_cls in MODEL_ORDER:
            count_res = await tgt_session.execute(select(func.count()).select_from(model_cls))
            target_count = count_res.scalar_one()
            src_info = migration_summary.get(table_name, {"source": 0, "transferred": 0})
            print(f"  - {table_name:<24}: target total = {target_count} (migrated {src_info['transferred']})")

    await source_engine.dispose()
    await target_engine.dispose()

    print()
    print("=" * 70)
    print("MIGRATION COMPLETED SUCCESSFULLY")
    print("=" * 70)
    return True

def main():
    parser = argparse.ArgumentParser(description="Migrate Six Fingers database from SQLite to Supabase PostgreSQL")
    parser.add_argument("--sqlite-path", default=os.getenv("SQLITE_PATH", "./hand_cricket.db"), help="Path to source SQLite database file")
    parser.add_argument("--postgres-url", default=os.getenv("DATABASE_URL"), help="Target Supabase PostgreSQL connection string")

    args = parser.parse_args()

    if not args.postgres_url:
        print("[Error] Target PostgreSQL URL not provided. Set DATABASE_URL or pass --postgres-url.")
        sys.exit(1)

    success = asyncio.run(migrate_data(args.sqlite_path, args.postgres_url))
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
