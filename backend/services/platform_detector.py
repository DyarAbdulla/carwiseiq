"""
Platform detection service
Auto-detects platform from URL and routes to appropriate scraper
"""

import logging
from typing import Optional
from urllib.parse import urlparse

from scrapers.cars_com import CarsComScraper
from scrapers.autotrader import AutotraderScraper
from scrapers.dubizzle import DubizzleScraper
from scrapers.syarah import SyarahScraper
from scrapers.mobile_de import MobileDeScraper
from scrapers.cargurus import CarGurusScraper
from scrapers.opensooq import OpenSooqScraper
from scrapers.hatla2ee import Hatla2eeScraper
from scrapers.ksell_iq import KsellIQScraper
from scrapers.carvana import CarvanaScraper
from scrapers.truecar import TrueCarScraper
from scrapers.iqcars import IQCarsScraper

logger = logging.getLogger(__name__)


class PlatformDetector:
    """Detects platform from URL and returns appropriate scraper"""
    
    # Initialize all scrapers
    SCRAPERS = [
        CarsComScraper(),
        AutotraderScraper(),
        DubizzleScraper(),
        SyarahScraper(),
        MobileDeScraper(),
        CarGurusScraper(),
        OpenSooqScraper(),
        Hatla2eeScraper(),
        KsellIQScraper(),
        CarvanaScraper(),
        TrueCarScraper(),
        IQCarsScraper(),
    ]
    
    PLATFORM_NAMES = {
        'CarsComScraper': 'Cars.com',
        'AutotraderScraper': 'Autotrader',
        'DubizzleScraper': 'Dubizzle',
        'SyarahScraper': 'Syarah',
        'MobileDeScraper': 'Mobile.de',
        'CarGurusScraper': 'CarGurus',
        'OpenSooqScraper': 'OpenSooq',
        'Hatla2eeScraper': 'Hatla2ee',
        'KsellIQScraper': 'Ksell.iq',
        'CarvanaScraper': 'Carvana',
        'TrueCarScraper': 'TrueCar',
        'IQCarsScraper': 'IQCars.net',
    }
    
    @classmethod
    def detect_platform(cls, url: str) -> Optional[tuple]:
        """
        Detect platform from URL
        
        Args:
            url: URL to analyze
            
        Returns:
            Tuple of (scraper_instance, platform_name) or None if not supported
        """
        for scraper in cls.SCRAPERS:
            try:
                if scraper.can_handle(url):
                    platform_name = cls.PLATFORM_NAMES.get(scraper.__class__.__name__, 'Unknown')
                    logger.info(f"Detected platform: {platform_name} for URL: {url}")
                    return (scraper, platform_name)
            except Exception as e:
                logger.debug(f"Error checking scraper {scraper.__class__.__name__}: {e}")
                continue
        
        logger.warning(f"No scraper found for URL: {url}")
        return None
    
    @classmethod
    def get_supported_platforms(cls) -> list:
        """Get list of supported platform names"""
        return list(cls.PLATFORM_NAMES.values())
