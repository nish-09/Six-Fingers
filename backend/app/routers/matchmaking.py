import asyncio
import time
from typing import Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, status
from ..matchmaking.queue import matchmaking_coordinator
from ..auth.security import get_current_user, decode_access_token
from ..database import User, Profile, AsyncSessionLocal

router = APIRouter(prefix="/api/matchmaking", tags=["matchmaking"])

@router.post("/queue")
async def join_queue_rest(current_user: User = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        profile = await session.get(Profile, current_user.id)
        disp_name = profile.display_name if profile else current_user.username
        g_tag = profile.gamer_tag if profile else f"{current_user.username}#001"
        avatar = profile.avatar_url if profile else "avatar_1"

    ticket = await matchmaking_coordinator.enqueue(
        user_id=current_user.id,
        display_name=disp_name,
        gamer_tag=g_tag,
        avatar_url=avatar
    )

    if ticket.future.done():
        result = ticket.future.result()
        return {"status": "MATCH_FOUND", "match": result}

    # Wait up to 25 seconds for a match
    try:
        match_result = await asyncio.wait_for(asyncio.shield(ticket.future), timeout=25.0)
        return {"status": "MATCH_FOUND", "match": match_result}
    except asyncio.TimeoutError:
        return {"status": "QUEUED", "ticket_id": ticket.ticket_id, "queue_size": matchmaking_coordinator.get_queue_size()}

@router.post("/cancel")
async def cancel_queue_rest(current_user: User = Depends(get_current_user)):
    cancelled = await matchmaking_coordinator.dequeue(current_user.id)
    return {"status": "success", "cancelled": cancelled}

@router.get("/status")
async def get_matchmaking_status():
    return {
        "active_queue_size": matchmaking_coordinator.get_queue_size()
    }

@router.websocket("/ws")
async def matchmaking_ws(
    websocket: WebSocket,
    token: str = Query(...)
):
    await websocket.accept()

    payload = decode_access_token(token)
    if not payload:
        await websocket.send_json({"type": "ERROR", "message": "Authentication required"})
        await websocket.close()
        return

    user_id = payload.get("sub")
    async with AsyncSessionLocal() as session:
        user = await session.get(User, user_id)
        if not user or not user.is_active:
            await websocket.send_json({"type": "ERROR", "message": "User not authorized"})
            await websocket.close()
            return

        profile = await session.get(Profile, user_id)
        disp_name = profile.display_name if profile else user.username
        g_tag = profile.gamer_tag if profile else f"{user.username}#001"
        avatar = profile.avatar_url if profile else "avatar_1"

    ticket = await matchmaking_coordinator.enqueue(
        user_id=user_id,
        display_name=disp_name,
        gamer_tag=g_tag,
        avatar_url=avatar
    )

    # If match was found instantly
    if ticket.future.done():
        res = ticket.future.result()
        await websocket.send_json({
            "type": "MATCH_FOUND",
            "match": res
        })
        await websocket.close()
        return

    # Notify searching
    await websocket.send_json({
        "type": "SEARCHING",
        "ticket_id": ticket.ticket_id,
        "queue_size": matchmaking_coordinator.get_queue_size()
    })

    # Task to wait on future while handling incoming cancel messages
    async def wait_for_match():
        try:
            match_res = await ticket.future
            await websocket.send_json({
                "type": "MATCH_FOUND",
                "match": match_res
            })
            await websocket.close()
        except asyncio.CancelledError:
            pass

    match_task = asyncio.create_task(wait_for_match())

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            if msg_type == "CANCEL":
                await matchmaking_coordinator.dequeue(user_id)
                match_task.cancel()
                await websocket.send_json({"type": "SEARCH_CANCELLED"})
                await websocket.close()
                return
            elif msg_type == "PING":
                await websocket.send_json({"type": "PONG"})
    except WebSocketDisconnect:
        await matchmaking_coordinator.dequeue(user_id)
        match_task.cancel()
    except Exception:
        await matchmaking_coordinator.dequeue(user_id)
        match_task.cancel()
