#!/usr/bin/env python3
"""
Generate a secure random SECRET_KEY for JWT (minimum 256-bit / 32 chars).
Usage: python scripts/generate_secret.py
Add output to .env as SECRET_KEY=...
"""
import secrets

def main():
    # 32 bytes = 256 bits; url-safe base64 gives ~43 chars
    key = secrets.token_urlsafe(32)
    print("Add this to your .env file (SECRET_KEY):")
    print(key)
    print(f"\nLength: {len(key)} characters (>= 32 required for production)")

if __name__ == "__main__":
    main()
