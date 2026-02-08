"""
Script to check and restore missing services in the database.
Run this script to verify all 7 services exist and are active.
"""
from app.services.services_service import init_services_db, get_all_services
import sqlite3
import sys
import os

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def check_services():
    """Check all services in the database"""
    print("=" * 60)
    print("CHECKING SERVICES DATABASE")
    print("=" * 60)

    # Initialize database (this will create missing services)
    print("\n1. Initializing database...")
    init_services_db()

    # Get all services
    print("\n2. Fetching all services...")
    services = get_all_services(status=None, active_only=False)

    print(f"\n3. Found {len(services)} total services:")
    print("-" * 60)

    expected_services = [
        "Speed Fuel Service",
        "Oil Change Department",
        "Mobile Fitters",
        "ATECO Towing Service",
        "Trusted Car Companies",
        "Tire Services",
        "Battery Services"
    ]

    found_services = []
    for service in services:
        name = service.get('name_en', 'Unknown')
        status = service.get('status', 'unknown')
        order = service.get('display_order', 0)
        found_services.append(name)
        status_icon = "[OK]" if status == 'active' else "[INACTIVE]"
        print(f"{status_icon} {name} (status: {status}, order: {order})")

    print("-" * 60)

    # Check for missing services
    missing = [s for s in expected_services if s not in found_services]
    if missing:
        print(f"\n[WARNING] MISSING SERVICES: {len(missing)}")
        for name in missing:
            print(f"   - {name}")
    else:
        print("\n[SUCCESS] All 7 expected services are present!")

    # Check active services
    active_services = [s for s in services if s.get('status') == 'active']
    print(f"\n[INFO] Active services: {len(active_services)}/{len(services)}")

    if len(active_services) < 7:
        inactive = [s for s in services if s.get('status') != 'active']
        if inactive:
            print(f"\n[WARNING] Inactive services: {len(inactive)}")
            for service in inactive:
                print(
                    f"   - {service.get('name_en')} (status: {service.get('status')})")

    print("\n" + "=" * 60)
    print("CHECK COMPLETE")
    print("=" * 60)

    return len(active_services) == 7


if __name__ == "__main__":
    try:
        success = check_services()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n[ERROR] Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
