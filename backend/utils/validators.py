"""Data validation utilities"""

import re
from typing import Dict, Any
from urllib.parse import urlparse


def validate_url(url: str) -> bool:
    """Validate URL format"""
    if not url or not isinstance(url, str):
        return False
    
    try:
        result = urlparse(url)
        return all([result.scheme, result.netloc])
    except Exception:
        return False


def validate_car_data(data: Dict[str, Any]) -> bool:
    """Validate car data dictionary"""
    required_fields = ['make', 'model', 'year']
    
    for field in required_fields:
        if field not in data:
            return False
    
    # Validate year
    year = data.get('year')
    if not isinstance(year, int) or year < 1900 or year > 2025:
        return False
    
    # Validate mileage if present
    mileage = data.get('mileage')
    if mileage is not None and (not isinstance(mileage, (int, float)) or mileage < 0):
        return False
    
    return True
