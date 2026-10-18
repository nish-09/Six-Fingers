import uuid
import time
import json
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, desc, update, and_

from ..database import AsyncSessionLocal, User, Profile, MatchInvitation, Notification
from ..auth.security import get_current_user
from ..rooms.manager import room_manager
from ..presence.manager import presence_manager

router = APIRouter(prefix="/api/invitations", tags=["invitations"])

class SendInvitationRequest(BaseModel):
    recipient_user_id: str
    room_code: str

class RespondInvitationRequest(BaseModel):
    invitation_id: str
    action: str # "accept" or "decline"

@router.post("/send")
async def send_match_invitation(
    req: SendInvitationRequest,
    current_user: User = Depends(get_current_user)
):
    room = room_manager.get_room(req.room_code)
    if not room:
        raise HTTPException(status_code=404, detail="Match room not found or expired")

    if req.recipient_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot invite yourself to a match")

    async with AsyncSessionLocal() as session:
        recipient = await session.get(User, req.recipient_user_id)
        if not recipient:
            raise HTTPException(status_code=404, detail="Recipient user not found")

        sender_profile = await session.get(Profile, current_user.id)
        sender_tag = sender_profile.gamer_tag if sender_profile else current_user.username
        sender_avatar = sender_profile.avatar_url if sender_profile else "avatar_1"

        now = time.time()
        inv_id = f"inv_{uuid.uuid4().hex[:12]}"
        inv = MatchInvitation(
            id=inv_id,
            sender_id=current_user.id,
            recipient_id=req.recipient_user_id,
            room_code=req.room_code.upper().strip(),
            status="PENDING",
            expires_at=now + 180.0, # 3 minutes expiration
            created_at=now
        )
        session.add(inv)

        notif_data = {
            "invitation_id": inv_id,
            "room_code": req.room_code.upper().strip(),
            "sender_id": current_user.id,
            "sender_tag": sender_tag,
            "sender_avatar": sender_avatar
        }

        notif = Notification(
            id=f"notif_{uuid.uuid4().hex[:12]}",
            user_id=req.recipient_user_id,
            type="MATCH_INVITE",
            title="Match Invitation",
            message=f"{sender_tag} invited you to join match room {req.room_code.upper()}!",
            data_json=json.dumps(notif_data),
            created_at=now
        )
        session.add(notif)
        await session.commit()

        # Real-time WebSocket dispatch if recipient is connected
        if req.recipient_user_id in presence_manager.users:
            rec_presence = presence_manager.users[req.recipient_user_id]
            invite_msg = {
                "type": "MATCH_INVITATION_RECEIVED",
                "invitation": notif_data
            }
            for ws in rec_presence.sessions.values():
                try:
                    await ws.send_json(invite_msg)
                except Exception:
                    pass

        return {"status": "success", "message": "Invitation sent successfully", "invitation_id": inv_id}

@router.post("/respond")
async def respond_to_invitation(
    req: RespondInvitationRequest,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        inv = await session.get(MatchInvitation, req.invitation_id)
        if not inv:
            raise HTTPException(status_code=404, detail="Invitation not found")

        if inv.recipient_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to respond to this invitation")

        if time.time() > inv.expires_at:
            inv.status = "EXPIRED"
            await session.commit()
            raise HTTPException(status_code=400, detail="Invitation has expired")

        if inv.status != "PENDING":
            raise HTTPException(status_code=400, detail=f"Invitation has already been {inv.status.lower()}")

        if req.action == "decline":
            inv.status = "DECLINED"
            await session.commit()
            return {"status": "success", "message": "Invitation declined"}

        if req.action == "accept":
            room = room_manager.get_room(inv.room_code)
            if not room:
                inv.status = "EXPIRED"
                await session.commit()
                raise HTTPException(status_code=404, detail="Match room is no longer active")

            # Join room
            prof = await session.get(Profile, current_user.id)
            disp_name = prof.display_name if prof else current_user.username
            user_id = f"u_{uuid.uuid4().hex[:8]}"
            session_tok = f"tok_{uuid.uuid4().hex}"

            ok, msg, meta = room.join_user(
                user_id=user_id,
                user_name=disp_name,
                session_token=session_tok,
                role="player",
                requested_team_id=room.state.team_b.id
            )

            if not ok:
                raise HTTPException(status_code=400, detail=msg)

            inv.status = "ACCEPTED"
            await session.commit()

            return {
                "status": "success",
                "room_code": room.room_code,
                "player_id": user_id,
                "session_token": session_tok,
                "role": meta.get("role", "player"),
                "team_id": meta.get("team_id")
            }

        raise HTTPException(status_code=400, detail="Invalid action. Use 'accept' or 'decline'.")

@router.get("/notifications")
async def get_my_notifications(
    limit: int = 20,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        query = (
            select(Notification)
            .where(Notification.user_id == current_user.id)
            .order_by(desc(Notification.created_at))
            .limit(limit)
        )
        res = await session.execute(query)
        notifs = res.scalars().all()

        unread_count = sum(1 for n in notifs if not n.is_read)

        return {
            "notifications": [
                {
                    "id": n.id,
                    "type": n.type,
                    "title": n.title,
                    "message": n.message,
                    "data": json.loads(n.data_json) if n.data_json else {},
                    "is_read": n.is_read,
                    "created_at": n.created_at
                }
                for n in notifs
            ],
            "unread_count": unread_count
        }

@router.post("/notifications/read-all")
async def mark_notifications_read(current_user: User = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        stmt = (
            update(Notification)
            .where(and_(Notification.user_id == current_user.id, Notification.is_read == False))
            .values(is_read=True)
        )
        await session.execute(stmt)
        await session.commit()
        return {"status": "success", "message": "All notifications marked as read"}
