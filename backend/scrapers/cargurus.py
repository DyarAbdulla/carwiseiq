"""
CarGurus scraper (USA/Canada/UK)
URL pattern: https://www.cargurus.*/Cars/inventorylisting/*
Extracts from JavaScript window.__BONNET_DATA__
"""

import re
import json
import logging
from typing import Dict, Any
from urllib.parse import urlparse
from .base_scraper import BaseScraper

logger = logging.getLogger(__name__)


class CarGurusScraper(BaseScraper):
    """Scraper for CarGurus listings"""
    
    def can_handle(self, url: str) -> bool:
        """Check if URL is from CarGurus"""
        parsed = urlparse(url)
        return 'cargurus.com' in parsed.netloc.lower() or 'cargurus.ca' in parsed.netloc.lower() or 'cargurus.co.uk' in parsed.netloc.lower()
    
    def scrape(self, url: str) -> Dict[str, Any]:
        """Scrape car data from CarGurus"""
        try:
            response = self._fetch_with_retry(url)
            
            # CarGurus uses window.__BONNET_DATA__ in JavaScript
            bonnet_data_match = re.search(r'window\.__BONNET_DATA__\s*=\s*({.+?});', response.text, re.DOTALL)
            car_data = {}
            
            if bonnet_data_match:
                try:
                    data = json.loads(bonnet_data_match.group(1))
                    # Navigate through structure to find vehicle data
                    vehicle_data = self._extract_from_bonnet_data(data)
                    if vehicle_data:
                        car_data.update(vehicle_data)
                except (json.JSONDecodeError, KeyError) as e:
                    logger.debug(f"Error parsing __BONNET_DATA__: {e}")
            
            # Fallback to HTML parsing
            if not car_data.get('make'):
                soup = self._parse_html(response.text)
                title_tag = soup.find('title')
                if title_tag:
                    title = title_tag.get_text()
                    match = re.search(r'(\d{4})\s+([A-Za-z]+)\s+(.+)', title)
                    if match:
                        car_data['year'] = int(match.group(1))
                        car_data['make'] = match.group(2)
                        car_data['model'] = match.group(3).split('-')[0].strip()
            
            # Extract price
            if not car_data.get('price'):
                soup = self._parse_html(response.text)
                price_elem = soup.find(string=re.compile(r'\$|£|CAD|[\d,]+', re.I))
                if price_elem:
                    parent = price_elem.parent if hasattr(price_elem, 'parent') else None
                    if parent:
                        price_text = self._extract_text(parent)
                        price = self._extract_number(price_text)
                        if price:
                            car_data['price'] = price
            
            # Determine currency
            parsed = urlparse(url)
            if 'cargurus.ca' in parsed.netloc.lower():
                currency = 'CAD'
            elif 'cargurus.co.uk' in parsed.netloc.lower():
                currency = 'GBP'
            else:
                currency = 'USD'
            
            # Set defaults
            car_data.setdefault('year', 2020)
            car_data.setdefault('mileage', 50000)
            car_data.setdefault('condition', 'Good')
            car_data.setdefault('fuel_type', 'Gasoline')
            car_data.setdefault('location', 'Unknown')
            car_data.setdefault('platform', 'CarGurus')
            car_data.setdefault('currency', currency)
            car_data.setdefault('images', [])
            
            return car_data
            
        except Exception as e:
            logger.error(f"Error scraping CarGurus URL {url}: {e}")
            raise
    
    def _extract_from_bonnet_data(self, data: dict) -> Dict[str, Any]:
        """Extract car data from __BONNET_DATA__ structure"""
        result = {}
        
        # Common paths in CarGurus data structure
        paths = [
            ['listing', 'vehicle'],
            ['vehicle'],
            ['listing'],
        ]
        
        vehicle_info = None
        for path in paths:
            current = data
            try:
                for key in path:
                    current = current[key]
                if isinstance(current, dict):
                    vehicle_info = current
                    break
            except (KeyError, TypeError):
                continue
        
        if vehicle_info:
            result['make'] = vehicle_info.get('make') or vehicle_info.get('manufacturer', '')
            result['model'] = vehicle_info.get('model', '')
            result['year'] = vehicle_info.get('year') or vehicle_info.get('modelYear', 2020)
            result['mileage'] = vehicle_info.get('mileage') or vehicle_info.get('odometer', 0)
            result['price'] = vehicle_info.get('price') or vehicle_info.get('listPrice')
            result['condition'] = self._normalize_condition(vehicle_info.get('condition', 'Good'))
            result['fuel_type'] = self._normalize_fuel_type(vehicle_info.get('fuelType', 'Gasoline'))
        
        return result
