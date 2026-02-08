"""
Script to add default providers for testing
Run this after the database is initialized
"""
from app.services.provider_service import create_provider, get_providers_by_service
from app.services.services_service import get_all_services, init_services_db
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def add_default_providers():
    """Add default providers for each service"""
    print("=" * 60)
    print("ADDING DEFAULT PROVIDERS")
    print("=" * 60)

    # Initialize database first
    init_services_db()

    # Get all services
    services = get_all_services(status=None, active_only=False)
    service_map = {s['name_en']: s['id'] for s in services}

    default_providers = [
        # Oil Change Department
        {
            'service_name': 'Oil Change Department',
            'provider_name': 'Express Oil Center',
            'provider_phone': '+964 750 111 2222',
            'provider_address': '45 Gulan Street, Erbil',
            'working_hours': 'Daily 8AM-8PM',
            'price_range': '15,000 - 25,000 IQD',
            'rating': 4.7,
            'review_count': 245,
            'map_latitude': 36.1911,
            'map_longitude': 44.0091,
            'is_all_iraq': False,
            'locations': ['erbil']
        },
        {
            'service_name': 'Oil Change Department',
            'provider_name': 'Quick Oil Service',
            'provider_phone': '+964 750 222 3333',
            'provider_address': '123 Main Street, Baghdad',
            'working_hours': 'Daily 9AM-7PM',
            'price_range': '12,000 - 20,000 IQD',
            'rating': 4.9,
            'review_count': 189,
            'is_all_iraq': False,
            'locations': ['baghdad']
        },
        {
            'service_name': 'Oil Change Department',
            'provider_name': 'Premium Oil Care',
            'provider_phone': '+964 750 333 4444',
            'provider_address': '78 Salim Street, Sulaymaniyah',
            'working_hours': 'Sat-Thu: 8AM-6PM',
            'price_range': '18,000 - 28,000 IQD',
            'rating': 4.6,
            'review_count': 156,
            'is_all_iraq': False,
            'locations': ['sulaymaniyah']
        },

        # Tire Services
        {
            'service_name': 'Tire Services',
            'provider_name': 'Quick Tire Center',
            'provider_phone': '+964 750 111 3333',
            'provider_address': '56 60 Meter Road, Erbil',
            'working_hours': 'Daily 8AM-9PM',
            'price_range': '10,000 - 80,000 IQD',
            'rating': 4.4,
            'review_count': 156,
            'map_latitude': 36.1950,
            'map_longitude': 44.0120,
            'is_all_iraq': False,
            'locations': ['erbil']
        },
        {
            'service_name': 'Tire Services',
            'provider_name': 'Baghdad Tire Shop',
            'provider_phone': '+964 750 444 5555',
            'provider_address': '89 Karrada Street, Baghdad',
            'working_hours': 'Daily 7AM-10PM',
            'price_range': '8,000 - 70,000 IQD',
            'rating': 4.5,
            'review_count': 203,
            'is_all_iraq': False,
            'locations': ['baghdad']
        },
        {
            'service_name': 'Tire Services',
            'provider_name': 'Tire Expert',
            'provider_phone': '+964 750 555 6666',
            'provider_address': '34 Corniche Road, Basra',
            'working_hours': 'Daily 8AM-8PM',
            'price_range': '12,000 - 85,000 IQD',
            'rating': 4.3,
            'review_count': 98,
            'is_all_iraq': False,
            'locations': ['basra']
        },

        # Trusted Car Companies
        {
            'service_name': 'Trusted Car Companies',
            'provider_name': 'Cihan Motors',
            'provider_phone': '+964 750 999 0000',
            'provider_address': 'Multiple showrooms across Erbil',
            'working_hours': 'Daily 10AM-10PM',
            'rating': 4.9,
            'review_count': 567,
            'is_all_iraq': False,
            'locations': ['erbil']
        },
        {
            'service_name': 'Trusted Car Companies',
            'provider_name': 'Hosiar Baban',
            'provider_phone': '+964 750 888 9999',
            'provider_address': 'Main Showroom, Sulaymaniyah',
            'working_hours': 'Daily 9AM-9PM',
            'rating': 4.8,
            'review_count': 423,
            'is_all_iraq': False,
            'locations': ['sulaymaniyah']
        },
        {
            'service_name': 'Trusted Car Companies',
            'provider_name': 'Mercedes Benz Iraq',
            'provider_phone': '+964 750 777 8888',
            'provider_address': 'Authorized Dealer, Baghdad',
            'working_hours': 'Sat-Thu: 9AM-6PM',
            'rating': 4.9,
            'review_count': 312,
            'is_all_iraq': False,
            'locations': ['baghdad']
        },
        {
            'service_name': 'Trusted Car Companies',
            'provider_name': 'Toyota Iraq',
            'provider_phone': '+964 750 666 7777',
            'provider_address': 'Multiple locations',
            'working_hours': 'Daily 8AM-8PM',
            'rating': 4.7,
            'review_count': 789,
            'is_all_iraq': True,
            'locations': []
        },

        # Mobile Fitters
        {
            'service_name': 'Mobile Fitters',
            'provider_name': 'Cihan Motors',
            'provider_phone': '+964 750 555 6666',
            'provider_website': 'www.cihanmotors.com',
            'provider_address': '78 Masif Road, Erbil',
            'working_hours': 'Sat-Thu: 9AM-6PM',
            'price_range': '30,000 - 100,000 IQD',
            'rating': 4.8,
            'review_count': 189,
            'map_latitude': 36.2000,
            'map_longitude': 44.0100,
            'is_all_iraq': False,
            'locations': ['erbil']
        },
        {
            'service_name': 'Mobile Fitters',
            'provider_name': 'Mobile Mechanic Pro',
            'provider_phone': '+964 750 444 5555',
            'provider_address': 'Covers all Baghdad',
            'working_hours': '24/7 Emergency Service',
            'price_range': '25,000 - 90,000 IQD',
            'rating': 4.6,
            'review_count': 234,
            'is_all_iraq': False,
            'locations': ['baghdad']
        },
        {
            'service_name': 'Mobile Fitters',
            'provider_name': 'On-Site Repair',
            'provider_phone': '+964 750 333 4444',
            'provider_address': 'Sulaymaniyah Area',
            'working_hours': 'Daily 8AM-8PM',
            'price_range': '28,000 - 95,000 IQD',
            'rating': 4.7,
            'review_count': 167,
            'is_all_iraq': False,
            'locations': ['sulaymaniyah']
        },

        # Speed Fuel Service
        {
            'service_name': 'Speed Fuel Service',
            'provider_name': 'Fast Fuel Delivery',
            'provider_phone': '+964 750 333 4444',
            'provider_address': 'Covers all Erbil',
            'working_hours': '24/7',
            'price_range': '20,000 IQD + fuel cost',
            'rating': 4.5,
            'review_count': 128,
            'is_all_iraq': False,
            'locations': ['erbil']
        },
        {
            'service_name': 'Speed Fuel Service',
            'provider_name': 'Quick Fuel',
            'provider_phone': '+964 750 222 3333',
            'provider_address': 'Baghdad Area',
            'working_hours': '24/7',
            'price_range': '18,000 IQD + fuel cost',
            'rating': 4.4,
            'review_count': 95,
            'is_all_iraq': False,
            'locations': ['baghdad']
        },
        {
            'service_name': 'Speed Fuel Service',
            'provider_name': '24/7 Fuel Service',
            'provider_phone': '+964 750 111 2222',
            'provider_address': 'Nationwide Coverage',
            'working_hours': '24/7',
            'price_range': '22,000 IQD + fuel cost',
            'rating': 4.6,
            'review_count': 201,
            'is_all_iraq': True,
            'locations': []
        },

        # Battery Services
        {
            'service_name': 'Battery Services',
            'provider_name': 'PowerCell Auto Batteries',
            'provider_phone': '+964 750 222 4444',
            'provider_address': '89 Dream City, Erbil',
            'working_hours': 'Daily 8AM-8PM',
            'price_range': '50,000 - 200,000 IQD',
            'rating': 4.5,
            'review_count': 203,
            'map_latitude': 36.1900,
            'map_longitude': 44.0080,
            'is_all_iraq': False,
            'locations': ['erbil']
        },
        {
            'service_name': 'Battery Services',
            'provider_name': 'Battery Expert',
            'provider_phone': '+964 750 333 5555',
            'provider_address': '45 Technology Street, Baghdad',
            'working_hours': 'Daily 9AM-7PM',
            'price_range': '45,000 - 180,000 IQD',
            'rating': 4.4,
            'review_count': 156,
            'is_all_iraq': False,
            'locations': ['baghdad']
        },
        {
            'service_name': 'Battery Services',
            'provider_name': 'Quick Battery Center',
            'provider_phone': '+964 750 444 6666',
            'provider_address': '12 Main Road, Basra',
            'working_hours': 'Daily 8AM-8PM',
            'price_range': '48,000 - 190,000 IQD',
            'rating': 4.6,
            'review_count': 178,
            'is_all_iraq': False,
            'locations': ['basra']
        },

        # ATECO Towing Service
        {
            'service_name': 'ATECO Towing Service',
            'provider_name': 'ATECO Towing Company',
            'provider_phone': '+964 750 777 8888',
            'provider_address': '12 Industrial Zone, Erbil',
            'working_hours': '24/7 Emergency Service',
            'price_range': '50,000 - 150,000 IQD',
            'rating': 4.6,
            'review_count': 312,
            'map_latitude': 36.1800,
            'map_longitude': 44.0050,
            'is_all_iraq': False,
            'locations': ['erbil']
        },
        {
            'service_name': 'ATECO Towing Service',
            'provider_name': 'Emergency Tow Iraq',
            'provider_phone': '+964 750 666 7777',
            'provider_address': 'Baghdad Area',
            'working_hours': '24/7',
            'price_range': '45,000 - 140,000 IQD',
            'rating': 4.5,
            'review_count': 245,
            'is_all_iraq': False,
            'locations': ['baghdad']
        },
        {
            'service_name': 'ATECO Towing Service',
            'provider_name': 'Fast Rescue',
            'provider_phone': '+964 750 555 6666',
            'provider_address': 'Sulaymaniyah',
            'working_hours': '24/7',
            'price_range': '48,000 - 145,000 IQD',
            'rating': 4.7,
            'review_count': 189,
            'is_all_iraq': False,
            'locations': ['sulaymaniyah']
        },
    ]

    added_count = 0
    skipped_count = 0

    for provider_data in default_providers:
        service_name = provider_data.pop('service_name')
        service_id = service_map.get(service_name)

        if not service_id:
            print(f"[SKIP] Service '{service_name}' not found")
            skipped_count += 1
            continue

        # Check if provider already exists
        existing_providers = get_providers_by_service(
            service_id, active_only=False)
        if any(p['provider_name'] == provider_data['provider_name'] for p in existing_providers):
            print(
                f"[SKIP] Provider '{provider_data['provider_name']}' already exists for {service_name}")
            skipped_count += 1
            continue

        try:
            provider_data['service_id'] = service_id
            provider_data['status'] = 'active'
            create_provider(provider_data)
            print(
                f"[OK] Added '{provider_data['provider_name']}' for {service_name}")
            added_count += 1
        except Exception as e:
            print(
                f"[ERROR] Failed to add '{provider_data['provider_name']}': {e}")
            skipped_count += 1

    print("\n" + "=" * 60)
    print(f"COMPLETE: Added {added_count} providers, Skipped {skipped_count}")
    print("=" * 60)


if __name__ == "__main__":
    try:
        add_default_providers()
    except Exception as e:
        print(f"\n[ERROR] {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
