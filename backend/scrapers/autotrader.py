"""
Autotrader.com scraper
URL pattern: https://www.autotrader.com/cars-for-sale/vehicledetails.xhtml?listingId=*
Handles both .com and .co.uk domains
"""

import re
import json
import logging
from typing import Dict, Any
from urllib.parse import urlparse, parse_qs
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class AutotraderScraper(BaseScraper):
    """Scraper for Autotrader.com listings"""
    
    def can_handle(self, url: str) -> bool:
        """Check if URL is from Autotrader"""
        parsed = urlparse(url)
        return ('autotrader.com' in parsed.netloc.lower() or 
                'autotrader.co.uk' in parsed.netloc.lower()) and 'vehicledetails' in parsed.path
    
    def scrape(self, url: str) -> Dict[str, Any]:
        """Scrape car data from Autotrader"""
        try:
            response = self._fetch_with_retry(url)
            soup = self._parse_html(response.text)
            
            car_data = {}
            
            # Try to extract from meta tags
            meta_tags = soup.find_all('meta')
            for meta in meta_tags:
                property_attr = meta.get('property') or meta.get('name')
                content = meta.get('content', '')
                
                if property_attr and 'vehicle' in property_attr.lower():
                    if 'make' in property_attr.lower():
                        car_data['make'] = content
                    elif 'model' in property_attr.lower():
                        car_data['model'] = content
                    elif 'year' in property_attr.lower():
                        car_data['year'] = int(content) if content.isdigit() else 2020
            
            # Extract from page title if meta tags didn't work
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text()
                # Pattern: "2020 Toyota Camry for Sale | Autotrader"
                match = re.search(r'(\d{4})\s+([A-Za-z]+)\s+(.+?)\s+for\s+Sale', title)
                if match:
                    car_data['year'] = int(match.group(1))
                    car_data['make'] = match.group(2)
                    car_data['model'] = match.group(3).strip()
            
            # Extract price - look for price elements
            price_patterns = [
                soup.find('span', class_=re.compile(r'price', re.I)),
                soup.find('div', class_=re.compile(r'price', re.I)),
                soup.find(string=re.compile(r'\$[\d,]+|£[\d,]+', re.I)),
            ]
            
            for price_elem in price_patterns:
                if price_elem:
                    price_text = self._extract_text(price_elem) if hasattr(price_elem, 'get_text') else str(price_elem)
                    price = self._extract_number(price_text)
                    if price:
                        car_data['price'] = price
                        break
            
            # Extract mileage/odometer
            odometer_elem = soup.find(string=re.compile(r'odometer|mileage|miles|km', re.I))
            if odometer_elem:
                parent = odometer_elem.parent if hasattr(odometer_elem, 'parent') else None
                if parent:
                    odometer_text = self._extract_text(parent)
                    mileage = self._extract_number(odometer_text, 0)
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
            
            # Extract location
            location_elem = soup.find(string=re.compile(r'location|city|dealer', re.I))
            if location_elem:
                car_data['location'] = self._extract_text(location_elem)
            
            # Extract images
            images = []
            img_tags = soup.find_all('img', class_=re.compile(r'vehicle|car|photo', re.I))
            for img in img_tags[:10]:
                src = img.get('src') or img.get('data-src') or img.get('data-lazy-src')
                if src and src.startswith('http'):
                    images.append(src)
            car_data['images'] = images
            
            # Determine currency based on domain
            parsed = urlparse(url)
            currency = 'GBP' if 'autotrader.co.uk' in parsed.netloc.lower() else 'USD'
            
            # Set defaults
            car_data.setdefault('year', 2020)
            car_data.setdefault('mileage', 50000)
            car_data.setdefault('condition', 'Good')
            car_data.setdefault('fuel_type', 'Gasoline')
            car_data.setdefault('location', 'Unknown')
            car_data.setdefault('platform', 'Autotrader')
            car_data.setdefault('currency', currency)
            car_data.setdefault('images', [])
            
            return car_data
            
        except Exception as e:
            logger.error(f"Error scraping Autotrader URL {url}: {e}")
            raise
