"""
IQCars.net scraper (Iraq)
URL pattern: https://www.iqcars.net/car/[id] or https://www.iqcars.net/en/car/[location]/[id]
Handles Arabic and English content
"""

import re
import json
import logging
from typing import Dict, Any
from urllib.parse import urlparse
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class IQCarsScraper(BaseScraper):
    """Scraper for IQCars.net listings"""
    
    def can_handle(self, url: str) -> bool:
        """Check if URL is from IQCars"""
        parsed = urlparse(url)
        return 'iqcars.net' in parsed.netloc.lower() and 'car' in parsed.path.lower()
    
    def scrape(self, url: str) -> Dict[str, Any]:
        """Scrape car data from IQCars.net"""
        try:
            response = self._fetch_with_retry(url)
            soup = self._parse_html(response.text)
            
            car_data = {}
            
            # Try to extract from JSON data in page (IQCars uses React/Next.js)
            scripts = soup.find_all('script')
            for script in scripts:
                script_text = script.string or ''
                # Look for various JSON data patterns
                if '__NEXT_DATA__' in script_text or 'window.__INITIAL_STATE__' in script_text or '__NEXT_DATA__' in script_text:
                    try:
                        # Try to find JSON object
                        json_match = re.search(r'__NEXT_DATA__\s*=\s*({.+?});', script_text, re.DOTALL)
                        if not json_match:
                            json_match = re.search(r'({.+})', script_text, re.DOTALL)
                        
                        if json_match:
                            data = json.loads(json_match.group(1))
                            car_info = self._extract_from_json(data)
                            if car_info:
                                car_data.update(car_info)
                                logger.info(f"Extracted data from JSON: {car_info}")
                                break
                    except (json.JSONDecodeError, KeyError, ValueError) as e:
                        logger.debug(f"Failed to parse JSON from script: {e}")
                        continue
            
            # Extract from meta tags (Open Graph, etc.)
            if not car_data.get('make'):
                og_title = soup.find('meta', property='og:title')
                if og_title and og_title.get('content'):
                    title = og_title.get('content')
                    match = re.search(r'(\d{4})\s+([A-Za-z]+)\s+(.+)', title)
                    if match:
                        car_data['year'] = int(match.group(1))
                        car_data['make'] = match.group(2)
                        car_data['model'] = match.group(3).split('-')[0].strip()
            
            # Extract from page title
            if not car_data.get('make'):
                title_tag = soup.find('title')
                if title_tag:
                    title = title_tag.get_text()
                    # More flexible pattern matching
                    match = re.search(r'(\d{4})\s+([A-Za-z]+(?:\s+[A-Za-z]+)?)\s+(.+)', title)
                    if match:
                        car_data['year'] = int(match.group(1))
                        car_data['make'] = match.group(2).strip()
                        car_data['model'] = match.group(3).split('-')[0].strip()
            
            # Extract price (IQD) - look in multiple places
            if not car_data.get('price'):
                # Look for price in various HTML elements
                price_patterns = [
                    soup.find(string=re.compile(r'IQD|دينار|[\d,]+', re.I)),
                    soup.find('span', class_=re.compile(r'price', re.I)),
                    soup.find('div', class_=re.compile(r'price', re.I)),
                    soup.find('p', class_=re.compile(r'price', re.I)),
                ]
                
                for price_elem in price_patterns:
                    if price_elem:
                        if hasattr(price_elem, 'get_text'):
                            price_text = price_elem.get_text()
                        elif hasattr(price_elem, 'parent'):
                            price_text = self._extract_text(price_elem.parent)
                        else:
                            price_text = str(price_elem)
                        
                        price = self._extract_number(price_text)
                        if price and price > 1000:  # Valid IQD price
                            car_data['price'] = price
                            car_data['listing_price'] = price
                            break
            
            # Extract mileage - look in multiple places
            if not car_data.get('mileage'):
                mileage_patterns = [
                    soup.find(string=re.compile(r'km|kilometer|كم', re.I)),
                    soup.find('span', class_=re.compile(r'mileage|km', re.I)),
                    soup.find('div', class_=re.compile(r'mileage|km', re.I)),
                ]
                
                for mileage_elem in mileage_patterns:
                    if mileage_elem:
                        if hasattr(mileage_elem, 'get_text'):
                            mileage_text = mileage_elem.get_text()
                        elif hasattr(mileage_elem, 'parent'):
                            mileage_text = self._extract_text(mileage_elem.parent)
                        else:
                            mileage_text = str(mileage_elem)
                        
                        mileage = self._extract_number(mileage_text, 0)
                        if mileage and mileage > 0:
                            car_data['mileage'] = mileage
                            break
            
            # Extract location from URL path
            parsed = urlparse(url)
            path_parts = [p for p in parsed.path.split('/') if p]
            if 'car' in path_parts:
                car_idx = path_parts.index('car')
                if car_idx > 0:
                    location = path_parts[car_idx - 1]
                    if location not in ['en', 'ar', 'ku']:
                        car_data['location'] = location.capitalize()
            
            # Extract images
            images = []
            img_tags = soup.find_all('img')
            for img in img_tags:
                src = img.get('src') or img.get('data-src')
                if src and ('car' in src.lower() or 'vehicle' in src.lower() or 'listing' in src.lower()):
                    if src.startswith('http'):
                        images.append({'url': src})
                    elif src.startswith('/'):
                        images.append({'url': f"{parsed.scheme}://{parsed.netloc}{src}"})
            
            # Set defaults
            car_data.setdefault('year', 2020)
            car_data.setdefault('mileage', 50000)
            car_data.setdefault('condition', 'Good')
            car_data.setdefault('fuel_type', 'Gasoline')
            car_data.setdefault('location', 'Baghdad')
            car_data.setdefault('platform', 'IQCars.net')
            car_data.setdefault('currency', 'IQD')
            car_data.setdefault('images', images)
            
            # Validate required fields
            if not car_data.get('make') or not car_data.get('model'):
                logger.warning(f"Could not extract make/model from IQCars URL: {url}")
                raise ValueError("Could not extract make and model from the listing page")
            
            return car_data
            
        except ValueError:
            raise
        except Exception as e:
            logger.error(f"Error scraping IQCars URL {url}: {e}", exc_info=True)
            raise
    
    def _extract_from_json(self, data: dict) -> Dict[str, Any]:
        """Extract car data from JSON structure"""
        result = {}
        
        # Common paths in IQCars JSON structure
        paths = [
            ['props', 'pageProps', 'car'],
            ['props', 'pageProps', 'listing'],
            ['query', 'data'],
            ['car'],
        ]
        
        car_info = None
        for path in paths:
            current = data
            try:
                for key in path:
                    current = current[key]
                if isinstance(current, dict) and ('make' in current or 'BrandName' in current):
                    car_info = current
                    break
            except (KeyError, TypeError):
                continue
        
        if car_info:
            result['make'] = car_info.get('BrandNameen') or car_info.get('BrandName') or car_info.get('make', '')
            result['model'] = car_info.get('ModelNameen') or car_info.get('ModelName') or car_info.get('model', '')
            result['year'] = car_info.get('YearName') or car_info.get('Year') or car_info.get('year', 2020)
            result['mileage'] = car_info.get('VisitedKm') or car_info.get('Mileage') or car_info.get('mileage', 0)
            result['price'] = car_info.get('Price') or car_info.get('price')
            result['condition'] = self._normalize_condition(car_info.get('CarConditionNameen') or car_info.get('condition', 'Good'))
            result['fuel_type'] = self._normalize_fuel_type(car_info.get('FuelTypeNameen') or car_info.get('fuel_type', 'Gasoline'))
        
        return result
