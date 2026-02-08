"""
Carvana.com scraper (USA)
URL pattern: https://www.carvana.com/vehicle/[id]
Extracts from JSON-LD schema
"""

import re
import json
import logging
from typing import Dict, Any
from urllib.parse import urlparse
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class CarvanaScraper(BaseScraper):
    """Scraper for Carvana.com listings"""
    
    def can_handle(self, url: str) -> bool:
        """Check if URL is from Carvana"""
        parsed = urlparse(url)
        return 'carvana.com' in parsed.netloc.lower() and 'vehicle' in parsed.path.lower()
    
    def scrape(self, url: str) -> Dict[str, Any]:
        """Scrape car data from Carvana"""
        try:
            response = self._fetch_with_retry(url)
            soup = self._parse_html(response.text)
            
            car_data = {}
            
            # Carvana uses JSON-LD structured data
            scripts = soup.find_all('script', type='application/ld+json')
            for script in scripts:
                try:
                    data = json.loads(script.string)
                    if isinstance(data, list):
                        data = data[0] if data else {}
                    
                    if data.get('@type') == 'Vehicle' or data.get('@type') == 'Product':
                        if 'brand' in data:
                            car_data['make'] = data['brand'].get('name', '')
                        if 'name' in data:
                            name_parts = data['name'].split()
                            if len(name_parts) >= 2:
                                car_data['make'] = name_parts[0]
                                car_data['model'] = ' '.join(name_parts[1:])
                        if 'productionDate' in data:
                            car_data['year'] = int(data['productionDate'])
                        if 'offers' in data:
                            price = data['offers'].get('price')
                            if price:
                                car_data['price'] = float(price)
                except (json.JSONDecodeError, KeyError, ValueError):
                    continue
            
            # Extract from page title
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text()
                match = re.search(r'(\d{4})\s+([A-Za-z]+)\s+(.+)', title)
                if match:
                    car_data['year'] = int(match.group(1))
                    car_data['make'] = match.group(2)
                    car_data['model'] = match.group(3).split('-')[0].strip()
            
            # Extract price
            price_elem = soup.find(string=re.compile(r'\$[\d,]+', re.I))
            if price_elem:
                parent = price_elem.parent if hasattr(price_elem, 'parent') else None
                if parent:
                    price_text = self._extract_text(parent)
                    price = self._extract_number(price_text)
                    if price:
                        car_data['price'] = price
            
            # Extract mileage
            mileage_elem = soup.find(string=re.compile(r'mileage|miles|mi', re.I))
            if mileage_elem:
                parent = mileage_elem.parent if hasattr(mileage_elem, 'parent') else None
                if parent:
                    mileage_text = self._extract_text(parent)
                    mileage = self._extract_number(mileage_text, 0)
                    car_data['mileage'] = mileage
            
            # Set defaults
            car_data.setdefault('year', 2020)
            car_data.setdefault('mileage', 50000)
            car_data.setdefault('condition', 'Good')
            car_data.setdefault('fuel_type', 'Gasoline')
            car_data.setdefault('location', 'Unknown')
            car_data.setdefault('platform', 'Carvana')
            car_data.setdefault('currency', 'USD')
            car_data.setdefault('images', [])
            
            return car_data
            
        except Exception as e:
            logger.error(f"Error scraping Carvana URL {url}: {e}")
            raise
