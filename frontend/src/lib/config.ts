// Environment and deployment URL configuration helper

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
  }

  if (typeof window !== "undefined") {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;

    // Local development fallback
    if (hostname === "localhost" || hostname === "127.0.0.1") {
      return `${protocol}//${hostname}:8000`;
    }

    // In production with reverse proxy or same domain
    return `${protocol}//${window.location.host}`;
  }

  return "http://localhost:8000";
}

export function getWsEndpoint(roomCode: string, playerId: string, sessionToken: string, role: string): string {
  let baseWs = process.env.NEXT_PUBLIC_WS_URL;

  if (!baseWs) {
    if (typeof window !== "undefined") {
      const isHttps = window.location.protocol === "https:";
      const wsProtocol = isHttps ? "wss:" : "ws:";
      const hostname = window.location.hostname;

      if (hostname === "localhost" || hostname === "127.0.0.1") {
        baseWs = `${wsProtocol}//${hostname}:8000/ws`;
      } else {
        baseWs = `${wsProtocol}//${window.location.host}/ws`;
      }
    } else {
      baseWs = "ws://localhost:8000/ws";
    }
  }

  const cleanBase = baseWs.replace(/\/+$/, "");
  return `${cleanBase}/${roomCode}?player_id=${encodeURIComponent(playerId)}&session_token=${encodeURIComponent(sessionToken)}&role=${encodeURIComponent(role)}`;
}
