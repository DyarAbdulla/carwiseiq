"""
Cars.com scraper
URL pattern: https://www.cars.com/vehicledetail/*
"""

import re
import json
import logging
from typing import Dict, Any
from urllib.parse import urlparse
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class CarsComScraper(BaseScraper):
    """Scraper for Cars.com listings"""
    
    def can_handle(self, url: str) -> bool:
        """Check if URL is from Cars.com"""
        parsed = urlparse(url)
        return 'cars.com' in parsed.netloc.lower() and 'vehicledetail' in parsed.path
    
    def scrape(self, url: str) -> Dict[str, Any]:
        """Scrape car data from Cars.com"""
        try:
            response = self._fetch_with_retry(url)
            soup = self._parse_html(response.text)
            
            # Try to extract JSON-LD structured data
            json_ld_scripts = soup.find_all('script', type='application/ld+json')
            car_data = {}
            
            for script in json_ld_scripts:
                try:
                    data = json.loads(script.string)
                    if isinstance(data, dict) and data.get('@type') in ['Vehicle', 'Product']:
                        # Extract from structured data
                        if 'brand' in data:
                            car_data['make'] = data['brand'].get('name', '')
                        if 'name' in data:
                            name_parts = data['name'].split()
                            if len(name_parts) >= 2:
                                car_data['make'] = name_parts[0]
                                car_data['model'] = ' '.join(name_parts[1:])
                        if 'productionDate' in data:
                            car_data['year'] = int(data['productionDate'])
                        if 'mileageFromOdometer' in data:
                            mileage_value = data['mileageFromOdometer'].get('value', '')
                            car_data['mileage'] = self._extract_number(mileage_value, 0)
                        if 'offers' in data and 'price' in data['offers']:
                            car_data['price'] = float(data['offers']['price'])
                except (json.JSONDecodeError, KeyError, ValueError) as e:
                    logger.debug(f"Error parsing JSON-LD: {e}")
                    continue
            
            # Extract from page meta tags and content if JSON-LD didn't work
            if not car_data.get('make'):
                # Try to extract from title
                title_tag = soup.find('title')
                if title_tag:
                    title = title_tag.get_text()
                    # Pattern: "2020 Toyota Camry - Cars.com"
                    match = re.search(r'(\d{4})\s+([A-Za-z]+)\s+(.+)', title)
                    if match:
                        car_data['year'] = int(match.group(1))
                        car_data['make'] = match.group(2)
                        car_data['model'] = match.group(3).split('-')[0].strip()
            
            # Extract price
            if not car_data.get('price'):
                price_elem = soup.find('span', class_=re.compile(r'price', re.I))
                if price_elem:
                    price_text = self._extract_text(price_elem)
                    car_data['price'] = self._extract_number(price_text)
            
            # Extract mileage
            if not car_data.get('mileage'):
                mileage_elem = soup.find(string=re.compile(r'mileage|miles', re.I))
                if mileage_elem:
                    parent = mileage_elem.parent if hasattr(mileage_elem, 'parent') else None
                    if parent:
                        mileage_text = self._extract_text(parent)
                        car_data['mileage'] = self._extract_number(mileage_text, 0)
            
            # Extract condition (default to Good)
            car_data['condition'] = self._normalize_condition(
                soup.find(string=re.compile(r'condition', re.I)) or 'Good'
            )
            
            # Extract fuel type
            fuel_elem = soup.find(string=re.compile(r'fuel|gasoline|diesel|electric|hybrid', re.I))
            if fuel_elem:
                car_data['fuel_type'] = self._normalize_fuel_type(self._extract_text(fuel_elem))
            else:
                car_data['fuel_type'] = 'Gasoline'
            
            # Extract location
            location_elem = soup.find(string=re.compile(r'location|city', re.I))
            if location_elem:
                car_data['location'] = self._extract_text(location_elem)
            
            # Extract images
            images = []
            img_tags = soup.find_all('img', src=re.compile(r'vehicle|car', re.I))
            for img in img_tags[:10]:  # Limit to 10 images
                src = img.get('src') or img.get('data-src')
                if src and src.startswith('http'):
                    images.append(src)
            car_data['images'] = images
            
            # Set defaults
            car_data.setdefault('year', 2020)
            car_data.setdefault('mileage', 50000)
            car_data.setdefault('condition', 'Good')
            car_data.setdefault('fuel_type', 'Gasoline')
            car_data.setdefault('location', 'Unknown')
            car_data.setdefault('platform', 'Cars.com')
            car_data.setdefault('currency', 'USD')
            car_data.setdefault('images', [])
            
            return car_data
            
        except Exception as e:
            logger.error(f"Error scraping Cars.com URL {url}: {e}")
            raise
