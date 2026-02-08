"""
Dubizzle scraper
URL pattern: https://*.dubizzle.com/motors/used-cars/*
Handles multiple country domains (UAE, Egypt, Iraq, Lebanon)
"""

import re
import json
import logging
from typing import Dict, Any
from urllib.parse import urlparse
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class DubizzleScraper(BaseScraper):
    """Scraper for Dubizzle listings"""
    
    def can_handle(self, url: str) -> bool:
        """Check if URL is from Dubizzle"""
        parsed = urlparse(url)
        return 'dubizzle.com' in parsed.netloc.lower() and 'motors' in parsed.path.lower()
    
    def scrape(self, url: str) -> Dict[str, Any]:
        """Scrape car data from Dubizzle"""
        try:
            response = self._fetch_with_retry(url)
            soup = self._parse_html(response.text)
            
            car_data = {}
            
            # Try to extract from React props/JSON data embedded in page
            scripts = soup.find_all('script')
            for script in scripts:
                script_text = script.string or ''
                # Look for JSON data with car information
                if '__NEXT_DATA__' in script_text or 'window.__INITIAL_STATE__' in script_text:
                    try:
                        # Try to extract JSON object
                        json_match = re.search(r'({.+})', script_text, re.DOTALL)
                        if json_match:
                            data = json.loads(json_match.group(1))
                            # Navigate through structure to find car data
                            car_info = self._extract_from_json(data)
                            if car_info:
                                car_data.update(car_info)
                                break
                    except (json.JSONDecodeError, KeyError) as e:
                        logger.debug(f"Error parsing JSON from script: {e}")
                        continue
            
            # Extract from page title
            if not car_data.get('make'):
                title_tag = soup.find('title')
                if title_tag:
                    title = title_tag.get_text()
                    # Pattern: "2020 Toyota Camry - Dubai | Dubizzle"
                    match = re.search(r'(\d{4})\s+([A-Za-z]+)\s+(.+?)\s*[-|]', title)
                    if match:
                        car_data['year'] = int(match.group(1))
                        car_data['make'] = match.group(2)
                        car_data['model'] = match.group(3).strip()
            
            # Extract price (AED, EGP, IQD, LBP)
            if not car_data.get('price'):
                price_elem = soup.find(string=re.compile(r'AED|EGP|IQD|LBP|[\d,]+', re.I))
                if price_elem:
                    parent = price_elem.parent if hasattr(price_elem, 'parent') else None
                    if parent:
                        price_text = self._extract_text(parent)
                        price = self._extract_number(price_text)
                        if price:
                            car_data['price'] = price
            
            # Extract mileage
            if not car_data.get('mileage'):
                mileage_elem = soup.find(string=re.compile(r'km|kilometer|mileage', re.I))
                if mileage_elem:
                    parent = mileage_elem.parent if hasattr(mileage_elem, 'parent') else None
                    if parent:
                        mileage_text = self._extract_text(parent)
                        mileage = self._extract_number(mileage_text, 0)
                        car_data['mileage'] = mileage
            
            # Extract condition
            condition_elem = soup.find(string=re.compile(r'condition|excellent|good|fair', re.I))
            if condition_elem:
                car_data['condition'] = self._normalize_condition(self._extract_text(condition_elem))
            else:
                car_data['condition'] = 'Good'
            
            # Extract fuel type
            fuel_elem = soup.find(string=re.compile(r'fuel|gasoline|diesel|electric|hybrid', re.I))
            if fuel_elem:
                car_data['fuel_type'] = self._normalize_fuel_type(self._extract_text(fuel_elem))
            else:
                car_data['fuel_type'] = 'Gasoline'
            
            # Extract location from URL or page
            parsed = urlparse(url)
            if 'dubai' in parsed.netloc.lower():
                car_data['location'] = 'Dubai'
            elif 'abudhabi' in parsed.netloc.lower():
                car_data['location'] = 'Abu Dhabi'
            elif 'egypt' in parsed.netloc.lower() or 'eg' in parsed.netloc.lower():
                car_data['location'] = 'Cairo'
            elif 'iraq' in parsed.netloc.lower() or 'iq' in parsed.netloc.lower():
                car_data['location'] = 'Baghdad'
            elif 'lebanon' in parsed.netloc.lower() or 'lb' in parsed.netloc.lower():
                car_data['location'] = 'Beirut'
            
            # Determine currency based on domain
            currency_map = {
                'ae': 'AED',
                'eg': 'EGP',
                'iq': 'IQD',
                'lb': 'LBP',
            }
            currency = 'AED'  # Default
            for code, curr in currency_map.items():
                if code in parsed.netloc.lower():
                    currency = curr
                    break
            
            # Extract images
            images = []
            img_tags = soup.find_all('img', class_=re.compile(r'image|photo|gallery', re.I))
            for img in img_tags[:10]:
                src = img.get('src') or img.get('data-src')
                if src and src.startswith('http'):
                    images.append(src)
            car_data['images'] = images
            
            # Set defaults
            car_data.setdefault('year', 2020)
            car_data.setdefault('mileage', 50000)
            car_data.setdefault('condition', 'Good')
            car_data.setdefault('fuel_type', 'Gasoline')
            car_data.setdefault('location', 'Dubai')
            car_data.setdefault('platform', 'Dubizzle')
            car_data.setdefault('currency', currency)
            car_data.setdefault('images', [])
            
            return car_data
            
        except Exception as e:
            logger.error(f"Error scraping Dubizzle URL {url}: {e}")
            raise
    
    def _extract_from_json(self, data: dict) -> Dict[str, Any]:
        """Extract car data from JSON structure"""
        result = {}
        
        # Common paths to check
        paths = [
            ['props', 'pageProps', 'listing'],
            ['props', 'pageProps', 'car'],
            ['query', 'data'],
            ['listing'],
            ['car'],
        ]
        
        car_info = None
        for path in paths:
            current = data
            try:
                for key in path:
                    current = current[key]
                if isinstance(current, dict) and ('make' in current or 'brand' in current):
                    car_info = current
                    break
            except (KeyError, TypeError):
                continue
        
        if car_info:
            result['make'] = car_info.get('make') or car_info.get('brand') or car_info.get('brandName', '')
            result['model'] = car_info.get('model') or car_info.get('modelName', '')
            result['year'] = car_info.get('year') or car_info.get('manufactureYear', 2020)
            result['mileage'] = car_info.get('mileage') or car_info.get('odometer', 0)
            result['price'] = car_info.get('price') or car_info.get('listingPrice')
            result['condition'] = self._normalize_condition(car_info.get('condition', 'Good'))
            result['fuel_type'] = self._normalize_fuel_type(car_info.get('fuelType', 'Gasoline'))
            result['location'] = car_info.get('location') or car_info.get('city', 'Unknown')
        
        return result
