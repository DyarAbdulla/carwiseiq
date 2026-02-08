"""
FastAPI Backend for Car Price Prediction
Main application entry point with URL scraping and prediction endpoints
"""

import logging
import os
import random
import asyncio
import requests
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from middleware.rate_limit import RateLimitMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uvicorn

import sys

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scrapers.base_scraper import BaseScraper
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
from services.platform_detector import PlatformDetector
from services.data_normalizer import DataNormalizer
from services.price_predictor import PricePredictor
from services.cache_service import CacheService
from utils.validators import validate_url
from utils.currency_converter import CurrencyConverter
from utils.error_logger import log_error
from utils.input_sanitizer import sanitize_string, sanitize_url, sanitize_email, sanitize_vin
from database import get_database
from apis.vin_decoder import VINDecoder

# Mock Mode - Set to True to return fake data instead of scraping
# Can be overridden with environment variable: MOCK_MODE=True
MOCK_MODE = os.getenv('MOCK_MODE', 'False').lower() == 'true'

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Car Price Predictor API",
    description="AI-powered car price prediction API with multi-platform URL scraping",
    version="2.0.0"
)

# CORS middleware
cors_origins = [o.strip() for o in os.getenv('CORS_ORIGINS', '*').split(',') if o.strip()]
if cors_origins != ['*']:
    for _origin in ("https://carwiseiq.pages.dev",):
        if _origin not in cors_origins:
            cors_origins.append(_origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins if cors_origins != ['*'] else ["*"],
    allow_origin_regex=r"https://[a-zA-Z0-9-]+\.carwiseiq\.pages\.dev" if cors_origins != ['*'] else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rate limiting middleware
app.add_middleware(RateLimitMiddleware)

# Initialize services
cache_service = CacheService(ttl_seconds=24 * 60 * 60)  # 24 hours
price_predictor = PricePredictor()
data_normalizer = DataNormalizer()


# Request/Response Models
class UrlPredictionRequest(BaseModel):
    """Request for URL prediction"""
    url: str = Field(..., description="URL of the car listing")


class CarDetailsPredictionRequest(BaseModel):
    """Request for prediction from car details"""
    make: str
    model: str
    year: int = Field(..., ge=1900, le=2025)
    mileage: float = Field(..., ge=0)
    condition: str = "Good"
    fuel_type: str = "Gasoline"
    location: Optional[str] = None
    engine_size: Optional[float] = None
    cylinders: Optional[int] = None
    listing_price: Optional[float] = None
    currency: str = "USD"


class BatchUrlPredictionRequest(BaseModel):
    """Request for batch URL prediction"""
    urls: List[str] = Field(..., min_items=1, max_items=100)


# Helper function to calculate deal quality
def calculate_deal_quality(listing_price: float, predicted_price: float) -> Dict[str, Any]:
    """Calculate deal quality metrics"""
    if not listing_price or listing_price <= 0:
        return {
            'deal_quality': 'Unknown',
            'deal_explanation': 'No listing price available',
            'market_position': 'Unknown',
        }
    
    difference = listing_price - predicted_price
    difference_percent = (difference / predicted_price) * 100
    
    if difference_percent <= -10:
        deal_quality = 'Good'
        explanation = f"Price is {abs(difference_percent):.1f}% below predicted value - Great deal!"
        market_position = 'Below Average'
    elif difference_percent <= 10:
        deal_quality = 'Fair'
        explanation = f"Price is {abs(difference_percent):.1f}% {'above' if difference_percent > 0 else 'below'} predicted value"
        market_position = 'Average'
    else:
        deal_quality = 'Poor'
        explanation = f"Price is {difference_percent:.1f}% above predicted value - Overpriced"
        market_position = 'Above Average'
    
    return {
        'deal_quality': deal_quality,
        'deal_explanation': explanation,
        'market_position': market_position,
        'difference': difference,
        'difference_percent': difference_percent,
    }


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "Car Price Predictor API",
        "version": "2.0.0",
        "description": "AI-powered car price prediction with multi-platform URL scraping",
        "endpoints": {
            "health": "/api/health",
            "predict_from_url": "/api/predict/from-url",
            "predict_batch": "/api/predict/batch",
            "predict_from_details": "/api/predict/from-details",
            "platforms": "/api/platforms",
            "history": "/api/history",
            "trends": "/api/trends",
            "decode_vin": "/api/decode-vin",
            "similar_cars": "/api/similar",
            "price_alert": "/api/price-alert",
        }
    }


@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "scrapers": 12,
        "apis": 3,
        "cache_size": cache_service.size(),
    }


@app.get("/api/platforms")
async def get_platforms():
    """Get list of supported platforms"""
    return {
        "supported": PlatformDetector.get_supported_platforms(),
        "count": len(PlatformDetector.get_supported_platforms()),
    }


@app.get("/api/history")
async def get_history(limit: int = 50, offset: int = 0):
    """
    Get search history
    
    Args:
        limit: Maximum number of results (default: 50)
        offset: Offset for pagination (default: 0)
    """
    try:
        db = get_database()
        history = db.get_search_history(limit=limit, offset=offset)
        return {
            "success": True,
            "data": history,
            "count": len(history),
        }
    except Exception as e:
        logger.error(f"Error getting history: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving history: {str(e)}")


@app.get("/api/trends")
async def get_trends(make: str, model: str, year: Optional[int] = None):
    """
    Get price trends for a specific make/model/year
    
    Args:
        make: Car make (required)
        model: Car model (required)
        year: Car year (optional)
    """
    try:
        if not make or not model:
            raise HTTPException(status_code=400, detail="make and model are required")
        
        db = get_database()
        trends = db.get_price_trends(make=make, model=model, year=year)
        return {
            "success": True,
            "data": trends,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting trends: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving trends: {str(e)}")


@app.post("/api/decode-vin")
async def decode_vin(request: dict):
    """
    Decode VIN to get car specifications
    
    Request body: {"vin": "1HGBH41JXMN109186"}
    """
    try:
        vin = sanitize_vin(request.get('vin', ''))
        if not vin:
            raise HTTPException(status_code=400, detail="VIN is required")
        
        decoder = VINDecoder()
        result = decoder.decode(vin)
        
        return {
            "success": True,
            "data": result,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error decoding VIN: {e}")
        raise HTTPException(status_code=500, detail=f"Error decoding VIN: {str(e)}")


@app.get("/api/similar")
async def get_similar_cars(make: str, model: str, year: Optional[int] = None, limit: int = 10):
    """
    Get similar cars from database
    
    Args:
        make: Car make (required)
        model: Car model (required)
        year: Car year (optional)
        limit: Maximum number of results (default: 10, max: 50)
    """
    try:
        if not make or not model:
            raise HTTPException(status_code=400, detail="make and model are required")
        
        if limit > 50:
            limit = 50
        
        db = get_database()
        similar = db.get_similar_cars(make=make, model=model, year=year, limit=limit)
        
        return {
            "success": True,
            "data": similar,
            "count": len(similar),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting similar cars: {e}")
        raise HTTPException(status_code=500, detail=f"Error retrieving similar cars: {str(e)}")


@app.post("/api/price-alert")
async def create_price_alert(request: dict):
    """
    Create a price alert
    
    Request body: {
        "make": "Toyota",
        "model": "Camry",
        "year": 2020,
        "target_price": 20000,
        "alert_type": "below",
        "email": "user@example.com" (optional)
    }
    """
    try:
        make = sanitize_string(request.get('make', ''), max_length=50)
        model = sanitize_string(request.get('model', ''), max_length=50)
        year = request.get('year')
        target_price = request.get('target_price')
        alert_type = request.get('alert_type', 'below')
        email = sanitize_email(request.get('email', '')) if request.get('email') else None
        
        if not make or not model:
            raise HTTPException(status_code=400, detail="make and model are required")
        
        if not target_price or target_price <= 0:
            raise HTTPException(status_code=400, detail="target_price must be greater than 0")
        
        if alert_type not in ['below', 'above']:
            raise HTTPException(status_code=400, detail="alert_type must be 'below' or 'above'")
        
        db = get_database()
        alert_id = db.save_price_alert(
            make=make,
            model=model,
            year=year,
            target_price=target_price,
            alert_type=alert_type,
            email=email
        )
        
        return {
            "success": True,
            "message": "Price alert created successfully",
            "alert_id": alert_id,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating price alert: {e}")
        raise HTTPException(status_code=500, detail=f"Error creating price alert: {str(e)}")


def generate_mock_data(url: str) -> Dict[str, Any]:
    """Generate realistic mock car data for testing"""
    # Sample car data
    cars = [
        {"make": "Toyota", "model": "Camry", "base_price": 25000, "year": 2020},
        {"make": "Honda", "model": "Civic", "base_price": 22000, "year": 2019},
        {"make": "Ford", "model": "F-150", "base_price": 35000, "year": 2021},
        {"make": "BMW", "model": "3 Series", "base_price": 42000, "year": 2020},
        {"make": "Mercedes-Benz", "model": "C-Class", "base_price": 45000, "year": 2021},
        {"make": "Audi", "model": "A4", "base_price": 40000, "year": 2020},
        {"make": "Nissan", "model": "Altima", "base_price": 23000, "year": 2019},
        {"make": "Chevrolet", "model": "Silverado", "base_price": 33000, "year": 2021},
    ]
    
    car = random.choice(cars)
    condition = random.choice(["New", "Like New", "Excellent", "Good", "Fair"])
    fuel_type = random.choice(["Gasoline", "Diesel", "Hybrid", "Electric"])
    mileage = random.randint(5000, 150000)
    year = car["year"] + random.randint(-2, 1)  # Year variation
    location = random.choice(["Dubai", "California", "New York", "Texas", "Florida"])
    platform = random.choice(["Cars.com", "Dubizzle", "Autotrader", "CarGurus"])
    
    # Calculate price based on condition and mileage
    condition_multipliers = {
        "New": 1.0,
        "Like New": 0.95,
        "Excellent": 0.85,
        "Good": 0.75,
        "Fair": 0.65,
    }
    base_price = car["base_price"]
    condition_mult = condition_multipliers.get(condition, 0.75)
    mileage_mult = 1.0 - (mileage / 200000) * 0.3  # Depreciation based on mileage
    year_mult = 1.0 - (2024 - year) * 0.08  # Depreciation based on age
    
    predicted_price = base_price * condition_mult * mileage_mult * year_mult
    predicted_price = max(predicted_price, 5000)  # Minimum price
    
    # Listing price is slightly different from predicted (within ±15%)
    listing_price = predicted_price * random.uniform(0.85, 1.15)
    
    # Price range
    price_range = {
        "min": predicted_price * 0.85,
        "max": predicted_price * 1.15,
    }
    
    # Confidence
    confidence = random.randint(75, 95)
    
    # Deal quality
    difference_percent = ((listing_price - predicted_price) / predicted_price) * 100
    if difference_percent <= -10:
        deal_quality = "Good"
        deal_explanation = f"Price is {abs(difference_percent):.1f}% below predicted value - Great deal!"
        market_position = "Below Average"
    elif difference_percent <= 10:
        deal_quality = "Fair"
        deal_explanation = f"Price is {abs(difference_percent):.1f}% {'above' if difference_percent > 0 else 'below'} predicted value"
        market_position = "Average"
    else:
        deal_quality = "Poor"
        deal_explanation = f"Price is {difference_percent:.1f}% above predicted value - Overpriced"
        market_position = "Above Average"
    
    return {
        "make": car["make"],
        "model": car["model"],
        "year": year,
        "mileage": float(mileage),
        "condition": condition,
        "fuel_type": fuel_type,
        "location": location,
        "listing_price": round(listing_price, 2),
        "predicted_price": round(predicted_price, 2),
        "price_range": price_range,
        "confidence": float(confidence),
        "deal_quality": deal_quality,
        "deal_explanation": deal_explanation,
        "market_position": market_position,
        "images": [],
        "platform": platform,
        "currency": "USD",
    }


@app.post("/api/predict/from-url")
async def predict_from_url(request: UrlPredictionRequest):
    """
    Predict price from car listing URL
    
    Scrapes the URL, extracts car data, and predicts price
    """
    try:
        url = sanitize_url(request.url.strip())
        
        # Validate URL
        if not url or not validate_url(url):
            raise HTTPException(status_code=400, detail="Invalid URL format")
        
        # MOCK MODE: Return fake data instead of scraping
        if MOCK_MODE:
            # Simulate scraping delay (0.5-2 seconds)
            delay = random.uniform(0.5, 2.0)
            await asyncio.sleep(delay)
            
            # 80% success rate, 20% errors
            if random.random() < 0.8:
                logger.info(f"[MOCK MODE] Generating fake data for URL: {url}")
                mock_data = generate_mock_data(url)
                return {"success": True, "data": mock_data}
            else:
                # 20% chance of error
                error_messages = [
                    "Unable to access listing page",
                    "Listing no longer available",
                    "Invalid URL format for this platform",
                    "Timeout while scraping",
                    "Rate limit exceeded",
                ]
                error_msg = random.choice(error_messages)
                logger.warning(f"[MOCK MODE] Returning error for URL: {url} - {error_msg}")
                raise HTTPException(status_code=400, detail=error_msg)
        
        # REAL MODE: Actual scraping
        # Check cache first
        cached_data = cache_service.get(url)
        if cached_data:
            logger.info(f"Returning cached data for URL: {url}")
            return {"success": True, "data": cached_data}
        
        # Detect platform and get scraper
        platform_result = PlatformDetector.detect_platform(url)
        if not platform_result:
            error_msg = f"Platform not supported yet. Supported platforms: {', '.join(PlatformDetector.get_supported_platforms())}"
            logger.warning(f"Unsupported platform for URL: {url}")
            log_error('UnsupportedPlatform', url, error_msg)
            raise HTTPException(status_code=400, detail=error_msg)
        
        scraper, platform_name = platform_result
        
        # Scrape car data with timeout handling
        logger.info(f"Scraping URL: {url} (Platform: {platform_name})")
        try:
            scraped_data = scraper.scrape_with_delay(url)
        except requests.exceptions.Timeout:
            error_msg = "Timeout while scraping - the listing page took too long to respond"
            logger.error(f"Timeout scraping URL: {url}")
            log_error('TimeoutError', url, error_msg, 'Request timed out after 30 seconds')
            raise HTTPException(status_code=408, detail=error_msg)
        except requests.exceptions.ConnectionError:
            error_msg = "Unable to connect to listing page - the website may be down or blocking requests"
            logger.error(f"Connection error scraping URL: {url}")
            log_error('ConnectionError', url, error_msg)
            raise HTTPException(status_code=503, detail=error_msg)
        except requests.exceptions.HTTPError as e:
            if hasattr(e, 'response') and e.response:
                if e.response.status_code == 404:
                    error_msg = "Listing no longer available - the URL may be expired or removed"
                    logger.warning(f"404 error for URL: {url}")
                    log_error('NotFoundError', url, error_msg, f"HTTP {e.response.status_code}")
                    raise HTTPException(status_code=404, detail=error_msg)
                elif e.response.status_code == 429:
                    error_msg = "Rate limit exceeded, try again in 1 minute"
                    logger.warning(f"Rate limit for URL: {url}")
                    log_error('RateLimitError', url, error_msg, f"HTTP {e.response.status_code}")
                    raise HTTPException(status_code=429, detail=error_msg)
                else:
                    error_msg = f"Unable to access listing page (HTTP {e.response.status_code})"
                    logger.error(f"HTTP error {e.response.status_code} for URL: {url}")
                    log_error('HTTPError', url, error_msg, f"HTTP {e.response.status_code}")
                    raise HTTPException(status_code=502, detail=error_msg)
            else:
                error_msg = "Unable to access listing page"
                logger.error(f"HTTP error for URL: {url}: {e}")
                log_error('HTTPError', url, error_msg, str(e))
                raise HTTPException(status_code=502, detail=error_msg)
        except ValueError as e:
            # Scraper validation errors
            error_msg = f"Invalid URL or data format: {str(e)}"
            logger.warning(f"Validation error for URL: {url}: {e}")
            log_error('ValidationError', url, error_msg, str(e))
            raise HTTPException(status_code=400, detail=error_msg)
        except Exception as e:
            error_msg = f"Scraping failed: {str(e)}"
            logger.error(f"Error scraping URL {url}: {e}", exc_info=True)
            log_error('ScrapingError', url, error_msg, str(e))
            raise HTTPException(status_code=500, detail=error_msg)
        
        # Normalize data
        normalized_data = data_normalizer.normalize(scraped_data)
        
        # Convert price to USD if needed
        listing_price = normalized_data.get('price')
        currency = normalized_data.get('currency', 'USD')
        if listing_price and currency != 'USD':
            listing_price_usd = CurrencyConverter.to_usd(listing_price, currency)
        else:
            listing_price_usd = listing_price
        
        # Prepare data for prediction
        prediction_input = {
            'make': normalized_data.get('make'),
            'model': normalized_data.get('model'),
            'year': normalized_data.get('year', 2020),
            'mileage': normalized_data.get('mileage', 50000),
            'condition': normalized_data.get('condition', 'Good'),
            'fuel_type': normalized_data.get('fuel_type', 'Gasoline'),
            'engine_size': normalized_data.get('engine_size', 2.0),
            'cylinders': normalized_data.get('cylinders', 4),
        }
        
        # Predict price
        prediction_result = price_predictor.predict(prediction_input)
        predicted_price = prediction_result['predicted_price']
        confidence = prediction_result['confidence']
        price_range = prediction_result['price_range']
        
        # Calculate deal quality if listing price available
        deal_metrics = calculate_deal_quality(listing_price_usd, predicted_price)
        
        # Build response
        response_data = {
            'make': normalized_data.get('make'),
            'model': normalized_data.get('model'),
            'year': normalized_data.get('year'),
            'mileage': normalized_data.get('mileage'),
            'condition': normalized_data.get('condition'),
            'fuel_type': normalized_data.get('fuel_type'),
            'location': normalized_data.get('location', 'Unknown'),
            'listing_price': listing_price_usd if listing_price_usd else None,
            'predicted_price': predicted_price,
            'price_range': price_range,
            'confidence': confidence,
            'deal_quality': deal_metrics['deal_quality'],
            'deal_explanation': deal_metrics['deal_explanation'],
            'market_position': deal_metrics['market_position'],
            'images': normalized_data.get('images', [])[:5],  # Limit to 5 images
            'platform': platform_name,
            'currency': 'USD',  # Always return USD for consistency
        }
        
        # Cache the result
        cache_service.set(url, response_data)
        
        # Save to database
        try:
            db = get_database()
            db.save_search(url, {"success": True, "data": response_data})
        except Exception as e:
            logger.warning(f"Failed to save search to database: {e}")
        
        return {"success": True, "data": response_data}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error predicting from URL {request.url}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing URL: {str(e)}")


@app.post("/api/predict/batch")
async def predict_batch(request: BatchUrlPredictionRequest):
    """
    Batch predict prices for multiple URLs
    
    Processes up to 100 URLs concurrently (3 at a time)
    """
    try:
        urls = [url.strip() for url in request.urls if url.strip()]
        
        if not urls:
            raise HTTPException(status_code=400, detail="No valid URLs provided")
        
        if len(urls) > 100:
            raise HTTPException(status_code=400, detail="Maximum 100 URLs allowed")
        
        results = []
        successful = 0
        failed = 0
        
        # Process URLs in parallel (max 5 concurrent requests)
        async def process_single_url(url: str):
            try:
                url_request = UrlPredictionRequest(url=url)
                result = await predict_from_url(url_request)
                return {"success": True, "url": url, "result": result}
            except Exception as e:
                logger.error(f"Error processing URL {url}: {e}")
                return {"success": False, "url": url, "error": str(e)}
        
        # Process in batches of 5 concurrent requests
        batch_size = 5
        for i in range(0, len(urls), batch_size):
            batch = urls[i:i + batch_size]
            batch_results = await asyncio.gather(*[process_single_url(url) for url in batch])
            
            for batch_result in batch_results:
                results.append(batch_result)
                if batch_result["success"]:
                    successful += 1
                else:
                    failed += 1
        
        summary = {
            "total": len(urls),
            "successful": successful,
            "failed": failed,
        }
        
        return {
            "results": results,
            "summary": summary,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in batch prediction: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error processing batch: {str(e)}")


@app.post("/api/predict/from-details")
async def predict_from_details(request: CarDetailsPredictionRequest):
    """
    Predict price from car details (no URL scraping)
    """
    try:
        # Normalize input data
        prediction_input = {
            'make': data_normalizer.normalize_make(request.make),
            'model': data_normalizer.normalize_model(request.model),
            'year': request.year,
            'mileage': request.mileage,
            'condition': data_normalizer.normalize_condition(request.condition),
            'fuel_type': data_normalizer.normalize_fuel_type(request.fuel_type),
            'engine_size': request.engine_size or 2.0,
            'cylinders': request.cylinders or 4,
        }
        
        # Convert listing price to USD if needed
        listing_price_usd = request.listing_price
        if listing_price_usd and request.currency != 'USD':
            listing_price_usd = CurrencyConverter.to_usd(listing_price_usd, request.currency)
        
        # Predict price
        prediction_result = price_predictor.predict(prediction_input)
        predicted_price = prediction_result['predicted_price']
        confidence = prediction_result['confidence']
        price_range = prediction_result['price_range']
        
        # Calculate deal quality if listing price available
        deal_metrics = calculate_deal_quality(listing_price_usd or 0, predicted_price)
        
        # Build response
        response_data = {
            'make': prediction_input['make'],
            'model': prediction_input['model'],
            'year': prediction_input['year'],
            'mileage': prediction_input['mileage'],
            'condition': prediction_input['condition'],
            'fuel_type': prediction_input['fuel_type'],
            'location': request.location or 'Unknown',
            'listing_price': listing_price_usd,
            'predicted_price': predicted_price,
            'price_range': price_range,
            'confidence': confidence,
            'deal_quality': deal_metrics['deal_quality'],
            'deal_explanation': deal_metrics['deal_explanation'],
            'market_position': deal_metrics['market_position'],
            'platform': 'Manual Input',
            'currency': 'USD',
        }
        
        return {"success": True, "data": response_data}
        
    except Exception as e:
        logger.error(f"Error predicting from details: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error making prediction: {str(e)}")


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
