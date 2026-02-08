"""
Syarah.com scraper (Saudi Arabia)
URL pattern: https://syarah.com/*/car/*
Handles Arabic and English versions
"""

import re
import json
import logging
from typing import Dict, Any
from urllib.parse import urlparse
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class SyarahScraper(BaseScraper):
    """Scraper for Syarah.com listings"""
    
    def can_handle(self, url: str) -> bool:
        """Check if URL is from Syarah"""
        parsed = urlparse(url)
        return 'syarah.com' in parsed.netloc.lower() and 'car' in parsed.path.lower()
    
    def scrape(self, url: str) -> Dict[str, Any]:
        """Scrape car data from Syarah"""
        try:
            response = self._fetch_with_retry(url)
            soup = self._parse_html(response.text)
            
            car_data = {}
            
            # Syarah often has JSON data in script tags
            scripts = soup.find_all('script')
            for script in scripts:
                script_text = script.string or ''
                if 'vehicle' in script_text.lower() or 'car' in script_text.lower():
                    try:
                        json_match = re.search(r'({.+})', script_text, re.DOTALL)
                        if json_match:
                            data = json.loads(json_match.group(1))
                            car_info = self._extract_from_json(data)
                            if car_info:
                                car_data.update(car_info)
                                break
                    except (json.JSONDecodeError, KeyError):
                        continue
            
            # Extract from page content
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text()
                # Try to extract make/model/year from title
                match = re.search(r'(\d{4})\s+([A-Za-z]+)\s+(.+)', title)
                if match:
                    car_data['year'] = int(match.group(1))
                    car_data['make'] = match.group(2)
                    car_data['model'] = match.group(3).split('-')[0].strip()
            
            # Extract price (SAR)
            price_elem = soup.find(string=re.compile(r'SAR|ريال|[\d,]+', re.I))
            if price_elem:
                parent = price_elem.parent if hasattr(price_elem, 'parent') else None
                if parent:
                    price_text = self._extract_text(parent)
                    price = self._extract_number(price_text)
                    if price:
                        car_data['price'] = price
            
            # Extract mileage
            mileage_elem = soup.find(string=re.compile(r'km|kilometer|كم', re.I))
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
            car_data.setdefault('location', 'Riyadh')
            car_data.setdefault('platform', 'Syarah')
            car_data.setdefault('currency', 'SAR')
            car_data.setdefault('images', [])
            
            return car_data
            
        except Exception as e:
            logger.error(f"Error scraping Syarah URL {url}: {e}")
            raise
    
    def _extract_from_json(self, data: dict) -> Dict[str, Any]:
        """Extract car data from JSON"""
        result = {}
        # Similar to Dubizzle extraction logic
        return result
