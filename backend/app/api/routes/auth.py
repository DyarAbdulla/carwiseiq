"""
Authentication routes for login, register, logout, and user info
"""
from fastapi import APIRouter, HTTPException, Depends, Cookie, Response, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, EmailStr
from typing import Optional
import logging

from datetime import timedelta
from app.services.auth_service import (
    create_user,
    create_user_with_profile,
    authenticate_user,
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    revoke_refresh_token,
    revoke_all_refresh_tokens,
    decode_access_token,
    get_user_by_id,
    verify_email,
    resend_verification_email,
    create_password_reset_token,
    reset_password,
    update_user_profile,
    update_password,
    update_privacy_settings,
    get_user_data_export,
    delete_user_account,
    validate_password_strength,
    check_rate_limit,
)
from app.config import settings
from fastapi import Request

logger = logging.getLogger(__name__)

router = APIRouter()
security = HTTPBearer(auto_error=False)


# Request/Response models
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    confirm_password: str
    full_name: Optional[str] = None
    terms_accepted: bool = False


class LoginRequest(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: Optional[str] = None
    email_verified: bool = False
    supabase_user_id: Optional[str] = None  # UUID for Supabase users


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class VerifyEmailRequest(BaseModel):
    token: str


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str
    confirm_password: str


class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    location: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class PrivacySettingsRequest(BaseModel):
    privacy_show_phone: Optional[bool] = None
    privacy_show_email: Optional[bool] = None
    privacy_location_precision: Optional[str] = None  # 'exact' or 'city'
    privacy_allow_ai_training: Optional[bool] = None


class CookieConsentRequest(BaseModel):
    essential: bool = True
    analytics: bool = False
    marketing: bool = False


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    user: UserResponse


class MessageResponse(BaseModel):
    message: str


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    token: Optional[str] = Cookie(None)
) -> Optional[UserResponse]:
    """Get current user from token"""
    # Try to get token from Authorization header first
    auth_token = None
    token_source = None
    
    if credentials:
        auth_token = credentials.credentials
        token_source = "Authorization header"
    elif token:
        auth_token = token
        token_source = "Cookie"
    
    if not auth_token:
        logger.debug("No authentication token found")
        return None
    
    # Log token preview (first 20 chars only for security)
    token_preview = auth_token[:20] + "..." if len(auth_token) > 20 else auth_token
    logger.debug(f"Token found from {token_source}, length: {len(auth_token)}, preview: {token_preview}")
    
    # Decode token with detailed error handling (supports both REST and Supabase tokens)
    payload = decode_access_token(auth_token)
    if not payload:
        logger.warning(f"❌ Failed to decode token from {token_source}")
        logger.warning(f"   Token length: {len(auth_token)} characters")
        logger.warning(f"   Token preview: {auth_token[:30]}...")
        logger.warning("   Possible causes: 1) Token expired, 2) Invalid signature, 3) Wrong token type, 4) JWKS unavailable")
        return None

    user_id = payload.get("sub")
    if not user_id:
        logger.warning(f"Token payload missing 'sub' field. Payload keys: {list(payload.keys())}")
        return None

    try:
        # For Supabase tokens, user_id is a UUID string (e.g., '9fc731d7-8f73-4ec7-b312-f67abbcaU43d')
        # For REST API tokens, user_id is an integer
        # Check if it's a UUID format (contains hyphens) or numeric string
        is_uuid_format = isinstance(user_id, str) and '-' in user_id and len(user_id) > 30
        
        if is_uuid_format:
            # This is a Supabase token (UUID string)
            # For Supabase tokens, we can't look up in REST API database
            # Instead, create a UserResponse from the token payload
            logger.debug(f"Supabase token detected for user_id: {user_id}")
            
            # Extract email from token payload (Supabase includes it)
            email = payload.get('email') or payload.get('user_email') or payload.get('email_address') or f"supabase_user_{user_id[:8]}"
            full_name = payload.get('full_name') or payload.get('name') or payload.get('user_metadata', {}).get('full_name')
            
            # Check email verification status
            email_verified = payload.get('email_verified', False)
            if not email_verified:
                # Check if email_confirmed_at exists (Supabase uses this field)
                email_confirmed_at = payload.get('email_confirmed_at')
                email_verified = email_confirmed_at is not None
            
            # Return a UserResponse with Supabase user info
            # Note: This user won't exist in REST API database, but token is valid
            logger.info(f"Supabase authentication successful for user: {email} (UUID: {user_id[:8]}...)")
            return UserResponse(
                id=0,  # Placeholder - Supabase users don't have REST API IDs
                email=email,
                full_name=full_name,
                email_verified=email_verified,
                supabase_user_id=str(user_id)  # Store the UUID for favorites
            )
        else:
            # This is likely a REST API token (integer user_id)
            try:
                user_id_int = int(user_id) if isinstance(user_id, str) else user_id
                logger.debug(f"REST API token valid for user_id: {user_id_int}")
                
                user = get_user_by_id(user_id_int)
                if not user:
                    logger.warning(f"REST API user not found for ID: {user_id_int}")
                    return None

                logger.info(f"REST API authentication successful for user: {user.get('email')} (ID: {user_id_int})")
                return UserResponse(**user)
            except (ValueError, TypeError) as e:
                # Failed to convert to int - treat as Supabase UUID anyway
                logger.warning(f"Could not convert user_id '{user_id}' to int, treating as Supabase UUID: {e}")
                # Fall back to Supabase token handling
                email = payload.get('email') or payload.get('user_email') or payload.get('email_address') or f"supabase_user_{user_id[:8]}"
                full_name = payload.get('full_name') or payload.get('name') or payload.get('user_metadata', {}).get('full_name')
                email_verified = payload.get('email_verified', False) or (payload.get('email_confirmed_at') is not None)
                
                return UserResponse(
                    id=0,
                    email=email,
                    full_name=full_name,
                    email_verified=email_verified
                )
    except Exception as e:
        logger.error(f"Error processing user from token: {e}", exc_info=True)
        return None


@router.post("/register", response_model=AuthResponse)
async def register(request: RegisterRequest, req: Request, response: Response):
    """Register a new user"""
    # Validate passwords match
    if request.password != request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    # Validate password strength
    is_valid, error_msg = validate_password_strength(request.password)
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    # Validate terms acceptance
    if not request.terms_accepted:
        raise HTTPException(status_code=400, detail="You must accept the Terms of Service")

    # Get IP address for rate limiting
    ip_address = req.client.host if req.client else None

    # Check registration rate limit
    allowed, error_msg = check_rate_limit(request.email, ip_address)
    if not allowed:
        raise HTTPException(status_code=429, detail=error_msg)

    # Normalize email
    normalized_email = request.email.lower().strip()

    if not normalized_email:
        raise HTTPException(status_code=400, detail="Email cannot be empty")

    # Create user with profile
    user, error = create_user_with_profile(
        normalized_email,
        request.password,
        request.full_name,
        request.terms_accepted
    )
    if not user:
        error_msg = error or "Failed to create user"
        raise HTTPException(status_code=400, detail=error_msg)

    # Create access token (short expiry, e.g. 15 min) and refresh token (7 days, rotation)
    access_expire = timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user["id"])},
        expires_delta=access_expire
    )
    refresh_token = create_refresh_token(user["id"], ip_address=ip_address)
    secure_cookies = settings.is_production
    max_age_access = settings.JWT_ACCESS_EXPIRE_MINUTES * 60
    max_age_refresh = settings.JWT_REFRESH_EXPIRE_DAYS * 24 * 60 * 60

    # Set httpOnly cookies (secure=True in production for HTTPS)
    response.set_cookie(
        key="token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=secure_cookies,
        max_age=max_age_access,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=secure_cookies,
        max_age=max_age_refresh,
        path="/"
    )

    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse(
            id=user["id"],
            email=user["email"],
            full_name=user.get("full_name"),
            email_verified=user.get("email_verified", False)
        )
    )


@router.post("/login", response_model=AuthResponse)
async def login(request: LoginRequest, req: Request, response: Response):
    """Login and get access token"""
    ip_address = req.client.host if req.client else None
    
    user, error = authenticate_user(request.email, request.password, ip_address)
    if not user:
        raise HTTPException(status_code=401, detail=error or "Incorrect email or password")

    # Access token: always short expiry (e.g. 15 min). Refresh token: 7 days (rotation).
    access_expire = timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user["id"])},
        expires_delta=access_expire
    )
    refresh_token = create_refresh_token(user["id"], ip_address=ip_address)
    secure_cookies = settings.is_production
    max_age_access = settings.JWT_ACCESS_EXPIRE_MINUTES * 60
    max_age_refresh = settings.JWT_REFRESH_EXPIRE_DAYS * 24 * 60 * 60

    response.set_cookie(
        key="token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=secure_cookies,
        max_age=max_age_access,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite="lax",
        secure=secure_cookies,
        max_age=max_age_refresh,
        path="/"
    )

    user_data = get_user_by_id(user["id"])
    return AuthResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse(
            id=user_data["id"],
            email=user_data["email"],
            full_name=user_data.get("full_name"),
            email_verified=user_data.get("email_verified", False)
        )
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    response: Response,
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """Logout and clear tokens"""
    refresh_token = request.cookies.get("refresh_token")
    if refresh_token:
        revoke_refresh_token(refresh_token)
    secure = settings.is_production
    response.delete_cookie(key="token", httponly=True, samesite="lax", secure=secure, path="/")
    response.delete_cookie(key="refresh_token", httponly=True, samesite="lax", secure=secure, path="/")
    return MessageResponse(message="Logged out successfully")


@router.post("/logout-all", response_model=MessageResponse)
async def logout_all(
    response: Response,
    current_user: UserResponse = Depends(get_current_user)
):
    """Logout from all devices"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    revoke_all_refresh_tokens(current_user.id)
    secure = settings.is_production
    response.delete_cookie(key="token", httponly=True, samesite="lax", secure=secure, path="/")
    response.delete_cookie(key="refresh_token", httponly=True, samesite="lax", secure=secure, path="/")
    return MessageResponse(message="Logged out from all devices successfully")


@router.post("/refresh", response_model=AuthResponse)
async def refresh_token_endpoint(
    request: RefreshTokenRequest,
    response: Response,
    req: Request
):
    """Refresh access token using refresh token (rotation: old refresh token invalidated)."""
    user_id = verify_refresh_token(request.refresh_token, revoke_after_use=True)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    
    access_expire = timedelta(minutes=settings.JWT_ACCESS_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user_id)},
        expires_delta=access_expire
    )
    # Issue new refresh token (rotation)
    ip_address = req.client.host if req.client else None
    new_refresh_token = create_refresh_token(user_id, ip_address=ip_address)
    secure = settings.is_production
    max_age_access = settings.JWT_ACCESS_EXPIRE_MINUTES * 60
    max_age_refresh = settings.JWT_REFRESH_EXPIRE_DAYS * 24 * 60 * 60

    response.set_cookie(
        key="token",
        value=access_token,
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=max_age_access,
        path="/"
    )
    response.set_cookie(
        key="refresh_token",
        value=new_refresh_token,
        httponly=True,
        samesite="lax",
        secure=secure,
        max_age=max_age_refresh,
        path="/"
    )

    user_data = get_user_by_id(user_id)
    if not user_data:
        raise HTTPException(status_code=404, detail="User not found")

    return AuthResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=UserResponse(
            id=user_data["id"],
            email=user_data["email"],
            full_name=user_data.get("full_name"),
            email_verified=user_data.get("email_verified", False)
        )
    )


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email_endpoint(request: VerifyEmailRequest):
    """Verify email with token"""
    success, error = verify_email(request.token)
    if not success:
        raise HTTPException(status_code=400, detail=error or "Invalid verification token")
    return MessageResponse(message="Email verified successfully")


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification_endpoint(request: ResendVerificationRequest):
    """Resend verification email"""
    success, token = resend_verification_email(request.email)
    if not success:
        raise HTTPException(status_code=400, detail=token or "Failed to resend verification")
    
    # TODO: Send actual email with token
    logger.info(f"Verification token for {request.email}: {token}")
    
    return MessageResponse(message="Verification email sent")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password_endpoint(request: ForgotPasswordRequest):
    """Request password reset"""
    token, error = create_password_reset_token(request.email)
    if not token:
        # Don't reveal if email exists
        return MessageResponse(message="If the email exists, a reset link has been sent")
    
    # TODO: Send actual email with reset link
    logger.info(f"Password reset token for {request.email}: {token}")
    
    return MessageResponse(message="If the email exists, a reset link has been sent")


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password_endpoint(request: ResetPasswordRequest):
    """Reset password with token"""
    if request.new_password != request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    success, error = reset_password(request.token, request.new_password)
    if not success:
        raise HTTPException(status_code=400, detail=error or "Invalid or expired reset token")
    
    return MessageResponse(message="Password reset successfully")


@router.get("/me", response_model=UserResponse)
async def get_me(request: Request, current_user: Optional[UserResponse] = Depends(get_current_user)):
    """Get current user info"""
    if not current_user:
        # Log the request details for debugging
        auth_header = request.headers.get("Authorization")
        cookie_token = request.cookies.get("token")
        
        # Log token previews for debugging (first 30 chars)
        auth_preview = None
        if auth_header:
            if auth_header.startswith("Bearer "):
                token_part = auth_header.replace("Bearer ", "").strip()
                auth_preview = token_part[:30] + "..." if len(token_part) > 30 else token_part
            else:
                auth_preview = auth_header[:30] + "..." if len(auth_header) > 30 else auth_header
        
        cookie_preview = cookie_token[:30] + "..." if cookie_token and len(cookie_token) > 30 else cookie_token
        
        logger.warning(
            f"401 Unauthorized on /api/auth/me - "
            f"Auth header present: {bool(auth_header)}, "
            f"Auth header preview: {auth_preview}, "
            f"Cookie token present: {bool(cookie_token)}, "
            f"Cookie token preview: {cookie_preview}, "
            f"Client IP: {request.client.host if request.client else 'unknown'}"
        )
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Verify user still exists in database
    user_data = get_user_by_id(current_user.id)
    if not user_data:
        logger.error(f"User {current_user.id} authenticated but not found in database")
        raise HTTPException(status_code=404, detail="User not found")
    
    logger.info(f"Successfully retrieved user info for: {user_data.get('email')} (ID: {current_user.id})")
    return UserResponse(
        id=user_data["id"],
        email=user_data["email"],
        full_name=user_data.get("full_name"),
        email_verified=user_data.get("email_verified", False)
    )


@router.put("/profile", response_model=UserResponse)
async def update_profile_endpoint(
    request: UpdateProfileRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update user profile"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    updates = {}
    if request.full_name is not None:
        updates['full_name'] = request.full_name
    if request.phone is not None:
        updates['phone'] = request.phone
    if request.location is not None:
        updates['location'] = request.location
    
    success, error = update_user_profile(current_user.id, **updates)
    if not success:
        raise HTTPException(status_code=400, detail=error or "Failed to update profile")
    
    user_data = get_user_by_id(current_user.id)
    return UserResponse(
        id=user_data["id"],
        email=user_data["email"],
        full_name=user_data.get("full_name"),
        email_verified=user_data.get("email_verified", False)
    )


@router.put("/change-password", response_model=MessageResponse)
async def change_password_endpoint(
    request: ChangePasswordRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Change password"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    if request.new_password != request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    success, error = update_password(
        current_user.id,
        request.current_password,
        request.new_password
    )
    if not success:
        raise HTTPException(status_code=400, detail=error or "Failed to change password")
    
    return MessageResponse(message="Password changed successfully")


@router.put("/privacy-settings", response_model=MessageResponse)
async def update_privacy_settings_endpoint(
    request: PrivacySettingsRequest,
    current_user: UserResponse = Depends(get_current_user)
):
    """Update privacy settings"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    updates = {}
    if request.privacy_show_phone is not None:
        updates['privacy_show_phone'] = request.privacy_show_phone
    if request.privacy_show_email is not None:
        updates['privacy_show_email'] = request.privacy_show_email
    if request.privacy_location_precision is not None:
        if request.privacy_location_precision not in ['exact', 'city']:
            raise HTTPException(status_code=400, detail="Location precision must be 'exact' or 'city'")
        updates['privacy_location_precision'] = request.privacy_location_precision
    if request.privacy_allow_ai_training is not None:
        updates['privacy_allow_ai_training'] = request.privacy_allow_ai_training
    
    success, error = update_privacy_settings(current_user.id, **updates)
    if not success:
        raise HTTPException(status_code=400, detail=error or "Failed to update privacy settings")
    
    return MessageResponse(message="Privacy settings updated successfully")


@router.get("/export-data")
async def export_data_endpoint(
    current_user: UserResponse = Depends(get_current_user)
):
    """Export all user data (GDPR compliance)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    data = get_user_data_export(current_user.id)
    if not data:
        raise HTTPException(status_code=404, detail="User data not found")
    
    return data


@router.delete("/account", response_model=MessageResponse)
async def delete_account_endpoint(
    current_user: UserResponse = Depends(get_current_user),
    response: Response = None
):
    """Delete user account (GDPR compliance)"""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    success, error = delete_user_account(current_user.id)
    if not success:
        raise HTTPException(status_code=400, detail=error or "Failed to delete account")
    
    if response:
        secure = settings.is_production
        response.delete_cookie(key="token", httponly=True, samesite="lax", secure=secure, path="/")
        response.delete_cookie(key="refresh_token", httponly=True, samesite="lax", secure=secure, path="/")
    return MessageResponse(message="Account deleted successfully")


@router.post("/cookie-consent", response_model=MessageResponse)
async def cookie_consent_endpoint(
    request: CookieConsentRequest,
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """Save cookie consent preferences"""
    import json
    from app.services.auth_service import get_db
    
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    consent_data = json.dumps({
        "essential": request.essential,
        "analytics": request.analytics,
        "marketing": request.marketing
    })
    
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE users
        SET cookie_consent = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    """, (consent_data, current_user.id))
    conn.commit()
    conn.close()
    
    return MessageResponse(message="Cookie preferences saved")

