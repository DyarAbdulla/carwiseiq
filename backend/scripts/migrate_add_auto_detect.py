"""
Migration script to add auto_detect and prefill columns to listings table
Run this once to update existing database schema
"""

import sqlite3
import os
from pathlib import Path

# Database path
DB_PATH = Path(__file__).parent.parent / "users.db"

def migrate():
    """Add auto_detect and prefill columns to listings table"""
    if not DB_PATH.exists():
        print(f"Database not found at {DB_PATH}")
        return
    
    conn = sqlite3.connect(str(DB_PATH))
    cursor = conn.cursor()
    
    try:
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(listings)")
        columns = [col[1] for col in cursor.fetchall()]
        
        if 'auto_detect' not in columns:
            print("Adding auto_detect column...")
            cursor.execute("ALTER TABLE listings ADD COLUMN auto_detect TEXT")
            print("[OK] Added auto_detect column")
        else:
            print("[WARN] auto_detect column already exists")
        
        if 'prefill' not in columns:
            print("Adding prefill column...")
            cursor.execute("ALTER TABLE listings ADD COLUMN prefill TEXT")
            print("[OK] Added prefill column")
        else:
            print("[WARN] prefill column already exists")
        
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
