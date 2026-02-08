"""
Admin service for administrator authentication and management
"""
import os
import sqlite3
import logging
from typing import Optional, Dict, List, Tuple
from datetime import datetime
from passlib.context import CryptContext
from jose import JWTError, jwt

logger = logging.getLogger(__name__)

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings (can use same as auth_service or separate)
SECRET_KEY = os.getenv(
    "SECRET_KEY", "sbODn2gVqCJPIY678350ohKv9GlpmrS4aTAjxfkBLtRdizuEw1WHNZeFUQXyMc")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 8 * 60  # 8 hours for admin sessions

# Database path (same as auth service)
DB_PATH = os.path.join(os.path.dirname(
    os.path.dirname(os.path.dirname(__file__))), "users.db")

# Admin roles
ROLE_SUPER_ADMIN = "super_admin"
ROLE_MODERATOR = "moderator"
ROLE_VIEWER = "viewer"


def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_admin_db():
    """Initialize database with admin tables"""
    conn = get_db()
    cursor = conn.cursor()

    # Create admins table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'viewer',
            is_active BOOLEAN DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_login TIMESTAMP,
            password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create audit_logs table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS admin_audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            admin_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            resource_type TEXT,
            resource_id INTEGER,
            details TEXT,
            ip_address TEXT,
            user_agent TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
        )
    """)

    # Create indexes
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_admins_role ON admins(role)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON admin_audit_logs(admin_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON admin_audit_logs(timestamp)
    """)

    conn.commit()

    # Create default super admin if it doesn't exist
    cursor.execute("SELECT id FROM admins WHERE email = ?",
                   ("admin@carprediction.com",))
    if not cursor.fetchone():
        password_hash = get_password_hash("Admin@123")
        cursor.execute("""
            INSERT INTO admins (email, password_hash, name, role, is_active)
            VALUES (?, ?, ?, ?, ?)
        """, ("admin@carprediction.com", password_hash, "Super Admin", ROLE_SUPER_ADMIN, True))
        conn.commit()
        logger.info("Default super admin created: admin@carprediction.com")

    conn.close()
    logger.info("Admin database initialized")


def get_password_hash(password: str) -> str:
    """Hash a password"""
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        raise ValueError("Password is too long (maximum 72 bytes)")
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against its hash"""
    return pwd_context.verify(plain_password, hashed_password)


def create_admin_token(data: Dict) -> str:
    """Create a JWT access token for admin"""
    from datetime import timedelta
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "type": "admin"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_admin_token(token: str) -> Optional[Dict]:
    """Decode and verify an admin JWT token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        # Verify it's an admin token
        if payload.get("type") != "admin":
            return None
        return payload
    except JWTError:
        return None


def authenticate_admin(email: str, password: str) -> Optional[Dict]:
    """Authenticate an admin and return admin data"""
    try:
        email = email.lower().strip()
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, email, password_hash, name, role, is_active
            FROM admins WHERE LOWER(TRIM(email)) = ?
        """, (email,))
        admin = cursor.fetchone()
        conn.close()

        if not admin:
            return None

        if not admin["is_active"]:
            logger.warning(f"Login attempt for inactive admin: {email}")
            return None

        if not verify_password(password, admin["password_hash"]):
            return None

        # Update last login
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE admins SET last_login = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (admin["id"],))
        conn.commit()
        conn.close()

        logger.info(f"Admin authenticated: {email}")
        return {
            "id": admin["id"],
            "email": admin["email"],
            "name": admin["name"],
            "role": admin["role"],
            "is_active": bool(admin["is_active"])
        }
    except Exception as e:
        logger.error(f"Error authenticating admin: {e}")
        return None


def get_admin_by_id(admin_id: int) -> Optional[Dict]:
    """Get admin by ID"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, email, name, role, is_active, created_at, last_login
            FROM admins WHERE id = ?
        """, (admin_id,))
        admin = cursor.fetchone()
        conn.close()

        if not admin:
            return None

        return {
            "id": admin["id"],
            "email": admin["email"],
            "name": admin["name"],
            "role": admin["role"],
            "is_active": bool(admin["is_active"]),
            "created_at": admin["created_at"],
            "last_login": admin["last_login"]
        }
    except Exception as e:
        logger.error(f"Error getting admin: {e}")
        return None


def log_admin_action(
    admin_id: int,
    action: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """Log an admin action to audit log"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO admin_audit_logs (
                admin_id, action, resource_type, resource_id, details, ip_address, user_agent
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (admin_id, action, resource_type, resource_id, details, ip_address, user_agent))
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Error logging admin action: {e}")


def check_permission(admin_role: str, required_permission: str) -> bool:
    """Check if admin role has required permission"""
    permissions = {
        ROLE_SUPER_ADMIN: ["all"],
        ROLE_MODERATOR: ["view", "edit", "moderate"],
        ROLE_VIEWER: ["view"]
    }

    admin_perms = permissions.get(admin_role, [])
    return "all" in admin_perms or required_permission in admin_perms


def change_admin_password(admin_id: int, old_password: str, new_password: str) -> Tuple[bool, Optional[str]]:
    """Change admin password"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT password_hash FROM admins WHERE id = ?", (admin_id,))
        admin = cursor.fetchone()

        if not admin:
            conn.close()
            return False, "Admin not found"

        if not verify_password(old_password, admin["password_hash"]):
            conn.close()
            return False, "Current password is incorrect"

        new_hash = get_password_hash(new_password)
        cursor.execute("""
            UPDATE admins
            SET password_hash = ?, password_changed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (new_hash, admin_id))
        conn.commit()
        conn.close()

        log_admin_action(admin_id, "password_changed",
                         details="Password changed successfully")
        return True, None
    except Exception as e:
        logger.error(f"Error changing password: {e}")
        return False, str(e)


# Initialize database on import
init_admin_db()
