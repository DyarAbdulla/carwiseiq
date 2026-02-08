"""
Web scraper service for extracting car details from iqcars.net listings
"""

import logging
import re
from typing import Optional, Dict, Any
from bs4 import BeautifulSoup
import requests
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


def normalize_condition(condition_text: Optional[str]) -> str:
    """
    Normalize condition text to allowed values.

    Allowed values: 'New', 'Like New', 'Excellent', 'Good', 'Fair', 'Poor', 'Salvage'

    Args:
        condition_text: Raw condition text from scraping

    Returns:
        Normalized condition value
    """
    if not condition_text:
        return 'Good'  # Default

    condition_lower = condition_text.lower().strip()

    # Map various condition texts to allowed values
    condition_mapping = {
        # New
        'new': 'New',
        'brand new': 'New',
        'unused': 'New',

        # Like New
        'like new': 'Like New',
        'like-new': 'Like New',
        'as new': 'Like New',
        'almost new': 'Like New',
        'nearly new': 'Like New',

        # Excellent
        'excellent': 'Excellent',
        'excellent condition': 'Excellent',
        'mint': 'Excellent',
        'perfect': 'Excellent',
        'pristine': 'Excellent',
        'showroom': 'Excellent',
        'very good': 'Excellent',  # Some sites use "Very Good" for excellent
        'very-good': 'Excellent',

        # Good
        'good': 'Good',
        'good condition': 'Good',
        'well maintained': 'Good',
        'well-maintained': 'Good',
        'average': 'Good',
        'normal': 'Good',

        # Fair
        'fair': 'Fair',
        'fair condition': 'Fair',
        'acceptable': 'Fair',
        'decent': 'Fair',
        'ok': 'Fair',
        'okay': 'Fair',
        'usable': 'Fair',

        # Poor
        'poor': 'Poor',
        'poor condition': 'Poor',
        'bad': 'Poor',
        'worn': 'Poor',
        'worn out': 'Poor',
        'needs work': 'Poor',
        'needs-work': 'Poor',
        'needs repair': 'Poor',
        'needs-repair': 'Poor',

        # Salvage
        'salvage': 'Salvage',
        'salvaged': 'Salvage',
        'totaled': 'Salvage',
        'total loss': 'Salvage',
        'total-loss': 'Salvage',
        'rebuilt': 'Salvage',
        'rebuilt title': 'Salvage',
    }

    # Direct match
    if condition_lower in condition_mapping:
        return condition_mapping[condition_lower]

    # Partial match
    for key, value in condition_mapping.items():
        if key in condition_lower:
            return value

    # Default to Good if no match found
    logger.warning(f"Unknown condition value '{condition_text}', defaulting to 'Good'")
    return 'Good'


def normalize_fuel_type(fuel_text: Optional[str]) -> str:
    """
    Normalize fuel type text to allowed values.

    Allowed values: 'Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid', 'Other'

    Args:
        fuel_text: Raw fuel type text from scraping

    Returns:
        Normalized fuel type value
    """
    if not fuel_text:
        logger.info("Fuel type not provided, defaulting to 'Gasoline'")
        return 'Gasoline'  # Default

    fuel_lower = fuel_text.lower().strip()
    logger.info(f"Normalizing fuel type: '{fuel_text}' (lowercase: '{fuel_lower}')")

    # IMPORTANT: Check exact matches FIRST, in order of specificity
    # Most specific first (Plug-in Hybrid, then Hybrid, then Electric, etc.)

    # Exact match mapping (most specific to least specific)
    exact_mappings = {
        # Plug-in Hybrid (most specific - check first)
        'plug-in hybrid': 'Plug-in Hybrid',
        'plug in hybrid': 'Plug-in Hybrid',
        'phev': 'Plug-in Hybrid',
        'plug-in': 'Plug-in Hybrid',
        'plugin hybrid': 'Plug-in Hybrid',
        'gasoline plug-in hybrid': 'Plug-in Hybrid',
        'petrol plug-in hybrid': 'Plug-in Hybrid',

        # Hybrid (check before Electric to avoid misclassification)
        'hybrid': 'Hybrid',
        'hybrid electric': 'Hybrid',
        'hev': 'Hybrid',
        'gasoline hybrid': 'Hybrid',
        'petrol hybrid': 'Hybrid',

        # Electric (check after Hybrid)
        'electric': 'Electric',
        'ev': 'Electric',
        'electric vehicle': 'Electric',
        'battery electric': 'Electric',
        'bev': 'Electric',
        'battery': 'Electric',  # Note: 'battery' alone might be ambiguous, but common usage

        # Gasoline
        'gasoline': 'Gasoline',
        'gas': 'Gasoline',
        'petrol': 'Gasoline',
        'benzine': 'Gasoline',
        'benzin': 'Gasoline',
        'unleaded': 'Gasoline',
        'regular': 'Gasoline',
        'premium': 'Gasoline',

        # Diesel
        'diesel': 'Diesel',
        'diesel fuel': 'Diesel',

        # Other
        'other': 'Other',
        'unknown': 'Other',
        'flex fuel': 'Other',
        'e85': 'Other',
        'cng': 'Other',
        'lpg': 'Other',
        'natural gas': 'Other',
    }

    # Step 1: Check for exact match first
    if fuel_lower in exact_mappings:
        result = exact_mappings[fuel_lower]
        logger.info(f"Exact match found: '{fuel_text}' -> '{result}'")
        return result

    # Step 2: Check for partial matches, but prioritize more specific terms
    # IMPORTANT: Check longer/more specific phrases first to avoid false matches
    # Check in order: Plug-in Hybrid, Hybrid, Electric, then others
    partial_match_order = [
        ('plug-in hybrid', 'Plug-in Hybrid'),
        ('plug in hybrid', 'Plug-in Hybrid'),
        ('phev', 'Plug-in Hybrid'),
        ('hybrid electric', 'Hybrid'),  # Check "hybrid electric" before just "hybrid" or "electric"
        ('gasoline hybrid', 'Hybrid'),
        ('petrol hybrid', 'Hybrid'),
        ('hev', 'Hybrid'),
        ('hybrid', 'Hybrid'),  # Check Hybrid before Electric (but after hybrid electric)
        ('battery electric', 'Electric'),  # Check "battery electric" before just "battery" or "electric"
        ('bev', 'Electric'),
        ('electric vehicle', 'Electric'),
        ('electric', 'Electric'),  # Check Electric after Hybrid
        ('ev', 'Electric'),
        # Don't match "battery" alone - too ambiguous
        ('gasoline', 'Gasoline'),
        ('petrol', 'Gasoline'),
        ('benzin', 'Gasoline'),
        ('benzine', 'Gasoline'),
        ('gas', 'Gasoline'),
        ('diesel', 'Diesel'),
    ]

    for key, value in partial_match_order:
        if key in fuel_lower:
            result = value
            logger.info(f"Partial match found: '{fuel_text}' contains '{key}' -> '{result}'")
            return result

    # Default to Gasoline if no match found
    logger.warning(f"Unknown fuel type value '{fuel_text}', defaulting to 'Gasoline'")
    return 'Gasoline'


def validate_cylinders(cylinders: Optional[int]) -> int:
    """
    Validate cylinders value to be between 1-12.

    Args:
        cylinders: Extracted cylinders value

    Returns:
        Validated cylinders value (1-12), defaults to 4 if invalid
    """
    if cylinders is None:
        logger.info("Cylinders not found, defaulting to 4")
        return 4

    try:
        cylinders_int = int(cylinders)
        if 1 <= cylinders_int <= 12:
            return cylinders_int
        else:
            logger.warning(f"Invalid cylinders value '{cylinders}' (must be 1-12), defaulting to 4")
            return 4
    except (ValueError, TypeError):
        logger.warning(f"Invalid cylinders value '{cylinders}' (not a number), defaulting to 4")
        return 4


class CarListingScraper:
    """Scraper for extracting car details from iqcars.net listing pages"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })

    def scrape_car_listing(self, url: str) -> Dict[str, Any]:
        """
        Scrape car listing page and extract car details

        Args:
            url: URL of the car listing page (e.g., https://www.iqcars.net/en/car/...)

        Returns:
            Dictionary with extracted car details:
            - year: int
            - make: str
            - model: str
            - mileage: float (in km)
            - condition: str
            - fuel_type: str
            - engine_size: float
            - cylinders: int
            - location: str
            - listing_price: float (if found)
            - raw_html: str (for debugging)
        """
        try:
            # Validate URL
            parsed_url = urlparse(url)
            if not parsed_url.netloc or 'iqcars.net' not in parsed_url.netloc:
                raise ValueError("Invalid URL. Must be from iqcars.net")

            # Fetch the page
            logger.info(f"Fetching car listing from: {url}")
            response = self.session.get(url, timeout=30)  # Increased timeout for slow pages
            response.raise_for_status()

            # Set encoding to handle Arabic/Kurdish text
            response.encoding = 'utf-8'

            # Extract car details
            car_data = {
                'year': None,
                'make': None,
                'model': None,
                'mileage': None,
                'condition': None,
                'fuel_type': None,
                'engine_size': None,
                'cylinders': None,
                'location': None,
                'listing_price': None,
            }

            # Try to extract JSON data from the page (iqcars.net embeds JSON in script tags or page props)
            import json
            page_text = response.text

            # Method 1: Look for JSON in __NEXT_DATA__ or similar script tags
            json_patterns = [
                r'<script[^>]*id="__NEXT_DATA__"[^>]*>(.+?)</script>',
                r'__NEXT_DATA__\s*=\s*({.+?})\s*;',
                r'window\.__NEXT_DATA__\s*=\s*({.+?})\s*;',
            ]

            json_data = None
            for pattern in json_patterns:
                match = re.search(pattern, page_text, re.DOTALL)
                if match:
                    try:
                        json_str = match.group(1)
                        # Try to parse as JSON
                        json_data = json.loads(json_str)
                        logger.info("Found JSON data in page via pattern matching")
                        break
                    except json.JSONDecodeError:
                        # Try to find a valid JSON object within the match
                        # Look for the first complete JSON object
                        try:
                            # Find the first { and try to parse from there
                            start_idx = json_str.find('{')
                            if start_idx >= 0:
                                # Try to find matching closing brace
                                brace_count = 0
                                end_idx = start_idx
                                for i, char in enumerate(json_str[start_idx:], start_idx):
                                    if char == '{':
                                        brace_count += 1
                                    elif char == '}':
                                        brace_count -= 1
                                        if brace_count == 0:
                                            end_idx = i + 1
                                            break
                                if end_idx > start_idx:
                                    json_data = json.loads(json_str[start_idx:end_idx])
                                    logger.info("Found JSON data by extracting object")
                                    break
                        except:
                            continue
                    except:
                        continue

            # Method 2: Look for JSON-LD structured data
            soup = None
            if not json_data:
                try:
                    soup = BeautifulSoup(response.text, 'html.parser')
                    json_ld = soup.find('script', type='application/ld+json')
                    if json_ld:
                        json_data = json.loads(json_ld.string)
                        logger.info("Found JSON-LD data")
                except:
                    pass

            # Extract from JSON data if found
            if json_data:
                try:
                    # Navigate through the JSON structure to find car data
                    # The structure might be in props.pageProps or similar
                    car_info = None

                    # Try different possible JSON structures
                    if isinstance(json_data, dict):
                        # First, check if car data is directly at root (most common case)
                        if 'BrandNameen' in json_data or 'ModelNameen' in json_data or 'BrandName' in json_data or 'ModelName' in json_data:
                            car_info = json_data
                            logger.info("Found car data at root level of JSON")

                        # Check for pageProps (Next.js structure)
                        if not car_info and 'props' in json_data:
                            props = json_data['props']
                            if isinstance(props, dict):
                                # Check pageProps
                                if 'pageProps' in props:
                                    page_props = props['pageProps']
                                    if isinstance(page_props, dict):
                                        # Check if car data is directly in pageProps
                                        if 'BrandNameen' in page_props or 'ModelNameen' in page_props or 'BrandName' in page_props or 'ModelName' in page_props:
                                            car_info = page_props
                                            logger.info("Found car data in pageProps")
                                        # Check for nested data
                                        elif 'data' in page_props:
                                            nested_data = page_props['data']
                                            if isinstance(nested_data, dict) and ('BrandNameen' in nested_data or 'ModelNameen' in nested_data):
                                                car_info = nested_data
                                                logger.info("Found car data in pageProps.data")
                                        elif 'car' in page_props:
                                            car_obj = page_props['car']
                                            if isinstance(car_obj, dict):
                                                car_info = car_obj
                                                logger.info("Found car data in pageProps.car")
                                        # Check for query data
                                        elif 'query' in page_props and isinstance(page_props['query'], dict):
                                            query_data = page_props['query']
                                            if 'data' in query_data:
                                                query_nested = query_data['data']
                                                if isinstance(query_nested, dict) and ('BrandNameen' in query_nested or 'ModelNameen' in query_nested):
                                                    car_info = query_nested
                                                    logger.info("Found car data in pageProps.query.data")

                        # Check for nested structures at root
                        if not car_info and 'query' in json_data:
                            query = json_data['query']
                            if isinstance(query, dict):
                                if 'data' in query:
                                    query_data = query['data']
                                    if isinstance(query_data, dict) and ('BrandNameen' in query_data or 'ModelNameen' in query_data):
                                        car_info = query_data
                                        logger.info("Found car data in query.data")
                                # Also check if query itself has the data
                                elif 'BrandNameen' in query or 'ModelNameen' in query:
                                    car_info = query
                                    logger.info("Found car data in query")

                        # Last resort: check if it's a list and first item has car data
                        if not car_info and isinstance(json_data, list) and len(json_data) > 0:
                            first_item = json_data[0]
                            if isinstance(first_item, dict) and ('BrandNameen' in first_item or 'ModelNameen' in first_item):
                                car_info = first_item
                                logger.info("Found car data in JSON array first item")

                    if car_info and isinstance(car_info, dict):
                        # Extract make (prefer English, fallback to Arabic/Kurdish)
                        if not car_data['make']:
                            make = car_info.get('BrandNameen') or car_info.get('BrandName') or car_info.get('BrandNameen')
                            if make:
                                # Clean the make - remove any JSON artifacts
                                make = str(make).strip()
                                # If it's still a huge string, try to extract just the brand name
                                if len(make) > 50:
                                    # Try to find "Ford" or similar in the string
                                    brand_match = re.search(r'\b(Ford|Toyota|Honda|BMW|Mercedes|Nissan|Hyundai|Kia|Chevrolet|Volkswagen|Audi|Lexus|Mazda|Subaru|Jeep|Dodge|GMC|Cadillac|Lincoln|Infiniti|Acura|Volvo|Porsche|Jaguar|Land Rover|Range Rover|Mini|Fiat|Peugeot|Renault|Citroen|Opel|Skoda|Seat|Alfa Romeo|Mitsubishi|Suzuki|Isuzu|Daewoo|Ssangyong)\b', make, re.I)
                                    if brand_match:
                                        make = brand_match.group(1)
                                    else:
                                        # If still too long, take first word
                                        make = make.split()[0] if make.split() else None
                                if make and len(make) < 50:
                                    car_data['make'] = make
                                    logger.info(f"Extracted make from JSON: {make}")

                        # Extract model (prefer English)
                        if not car_data['model']:
                            model = car_info.get('ModelNameen') or car_info.get('ModelName') or car_info.get('model')
                            if model:
                                model = str(model).strip()
                                # Clean model name
                                if len(model) > 100:
                                    # Try to extract just the model name
                                    model_parts = model.split()
                                    if model_parts:
                                        model = ' '.join(model_parts[:3])  # Take first 3 words max
                                if model and len(model) < 100:
                                    car_data['model'] = model
                                    logger.info(f"Extracted model from JSON: {model}")

                        # Extract year
                        if not car_data['year']:
                            year = car_info.get('YearName') or car_info.get('Year') or car_info.get('year') or car_info.get('FromYear')
                            if year:
                                try:
                                    year_int = int(str(year).strip())
                                    if 1950 <= year_int <= 2025:
                                        car_data['year'] = year_int
                                        logger.info(f"Extracted year from JSON: {year_int}")
                                except:
                                    pass

                        # Extract mileage (VisitedKm)
                        if not car_data['mileage']:
                            mileage = car_info.get('VisitedKm') or car_info.get('Mileage') or car_info.get('mileage')
                            if mileage:
                                try:
                                    mileage_float = float(str(mileage).replace(',', '').strip())
                                    if mileage_float >= 0:
                                        car_data['mileage'] = mileage_float
                                        logger.info(f"Extracted mileage from JSON: {mileage_float}")
                                except:
                                    pass

                        # Extract condition (prefer English)
                        if not car_data['condition']:
                            condition = car_info.get('CarConditionNameen') or car_info.get('CarConditionName') or car_info.get('condition')
                            if condition:
                                condition = str(condition).strip()
                                # Map common conditions
                                condition_lower = condition.lower()
                                if 'used' in condition_lower or 'مستعمل' in condition or 'بەکارهاتوو' in condition:
                                    condition = 'Good'  # Will be normalized later
                                elif 'new' in condition_lower or 'جديد' in condition or 'نوێ' in condition:
                                    condition = 'New'
                                if condition and len(condition) < 50:
                                    car_data['condition'] = condition
                                    logger.info(f"Extracted condition from JSON: {condition}")

                        # Extract fuel type (prefer English)
                        if not car_data['fuel_type']:
                            # First, log all fuel-related fields for debugging
                            fuel_related_fields = {k: v for k, v in car_info.items() if 'fuel' in k.lower()}
                            if fuel_related_fields:
                                logger.info(f"Found fuel-related fields in JSON: {list(fuel_related_fields.keys())}")
                                for key, value in fuel_related_fields.items():
                                    logger.info(f"  {key} = {str(value)[:100]}")

                            # Try multiple fuel type field names
                            fuel = None
                            fuel_field_names = [
                                'FuelTypeNameen',  # English fuel type name
                                'FuelTypeName',    # Fuel type name
                                'FuelNameen',      # English fuel name
                                'FuelName',        # Fuel name
                                'fuel_type',       # Generic fuel type
                                'FuelType',        # Fuel type
                            ]

                            # Also check for any field containing 'fuel' (case-insensitive)
                            for key, value in car_info.items():
                                if 'fuel' in key.lower() and value and not fuel:
                                    fuel_str = str(value).strip()
                                    if len(fuel_str) < 50 and not fuel_str.startswith('{'):
                                        fuel = fuel_str
                                        logger.info(f"Extracted fuel_type from field '{key}': {fuel}")
                                        break

                            # If not found in 'fuel' fields, try the specific field names
                            if not fuel:
                                for field_name in fuel_field_names:
                                    fuel_value = car_info.get(field_name)
                                    if fuel_value:
                                        fuel_str = str(fuel_value).strip()
                                        if len(fuel_str) < 50 and not fuel_str.startswith('{'):
                                            fuel = fuel_str
                                            logger.info(f"Extracted fuel_type from field '{field_name}': {fuel}")
                                            break

                            if fuel:
                                car_data['fuel_type'] = fuel
                                logger.info(f"Raw fuel_type extracted: '{fuel}'")
                            else:
                                logger.warning("Could not extract fuel_type from JSON data")
                                # Log a sample of the JSON structure for debugging
                                sample_keys = list(car_info.keys())[:20]  # First 20 keys
                                logger.warning(f"Available JSON keys (sample): {sample_keys}")
                                # Log full JSON if it's not too large (for debugging)
                                try:
                                    import json
                                    json_str = json.dumps(car_info, indent=2, ensure_ascii=False)
                                    if len(json_str) < 5000:  # Only log if reasonable size
                                        logger.info(f"Full car_info JSON structure:\n{json_str}")
                                    else:
                                        logger.info(f"JSON too large to log ({len(json_str)} chars), but fuel-related fields logged above")
                                except:
                                    pass

                        # Extract engine size (EngineName might be in liters or cc)
                        if not car_data['engine_size']:
                            engine = car_info.get('EngineName') or car_info.get('EngineSize') or car_info.get('engine_size')
                            if engine:
                                try:
                                    engine_str = str(engine).strip()
                                    # Try to extract number
                                    engine_match = re.search(r'([\d.]+)', engine_str)
                                    if engine_match:
                                        engine_size = float(engine_match.group(1))
                                        # If > 100, assume it's in cc, convert to liters
                                        if engine_size > 100:
                                            engine_size = engine_size / 1000
                                        car_data['engine_size'] = engine_size
                                        logger.info(f"Extracted engine_size from JSON: {engine_size}")
                                except:
                                    pass

                        # Extract cylinders (CylinderName might be "8 cylinder" or just "8")
                        if not car_data['cylinders']:
                            cylinders = car_info.get('CylinderName') or car_info.get('Cylinders') or car_info.get('cylinders')
                            if cylinders:
                                try:
                                    cyl_str = str(cylinders).strip()
                                    # Extract number from string like "8 cylinder" or "8"
                                    cyl_match = re.search(r'(\d+)', cyl_str)
                                    if cyl_match:
                                        car_data['cylinders'] = int(cyl_match.group(1))
                                        logger.info(f"Extracted cylinders from JSON: {car_data['cylinders']}")
                                except:
                                    pass

                        # Extract location (prefer English)
                        if not car_data['location']:
                            # Try multiple location field names
                            location = None
                            for field_name in ['LocationNameen', 'LocationName', 'location', 'Location', 'CityNameen', 'CityName']:
                                loc_value = car_info.get(field_name)
                                if loc_value:
                                    loc_str = str(loc_value).strip()
                                    # Skip if it looks like JSON (starts with { or contains many special chars)
                                    if not loc_str.startswith('{') and len(loc_str) < 100 and not re.search(r'[{}[\]]', loc_str):
                                        location = loc_str
                                        logger.info(f"Extracted location from field '{field_name}': {location}")
                                        break

                            if location:
                                # Clean location - remove any JSON artifacts
                                if len(location) > 100:
                                    # Try to extract just the location name
                                    # Look for common location patterns
                                    loc_match = re.search(r'\b(Zaxo|Duhok|Erbil|Baghdad|Basra|Mosul|Kirkuk|Sulaymaniyah|Najaf|Karbala|Nasiriyah|Ramadi|Fallujah|Samarra|Baqubah|Amara|Diwaniyah|Kut|Hillah|Halabja)\b', location, re.I)
                                    if loc_match:
                                        location = loc_match.group(1)
                                    else:
                                        # If still too long, take first reasonable word
                                        first_word = location.split()[0] if location.split() else ''
                                        if first_word and len(first_word) < 30 and not first_word.startswith('{'):
                                            location = first_word
                                        else:
                                            location = 'Unknown'

                                # Final validation - ensure it's not JSON
                                if location and len(location) < 100 and not location.startswith('{') and not location.startswith('['):
                                    car_data['location'] = location
                                    logger.info(f"Final location value: {location}")
                                else:
                                    logger.warning(f"Location value rejected (looks like JSON or too long): {location[:50]}")
                                    car_data['location'] = 'Unknown'

                        # Extract listing price
                        if not car_data['listing_price']:
                            price = car_info.get('Price') or car_info.get('price') or car_info.get('LastPrice')
                            if price:
                                try:
                                    price_float = float(str(price).replace(',', '').strip())
                                    if price_float > 0:
                                        car_data['listing_price'] = price_float
                                        logger.info(f"Extracted listing_price from JSON: {price_float}")
                                except:
                                    pass

                except Exception as e:
                    logger.warning(f"Error parsing JSON data: {e}")

            # Fallback: Parse HTML if JSON extraction didn't work
            if not car_data['make'] or not car_data['model']:
                try:
                    if soup is None:
                        soup = BeautifulSoup(response.text, 'html.parser')

                    # Extract from title
                    title = soup.find('title')
                    if title:
                        title_text = title.get_text()
                        # Try to extract make/model/year from title
                        # Common pattern: "2020 Toyota Camry - iqcars.net"
                        year_match = re.search(r'\b(19|20)\d{2}\b', title_text)
                        if year_match and not car_data['year']:
                            car_data['year'] = int(year_match.group())

                        # Try to extract make/model from title
                        if not car_data['make'] or not car_data['model']:
                            # Pattern: "Ford Thunderbird 1980"
                            title_match = re.search(r'([A-Za-z]+)\s+([A-Za-z]+)\s+(\d{4})', title_text)
                            if title_match:
                                if not car_data['make']:
                                    car_data['make'] = title_match.group(1)
                                if not car_data['model']:
                                    car_data['model'] = title_match.group(2)
                                if not car_data['year']:
                                    car_data['year'] = int(title_match.group(3))
                except:
                    pass

            # 3. Extract from common HTML elements (divs, spans, etc.) - only if soup is available
            if soup:
                # Look for price
                price_patterns = [
                    soup.find('span', class_=re.compile(r'price', re.I)),
                    soup.find('div', class_=re.compile(r'price', re.I)),
                    soup.find('span', id=re.compile(r'price', re.I)),
                    soup.find(string=re.compile(r'\$\s*[\d,]+', re.I)),
                ]

                for price_elem in price_patterns:
                    if price_elem:
                        price_text = price_elem.get_text() if hasattr(price_elem, 'get_text') else str(price_elem)
                        price_match = re.search(r'[\d,]+', price_text.replace(',', '').replace('$', ''))
                        if price_match:
                            car_data['listing_price'] = float(price_match.group().replace(',', ''))
                            break

                # 4. Extract from table or list of specifications
                # Look for common spec patterns
                spec_labels = {
                    'year': ['year', 'model year', 'manufacture year'],
                    'make': ['make', 'brand', 'manufacturer'],
                    'model': ['model', 'car model'],
                    'mileage': ['mileage', 'odometer', 'km', 'kilometers'],
                    'condition': ['condition', 'state', 'quality'],
                    'fuel_type': ['fuel', 'fuel type', 'fuel system'],
                    'engine_size': ['engine', 'engine size', 'displacement', 'cc'],
                    'cylinders': ['cylinders', 'cylinder'],
                    'location': ['location', 'city', 'region', 'area'],
                }

                # Search for spec tables or lists
                for label_key, search_terms in spec_labels.items():
                    for term in search_terms:
                        # Look for label followed by value
                        pattern = re.compile(rf'{term}[\s:]*([^\n<]+)', re.I)
                        matches = soup.find_all(string=pattern)
                        for match in matches:
                            parent = match.parent if hasattr(match, 'parent') else None
                            if parent:
                                # Try to find value in next sibling or same element
                                value_text = parent.get_text() if hasattr(parent, 'get_text') else str(match)
                                value_match = re.search(rf'{term}[\s:]*([^\n<]+)', value_text, re.I)
                                if value_match:
                                    value = value_match.group(1).strip()

                                    # Parse based on field type
                                    if label_key == 'year' and not car_data['year']:
                                        year_match = re.search(r'\b(19|20)\d{2}\b', value)
                                        if year_match:
                                            car_data['year'] = int(year_match.group())
                                    elif label_key == 'mileage' and not car_data['mileage']:
                                        mileage_match = re.search(r'([\d,]+)', value.replace(',', ''))
                                        if mileage_match:
                                            car_data['mileage'] = float(mileage_match.group().replace(',', ''))
                                    elif label_key == 'engine_size' and not car_data['engine_size']:
                                        engine_match = re.search(r'([\d.]+)', value)
                                        if engine_match:
                                            car_data['engine_size'] = float(engine_match.group())
                                    elif label_key == 'cylinders' and not car_data['cylinders']:
                                        cyl_match = re.search(r'(\d+)', value)
                                        if cyl_match:
                                            car_data['cylinders'] = int(cyl_match.group())
                                    elif label_key in ['make', 'model', 'condition', 'fuel_type', 'location']:
                                        if not car_data[label_key]:
                                            # Clean the value
                                            clean_value = re.sub(r'[^\w\s-]', '', value).strip()
                                            if clean_value:
                                                car_data[label_key] = clean_value

                # 5. Extract from page text using regex patterns
                page_text = soup.get_text()
            else:
                # If no soup, use raw response text
                page_text = response.text

            # Year pattern
            if not car_data['year']:
                year_match = re.search(r'\b(19|20)\d{2}\b', page_text)
                if year_match:
                    year = int(year_match.group())
                    if 1950 <= year <= 2025:  # Reasonable year range
                        car_data['year'] = year

            # Mileage pattern (look for numbers followed by km/miles)
            if not car_data['mileage']:
                mileage_patterns = [
                    r'([\d,]+)\s*(?:km|kilometers?|miles?)',
                    r'(?:mileage|odometer)[\s:]*([\d,]+)',
                ]
                for pattern in mileage_patterns:
                    match = re.search(pattern, page_text, re.I)
                    if match:
                        mileage = float(match.group(1).replace(',', ''))
                        car_data['mileage'] = mileage
                        break

            # Engine size pattern
            if not car_data['engine_size']:
                engine_patterns = [
                    r'([\d.]+)\s*(?:L|l|liter|liters)',
                    r'(\d+)\s*(?:cc|cm³)',
                ]
                for pattern in engine_patterns:
                    match = re.search(pattern, page_text, re.I)
                    if match:
                        engine_size = float(match.group(1))
                        # Convert cc to liters if needed
                        if engine_size > 100:
                            engine_size = engine_size / 1000
                        car_data['engine_size'] = engine_size
                        break

            # Cylinders pattern
            if not car_data['cylinders']:
                cyl_match = re.search(r'(\d+)\s*(?:cylinders?|cyl)', page_text, re.I)
                if cyl_match:
                    car_data['cylinders'] = int(cyl_match.group(1))

            # Log extracted values before normalization for debugging
            logger.info(f"Raw extracted car data before normalization: {car_data}")

            # Normalize and validate values
            # Condition normalization
            raw_condition = car_data.get('condition')
            if raw_condition:
                car_data['condition'] = normalize_condition(raw_condition)
                if raw_condition != car_data['condition']:
                    logger.info(f"Normalized condition: '{raw_condition}' -> '{car_data['condition']}'")
            else:
                car_data['condition'] = 'Good'  # Default
                logger.info("Condition not found, defaulting to 'Good'")

            # Fuel type normalization
            raw_fuel_type = car_data.get('fuel_type')
            if raw_fuel_type:
                logger.info(f"[FUEL TYPE] Starting normalization - raw extracted value: '{raw_fuel_type}'")
                normalized_fuel = normalize_fuel_type(raw_fuel_type)
                car_data['fuel_type'] = normalized_fuel
                if raw_fuel_type != normalized_fuel:
                    logger.info(f"[FUEL TYPE] Normalized: '{raw_fuel_type}' -> '{normalized_fuel}'")
                else:
                    logger.info(f"[FUEL TYPE] Unchanged after normalization: '{raw_fuel_type}'")
            else:
                car_data['fuel_type'] = 'Gasoline'  # Default
                logger.warning("[FUEL TYPE] Not found in extracted data, defaulting to 'Gasoline'")

            # Cylinders validation
            raw_cylinders = car_data.get('cylinders')
            car_data['cylinders'] = validate_cylinders(raw_cylinders)
            if raw_cylinders != car_data['cylinders']:
                logger.info(f"Validated cylinders: '{raw_cylinders}' -> '{car_data['cylinders']}'")

            # Set defaults for missing values (as specified)
            if not car_data['year']:
                car_data['year'] = 2020  # Default
                logger.info("Year not found, defaulting to 2020")
            if not car_data['mileage']:
                car_data['mileage'] = 50000  # Default
                logger.info("Mileage not found, defaulting to 50000")
            if not car_data['engine_size']:
                car_data['engine_size'] = 2.0  # Default (changed from 2.5)
                logger.info("Engine size not found, defaulting to 2.0")
            if not car_data['cylinders']:
                car_data['cylinders'] = 4  # Default (handled by validate_cylinders)
            if not car_data['condition']:
                car_data['condition'] = 'Good'  # Default (handled by normalize_condition)
            if not car_data['fuel_type']:
                car_data['fuel_type'] = 'Gasoline'  # Default (handled by normalize_fuel_type)
            # Try to extract location from URL path as fallback (if location is missing, Unknown, or invalid)
            location_value = car_data.get('location', '')
            location_str = str(location_value) if location_value else ''
            if not location_str or location_str == 'Unknown' or len(location_str) > 100 or location_str.startswith('{') or location_str.startswith('['):
                # URL pattern: https://www.iqcars.net/en/car/{location}/...
                parsed = urlparse(url)
                path_parts = [p for p in parsed.path.split('/') if p]  # Remove empty parts

                # Find the index of 'car' in the path
                if 'car' in path_parts:
                    car_idx = path_parts.index('car')
                    if car_idx + 1 < len(path_parts):
                        potential_location = path_parts[car_idx + 1]
                        if potential_location and potential_location not in ['en', 'ar', 'ku'] and len(potential_location) < 50:
                            # Check if it's a known location
                            known_locations = ['zaxo', 'duhok', 'erbil', 'baghdad', 'basra', 'mosul', 'kirkuk', 'sulaymaniyah', 'najaf', 'karbala', 'nasiriyah', 'ramadi', 'fallujah', 'samarra', 'baqubah', 'amara', 'diwaniyah', 'kut', 'hillah', 'halabja']
                            if potential_location.lower() in known_locations:
                                car_data['location'] = potential_location.capitalize()
                                logger.info(f"Extracted location from URL path: {car_data['location']}")
                            elif len(potential_location) < 30 and not potential_location.startswith('{') and potential_location.isalpha():
                                # Use it if it looks reasonable (alphabetic, not too long)
                                car_data['location'] = potential_location.capitalize()
                                logger.info(f"Using location from URL path: {car_data['location']}")

            # Set default if still not found
            if not car_data.get('location') or str(car_data.get('location', '')).strip() == '' or str(car_data.get('location', '')).strip() == 'Unknown' or len(str(car_data.get('location', ''))) > 100:
                car_data['location'] = 'Unknown'  # Default
                logger.info("Location not found, defaulting to 'Unknown'")

            logger.info(f"Final normalized car data: {car_data}")
            return car_data

        except requests.RequestException as e:
            logger.error(f"Error fetching URL: {e}")
            raise ValueError(f"Failed to fetch URL: {str(e)}")
        except Exception as e:
            logger.error(f"Error scraping car listing: {e}", exc_info=True)
            raise ValueError(f"Failed to scrape car listing: {str(e)}")
