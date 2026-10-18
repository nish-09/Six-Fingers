import uuid
import time
import json
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy import select, or_, and_, delete

from ..database import AsyncSessionLocal, User, Profile, Friendship, Notification
from ..auth.security import get_current_user
from ..presence.manager import presence_manager, PresenceState

router = APIRouter(prefix="/api/friends", tags=["friends"])

class FriendRequestAction(BaseModel):
    request_id: str
    action: str # "accept" or "decline"

class SendFriendRequest(BaseModel):
    target_user_id: Optional[str] = None
    target_gamer_tag: Optional[str] = None

class RemoveFriendRequest(BaseModel):
    friend_id: str

@router.get("/search")
async def search_players(
    q: str = Query(..., min_length=1, max_length=50),
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user)
):
    query_str = f"%{q.strip().lower()}%"
    async with AsyncSessionLocal() as session:
        # Search in users and profiles, exclude current user
        stmt = (
            select(User, Profile)
            .join(Profile, User.id == Profile.user_id)
            .where(
                and_(
                    User.id != current_user.id,
                    or_(
                        User.username.ilike(query_str),
                        Profile.gamer_tag.ilike(query_str),
                        Profile.display_name.ilike(query_str)
                    )
                )
            )
            .limit(limit)
        )
        res = await session.execute(stmt)
        rows = res.all()

        results = []
        for user, profile in rows:
            # Check friendship status with current user
            f_stmt = select(Friendship).where(
                or_(
                    and_(Friendship.requester_id == current_user.id, Friendship.addressee_id == user.id),
                    and_(Friendship.requester_id == user.id, Friendship.addressee_id == current_user.id)
                )
            )
            f_res = await session.execute(f_stmt)
            rel = f_res.scalars().first()

            status_str = "NONE"
            request_id = None
            if rel:
                request_id = rel.id
                if rel.status == "ACCEPTED":
                    status_str = "FRIENDS"
                elif rel.status == "PENDING":
                    status_str = "PENDING_SENT" if rel.requester_id == current_user.id else "PENDING_RECEIVED"
                elif rel.status == "BLOCKED":
                    status_str = "BLOCKED"

            p_state = presence_manager.users.get(user.id)
            is_online = p_state.state != PresenceState.OFFLINE if p_state else False
            activity = p_state.activity if p_state else "Offline"

            win_rate = round((profile.matches_won / profile.total_matches * 100), 1) if profile.total_matches > 0 else 0.0

            results.append({
                "user_id": user.id,
                "username": user.username,
                "display_name": profile.display_name,
                "gamer_tag": profile.gamer_tag,
                "avatar_url": profile.avatar_url,
                "favorite_team": profile.favorite_team,
                "batting_style": profile.batting_style,
                "win_rate": win_rate,
                "total_matches": profile.total_matches,
                "is_online": is_online,
                "activity": activity,
                "relationship": status_str,
                "request_id": request_id
            })

        return {"results": results, "query": q}

@router.post("/request")
async def send_friend_request(
    req: SendFriendRequest,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        target_id = req.target_user_id
        if not target_id and req.target_gamer_tag:
            p_stmt = select(Profile).where(Profile.gamer_tag.ilike(req.target_gamer_tag.strip()))
            p_res = await session.execute(p_stmt)
            prof = p_res.scalars().first()
            if prof:
                target_id = prof.user_id

        if not target_id:
            raise HTTPException(status_code=404, detail="Player not found")

        if target_id == current_user.id:
            raise HTTPException(status_code=400, detail="You cannot send a friend request to yourself")

        target_user = await session.get(User, target_id)
        if not target_user:
            raise HTTPException(status_code=404, detail="Player not found")

        # Check existing relationship
        stmt = select(Friendship).where(
            or_(
                and_(Friendship.requester_id == current_user.id, Friendship.addressee_id == target_id),
                and_(Friendship.requester_id == target_id, Friendship.addressee_id == current_user.id)
            )
        )
        res = await session.execute(stmt)
        existing = res.scalars().first()

        if existing:
            if existing.status == "ACCEPTED":
                raise HTTPException(status_code=400, detail="You are already friends with this player")
            if existing.status == "PENDING":
                if existing.requester_id == current_user.id:
                    raise HTTPException(status_code=400, detail="Friend request is already pending")
                else:
                    # Mutual request! Automatically accept!
                    existing.status = "ACCEPTED"
                    existing.updated_at = time.time()
                    await session.commit()
                    await presence_manager.broadcast_to_friends(current_user.id)
                    await presence_manager.broadcast_to_friends(target_id)
                    return {"status": "success", "message": "Mutual friend request detected! You are now friends."}
            if existing.status == "BLOCKED":
                raise HTTPException(status_code=403, detail="Unable to send friend request")

        req_id = f"freq_{uuid.uuid4().hex[:12]}"
        now = time.time()
        new_friendship = Friendship(
            id=req_id,
            requester_id=current_user.id,
            addressee_id=target_id,
            status="PENDING",
            created_at=now,
            updated_at=now
        )
        session.add(new_friendship)

        # Create in-app notification for recipient
        my_profile = await session.get(Profile, current_user.id)
        sender_tag = my_profile.gamer_tag if my_profile else current_user.username
        notif = Notification(
            id=f"notif_{uuid.uuid4().hex[:12]}",
            user_id=target_id,
            type="FRIEND_REQUEST",
            title="New Friend Request",
            message=f"{sender_tag} sent you a friend request!",
            data_json=json.dumps({"request_id": req_id, "sender_id": current_user.id, "sender_tag": sender_tag}),
            created_at=now
        )
        session.add(notif)
        await session.commit()

        return {"status": "success", "message": "Friend request sent successfully", "request_id": req_id}

@router.get("/requests/incoming")
async def get_incoming_requests(current_user: User = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        stmt = (
            select(Friendship, User, Profile)
            .join(User, Friendship.requester_id == User.id)
            .join(Profile, User.id == Profile.user_id)
            .where(
                and_(Friendship.addressee_id == current_user.id, Friendship.status == "PENDING")
            )
            .order_by(Friendship.created_at.desc())
        )
        res = await session.execute(stmt)
        rows = res.all()

        requests = []
        for friendship, user, profile in rows:
            requests.append({
                "request_id": friendship.id,
                "sender_id": user.id,
                "sender_username": user.username,
                "sender_name": profile.display_name,
                "sender_gamer_tag": profile.gamer_tag,
                "sender_avatar": profile.avatar_url,
                "created_at": friendship.created_at
            })
        return {"incoming_requests": requests}

@router.get("/requests/outgoing")
async def get_outgoing_requests(current_user: User = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        stmt = (
            select(Friendship, User, Profile)
            .join(User, Friendship.addressee_id == User.id)
            .join(Profile, User.id == Profile.user_id)
            .where(
                and_(Friendship.requester_id == current_user.id, Friendship.status == "PENDING")
            )
            .order_by(Friendship.created_at.desc())
        )
        res = await session.execute(stmt)
        rows = res.all()

        requests = []
        for friendship, user, profile in rows:
            requests.append({
                "request_id": friendship.id,
                "recipient_id": user.id,
                "recipient_name": profile.display_name,
                "recipient_gamer_tag": profile.gamer_tag,
                "recipient_avatar": profile.avatar_url,
                "created_at": friendship.created_at
            })
        return {"outgoing_requests": requests}

@router.post("/respond")
async def respond_to_friend_request(
    req: FriendRequestAction,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        friendship = await session.get(Friendship, req.request_id)
        if not friendship:
            raise HTTPException(status_code=404, detail="Friend request not found")

        if friendship.addressee_id != current_user.id:
            raise HTTPException(status_code=403, detail="You are not authorized to respond to this request")

        if friendship.status != "PENDING":
            raise HTTPException(status_code=400, detail=f"Request is already {friendship.status.lower()}")

        now = time.time()
        if req.action == "accept":
            friendship.status = "ACCEPTED"
            friendship.updated_at = now

            # Notification for requester
            my_prof = await session.get(Profile, current_user.id)
            my_tag = my_prof.gamer_tag if my_prof else current_user.username
            notif = Notification(
                id=f"notif_{uuid.uuid4().hex[:12]}",
                user_id=friendship.requester_id,
                type="FRIEND_ACCEPTED",
                title="Friend Request Accepted",
                message=f"{my_tag} accepted your friend request!",
                data_json=json.dumps({"friend_id": current_user.id, "friend_tag": my_tag}),
                created_at=now
            )
            session.add(notif)
            await session.commit()

            # Broadcast presence to both friends
            await presence_manager.broadcast_to_friends(current_user.id)
            await presence_manager.broadcast_to_friends(friendship.requester_id)

            return {"status": "success", "message": "Friend request accepted"}
        elif req.action == "decline":
            friendship.status = "DECLINED"
            friendship.updated_at = now
            await session.commit()
            return {"status": "success", "message": "Friend request declined"}
        else:
            raise HTTPException(status_code=400, detail="Invalid action. Use 'accept' or 'decline'.")

@router.post("/cancel")
async def cancel_friend_request(
    request_id: str = Query(...),
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        friendship = await session.get(Friendship, request_id)
        if not friendship:
            raise HTTPException(status_code=404, detail="Request not found")
        if friendship.requester_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to cancel this request")
        await session.delete(friendship)
        await session.commit()
        return {"status": "success", "message": "Friend request cancelled"}

@router.post("/remove")
async def remove_friend(
    req: RemoveFriendRequest,
    current_user: User = Depends(get_current_user)
):
    async with AsyncSessionLocal() as session:
        stmt = select(Friendship).where(
            and_(
                Friendship.status == "ACCEPTED",
                or_(
                    and_(Friendship.requester_id == current_user.id, Friendship.addressee_id == req.friend_id),
                    and_(Friendship.requester_id == req.friend_id, Friendship.addressee_id == current_user.id)
                )
            )
        )
        res = await session.execute(stmt)
        friendship = res.scalars().first()
        if not friendship:
            raise HTTPException(status_code=404, detail="Friend relationship not found")

        await session.delete(friendship)
        await session.commit()

        await presence_manager.broadcast_to_friends(current_user.id)
        await presence_manager.broadcast_to_friends(req.friend_id)

        return {"status": "success", "message": "Friend removed successfully"}

@router.get("/list")
async def get_friends_list(current_user: User = Depends(get_current_user)):
    async with AsyncSessionLocal() as session:
        stmt = select(Friendship).where(
            and_(
                Friendship.status == "ACCEPTED",
                or_(Friendship.requester_id == current_user.id, Friendship.addressee_id == current_user.id)
            )
        )
        res = await session.execute(stmt)
        friendships = res.scalars().all()

        friend_ids = [
            f.addressee_id if f.requester_id == current_user.id else f.requester_id
            for f in friendships
        ]

        if not friend_ids:
            return {"friends": []}

        p_stmt = (
            select(User, Profile)
            .join(Profile, User.id == Profile.user_id)
            .where(User.id.in_(friend_ids))
        )
        p_res = await session.execute(p_stmt)
        rows = p_res.all()

        friends = []
        for user, profile in rows:
            p_state = presence_manager.users.get(user.id)
            is_online = p_state.state != PresenceState.OFFLINE if p_state else False
            status_state = p_state.state if p_state else PresenceState.OFFLINE
            activity = p_state.activity if p_state else "Offline"
            room_code = p_state.room_code if p_state else None

            win_rate = round((profile.matches_won / profile.total_matches * 100), 1) if profile.total_matches > 0 else 0.0

            friends.append({
                "user_id": user.id,
                "username": user.username,
                "display_name": profile.display_name,
                "gamer_tag": profile.gamer_tag,
                "avatar_url": profile.avatar_url,
                "bio": profile.bio,
                "favorite_team": profile.favorite_team,
                "batting_style": profile.batting_style,
                "total_matches": profile.total_matches,
                "matches_won": profile.matches_won,
                "win_rate": win_rate,
                "current_streak": profile.current_streak,
                "presence": {
                    "state": status_state,
                    "activity": activity,
                    "is_online": is_online,
                    "room_code": room_code,
                    "last_seen": p_state.last_seen if p_state else 0
                }
            })

        # Sort: online first, then by display name
        friends.sort(key=lambda x: (not x["presence"]["is_online"], x["display_name"].lower()))
        return {"friends": friends}
