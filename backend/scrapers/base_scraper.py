"""
Base scraper class with common functionality for all platform scrapers
"""

import logging
import time
import random
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional, List
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

logger = logging.getLogger(__name__)

# User agents for rotation
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
]


class BaseScraper(ABC):
    """Base class for all platform scrapers"""
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': random.choice(USER_AGENTS),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
        })
    
    def _get_random_delay(self) -> float:
        """Get random delay between 1-3 seconds for rate limiting"""
        return random.uniform(1.0, 3.0)
    
    def _rotate_user_agent(self):
        """Rotate to a random user agent"""
        self.session.headers['User-Agent'] = random.choice(USER_AGENTS)
    
    def _fetch_with_retry(self, url: str, max_retries: int = 3, timeout: int = 30) -> requests.Response:
        """
        Fetch URL with retry logic and exponential backoff
        
        Args:
            url: URL to fetch
            max_retries: Maximum number of retry attempts
            
        Returns:
            Response object
            
        Raises:
            requests.RequestException: If all retries fail
        """
        last_exception = None
        
        for attempt in range(max_retries):
            try:
                # Add random delay between requests
                if attempt > 0:
                    delay = 2 ** attempt  # Exponential backoff: 2s, 4s, 8s
                    time.sleep(delay)
                    self._rotate_user_agent()
                
                response = self.session.get(url, timeout=timeout)
                response.raise_for_status()
                
                # Set encoding for proper text handling
                if response.encoding is None or response.encoding == 'ISO-8859-1':
                    response.encoding = 'utf-8'
                
                logger.info(f"Successfully fetched {url} (attempt {attempt + 1})")
                return response
                
            except requests.RequestException as e:
                last_exception = e
                logger.warning(f"Attempt {attempt + 1} failed for {url}: {e}")
                
                if attempt == max_retries - 1:
                    logger.error(f"All {max_retries} attempts failed for {url}")
                    raise last_exception
        
        raise last_exception
    
    def _parse_html(self, html: str) -> BeautifulSoup:
        """Parse HTML content with BeautifulSoup"""
        return BeautifulSoup(html, 'lxml')
    
    def _extract_text(self, element, default: str = '') -> str:
        """Safely extract text from BeautifulSoup element"""
        if element is None:
            return default
        if hasattr(element, 'get_text'):
            return element.get_text(strip=True)
        return str(element).strip() if element else default
    
    def _extract_number(self, text: str, default: Optional[float] = None) -> Optional[float]:
        """Extract number from text string"""
        if not text:
            return default
        
        import re
        # Remove commas and currency symbols
        cleaned = re.sub(r'[^\d.]', '', str(text).replace(',', ''))
        try:
            return float(cleaned)
        except ValueError:
            return default
    
    def _normalize_condition(self, condition: str) -> str:
        """Normalize condition text to standard values"""
        if not condition:
            return 'Good'
        
        condition_lower = condition.lower().strip()
        condition_mapping = {
            'new': 'New',
            'like new': 'Like New',
            'like-new': 'Like New',
            'excellent': 'Excellent',
            'very good': 'Excellent',
            'good': 'Good',
            'fair': 'Fair',
            'poor': 'Poor',
            'salvage': 'Salvage',
        }
        
        for key, value in condition_mapping.items():
            if key in condition_lower:
                return value
        
        return 'Good'  # Default
    
    def _normalize_fuel_type(self, fuel: str) -> str:
        """Normalize fuel type to standard values"""
        if not fuel:
            return 'Gasoline'
        
        fuel_lower = fuel.lower().strip()
        fuel_mapping = {
            'plug-in hybrid': 'Plug-in Hybrid',
            'phev': 'Plug-in Hybrid',
            'hybrid': 'Hybrid',
            'electric': 'Electric',
            'ev': 'Electric',
            'gasoline': 'Gasoline',
            'gas': 'Gasoline',
            'petrol': 'Gasoline',
            'diesel': 'Diesel',
        }
        
        for key, value in fuel_mapping.items():
            if key in fuel_lower:
                return value
        
        return 'Gasoline'  # Default
    
    @abstractmethod
    def can_handle(self, url: str) -> bool:
        """Check if this scraper can handle the given URL"""
        pass
    
    @abstractmethod
    def scrape(self, url: str) -> Dict[str, Any]:
        """
        Scrape car data from URL
        
        Args:
            url: URL of the car listing
            
        Returns:
            Dictionary with car data:
            - make: str
            - model: str
            - year: int
            - mileage: float (in km)
            - price: float (listing price)
            - condition: str
            - fuel_type: str
            - location: str
            - images: List[str]
            - platform: str
            - currency: str
        """
        pass
    
    def scrape_with_delay(self, url: str) -> Dict[str, Any]:
        """Scrape with rate limiting delay"""
        time.sleep(self._get_random_delay())
        return self.scrape(url)
