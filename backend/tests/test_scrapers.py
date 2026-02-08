"""
Tests for scraper modules
"""

import pytest
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


def test_all_scrapers_exist():
    """Test that all scrapers can be imported"""
    scrapers = [
        CarsComScraper,
        AutotraderScraper,
        DubizzleScraper,
        SyarahScraper,
        MobileDeScraper,
        CarGurusScraper,
        OpenSooqScraper,
        Hatla2eeScraper,
        KsellIQScraper,
        CarvanaScraper,
        TrueCarScraper,
        IQCarsScraper,
    ]
    
    for scraper_class in scrapers:
        assert scraper_class is not None
        scraper = scraper_class()
        assert scraper is not None
        assert hasattr(scraper, 'can_handle')
        assert hasattr(scraper, 'scrape')


def test_platform_detection():
    """Test platform detection for sample URLs"""
    from services.platform_detector import PlatformDetector
    
    test_cases = [
        ("https://www.cars.com/vehicledetail/detail/123/overview/", "Cars.com"),
        ("https://www.autotrader.com/cars-for-sale/vehicledetails", "Autotrader"),
        ("https://dubizzle.com/motors/used-cars/", "Dubizzle"),
        ("https://www.syarah.com/car/123", "Syarah"),
        ("https://www.mobile.de/auto/123", "Mobile.de"),
        ("https://www.cargurus.com/Cars/123", "CarGurus"),
        ("https://jo.opensooq.com/cars", "OpenSooq"),
        ("https://hatla2ee.com/car/123", "Hatla2ee"),
        ("https://iq.ksell.iq/car-details/123/slug", "Ksell.iq"),
        ("https://www.carvana.com/vehicle/123", "Carvana"),
        ("https://www.truecar.com/used-cars-for-sale/listing/123", "TrueCar"),
        ("https://www.iqcars.net/car/123", "IQCars.net"),
    ]
    
    for url, expected_platform in test_cases:
        result = PlatformDetector.detect_platform(url)
        if result:
            scraper, platform_name = result
            assert platform_name == expected_platform, f"Expected {expected_platform}, got {platform_name}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
