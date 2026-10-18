// Environment and deployment URL configuration helper

export const DEFAULT_PRODUCTION_BACKEND = "https://six-fingers-backend.onrender.com";

/**
 * Returns the normalized backend HTTP/HTTPS base URL.
 *
 * Precedence:
 * 1. process.env.NEXT_PUBLIC_BACKEND_URL (primary - documented in .env.example)
 * 2. process.env.NEXT_PUBLIC_API_URL (backward-compatible alias)
 * 3. In browser on localhost / 127.0.0.1 -> http://localhost:8000
 * 4. In browser on six-fingers.vercel.app -> DEFAULT_PRODUCTION_BACKEND (safe fallback)
 * 5. Default local/SSR fallback -> http://localhost:8000
 *
 * Automatically sanitizes:
 * - Trailing slashes (e.g., https://host.com/ -> https://host.com)
 * - Trailing "/api" (e.g., https://host.com/api -> https://host.com) to prevent duplicate "/api/api/..." prefixes
 */
export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL;
  if (envUrl && envUrl.trim()) {
    let clean = envUrl.trim().replace(/\/+$/, "");
    if (clean.endsWith("/api")) {
      clean = clean.slice(0, -4).replace(/\/+$/, "");
    }
    return clean;
  }

  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol || "http:";

    // Local development fallback
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:8000`;
    }

    // Default for six-fingers.vercel.app or production deployments when env variable is missing
    if (hostname.includes("six-fingers.vercel.app") || hostname.includes("sixfingers")) {
      return DEFAULT_PRODUCTION_BACKEND;
    }

    // In other environments with custom reverse proxies
    return `${protocol}//${window.location.host}`;
  }

  return "http://localhost:8000";
}

/**
 * Returns the base WebSocket URL (ws:// or wss://) without trailing slashes or /ws suffix.
 */
export function getWsBaseUrl(): string {
  const envWs = process.env.NEXT_PUBLIC_WS_URL;
  if (envWs && envWs.trim()) {
    let clean = envWs.trim().replace(/\/+$/, "");
    if (clean.startsWith("https://")) {
      clean = `wss://${clean.slice(8)}`;
    } else if (clean.startsWith("http://")) {
      clean = `ws://${clean.slice(7)}`;
    } else if (!clean.startsWith("ws://") && !clean.startsWith("wss://")) {
      clean = `wss://${clean}`;
    }
    // Strip trailing /ws if present so callers can reliably append specific ws routes
    if (clean.endsWith("/ws")) {
      clean = clean.slice(0, -3).replace(/\/+$/, "");
    }
    return clean;
  }

  // Derive from API base URL (https: -> wss:, http: -> ws:)
  const apiBase = getApiBaseUrl();
  let wsBase = apiBase;
  if (wsBase.startsWith("https://")) {
    wsBase = `wss://${wsBase.slice(8)}`;
  } else if (wsBase.startsWith("http://")) {
    wsBase = `ws://${wsBase.slice(7)}`;
  } else if (!wsBase.startsWith("ws://") && !wsBase.startsWith("wss://")) {
    wsBase = `ws://${wsBase}`;
  }

  if (wsBase.endsWith("/ws")) {
    wsBase = wsBase.slice(0, -3).replace(/\/+$/, "");
  }

  return wsBase;
}

/**
 * Constructs the room match WebSocket endpoint: {wsBase}/ws/{roomCode}?...
 */
export function getWsEndpoint(
  roomCode: string,
  playerId: string,
  sessionToken: string,
  role: string
): string {
  const baseWs = getWsBaseUrl();
  return `${baseWs}/ws/${encodeURIComponent(roomCode)}?player_id=${encodeURIComponent(playerId)}&session_token=${encodeURIComponent(sessionToken)}&role=${encodeURIComponent(role)}`;
}

/**
 * Constructs the user presence & notification WebSocket endpoint: {wsBase}/ws/presence?token=...
 */
export function getPresenceWsEndpoint(token: string): string {
  const baseWs = getWsBaseUrl();
  return `${baseWs}/ws/presence?token=${encodeURIComponent(token)}`;
}

/**
 * Constructs the matchmaking queue WebSocket endpoint: {wsBase}/api/matchmaking/ws?token=...
 */
export function getMatchmakingWsEndpoint(token: string): string {
  const baseWs = getWsBaseUrl();
  return `${baseWs}/api/matchmaking/ws?token=${encodeURIComponent(token)}`;
}
