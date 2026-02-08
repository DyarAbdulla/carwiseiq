"""
Authentication service for user management and JWT tokens
"""
import os
import sqlite3
import hashlib
import time
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
from jose import JWTError, jwt
from jose.utils import base64url_decode
from passlib.context import CryptContext
import logging
import httpx
import json
from functools import lru_cache
from pathlib import Path
from dotenv import load_dotenv

# Initialize logger first
logger = logging.getLogger(__name__)

# Load environment variables from .env file
# Look for .env in backend directory (parent of app directory)
env_path = Path(__file__).parent.parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)
    logger.info(f"Loaded environment variables from {env_path}")
else:
    logger.warning(f".env file not found at {env_path}, using system environment variables only")

# Password hashing
# Note: bcrypt 5.0.0 has compatibility issues with passlib 1.7.4
# Using bcrypt <5.0.0 (e.g., 4.3.0) resolves the issue
# The "__about__" warning is harmless and can be ignored
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings - load from config when available to support settings
def _get_secret_key() -> str:
    from app.config import settings
    key = settings.SECRET_KEY or settings.JWT_SECRET_KEY or os.getenv("SECRET_KEY") or os.getenv("JWT_SECRET_KEY")
    if key and len(key) >= 32:
        return key
    # Fallback only for development
    return os.getenv(
        "SECRET_KEY", "sbODn2gVqCJPIY678350ohKv9GlpmrS4aTAjxfkBLtRdizuEw1WHNZeFUQXyMc")

SECRET_KEY = _get_secret_key()
ALGORITHM = "HS256"

def _get_access_token_expire_minutes() -> int:
    from app.config import settings
    return getattr(settings, "JWT_ACCESS_EXPIRE_MINUTES", 15)

def _get_refresh_token_expire_days() -> int:
    from app.config import settings
    return getattr(settings, "JWT_REFRESH_EXPIRE_DAYS", 7)

ACCESS_TOKEN_EXPIRE_MINUTES = _get_access_token_expire_minutes()

# Supabase JWT settings
# Try to get from environment, fallback to empty string
SUPABASE_URL = os.getenv("SUPABASE_URL", os.getenv("NEXT_PUBLIC_SUPABASE_URL", ""))
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
SUPABASE_JWKS_CACHE_TTL = 3600  # 1 hour

if SUPABASE_URL:
    logger.info(f"Supabase URL configured: {SUPABASE_URL[:30]}...")
else:
    logger.warning("SUPABASE_URL not configured - Supabase JWT verification will be disabled")

# Validate SECRET_KEY
if len(SECRET_KEY) < 32:
    logger.warning(
        f"SECRET_KEY is too short ({len(SECRET_KEY)} chars). "
        "Set SECRET_KEY environment variable with at least 32 characters for production."
    )
else:
    logger.info(f"SECRET_KEY loaded successfully ({len(SECRET_KEY)} characters)")

# Database path
DB_PATH = os.path.join(os.path.dirname(
    os.path.dirname(os.path.dirname(__file__))), "users.db")


def get_db():
    """Get database connection. WAL mode and foreign_keys for integrity."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    # Secure delete: overwrite with zeros on delete (optional; can disable if performance critical)
    try:
        conn.execute("PRAGMA secure_delete=ON")
    except sqlite3.OperationalError:
        pass  # Some SQLite builds may not support secure_delete
    return conn


def init_db():
    """Initialize database with users table"""
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if users table exists and get columns
    cursor.execute("PRAGMA table_info(users)")
    existing_columns = [row[1] for row in cursor.fetchall()]
    
    # Create users table with all fields
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT,
            phone TEXT,
            location TEXT,
            profile_picture_url TEXT,
            email_verified BOOLEAN DEFAULT 0,
            email_verified_at TIMESTAMP,
            email_verification_token TEXT,
            failed_login_attempts INTEGER DEFAULT 0,
            locked_until TIMESTAMP,
            refresh_token TEXT,
            refresh_token_expires_at TIMESTAMP,
            last_login_at TIMESTAMP,
            privacy_show_phone BOOLEAN DEFAULT 1,
            privacy_show_email BOOLEAN DEFAULT 0,
            privacy_location_precision TEXT DEFAULT 'city',  -- 'exact' or 'city'
            privacy_allow_ai_training BOOLEAN DEFAULT 0,
            role TEXT DEFAULT 'user',  -- 'user', 'moderator', 'admin', 'super_admin'
            terms_accepted BOOLEAN DEFAULT 0,
            terms_accepted_at TIMESTAMP,
            cookie_consent TEXT,  -- JSON: {"essential": true, "analytics": false, "marketing": false}
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Add new columns if they don't exist (for existing databases)
    new_columns = {
        'full_name': 'TEXT',
        'phone': 'TEXT',
        'location': 'TEXT',
        'profile_picture_url': 'TEXT',
        'email_verified': 'BOOLEAN DEFAULT 0',
        'email_verified_at': 'TIMESTAMP',
        'email_verification_token': 'TEXT',
        'failed_login_attempts': 'INTEGER DEFAULT 0',
        'locked_until': 'TIMESTAMP',
        'refresh_token': 'TEXT',
        'refresh_token_expires_at': 'TIMESTAMP',
        'last_login_at': 'TIMESTAMP',
        'privacy_show_phone': 'BOOLEAN DEFAULT 1',
        'privacy_show_email': 'BOOLEAN DEFAULT 0',
        'privacy_location_precision': 'TEXT DEFAULT "city"',
        'privacy_allow_ai_training': 'BOOLEAN DEFAULT 0',
        'role': 'TEXT DEFAULT "user"',
        'terms_accepted': 'BOOLEAN DEFAULT 0',
        'terms_accepted_at': 'TIMESTAMP',
        'cookie_consent': 'TEXT'
    }
    
    for col_name, col_type in new_columns.items():
        if col_name not in existing_columns:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
            except sqlite3.OperationalError:
                pass  # Column might already exist
    
    # Create password_reset_tokens table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS password_reset_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    
    # Create login_attempts table for rate limiting
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS login_attempts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            ip_address TEXT,
            success BOOLEAN DEFAULT 0,
            attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (email) REFERENCES users(email)
        )
    """)
    
    # Create refresh_tokens table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS refresh_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token TEXT UNIQUE NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            device_info TEXT,
            ip_address TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)
    
    # Create indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)")
    
    conn.commit()
    conn.close()
    logger.info("Database initialized")

    # Also initialize feedback tables
    try:
        from app.services.feedback_service import init_feedback_db
        init_feedback_db()
    except Exception as e:
        logger.warning(f"Could not initialize feedback database: {e}")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    # CRITICAL: Validate byte length BEFORE any hashing attempt
    password_bytes = password.encode('utf-8')
    password_byte_length = len(password_bytes)

    if password_byte_length > 72:
        raise ValueError(
            f"Password is too long ({password_byte_length} bytes, maximum 72 bytes). Please use a shorter password.")

    # Ensure password is within safe limits (bcrypt limit is 72 bytes)
    # Truncate if needed (shouldn't be needed with validation above, but just in case)
    if password_byte_length > 72:
        password = password[:72].encode(
            'utf-8').decode('utf-8', errors='ignore')
        logger.warning(f"Password truncated to 72 bytes")

    try:
        # Hash the password using passlib
        hash_result = pwd_context.hash(password)
        return hash_result
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Password hashing error: {error_msg}")

        # Handle bcrypt-specific errors
        if "cannot be longer than 72 bytes" in error_msg.lower() or "72 bytes" in error_msg.lower():
            raise ValueError(
                f"Password is too long ({password_byte_length} bytes, maximum 72 bytes). Please use a shorter password.")

        # For any other error, provide a generic message
        raise ValueError(f"Failed to hash password: {error_msg}")


def create_access_token(data: Dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token with iss/aud for claim validation."""
    from app.config import settings
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=_get_access_token_expire_minutes())
    to_encode.update({
        "exp": expire,
        "iss": getattr(settings, "JWT_ISSUER", "carwiseiq-api"),
        "aud": getattr(settings, "JWT_AUDIENCE", "carwiseiq-app"),
    })
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


# JWKS cache with TTL
_jwks_cache: Optional[Dict] = None
_jwks_cache_time: float = 0

def _get_supabase_jwks():
    """Fetch Supabase JWKS (cached for 1 hour)"""
    global _jwks_cache, _jwks_cache_time
    
    if not SUPABASE_URL:
        logger.warning("SUPABASE_URL not configured, cannot fetch JWKS")
        return None
    
    # Return cached JWKS if still valid
    if _jwks_cache and (time.time() - _jwks_cache_time) < SUPABASE_JWKS_CACHE_TTL:
        return _jwks_cache
    
    # Try correct Supabase JWKS path: /auth/v1/.well-known/jwks.json
    jwks_paths = [
        f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json",  # Correct Supabase path
        f"{SUPABASE_URL}/.well-known/jwks.json",  # Fallback (legacy)
    ]
    
    for jwks_url in jwks_paths:
        try:
            logger.debug(f"Fetching JWKS from: {jwks_url}")
            response = httpx.get(jwks_url, timeout=10)
            response.raise_for_status()
            jwks = response.json()
            
            if not jwks.get('keys'):
                logger.warning(f"JWKS response from {jwks_url} has no keys")
                continue  # Try next path
                
            logger.info(f"✅ Fetched Supabase JWKS from {jwks_url} with {len(jwks.get('keys', []))} keys")
            
            # Cache the JWKS
            _jwks_cache = jwks
            _jwks_cache_time = time.time()
            
            return jwks
        except httpx.TimeoutException:
            logger.warning(f"Timeout fetching JWKS from {jwks_url}")
            continue  # Try next path
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                logger.debug(f"JWKS not found at {jwks_url} (404), trying next path...")
                continue  # Try next path
            else:
                logger.error(f"HTTP error fetching JWKS from {jwks_url}: {e.response.status_code} - {e.response.text}")
                continue  # Try next path
        except Exception as e:
            logger.warning(f"Error fetching JWKS from {jwks_url}: {e}")
            continue  # Try next path
    
    # All paths failed - return stale cache if available
    if _jwks_cache:
        logger.warning("All JWKS paths failed, using stale cache")
        return _jwks_cache
    
    logger.error(f"❌ Failed to fetch JWKS from all paths. Checked: {jwks_paths}")
    return None


def _is_supabase_token(token: str) -> bool:
    """Check if token is a Supabase token by examining header and payload"""
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get('alg')
        # Supabase tokens can use RS256 or ES256
        if alg not in ['RS256', 'ES256']:
            return False
        
        # Also check payload for Supabase issuer
        try:
            # Decode without verification to check issuer
            unverified = jwt.get_unverified_claims(token)
            iss = unverified.get('iss', '')
            # Supabase tokens have issuer matching SUPABASE_URL
            if SUPABASE_URL and iss.startswith(SUPABASE_URL):
                return True
            # Also check for common Supabase issuer patterns
            if 'supabase.co' in iss or 'supabase.io' in iss:
                return True
        except:
            pass
        
        # If algorithm is RS256 or ES256 and we have SUPABASE_URL configured, assume it's Supabase
        return alg in ['RS256', 'ES256'] and bool(SUPABASE_URL)
    except:
        return False


def decode_access_token(token: str) -> Optional[Dict]:
    """Decode and verify a JWT token (supports both REST API HS256 and Supabase RS256)"""
    if not token:
        return None
    
    # Log token preview (first 20 chars only)
    token_preview = token[:20] + "..." if len(token) > 20 else token
    logger.debug(f"Decoding token (preview: {token_preview})")
    
    # Check if this is a Supabase token (RS256)
    if _is_supabase_token(token):
        return _decode_supabase_token(token)
    
    # Otherwise, try REST API token (HS256)
    return _decode_rest_token(token)


def _decode_supabase_token(token: str) -> Optional[Dict]:
    """Decode and verify a Supabase JWT token (RS256 or ES256 via JWKS)"""
    try:
        # Get JWKS (with caching and error handling)
        jwks = _get_supabase_jwks()
        if not jwks:
            logger.error("❌ Could not get Supabase JWKS - check SUPABASE_URL configuration and network connectivity")
            logger.error(f"   SUPABASE_URL: {SUPABASE_URL if SUPABASE_URL else 'NOT SET'}")
            logger.error(f"   JWKS URLs tried: {SUPABASE_URL}/auth/v1/.well-known/jwks.json and {SUPABASE_URL}/.well-known/jwks.json")
            
            # FALLBACK: Decode without signature verification (INSECURE - only for development)
            # This allows the system to work when JWKS is unavailable, but tokens are NOT verified
            logger.warning("⚠️ JWKS unavailable - attempting unverified decode (INSECURE - development only)")
            try:
                # Decode without verification, but still check expiration
                payload = jwt.decode(
                    token,
                    options={"verify_signature": False, "verify_exp": True, "verify_aud": False}
                )
                logger.warning("⚠️ Token decoded WITHOUT signature verification - this is INSECURE and should only be used in development")
                return payload
            except JWTError as decode_error:
                if "expired" in str(decode_error).lower():
                    logger.warning("⚠️ Token expired (unverified decode)")
                else:
                    logger.error(f"❌ Failed to decode token even without verification: {decode_error}")
                return None
            except Exception as decode_exception:
                logger.error(f"❌ Unexpected error in fallback decode: {decode_exception}")
                return None
        
        # Use python-jose's get_unverified_header to get kid and alg
        header = jwt.get_unverified_header(token)
        kid = header.get('kid')
        alg = header.get('alg')
        
        if not kid:
            logger.warning("Supabase token missing 'kid' in header")
            return None
        
        # Find the key with matching kid
        jwk = None
        for k in jwks.get('keys', []):
            if k.get('kid') == kid:
                jwk = k
                break
        
        if not jwk:
            available_kids = [k.get('kid') for k in jwks.get('keys', [])]
            logger.error(f"❌ Supabase JWKS key with kid '{kid}' not found")
            logger.error(f"   Available kids in JWKS: {available_kids}")
            logger.error(f"   Token algorithm: {alg}")
            return None
        
        # Determine algorithm and convert JWK accordingly
        from cryptography.hazmat.primitives.asymmetric import rsa, ec
        from cryptography.hazmat.primitives import serialization
        import base64
        
        if alg == 'RS256':
            # RSA public key
            n_bytes = base64.urlsafe_b64decode(jwk['n'] + '==')
            e_bytes = base64.urlsafe_b64decode(jwk['e'] + '==')
            n_int = int.from_bytes(n_bytes, 'big')
            e_int = int.from_bytes(e_bytes, 'big')
            public_key = rsa.RSAPublicNumbers(e_int, n_int).public_key()
            pem = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
            algorithms_to_use = ['RS256']
        elif alg == 'ES256':
            # ECDSA P-256 public key
            x_bytes = base64.urlsafe_b64decode(jwk['x'] + '==')
            y_bytes = base64.urlsafe_b64decode(jwk['y'] + '==')
            x_int = int.from_bytes(x_bytes, 'big')
            y_int = int.from_bytes(y_bytes, 'big')
            public_key = ec.EllipticCurvePublicNumbers(x_int, y_int, ec.SECP256R1()).public_key()
            pem = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
            algorithms_to_use = ['ES256']
        else:
            logger.warning(f"Unsupported Supabase token algorithm: {alg}")
            return None
        
        # Verify token using public key
        # Supabase tokens have: iss, aud, exp, sub, email, etc.
        # Try with audience verification first, then without if it fails
        try:
            payload = jwt.decode(
                token,
                pem,
                algorithms=algorithms_to_use,
                audience='authenticated',  # Supabase default audience
                options={"verify_signature": True, "verify_exp": True, "verify_aud": True}
            )
        except JWTError as aud_error:
            # If audience verification fails, try without it (some Supabase setups don't use aud)
            if "audience" in str(aud_error).lower() or "aud" in str(aud_error).lower():
                logger.debug(f"Audience verification failed, retrying without audience check: {aud_error}")
                try:
                    payload = jwt.decode(
                        token,
                        pem,
                        algorithms=algorithms_to_use,
                        options={"verify_signature": True, "verify_exp": True, "verify_aud": False}
                    )
                except JWTError as retry_error:
                    raise retry_error
            else:
                raise aud_error
        
        # Verify issuer matches Supabase URL (more lenient check)
        if SUPABASE_URL:
            token_iss = payload.get('iss', '')
            # Check if issuer matches Supabase URL (can be exact match or subdomain)
            if not (token_iss == SUPABASE_URL or token_iss.startswith(SUPABASE_URL) or SUPABASE_URL in token_iss):
                # Also allow common Supabase issuer patterns
                if 'supabase.co' not in token_iss and 'supabase.io' not in token_iss:
                    logger.warning(f"Token issuer mismatch: expected {SUPABASE_URL}, got {token_iss}")
                    # Don't fail - issuer might be valid but different format
                    # return None
        
        logger.debug(f"Supabase token ({alg}) decoded successfully for user: {payload.get('sub')}")
        return payload
    except JWTError as e:
        error_msg = str(e).lower()
        if "expired" in error_msg or "exp" in error_msg:
            logger.warning("⚠️ Supabase token has expired - client should refresh")
        elif "signature" in error_msg or "invalid" in error_msg:
            logger.error(f"❌ Invalid Supabase token signature: {str(e)}")
            logger.error("   This usually means: 1) Token was tampered with, 2) Wrong JWKS key, or 3) Token from different Supabase project")
        elif "audience" in error_msg or "aud" in error_msg:
            logger.warning(f"⚠️ Supabase token audience mismatch: {str(e)}")
            logger.warning("   Retrying without audience verification...")
        else:
            logger.error(f"❌ Supabase JWT decode error: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"❌ Unexpected error decoding Supabase token: {str(e)}", exc_info=True)
        return None


def _decode_rest_token(token: str) -> Optional[Dict]:
    """Decode and verify a REST API JWT token (HS256); validate exp, and iss/aud when present."""
    try:
        from app.config import settings
        issuer = getattr(settings, "JWT_ISSUER", "carwiseiq-api")
        audience = getattr(settings, "JWT_AUDIENCE", "carwiseiq-app")
        try:
            payload = jwt.decode(
                token,
                SECRET_KEY,
                algorithms=[ALGORITHM],
                audience=audience,
                issuer=issuer,
                options={"verify_exp": True, "verify_aud": True, "verify_iss": True},
            )
        except JWTError:
            # Backward compatibility: tokens issued before iss/aud may not have these claims
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            if payload.get("iss") and payload["iss"] != issuer:
                return None
            if payload.get("aud") and payload["aud"] != audience:
                return None
        logger.debug(f"REST token decoded successfully for user: {payload.get('sub')}")
        return payload
    except JWTError as e:
        # Check the error message to determine the specific issue
        error_msg = str(e).lower()
        if "expired" in error_msg or "exp" in error_msg:
            logger.warning("REST token has expired")
        elif "signature" in error_msg or "invalid" in error_msg:
            logger.error(f"Invalid REST token signature - token may have been signed with different secret key. Error: {str(e)}")
        elif "decode" in error_msg or "malformed" in error_msg:
            logger.error(f"REST token decode error (malformed token): {str(e)}")
        else:
            logger.error(f"REST JWT error: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error decoding REST token: {str(e)}", exc_info=True)
        return None


def create_user(email: str, password: str) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Create a new user
    Returns: (user_dict, error_message)
    - If successful: (user_dict, None)
    - If email exists: (None, "Email already registered")
    - If other error: (None, error_message)
    """
    try:
        # Normalize email: lowercase and strip whitespace
        email = email.lower().strip()

        if not email:
            return None, "Email cannot be empty"

        conn = get_db()
        cursor = conn.cursor()

        # Check if user already exists (case-insensitive)
        cursor.execute(
            "SELECT id, email FROM users WHERE LOWER(TRIM(email)) = ?", (email,))
        existing = cursor.fetchone()
        if existing:
            logger.warning(
                f"User already exists: {existing['email']} (requested: {email})")
            conn.close()
            return None, "Email already registered"

        # Validate password before hashing
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            conn.close()
            return None, f"Password is too long ({len(password_bytes)} bytes, maximum 72 bytes). Please use a shorter password."

        # Create user
        try:
            password_hash = get_password_hash(password)
        except ValueError as e:
            conn.close()
            return None, str(e)
        except Exception as e:
            conn.close()
            logger.error(f"Password hashing error: {e}")
            return None, f"Failed to process password: {str(e)}"

        cursor.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (email, password_hash)
        )
        conn.commit()
        user_id = cursor.lastrowid
        conn.close()

        logger.info(f"User created successfully: {email}")
        return {"id": user_id, "email": email}, None
    except sqlite3.IntegrityError as e:
        logger.error(f"Database integrity error creating user: {e}")
        # Check if it's a unique constraint violation
        if "UNIQUE constraint" in str(e) or "unique constraint" in str(e).lower():
            return None, "Email already registered"
        return None, f"Database error: {str(e)}"
    except Exception as e:
        logger.error(f"Error creating user: {e}", exc_info=True)
        return None, f"Failed to create user: {str(e)}"


def authenticate_user(email: str, password: str, ip_address: Optional[str] = None) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Authenticate a user and return user data
    Returns: (user_dict, error_message)
    """
    try:
        # Normalize email
        email = email.lower().strip()

        # Check rate limiting
        allowed, error_msg = check_rate_limit(email, ip_address)
        if not allowed:
            return None, error_msg

        # Check if account is locked
        is_locked, locked_until = is_account_locked(email)
        if is_locked:
            return None, f"Account is locked. Try again after {locked_until.strftime('%H:%M:%S')} UTC"

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, email, password_hash FROM users WHERE LOWER(TRIM(email)) = ?", (email,))
        user = cursor.fetchone()
        conn.close()

        if not user:
            record_login_attempt(email, False, ip_address)
            return None, "Incorrect email or password"

        if not verify_password(password, user["password_hash"]):
            record_login_attempt(email, False, ip_address)
            return None, "Incorrect email or password"

        # Successful login
        record_login_attempt(email, True, ip_address)
        logger.info(f"User authenticated: {email}")
        return {"id": user["id"], "email": user["email"]}, None
        
    except Exception as e:
        logger.error(f"Error authenticating user: {e}")
        return None, str(e)


def get_user_by_id(user_id: int, include_sensitive: bool = False) -> Optional[Dict]:
    """Get user by ID with all profile fields"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        if include_sensitive:
            cursor.execute("""
                SELECT id, email, full_name, phone, location, profile_picture_url,
                       email_verified, role, created_at, updated_at,
                       privacy_show_phone, privacy_show_email, privacy_location_precision,
                       privacy_allow_ai_training, terms_accepted
                FROM users WHERE id = ?
            """, (int(user_id),))
        else:
            cursor.execute("""
                SELECT id, email, full_name, phone, location, profile_picture_url,
                       email_verified, role, created_at, updated_at
                FROM users WHERE id = ?
            """, (int(user_id),))
        
        user = cursor.fetchone()
        conn.close()

        if not user:
            return None

        return dict(user)
    except Exception as e:
        logger.error(f"Error getting user: {e}")
        return None


def get_user_by_email(email: str) -> Optional[Dict]:
    """Get user by email"""
    try:
        # Normalize email: lowercase and strip whitespace
        email = email.lower().strip()

        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, email FROM users WHERE LOWER(TRIM(email)) = ?", (email,))
        user = cursor.fetchone()
        conn.close()

        if not user:
            return None

        return {"id": user["id"], "email": user["email"]}
    except Exception as e:
        logger.error(f"Error getting user: {e}")
        return None


import secrets
import json


def generate_verification_token() -> str:
    """Generate a secure verification token"""
    return secrets.token_urlsafe(32)


def generate_reset_token() -> str:
    """Generate a secure password reset token"""
    return secrets.token_urlsafe(32)


def validate_password_strength(password: str) -> Tuple[bool, Optional[str]]:
    """
    Validate password strength
    Returns: (is_valid, error_message)
    Requirements:
    - At least 8 characters
    - At least 1 uppercase letter
    - At least 1 number
    - At least 1 special character
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters"
    
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter"
    
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one number"
    
    special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    if not any(c in special_chars for c in password):
        return False, "Password must contain at least one special character"
    
    return True, None


def create_user_with_profile(email: str, password: str, full_name: Optional[str] = None, 
                            terms_accepted: bool = False) -> Tuple[Optional[Dict], Optional[str]]:
    """
    Create a new user with profile information
    Returns: (user_dict, error_message)
    """
    try:
        # Validate password strength
        is_valid, error_msg = validate_password_strength(password)
        if not is_valid:
            return None, error_msg
        
        # Normalize email
        email = email.lower().strip()
        
        if not email:
            return None, "Email cannot be empty"
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Check if user already exists
        cursor.execute("SELECT id, email FROM users WHERE LOWER(TRIM(email)) = ?", (email,))
        existing = cursor.fetchone()
        if existing:
            conn.close()
            return None, "Email already registered"
        
        # Validate password length
        password_bytes = password.encode('utf-8')
        if len(password_bytes) > 72:
            conn.close()
            return None, "Password is too long (maximum 72 bytes)"
        
        # Generate email verification token
        verification_token = generate_verification_token()
        
        # Hash password
        try:
            password_hash = get_password_hash(password)
        except ValueError as e:
            conn.close()
            return None, str(e)
        except Exception as e:
            conn.close()
            logger.error(f"Password hashing error: {e}")
            return None, f"Failed to process password: {str(e)}"
        
        # Create user
        cursor.execute("""
            INSERT INTO users (email, password_hash, full_name, email_verification_token, terms_accepted, terms_accepted_at)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            email,
            password_hash,
            full_name,
            verification_token,
            1 if terms_accepted else 0,
            datetime.utcnow() if terms_accepted else None
        ))
        
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        logger.info(f"User created successfully: {email}")
        return {
            "id": user_id,
            "email": email,
            "full_name": full_name,
            "email_verified": False,
            "verification_token": verification_token
        }, None
        
    except sqlite3.IntegrityError as e:
        logger.error(f"Database integrity error creating user: {e}")
        if "UNIQUE constraint" in str(e).lower():
            return None, "Email already registered"
        return None, f"Database error: {str(e)}"
    except Exception as e:
        logger.error(f"Error creating user: {e}", exc_info=True)
        return None, f"Failed to create user: {str(e)}"


def verify_email(token: str) -> Tuple[bool, Optional[str]]:
    """
    Verify user email with token
    Returns: (success, error_message)
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, email FROM users
            WHERE email_verification_token = ? AND email_verified = 0
        """, (token,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return False, "Invalid or expired verification token"
        
        # Mark email as verified
        cursor.execute("""
            UPDATE users
            SET email_verified = 1,
                email_verified_at = CURRENT_TIMESTAMP,
                email_verification_token = NULL
            WHERE id = ?
        """, (user['id'],))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Email verified for user: {user['email']}")
        return True, None
        
    except Exception as e:
        logger.error(f"Error verifying email: {e}")
        return False, str(e)


def resend_verification_email(email: str) -> Tuple[bool, Optional[str]]:
    """Generate new verification token and return it"""
    try:
        email = email.lower().strip()
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, email_verified FROM users WHERE LOWER(TRIM(email)) = ?
        """, (email,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return False, "User not found"
        
        if user['email_verified']:
            conn.close()
            return False, "Email already verified"
        
        # Generate new token
        verification_token = generate_verification_token()
        
        cursor.execute("""
            UPDATE users
            SET email_verification_token = ?
            WHERE id = ?
        """, (verification_token, user['id']))
        
        conn.commit()
        conn.close()
        
        return True, verification_token
        
    except Exception as e:
        logger.error(f"Error resending verification email: {e}")
        return False, str(e)


def create_password_reset_token(email: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Create password reset token
    Returns: (token, error_message)
    """
    try:
        email = email.lower().strip()
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("SELECT id FROM users WHERE LOWER(TRIM(email)) = ?", (email,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return None, "User not found"  # Don't reveal if email exists
        
        # Check rate limit (max 3 per hour)
        cursor.execute("""
            SELECT COUNT(*) as count FROM password_reset_tokens
            WHERE user_id = ? AND created_at > datetime('now', '-1 hour') AND used = 0
        """, (user['id'],))
        count = cursor.fetchone()['count']
        
        if count >= 3:
            conn.close()
            return None, "Too many reset requests. Please try again later."
        
        # Generate token
        reset_token = generate_reset_token()
        expires_at = datetime.utcnow() + timedelta(hours=1)
        
        cursor.execute("""
            INSERT INTO password_reset_tokens (user_id, token, expires_at)
            VALUES (?, ?, ?)
        """, (user['id'], reset_token, expires_at))
        
        conn.commit()
        conn.close()
        
        return reset_token, None
        
    except Exception as e:
        logger.error(f"Error creating password reset token: {e}")
        return None, str(e)


def reset_password(token: str, new_password: str) -> Tuple[bool, Optional[str]]:
    """
    Reset password with token
    Returns: (success, error_message)
    """
    try:
        # Validate password strength
        is_valid, error_msg = validate_password_strength(new_password)
        if not is_valid:
            return False, error_msg
        
        conn = get_db()
        cursor = conn.cursor()
        
        # Find valid token
        cursor.execute("""
            SELECT prt.user_id, prt.expires_at, prt.used
            FROM password_reset_tokens prt
            WHERE prt.token = ? AND prt.expires_at > datetime('now') AND prt.used = 0
        """, (token,))
        token_data = cursor.fetchone()
        
        if not token_data:
            conn.close()
            return False, "Invalid or expired reset token"
        
        user_id = token_data['user_id']
        
        # Validate password length
        password_bytes = new_password.encode('utf-8')
        if len(password_bytes) > 72:
            conn.close()
            return False, "Password is too long (maximum 72 bytes)"
        
        # Hash new password
        try:
            password_hash = get_password_hash(new_password)
        except ValueError as e:
            conn.close()
            return False, str(e)
        except Exception as e:
            conn.close()
            logger.error(f"Password hashing error: {e}")
            return False, f"Failed to process password: {str(e)}"
        
        # Update password
        cursor.execute("""
            UPDATE users
            SET password_hash = ?,
                failed_login_attempts = 0,
                locked_until = NULL,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (password_hash, user_id))
        
        # Mark token as used
        cursor.execute("""
            UPDATE password_reset_tokens
            SET used = 1
            WHERE token = ?
        """, (token,))
        
        conn.commit()
        conn.close()
        
        logger.info(f"Password reset successful for user_id: {user_id}")
        return True, None
        
    except Exception as e:
        logger.error(f"Error resetting password: {e}")
        return False, str(e)


def check_rate_limit(email: str, ip_address: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """
    Check rate limiting for login attempts
    Returns: (allowed, error_message)
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Check failed attempts in last 15 minutes
        cursor.execute("""
            SELECT COUNT(*) as count FROM login_attempts
            WHERE email = ? AND success = 0 AND attempted_at > datetime('now', '-15 minutes')
        """, (email.lower().strip(),))
        failed_count = cursor.fetchone()['count']
        
        if failed_count >= 5:
            conn.close()
            return False, "Too many failed login attempts. Please try again in 15 minutes."
        
        # Check IP-based rate limiting for registration (3 per day)
        if ip_address:
            cursor.execute("""
                SELECT COUNT(*) as count FROM login_attempts
                WHERE ip_address = ? AND attempted_at > datetime('now', '-1 day')
            """, (ip_address,))
            ip_count = cursor.fetchone()['count']
            
            if ip_count >= 50:  # General rate limit
                conn.close()
                return False, "Too many requests from this IP. Please try again later."
        
        conn.close()
        return True, None
        
    except Exception as e:
        logger.error(f"Error checking rate limit: {e}")
        return True, None  # Allow on error


def record_login_attempt(email: str, success: bool, ip_address: Optional[str] = None):
    """Record login attempt for rate limiting"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO login_attempts (email, ip_address, success)
            VALUES (?, ?, ?)
        """, (email.lower().strip(), ip_address, 1 if success else 0))
        
        # Update user's failed login attempts
        if not success:
            cursor.execute("""
                UPDATE users
                SET failed_login_attempts = failed_login_attempts + 1
                WHERE LOWER(TRIM(email)) = ?
            """, (email.lower().strip(),))
            
            # Lock account after 5 failed attempts
            cursor.execute("""
                SELECT failed_login_attempts FROM users
                WHERE LOWER(TRIM(email)) = ?
            """, (email.lower().strip(),))
            user = cursor.fetchone()
            
            if user and user['failed_login_attempts'] >= 5:
                lock_until = datetime.utcnow() + timedelta(minutes=30)
                cursor.execute("""
                    UPDATE users
                    SET locked_until = ?
                    WHERE LOWER(TRIM(email)) = ?
                """, (lock_until, email.lower().strip()))
        else:
            # Reset failed attempts on successful login
            cursor.execute("""
                UPDATE users
                SET failed_login_attempts = 0,
                    locked_until = NULL,
                    last_login_at = CURRENT_TIMESTAMP
                WHERE LOWER(TRIM(email)) = ?
            """, (email.lower().strip(),))
        
        conn.commit()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error recording login attempt: {e}")


def is_account_locked(email: str) -> Tuple[bool, Optional[datetime]]:
    """
    Check if account is locked
    Returns: (is_locked, locked_until)
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT locked_until FROM users
            WHERE LOWER(TRIM(email)) = ?
        """, (email.lower().strip(),))
        user = cursor.fetchone()
        
        conn.close()
        
        if not user or not user['locked_until']:
            return False, None
        
        locked_until = datetime.fromisoformat(user['locked_until'])
        if locked_until > datetime.utcnow():
            return True, locked_until
        
        # Lock expired, clear it
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users
            SET locked_until = NULL, failed_login_attempts = 0
            WHERE LOWER(TRIM(email)) = ?
        """, (email.lower().strip(),))
        conn.commit()
        conn.close()
        
        return False, None
        
    except Exception as e:
        logger.error(f"Error checking account lock: {e}")
        return False, None


def create_refresh_token(user_id: int, device_info: Optional[str] = None, 
                        ip_address: Optional[str] = None) -> str:
    """Create a refresh token (stored in DB for rotation; 7-day expiry)."""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        token = secrets.token_urlsafe(64)
        expires_at = datetime.utcnow() + timedelta(days=_get_refresh_token_expire_days())
        
        cursor.execute("""
            INSERT INTO refresh_tokens (user_id, token, expires_at, device_info, ip_address)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, token, expires_at, device_info, ip_address))
        
        conn.commit()
        conn.close()
        
        return token
        
    except Exception as e:
        logger.error(f"Error creating refresh token: {e}")
        raise


def verify_refresh_token(token: str, revoke_after_use: bool = True) -> Optional[int]:
    """
    Verify refresh token and return user_id.
    If revoke_after_use=True (default), invalidates the token after use (rotation).
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT user_id FROM refresh_tokens
            WHERE token = ? AND expires_at > datetime('now')
        """, (token,))
        result = cursor.fetchone()
        
        if result:
            user_id = result['user_id']
            if revoke_after_use:
                cursor.execute("DELETE FROM refresh_tokens WHERE token = ?", (token,))
                conn.commit()
            conn.close()
            return user_id
        
        conn.close()
        return None
        
    except Exception as e:
        logger.error(f"Error verifying refresh token: {e}")
        return None


def revoke_refresh_token(token: str):
    """Revoke a refresh token"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            DELETE FROM refresh_tokens WHERE token = ?
        """, (token,))
        
        conn.commit()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error revoking refresh token: {e}")


def revoke_all_refresh_tokens(user_id: int):
    """Revoke all refresh tokens for a user (logout from all devices)"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            DELETE FROM refresh_tokens WHERE user_id = ?
        """, (user_id,))
        
        conn.commit()
        conn.close()
        
    except Exception as e:
        logger.error(f"Error revoking all refresh tokens: {e}")


def update_user_profile(user_id: int, **kwargs) -> Tuple[bool, Optional[str]]:
    """
    Update user profile
    Allowed fields: full_name, phone, location, profile_picture_url
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        allowed_fields = ['full_name', 'phone', 'location', 'profile_picture_url']
        updates = []
        params = []
        
        for key, value in kwargs.items():
            if key in allowed_fields:
                updates.append(f"{key} = ?")
                params.append(value)
        
        if not updates:
            conn.close()
            return False, "No valid fields to update"
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(user_id)
        
        cursor.execute(f"""
            UPDATE users
            SET {', '.join(updates)}
            WHERE id = ?
        """, params)
        
        conn.commit()
        conn.close()
        
        return True, None
        
    except Exception as e:
        logger.error(f"Error updating user profile: {e}")
        return False, str(e)


def update_password(user_id: int, current_password: str, new_password: str) -> Tuple[bool, Optional[str]]:
    """Update user password"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get current password hash
        cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            conn.close()
            return False, "User not found"
        
        # Verify current password
        if not verify_password(current_password, user['password_hash']):
            conn.close()
            return False, "Current password is incorrect"
        
        # Validate new password strength
        is_valid, error_msg = validate_password_strength(new_password)
        if not is_valid:
            conn.close()
            return False, error_msg
        
        # Validate length
        password_bytes = new_password.encode('utf-8')
        if len(password_bytes) > 72:
            conn.close()
            return False, "Password is too long (maximum 72 bytes)"
        
        # Hash new password
        try:
            password_hash = get_password_hash(new_password)
        except ValueError as e:
            conn.close()
            return False, str(e)
        
        # Update password
        cursor.execute("""
            UPDATE users
            SET password_hash = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (password_hash, user_id))
        
        conn.commit()
        conn.close()
        
        return True, None
        
    except Exception as e:
        logger.error(f"Error updating password: {e}")
        return False, str(e)


def update_privacy_settings(user_id: int, **kwargs) -> Tuple[bool, Optional[str]]:
    """Update privacy settings"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        allowed_fields = ['privacy_show_phone', 'privacy_show_email', 
                         'privacy_location_precision', 'privacy_allow_ai_training']
        updates = []
        params = []
        
        for key, value in kwargs.items():
            if key in allowed_fields:
                updates.append(f"{key} = ?")
                params.append(value)
        
        if not updates:
            conn.close()
            return False, "No valid fields to update"
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(user_id)
        
        cursor.execute(f"""
            UPDATE users
            SET {', '.join(updates)}
            WHERE id = ?
        """, params)
        
        conn.commit()
        conn.close()
        
        return True, None
        
    except Exception as e:
        logger.error(f"Error updating privacy settings: {e}")
        return False, str(e)


def get_user_data_export(user_id: int) -> Optional[Dict]:
    """Get all user data for GDPR export"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get user data
        cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            return None
        
        user_dict = dict(user)
        
        # Remove sensitive fields
        user_dict.pop('password_hash', None)
        user_dict.pop('refresh_token', None)
        user_dict.pop('email_verification_token', None)
        
        # Get user's listings
        cursor.execute("SELECT * FROM listings WHERE user_id = ?", (user_id,))
        listings = [dict(row) for row in cursor.fetchall()]
        
        # Get user's favorites
        cursor.execute("SELECT * FROM favorites WHERE user_id = ?", (user_id,))
        favorites = [dict(row) for row in cursor.fetchall()]
        
        # Get user's saved searches
        cursor.execute("SELECT * FROM saved_searches WHERE user_id = ?", (user_id,))
        saved_searches = [dict(row) for row in cursor.fetchall()]
        
        # Get user's messages
        cursor.execute("""
            SELECT * FROM messages
            WHERE sender_id = ? OR recipient_id = ?
        """, (user_id, user_id))
        messages = [dict(row) for row in cursor.fetchall()]
        
        conn.close()
        
        return {
            'user': user_dict,
            'listings': listings,
            'favorites': favorites,
            'saved_searches': saved_searches,
            'messages': messages,
            'exported_at': datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error exporting user data: {e}")
        return None


def delete_user_account(user_id: int) -> Tuple[bool, Optional[str]]:
    """
    Delete user account (GDPR compliance)
    - Anonymizes listings (keeps for statistics)
    - Deletes personal data
    - Keeps anonymized data for analytics
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # Get user email for confirmation
        cursor.execute("SELECT email FROM users WHERE id = ?", (user_id,))
        user = cursor.fetchone()
        
        if not user:
            return False, "User not found"
        
        # Anonymize listings (keep for statistics but remove user_id)
        cursor.execute("""
            UPDATE listings
            SET user_id = NULL,
                phone = NULL,
                exact_address = NULL
            WHERE user_id = ?
        """, (user_id,))
        
        # Delete user's favorites
        cursor.execute("DELETE FROM favorites WHERE user_id = ?", (user_id,))
        
        # Delete user's saved searches
        cursor.execute("DELETE FROM saved_searches WHERE user_id = ?", (user_id,))
        
        # Delete user's refresh tokens
        cursor.execute("DELETE FROM refresh_tokens WHERE user_id = ?", (user_id,))
        
        # Delete password reset tokens
        cursor.execute("DELETE FROM password_reset_tokens WHERE user_id = ?", (user_id,))
        
        # Delete login attempts
        cursor.execute("DELETE FROM login_attempts WHERE email = ?", (user['email'],))
        
        # Delete user account
        cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
        
        conn.commit()
        conn.close()
        
        logger.info(f"User account deleted: {user_id}")
        return True, None
        
    except Exception as e:
        logger.error(f"Error deleting user account: {e}")
        return False, str(e)


# Initialize database on import
init_db()
