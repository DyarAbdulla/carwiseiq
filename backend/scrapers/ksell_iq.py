"""
Ksell.iq scraper (Iraq)
URL pattern: https://iq.ksell.iq/car-details/[id]/[slug]
Handles Arabic and English content
Currency: IQD (convert to USD: 1 USD = 1310 IQD)
"""

import re
import json
import logging
from typing import Dict, Any
from urllib.parse import urlparse
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class KsellIQScraper(BaseScraper):
    """Scraper for Ksell.iq listings"""
    
    def can_handle(self, url: str) -> bool:
        """Check if URL is from Ksell.iq"""
        parsed = urlparse(url)
        return 'ksell.iq' in parsed.netloc.lower() and 'car-details' in parsed.path.lower()
    
    def scrape(self, url: str) -> Dict[str, Any]:
        """Scrape car data from Ksell.iq"""
        try:
            response = self._fetch_with_retry(url)
            soup = self._parse_html(response.text)
            
            car_data = {}
            
            # Try to extract from JSON-LD structured data
            scripts = soup.find_all('script', type='application/ld+json')
            for script in scripts:
                try:
                    data = json.loads(script.string)
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
                # Pattern: "2020 Toyota Camry - Ksell.iq" or "تويوتا كامري 2020"
                match = re.search(r'(\d{4})\s+([A-Za-z]+)\s+(.+)', title)
                if match:
                    car_data['year'] = int(match.group(1))
                    car_data['make'] = match.group(2)
                    car_data['model'] = match.group(3).split('-')[0].strip()
            
            # Extract price (IQD) - look for price elements
            price_selectors = [
                soup.find('span', class_=re.compile(r'price', re.I)),
                soup.find('div', class_=re.compile(r'price', re.I)),
                soup.find('span', class_=re.compile(r'cost', re.I)),
                soup.find(string=re.compile(r'\d+\s*(?:دينار|IQD|د\.ع)', re.I)),
            ]
            
            for price_elem in price_selectors:
                if price_elem:
                    price_text = self._extract_text(price_elem) if hasattr(price_elem, 'get_text') else str(price_elem)
                    # Remove currency symbols and text
                    price_clean = re.sub(r'[^\d.]', '', price_text.replace(',', '').replace('،', ''))
                    try:
                        price = float(price_clean)
                        if price > 1000:  # Valid price should be > 1000 IQD
                            car_data['price'] = price
                            break
                    except ValueError:
                        continue
            
            # Extract mileage (km)
            mileage_elem = soup.find(string=re.compile(r'km|kilometer|كم', re.I))
            if mileage_elem:
                parent = mileage_elem.parent if hasattr(mileage_elem, 'parent') else None
                if parent:
                    mileage_text = self._extract_text(parent)
                    # Extract numbers
                    mileage_match = re.search(r'([\d,]+)', mileage_text.replace(',', '').replace('،', ''))
                    if mileage_match:
                        mileage = float(mileage_match.group(1))
                        car_data['mileage'] = mileage
            
            # Extract make/model from car details section
            car_details = soup.find('div', class_=re.compile(r'car-details|car-info|vehicle-details', re.I))
            if car_details:
                # Look for make/model in text
                details_text = self._extract_text(car_details)
                
                # Common makes in Arabic/English
                makes_arabic = {
                    'تويوتا': 'Toyota',
                    'هوندا': 'Honda',
                    'فورد': 'Ford',
                    'نيسان': 'Nissan',
                    'شيفروليه': 'Chevrolet',
                    'مرسيدس': 'Mercedes-Benz',
                    'بي ام دبليو': 'BMW',
                    'أودي': 'Audi',
                }
                
                for arabic, english in makes_arabic.items():
                    if arabic in details_text and not car_data.get('make'):
                        car_data['make'] = english
                        break
            
            # Extract condition
            condition_elem = soup.find(string=re.compile(r'condition|حالة|excellent|good|fair|ممتاز|جيد', re.I))
            if condition_elem:
                condition_text = self._extract_text(condition_elem) if hasattr(condition_elem, 'get_text') else str(condition_elem)
                car_data['condition'] = self._normalize_condition(condition_text)
            else:
                car_data['condition'] = 'Good'
            
            # Extract fuel type
            fuel_elem = soup.find(string=re.compile(r'fuel|gasoline|diesel|electric|hybrid|بنزين|ديزل', re.I))
            if fuel_elem:
                fuel_text = self._extract_text(fuel_elem) if hasattr(fuel_elem, 'get_text') else str(fuel_elem)
                car_data['fuel_type'] = self._normalize_fuel_type(fuel_text)
            else:
                car_data['fuel_type'] = 'Gasoline'
            
            # Extract location (default to Baghdad for Iraq)
            car_data['location'] = 'Baghdad'
            
            # Extract images
            images = []
            img_tags = soup.find_all('img', class_=re.compile(r'car|vehicle|image|photo', re.I))
            for img in img_tags[:10]:
                src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
                if src and src.startswith('http'):
                    images.append(src)
            car_data['images'] = images
            
            # Set defaults
            car_data.setdefault('year', 2020)
            car_data.setdefault('mileage', 50000)
            car_data.setdefault('condition', 'Good')
            car_data.setdefault('fuel_type', 'Gasoline')
            car_data.setdefault('location', 'Baghdad')
            car_data.setdefault('platform', 'Ksell.iq')
            car_data.setdefault('currency', 'IQD')
            car_data.setdefault('images', [])
            
            return car_data
            
        except Exception as e:
            logger.error(f"Error scraping Ksell.iq URL {url}: {e}")
            raise
