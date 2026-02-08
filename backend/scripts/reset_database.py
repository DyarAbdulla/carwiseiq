#!/usr/bin/env python3
"""
Full database reset for development.
- Deletes ALL data: users, listings, favorites, messages, history, etc.
- SQLite: removes users.db and car_predictions.db, then re-initializes.
- Also removes backend/uploads/listings/ and recreates empty directory.
- PostgreSQL: not used in this project; would truncate CASCADE / recreate schema.
- Recreates tables via existing init_* functions. IDs start from 1.

Run from backend/:  python scripts/reset_database.py
Requires RESET_DB_CONFIRM=YES to run. See backend/README.md for one-liners.
"""

from pathlib import Path
import sys
import os
import shutil

# backend root (parent of scripts/)
BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

USERS_DB = BACKEND_ROOT / "users.db"
CAR_PREDICTIONS_DB = BACKEND_ROOT / "car_predictions.db"
UPLOADS_LISTINGS = BACKEND_ROOT / "uploads" / "listings"

LOCKED_MSG = "Stop backend server then run reset again."


def detect_db():
    """Determine database type. PostgreSQL if DATABASE_URL has postgres."""
    url = os.environ.get("DATABASE_URL", "")
    if "postgres" in url.lower() or "postgresql" in url.lower():
        return "postgresql", url
    return "sqlite", None


def reset_sqlite():
    """Delete SQLite .db files, uploads/listings, and re-initialize all tables."""
    removed = []

    for db_path in [USERS_DB, CAR_PREDICTIONS_DB]:
        if db_path.exists():
            try:
                db_path.unlink()
                removed.append(db_path.name)
            except OSError:
                print(f"[ERROR] Could not delete {db_path} (file is locked or permission denied).")
                print(LOCKED_MSG)
                sys.exit(1)

    # Remove uploaded listing images and recreate empty directory
    if UPLOADS_LISTINGS.exists():
        try:
            shutil.rmtree(UPLOADS_LISTINGS)
            removed.append("uploads/listings")
        except OSError:
            print(f"[ERROR] Could not delete {UPLOADS_LISTINGS} (in use or permission denied).")
            print(LOCKED_MSG)
            sys.exit(1)
    UPLOADS_LISTINGS.mkdir(parents=True, exist_ok=True)

    # Re-initialize users.db (auth, feedback, admin, marketplace, messaging, favorites)
    from app.services.auth_service import init_db
    from app.services.feedback_service import init_feedback_db
    from app.services.admin_service import init_admin_db
    from app.services.marketplace_service import init_marketplace_db
    from app.services.messaging_service import init_messaging_db
    from app.services.favorites_service import init_favorites_db

    init_db()
    init_feedback_db()
    init_admin_db()
    init_marketplace_db()
    init_messaging_db()
    init_favorites_db()

    # Re-initialize car_predictions.db (searches, cars, price_alerts)
    import database
    database._db_instance = None
    database.get_database()

    # Count tables in each DB
    import sqlite3

    def count_tables(path):
        if not path.exists():
            return 0
        conn = sqlite3.connect(str(path))
        try:
            cur = conn.execute(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
            )
            return cur.fetchone()[0]
        finally:
            conn.close()

    n_users = count_tables(USERS_DB)
    n_car = count_tables(CAR_PREDICTIONS_DB)
    total = n_users + n_car

    return removed, n_users, n_car, total


def reset_postgres(database_url: str):
    """Truncate all tables with CASCADE or drop/recreate schema. Placeholder for future."""
    print("[ERROR] PostgreSQL reset is not implemented. This project uses SQLite.")
    sys.exit(1)


def main():
    if os.environ.get("RESET_DB_CONFIRM") != "YES":
        print("Set RESET_DB_CONFIRM=YES to reset database")
        sys.exit(1)

    print("[reset_database] Starting full database reset (development only)...")
    db_type, db_url = detect_db()

    if db_type == "postgresql":
        reset_postgres(db_url)
        return

    # SQLite
    print(f"[reset_database] DB type: SQLite")
    removed, n_users, n_car, total = reset_sqlite()

    if removed:
        print(f"[reset_database] Removed: {', '.join(p if isinstance(p, str) else p.name for p in removed)}")
    else:
        print("[reset_database] No existing .db files to remove (fresh init).")

    print(f"[reset_database] users.db tables: {n_users}")
    print(f"[reset_database] car_predictions.db tables: {n_car}")
    print(f"[reset_database] Total tables: {total}")
    print("[reset_database] Done. Backend is ready to use. Restart the backend if it was running.")


if __name__ == "__main__":
    main()
