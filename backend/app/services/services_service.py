"""
Services service for managing automotive services across Iraq
"""
import sqlite3
import os
import logging
from typing import Optional, Dict, List, Tuple
from datetime import datetime
import json
import uuid

logger = logging.getLogger(__name__)

# Database path (same as auth service)
DB_PATH = os.path.join(os.path.dirname(
    os.path.dirname(os.path.dirname(__file__))), "users.db")


def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_services_db():
    """Initialize database with services tables"""
    conn = get_db()
    cursor = conn.cursor()

    # Check if services table exists and has correct schema
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='services'")
    table_exists = cursor.fetchone() is not None

    if table_exists:
        # Check if table has correct columns
        cursor.execute("PRAGMA table_info(services)")
        columns = {row[1]: row[2] for row in cursor.fetchall()}

        # If critical columns are missing or wrong, drop and recreate
        critical_columns = ['name_en', 'description_en', 'status']
        missing_critical = [
            col for col in critical_columns if col not in columns]

        if missing_critical:
            logger.warning(
                f"Services table missing critical columns: {missing_critical}. Recreating table...")
            cursor.execute("DROP TABLE IF EXISTS services")
            conn.commit()
            table_exists = False

    # Create locations table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS locations (
            id TEXT PRIMARY KEY,
            name_en TEXT NOT NULL,
            name_ar TEXT,
            name_ku TEXT,
            region TEXT,  -- kurdistan, central, southern, western, northern
            is_active BOOLEAN DEFAULT 1,
            coordinates TEXT,  -- JSON: {"lat": 0, "lng": 0}
            service_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create service_providers table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS service_providers (
            id TEXT PRIMARY KEY,
            service_id TEXT NOT NULL,
            provider_name TEXT NOT NULL,
            provider_logo TEXT,
            provider_phone TEXT,
            provider_email TEXT,
            provider_whatsapp TEXT,
            provider_website TEXT,
            provider_address TEXT,
            map_latitude REAL,
            map_longitude REAL,
            working_hours TEXT,
            price_range TEXT,
            rating REAL DEFAULT 0,
            review_count INTEGER DEFAULT 0,
            gallery_images TEXT,  -- JSON array of image URLs
            locations TEXT,  -- JSON array of location IDs
            is_all_iraq INTEGER DEFAULT 0,
            status TEXT DEFAULT 'active',
            display_order INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
        )
    """)

    # Create index for faster lookups
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_service_providers_service_id ON service_providers(service_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_service_providers_status ON service_providers(status)
    """)

    # Create services table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS services (
            id TEXT PRIMARY KEY,
            name_en TEXT NOT NULL,
            name_ar TEXT,
            name_ku TEXT,
            description_en TEXT NOT NULL,
            description_ar TEXT,
            description_ku TEXT,
            icon TEXT,  -- URL or icon name
            icon_type TEXT DEFAULT 'library',  -- 'image' or 'library'
            locations TEXT,  -- JSON array of location IDs
            is_all_iraq BOOLEAN DEFAULT 0,
            status TEXT DEFAULT 'active',  -- 'active' or 'inactive'
            display_order INTEGER DEFAULT 50,
            contact_phone TEXT,
            contact_email TEXT,
            service_url TEXT,
            is_featured BOOLEAN DEFAULT 0,
            view_count INTEGER DEFAULT 0,
            click_count INTEGER DEFAULT 0,
            provider_name TEXT,
            provider_logo TEXT,
            provider_phone TEXT,
            provider_email TEXT,
            provider_website TEXT,
            provider_address TEXT,
            provider_whatsapp TEXT,
            map_latitude REAL,
            map_longitude REAL,
            gallery_images TEXT,  -- JSON array of image URLs
            working_hours TEXT,
            rating REAL DEFAULT 0,
            review_count INTEGER DEFAULT 0,
            price_range TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_by TEXT,
            updated_by TEXT
        )
    """)

    # Migrate existing tables: Add missing columns if they don't exist
    # Only run migration if table already existed before (wasn't just created above)
    # Re-check if table exists after potential drop
    cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='services'")
    table_still_exists = cursor.fetchone() is not None

    if table_still_exists:
        # Get current columns
        cursor.execute("PRAGMA table_info(services)")
        existing_columns = [row[1] for row in cursor.fetchall()]

        # List of columns that should exist
        required_columns = {
            'status': "TEXT DEFAULT 'active'",
            'name_ar': 'TEXT',
            'name_ku': 'TEXT',
            'description_ar': 'TEXT',
            'description_ku': 'TEXT',
            'icon_type': "TEXT DEFAULT 'library'",
            'is_all_iraq': 'BOOLEAN DEFAULT 0',
            'display_order': 'INTEGER DEFAULT 50',
            'contact_phone': 'TEXT',
            'contact_email': 'TEXT',
            'service_url': 'TEXT',
            'is_featured': 'BOOLEAN DEFAULT 0',
            'view_count': 'INTEGER DEFAULT 0',
            'click_count': 'INTEGER DEFAULT 0',
            'provider_name': 'TEXT',
            'provider_logo': 'TEXT',
            'provider_phone': 'TEXT',
            'provider_email': 'TEXT',
            'provider_website': 'TEXT',
            'provider_address': 'TEXT',
            'provider_whatsapp': 'TEXT',
            'map_latitude': 'REAL',
            'map_longitude': 'REAL',
            'gallery_images': 'TEXT',
            'working_hours': 'TEXT',
            'rating': 'REAL DEFAULT 0',
            'review_count': 'INTEGER DEFAULT 0',
            'price_range': 'TEXT',
            'created_by': 'TEXT',
            'updated_by': 'TEXT',
        }

        # Add missing columns
        for column_name, column_def in required_columns.items():
            if column_name not in existing_columns:
                try:
                    cursor.execute(
                        f"ALTER TABLE services ADD COLUMN {column_name} {column_def}")
                    logger.info(
                        f"Added missing column '{column_name}' to services table")
                except Exception as e:
                    logger.warning(
                        f"Could not add column '{column_name}': {e}")

        # Check locations table columns
        cursor.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='locations'")
        locations_table_exists = cursor.fetchone() is not None

        if locations_table_exists:
            cursor.execute("PRAGMA table_info(locations)")
            existing_location_columns = [row[1] for row in cursor.fetchall()]

            location_required_columns = {
                'name_ar': 'TEXT',
                'name_ku': 'TEXT',
                'region': 'TEXT',
                'is_active': 'BOOLEAN DEFAULT 1',
                'coordinates': 'TEXT',
                'service_count': 'INTEGER DEFAULT 0',
            }

            for column_name, column_def in location_required_columns.items():
                if column_name not in existing_location_columns:
                    try:
                        cursor.execute(
                            f"ALTER TABLE locations ADD COLUMN {column_name} {column_def}")
                        logger.info(
                            f"Added missing column '{column_name}' to locations table")
                    except Exception as e:
                        logger.warning(
                            f"Could not add column '{column_name}': {e}")

        conn.commit()

    # Create indexes
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_services_status ON services(status)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_services_display_order ON services(display_order)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_services_is_featured ON services(is_featured)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_services_is_all_iraq ON services(is_all_iraq)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_locations_is_active ON locations(is_active)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_locations_region ON locations(region)
    """)

    # Update existing rows that might have NULL status
    try:
        cursor.execute(
            "UPDATE services SET status = 'active' WHERE status IS NULL")
        if cursor.rowcount > 0:
            logger.info(
                f"Updated {cursor.rowcount} services with NULL status to 'active'")
    except Exception as e:
        logger.warning(f"Could not update NULL status values: {e}")

    conn.commit()

    # Migrate existing provider data from services table to service_providers table
    _migrate_providers_from_services(cursor, conn)

    # Insert default locations if they don't exist
    default_locations = [
        {'id': 'all', 'name_en': 'All Iraq', 'name_ar': 'كل العراق',
            'name_ku': 'هەموو عێراق', 'region': None},
        {'id': 'erbil', 'name_en': 'Erbil', 'name_ar': 'أربيل',
            'name_ku': 'هەولێر', 'region': 'kurdistan'},
        {'id': 'sulaymaniyah', 'name_en': 'Sulaymaniyah',
            'name_ar': 'السليمانية', 'name_ku': 'سلێمانی', 'region': 'kurdistan'},
        {'id': 'duhok', 'name_en': 'Duhok', 'name_ar': 'دهوك',
            'name_ku': 'دهۆک', 'region': 'kurdistan'},
        {'id': 'baghdad', 'name_en': 'Baghdad', 'name_ar': 'بغداد',
            'name_ku': 'بەغدا', 'region': 'central'},
        {'id': 'basra', 'name_en': 'Basra', 'name_ar': 'البصرة',
            'name_ku': 'بەسرە', 'region': 'southern'},
        {'id': 'mosul', 'name_en': 'Mosul', 'name_ar': 'الموصل',
            'name_ku': 'موسڵ', 'region': 'northern'},
        {'id': 'kirkuk', 'name_en': 'Kirkuk', 'name_ar': 'كركوك',
            'name_ku': 'کەرکووک', 'region': 'central'},
        {'id': 'najaf', 'name_en': 'Najaf', 'name_ar': 'النجف',
            'name_ku': 'نەجەف', 'region': 'southern'},
        {'id': 'karbala', 'name_en': 'Karbala', 'name_ar': 'كربلاء',
            'name_ku': 'کەربەلا', 'region': 'southern'},
        {'id': 'ramadi', 'name_en': 'Ramadi', 'name_ar': 'الرمادي',
            'name_ku': 'ڕەمادی', 'region': 'western'},
        {'id': 'fallujah', 'name_en': 'Fallujah', 'name_ar': 'الفلوجة',
            'name_ku': 'فەلوجە', 'region': 'western'},
        {'id': 'amarah', 'name_en': 'Amarah', 'name_ar': 'العمارة',
            'name_ku': 'ئەمارە', 'region': 'southern'},
        {'id': 'nasiriyah', 'name_en': 'Nasiriyah', 'name_ar': 'الناصرية',
            'name_ku': 'ناسریە', 'region': 'southern'},
    ]

    for loc in default_locations:
        cursor.execute("""
            INSERT OR IGNORE INTO locations (id, name_en, name_ar, name_ku, region, is_active)
            VALUES (?, ?, ?, ?, ?, 1)
        """, (loc['id'], loc['name_en'], loc['name_ar'], loc['name_ku'], loc['region']))

    # Insert default services if they don't exist
    default_services = [
        {
            'name_en': 'Speed Fuel Service',
            'name_ar': 'خدمة توصيل الوقود السريع',
            'name_ku': 'خزمەتگوزاری سوتەمەنی خێرا',
            'description_en': 'Fast fuel delivery to your location',
            'description_ar': 'توصيل الوقود السريع إلى موقعك',
            'description_ku': 'گەیاندنی خێرای سوتەمەنی بۆ شوێنەکەت',
            'icon': 'fuel-pump',
            'is_all_iraq': True,
            'display_order': 1,
            'provider_name': 'Fast Fuel Delivery',
            'provider_phone': '+964 750 333 4444',
            'provider_address': 'Covers all Erbil',
            'working_hours': '24/7',
            'price_range': '20,000 IQD + fuel cost',
            'rating': 4.5,
            'review_count': 128
        },
        {
            'name_en': 'Oil Change Department',
            'name_ar': 'قسم تغيير الزيت',
            'name_ku': 'بەشی گۆڕینی ئۆیل',
            'description_en': 'Professional oil change and routine maintenance',
            'description_ar': 'تغيير الزيت الصيانة الروتينية الاحترافية',
            'description_ku': 'گۆڕینی ئۆیلی پیشەیی و چاککردنەوەی خۆکار',
            'icon': 'droplet',
            'is_all_iraq': True,
            'display_order': 2,
            'provider_name': 'Express Oil Center',
            'provider_phone': '+964 750 111 2222',
            'provider_address': '45 Gulan Street, Erbil',
            'working_hours': 'Daily 8AM-8PM',
            'price_range': '15,000 - 25,000 IQD',
            'rating': 4.7,
            'review_count': 245,
            'map_latitude': 36.1911,
            'map_longitude': 44.0091
        },
        {
            'name_en': 'Mobile Fitters',
            'name_ar': 'الميكانيكيون المتنقلون',
            'name_ku': 'میکانیکی جوڵاو',
            'description_en': 'Certified mechanics available at your location',
            'description_ar': 'ميكانيكيون معتمدون متاحون في موقعك',
            'description_ku': 'میکانیکی دڵنیاکراو بەردەست لە شوێنەکەت',
            'icon': 'wrench',
            'is_all_iraq': True,
            'display_order': 3,
            'provider_name': 'Cihan Motors',
            'provider_phone': '+964 750 555 6666',
            'provider_website': 'www.cihanmotors.com',
            'provider_address': '78 Masif Road, Erbil',
            'working_hours': 'Sat-Thu: 9AM-6PM',
            'price_range': '30,000 - 100,000 IQD',
            'rating': 4.8,
            'review_count': 189,
            'map_latitude': 36.2000,
            'map_longitude': 44.0100
        },
        {
            'name_en': 'ATECO Towing Service',
            'name_ar': 'خدمة سحب ATECO',
            'name_ku': 'خزمەتگوزاری گواستنەوەی ATECO',
            'description_en': 'Reliable towing and crane vehicle transport',
            'description_ar': 'نقل موثوق للمركبات والرافعات',
            'description_ku': 'گواستنەوەی دڵنیای ئۆتۆمبێل و کڕین',
            'icon': 'truck',
            'is_all_iraq': True,
            'display_order': 4,
            'provider_name': 'ATECO Towing Company',
            'provider_phone': '+964 750 777 8888',
            'provider_address': '12 Industrial Zone, Erbil',
            'working_hours': '24/7 Emergency Service',
            'price_range': '50,000 - 150,000 IQD',
            'rating': 4.6,
            'review_count': 312,
            'map_latitude': 36.1800,
            'map_longitude': 44.0050
        },
        {
            'name_en': 'Trusted Car Companies',
            'name_ar': 'شركات السيارات الموثوقة',
            'name_ku': 'کۆمپانیاکانی ئۆتۆمبێلی دڵنیاکراو',
            'description_en': 'Verified car dealers with quality standards',
            'description_ar': 'تجار سيارات معتمدون بمعايير الجودة',
            'description_ku': 'دەستکارانی ئۆتۆمبێلی دڵنیاکراو بە ستانداردی جۆری',
            'icon': 'handshake',
            'is_all_iraq': True,
            'display_order': 5,
            'provider_name': 'Premium Auto Dealers Network',
            'provider_phone': '+964 750 999 0000',
            'provider_address': 'Multiple showrooms across Iraq',
            'working_hours': 'Daily 10AM-10PM',
            'rating': 4.9,
            'review_count': 567
        },
        {
            'name_en': 'Tire Services',
            'name_ar': 'خدمات الإطارات',
            'name_ku': 'خزمەتگوزاری لاستیک',
            'description_en': 'Tire replacement, balancing, rotation, and repair',
            'description_ar': 'استبدال وتوازن وتدوير وإصلاح الإطارات',
            'description_ku': 'گۆڕینی، هاوسەنگی، گۆڕان و چاککردنەوەی لاستیک',
            'icon': 'circle',
            'is_all_iraq': True,
            'display_order': 6,
            'provider_name': 'Quick Tire Center',
            'provider_phone': '+964 750 111 3333',
            'provider_address': '56 60 Meter Road, Erbil',
            'working_hours': 'Daily 8AM-9PM',
            'price_range': '10,000 - 80,000 IQD',
            'rating': 4.4,
            'review_count': 156,
            'map_latitude': 36.1950,
            'map_longitude': 44.0120
        },
        {
            'name_en': 'Battery Services',
            'name_ar': 'خدمات البطاريات',
            'name_ku': 'خزمەتگوزاری باتری',
            'description_en': 'Battery testing, replacement, and emergency jump-start',
            'description_ar': 'اختبار واستبدال البطاريات وبدء الطوارئ',
            'description_ku': 'تاقیکردنەوە، گۆڕین و دەستپێکردنی فریاکەوتنی باتری',
            'icon': 'battery',
            'is_all_iraq': True,
            'display_order': 7,
            'provider_name': 'PowerCell Auto Batteries',
            'provider_phone': '+964 750 222 4444',
            'provider_address': '89 Dream City, Erbil',
            'working_hours': 'Daily 8AM-8PM',
            'price_range': '50,000 - 200,000 IQD',
            'rating': 4.5,
            'review_count': 203,
            'map_latitude': 36.1900,
            'map_longitude': 44.0080
        },
    ]

    for svc in default_services:
        # Check if service already exists by name_en
        cursor.execute(
            "SELECT id, status FROM services WHERE name_en = ?", (svc['name_en'],))
        existing = cursor.fetchone()

        if not existing:
            # Service doesn't exist, insert it
            service_id = str(uuid.uuid4())
            cursor.execute("""
                INSERT INTO services (
                    id, name_en, name_ar, name_ku, description_en, description_ar, description_ku,
                    icon, icon_type, is_all_iraq, status, display_order,
                    provider_name, provider_phone, provider_address, working_hours, price_range,
                    rating, review_count, map_latitude, map_longitude, provider_website,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'library', ?, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, (
                service_id,
                svc['name_en'],
                svc['name_ar'],
                svc['name_ku'],
                svc['description_en'],
                svc['description_ar'],
                svc['description_ku'],
                svc['icon'],
                svc['is_all_iraq'],
                svc['display_order'],
                svc.get('provider_name'),
                svc.get('provider_phone'),
                svc.get('provider_address'),
                svc.get('working_hours'),
                svc.get('price_range'),
                svc.get('rating', 0),
                svc.get('review_count', 0),
                svc.get('map_latitude'),
                svc.get('map_longitude'),
                svc.get('provider_website')
            ))
            logger.info(f"Inserted default service: {svc['name_en']}")
        else:
            # Service exists - ensure it's active and has correct data
            service_id = existing[0]

            # Check current status
            cursor.execute(
                "SELECT status FROM services WHERE id = ?", (service_id,))
            status_row = cursor.fetchone()
            existing_status = status_row[0] if status_row else None

            # Update status to active if it's inactive or missing
            if existing_status != 'active':
                cursor.execute(
                    "UPDATE services SET status = 'active' WHERE id = ?", (service_id,))
                logger.info(
                    f"Updated service status to active: {svc['name_en']}")

            # Update provider fields if they're missing (for existing services that might not have them)
            updates = []
            values = []

            if svc.get('provider_name'):
                updates.append("provider_name = ?")
                values.append(svc['provider_name'])
            if svc.get('provider_phone'):
                updates.append("provider_phone = ?")
                values.append(svc['provider_phone'])
            if svc.get('provider_address'):
                updates.append("provider_address = ?")
                values.append(svc['provider_address'])
            if svc.get('working_hours'):
                updates.append("working_hours = ?")
                values.append(svc['working_hours'])
            if svc.get('price_range'):
                updates.append("price_range = ?")
                values.append(svc['price_range'])
            if svc.get('rating') is not None:
                updates.append("rating = ?")
                values.append(svc['rating'])
            if svc.get('review_count') is not None:
                updates.append("review_count = ?")
                values.append(svc['review_count'])
            if svc.get('map_latitude') is not None:
                updates.append("map_latitude = ?")
                values.append(svc['map_latitude'])
            if svc.get('map_longitude') is not None:
                updates.append("map_longitude = ?")
                values.append(svc['map_longitude'])
            if svc.get('provider_website'):
                updates.append("provider_website = ?")
                values.append(svc['provider_website'])

            # Only update if there are fields to update
            if updates:
                # Check if provider fields are NULL or empty
                cursor.execute("""
                    SELECT provider_name FROM services WHERE id = ?
                """, (service_id,))
                current_provider_row = cursor.fetchone()
                current_provider = current_provider_row[0] if current_provider_row else None

                # Only update if provider_name is NULL or empty
                if not current_provider:
                    updates.append("updated_at = CURRENT_TIMESTAMP")
                    values.append(service_id)
                    cursor.execute(f"""
                        UPDATE services SET {', '.join(updates)} WHERE id = ?
                    """, values)
                    logger.info(
                        f"Updated provider fields for service: {svc['name_en']}")

            logger.debug(f"Service already exists: {svc['name_en']}")

    conn.commit()

    # Verify all 7 services exist and are active
    cursor.execute(
        "SELECT COUNT(*) as count FROM services WHERE status = 'active'")
    active_count = cursor.fetchone()['count']
    logger.info(f"Total active services in database: {active_count}")

    # List all services for debugging
    cursor.execute(
        "SELECT name_en, status, display_order FROM services ORDER BY display_order")
    all_services = cursor.fetchall()
    logger.info("Services in database:")
    for svc in all_services:
        logger.info(
            f"  - {svc['name_en']} (status: {svc['status']}, order: {svc['display_order']})")

    conn.close()
    logger.info("Services database initialized successfully")


def _migrate_providers_from_services(cursor, conn):
    """Migrate provider data from services table to service_providers table"""
    try:
        # Check if migration is needed - look for services with provider_name
        cursor.execute("""
            SELECT id, provider_name, provider_logo, provider_phone, provider_email,
                   provider_whatsapp, provider_website, provider_address,
                   map_latitude, map_longitude, working_hours, price_range,
                   rating, review_count, gallery_images, is_all_iraq
            FROM services
            WHERE provider_name IS NOT NULL AND provider_name != ''
        """)
        services_with_providers = cursor.fetchall()

        if not services_with_providers:
            logger.info("No services with provider data to migrate")
            return

        logger.info(
            f"Found {len(services_with_providers)} services with provider data to migrate")

        migrated_count = 0
        for service_row in services_with_providers:
            service_id = service_row[0]
            provider_name = service_row[1]

            # Check if provider already exists for this service
            cursor.execute("""
                SELECT id FROM service_providers
                WHERE service_id = ? AND provider_name = ?
            """, (service_id, provider_name))
            existing = cursor.fetchone()

            if existing:
                logger.debug(
                    f"Provider '{provider_name}' already exists for service {service_id}")
                continue

            # Create provider from service data
            provider_id = str(uuid.uuid4())
            gallery_images_json = None
            if service_row[14]:  # gallery_images
                try:
                    if isinstance(service_row[14], str):
                        gallery_images_json = service_row[14]
                    else:
                        gallery_images_json = json.dumps(service_row[14])
                except:
                    gallery_images_json = None

            cursor.execute("""
                INSERT INTO service_providers (
                    id, service_id, provider_name, provider_logo, provider_phone,
                    provider_email, provider_whatsapp, provider_website,
                    provider_address, map_latitude, map_longitude,
                    working_hours, price_range, rating, review_count,
                    gallery_images, is_all_iraq, status, display_order,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, (
                provider_id,
                service_id,
                provider_name,
                service_row[2],  # provider_logo
                service_row[3],  # provider_phone
                service_row[4],  # provider_email
                service_row[5],  # provider_whatsapp
                service_row[6],  # provider_website
                service_row[7],  # provider_address
                service_row[8],  # map_latitude
                service_row[9],  # map_longitude
                service_row[10],  # working_hours
                service_row[11],  # price_range
                service_row[12] or 0,  # rating
                service_row[13] or 0,  # review_count
                gallery_images_json,
                service_row[15] or 0  # is_all_iraq
            ))
            migrated_count += 1
            logger.info(
                f"Migrated provider '{provider_name}' for service {service_id}")

        conn.commit()
        logger.info(
            f"Migration complete: {migrated_count} providers migrated to service_providers table")

    except Exception as e:
        logger.error(f"Error during provider migration: {e}", exc_info=True)
        conn.rollback()


def get_all_locations(active_only: bool = True) -> List[Dict]:
    """Get all locations"""
    conn = get_db()
    cursor = conn.cursor()

    if active_only:
        cursor.execute(
            "SELECT * FROM locations WHERE is_active = 1 ORDER BY name_en")
    else:
        cursor.execute("SELECT * FROM locations ORDER BY name_en")

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def get_location_by_id(location_id: str) -> Optional[Dict]:
    """Get location by ID"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM locations WHERE id = ?", (location_id,))
    row = cursor.fetchone()
    conn.close()

    return dict(row) if row else None


def create_location(location_data: Dict) -> Dict:
    """Create a new location"""
    conn = get_db()
    cursor = conn.cursor()

    location_id = location_data.get('id') or location_data.get(
        'name_en', '').lower().replace(' ', '-')

    cursor.execute("""
        INSERT INTO locations (id, name_en, name_ar, name_ku, region, is_active, coordinates, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """, (
        location_id,
        location_data['name_en'],
        location_data.get('name_ar'),
        location_data.get('name_ku'),
        location_data.get('region'),
        location_data.get('is_active', True),
        json.dumps(location_data.get('coordinates')
                   ) if location_data.get('coordinates') else None
    ))

    conn.commit()
    location = get_location_by_id(location_id)
    conn.close()

    return location


def update_location(location_id: str, location_data: Dict) -> Optional[Dict]:
    """Update a location"""
    conn = get_db()
    cursor = conn.cursor()

    updates = []
    values = []

    for key in ['name_en', 'name_ar', 'name_ku', 'region', 'is_active']:
        if key in location_data:
            updates.append(f"{key} = ?")
            values.append(location_data[key])

    if 'coordinates' in location_data:
        updates.append("coordinates = ?")
        values.append(json.dumps(
            location_data['coordinates']) if location_data['coordinates'] else None)

    updates.append("updated_at = CURRENT_TIMESTAMP")
    values.append(location_id)

    cursor.execute(f"""
        UPDATE locations SET {', '.join(updates)} WHERE id = ?
    """, values)

    conn.commit()
    location = get_location_by_id(location_id)
    conn.close()

    return location


def delete_location(location_id: str) -> bool:
    """Delete a location"""
    conn = get_db()
    cursor = conn.cursor()

    # Check if any services use this location
    cursor.execute(
        "SELECT COUNT(*) as count FROM services WHERE locations LIKE ?", (f'%{location_id}%',))
    result = cursor.fetchone()

    if result and result['count'] > 0:
        conn.close()
        return False  # Cannot delete location that is in use

    cursor.execute("DELETE FROM locations WHERE id = ?", (location_id,))
    conn.commit()
    conn.close()

    return True


def get_all_services(
    status: Optional[str] = None,
    location_id: Optional[str] = None,
    featured_only: bool = False,
    active_only: bool = True
) -> List[Dict]:
    """Get all services with optional filters"""
    conn = get_db()
    cursor = conn.cursor()

    # Check if status column exists
    cursor.execute("PRAGMA table_info(services)")
    columns = [row[1] for row in cursor.fetchall()]
    has_status_column = 'status' in columns

    query = "SELECT * FROM services WHERE 1=1"
    params = []

    # Only filter by status if the column exists
    if has_status_column:
        if active_only or status == 'active':
            query += " AND status = 'active'"
        elif status == 'inactive':
            query += " AND status = 'inactive'"

    if featured_only:
        query += " AND is_featured = 1"

    # Only filter by location if location_id is provided and it's not 'all'
    if location_id and location_id != 'all' and location_id.strip():
        query += " AND (is_all_iraq = 1 OR locations LIKE ?)"
        params.append(f'%{location_id}%')

    query += " ORDER BY display_order ASC, name_en ASC"

    logger.debug(f"Executing query: {query} with params: {params}")
    cursor.execute(query, params)
    rows = cursor.fetchall()
    logger.debug(f"Found {len(rows)} services")
    conn.close()

    services = []
    for row in rows:
        service = dict(row)
        # Parse JSON fields
        if service.get('locations'):
            try:
                service['locations'] = json.loads(service['locations'])
            except:
                service['locations'] = []
        else:
            service['locations'] = []
        if service.get('coordinates'):
            try:
                service['coordinates'] = json.loads(service['coordinates'])
            except:
                service['coordinates'] = None
        if service.get('gallery_images'):
            try:
                service['gallery_images'] = json.loads(
                    service['gallery_images'])
            except:
                service['gallery_images'] = []
        else:
            service['gallery_images'] = []
        services.append(service)

    return services


def get_service_by_id(service_id: str) -> Optional[Dict]:
    """Get service by ID"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM services WHERE id = ?", (service_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    service = dict(row)
    # Parse JSON fields
    if service.get('locations'):
        try:
            service['locations'] = json.loads(service['locations'])
        except:
            service['locations'] = []
    else:
        service['locations'] = []

    if service.get('gallery_images'):
        try:
            service['gallery_images'] = json.loads(service['gallery_images'])
        except:
            service['gallery_images'] = []
    else:
        service['gallery_images'] = []

    return service


def create_service(service_data: Dict) -> Dict:
    """Create a new service"""
    conn = get_db()
    cursor = conn.cursor()

    service_id = service_data.get('id') or str(uuid.uuid4())

    locations_json = json.dumps(service_data.get(
        'locations', [])) if service_data.get('locations') else None

    cursor.execute("""
        INSERT INTO services (
            id, name_en, name_ar, name_ku, description_en, description_ar, description_ku,
            icon, icon_type, locations, is_all_iraq, status, display_order,
            contact_phone, contact_email, service_url, is_featured,
            created_by, updated_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """, (
        service_id,
        service_data['name_en'],
        service_data.get('name_ar'),
        service_data.get('name_ku'),
        service_data['description_en'],
        service_data.get('description_ar'),
        service_data.get('description_ku'),
        service_data.get('icon'),
        service_data.get('icon_type', 'library'),
        locations_json,
        service_data.get('is_all_iraq', False),
        service_data.get('status', 'active'),
        service_data.get('display_order', 50),
        service_data.get('contact_phone'),
        service_data.get('contact_email'),
        service_data.get('service_url'),
        service_data.get('is_featured', False),
        service_data.get('created_by'),
        service_data.get('updated_by')
    ))

    conn.commit()
    service = get_service_by_id(service_id)
    conn.close()

    return service


def update_service(service_id: str, service_data: Dict) -> Optional[Dict]:
    """Update a service"""
    conn = get_db()
    cursor = conn.cursor()

    updates = []
    values = []

    for key in ['name_en', 'name_ar', 'name_ku', 'description_en', 'description_ar', 'description_ku',
                'icon', 'icon_type', 'is_all_iraq', 'status', 'display_order',
                'contact_phone', 'contact_email', 'service_url', 'is_featured',
                'provider_name', 'provider_logo', 'provider_phone', 'provider_email', 'provider_website',
                'provider_address', 'provider_whatsapp', 'map_latitude', 'map_longitude',
                'working_hours', 'rating', 'review_count', 'price_range', 'updated_by']:
        if key in service_data:
            updates.append(f"{key} = ?")
            values.append(service_data[key])

    if 'locations' in service_data:
        updates.append("locations = ?")
        values.append(json.dumps(
            service_data['locations']) if service_data['locations'] else None)

    if 'gallery_images' in service_data:
        updates.append("gallery_images = ?")
        values.append(json.dumps(
            service_data['gallery_images']) if service_data['gallery_images'] else None)

    updates.append("updated_at = CURRENT_TIMESTAMP")
    values.append(service_id)

    cursor.execute(f"""
        UPDATE services SET {', '.join(updates)} WHERE id = ?
    """, values)

    conn.commit()
    service = get_service_by_id(service_id)
    conn.close()

    return service


def delete_service(service_id: str) -> bool:
    """Delete a service"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM services WHERE id = ?", (service_id,))
    conn.commit()
    conn.close()
    return True


def increment_service_view(service_id: str):
    """Increment service view count"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE services SET view_count = view_count + 1 WHERE id = ?", (service_id,))
    conn.commit()
    conn.close()


def increment_service_click(service_id: str):
    """Increment service click count"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE services SET click_count = click_count + 1 WHERE id = ?", (service_id,))
    conn.commit()
    conn.close()


# Initialize database on import
try:
    init_services_db()
except Exception as e:
    logger.error(f"Error initializing services database: {e}")
