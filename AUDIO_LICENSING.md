# Six Fingers Audio & Speech Licensing Documentation

## Overview
This document tracks all audio assets, sound synthesis pipelines, and text-to-speech commentary configurations utilized in the Six Fingers cricket game.

In strict compliance with game licensing and copyright standards:
- **NO IPL broadcast recordings**, official league audio clips, franchise anthems, or television broadcast soundtrack recordings are used.
- All stadium sound effects, impacts, and fanfares are **100% procedurally synthesized in real-time** using the Web Audio API standard.
- Commentary voice audio is rendered through the standard **W3C Web Speech API (`SpeechSynthesis`)**, selecting native Indian English (`en-IN`) and Hindi (`hi-IN`) synthesized system voices without bundling proprietary recordings.

---

## Procedural Sound Synthesis Inventory (`frontend/src/lib/sound.ts`)

| Sound Effect | Technical Generation Method | Audio Characteristics | License / Attribution |
| :--- | :--- | :--- | :--- |
| **Bat Hit** (`playBatHit`) | Dual damped triangle oscillator (190Hz -> 85Hz) with quick bandpass burst (1200Hz). | Crisp willow impact with rapid acoustic decay. | Original / MIT License |
| **Dot Ball** (`playDotBall`) | Low sine pulse (110Hz -> 50Hz) followed by descending pitch chirp. | Heavy defensive thud and pressure-mounting tone. | Original / MIT License |
| **Single Run** (`playSingleRun`) | Dual ascending chime (440Hz -> 660Hz) with bright gain envelope. | Quick, energetic running tone. | Original / MIT License |
| **Four Fanfare** (`playFourFanfare`) | 3-note harmonic trumpet arpeggio (C5-E5-G5: 523Hz, 659Hz, 784Hz) with cheer burst. | Energetic boundary fanfare with brass resonance. | Original / MIT License |
| **Six Fanfare** (`playSixFanfare`) | 4-chord fanfare (C5-G5-C6: 523Hz, 784Hz, 1046.5Hz) with exponential stadium cheer swell. | Dramatic, euphoric maximum celebration. | Original / MIT License |
| **Wicket Fallen** (`playWicket`) | Sharp timber impact (800Hz -> 60Hz) with dissonant rattling overtone (440Hz/311Hz) and crowd gasp noise envelope. | Dramatic shattered stumps impact and sudden stadium shock. | Original / MIT License |
| **Appeal / Howzat** (`playAppeal`) | Dual-glissando harmonic sweep (280Hz -> 620Hz) modeling vocal throat tension. | Rising umpire appeal tension. | Original / MIT License |
| **Coin Toss** (`playTossCoin`) | Ultra-pure sine ring (2400Hz) with metallic beating overtone (3100Hz). | Spinning metallic coin reverberation. | Original / MIT License |
| **Innings Transition** (`playInningsTransition`) | Dual stadium horn (196Hz & 293.6Hz: G3 & D4) with subtle chorus detune. | Broad, resonant stadium horn signaling break/swap. | Original / MIT License |
| **Match Victory** (`playVictory`) | 4-chord triumphant fanfare (C5-E5-G5-C6) with sustained crowd cheer. | Championship celebration harmony. | Original / MIT License |
| **Stadium Ambience** (`startAmbience`) | Continuous dual lowpass-filtered pink/brownian noise generators (350Hz cutoff) with gain modulation. | Tense, immersive live cricket stadium background roar. | Original / MIT License |

---

## Audio Engineering & Safety Principles
1. **Dynamic Ducking**:
   - Background stadium ambience automatically ducks by -12dB (`gain = 0.25`) whenever AI commentary is speaking, preventing sound masking and ensuring broadcast voice intelligibility.
2. **Autoplay Restrictions**:
   - `AudioContext` is lazily instantiated and unlocked on the player's first gesture or click interaction (`ensureContext()`), fully respecting modern browser autoplay policies on Chrome, Safari, Firefox, Edge, and iOS WebKit.
3. **Graceful Fallback & Headless Safety**:
   - If Web Audio or SpeechSynthesis is unavailable (e.g., SSR, automated headless browser tests, restricted mobile webviews), all audio calls fail silently without throwing exceptions or blocking match progression.
4. **Volume Persistence**:
   - Master volume (`sixfingers_volume`), SFX volume (`sixfingers_sfx_volume`), and Commentary volume (`sixfingers_comm_volume`) are independently stored in `localStorage` and respected across sessions.
