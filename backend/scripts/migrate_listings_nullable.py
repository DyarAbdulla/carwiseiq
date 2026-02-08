"""
Migration script to make make, model, year, and color nullable in listings table
Allows draft listings to be created without these fields
"""

import sqlite3
import os
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent.parent / "users.db"

def migrate():
    """Make make, model, year, color nullable in listings table"""
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        return
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    try:
        # Check current schema
        cursor.execute("PRAGMA table_info(listings)")
        columns = {col[1]: col for col in cursor.fetchall()}
        
        # Check if migration already done
        if columns.get('make') and columns['make'][3] == 0:  # 3 = notnull flag (0 = nullable)
            print("[INFO] Columns already nullable, migration not needed")
            return
        
        print("Starting migration: Making make/model/year/color nullable...")
        
        # Step 1: Create new table with nullable columns
        print("Creating new table structure...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS listings_new (
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
                features TEXT,
                description TEXT,
                vin TEXT,
                location_country TEXT,
                location_state TEXT,
                location_city TEXT,
                location_coords TEXT,
                exact_address TEXT,
                phone TEXT,
                phone_country_code TEXT,
                show_phone_to_buyers_only BOOLEAN DEFAULT 1,
                preferred_contact_methods TEXT,
                availability TEXT,
                status TEXT DEFAULT 'draft',
                views_count INTEGER DEFAULT 0,
                contacts_count INTEGER DEFAULT 0,
                saves_count INTEGER DEFAULT 0,
                cover_image_id INTEGER,
                auto_detect TEXT,
                prefill TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
            )
        """)
        
        # Step 2: Copy data from old table
        print("Copying data from old table...")
        cursor.execute("""
            INSERT INTO listings_new (
                id, user_id, make, model, year, trim, price, mileage, mileage_unit,
                condition, transmission, fuel_type, color, features, description, vin,
                location_country, location_state, location_city, location_coords, exact_address,
                phone, phone_country_code, show_phone_to_buyers_only,
                preferred_contact_methods, availability, status,
                views_count, contacts_count, saves_count, cover_image_id,
                auto_detect, prefill, created_at, updated_at, expires_at
            )
            SELECT 
                id, user_id, make, model, year, trim, price, mileage, mileage_unit,
                condition, transmission, fuel_type, color, features, description, vin,
                location_country, location_state, location_city, location_coords, exact_address,
                phone, phone_country_code, show_phone_to_buyers_only,
                preferred_contact_methods, availability, status,
                views_count, contacts_count, saves_count, cover_image_id,
                auto_detect, prefill, created_at, updated_at, expires_at
            FROM listings
        """)
        
        # Step 3: Drop old table
        print("Dropping old table...")
        cursor.execute("DROP TABLE listings")
        
        # Step 4: Rename new table
        print("Renaming new table...")
        cursor.execute("ALTER TABLE listings_new RENAME TO listings")
        
        # Step 5: Recreate indexes
        print("Recreating indexes...")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_listings_user_id ON listings(user_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_listings_make_model ON listings(make, model)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(price)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_listings_created_at ON listings(created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_listings_year ON listings(year)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_listings_location_city ON listings(location_city)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_listings_status_created ON listings(status, created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_listings_make_model_year ON listings(make, model, year)")
        
        conn.commit()
        print("[OK] Migration completed successfully")
        
    except Exception as e:
        conn.rollback()
        print(f"[ERROR] Migration failed: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate()
