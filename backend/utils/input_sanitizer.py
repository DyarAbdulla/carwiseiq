"""
Input sanitization utilities
Sanitize user inputs to prevent security issues
"""

import re
import html
from typing import Any


def sanitize_string(value: Any, max_length: int = 1000) -> str:
    """
    Sanitize string input
    
    Args:
        value: Input value
        max_length: Maximum allowed length
        
    Returns:
        Sanitized string
    """
    if value is None:
        return ""
    
    # Convert to string
    value = str(value)
    
    # HTML escape
    value = html.escape(value)
    
    # Remove control characters
    value = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', value)
    
    # Trim and limit length
    value = value.strip()[:max_length]
    
    return value


def sanitize_url(url: str) -> str:
    """
    Sanitize URL input
    
    Args:
        url: URL string
        
    Returns:
        Sanitized URL
    """
    if not url:
        return ""
    
    url = url.strip()
    
    # Remove dangerous protocols
    if url.lower().startswith(('javascript:', 'data:', 'vbscript:')):
        return ""
    
    # Only allow http/https
    if not url.lower().startswith(('http://', 'https://')):
        return ""
    
    return url


def sanitize_email(email: str) -> str:
    """
    Sanitize email input
    
    Args:
        email: Email string
        
    Returns:
        Sanitized email or empty string if invalid
    """
    if not email:
        return ""
    
    email = email.strip().lower()
    
    # Basic email validation
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        return ""
    
    return email


def sanitize_vin(vin: str) -> str:
    """
    Sanitize VIN input
    
    Args:
        vin: VIN string
        
    Returns:
        Sanitized VIN (uppercase, alphanumeric only)
    """
    if not vin:
        return ""
    
    vin = vin.strip().upper()
    
    # Remove invalid characters (I, O, Q are not allowed in VINs)
    # But we'll let the decoder validate this
    vin = re.sub(r'[^A-Z0-9]', '', vin)
    
    return vin
