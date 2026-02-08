"""Check and verify database is working correctly"""
import os
import sqlite3

db_path = os.path.join(os.path.dirname(__file__), "users.db")

print("=" * 70)
print("DATABASE CHECK")
print("=" * 70)

# Check if database exists
print(f"\n1. Database file exists: {os.path.exists(db_path)}")
if os.path.exists(db_path):
    file_size = os.path.getsize(db_path)
    print(f"   File size: {file_size} bytes")
    print(f"   Full path: {os.path.abspath(db_path)}")

# Try to connect
print(f"\n2. Database connection test...")
try:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    print("   SUCCESS: Connected to database")

    # Check users table
    print(f"\n3. Checking users table...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    table_exists = cursor.fetchone()
    if table_exists:
        print("   SUCCESS: Users table exists")

        # Get table info
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        print(f"   Columns: {', '.join([col[1] for col in columns])}")

        # Count users
        cursor.execute("SELECT COUNT(*) as count FROM users")
        count = cursor.fetchone()[0]
        print(f"   Total users: {count}")

        # Show sample users (if any)
        if count > 0:
            cursor.execute("SELECT id, email, created_at FROM users LIMIT 5")
            users = cursor.fetchall()
            print(f"\n   Sample users:")
            for user in users:
                print(f"     - ID: {user['id']}, Email: {user['email']}, Created: {user['created_at']}")
    else:
        print("   WARNING: Users table does not exist!")
        print("   Running database initialization...")
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        print("   SUCCESS: Users table created!")

    conn.close()
    print("\n" + "=" * 70)
    print("DATABASE STATUS: OK")
    print("=" * 70)

except Exception as e:
    print(f"   ERROR: {e}")
    import traceback
    traceback.print_exc()
    print("\n" + "=" * 70)
    print("DATABASE STATUS: ERROR")
    print("=" * 70)
