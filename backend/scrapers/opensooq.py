"""
OpenSooq scraper (Jordan, Iraq, Kuwait)
URL pattern: https://*.opensooq.com/*/cars/*
Handles multiple countries
"""

import re
import json
import logging
from typing import Dict, Any
from urllib.parse import urlparse
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class OpenSooqScraper(BaseScraper):
    """Scraper for OpenSooq listings"""
    
    def can_handle(self, url: str) -> bool:
        """Check if URL is from OpenSooq"""
        parsed = urlparse(url)
        return 'opensooq.com' in parsed.netloc.lower() and 'cars' in parsed.path.lower()
    
    def scrape(self, url: str) -> Dict[str, Any]:
        """Scrape car data from OpenSooq"""
        try:
            response = self._fetch_with_retry(url)
            soup = self._parse_html(response.text)
            
            car_data = {}
            
            # Extract from page title
            title_tag = soup.find('title')
            if title_tag:
                title = title_tag.get_text()
                match = re.search(r'(\d{4})\s+([A-Za-z]+)\s+(.+)', title)
                if match:
                    car_data['year'] = int(match.group(1))
                    car_data['make'] = match.group(2)
                    car_data['model'] = match.group(3).split('-')[0].strip()
            
            # Extract price (JOD, IQD, KWD)
            price_elem = soup.find(string=re.compile(r'JOD|IQD|KWD|دينار|[\d,]+', re.I))
            if price_elem:
                parent = price_elem.parent if hasattr(price_elem, 'parent') else None
                if parent:
                    price_text = self._extract_text(parent)
                    price = self._extract_number(price_text)
                    if price:
                        car_data['price'] = price
            
            # Extract mileage
            mileage_elem = soup.find(string=re.compile(r'km|kilometer', re.I))
            if mileage_elem:
                parent = mileage_elem.parent if hasattr(mileage_elem, 'parent') else None
                if parent:
                    mileage_text = self._extract_text(parent)
                    mileage = self._extract_number(mileage_text, 0)
                    car_data['mileage'] = mileage
            
            # Determine currency and location from domain
            parsed = urlparse(url)
            if 'jo' in parsed.netloc.lower() or 'jordan' in parsed.netloc.lower():
                currency = 'JOD'
                location = 'Amman'
            elif 'iq' in parsed.netloc.lower() or 'iraq' in parsed.netloc.lower():
                currency = 'IQD'
                location = 'Baghdad'
            elif 'kw' in parsed.netloc.lower() or 'kuwait' in parsed.netloc.lower():
                currency = 'KWD'
                location = 'Kuwait City'
            else:
                currency = 'JOD'
                location = 'Unknown'
            
            # Set defaults
            car_data.setdefault('year', 2020)
            car_data.setdefault('mileage', 50000)
            car_data.setdefault('condition', 'Good')
            car_data.setdefault('fuel_type', 'Gasoline')
            car_data.setdefault('location', location)
            car_data.setdefault('platform', 'OpenSooq')
            car_data.setdefault('currency', currency)
            car_data.setdefault('images', [])
            
            return car_data
            
        except Exception as e:
            logger.error(f"Error scraping OpenSooq URL {url}: {e}")
            raise
