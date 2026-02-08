"""Test registration with password hashing"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.services.auth_service import get_password_hash, create_user

# Test password
test_password = "Abc123@Abc"
test_email = "test@example.com"

print("=" * 60)
print("Testing Password Hashing")
print("=" * 60)

# Test 1: Check password byte length
password_bytes = test_password.encode('utf-8')
print(f"\n1. Password: {test_password}")
print(f"   Character length: {len(test_password)}")
print(f"   Byte length: {len(password_bytes)}")
print(f"   Is >72 bytes? {len(password_bytes) > 72}")

# Test 2: Try to hash the password
print(f"\n2. Testing password hash...")
try:
    hash_result = get_password_hash(test_password)
    print(f"   SUCCESS! Hash generated:")
    print(f"   {hash_result[:60]}...")
except Exception as e:
    print(f"   ERROR: {e}")
    print(f"   Error type: {type(e).__name__}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test 3: Try to create a user
print(f"\n3. Testing user creation...")
try:
    # Use a unique email for testing
    import time
    unique_email = f"test_{int(time.time())}@example.com"
    user, error = create_user(unique_email, test_password)
    if user:
        print(f"   SUCCESS! User created:")
        print(f"   ID: {user['id']}")
        print(f"   Email: {user['email']}")
    else:
        print(f"   ERROR: {error}")
        sys.exit(1)
except Exception as e:
    print(f"   EXCEPTION: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("ALL TESTS PASSED!")
print("=" * 60)
