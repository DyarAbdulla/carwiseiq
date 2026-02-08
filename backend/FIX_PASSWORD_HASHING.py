"""
Temporary fix script to test password hashing directly
This will help verify the fix is working
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

# Clear any cached imports
if 'app.services.auth_service' in sys.modules:
    del sys.modules['app.services.auth_service']
if 'app' in sys.modules:
    del sys.modules['app']
if 'app.services' in sys.modules:
    del sys.modules['app.services']

from app.services.auth_service import get_password_hash, create_user

print("=" * 70)
print("TESTING PASSWORD HASHING AFTER FIX")
print("=" * 70)

test_password = "Abc123@Abc"
test_email = "test_verification@example.com"

print(f"\nTest Password: {test_password}")
print(f"Byte Length: {len(test_password.encode('utf-8'))}")
print(f"Character Length: {len(test_password)}")

# Test hashing
print("\n" + "-" * 70)
print("Test 1: Password Hashing")
print("-" * 70)
try:
    hash_result = get_password_hash(test_password)
    print(f"SUCCESS! Hash: {hash_result[:60]}...")
except Exception as e:
    print(f"FAILED: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test user creation
print("\n" + "-" * 70)
print("Test 2: User Creation")
print("-" * 70)
try:
    # Delete test user if exists
    import sqlite3
    db_path = os.path.join(os.path.dirname(__file__), "users.db")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM users WHERE email = ?", (test_email,))
    conn.commit()
    conn.close()

    user, error = create_user(test_email, test_password)
    if user:
        print(f"SUCCESS! User created:")
        print(f"  ID: {user['id']}")
        print(f"  Email: {user['email']}")
    else:
        print(f"FAILED: {error}")
        sys.exit(1)
except Exception as e:
    print(f"FAILED: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 70)
print("ALL TESTS PASSED - CODE IS WORKING!")
print("=" * 70)
print("\nIf backend still shows error, the server needs to reload modules.")
print("Try: Stop backend (Ctrl+C), wait 3 seconds, start again.")
