// Automated tests for API & WebSocket URL resolution across environments

import {
  getApiBaseUrl,
  getWsBaseUrl,
  getWsEndpoint,
  getPresenceWsEndpoint,
  getMatchmakingWsEndpoint,
  DEFAULT_PRODUCTION_BACKEND
} from "../src/lib/config.ts";
import assert from "node:assert";

console.log("Running API & WebSocket configuration tests...");

const originalEnv = { ...process.env };

function resetEnv() {
  process.env = { ...originalEnv };
  delete process.env.NEXT_PUBLIC_BACKEND_URL;
  delete process.env.NEXT_PUBLIC_API_URL;
  delete process.env.NEXT_PUBLIC_WS_URL;
}

// Test 1: NEXT_PUBLIC_BACKEND_URL is primary source
resetEnv();
process.env.NEXT_PUBLIC_BACKEND_URL = "https://six-fingers-backend.onrender.com";
assert.strictEqual(
  getApiBaseUrl(),
  "https://six-fingers-backend.onrender.com",
  "Should use NEXT_PUBLIC_BACKEND_URL"
);
console.log("✔ Test 1: NEXT_PUBLIC_BACKEND_URL read correctly");

// Test 2: Trailing slash is stripped
resetEnv();
process.env.NEXT_PUBLIC_BACKEND_URL = "https://six-fingers-backend.onrender.com/";
assert.strictEqual(
  getApiBaseUrl(),
  "https://six-fingers-backend.onrender.com",
  "Should strip trailing slash"
);
console.log("✔ Test 2: Trailing slash stripped");

// Test 3: Trailing /api is stripped to prevent duplicate /api/api/...
resetEnv();
process.env.NEXT_PUBLIC_BACKEND_URL = "https://six-fingers-backend.onrender.com/api";
assert.strictEqual(
  getApiBaseUrl(),
  "https://six-fingers-backend.onrender.com",
  "Should strip trailing /api to prevent duplicate prefixes"
);

process.env.NEXT_PUBLIC_BACKEND_URL = "https://six-fingers-backend.onrender.com/api/";
assert.strictEqual(
  getApiBaseUrl(),
  "https://six-fingers-backend.onrender.com",
  "Should strip trailing /api/ to prevent duplicate prefixes"
);
console.log("✔ Test 3: Trailing /api stripped successfully");

// Test 4: NEXT_PUBLIC_API_URL backward-compatible fallback
resetEnv();
process.env.NEXT_PUBLIC_API_URL = "https://custom-api.example.com";
assert.strictEqual(
  getApiBaseUrl(),
  "https://custom-api.example.com",
  "Should fallback to NEXT_PUBLIC_API_URL"
);
console.log("✔ Test 4: NEXT_PUBLIC_API_URL alias supported");

// Test 5: getWsBaseUrl automatically derives wss:// from https:// API base
resetEnv();
process.env.NEXT_PUBLIC_BACKEND_URL = "https://six-fingers-backend.onrender.com";
assert.strictEqual(
  getWsBaseUrl(),
  "wss://six-fingers-backend.onrender.com",
  "Should derive wss:// from https://"
);
console.log("✔ Test 5: Derived wss:// base URL from https:// backend");

// Test 6: getWsBaseUrl strips trailing /ws to avoid /ws/ws/...
resetEnv();
process.env.NEXT_PUBLIC_WS_URL = "wss://six-fingers-backend.onrender.com/ws";
assert.strictEqual(
  getWsBaseUrl(),
  "wss://six-fingers-backend.onrender.com",
  "Should strip trailing /ws from base WS URL"
);
console.log("✔ Test 6: Trailing /ws stripped from WS base URL");

// Test 7: getWsEndpoint creates correct room URL
resetEnv();
process.env.NEXT_PUBLIC_BACKEND_URL = "https://six-fingers-backend.onrender.com";
const roomWsUrl = getWsEndpoint("ROOM123", "p_abc", "tok_xyz", "player");
assert.strictEqual(
  roomWsUrl,
  "wss://six-fingers-backend.onrender.com/ws/ROOM123?player_id=p_abc&session_token=tok_xyz&role=player",
  "Room WebSocket URL must format cleanly with /ws/ prefix and query params"
);
console.log("✔ Test 7: getWsEndpoint formats room endpoint cleanly");

// Test 8: getPresenceWsEndpoint creates correct presence URL
resetEnv();
process.env.NEXT_PUBLIC_BACKEND_URL = "https://six-fingers-backend.onrender.com";
const presenceWsUrl = getPresenceWsEndpoint("my_token_123");
assert.strictEqual(
  presenceWsUrl,
  "wss://six-fingers-backend.onrender.com/ws/presence?token=my_token_123",
  "Presence WebSocket URL must target /ws/presence with token"
);
console.log("✔ Test 8: getPresenceWsEndpoint formats presence endpoint cleanly");

// Test 8b: getMatchmakingWsEndpoint creates correct matchmaking queue URL
resetEnv();
process.env.NEXT_PUBLIC_BACKEND_URL = "https://six-fingers-backend.onrender.com";
const mmWsUrl = getMatchmakingWsEndpoint("mm_token_456");
assert.strictEqual(
  mmWsUrl,
  "wss://six-fingers-backend.onrender.com/api/matchmaking/ws?token=mm_token_456",
  "Matchmaking WebSocket URL must target /api/matchmaking/ws with token"
);
console.log("✔ Test 8b: getMatchmakingWsEndpoint formats matchmaking queue endpoint cleanly");

// Test 9: Browser Vercel domain fallback
resetEnv();
global.window = {
  location: {
    hostname: "six-fingers.vercel.app",
    host: "six-fingers.vercel.app",
    protocol: "https:",
  },
};
assert.strictEqual(
  getApiBaseUrl(),
  DEFAULT_PRODUCTION_BACKEND,
  "Vercel domain must fallback to production Render backend"
);
assert.strictEqual(
  getWsBaseUrl(),
  "wss://six-fingers-backend.onrender.com",
  "Vercel domain must fallback to production Render wss://"
);
console.log("✔ Test 9: Vercel domain fallback defaults to Render backend");

// Test 10: Browser localhost fallback
resetEnv();
global.window = {
  location: {
    hostname: "localhost",
    host: "localhost:3000",
    protocol: "http:",
  },
};
assert.strictEqual(
  getApiBaseUrl(),
  "http://localhost:8000",
  "Localhost must fallback to http://localhost:8000"
);
assert.strictEqual(
  getWsBaseUrl(),
  "ws://localhost:8000",
  "Localhost must fallback to ws://localhost:8000"
);
console.log("✔ Test 10: Localhost browser fallback verified");

// Cleanup global
delete global.window;
resetEnv();

console.log("All 10 API & WebSocket configuration tests passed successfully!\n");
