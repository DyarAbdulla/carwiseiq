"""
Provider service for managing service providers
"""
import sqlite3
import os
import logging
from typing import Optional, Dict, List
import json
import uuid

logger = logging.getLogger(__name__)

# Database path (same as services service)
DB_PATH = os.path.join(os.path.dirname(
    os.path.dirname(os.path.dirname(__file__))), "users.db")


def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_providers_by_service(
    service_id: str,
    status: Optional[str] = 'active',
    location_id: Optional[str] = None,
    active_only: bool = True
) -> List[Dict]:
    """Get all providers for a specific service"""
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM service_providers WHERE service_id = ?"
    params = [service_id]

    if active_only or status == 'active':
        query += " AND status = 'active'"
    elif status == 'inactive':
        query += " AND status = 'inactive'"

    # Filter by location if provided
    if location_id and location_id != 'all' and location_id.strip():
        query += " AND (is_all_iraq = 1 OR locations LIKE ?)"
        params.append(f'%{location_id}%')

    query += " ORDER BY display_order ASC, provider_name ASC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    providers = []
    for row in rows:
        provider = dict(row)
        # Parse JSON fields
        if provider.get('locations'):
            try:
                provider['locations'] = json.loads(provider['locations'])
            except:
                provider['locations'] = []
        else:
            provider['locations'] = []

        if provider.get('gallery_images'):
            try:
                provider['gallery_images'] = json.loads(
                    provider['gallery_images'])
            except:
                provider['gallery_images'] = []
        else:
            provider['gallery_images'] = []

        providers.append(provider)

    return providers


def get_provider_by_id(provider_id: str) -> Optional[Dict]:
    """Get a single provider by ID"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM service_providers WHERE id = ?", (provider_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    provider = dict(row)
    # Parse JSON fields
    if provider.get('locations'):
        try:
            provider['locations'] = json.loads(provider['locations'])
        except:
            provider['locations'] = []
    else:
        provider['locations'] = []

    if provider.get('gallery_images'):
        try:
            provider['gallery_images'] = json.loads(provider['gallery_images'])
        except:
            provider['gallery_images'] = []
    else:
        provider['gallery_images'] = []

    return provider


def create_provider(provider_data: Dict) -> Dict:
    """Create a new provider"""
    conn = get_db()
    cursor = conn.cursor()

    provider_id = provider_data.get('id') or str(uuid.uuid4())

    locations_json = json.dumps(provider_data.get(
        'locations', [])) if provider_data.get('locations') else None
    gallery_images_json = json.dumps(provider_data.get(
        'gallery_images', [])) if provider_data.get('gallery_images') else None

    cursor.execute("""
        INSERT INTO service_providers (
            id, service_id, provider_name, provider_logo, provider_phone,
            provider_email, provider_whatsapp, provider_website,
            provider_address, map_latitude, map_longitude,
            working_hours, price_range, rating, review_count,
            gallery_images, locations, is_all_iraq, status, display_order,
            created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    """, (
        provider_id,
        provider_data['service_id'],
        provider_data['provider_name'],
        provider_data.get('provider_logo'),
        provider_data.get('provider_phone'),
        provider_data.get('provider_email'),
        provider_data.get('provider_whatsapp'),
        provider_data.get('provider_website'),
        provider_data.get('provider_address'),
        provider_data.get('map_latitude'),
        provider_data.get('map_longitude'),
        provider_data.get('working_hours'),
        provider_data.get('price_range'),
        provider_data.get('rating', 0),
        provider_data.get('review_count', 0),
        gallery_images_json,
        locations_json,
        provider_data.get('is_all_iraq', False),
        provider_data.get('status', 'active'),
        provider_data.get('display_order', 0)
    ))

    conn.commit()
    provider = get_provider_by_id(provider_id)
    conn.close()

    return provider


def update_provider(provider_id: str, provider_data: Dict) -> Optional[Dict]:
    """Update a provider"""
    conn = get_db()
    cursor = conn.cursor()

    updates = []
    values = []

    for key in ['provider_name', 'provider_logo', 'provider_phone', 'provider_email',
                'provider_whatsapp', 'provider_website', 'provider_address',
                'map_latitude', 'map_longitude', 'working_hours', 'price_range',
                'rating', 'review_count', 'is_all_iraq', 'status', 'display_order']:
        if key in provider_data:
            updates.append(f"{key} = ?")
            values.append(provider_data[key])

    if 'locations' in provider_data:
        updates.append("locations = ?")
        values.append(json.dumps(
            provider_data['locations']) if provider_data['locations'] else None)

    if 'gallery_images' in provider_data:
        updates.append("gallery_images = ?")
        values.append(json.dumps(
            provider_data['gallery_images']) if provider_data['gallery_images'] else None)

    updates.append("updated_at = CURRENT_TIMESTAMP")
    values.append(provider_id)

    cursor.execute(f"""
        UPDATE service_providers SET {', '.join(updates)} WHERE id = ?
    """, values)

    conn.commit()
    provider = get_provider_by_id(provider_id)
    conn.close()

    return provider


def delete_provider(provider_id: str) -> bool:
    """Delete a provider"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "DELETE FROM service_providers WHERE id = ?", (provider_id,))
    conn.commit()
    deleted = cursor.rowcount > 0
    conn.close()

    return deleted


def get_all_providers(
    status: Optional[str] = None,
    service_id: Optional[str] = None,
    location_id: Optional[str] = None,
    active_only: bool = True
) -> List[Dict]:
    """Get all providers with optional filters"""
    conn = get_db()
    cursor = conn.cursor()

    query = "SELECT * FROM service_providers WHERE 1=1"
    params = []

    if service_id:
        query += " AND service_id = ?"
        params.append(service_id)

    if active_only or status == 'active':
        query += " AND status = 'active'"
    elif status == 'inactive':
        query += " AND status = 'inactive'"

    # Filter by location if provided
    if location_id and location_id != 'all' and location_id.strip():
        query += " AND (is_all_iraq = 1 OR locations LIKE ?)"
        params.append(f'%{location_id}%')

    query += " ORDER BY display_order ASC, provider_name ASC"

    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()

    providers = []
    for row in rows:
        provider = dict(row)
        # Parse JSON fields
        if provider.get('locations'):
            try:
                provider['locations'] = json.loads(provider['locations'])
            except:
                provider['locations'] = []
        else:
            provider['locations'] = []

        if provider.get('gallery_images'):
            try:
                provider['gallery_images'] = json.loads(
                    provider['gallery_images'])
            except:
                provider['gallery_images'] = []
        else:
            provider['gallery_images'] = []

        providers.append(provider)

    return providers
