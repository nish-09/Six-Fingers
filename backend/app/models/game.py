from enum import Enum
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import time

class PlayerRole(str, Enum):
    BATSMAN = "batsman"
    BOWLER = "bowler"
    ALL_ROUNDER = "all_rounder"

class UserRole(str, Enum):
    PLAYER = "player"
    SPECTATOR = "spectator"

class RotationMode(str, Enum):
    AUTOMATIC = "automatic"
    CAPTAIN_SELECTED = "captain_selected"
    MANUAL = "manual"

class MatchPhase(str, Enum):
    LOBBY = "lobby"
    TOSS = "toss"
    DECISION = "decision"
    REVEAL = "reveal"
    DISCUSSION = "discussion"
    OVER_BREAK = "over_break"
    INNINGS_BREAK = "innings_break"
    MATCH_END = "match_end"

class CommentaryLanguage(str, Enum):
    ENGLISH = "en"
    HINDI = "hi"
    MARATHI = "mr"
    GUJARATI = "gu"

class PlayerRosterItem(BaseModel):
    id: str
    name: str
    role: PlayerRole = PlayerRole.ALL_ROUNDER
    avatar: Optional[str] = None
    batting_order: int = 1
    bowling_order: int = 1

class RoomParticipant(BaseModel):
    id: str
    name: str
    role: UserRole = UserRole.PLAYER
    team_id: Optional[str] = None
    is_captain: bool = False
    is_host: bool = False
    is_ready: bool = False
    is_connected: bool = True
    avatar: Optional[str] = None
    joined_at: float = Field(default_factory=time.time)

class TeamConfig(BaseModel):
    id: str
    name: str
    color: str = "#6500C8"
    accent_color: str = "#FFD900"
    captain_id: Optional[str] = None
    players: List[PlayerRosterItem] = Field(default_factory=list) # in-game cricket roster
    human_player_ids: List[str] = Field(default_factory=list) # connected human players
    batting_controller_order: List[str] = Field(default_factory=list) # rotation order of human player IDs
    bowling_controller_order: List[str] = Field(default_factory=list) # rotation order of human player IDs

class MatchRules(BaseModel):
    overs_per_innings: int = 2
    wickets_per_innings: int = 3
    balls_per_over: int = 6
    decision_timer_seconds: int = 5
    super_over_on_tie: bool = True
    allowed_numbers: List[int] = Field(default_factory=lambda: [1, 2, 3, 4, 5, 6])
    manual_fallback_allowed: bool = True
    players_per_team: int = 1 # 1 to 11
    max_spectators: int = 20 # 0 to 50
    rotation_mode: RotationMode = RotationMode.AUTOMATIC
    commentary_language: CommentaryLanguage = CommentaryLanguage.ENGLISH
    sound_effects_enabled: bool = True

class DeliverySubmission(BaseModel):
    room_code: str
    player_id: str
    delivery_id: str
    chosen_number: int
    timestamp: float = Field(default_factory=time.time)

class DeliveryResult(BaseModel):
    delivery_id: str
    innings_number: int
    over: int
    ball_in_over: int
    total_balls: int
    batsman_id: str
    batsman_name: str
    bowler_id: str
    bowler_name: str
    batting_controller_id: Optional[str] = None
    batting_controller_name: Optional[str] = None
    bowling_controller_id: Optional[str] = None
    bowling_controller_name: Optional[str] = None
    batsman_number: int
    bowler_number: int
    runs_scored: int
    is_wicket: bool
    dismissal_type: Optional[str] = None
    innings_total_runs: int
    innings_wickets: int
    commentary_text: Dict[str, str] = Field(default_factory=dict)
    timestamp: float = Field(default_factory=time.time)

class ChatMessage(BaseModel):
    id: str
    sender_id: str
    sender_name: str
    sender_role: str = "player"
    team_id: Optional[str] = None
    channel: str = "all" # "all" | "team" | "spectator"
    text: str = ""
    reaction: Optional[str] = None
    timestamp: float = Field(default_factory=time.time)

class BatterStats(BaseModel):
    player_id: str
    name: str
    runs: int = 0
    balls_faced: int = 0
    fours: int = 0
    sixes: int = 0
    is_out: bool = False
    dismissal_info: Optional[str] = None

class BowlerStats(BaseModel):
    player_id: str
    name: str
    balls_bowled: int = 0
    runs_conceded: int = 0
    wickets: int = 0
    maidens: int = 0

class InningsScorecard(BaseModel):
    innings_number: int
    batting_team_id: str
    batting_team_name: str
    bowling_team_id: str
    bowling_team_name: str
    total_runs: int = 0
    wickets: int = 0
    balls_bowled: int = 0
    target: Optional[int] = None
    batters: Dict[str, BatterStats] = Field(default_factory=dict)
    bowlers: Dict[str, BowlerStats] = Field(default_factory=dict)
    deliveries: List[DeliveryResult] = Field(default_factory=list)
    is_completed: bool = False

class MatchState(BaseModel):
    match_id: str
    room_code: str
    phase: MatchPhase = MatchPhase.LOBBY
    rules: MatchRules = Field(default_factory=MatchRules)
    host_id: str = ""
    
    # Teams
    team_a: TeamConfig
    team_b: TeamConfig
    
    # All room participants (players + spectators)
    participants: Dict[str, RoomParticipant] = Field(default_factory=dict)
    spectators: List[RoomParticipant] = Field(default_factory=list)
    spectator_count: int = 0
    
    # User account links (for authenticated players)
    player_1_user_id: Optional[str] = None
    player_2_user_id: Optional[str] = None
    match_type: str = "PRIVATE" # "PUBLIC", "PRIVATE", "SERIES", "TOURNAMENT"
    series_id: Optional[str] = None
    tournament_id: Optional[str] = None

    # Legacy player fields (maintained for backward compatibility with 1v1 tests)
    player_1_id: str
    player_1_name: str = "Player 1"
    player_1_team_id: str = ""
    player_1_ready: bool = False
    player_1_connected: bool = True
    
    player_2_id: Optional[str] = None
    player_2_name: Optional[str] = None
    player_2_team_id: Optional[str] = None
    player_2_ready: bool = False
    player_2_connected: bool = False
    
    # Toss
    toss_winner_id: Optional[str] = None
    toss_decision: Optional[str] = None # "bat" or "bowl"
    
    # Current gameplay
    current_innings_number: int = 1
    innings_list: List[InningsScorecard] = Field(default_factory=list)
    
    # Active Human Controllers (who holds the camera/keypad for this over)
    active_batting_controller_id: Optional[str] = None
    active_bowling_controller_id: Optional[str] = None
    next_batting_controller_id: Optional[str] = None
    next_bowling_controller_id: Optional[str] = None
    
    # In-game named players (cricket roster identities)
    current_striker_id: Optional[str] = None
    current_non_striker_id: Optional[str] = None
    current_bowler_id: Optional[str] = None
    last_bowler_id: Optional[str] = None
    
    # Secret decision lock
    current_delivery_id: str = "inn1_o0_b1"
    decision_deadline: float = 0.0
    pending_submissions: Dict[str, int] = Field(default_factory=dict) # private server side only!
    ready_for_next_ball: Dict[str, bool] = Field(default_factory=dict)
    over_transition_ready: Dict[str, bool] = Field(default_factory=dict)
    
    # Social / Chat
    recent_chats: List[ChatMessage] = Field(default_factory=list)
    
    # Result
    winner_team_id: Optional[str] = None
    win_margin_description: Optional[str] = None
    is_super_over: bool = False
    is_match_over: bool = False
    is_bot_match: bool = False
    bot_difficulty: Optional[str] = None
