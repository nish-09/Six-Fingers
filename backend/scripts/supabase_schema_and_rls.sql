-- ==============================================================================
-- SIX FINGERS — SUPABASE POSTGRESQL SCHEMA & ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- This SQL script can be executed in the Supabase SQL Editor if you prefer manual
-- table provisioning, or to enforce Row-Level Security (RLS) policies.
--
-- Note: The FastAPI backend automatically provisions tables and indexes on
-- startup via SQLAlchemy (Base.metadata.create_all).
-- ==============================================================================

-- 1. USERS & PROFILES
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    username VARCHAR(32) NOT NULL UNIQUE,
    email VARCHAR(128) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    date_of_birth VARCHAR(32),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DOUBLE PRECISION NOT NULL,
    last_login_at DOUBLE PRECISION
);
CREATE INDEX IF NOT EXISTS ix_users_username ON users (username);
CREATE INDEX IF NOT EXISTS ix_users_email ON users (email);

CREATE TABLE IF NOT EXISTS profiles (
    user_id VARCHAR(64) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name VARCHAR(64) NOT NULL,
    gamer_tag VARCHAR(64) NOT NULL UNIQUE,
    tag_number INTEGER NOT NULL,
    avatar_url VARCHAR(255) NOT NULL DEFAULT 'avatar_1',
    bio VARCHAR(255) NOT NULL DEFAULT 'Hand Cricket champion ready to dominate the pitch!',
    age INTEGER,
    country VARCHAR(64) NOT NULL DEFAULT 'India',
    favorite_team VARCHAR(64) NOT NULL DEFAULT 'Mumbai Blasters',
    batting_style VARCHAR(64) NOT NULL DEFAULT 'Aggressive Six-Hitter',
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    show_age BOOLEAN NOT NULL DEFAULT FALSE,
    show_stats BOOLEAN NOT NULL DEFAULT TRUE,
    total_matches INTEGER NOT NULL DEFAULT 0,
    matches_won INTEGER NOT NULL DEFAULT 0,
    matches_lost INTEGER NOT NULL DEFAULT 0,
    total_runs INTEGER NOT NULL DEFAULT 0,
    total_wickets INTEGER NOT NULL DEFAULT 0,
    current_streak INTEGER NOT NULL DEFAULT 0,
    best_streak INTEGER NOT NULL DEFAULT 0,
    updated_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_profiles_display_name ON profiles (display_name);
CREATE INDEX IF NOT EXISTS ix_profiles_gamer_tag ON profiles (gamer_tag);
CREATE INDEX IF NOT EXISTS ix_profiles_tag_number ON profiles (tag_number);

-- 2. SOCIAL & PRESENCE
CREATE TABLE IF NOT EXISTS friendships (
    id VARCHAR(64) PRIMARY KEY,
    requester_id VARCHAR(64) NOT NULL,
    addressee_id VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at DOUBLE PRECISION NOT NULL,
    updated_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_friendships_requester_id ON friendships (requester_id);
CREATE INDEX IF NOT EXISTS ix_friendships_addressee_id ON friendships (addressee_id);
CREATE INDEX IF NOT EXISTS ix_friendships_status ON friendships (status);

CREATE TABLE IF NOT EXISTS match_invitations (
    id VARCHAR(64) PRIMARY KEY,
    sender_id VARCHAR(64) NOT NULL,
    recipient_id VARCHAR(64) NOT NULL,
    room_code VARCHAR(16) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    expires_at DOUBLE PRECISION NOT NULL,
    created_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_match_invitations_sender_id ON match_invitations (sender_id);
CREATE INDEX IF NOT EXISTS ix_match_invitations_recipient_id ON match_invitations (recipient_id);

CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    title VARCHAR(128) NOT NULL,
    message VARCHAR(255) NOT NULL,
    data_json TEXT,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_notifications_user_id ON notifications (user_id);

-- 3. TEAMS & MATCH RECORDS
CREATE TABLE IF NOT EXISTS saved_teams (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(32) NOT NULL DEFAULT '#6500C8',
    accent_color VARCHAR(32) NOT NULL DEFAULT '#FFD900',
    players_json TEXT NOT NULL,
    created_at DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS match_records (
    id VARCHAR(64) PRIMARY KEY,
    room_code VARCHAR(16) NOT NULL,
    match_type VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
    series_id VARCHAR(64),
    tournament_id VARCHAR(64),
    player_1_user_id VARCHAR(64),
    player_2_user_id VARCHAR(64),
    team_a_name VARCHAR(100) NOT NULL,
    team_b_name VARCHAR(100) NOT NULL,
    winner_team_name VARCHAR(100),
    win_description VARCHAR(255),
    first_innings_runs INTEGER NOT NULL DEFAULT 0,
    first_innings_wickets INTEGER NOT NULL DEFAULT 0,
    second_innings_runs INTEGER NOT NULL DEFAULT 0,
    second_innings_wickets INTEGER NOT NULL DEFAULT 0,
    total_deliveries INTEGER NOT NULL DEFAULT 0,
    scorecard_json TEXT NOT NULL,
    created_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_match_records_room_code ON match_records (room_code);
CREATE INDEX IF NOT EXISTS ix_match_records_player_1_user_id ON match_records (player_1_user_id);
CREATE INDEX IF NOT EXISTS ix_match_records_player_2_user_id ON match_records (player_2_user_id);
CREATE INDEX IF NOT EXISTS ix_match_records_series_id ON match_records (series_id);
CREATE INDEX IF NOT EXISTS ix_match_records_tournament_id ON match_records (tournament_id);

-- 4. SERIES & TOURNAMENTS
CREATE TABLE IF NOT EXISTS series (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(128) NOT NULL,
    creator_id VARCHAR(64) NOT NULL,
    opponent_id VARCHAR(64),
    creator_name VARCHAR(64) NOT NULL,
    opponent_name VARCHAR(64) NOT NULL DEFAULT 'Opponent',
    series_format VARCHAR(32) NOT NULL DEFAULT 'BEST_OF_3',
    total_scheduled_matches INTEGER NOT NULL DEFAULT 3,
    target_wins INTEGER NOT NULL DEFAULT 2,
    overs_per_match INTEGER NOT NULL DEFAULT 2,
    wickets_per_match INTEGER NOT NULL DEFAULT 3,
    creator_wins INTEGER NOT NULL DEFAULT 0,
    opponent_wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    matches_played INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    winner_id VARCHAR(64),
    winner_name VARCHAR(64),
    current_room_code VARCHAR(16),
    created_at DOUBLE PRECISION NOT NULL,
    updated_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_series_status ON series (status);
CREATE INDEX IF NOT EXISTS ix_series_creator_id ON series (creator_id);
CREATE INDEX IF NOT EXISTS ix_series_opponent_id ON series (opponent_id);

CREATE TABLE IF NOT EXISTS series_matches (
    id VARCHAR(64) PRIMARY KEY,
    series_id VARCHAR(64) NOT NULL REFERENCES series(id) ON DELETE CASCADE,
    match_number INTEGER NOT NULL,
    room_code VARCHAR(16) NOT NULL,
    match_id VARCHAR(64),
    winner_id VARCHAR(64),
    winner_name VARCHAR(64),
    score_summary VARCHAR(255),
    created_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_series_matches_series_id ON series_matches (series_id);

CREATE TABLE IF NOT EXISTS tournaments (
    id VARCHAR(64) PRIMARY KEY,
    title VARCHAR(128) NOT NULL,
    description VARCHAR(255) NOT NULL DEFAULT 'Six Fingers Hand Cricket Championship',
    organizer_id VARCHAR(64) NOT NULL,
    organizer_name VARCHAR(64) NOT NULL,
    tournament_format VARCHAR(32) NOT NULL DEFAULT 'KNOCKOUT',
    max_participants INTEGER NOT NULL DEFAULT 4,
    overs_per_match INTEGER NOT NULL DEFAULT 2,
    wickets_per_match INTEGER NOT NULL DEFAULT 3,
    status VARCHAR(20) NOT NULL DEFAULT 'REGISTRATION',
    current_round INTEGER NOT NULL DEFAULT 1,
    winner_id VARCHAR(64),
    winner_name VARCHAR(64),
    created_at DOUBLE PRECISION NOT NULL,
    updated_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tournaments_status ON tournaments (status);
CREATE INDEX IF NOT EXISTS ix_tournaments_organizer_id ON tournaments (organizer_id);

CREATE TABLE IF NOT EXISTS tournament_participants (
    id VARCHAR(64) PRIMARY KEY,
    tournament_id VARCHAR(64) NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,
    user_name VARCHAR(64) NOT NULL,
    gamer_tag VARCHAR(64) NOT NULL,
    avatar_url VARCHAR(255) NOT NULL DEFAULT 'avatar_1',
    seed INTEGER NOT NULL DEFAULT 0,
    is_eliminated BOOLEAN NOT NULL DEFAULT FALSE,
    matches_played INTEGER NOT NULL DEFAULT 0,
    matches_won INTEGER NOT NULL DEFAULT 0,
    matches_lost INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    joined_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tournament_participants_tournament_id ON tournament_participants (tournament_id);
CREATE INDEX IF NOT EXISTS ix_tournament_participants_user_id ON tournament_participants (user_id);

CREATE TABLE IF NOT EXISTS tournament_fixtures (
    id VARCHAR(64) PRIMARY KEY,
    tournament_id VARCHAR(64) NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL DEFAULT 1,
    match_index INTEGER NOT NULL DEFAULT 1,
    player_1_id VARCHAR(64),
    player_1_name VARCHAR(64),
    player_2_id VARCHAR(64),
    player_2_name VARCHAR(64),
    room_code VARCHAR(16),
    status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
    winner_id VARCHAR(64),
    winner_name VARCHAR(64),
    score_summary VARCHAR(255),
    next_fixture_id VARCHAR(64),
    created_at DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_tournament_fixtures_tournament_id ON tournament_fixtures (tournament_id);

-- ==============================================================================
-- 5. ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================
-- In the Six Fingers production architecture, the FastAPI backend acts as the
-- authoritative security gateway. Backend queries connect via the server credentials
-- (`postgres` role / pooler) which has BYPASSRLS permissions.
--
-- If RLS is enabled in the Supabase Dashboard, these policies ensure that:
-- 1. The backend server role has full access to all tables.
-- 2. Anonymous clients ('anon' role) cannot perform unauthorized direct reads
--    or mutations bypassing game rules and password hashing.
-- ==============================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE match_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE series ENABLE ROW LEVEL SECURITY;
ALTER TABLE series_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_fixtures ENABLE ROW LEVEL SECURITY;

-- Allow server-level backend connection role full access to all tables
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name IN (
            'users', 'profiles', 'friendships', 'match_invitations',
            'notifications', 'saved_teams', 'match_records', 'series',
            'series_matches', 'tournaments', 'tournament_participants',
            'tournament_fixtures'
          )
    LOOP
        EXECUTE format('CREATE POLICY "backend_full_access" ON %I FOR ALL TO postgres USING (true) WITH CHECK (true);', t);
        EXECUTE format('CREATE POLICY "backend_service_access" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true);', t);
    END LOOP;
END $$;

-- Optional read access for public profiles to authenticated users if using Supabase client
CREATE POLICY "public_profiles_read" ON profiles FOR SELECT TO authenticated USING (is_public = true);

-- Completed match history read access
CREATE POLICY "completed_matches_read" ON match_records FOR SELECT TO authenticated USING (true);
