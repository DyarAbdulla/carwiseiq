"""
Messaging API routes for buyer-seller communication
"""
from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Optional, List
import logging
import os
import uuid

from app.services.messaging_service import (
    send_message,
    get_messages,
    mark_messages_as_read,
    get_conversations,
    block_user,
    unblock_user,
    report_message,
    delete_conversation,
    star_conversation,
    get_unread_count,
    set_typing_indicator,
    get_typing_indicator,
    get_or_create_conversation
)
from app.api.routes.auth import get_current_user, UserResponse
from app.services.marketplace_service import get_listing

logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer(auto_error=False)

# Image upload directory
BACKEND_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
UPLOAD_DIR = os.path.join(BACKEND_ROOT, "uploads", "messages")
os.makedirs(UPLOAD_DIR, exist_ok=True)


# Request/Response models
class SendMessageRequest(BaseModel):
    listing_id: int
    recipient_id: int
    content: str
    image_url: Optional[str] = None


class MessageResponse(BaseModel):
    id: int
    listing_id: int
    sender_id: int
    recipient_id: int
    content: str
    image_url: Optional[str] = None
    read: bool
    read_at: Optional[str] = None
    created_at: str
    sender_email: Optional[str] = None


class ConversationResponse(BaseModel):
    id: int
    listing_id: int
    other_user_id: int
    other_user_email: str
    last_message: Optional[str] = None
    last_message_time: Optional[str] = None
    unread_count: int
    is_starred: bool
    listing: dict


class TypingIndicatorRequest(BaseModel):
    conversation_id: int
    is_typing: bool


class MarkReadRequest(BaseModel):
    listing_id: int
    other_user_id: int


@router.post("/messages", response_model=dict)
async def send_message_endpoint(
    request: SendMessageRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Send a message"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        # Verify listing exists
        listing = get_listing(request.listing_id)
        if not listing:
            raise HTTPException(status_code=404, detail="Listing not found")

        # Verify recipient exists and is not the sender
        if request.recipient_id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot send message to yourself")

        message_id = send_message(
            listing_id=request.listing_id,
            sender_id=current_user.id,
            recipient_id=request.recipient_id,
            content=request.content,
            image_url=request.image_url
        )

        return {"message_id": message_id, "success": True, "message": "Message sent successfully"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error sending message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/messages/{message_id}/image")
async def upload_message_image(
    message_id: int,
    image: UploadFile = File(...),
    current_user: UserResponse = Depends(get_current_user)
):
    """Upload an image for a message"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        # Generate unique filename
        file_ext = os.path.splitext(image.filename)[1] or '.jpg'
        filename = f"msg_{message_id}_{uuid.uuid4()}{file_ext}"
        file_path = os.path.join(UPLOAD_DIR, filename)

        # Save file
        with open(file_path, "wb") as f:
            content = await image.read()
            f.write(content)

        # Return relative URL
        image_url = f"/uploads/messages/{filename}"

        return {"success": True, "image_url": image_url}
    except Exception as e:
        logger.error(f"Error uploading message image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/messages", response_model=dict)
async def get_messages_endpoint(
    listing_id: int = Query(...),
    other_user_id: int = Query(...),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: UserResponse = Depends(get_current_user)
):
    """Get messages between current user and another user for a listing"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        messages = get_messages(
            listing_id=listing_id,
            user_id=current_user.id,
            other_user_id=other_user_id,
            limit=limit,
            offset=offset
        )

        # Mark messages as read
        mark_messages_as_read(listing_id, current_user.id, other_user_id)

        return {"messages": messages, "total": len(messages)}
    except Exception as e:
        logger.error(f"Error getting messages: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/conversations", response_model=dict)
async def get_conversations_endpoint(
    current_user: UserResponse = Depends(get_current_user)
):
    """Get all conversations for current user"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        conversations = get_conversations(current_user.id)
        return {"conversations": conversations, "total": len(conversations)}
    except Exception as e:
        logger.error(f"Error getting conversations: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/messages/unread-count", response_model=dict)
async def get_unread_count_endpoint(
    current_user: UserResponse = Depends(get_current_user)
):
    """Get total unread message count"""
    if not current_user:
        return {"unread_count": 0}

    try:
        count = get_unread_count(current_user.id)
        return {"unread_count": count}
    except Exception as e:
        logger.error(f"Error getting unread count: {e}")
        return {"unread_count": 0}


@router.post("/messages/mark-read")
async def mark_messages_read_endpoint(
    request: MarkReadRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Mark messages as read"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        mark_messages_as_read(request.listing_id, current_user.id, request.other_user_id)
        return {"success": True, "message": "Messages marked as read"}
    except Exception as e:
        logger.error(f"Error marking messages as read: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversations/{conversation_id}/block")
async def block_user_endpoint(
    conversation_id: int,
    current_user: UserResponse = Depends(get_current_user)
):
    """Block a user in a conversation"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        # Get conversation to find other user
        conversations = get_conversations(current_user.id)
        conversation = next((c for c in conversations if c['id'] == conversation_id), None)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        blocked_user_id = conversation['other_user_id']
        success = block_user(current_user.id, blocked_user_id)
        if success:
            return {"success": True, "message": "User blocked successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to block user")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error blocking user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversations/{conversation_id}/unblock")
async def unblock_user_endpoint(
    conversation_id: int,
    current_user: UserResponse = Depends(get_current_user)
):
    """Unblock a user in a conversation"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        conversations = get_conversations(current_user.id)
        conversation = next((c for c in conversations if c['id'] == conversation_id), None)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")

        blocked_user_id = conversation['other_user_id']
        success = unblock_user(current_user.id, blocked_user_id)
        if success:
            return {"success": True, "message": "User unblocked successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to unblock user")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error unblocking user: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/messages/{message_id}/report")
async def report_message_endpoint(
    message_id: int,
    reason: Optional[str] = None,
    current_user: UserResponse = Depends(get_current_user)
):
    """Report an inappropriate message"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        success = report_message(message_id, current_user.id, reason)
        if success:
            return {"success": True, "message": "Message reported successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to report message")
    except Exception as e:
        logger.error(f"Error reporting message: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/conversations/{conversation_id}")
async def delete_conversation_endpoint(
    conversation_id: int,
    current_user: UserResponse = Depends(get_current_user)
):
    """Delete a conversation (soft delete)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        success = delete_conversation(current_user.id, conversation_id)
        if success:
            return {"success": True, "message": "Conversation deleted successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to delete conversation")
    except Exception as e:
        logger.error(f"Error deleting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/conversations/{conversation_id}/star")
async def star_conversation_endpoint(
    conversation_id: int,
    starred: bool = True,
    current_user: UserResponse = Depends(get_current_user)
):
    """Star/unstar a conversation"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        success = star_conversation(current_user.id, conversation_id, starred)
        if success:
            return {"success": True, "message": f"Conversation {'starred' if starred else 'unstarred'} successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to star conversation")
    except Exception as e:
        logger.error(f"Error starring conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/typing-indicator")
async def set_typing_indicator_endpoint(
    request: TypingIndicatorRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Set typing indicator"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        set_typing_indicator(request.conversation_id, current_user.id, request.is_typing)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error setting typing indicator: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/typing-indicator/{conversation_id}")
async def get_typing_indicator_endpoint(
    conversation_id: int,
    current_user: UserResponse = Depends(get_current_user)
):
    """Get typing indicator"""
    if not current_user:
        return {"is_typing": False}

    try:
        is_typing = get_typing_indicator(conversation_id, current_user.id)
        return {"is_typing": is_typing}
    except Exception as e:
        logger.error(f"Error getting typing indicator: {e}")
        return {"is_typing": False}
