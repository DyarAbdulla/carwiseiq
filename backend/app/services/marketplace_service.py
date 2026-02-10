"""
Marketplace service for Buy & Sell car listings
"""
import sqlite3
import os
import logging
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timedelta
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


def init_marketplace_db():
    """Initialize database with marketplace tables"""
    conn = get_db()
    cursor = conn.cursor()

    # Create listings table (make, model, year, color nullable for drafts)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            make TEXT,
            model TEXT,
            year INTEGER,
            trim TEXT,
            price REAL,
            mileage REAL,
            mileage_unit TEXT DEFAULT 'km',
            condition TEXT,
            transmission TEXT,
            fuel_type TEXT,
            color TEXT,
            features TEXT,  -- JSON array
            description TEXT,
            vin TEXT,
            location_country TEXT,
            location_state TEXT,
            location_city TEXT,
            location_coords TEXT,  -- JSON: {"lat": 0, "lng": 0}
            exact_address TEXT,
            phone TEXT,
            phone_country_code TEXT,
            show_phone_to_buyers_only BOOLEAN DEFAULT 1,
            preferred_contact_methods TEXT,  -- JSON array
            availability TEXT,
            status TEXT DEFAULT 'draft',  -- draft, active, sold, expired, deleted
            views_count INTEGER DEFAULT 0,
            contacts_count INTEGER DEFAULT 0,
            saves_count INTEGER DEFAULT 0,
            cover_image_id INTEGER,
            auto_detect TEXT,  -- JSON: {best: {...}, topk: {...}, meta: {...}, created_at: "..."}
            prefill TEXT,  -- JSON: {make: "...", model: "...", color: "...", year: ...}
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            expires_at TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    """)

    # Create listing_images table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS listing_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            listing_id INTEGER NOT NULL,
            url TEXT NOT NULL,
            file_path TEXT,
            is_primary BOOLEAN DEFAULT 0,
            display_order INTEGER DEFAULT 0,
            ai_features TEXT,  -- JSON: {"make": "Toyota", "model": "Camry", "confidence": 0.92}
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE
        )
    """)

    # Create saved_listings table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS saved_listings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            listing_id INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE CASCADE,
            UNIQUE(user_id, listing_id)
        )
    """)

    # Create search_history table (for saved searches)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS search_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            search_query TEXT,
            filters TEXT,  -- JSON object
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    """)

    # Create indexes for better query performance
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_listings_make_model ON listings(make, model)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_listings_year ON listings(year)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_listings_location_city ON listings(location_city)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_listings_status_created ON listings(status, created_at)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_listings_make_model_year ON listings(make, model, year)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_listing_images_listing_id ON listing_images(listing_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_saved_listings_user_id ON saved_listings(user_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_saved_listings_listing_id ON saved_listings(listing_id)
    """)

    conn.commit()
    conn.close()
    logger.info("Marketplace database initialized")


def create_draft_listing(listing_data: Dict, user_id: Optional[int] = None) -> int:
    """Create a draft listing (for multi-step flow) - allows missing required fields"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Set expiration date (90 days from now)
        expires_at = datetime.utcnow() + timedelta(days=90)

        # For draft listings, only insert fields that are provided (allow NULLs)
        cursor.execute("""
            INSERT INTO listings (
                user_id, make, model, year, trim, price, mileage, mileage_unit,
                condition, transmission, fuel_type, color, features, description, vin,
                location_country, location_state, location_city, location_coords, exact_address,
                phone, phone_country_code, show_phone_to_buyers_only,
                preferred_contact_methods, availability, status, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            listing_data.get('make'),  # Can be None for draft
            listing_data.get('model'),  # Can be None for draft
            int(listing_data.get('year')) if listing_data.get('year') else None,  # Can be None for draft
            listing_data.get('trim'),
            float(listing_data.get('price')) if listing_data.get('price') else None,  # Can be None for draft
            float(listing_data.get('mileage')) if listing_data.get('mileage') else None,  # Can be None for draft
            listing_data.get('mileage_unit', 'km'),
            listing_data.get('condition'),  # Can be None for draft
            listing_data.get('transmission'),  # Can be None for draft
            listing_data.get('fuel_type'),  # Can be None for draft
            listing_data.get('color'),  # Can be None for draft
            json.dumps(listing_data.get('features', [])) if listing_data.get('features') else None,
            listing_data.get('description'),
            listing_data.get('vin'),
            listing_data.get('location_country'),
            listing_data.get('location_state'),
            listing_data.get('location_city'),
            json.dumps(listing_data.get('location_coords')) if listing_data.get('location_coords') else None,
            listing_data.get('exact_address'),
            listing_data.get('phone'),
            listing_data.get('phone_country_code'),
            bool(listing_data.get('show_phone_to_buyers_only', True)),
            json.dumps(listing_data.get('preferred_contact_methods', [])) if listing_data.get('preferred_contact_methods') else None,
            listing_data.get('availability'),
            'draft',  # Always draft initially
            expires_at
        ))

        listing_id = cursor.lastrowid
        conn.commit()
        return listing_id
    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating draft listing: {e}")
        raise
    finally:
        conn.close()


def create_listing(listing_data: Dict, user_id: Optional[int] = None) -> int:
    """Create a new listing (validates required fields). Allows 0 for mileage and price."""
    required_fields = ['make', 'model', 'year', 'price', 'mileage', 'condition', 'transmission', 'fuel_type', 'color']
    for field in required_fields:
        val = listing_data.get(field)
        if val is None:
            raise ValueError(f"Required field '{field}' is missing")
        if field in ('mileage', 'price'):
            continue  # 0 is valid
        if val == '':
            raise ValueError(f"Required field '{field}' is missing")

    conn = get_db()
    cursor = conn.cursor()

    try:
        # Set expiration date (90 days from now)
        expires_at = datetime.utcnow() + timedelta(days=90)

        cursor.execute("""
            INSERT INTO listings (
                user_id, make, model, year, trim, price, mileage, mileage_unit,
                condition, transmission, fuel_type, color, features, description, vin,
                location_country, location_state, location_city, location_coords, exact_address,
                phone, phone_country_code, show_phone_to_buyers_only,
                preferred_contact_methods, availability, status, expires_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            listing_data.get('make'),
            listing_data.get('model'),
            int(listing_data.get('year')),
            listing_data.get('trim'),
            float(listing_data.get('price')),
            float(listing_data.get('mileage')),
            listing_data.get('mileage_unit', 'km'),
            listing_data.get('condition'),
            listing_data.get('transmission'),
            listing_data.get('fuel_type'),
            listing_data.get('color'),
            json.dumps(listing_data.get('features', [])) if listing_data.get('features') else None,
            listing_data.get('description'),
            listing_data.get('vin'),
            listing_data.get('location_country'),
            listing_data.get('location_state'),
            listing_data.get('location_city'),
            json.dumps(listing_data.get('location_coords')) if listing_data.get('location_coords') else None,
            listing_data.get('exact_address'),
            listing_data.get('phone'),
            listing_data.get('phone_country_code'),
            bool(listing_data.get('show_phone_to_buyers_only', True)),
            json.dumps(listing_data.get('preferred_contact_methods', [])) if listing_data.get('preferred_contact_methods') else None,
            listing_data.get('availability'),
            listing_data.get('status', 'draft'),
            expires_at
        ))

        listing_id = cursor.lastrowid
        conn.commit()
        return listing_id
    except Exception as e:
        conn.rollback()
        logger.error(f"Error creating listing: {e}")
        raise
    finally:
        conn.close()


def add_listing_images(listing_id: int, images: List[Dict]) -> List[int]:
    """Add images to a listing"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        image_ids = []
        for idx, image in enumerate(images):
            cursor.execute("""
                INSERT INTO listing_images (
                    listing_id, url, file_path, is_primary, display_order, ai_features
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                listing_id,
                image.get('url'),
                image.get('file_path'),
                1 if idx == 0 else 0,  # First image is primary
                idx,
                json.dumps(image.get('ai_features')) if image.get('ai_features') else None
            ))
            image_ids.append(cursor.lastrowid)

        # Update listing cover_image_id
        if image_ids:
            cursor.execute("""
                UPDATE listings SET cover_image_id = ? WHERE id = ?
            """, (image_ids[0], listing_id))

        conn.commit()
        return image_ids
    except Exception as e:
        conn.rollback()
        logger.error(f"Error adding listing images: {e}")
        raise
    finally:
        conn.close()


def delete_listing_images(listing_id: int) -> None:
    """Remove all images for a listing (e.g. before replacing with new set)."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM listing_images WHERE listing_id = ?", (listing_id,))
        cursor.execute("UPDATE listings SET cover_image_id = NULL WHERE id = ?", (listing_id,))
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error(f"Error deleting listing images: {e}")
        raise
    finally:
        conn.close()


def delete_listing_image(listing_id: int, image_id: int) -> bool:
    """Remove one image from a listing. Returns True if deleted."""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "DELETE FROM listing_images WHERE id = ? AND listing_id = ?",
            (image_id, listing_id)
        )
        if cursor.rowcount:
            cursor.execute(
                "UPDATE listings SET cover_image_id = NULL WHERE id = ? AND cover_image_id = ?",
                (listing_id, image_id)
            )
            conn.commit()
            return True
        conn.commit()
        return False
    except Exception as e:
        conn.rollback()
        logger.error(f"Error deleting listing image: {e}")
        raise
    finally:
        conn.close()


def get_listing(listing_id: int) -> Optional[Dict]:
    """Get a listing by ID"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            SELECT * FROM listings WHERE id = ?
        """, (listing_id,))
        row = cursor.fetchone()

        if not row:
            return None

        listing = dict(row)

        # Get images
        cursor.execute("""
            SELECT * FROM listing_images 
            WHERE listing_id = ? 
            ORDER BY display_order ASC
        """, (listing_id,))
        images = [dict(img) for img in cursor.fetchall()]

        listing['images'] = images
        listing['cover_image'] = images[0]['url'] if images else None

        # Parse JSON fields
        if listing.get('features'):
            try:
                listing['features'] = json.loads(listing['features'])
            except:
                listing['features'] = []
        else:
            listing['features'] = []

        if listing.get('location_coords'):
            try:
                listing['location_coords'] = json.loads(listing['location_coords'])
            except:
                listing['location_coords'] = None

        if listing.get('preferred_contact_methods'):
            try:
                listing['preferred_contact_methods'] = json.loads(listing['preferred_contact_methods'])
            except:
                listing['preferred_contact_methods'] = []
        else:
            listing['preferred_contact_methods'] = []
        
        # Parse auto_detect and prefill JSON fields
        if listing.get('auto_detect'):
            try:
                listing['auto_detect'] = json.loads(listing['auto_detect'])
            except:
                listing['auto_detect'] = None
        else:
            listing['auto_detect'] = None
        
        if listing.get('prefill'):
            try:
                listing['prefill'] = json.loads(listing['prefill'])
            except:
                listing['prefill'] = None
        else:
            listing['prefill'] = None

        return listing
    except Exception as e:
        logger.error(f"Error getting listing: {e}")
        return None
    finally:
        conn.close()


def update_listing_auto_detect_user_overrides(listing_id: int, selected_by_user: Dict[str, str], user_overrode: bool = True):
    """Update user override tracking in auto_detect field"""
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        # Get current auto_detect
        cursor.execute("SELECT auto_detect FROM listings WHERE id = ?", (listing_id,))
        row = cursor.fetchone()
        
        if not row or not row['auto_detect']:
            logger.warning(f"No auto_detect data found for listing {listing_id}")
            return
        
        auto_detect = json.loads(row['auto_detect'])
        auto_detect['selected_by_user'] = selected_by_user
        auto_detect['user_overrode'] = user_overrode
        
        # Update
        cursor.execute("""
            UPDATE listings 
            SET auto_detect = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        """, (json.dumps(auto_detect), listing_id))
        
        conn.commit()
        logger.info(f"Updated user overrides for listing {listing_id}")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error updating user overrides: {e}")
        raise
    finally:
        conn.close()


def search_listings(
    filters: Dict,
    page: int = 1,
    page_size: int = 15,
    sort_by: str = 'newest'
) -> Tuple[List[Dict], int]:
    """Search listings with filters"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        where_clauses = ["status = 'active'"]
        params = []

        # Price filter
        if filters.get('min_price'):
            where_clauses.append("price >= ?")
            params.append(filters['min_price'])
        if filters.get('max_price'):
            where_clauses.append("price <= ?")
            params.append(filters['max_price'])

        # Make filter
        if filters.get('makes'):
            makes = filters['makes']
            if isinstance(makes, str):
                makes = [makes]
            placeholders = ','.join(['?'] * len(makes))
            where_clauses.append(f"make IN ({placeholders})")
            params.extend(makes)

        # Model filter
        if filters.get('models'):
            models = filters['models']
            if isinstance(models, str):
                models = [models]
            placeholders = ','.join(['?'] * len(models))
            where_clauses.append(f"model IN ({placeholders})")
            params.extend(models)

        # Year filter
        if filters.get('min_year'):
            where_clauses.append("year >= ?")
            params.append(filters['min_year'])
        if filters.get('max_year'):
            where_clauses.append("year <= ?")
            params.append(filters['max_year'])

        # Mileage filter
        if filters.get('max_mileage'):
            where_clauses.append("mileage <= ?")
            params.append(filters['max_mileage'])

        # Condition filter
        if filters.get('conditions'):
            conditions = filters['conditions']
            if isinstance(conditions, str):
                conditions = [conditions]
            placeholders = ','.join(['?'] * len(conditions))
            where_clauses.append(f"condition IN ({placeholders})")
            params.extend(conditions)

        # Transmission filter
        if filters.get('transmissions'):
            transmissions = filters['transmissions']
            if isinstance(transmissions, str):
                transmissions = [transmissions]
            placeholders = ','.join(['?'] * len(transmissions))
            where_clauses.append(f"transmission IN ({placeholders})")
            params.extend(transmissions)

        # Fuel type filter
        if filters.get('fuel_types'):
            fuel_types = filters['fuel_types']
            if isinstance(fuel_types, str):
                fuel_types = [fuel_types]
            placeholders = ','.join(['?'] * len(fuel_types))
            where_clauses.append(f"fuel_type IN ({placeholders})")
            params.extend(fuel_types)

        # Location filter (simple city/state match for now)
        if filters.get('location_city'):
            where_clauses.append("location_city LIKE ?")
            params.append(f"%{filters['location_city']}%")

        # Search query
        if filters.get('search'):
            search_term = f"%{filters['search']}%"
            where_clauses.append("""
                (make LIKE ? OR model LIKE ? OR description LIKE ?)
            """)
            params.extend([search_term, search_term, search_term])

        where_sql = " AND ".join(where_clauses)

        # Get total count
        cursor.execute(f"SELECT COUNT(*) as total FROM listings WHERE {where_sql}", params)
        total = cursor.fetchone()["total"]

        # Sort order
        order_by = "created_at DESC"
        if sort_by == 'price_low':
            order_by = "price ASC"
        elif sort_by == 'price_high':
            order_by = "price DESC"
        elif sort_by == 'newest':
            order_by = "created_at DESC"

        # Get paginated results
        offset = (page - 1) * page_size
        cursor.execute(f"""
            SELECT l.*, 
                   (SELECT url FROM listing_images WHERE listing_id = l.id ORDER BY is_primary DESC, display_order ASC LIMIT 1) as cover_image
            FROM listings l
            WHERE {where_sql}
            ORDER BY {order_by}
            LIMIT ? OFFSET ?
        """, params + [page_size, offset])

        rows = cursor.fetchall()
        listings = [dict(row) for row in rows]

        # Batch-fetch images for this page and attach images[] to each listing
        if listings:
            ids = [l['id'] for l in listings]
            ph = ','.join(['?'] * len(ids))
            cursor.execute(
                f"SELECT listing_id, url, display_order FROM listing_images WHERE listing_id IN ({ph}) ORDER BY listing_id, display_order",
                ids
            )
            img_rows = cursor.fetchall()
            by_lid = {}
            for r in img_rows:
                lid = r['listing_id']
                if lid not in by_lid:
                    by_lid[lid] = []
                by_lid[lid].append({'url': r['url']})
            for lst in listings:
                lst['images'] = by_lid.get(lst['id'], [])

        # Parse JSON fields for each listing
        for listing in listings:
            if listing.get('features'):
                try:
                    listing['features'] = json.loads(listing['features'])
                except:
                    listing['features'] = []

        return listings, total
    except Exception as e:
        logger.error(f"Error searching listings: {e}", exc_info=True)
        return [], 0
    finally:
        conn.close()


def increment_listing_views(listing_id: int):
    """Increment view count for a listing"""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE listings SET views_count = views_count + 1 WHERE id = ?
        """, (listing_id,))
        conn.commit()
    except Exception as e:
        logger.error(f"Error incrementing views: {e}")
    finally:
        conn.close()


def save_listing(user_id: int, listing_id: int) -> bool:
    """Save a listing to user's favorites"""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT OR IGNORE INTO saved_listings (user_id, listing_id) VALUES (?, ?)
        """, (user_id, listing_id))
        cursor.execute("""
            UPDATE listings SET saves_count = saves_count + 1 WHERE id = ?
        """, (listing_id,))
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Error saving listing: {e}")
        return False
    finally:
        conn.close()


def unsave_listing(user_id: int, listing_id: int) -> bool:
    """Remove a listing from user's favorites"""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            DELETE FROM saved_listings WHERE user_id = ? AND listing_id = ?
        """, (user_id, listing_id))
        cursor.execute("""
            UPDATE listings SET saves_count = CASE WHEN saves_count > 0 THEN saves_count - 1 ELSE 0 END WHERE id = ?
        """, (listing_id,))
        conn.commit()
        return True
    except Exception as e:
        logger.error(f"Error unsaving listing: {e}")
        return False
    finally:
        conn.close()


def is_listing_saved(user_id: int, listing_id: int) -> bool:
    """Check if listing is saved by user"""
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            SELECT COUNT(*) as count FROM saved_listings 
            WHERE user_id = ? AND listing_id = ?
        """, (user_id, listing_id))
        return cursor.fetchone()["count"] > 0
    except Exception as e:
        logger.error(f"Error checking saved listing: {e}")
        return False
    finally:
        conn.close()


# Initialize database on import
init_marketplace_db()
