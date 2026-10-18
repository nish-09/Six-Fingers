import uuid
import time
from typing import Dict, Any
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, Depends, HTTPException
from ..presence.manager import presence_manager, PresenceState
from ..auth.security import decode_access_token, get_current_user
from ..database import User

router = APIRouter(tags=["presence"])

@router.websocket("/ws/presence")
async def presence_websocket(
    websocket: WebSocket,
    token: str = Query(...)
):
    await websocket.accept()

    payload = decode_access_token(token)
    if not payload:
        await websocket.send_json({"type": "ERROR", "message": "Invalid authentication token"})
        await websocket.close()
        return

    user_id = payload.get("sub")
    session_id = f"sess_{uuid.uuid4().hex[:8]}"

    await presence_manager.connect_user(user_id, session_id, websocket)

    # Send initial friends presence
    friends_presences = await presence_manager.get_friends_presence(user_id)
    await websocket.send_json({
        "type": "INITIAL_FRIENDS_PRESENCE",
        "friends": friends_presences
    })

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "PING":
                await websocket.send_json({"type": "PONG", "timestamp": time.time()})
            elif msg_type == "HEARTBEAT":
                p = presence_manager.get_or_create(user_id)
                p.last_seen = time.time()
                await websocket.send_json({"type": "HEARTBEAT_ACK"})
    except WebSocketDisconnect:
        await presence_manager.disconnect_user(user_id, session_id)
    except Exception:
        await presence_manager.disconnect_user(user_id, session_id)

@router.get("/api/presence/friends")
async def get_my_friends_presence(current_user: User = Depends(get_current_user)):
    friends_presences = await presence_manager.get_friends_presence(current_user.id)
    return {"friends_presence": friends_presences}
