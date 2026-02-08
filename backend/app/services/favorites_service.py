"""
Favorites and saved searches service
"""
import sqlite3
import os
import logging
import json
from typing import Optional, Dict, List, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

# Database path (same as auth service)
DB_PATH = os.path.join(os.path.dirname(
    os.path.dirname(os.path.dirname(__file__))), "users.db")


def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_favorites_db():
    """Initialize database with favorites and saved searches tables"""
    conn = get_db()
    cursor = conn.cursor()

    # Create favorites table (if not exists - already exists from marketplace_service)
    # listing_id is TEXT to support both numeric IDs (REST API) and UUIDs (Supabase)
    # supabase_user_id stores Supabase UUIDs (since REST API user_id=0 for Supabase users)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS favorites (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            supabase_user_id TEXT,
            listing_id TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, listing_id),
            UNIQUE(supabase_user_id, listing_id)
        )
    """)
    
    # Add supabase_user_id column if it doesn't exist (migration)
    try:
        cursor.execute("PRAGMA table_info(favorites)")
        columns = cursor.fetchall()
        column_names = [col[1] for col in columns]
        
        if 'supabase_user_id' not in column_names:
            logger.info("Adding supabase_user_id column to favorites table")
            cursor.execute("""
                ALTER TABLE favorites ADD COLUMN supabase_user_id TEXT
            """)
            # Drop old unique constraint and add new ones
            try:
                cursor.execute("DROP INDEX IF EXISTS idx_favorites_user_listing")
            except:
                pass
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_rest_user_listing 
                ON favorites(user_id, listing_id) WHERE user_id IS NOT NULL
            """)
            cursor.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_favorites_supabase_user_listing 
                ON favorites(supabase_user_id, listing_id) WHERE supabase_user_id IS NOT NULL
            """)
            conn.commit()
            logger.info("Migration: Added supabase_user_id column successfully")
    except Exception as e:
        logger.warning(f"Migration check for supabase_user_id failed: {e}")
        conn.rollback()
    
    # Migrate existing INTEGER listing_id to TEXT if needed
    try:
        cursor.execute("PRAGMA table_info(favorites)")
        columns = cursor.fetchall()
        column_info = {col[1]: col[2] for col in columns}
        
        # If listing_id is INTEGER, migrate to TEXT
        if 'listing_id' in column_info and column_info['listing_id'] == 'INTEGER':
            logger.info("Migrating favorites.listing_id from INTEGER to TEXT for UUID support")
            # SQLite doesn't support ALTER COLUMN, so we need to recreate the table
            cursor.execute("""
                CREATE TABLE favorites_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    listing_id TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, listing_id)
                )
            """)
            cursor.execute("""
                INSERT INTO favorites_new (id, user_id, listing_id, created_at)
                SELECT id, user_id, CAST(listing_id AS TEXT), created_at
                FROM favorites
            """)
            cursor.execute("DROP TABLE favorites")
            cursor.execute("ALTER TABLE favorites_new RENAME TO favorites")
            conn.commit()
            logger.info("Migration completed successfully")
    except Exception as e:
        logger.warning(f"Migration check failed (may already be migrated): {e}")

    # Create saved_searches table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saved_searches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            filters TEXT NOT NULL,  -- JSON object
            email_alerts BOOLEAN DEFAULT 1,
            frequency TEXT DEFAULT 'instant',  -- instant, daily, weekly
            last_notified_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Create price_history table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS price_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER NOT NULL,
            price REAL NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
        )
    """)

    # Create notification_settings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS notification_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            email_new_matches BOOLEAN DEFAULT 1,
            email_price_drops BOOLEAN DEFAULT 1,
            push_notifications BOOLEAN DEFAULT 0,
            frequency TEXT DEFAULT 'instant',  -- instant, daily, weekly
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    """)

    # Create indexes
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_favorites_listing_id ON favorites(listing_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_price_history_listing_id ON price_history(listing_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_price_history_timestamp ON price_history(timestamp)
    """)

    conn.commit()
    conn.close()
    logger.info("Favorites database initialized")


def toggle_favorite(user_id: Optional[int], listing_id: int | str, supabase_user_id: Optional[str] = None) -> Tuple[bool, bool]:
    """
    Toggle favorite status for a listing
    Supports both numeric IDs (REST API) and UUID strings (Supabase)
    For Supabase users: user_id=None, supabase_user_id=UUID or email
    Returns: (is_favorite, was_added)
    """
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Convert listing_id to string for consistent storage
        listing_id_str = str(listing_id)
        
        logger.debug(f"toggle_favorite called - user_id: {user_id}, supabase_user_id: {supabase_user_id}, listing_id: {listing_id_str}")
        
        # Check if already favorited (check both user_id and supabase_user_id)
        if supabase_user_id:
            cursor.execute("""
                SELECT id FROM favorites
                WHERE supabase_user_id = ? AND listing_id = ?
            """, (supabase_user_id, listing_id_str))
        else:
            cursor.execute("""
                SELECT id FROM favorites
                WHERE user_id = ? AND listing_id = ?
            """, (user_id, listing_id_str))
        existing = cursor.fetchone()

        if existing:
            # Remove from favorites
            logger.debug(f"Removing favorite (existing ID: {existing[0]})")
            if supabase_user_id:
                cursor.execute("""
                    DELETE FROM favorites
                    WHERE supabase_user_id = ? AND listing_id = ?
                """, (supabase_user_id, listing_id_str))
            else:
                cursor.execute("""
                    DELETE FROM favorites
                    WHERE user_id = ? AND listing_id = ?
                """, (user_id, listing_id_str))
            conn.commit()
            logger.info(f"Favorite removed successfully")
            return False, False
        else:
            # Add to favorites
            logger.debug(f"Adding new favorite")
            cursor.execute("""
                INSERT INTO favorites (user_id, supabase_user_id, listing_id)
                VALUES (?, ?, ?)
            """, (user_id, supabase_user_id, listing_id_str))
            conn.commit()
            logger.info(f"Favorite added successfully - user_id: {user_id}, supabase_user_id: {supabase_user_id}, listing_id: {listing_id_str}")
            return True, True
    except Exception as e:
        conn.rollback()
        logger.error(f"Error toggling favorite: {e}", exc_info=True)
        raise
    finally:
        conn.close()


def is_favorite(user_id: Optional[int], listing_id: int | str, supabase_user_id: Optional[str] = None) -> bool:
    """Check if listing is favorited by user
    Supports both numeric IDs (REST API) and UUID strings (Supabase)
    For Supabase users: user_id=None, supabase_user_id=UUID or email
    """
    if not user_id and not supabase_user_id:
        return False
    
    # Convert listing_id to string for consistent comparison
    listing_id_str = str(listing_id)
    
    conn = get_db()
    cursor = conn.cursor()

    try:
        if supabase_user_id:
            cursor.execute("""
                SELECT COUNT(*) as count FROM favorites
                WHERE supabase_user_id = ? AND listing_id = ?
            """, (supabase_user_id, listing_id_str))
        else:
            cursor.execute("""
                SELECT COUNT(*) as count FROM favorites
                WHERE user_id = ? AND listing_id = ?
            """, (user_id, listing_id_str))
        return cursor.fetchone()['count'] > 0
    except Exception as e:
        logger.error(f"Error checking favorite: {e}")
        return False
    finally:
        conn.close()


def get_favorites(user_id: Optional[int], page: int = 1, page_size: int = 15, sort_by: str = 'recently_saved', supabase_user_id: Optional[str] = None) -> Tuple[List[Dict], int]:
    """Get user's favorite listings
    Supports both REST API users (user_id) and Supabase users (supabase_user_id)
    """
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Build WHERE clause based on user type
        if supabase_user_id:
            where_clause = "WHERE f.supabase_user_id = ?"
            user_param = supabase_user_id
        else:
            where_clause = "WHERE f.user_id = ?"
            user_param = user_id
        
        # Get total count
        cursor.execute(f"""
            SELECT COUNT(*) as total FROM favorites f
            {where_clause}
        """, (user_param,))
        total = cursor.fetchone()['total']
        
        logger.info(f"get_favorites - user_id: {user_id}, supabase_user_id: {supabase_user_id}, total: {total}")

        # Get paginated results
        # Note: For Supabase listings (UUID), we can't JOIN with listings table
        # So we need to handle both cases
        offset = (page - 1) * page_size
        
        if supabase_user_id:
            # For Supabase users, listing_id is UUID - fetch directly from Supabase
            # First, get all favorite IDs with saved_at timestamp
            cursor.execute(f"""
                SELECT f.listing_id, f.created_at as saved_at
                FROM favorites f
                {where_clause}
                ORDER BY f.created_at DESC
            """, (user_param,))
            
            favorite_rows = cursor.fetchall()
            logger.info(f"Found {len(favorite_rows)} favorites for Supabase user")
            
            # Fetch listing details from Supabase for each UUID
            listings = []
            import httpx
            import os
            supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
            
            if not supabase_url or not supabase_key:
                logger.error("Supabase credentials not configured for fetching favorites")
                return [], total
            
            api_url = f"{supabase_url}/rest/v1/car_listings"
            headers = {
                "apikey": supabase_key,
                "Authorization": f"Bearer {supabase_key}",
                "Content-Type": "application/json",
            }
            
            for row in favorite_rows:
                listing_id = row['listing_id']
                saved_at = row['saved_at']
                
                # Try to fetch from Supabase
                try:
                    response = httpx.get(
                        f"{api_url}?id=eq.{listing_id}&select=*",
                        headers=headers,
                        timeout=10
                    )
                    if response.status_code == 200:
                        data = response.json()
                        if data and len(data) > 0:
                            listing = data[0]
                            listing['saved_at'] = saved_at
                            listing['fromSupabase'] = True
                            
                            # Normalize images (same as marketplace.py)
                            if isinstance(listing.get('images'), list):
                                listing['images'] = [
                                    {'url': img if isinstance(img, str) else img.get('url', '')} 
                                    for img in listing['images']
                                ]
                            elif listing.get('images'):
                                listing['images'] = [{'url': str(listing['images'])}]
                            else:
                                listing['images'] = []
                            
                            # Set cover_image
                            if listing.get('cover_image'):
                                listing['cover_image'] = listing['cover_image']
                            elif listing.get('images') and len(listing['images']) > 0:
                                listing['cover_image'] = listing['images'][0]['url']
                            else:
                                listing['cover_image'] = None
                            
                            # Ensure required fields exist
                            listing.setdefault('make', 'Unknown')
                            listing.setdefault('model', 'Unknown')
                            listing.setdefault('price', 0)
                            listing.setdefault('year', None)
                            
                            listings.append(listing)
                            logger.debug(f"Fetched Supabase listing {listing_id}: {listing.get('make')} {listing.get('model')}")
                        else:
                            logger.warning(f"Supabase listing {listing_id} not found")
                    else:
                        logger.warning(f"Failed to fetch Supabase listing {listing_id}: HTTP {response.status_code}")
                except Exception as e:
                    logger.error(f"Error fetching Supabase listing {listing_id}: {e}", exc_info=True)
            
            # Apply sorting after fetching (since we can't sort in SQL for Supabase listings)
            if sort_by == 'price_low':
                listings.sort(key=lambda x: x.get('price', 0) or 0)
            elif sort_by == 'price_high':
                listings.sort(key=lambda x: x.get('price', 0) or 0, reverse=True)
            elif sort_by == 'newest_listings':
                listings.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            elif sort_by == 'recently_saved':
                listings.sort(key=lambda x: x.get('saved_at', ''), reverse=True)
            
            # Apply pagination after sorting
            listings = listings[offset:offset + page_size]
            logger.info(f"Returning {len(listings)} Supabase listings after sorting and pagination")
            
        else:
            # REST API users - JOIN with listings table
            # Sort order for SQL query
            order_by = "f.created_at DESC"
            if sort_by == 'price_low':
                order_by = "l.price ASC"
            elif sort_by == 'price_high':
                order_by = "l.price DESC"
            elif sort_by == 'newest_listings':
                order_by = "l.created_at DESC"
            elif sort_by == 'recently_saved':
                order_by = "f.created_at DESC"
            
            cursor.execute(f"""
                SELECT l.*, f.created_at as saved_at,
                       (SELECT url FROM listing_images WHERE listing_id = l.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) as cover_image
                FROM favorites f
                JOIN listings l ON CAST(f.listing_id AS TEXT) = CAST(l.id AS TEXT)
                {where_clause} AND l.status = 'active'
                ORDER BY {order_by}
                LIMIT ? OFFSET ?
            """, (user_param, page_size, offset))

            listings = []
            for row in cursor.fetchall():
                listing = dict(row)
                # Parse JSON fields
                if listing.get('features'):
                    try:
                        listing['features'] = json.loads(listing['features'])
                    except:
                        listing['features'] = []
                listing['fromSupabase'] = False
                listings.append(listing)
            
            logger.info(f"Returning {len(listings)} REST API listings")

        return listings, total
    except Exception as e:
        logger.error(f"Error getting favorites: {e}", exc_info=True)
        return [], 0
    finally:
        conn.close()


def save_search(user_id: int, name: str, filters: Dict, email_alerts: bool = True, frequency: str = 'instant') -> int:
    """Save a search"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO saved_searches (user_id, name, filters, email_alerts, frequency)
            VALUES (?, ?, ?, ?, ?)
        """, (user_id, name, json.dumps(filters), email_alerts, frequency))
        search_id = cursor.lastrowid
        conn.commit()
        return search_id
    except Exception as e:
        conn.rollback()
        logger.error(f"Error saving search: {e}")
        raise
    finally:
        conn.close()


def get_saved_searches(user_id: int) -> List[Dict]:
    """Get user's saved searches"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT * FROM saved_searches
            WHERE user_id = ?
            ORDER BY created_at DESC
        """, (user_id,))

        searches = []
        for row in cursor.fetchall():
            search = dict(row)
            try:
                search['filters'] = json.loads(search['filters'])
            except:
                search['filters'] = {}
            searches.append(search)

        return searches
    except Exception as e:
        logger.error(f"Error getting saved searches: {e}")
        return []
    finally:
        conn.close()


def delete_saved_search(user_id: int, search_id: int) -> bool:
    """Delete a saved search"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            DELETE FROM saved_searches
            WHERE id = ? AND user_id = ?
        """, (search_id, user_id))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.error(f"Error deleting saved search: {e}")
        return False
    finally:
        conn.close()


def update_saved_search(user_id: int, search_id: int, name: Optional[str] = None, 
                        email_alerts: Optional[bool] = None, frequency: Optional[str] = None) -> bool:
    """Update a saved search"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        updates = []
        params = []
        
        if name is not None:
            updates.append("name = ?")
            params.append(name)
        if email_alerts is not None:
            updates.append("email_alerts = ?")
            params.append(email_alerts)
        if frequency is not None:
            updates.append("frequency = ?")
            params.append(frequency)
        
        if not updates:
            return False
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.extend([search_id, user_id])
        
        cursor.execute(f"""
            UPDATE saved_searches
            SET {', '.join(updates)}
            WHERE id = ? AND user_id = ?
        """, params)
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.error(f"Error updating saved search: {e}")
        return False
    finally:
        conn.close()


def record_price_change(listing_id: int, price: float):
    """Record a price change in history"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Get last recorded price
        cursor.execute("""
            SELECT price FROM price_history
            WHERE listing_id = ?
            ORDER BY timestamp DESC
            LIMIT 1
        """, (listing_id,))
        last_price = cursor.fetchone()

        # Only record if price changed
        if not last_price or last_price['price'] != price:
            cursor.execute("""
                INSERT INTO price_history (listing_id, price)
                VALUES (?, ?)
            """, (listing_id, price))
            conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error recording price change: {e}")
    finally:
        conn.close()


def get_price_history(listing_id: int, days: int = 30) -> List[Dict]:
    """Get price history for a listing"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT price, timestamp
            FROM price_history
            WHERE listing_id = ?
              AND timestamp >= datetime('now', '-' || ? || ' days')
            ORDER BY timestamp ASC
        """, (listing_id, days))

        history = []
        for row in cursor.fetchall():
            history.append({
                'price': row['price'],
                'timestamp': row['timestamp']
            })
        return history
    except Exception as e:
        logger.error(f"Error getting price history: {e}")
        return []
    finally:
        conn.close()


def get_notification_settings(user_id: int) -> Optional[Dict]:
    """Get user's notification settings"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT * FROM notification_settings
            WHERE user_id = ?
        """, (user_id,))
        row = cursor.fetchone()
        
        if row:
            return dict(row)
        
        # Create default settings
        cursor.execute("""
            INSERT INTO notification_settings (user_id)
            VALUES (?)
        """, (user_id,))
        conn.commit()
        
        cursor.execute("""
            SELECT * FROM notification_settings
            WHERE user_id = ?
        """, (user_id,))
        return dict(cursor.fetchone())
    except Exception as e:
        logger.error(f"Error getting notification settings: {e}")
        return None
    finally:
        conn.close()


def update_notification_settings(user_id: int, **kwargs) -> bool:
    """Update notification settings"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        updates = []
        params = []
        
        for key, value in kwargs.items():
            if value is not None:
                updates.append(f"{key} = ?")
                params.append(value)
        
        if not updates:
            return False
        
        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(user_id)
        
        cursor.execute(f"""
            UPDATE notification_settings
            SET {', '.join(updates)}
            WHERE user_id = ?
        """, params)
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        conn.rollback()
        logger.error(f"Error updating notification settings: {e}")
        return False
    finally:
        conn.close()


def get_favorites_count_for_listing(listing_id: int | str) -> int:
    """Get number of users who favorited a listing
    Supports both numeric IDs (REST API) and UUID strings (Supabase)
    """
    conn = get_db()
    cursor = conn.cursor()

    try:
        listing_id_str = str(listing_id)
        cursor.execute("""
            SELECT COUNT(*) as count FROM favorites
            WHERE listing_id = ?
        """, (listing_id_str,))
        return cursor.fetchone()['count']
    except Exception as e:
        logger.error(f"Error getting favorites count: {e}")
        return 0
    finally:
        conn.close()


# Initialize database on import
init_favorites_db()
