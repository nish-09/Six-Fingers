# SIX FINGERS — Multiplayer Hand Cricket

An expressive, production-grade multiplayer Hand Cricket web application powered by **Next.js (React / TypeScript)**, **FastAPI (Python)**, **WebRTC**, and **MediaPipe Computer Vision**.

Directly inspired by high-energy neo-brutalist gaming interfaces with electric yellow, vivid purple, hot pink, and lime green aesthetics.

---

## 🚀 Key Features

### 1. Peer-to-Peer Multiplayer & Private Rooms
- **6-Character Room Codes**: Instant room creation (e.g. `26PW7B`) and direct invitation link sharing (`?join=CODE`).
- **Server-Authoritative Game Engine**: Python FastAPI backend guarantees deterministic scoring, ball counting, innings progression, and target chasing.
- **Strict Privacy Isolation**: During the private decision phase, the opponent's video stream is completely replaced by a fair-play privacy shield. Secret numbers are locked server-side and never broadcast over the network before the reveal.
- **Simultaneous Hand Reveal**: Once both players' choices are locked, the server simultaneously broadcasts both numbers, triggering energetic reveal animations and sound effects.

### 2. Live Webcams & Computer Vision
- **MediaPipe Hand Landmark Tracking**: In-browser client-side 21-landmark tracking with orientation-invariant geometric finger extension detection.
- **Hand Cricket Number Recognition**: Supports numbers 1 to 6 (Index=1, V-sign=2, 3 fingers=3, 4 fingers=4, open palm=5, classic thumb-out fist=6).
- **Temporal Stability Filter**: Requires stable pose for consecutive frames to eliminate accidental gestures.
- **Private Manual Keypad Fallback**: Instant on-screen 1–6 arcade keypad if lighting is low or webcam is unavailable.

### 3. IPL-Inspired Sound Design & Commentary
- **Synthesized Web Audio API Engine**: Zero-latency, 100% offline procedural audio synthesizer for bat cracks, timber wicket impacts, boundary fanfare arpeggios, stadium crowd cheers, coin flips, and countdown beeps.
- **Multilingual AI Commentary**: Dynamic context-aware commentary matching actual match states in **English**, **Hindi (हिन्दी)**, **Marathi (मराठी)**, and **Gujarati (ગુજરાતી)**.
- **Browser Speech Synthesis**: Real-time spoken voice delivery with stale commentary cancellation.

### 4. Comprehensive Match & Team Management
- **Full Cricket Scorecard**: Innings tracking, striker/non-striker strike rotation, bowler rotation (preventing consecutive overs), target calculations, required run rates, and ball-by-ball circles.
- **Persistent Database**: SQLite + SQLAlchemy 2 with async drivers saving match scorecards, delivery logs, and head-to-head records.
- **Instant Rematches**: Rematch action resets match state for the same room code without needing to re-enter links.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS, Lucide Icons, Canvas Confetti, Web Speech API, Web Audio API.
- **Computer Vision**: MediaPipe Tasks Vision (`@mediapipe/tasks-vision`) client-side hand landmarker.
- **Video/Audio**: WebRTC `RTCPeerConnection` with STUN servers (`stun.l.google.com:19302`).
- **Backend**: Python 3.13, FastAPI, Uvicorn, WebSockets, Pydantic v2, SQLAlchemy 2 (asyncio), aiosqlite.
- **Testing**: Pytest, Pytest-Asyncio, Starlette TestClient, Node test scripts, Browser Subagent recording.

---

## 📦 Project Structure

```
Cricket/
├── backend/
│   ├── app/
│   │   ├── commentary/
│   │   │   └── service.py       # Multilingual commentary engine (EN, HI, MR, GU)
│   │   ├── engine/
│   │   │   └── hand_cricket.py  # Authoritative game engine & rules
│   │   ├── models/
│   │   │   └── game.py          # Pydantic schemas & state models
│   │   ├── rooms/
│   │   │   └── manager.py       # Room lifecycle, privacy locks & signaling
│   │   ├── database.py          # SQLAlchemy SQLite persistence
│   │   └── main.py              # FastAPI app, REST routes, WebSockets
│   ├── tests/
│   │   ├── test_game_engine.py  # Rule tests, scoring, innings, chase
│   │   └── test_api_and_multiplayer.py # Room creation, privacy isolation tests
│   ├── requirements.txt
│   └── pytest.ini
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css      # Neo-brutalist theme tokens & styles
│   │   │   ├── layout.tsx       # Root layout & meta tags
│   │   │   └── page.tsx         # Main page router & multiplayer state
│   │   ├── components/
│   │   │   ├── Navbar.tsx       # Brand wordmark, language, audio controls
│   │   │   ├── LandingHero.tsx  # Hero section matching visual reference
│   │   │   ├── LobbyView.tsx    # Room lobby, rules config, invite links
│   │   │   ├── TossModal.tsx    # Interactive coin flip & bat/bowl decision
│   │   │   ├── LiveMatchView.tsx# Video arena, privacy shield, keypad, reveal
│   │   │   ├── Scoreboard.tsx   # Live cricket scoreboard & ball ticker
│   │   │   ├── DetailedScorecardModal.tsx # Batting & bowling tables
│   │   │   ├── MatchHistoryModal.tsx # Past match records
│   │   │   ├── SettingsModal.tsx# Sound test & calibration guide
│   │   │   └── Stickers.tsx     # Custom neo-brutalist SVG stickers
│   │   └── lib/
│   │       ├── sound.ts         # Synthesized Web Audio engine
│   │       ├── speech.ts        # Multilingual SpeechSynthesis manager
│   │       ├── webrtc.ts        # P2P WebRTC manager
│   │       └── vision/
│   │           └── gestureRecognizer.ts # Landmark distance invariant detector
│   ├── tests/
│   │   └── test_gestures.mjs    # Landmark gesture unit tests
│   ├── package.json
│   ├── tailwind.config.js
│   └── tsconfig.json
├── design-reference.png         # Primary neo-brutalist UI reference
├── .env.example
└── README.md
```

---

## 🏃 Quick Start (Local Development)

### 1. Start the Backend Server

```bash
cd backend
python -m venv venv
venv\Scripts\activate   # On Windows
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
Backend will start on `http://127.0.0.1:8000` (Health check at `http://127.0.0.1:8000/health`).

### 2. Start the Frontend Application

```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Running Automated Tests

### 1. Backend Game Engine & Multiplayer Test Suite
```bash
cd backend
venv\Scripts\pytest
```
Verifies:
- Run scoring on different numbers.
- Wicket dismissal on matching numbers.
- Privacy isolation (opponent locked message does NOT leak number).
- Simultaneous reveal broadcast.
- Chase target victory and innings transitions.
- Duplicate submission rejection and stale delivery ID guards.

### 2. Frontend Hand Landmark Gesture Tests
```bash
cd frontend
node tests/test_gestures.mjs
```
Verifies landmark classification for numbers 1 to 6 and temporal stability filters.

---

## 🔒 Security & Fair Play Guarantee
- **Zero Client Trust**: Scores, wickets, overs, and bowler eligibility are computed strictly by the server engine.
- **Payload Privacy**: Network traffic between lock and reveal does not contain the opponent's chosen number.
- **Idempotency**: Submissions must match the active `delivery_id` (`inn1_o0_b1`). Old or duplicate submissions are rejected.

---

## 🌐 Known Limitations & Notes
- **WebRTC Direct P2P**: Direct peer connections work smoothly across local networks and NATs using public Google STUN servers. On strict corporate symmetric NATs, a TURN relay server (such as Twilio or Coturn) should be configured in `webrtc.ts`.
- **Speech Synthesis**: Browser speech synthesis voices depend on the user's OS installed language packs. When a specific regional voice (e.g. Marathi or Gujarati) is not pre-installed on the client OS, the engine displays the commentary text in the on-screen ticker.
