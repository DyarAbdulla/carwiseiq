"""
Messaging service for buyer-seller communication
"""
import sqlite3
import os
import logging
from typing import Optional, Dict, List, Tuple
from datetime import datetime
import json

logger = logging.getLogger(__name__)

# Database path (same as auth service)
DB_PATH = os.path.join(os.path.dirname(
    os.path.dirname(os.path.dirname(__file__))), "users.db")


def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_messaging_db():
    """Initialize database with messaging tables"""
    conn = get_db()
    cursor = conn.cursor()

    # Create messages table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER NOT NULL,
            sender_id INTEGER NOT NULL,
            recipient_id INTEGER NOT NULL,
            content TEXT NOT NULL,
            image_url TEXT,
            read BOOLEAN DEFAULT 0,
            read_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Create conversations table (for quick lookup)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user1_id INTEGER NOT NULL,
            user2_id INTEGER NOT NULL,
            listing_id INTEGER NOT NULL,
            last_message TEXT,
            last_message_time TIMESTAMP,
            unread_count_user1 INTEGER DEFAULT 0,
            unread_count_user2 INTEGER DEFAULT 0,
            user1_deleted BOOLEAN DEFAULT 0,
            user2_deleted BOOLEAN DEFAULT 0,
            user1_starred BOOLEAN DEFAULT 0,
            user2_starred BOOLEAN DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
            UNIQUE(user1_id, user2_id, listing_id)
        )
    """)

    # Create blocked_users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS blocked_users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            blocked_user_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (blocked_user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, blocked_user_id)
        )
    """)

    # Create reported_messages table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS reported_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            message_id INTEGER NOT NULL,
            reporter_id INTEGER NOT NULL,
            reason TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
            FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Create typing_indicators table (for real-time typing status)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS typing_indicators (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            is_typing BOOLEAN DEFAULT 0,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(conversation_id, user_id)
        )
    """)

    # Create indexes for better query performance
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_listing_id ON messages(listing_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_conversations_user1_id ON conversations(user1_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_conversations_user2_id ON conversations(user2_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_conversations_listing_id ON conversations(listing_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_blocked_users_user_id ON blocked_users(user_id)
    """)

    conn.commit()
    conn.close()
    logger.info("Messaging database initialized")


def get_or_create_conversation(user1_id: int, user2_id: int, listing_id: int) -> int:
    """Get or create a conversation between two users for a listing"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Normalize user IDs (smaller first)
        if user1_id > user2_id:
            user1_id, user2_id = user2_id, user1_id

        # Check if conversation exists
        cursor.execute("""
            SELECT id FROM conversations
            WHERE user1_id = ? AND user2_id = ? AND listing_id = ?
        """, (user1_id, user2_id, listing_id))
        row = cursor.fetchone()

        if row:
            return row['id']

        # Create new conversation
        cursor.execute("""
            INSERT INTO conversations (user1_id, user2_id, listing_id)
            VALUES (?, ?, ?)
        """, (user1_id, user2_id, listing_id))
        conversation_id = cursor.lastrowid
        conn.commit()
        return conversation_id
    except Exception as e:
        conn.rollback()
        logger.error(f"Error getting/creating conversation: {e}")
        raise
    finally:
        conn.close()


def send_message(
    listing_id: int,
    sender_id: int,
    recipient_id: int,
    content: str,
    image_url: Optional[str] = None
) -> int:
    """Send a message"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check if sender is blocked by recipient
        cursor.execute("""
            SELECT COUNT(*) as count FROM blocked_users
            WHERE user_id = ? AND blocked_user_id = ?
        """, (recipient_id, sender_id))
        if cursor.fetchone()['count'] > 0:
            raise ValueError("You are blocked by this user")

        # Check if recipient is blocked by sender
        cursor.execute("""
            SELECT COUNT(*) as count FROM blocked_users
            WHERE user_id = ? AND blocked_user_id = ?
        """, (sender_id, recipient_id))
        if cursor.fetchone()['count'] > 0:
            raise ValueError("You have blocked this user")

        # Normalize user IDs for conversation
        user1_id, user2_id = (sender_id, recipient_id) if sender_id < recipient_id else (recipient_id, sender_id)

        # Get or create conversation
        conversation_id = get_or_create_conversation(user1_id, user2_id, listing_id)

        # Insert message
        cursor.execute("""
            INSERT INTO messages (listing_id, sender_id, recipient_id, content, image_url)
            VALUES (?, ?, ?, ?, ?)
        """, (listing_id, sender_id, recipient_id, content, image_url))
        message_id = cursor.lastrowid

        # Update conversation
        cursor.execute("""
            UPDATE conversations
            SET last_message = ?,
                last_message_time = CURRENT_TIMESTAMP,
                unread_count_user1 = CASE WHEN ? = user1_id THEN unread_count_user1 ELSE unread_count_user1 + 1 END,
                unread_count_user2 = CASE WHEN ? = user2_id THEN unread_count_user2 ELSE unread_count_user2 + 1 END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (content[:100], recipient_id, recipient_id, conversation_id))

        conn.commit()
        return message_id
    except Exception as e:
        conn.rollback()
        logger.error(f"Error sending message: {e}")
        raise
    finally:
        conn.close()


def get_messages(
    listing_id: int,
    user_id: int,
    other_user_id: int,
    limit: int = 50,
    offset: int = 0
) -> List[Dict]:
    """Get messages between two users for a listing"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT m.*, 
                   u1.email as sender_email,
                   u2.email as recipient_email
            FROM messages m
            LEFT JOIN users u1 ON m.sender_id = u1.id
            LEFT JOIN users u2 ON m.recipient_id = u2.id
            WHERE m.listing_id = ?
              AND ((m.sender_id = ? AND m.recipient_id = ?) OR
                   (m.sender_id = ? AND m.recipient_id = ?))
            ORDER BY m.created_at DESC
            LIMIT ? OFFSET ?
        """, (listing_id, user_id, other_user_id, other_user_id, user_id, limit, offset))

        messages = []
        for row in cursor.fetchall():
            messages.append({
                'id': row['id'],
                'listing_id': row['listing_id'],
                'sender_id': row['sender_id'],
                'recipient_id': row['recipient_id'],
                'content': row['content'],
                'image_url': row['image_url'],
                'read': bool(row['read']),
                'read_at': row['read_at'],
                'created_at': row['created_at'],
                'sender_email': row['sender_email']
            })

        # Reverse to show oldest first
        return list(reversed(messages))
    except Exception as e:
        logger.error(f"Error getting messages: {e}")
        return []
    finally:
        conn.close()


def mark_messages_as_read(listing_id: int, user_id: int, other_user_id: int):
    """Mark messages as read"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Mark messages as read
        cursor.execute("""
            UPDATE messages
            SET read = 1, read_at = CURRENT_TIMESTAMP
            WHERE listing_id = ? AND recipient_id = ? AND sender_id = ? AND read = 0
        """, (listing_id, user_id, other_user_id))

        # Update conversation unread count
        user1_id, user2_id = (user_id, other_user_id) if user_id < other_user_id else (other_user_id, user_id)
        cursor.execute("""
            UPDATE conversations
            SET unread_count_user1 = CASE WHEN ? = user1_id THEN 0 ELSE unread_count_user1 END,
                unread_count_user2 = CASE WHEN ? = user2_id THEN 0 ELSE unread_count_user2 END
            WHERE user1_id = ? AND user2_id = ? AND listing_id = ?
        """, (user_id, user_id, user1_id, user2_id, listing_id))

        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error marking messages as read: {e}")
    finally:
        conn.close()


def get_conversations(user_id: int) -> List[Dict]:
    """Get all conversations for a user"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT c.*,
                   l.make, l.model, l.year, l.price,
                   li.url as listing_image_url,
                   u1.email as user1_email,
                   u2.email as user2_email,
                   CASE WHEN c.user1_id = ? THEN c.unread_count_user1 ELSE c.unread_count_user2 END as unread_count
            FROM conversations c
            LEFT JOIN listings l ON c.listing_id = l.id
            LEFT JOIN listing_images li ON l.cover_image_id = li.id
            LEFT JOIN users u1 ON c.user1_id = u1.id
            LEFT JOIN users u2 ON c.user2_id = u2.id
            WHERE (c.user1_id = ? OR c.user2_id = ?)
              AND (CASE WHEN c.user1_id = ? THEN c.user1_deleted ELSE c.user2_deleted END) = 0
            ORDER BY c.last_message_time DESC
        """, (user_id, user_id, user_id, user_id))

        conversations = []
        for row in cursor.fetchall():
            # Determine other user
            other_user_id = row['user2_id'] if row['user1_id'] == user_id else row['user1_id']
            other_user_email = row['user2_email'] if row['user1_id'] == user_id else row['user1_email']
            is_starred = row['user1_starred'] if row['user1_id'] == user_id else row['user2_starred']

            conversations.append({
                'id': row['id'],
                'listing_id': row['listing_id'],
                'other_user_id': other_user_id,
                'other_user_email': other_user_email,
                'last_message': row['last_message'],
                'last_message_time': row['last_message_time'],
                'unread_count': row['unread_count'] or 0,
                'is_starred': bool(is_starred),
                'listing': {
                    'id': row['listing_id'],
                    'make': row['make'],
                    'model': row['model'],
                    'year': row['year'],
                    'price': row['price'],
                    'image_url': row['listing_image_url']
                }
            })

        return conversations
    except Exception as e:
        logger.error(f"Error getting conversations: {e}")
        return []
    finally:
        conn.close()


def block_user(user_id: int, blocked_user_id: int) -> bool:
    """Block a user"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT OR IGNORE INTO blocked_users (user_id, blocked_user_id)
            VALUES (?, ?)
        """, (user_id, blocked_user_id))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Error blocking user: {e}")
        return False
    finally:
        conn.close()


def unblock_user(user_id: int, blocked_user_id: int) -> bool:
    """Unblock a user"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            DELETE FROM blocked_users
            WHERE user_id = ? AND blocked_user_id = ?
        """, (user_id, blocked_user_id))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Error unblocking user: {e}")
        return False
    finally:
        conn.close()


def report_message(message_id: int, reporter_id: int, reason: Optional[str] = None) -> bool:
    """Report an inappropriate message"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO reported_messages (message_id, reporter_id, reason)
            VALUES (?, ?, ?)
        """, (message_id, reporter_id, reason))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Error reporting message: {e}")
        return False
    finally:
        conn.close()


def delete_conversation(user_id: int, conversation_id: int) -> bool:
    """Delete a conversation (soft delete - only removes from user's view)"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE conversations
            SET user1_deleted = CASE WHEN user1_id = ? THEN 1 ELSE user1_deleted END,
                user2_deleted = CASE WHEN user2_id = ? THEN 1 ELSE user2_deleted END
            WHERE id = ?
        """, (user_id, user_id, conversation_id))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Error deleting conversation: {e}")
        return False
    finally:
        conn.close()


def star_conversation(user_id: int, conversation_id: int, starred: bool) -> bool:
    """Star/unstar a conversation"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            UPDATE conversations
            SET user1_starred = CASE WHEN user1_id = ? THEN ? ELSE user1_starred END,
                user2_starred = CASE WHEN user2_id = ? THEN ? ELSE user2_starred END
            WHERE id = ?
        """, (user_id, 1 if starred else 0, user_id, 1 if starred else 0, conversation_id))
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        logger.error(f"Error starring conversation: {e}")
        return False
    finally:
        conn.close()


def get_unread_count(user_id: int) -> int:
    """Get total unread message count for a user"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT SUM(CASE WHEN user1_id = ? THEN unread_count_user1 ELSE unread_count_user2 END) as total
            FROM conversations
            WHERE (user1_id = ? OR user2_id = ?)
              AND (CASE WHEN user1_id = ? THEN user1_deleted ELSE user2_deleted END) = 0
        """, (user_id, user_id, user_id, user_id))
        result = cursor.fetchone()
        return result['total'] or 0
    except Exception as e:
        logger.error(f"Error getting unread count: {e}")
        return 0
    finally:
        conn.close()


def set_typing_indicator(conversation_id: int, user_id: int, is_typing: bool):
    """Set typing indicator for a conversation"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO typing_indicators (conversation_id, user_id, is_typing, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(conversation_id, user_id) DO UPDATE SET
                is_typing = ?,
                updated_at = CURRENT_TIMESTAMP
        """, (conversation_id, user_id, 1 if is_typing else 0, 1 if is_typing else 0))
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error setting typing indicator: {e}")
    finally:
        conn.close()


def get_typing_indicator(conversation_id: int, user_id: int) -> bool:
    """Get typing indicator for a conversation"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT is_typing FROM typing_indicators
            WHERE conversation_id = ? AND user_id != ?
            ORDER BY updated_at DESC LIMIT 1
        """, (conversation_id, user_id))
        row = cursor.fetchone()
        if row:
            # Check if indicator is recent (within last 3 seconds)
            cursor.execute("""
                SELECT updated_at FROM typing_indicators
                WHERE conversation_id = ? AND user_id != ?
                ORDER BY updated_at DESC LIMIT 1
            """, (conversation_id, user_id))
            time_row = cursor.fetchone()
            if time_row:
                from datetime import datetime, timedelta
                updated_at = datetime.fromisoformat(time_row['updated_at'].replace('Z', '+00:00'))
                if datetime.now() - updated_at.replace(tzinfo=None) < timedelta(seconds=3):
                    return bool(row['is_typing'])
        return False
    except Exception as e:
        logger.error(f"Error getting typing indicator: {e}")
        return False
    finally:
        conn.close()


# Initialize database on import
init_messaging_db()
