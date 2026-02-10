"""
Prediction endpoint
"""

from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import (
    PredictionRequest, PredictionResponse, ConfidenceInterval,
    MarketComparison, SimilarCar, MarketTrend, PriceFactor,
    DealScore, MarketDemand, CarFeatures
)
from app.services.predictor import Predictor
from app.services.market_analyzer import MarketAnalyzer
from app.services.url_scraper import CarListingScraper
from app.services.model_service import ModelService
from app.api.routes.auth import get_current_user, UserResponse
from typing import List, Optional
from pydantic import BaseModel
import logging
import pandas as pd
import numpy as np
import re

logger = logging.getLogger(__name__)

router = APIRouter()


class BatchPredictionRequest(BaseModel):
    """Request model for batch predictions"""
    cars: List[CarFeatures]


class BatchPredictionItem(BaseModel):
    """Single item in batch prediction response"""
    car: CarFeatures
    predicted_price: float = 0.0
    confidence_interval: Optional[ConfidenceInterval] = None
    error: Optional[str] = None


class BatchPredictionResponse(BaseModel):
    """Response model for batch predictions"""
    predictions: List[BatchPredictionItem]
    total: int
    successful: int
    failed: int


@router.post("/predict", response_model=PredictionResponse)
async def predict_price(
    request: PredictionRequest,
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """
    Predict car price from features with market analysis

    Request body should contain:
    {
        "features": {
            "year": 2020,
            "mileage": 30000,
            "engine_size": 2.5,
            "cylinders": 4,
            "make": "Toyota",
            "model": "Camry",
            "condition": "Good",
            "fuel_type": "Gasoline",
            "location": "California"
        }
    }

    Returns prediction with market comparison, trends, and similar cars.
    """
    try:
        logger.info("=" * 80)
        logger.info("📥 PREDICTION REQUEST RECEIVED")
        logger.info("=" * 80)

        # Convert Pydantic model to dict (fill optional mileage if missing)
        try:
            car_data = request.features.dict()
            if car_data.get("mileage") is None:
                car_data["mileage"] = 50000
            logger.info(
                f"✅ Request parsed successfully: {list(car_data.keys())}")
        except Exception as e:
            logger.error(f"❌ Failed to parse request: {e}", exc_info=True)
            raise HTTPException(
                status_code=400,
                detail=f"Invalid request format: {str(e)}"
            )

        # Log received data (sanitized)
        logger.info(
            f"📋 Received car data: make={car_data.get('make')}, model={car_data.get('model')}, year={car_data.get('year')}")

        # Ensure all numeric types are Python native (not numpy/Decimal) - MUST BE FIRST
        import numpy as np
        from decimal import Decimal

        def to_native_type(value):
            """Convert numpy/Decimal types to native Python types for JSON serialization"""
            if value is None:
                return None
            if isinstance(value, (np.integer, np.floating)):
                return value.item()
            elif isinstance(value, Decimal):
                return float(value)
            elif isinstance(value, np.ndarray):
                if value.size == 1:
                    return value.item()
                return value.tolist()
            elif isinstance(value, (list, tuple)):
                return [to_native_type(item) for item in value]
            elif isinstance(value, dict):
                return {k: to_native_type(v) for k, v in value.items()}
            return value

        # Convert ALL numeric fields to native Python types FIRST (mileage already defaulted above if None)
        for key in ['year', 'mileage', 'engine_size', 'cylinders']:
            if key in car_data and car_data[key] is not None:
                try:
                    if key in ['year', 'cylinders']:
                        car_data[key] = int(to_native_type(car_data[key]))
                    else:
                        car_data[key] = float(to_native_type(car_data[key]))
                except (ValueError, TypeError) as e:
                    logger.error(
                        f"❌ Invalid {key} value: {car_data[key]} ({type(car_data[key])})")
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid {key}: must be a number"
                    )

        # Validate required fields first (handle None values safely)
        make_value = car_data.get('make')
        if not make_value or (isinstance(make_value, str) and not make_value.strip()):
            logger.error("❌ Missing required field: make")
            raise HTTPException(
                status_code=400,
                detail="Make is required. Please select a car make."
            )
        car_data['make'] = (str(make_value) if make_value else "").strip()

        model_value = car_data.get('model')
        if not model_value or (isinstance(model_value, str) and not model_value.strip()):
            logger.error("❌ Missing required field: model")
            raise HTTPException(
                status_code=400,
                detail="Model is required. Please select a car model."
            )
        car_data['model'] = (str(model_value) if model_value else "").strip()

        if not car_data.get('year') or car_data.get('year') == 0:
            logger.error("❌ Missing required field: year")
            raise HTTPException(
                status_code=400,
                detail="Year is required. Please select a car year."
            )

        # Ensure year is int and validate range
        try:
            year = int(to_native_type(car_data['year']))
            # Validate year range (1900 to current year + 1 for new cars)
            current_year = 2025  # Match config.CURRENT_YEAR
            if year < 1900 or year > current_year + 1:
                logger.warning(
                    f"⚠️ Year {year} is outside valid range (1900-{current_year + 1})")
                # Cap year to valid range instead of failing
                year = max(1900, min(year, current_year + 1))
            car_data['year'] = year
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400, detail="Year must be a valid integer")

        logger.info("✅ Required fields validated")

        # Ensure safe defaults for optional string fields (handle None values)
        trim_value = car_data.get('trim')
        car_data['trim'] = (
            str(trim_value) if trim_value else "").strip() or None

        location_value = car_data.get('location')
        car_data['location'] = (
            str(location_value) if location_value else "").strip() or 'Unknown'

        condition_value = car_data.get('condition')
        car_data['condition'] = (
            str(condition_value) if condition_value else "").strip() or 'Good'

        fuel_type_value = car_data.get('fuel_type')
        car_data['fuel_type'] = (
            str(fuel_type_value) if fuel_type_value else "").strip() or 'Gasoline'

        # Validate make/model combination exists in dataset
        from app.services.dataset_loader import DatasetLoader
        try:
            dataset_loader = DatasetLoader.get_instance()
            df = dataset_loader.dataset
        except Exception as e:
            logger.error(f"Failed to load dataset: {e}", exc_info=True)
            raise HTTPException(
                status_code=503,
                detail="Dataset not available. Please try again later."
            )

        if df is None or len(df) == 0:
            logger.error("Dataset is empty or not loaded")
            raise HTTPException(
                status_code=503,
                detail="Dataset not loaded. Please try again later."
            )

        make = (str(car_data.get('make', ''))
                if car_data.get('make') else "").strip()
        model = (str(car_data.get('model', ''))
                 if car_data.get('model') else "").strip()

        # Check if make exists
        try:
            makes_in_dataset = df['make'].str.lower().unique()
            if make.lower() not in makes_in_dataset:
                raise HTTPException(
                    status_code=400,
                    detail=f"Make '{make}' not found in dataset. Please select a valid make."
                )

            # Check if model exists for this make
            models_for_make = df[df['make'].str.lower(
            ) == make.lower()]['model'].str.lower().unique()
            if model.lower() not in models_for_make:
                raise HTTPException(
                    status_code=400,
                    detail=f"Model '{model}' not found for make '{make}' in dataset. Please select a valid model."
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error validating make/model: {e}", exc_info=True)
            # Check if it's a dataset/model issue (503) or validation issue (400)
            error_str = str(e).lower()
            if 'dataset' in error_str or 'not loaded' in error_str or 'not available' in error_str:
                raise HTTPException(
                    status_code=503,
                    detail="Dataset not available. Please try again later."
                )
            raise HTTPException(
                status_code=400,
                detail=f"Error validating car details: {str(e)}"
            )

        # Make prediction (with or without images)
        logger.info("🔮 Starting prediction process...")
        model_service = None
        try:
            logger.info("📦 Initializing ModelService...")
            model_service = ModelService()
            logger.info("✅ ModelService initialized successfully")
        except RuntimeError as e:
            # Model file missing or not loaded - return 503 Service Unavailable
            logger.error(
                f"❌ Model not available (RuntimeError): {e}", exc_info=True)
            raise HTTPException(
                status_code=503,
                detail="Prediction model is not available. Please ensure model files are present and try again later."
            )
        except FileNotFoundError as e:
            # Model file missing - return 503 Service Unavailable
            logger.error(f"❌ Model file not found: {e}", exc_info=True)
            raise HTTPException(
                status_code=503,
                detail="Prediction model files are missing. Please ensure model files are present and try again later."
            )
        except Exception as e:
            logger.error(
                f"❌ Failed to initialize ModelService: {e}", exc_info=True)
            import traceback
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            # Check if error indicates missing model
            error_str = str(e).lower()
            if 'not found' in error_str or 'missing' in error_str or 'not available' in error_str:
                raise HTTPException(
                    status_code=503,
                    detail="Prediction model is not available. Please ensure model files are present and try again later."
                )
            raise HTTPException(
                status_code=500,
                detail=f"Model service initialization failed: {str(e)}"
            )

        # Convert image features if provided
        image_features_array = None
        image_features = getattr(request, "image_features", None)
        if image_features:
            try:
                image_features_array = np.array(image_features)
                # Validate shape (must be exactly 2048 for ResNet50)
                if len(image_features_array.shape) == 1:
                    if image_features_array.shape[0] != 2048:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid image_features length: expected 2048, got {image_features_array.shape[0]}"
                        )
                    # Valid - 2048 features
                    logger.info(
                        f"Received image_features with length {len(image_features_array)}")
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid image_features shape: expected 1D array (2048,), got {image_features_array.shape}"
                    )
            except HTTPException:
                raise
            except Exception as e:
                logger.error(
                    f"Error processing image features: {e}", exc_info=True)
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid image_features format: {str(e)}"
                )

        # Use ModelService for prediction (supports multimodal if available)
        logger.info("🤖 Making prediction...")
        try:
            if image_features_array is not None and model_service and model_service.is_multimodal_available:
                logger.info(
                    "📸 Using multimodal prediction (with image features)")
                predicted_price = model_service.predict(
                    car_data, image_features_array)
                # Convert to native type immediately
                predicted_price = to_native_type(predicted_price)
            else:
                # Use tabular-only prediction
                logger.info("📊 Using tabular-only prediction")
                logger.info(f"📋 Car data being sent to predictor: {car_data}")
                try:
                    predictor = Predictor()
                    logger.info("✅ Predictor initialized")
                except RuntimeError as e:
                    # Model file missing or not loaded - return 503 Service Unavailable
                    logger.error(f"❌ Model not available: {e}", exc_info=True)
                    raise HTTPException(
                        status_code=503,
                        detail="Prediction model is not available. Please ensure model files are present and try again later."
                    )
                except Exception as e:
                    logger.error(
                        f"❌ Failed to initialize Predictor: {e}", exc_info=True)
                    import traceback
                    logger.error(f"Full traceback:\n{traceback.format_exc()}")
                    # Check if it's a model missing issue
                    error_str = str(e).lower()
                    if 'not found' in error_str or 'missing' in error_str or 'not available' in error_str or 'model' in error_str:
                        raise HTTPException(
                            status_code=503,
                            detail="Prediction model is not available. Please ensure model files are present and try again later."
                        )
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to initialize predictor: {str(e)}"
                    )

                try:
                    predicted_price = predictor.predict(car_data)
                    # Convert to native type immediately
                    predicted_price = to_native_type(predicted_price)
                    logger.info(
                        f"✅ Prediction successful: ${predicted_price:,.2f}")
                except RuntimeError as e:
                    # Model file missing or not loaded - return 503 Service Unavailable
                    logger.error(
                        f"❌ Model not available during prediction: {e}", exc_info=True)
                    raise HTTPException(
                        status_code=503,
                        detail="Prediction model is not available. Please ensure model files are present and try again later."
                    )
                except Exception as e:
                    logger.error(f"❌ Prediction failed: {e}", exc_info=True)
                    import traceback
                    logger.error(f"Full traceback:\n{traceback.format_exc()}")
                    error_str = str(e).lower()
                    if 'not found' in error_str or 'missing' in error_str or 'not available' in error_str:
                        raise HTTPException(
                            status_code=503,
                            detail="Prediction model is not available. Please ensure model files are present and try again later."
                        )
                    raise HTTPException(
                        status_code=500,
                        detail=f"Prediction failed: {str(e)}"
                    )
        except HTTPException:
            raise
        except RuntimeError as e:
            # Model file missing or not loaded - return 503 Service Unavailable
            logger.error(
                f"❌ Prediction model not available: {e}", exc_info=True)
            import traceback
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            raise HTTPException(
                status_code=503,
                detail="Prediction model is not available. Please ensure model files are present and try again later."
            )
        except Exception as e:
            logger.error(
                f"❌ Unexpected error making prediction: {e}", exc_info=True)
            import traceback
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            raise HTTPException(
                status_code=500,
                detail=f"Error making prediction: {str(e)}"
            )

        # Validate prediction - check for unrealistic values
        # Ensure predicted_price is native Python float (not numpy/Decimal)
        try:
            predicted_price = float(to_native_type(predicted_price))
        except (ValueError, TypeError) as e:
            logger.error(
                f"❌ Failed to convert predicted_price to float: {predicted_price} (type: {type(predicted_price)})")
            raise HTTPException(
                status_code=500,
                detail=f"Prediction returned invalid result type: {type(predicted_price)}"
            )

        logger.info(f"🔍 Validating prediction result: ${predicted_price:,.2f}")
        if predicted_price < 0:
            logger.warning(
                f"⚠️ Negative prediction: {predicted_price}, using absolute value")
            predicted_price = abs(predicted_price)

        if predicted_price == 0 or predicted_price is None or not isinstance(predicted_price, (int, float)):
            logger.error(
                f"❌ Invalid prediction result: {predicted_price} (type: {type(predicted_price)})")
            raise HTTPException(
                status_code=500,
                detail="Prediction returned invalid result. Please check your input data."
            )

        logger.info(f"✅ Prediction validated: ${predicted_price:,.2f}")

        # Market analyzer will be initialized later in the market analysis section

        # Get similar cars from dataset for validation
        similar_cars_avg_price = None
        similar_cars_prices = []
        if df is not None and len(df) > 0:
            price_col = dataset_loader.get_price_column()
            if price_col and price_col in df.columns:
                # Find similar cars (same make and model)
                make = (str(car_data.get('make', '')) if car_data.get(
                    'make') else "").strip().lower()
                model = (str(car_data.get('model', ''))
                         if car_data.get('model') else "").strip().lower()
                year = car_data.get('year', None)
                if year is not None:
                    year = int(to_native_type(year))

                # Filter for similar cars (ensure make and model are strings)
                make_lower = (str(make) if make else "").strip().lower()
                model_lower = (str(model) if model else "").strip().lower()

                try:
                    similar = df[
                        (df['make'].str.lower() == make_lower) &
                        (df['model'].str.lower() == model_lower)
                    ].copy()

                    # If we have year, filter by similar years (±2 years)
                    if year and len(similar) > 0:
                        year_int = int(to_native_type(year))
                        similar = similar[
                            (similar['year'] >= year_int - 2) &
                            (similar['year'] <= year_int + 2)
                        ]

                    # If still not enough, broaden to same make
                    if len(similar) < 5:
                        similar = df[df['make'].str.lower() ==
                                     make_lower].copy()

                    if len(similar) > 0 and price_col in similar.columns:
                        valid_prices = similar[similar[price_col]
                                               > 0][price_col]
                        if len(valid_prices) > 0:
                            similar_cars_prices = [
                                float(to_native_type(p)) for p in valid_prices.tolist()]
                            similar_cars_avg_price = float(
                                to_native_type(valid_prices.mean()))
                except Exception as e:
                    logger.warning(
                        f"⚠️ Error getting similar cars (non-critical): {e}", exc_info=True)
                    # Continue without similar cars data

        # Validate prediction against similar cars (40% threshold)
        message = None
        validation_warning = None

        if similar_cars_avg_price and similar_cars_avg_price > 0:
            try:
                similar_cars_avg_price = float(
                    to_native_type(similar_cars_avg_price))
                price_diff_percent = abs(
                    (predicted_price - similar_cars_avg_price) / similar_cars_avg_price * 100)

                if price_diff_percent > 40:
                    validation_warning = f"WARNING: Prediction differs by {price_diff_percent:.1f}% from similar cars in dataset. "
                    validation_warning += f"Predicted: ${predicted_price:,.0f}, Market average: ${similar_cars_avg_price:,.0f}. "
                    validation_warning += "This may indicate a model accuracy issue."
                    logger.warning(validation_warning)

                    # Optionally adjust prediction to be closer to market average
                    # Cap at 30% above/below market average
                    if predicted_price > similar_cars_avg_price * 1.3:
                        predicted_price = float(similar_cars_avg_price * 1.3)
                        message = f"Prediction adjusted to ${predicted_price:,.0f} (capped at 30% above market average)"
                    elif predicted_price < similar_cars_avg_price * 0.7:
                        predicted_price = float(similar_cars_avg_price * 0.7)
                        message = f"Prediction adjusted to ${predicted_price:,.0f} (capped at 30% below market average)"
            except Exception as e:
                logger.warning(
                    f"⚠️ Error in price validation (non-critical): {e}", exc_info=True)
                # Continue without validation adjustment

        # Get dataset price range for additional validation
        price_min, price_max = 1000, 500000  # Default reasonable range
        if df is not None and len(df) > 0:
            try:
                price_col = dataset_loader.get_price_column()
                if price_col and price_col in df.columns:
                    valid_prices = df[df[price_col] > 0][price_col]
                    if len(valid_prices) > 0:
                        price_min = float(to_native_type(
                            valid_prices.quantile(0.01)))  # 1st percentile
                        price_max = float(to_native_type(
                            valid_prices.quantile(0.99)))  # 99th percentile
            except Exception as e:
                logger.warning(
                    f"⚠️ Error getting price range (non-critical): {e}", exc_info=True)
                # Use defaults

        # Detect luxury brands for special price handling
        luxury_brands = [
            'rolls royce', 'rolls-royce', 'bentley', 'ferrari', 'lamborghini',
            'aston martin', 'mclaren', 'bugatti', 'maybach', 'porsche',
            'maserati'
        ]
        premium_brands = [
            'mercedes-benz', 'mercedes', 'bmw', 'audi', 'lexus',
            'land rover', 'jaguar', 'cadillac', 'tesla', 'range rover'
        ]

        make_lower = str(car_data.get('make', '')).lower().strip()
        is_luxury = any(brand in make_lower for brand in luxury_brands) or (
            'rolls' in make_lower and 'royce' in make_lower)
        is_premium = any(brand in make_lower for brand in premium_brands)

        # Additional validation for extreme values
        try:
            predicted_price = float(to_native_type(predicted_price))
            if predicted_price < 100:
                logger.warning(f"Very low prediction: ${predicted_price:,.2f}")
                # Cap at half of minimum
                predicted_price = float(max(predicted_price, price_min * 0.5))
                if not message:
                    message = f"Warning: Prediction seems unusually low (${predicted_price:,.2f}). Please verify your car details match the dataset."
            elif is_luxury:
                # Luxury vehicles: Allow much higher prices (up to 3x dataset max or 500k, whichever is higher)
                luxury_max = max(price_max * 3.0, 500000)
                if predicted_price > luxury_max:
                    logger.info(
                        f"Luxury car prediction: ${predicted_price:,.2f}, allowing up to ${luxury_max:,.2f}")
                    # Don't cap luxury cars too aggressively - only if extremely high
                    if predicted_price > 1000000:
                        predicted_price = float(min(predicted_price, 1000000))
                        if not message:
                            message = f"Note: High-end luxury vehicle prediction (${predicted_price:,.2f})."
                # Don't apply the normal capping for luxury vehicles
            elif is_premium:
                # Premium vehicles: Allow higher prices (up to 2x dataset max)
                premium_max = max(price_max * 2.0, 200000)
                if predicted_price > premium_max:
                    logger.info(
                        f"Premium car prediction: ${predicted_price:,.2f}, allowing up to ${premium_max:,.2f}")
                    if predicted_price > premium_max * 1.5:
                        predicted_price = float(
                            min(predicted_price, premium_max * 1.5))
                # Apply less aggressive capping for premium vehicles
            elif predicted_price > price_max * 1.5:
                # Regular vehicles: Apply normal capping
                logger.warning(
                    f"Very high prediction: ${predicted_price:,.2f}")
                # Cap at 30% above maximum for regular cars
                predicted_price = float(min(predicted_price, price_max * 1.3))
                if not message:
                    message = f"Note: Prediction seems unusually high (${predicted_price:,.2f}). Please verify your car details."

            # Ensure prediction is within bounds (different limits for luxury/premium)
            if is_luxury:
                predicted_price = float(
                    max(50000, min(predicted_price, 1000000)))  # Luxury: 50k-1M
            elif is_premium:
                predicted_price = float(max(10000, min(predicted_price, max(
                    price_max * 2.0, 300000))))  # Premium: 10k-300k+
            else:
                # Regular: normal bounds
                predicted_price = float(
                    max(100, min(predicted_price, price_max * 1.5)))
        except Exception as e:
            logger.warning(
                f"⚠️ Error in price bounds validation (non-critical): {e}", exc_info=True)
            # Ensure at least it's a valid float
            predicted_price = float(to_native_type(predicted_price))
            # Safe fallback bounds
            predicted_price = max(100, min(predicted_price, 1000000))

        # Combine messages
        if validation_warning and message:
            message = f"{validation_warning} {message}"
        elif validation_warning:
            message = validation_warning

        # Market comparison
        logger.info("📈 Starting market analysis...")
        market_analyzer = None
        try:
            logger.info("📦 Initializing MarketAnalyzer...")
            market_analyzer = MarketAnalyzer()
            logger.info("✅ MarketAnalyzer initialized successfully")
        except Exception as e:
            logger.error(
                f"⚠️ Failed to initialize MarketAnalyzer (non-critical): {e}", exc_info=True)
            # Don't crash prediction if market analyzer fails - use minimal response
            market_analyzer = None

        if market_analyzer is None:
            logger.warning(
                "⚠️ MarketAnalyzer not available, using minimal response")

        # Market analysis - wrap in try-catch to not crash prediction
        market_comparison = None
        deal_analysis = None
        deal_score = None
        price_factors = []
        market_demand = None
        similar_cars = []
        preview_image = None
        car_image_path = None
        market_trends = []
        precision = 20.0
        confidence_interval = None
        confidence_range = 0.0
        confidence_level = 'medium'

        if market_analyzer is not None:
            try:
                market_comparison_data = market_analyzer.get_market_comparison(
                    predicted_price, car_data)
                # Ensure all values are native Python types
                market_comparison_data = {
                    k: to_native_type(v) for k, v in market_comparison_data.items()
                }
                market_comparison = MarketComparison(**market_comparison_data)

                # Deal analysis
                deal_analysis_raw = market_analyzer.get_deal_analysis(
                    predicted_price, market_comparison_data)
                deal_analysis = str(
                    deal_analysis_raw) if deal_analysis_raw else None

                # Deal score with badge
                deal_score_data = market_analyzer.get_deal_score(
                    predicted_price, market_comparison_data)
                deal_score_data = {k: to_native_type(
                    v) for k, v in deal_score_data.items()}
                deal_score = DealScore(**deal_score_data)

                # Confidence interval (using default 20% precision)
                confidence_interval_data = market_analyzer.get_confidence_interval(
                    predicted_price, precision)
                confidence_interval_data = {
                    k: to_native_type(v) for k, v in confidence_interval_data.items()
                }
                confidence_interval = ConfidenceInterval(
                    **confidence_interval_data)
                upper_val = float(to_native_type(confidence_interval.upper))
                lower_val = float(to_native_type(confidence_interval.lower))
                confidence_range = float((upper_val - lower_val) / 2)
                confidence_level = str(
                    market_analyzer.get_confidence_level(precision) or 'medium')

                # Price factors (Why This Price)
                price_factors_data = market_analyzer.get_price_factors(
                    car_data, predicted_price)
                price_factors = []
                for factor in price_factors_data:
                    factor_clean = {k: to_native_type(
                        v) for k, v in factor.items()}
                    price_factors.append(PriceFactor(**factor_clean))

                # Market demand
                market_demand_data = market_analyzer.get_market_demand(
                    car_data)
                market_demand = MarketDemand(**market_demand_data)

                # Similar cars (filter out invalid prices)
                # Pass predicted_price for intelligent filtering by price range and brand tier
                similar_cars_data = market_analyzer.get_similar_cars(
                    car_data, limit=10, predicted_price=predicted_price)
                # Filter out cars with invalid prices and ensure native types
                similar_cars_filtered = []
                for car in similar_cars_data:
                    price = car.get('price', 0)
                    if price > 0 and not pd.isna(price):
                        car_clean = {k: to_native_type(
                            v) for k, v in car.items()}
                        similar_cars_filtered.append(car_clean)
                similar_cars = [SimilarCar(**car)
                                for car in similar_cars_filtered[:10]]

                # Get preview image with STRICT matching hierarchy
                # Rules: Image must ALWAYS be same make/model/trim, never fall back to different make/model
                preview_image = None
                car_image_path = None
                image_match_type = None
                image_match_info = None

                def normalize_make(make_str: str) -> str:
                    """Normalize make to canonical form (e.g., 'Rolls Royce' -> 'rolls-royce')"""
                    if not make_str:
                        return ''
                    make_lower = str(make_str).lower().strip()
                    # Normalize Rolls Royce variations
                    if 'rolls' in make_lower and 'royce' in make_lower:
                        return 'rolls-royce'
                    # Normalize other common variations
                    make_lower = make_lower.replace(' ', '-').replace('_', '-')
                    return make_lower

                def normalize_model_trim(model_str: str, trim_str: str = None) -> tuple[str, str]:
                    """Normalize model and trim to canonical form"""
                    if not model_str:
                        return '', ''
                    model_lower = str(model_str).lower().strip()
                    trim_lower = str(trim_str).lower(
                    ).strip() if trim_str else ''

                    # Normalize Ghost Black Badge variations
                    if 'ghost' in model_lower and ('black' in model_lower or 'black' in trim_lower or 'badge' in model_lower or 'badge' in trim_lower):
                        # Combine model and trim for Ghost Black Badge
                        combined = f"{model_lower} {trim_lower}".strip()
                        if 'ghost' in combined and ('black' in combined or 'badge' in combined):
                            return 'ghost', 'black badge'
                    return model_lower, trim_lower

                def extract_image_from_row(row) -> tuple[str | None, str | None]:
                    """Extract preview_image and car_image_path from DataFrame row"""
                    img_url = None
                    img_path = None

                    # Check for image_1 column (image URL from dataset)
                    if 'image_1' in row and pd.notna(row.get('image_1')):
                        image_url = str(row.get('image_1')).strip()
                        if image_url:
                            image_url = image_url.replace('\\', '/')
                            if image_url.startswith('car_') and image_url.endswith('.jpg'):
                                image_url = f"/api/car-images/{image_url}"
                            elif image_url.startswith('/car_images/'):
                                filename = image_url.replace(
                                    '/car_images/', '')
                                image_url = f"/api/car-images/{filename}"
                            img_url = image_url

                    # Fallback to generating image_id from row index
                    if not img_url:
                        try:
                            row_idx = int(row.name) if pd.notna(
                                row.name) else 0
                            img_path = f"car_{row_idx:06d}.jpg"
                        except (ValueError, TypeError):
                            img_path = "car_000000.jpg"

                    return img_url, img_path

                try:
                    if market_analyzer.dataset_loader.dataset is not None:
                        df = market_analyzer.dataset_loader.dataset

                        # Normalize input
                        input_make_raw = str(car_data.get('make', '')).strip()
                        input_model_raw = str(
                            car_data.get('model', '')).strip()
                        input_trim_raw = str(car_data.get('trim', '')).strip(
                        ) if car_data.get('trim') else ''
                        input_year = int(car_data.get('year', 2020))

                        input_make = normalize_make(input_make_raw)
                        input_model, input_trim = normalize_model_trim(
                            input_model_raw, input_trim_raw)

                        # Normalize dataset columns for matching
                        df_make_normalized = df['make'].astype(
                            str).str.lower().str.strip().apply(normalize_make)
                        df_model_normalized = df['model'].astype(
                            str).str.lower().str.strip()
                        df_trim_normalized = df['trim'].astype(str).str.lower().str.strip(
                        ) if 'trim' in df.columns else pd.Series([''] * len(df))

                        # Normalize dataset model+trim for Ghost Black Badge matching
                        df_model_trim_combined = df_model_normalized + ' ' + df_trim_normalized
                        df_model_normalized_combined = df_model_normalized.copy()
                        df_trim_normalized_combined = df_trim_normalized.copy()

                        # Apply Ghost Black Badge normalization to dataset
                        for idx in df.index:
                            model_val = str(df_model_normalized.iloc[idx]) if idx < len(
                                df_model_normalized) else ''
                            trim_val = str(df_trim_normalized.iloc[idx]) if idx < len(
                                df_trim_normalized) else ''
                            combined = f"{model_val} {trim_val}".strip()
                            if 'ghost' in combined.lower() and ('black' in combined.lower() or 'badge' in combined.lower()):
                                df_model_normalized_combined.iloc[idx] = 'ghost'
                                df_trim_normalized_combined.iloc[idx] = 'black badge'

                        # Priority 1: Exact match (make + model + trim + year)
                        exact_match = df[
                            (df_make_normalized == input_make) &
                            (df_model_normalized_combined == input_model) &
                            (df_trim_normalized_combined == input_trim) &
                            (df['year'] == input_year)
                        ]

                        if len(exact_match) > 0:
                            match_row = exact_match.iloc[0]
                            preview_image, car_image_path = extract_image_from_row(
                                match_row)
                            if preview_image or car_image_path:
                                image_match_type = 'exact'
                                logger.debug(
                                    f"✅ Exact image match found: {input_make_raw} {input_model_raw} {input_year}")

                        # Priority 2: Same make + model + trim, nearest year (NEVER different make/model)
                        if not preview_image and not car_image_path:
                            same_model_trim = df[
                                (df_make_normalized == input_make) &
                                (df_model_normalized_combined == input_model) &
                                (df_trim_normalized_combined == input_trim)
                            ]

                            if len(same_model_trim) > 0:
                                # Find nearest year
                                same_model_trim['year_diff'] = (
                                    same_model_trim['year'] - input_year).abs()
                                nearest_match = same_model_trim.nsmallest(
                                    1, 'year_diff')
                                if len(nearest_match) > 0:
                                    match_row = nearest_match.iloc[0]
                                    preview_image, car_image_path = extract_image_from_row(
                                        match_row)
                                    if preview_image or car_image_path:
                                        match_year = int(match_row['year'])
                                        image_match_type = 'same_model_different_year'
                                        image_match_info = f"This image is {input_make_raw} {input_model_raw} but not same model or years"
                                        logger.debug(
                                            f"✅ Same model/trim match (year {match_year}): {input_make_raw} {input_model_raw}")

                        # Priority 3: Same make + model only (no trim match)
                        if not preview_image and not car_image_path:
                            same_model = df[
                                (df_make_normalized == input_make) &
                                (df_model_normalized_combined == input_model)
                            ]

                            if len(same_model) > 0:
                                # Find nearest year
                                same_model['year_diff'] = (
                                    same_model['year'] - input_year).abs()
                                nearest_match = same_model.nsmallest(
                                    1, 'year_diff')
                                if len(nearest_match) > 0:
                                    match_row = nearest_match.iloc[0]
                                    preview_image, car_image_path = extract_image_from_row(
                                        match_row)
                                    if preview_image or car_image_path:
                                        match_year = int(match_row['year'])
                                        image_match_type = 'same_make'
                                        image_match_info = f"This image is {input_make_raw} but not same model or years"
                                        logger.debug(
                                            f"✅ Same make/model match (year {match_year}): {input_make_raw} {input_model_raw}")

                        # NEVER fall back to different make/model - only use similar_cars if still no match
                        # Priority 4: Use first similar car ONLY if it matches make/model
                        if not preview_image and not car_image_path and similar_cars and len(similar_cars) > 0:
                            # Check if first similar car matches make/model
                            first_similar = similar_cars[0]
                            similar_make = normalize_make(
                                str(first_similar.make) if first_similar.make else '')
                            similar_model, _ = normalize_model_trim(
                                str(first_similar.model) if first_similar.model else '',
                                ''
                            )

                            # Only use if make/model matches
                            if similar_make == input_make and similar_model == input_model:
                                if first_similar.image_url:
                                    preview_image = str(
                                        first_similar.image_url) if first_similar.image_url else None
                                elif first_similar.image_id:
                                    car_image_path = str(
                                        first_similar.image_id) if first_similar.image_id else None

                                if preview_image or car_image_path:
                                    image_match_type = 'fallback'
                                    image_match_info = f"This image is {input_make_raw} but not same model or years"
                                    logger.debug(
                                        f"✅ Fallback match from similar cars: {input_make_raw} {input_model_raw}")

                except Exception as e:
                    logger.debug(
                        f"Could not extract image URL (non-critical): {e}")
                    preview_image = None
                    car_image_path = None
                    image_match_type = None
                    image_match_info = None

                # Market trends
                market_trends_data = market_analyzer.get_market_trends(
                    car_data, months=6)
                market_trends = []
                for trend in market_trends_data:
                    trend_clean = {k: to_native_type(
                        v) for k, v in trend.items()}
                    market_trends.append(MarketTrend(**trend_clean))

                logger.info("✅ Market analysis completed successfully")
            except Exception as e:
                logger.error(
                    f"⚠️ Error in market analysis (non-critical): {e}", exc_info=True)
                # Use minimal defaults if market analysis fails - don't crash prediction
                try:
                    if market_analyzer:
                        confidence_interval_data = market_analyzer.get_confidence_interval(
                            predicted_price, precision)
                        confidence_interval_data = {
                            k: to_native_type(v) for k, v in confidence_interval_data.items()
                        }
                        confidence_interval = ConfidenceInterval(
                            **confidence_interval_data)
                        upper_val = float(to_native_type(
                            confidence_interval.upper))
                        lower_val = float(to_native_type(
                            confidence_interval.lower))
                        confidence_range = float((upper_val - lower_val) / 2)
                        confidence_level = 'medium'
                except Exception as e:
                    logger.debug(
                        f"Could not create fallback confidence interval: {e}")
                    pass
                logger.warning(
                    "⚠️ Continuing with minimal response due to market analysis error")

        # Ensure we have at least a basic confidence interval
        if confidence_interval is None:
            predicted_price_float = float(to_native_type(predicted_price))
            confidence_interval = ConfidenceInterval(
                lower=float(predicted_price_float * 0.85),
                upper=float(predicted_price_float * 1.15)
            )
            confidence_range = float(predicted_price_float * 0.15)
            confidence_level = 'medium'

        # Save prediction attempt for feedback tracking and model improvement
        logger.info("💾 Saving prediction to database...")
        prediction_id = None
        try:
            from app.services.feedback_service import save_prediction

            # Save prediction with user_id if authenticated
            user_id = current_user.id if current_user else None
            logger.info(f"💾 Saving prediction for user_id: {user_id}")

            # Prepare confidence interval data for saving
            confidence_interval_for_db = None
            if confidence_interval:
                try:
                    confidence_interval_for_db = {
                        'lower': float(to_native_type(confidence_interval.lower)),
                        'upper': float(to_native_type(confidence_interval.upper))
                    }
                except Exception as e:
                    logger.warning(
                        f"⚠️ Error preparing confidence interval for DB (non-critical): {e}")
                    confidence_interval_for_db = None

            prediction_id = save_prediction(
                car_features=car_data,
                predicted_price=predicted_price,
                user_id=user_id,
                confidence_interval=confidence_interval_for_db,
                confidence_level=confidence_level,
                image_features=getattr(request, "image_features", None)
            )
            logger.info(f"✅ Saved prediction attempt: ID {prediction_id}")
        except Exception as e:
            # Don't fail prediction if saving fails, just log it
            logger.warning(
                f"⚠️ Failed to save prediction for feedback tracking: {e}", exc_info=True)

        logger.info("📦 Creating response object...")
        try:
            # Ensure all numeric values are native Python types
            predicted_price_final = float(to_native_type(predicted_price))
            confidence_range_final = float(to_native_type(confidence_range))
            precision_final = float(to_native_type(precision))

            # Ensure message is string or None
            message_final = str(message) if message else None

            # Ensure confidence_level is string
            confidence_level_final = str(
                confidence_level) if confidence_level else 'medium'

            response = PredictionResponse(
                predicted_price=float(round(predicted_price_final, 2)),
                message=message_final,
                confidence_interval=confidence_interval,
                confidence_range=float(round(confidence_range_final, 2)),
                precision=precision_final,
                confidence_level=confidence_level_final,
                market_comparison=market_comparison,
                deal_analysis=str(deal_analysis) if deal_analysis else None,
                deal_score=deal_score,
                price_factors=price_factors,
                market_demand=market_demand,
                similar_cars=similar_cars,
                market_trends=market_trends,
                car_image_path=str(car_image_path) if car_image_path else None,
                preview_image=str(preview_image) if preview_image else None,
                image_match_type=image_match_type,
                image_match_info=image_match_info
            )
            logger.info("✅ Response object created successfully")
        except Exception as e:
            logger.error(
                f"❌ Error creating response object: {e}", exc_info=True)
            import traceback
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            # Create minimal response if full response fails
            logger.warning("⚠️ Creating minimal response due to error")
            try:
                predicted_price_final = float(to_native_type(predicted_price))
                response = PredictionResponse(
                    predicted_price=float(round(predicted_price_final, 2)),
                    message=str(
                        message) if message else "Prediction completed with limited analysis.",
                    confidence_interval=confidence_interval or ConfidenceInterval(
                        lower=float(predicted_price_final * 0.85),
                        upper=float(predicted_price_final * 1.15)
                    ),
                    confidence_range=float(
                        round(to_native_type(confidence_range), 2)),
                    precision=float(to_native_type(precision)),
                    confidence_level=str(
                        confidence_level) if confidence_level else 'medium'
                )
            except Exception as e2:
                logger.error(
                    f"❌ Failed to create even minimal response: {e2}", exc_info=True)
                # Last resort - absolute minimal response
                predicted_price_final = float(to_native_type(predicted_price))
                response = PredictionResponse(
                    predicted_price=predicted_price_final,
                    message="Prediction completed.",
                    confidence_interval=ConfidenceInterval(
                        lower=float(predicted_price_final * 0.85),
                        upper=float(predicted_price_final * 1.15)
                    ),
                    confidence_range=float(predicted_price_final * 0.15),
                    precision=20.0,
                    confidence_level='medium'
                )

        logger.info("=" * 80)
        logger.info(
            f"✅ PREDICTION COMPLETED SUCCESSFULLY: ${predicted_price:,.2f}")
        logger.info("=" * 80)

        # Add prediction_id to response (we'll need to extend the schema)
        # For now, we'll return it in a custom header or extend the response model
        return response

    except HTTPException:
        # Re-raise HTTP exceptions (400, 500, etc.)
        logger.error("=" * 80)
        logger.error("❌ PREDICTION FAILED - HTTP Exception")
        logger.error("=" * 80)
        raise
    except ValueError as e:
        logger.error("=" * 80)
        logger.error(f"❌ PREDICTION FAILED - Validation error: {e}")
        logger.error("=" * 80)
        logger.error(f"Full traceback:", exc_info=True)
        raise HTTPException(
            status_code=400, detail=f"Validation error: {str(e)}")
    except RuntimeError as e:
        # Model file missing or not loaded - return 503 Service Unavailable
        logger.error("=" * 80)
        logger.error(f"❌ PREDICTION FAILED - Model not available: {e}")
        logger.error("=" * 80)
        logger.error(f"Full traceback:", exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="Prediction model is not available. Please ensure model files are present and try again later."
        )
    except FileNotFoundError as e:
        # Model file missing - return 503 Service Unavailable
        logger.error("=" * 80)
        logger.error(f"❌ PREDICTION FAILED - Model file not found: {e}")
        logger.error("=" * 80)
        logger.error(f"Full traceback:", exc_info=True)
        raise HTTPException(
            status_code=503,
            detail="Prediction model files are missing. Please ensure model files are present and try again later."
        )
    except Exception as e:
        logger.error("=" * 80)
        logger.error(f"❌ PREDICTION FAILED - Unexpected error: {e}")
        logger.error("=" * 80)
        import traceback
        tb_str = traceback.format_exc()
        logger.error(f"Full traceback:\n{tb_str}")
        # Provide more helpful error message
        error_msg = str(e)
        error_lower = error_msg.lower()
        if "not found" in error_lower or "missing" in error_lower or "not available" in error_lower or "model" in error_lower:
            raise HTTPException(
                status_code=503,
                detail="Prediction model is not available. Please ensure model files are present and try again later."
            )
        elif "validation" in error_lower or "invalid" in error_lower:
            raise HTTPException(
                status_code=400, detail=f"Invalid input: {error_msg}")
        else:
            raise HTTPException(
                status_code=500, detail=f"Error making prediction: {error_msg}")


@router.post("/predict/batch", response_model=BatchPredictionResponse)
async def predict_batch(request: BatchPredictionRequest):
    """
    Batch predict prices for multiple cars

    Request body should contain:
    {
        "cars": [
            {
                "year": 2020,
                "mileage": 30000,
                "engine_size": 2.5,
                "cylinders": 4,
                "make": "Toyota",
                "model": "Camry",
                "condition": "Good",
                "fuel_type": "Gasoline",
                "location": "California"
            },
            ...
        ]
    }

    Returns batch predictions with confidence intervals.
    """
    try:
        logger.info(
            f"🚀 Batch prediction request received for {len(request.cars)} cars")

        # Validate batch size
        if len(request.cars) > 1000:
            raise HTTPException(
                status_code=400,
                detail="Maximum 1000 cars allowed per batch"
            )

        if len(request.cars) == 0:
            raise HTTPException(
                status_code=400,
                detail="At least 1 car required"
            )

        # Initialize predictor and market analyzer
        predictor = Predictor()
        market_analyzer = MarketAnalyzer()

        # Process predictions
        predictions = []
        successful = 0
        failed = 0

        for i, car in enumerate(request.cars):
            try:
                # Convert to dict
                car_data = car.dict()

                # Make prediction
                predicted_price = predictor.predict(car_data)

                # Validate prediction
                if predicted_price < 0:
                    logger.warning(
                        f"Negative prediction for car {i+1}: {predicted_price}, using absolute value")
                    predicted_price = abs(predicted_price)

                # Cap at reasonable bounds
                predicted_price = max(100, min(predicted_price, 500000))

                # Get confidence interval (using default 20% precision)
                precision = 20.0
                confidence_interval_data = market_analyzer.get_confidence_interval(
                    predicted_price, precision)
                confidence_interval = ConfidenceInterval(
                    **confidence_interval_data)

                predictions.append(BatchPredictionItem(
                    car=car,
                    predicted_price=round(predicted_price, 2),
                    confidence_interval=confidence_interval
                ))
                successful += 1

                logger.info(
                    f"✅ Predicted {i+1}/{len(request.cars)}: ${predicted_price:.2f}")

            except Exception as e:
                logger.error(f"❌ Failed to predict car {i+1}: {e}")
                failed += 1
                # Include failed item with error message
                predictions.append(BatchPredictionItem(
                    car=car,
                    predicted_price=0.0,
                    confidence_interval=None,
                    error=str(e)
                ))
                # Continue with next car instead of failing entire batch

        logger.info(
            f"✅ Batch prediction completed: {successful} successful, {failed} failed")

        return BatchPredictionResponse(
            predictions=predictions,
            total=len(request.cars),
            successful=successful,
            failed=failed
        )

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Batch prediction error: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error processing batch: {str(e)}")


class UrlPredictionRequest(BaseModel):
    """Request model for URL-based prediction"""
    url: str


class UrlPredictionResponse(BaseModel):
    """Response model for URL-based prediction"""
    extracted_data: CarFeatures
    predicted_price: float
    listing_price: Optional[float] = None
    price_comparison: Optional[dict] = None
    confidence_interval: Optional[ConfidenceInterval] = None
    message: Optional[str] = None


@router.post("/predict/from-url")
async def predict_from_url(request: UrlPredictionRequest):
    """
    Predict car price from a car listing URL

    Scrapes the car listing page to extract car details, then predicts the price.

    Request body should contain:
    {
        "url": "https://www.iqcars.net/en/car/..."
    }

    Returns extracted car details, predicted price, and comparison with listing price.
    """
    try:
        # Validate URL
        if not request.url or not request.url.strip():
            raise HTTPException(status_code=400, detail="URL is required")

        url = request.url.strip()

        # Scrape car listing
        logger.info(f"Scraping car listing from URL: {url}")
        scraper = CarListingScraper()
        
        try:
            extracted_data = scraper.scrape_car_listing(url)
        except ValueError as e:
            # Scraper validation error
            error_msg = str(e)
            logger.warning(f"Scraper validation error for {url}: {error_msg}")
            raise HTTPException(
                status_code=400,
                detail=f"Could not extract car data from the listing: {error_msg}. Please ensure the URL is a valid car listing page."
            )
        except Exception as e:
            # General scraper error
            error_msg = str(e)
            logger.error(f"Scraper error for {url}: {error_msg}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Error scraping listing page: {error_msg}. The website may be blocking requests or the page structure may have changed."
            )

        # Validate extracted data
        if not extracted_data.get('make') or not extracted_data.get('model'):
            raise HTTPException(
                status_code=400,
                detail="Could not extract make and model from the listing. Please ensure the URL is a valid car listing page."
            )

        if not extracted_data.get('year'):
            raise HTTPException(
                status_code=400,
                detail="Could not extract year from the listing. Please ensure the listing contains car details."
            )

        # Log extracted data for debugging
        logger.info(f"Extracted data from scraper: {extracted_data}")

        # Ensure all required fields have defaults (allow 0 for mileage)
        year = extracted_data.get('year') or 2020
        _m = extracted_data.get('mileage')
        mileage = 50000 if (_m is None or (_m != _m)) else float(_m)  # _m != _m is True for NaN
        engine_size = extracted_data.get('engine_size') or 2.0
        cylinders = extracted_data.get('cylinders') or 4
        make = extracted_data.get('make', '').strip()
        model = extracted_data.get('model', '').strip()
        condition = extracted_data.get('condition') or 'Good'
        fuel_type = extracted_data.get('fuel_type') or 'Gasoline'
        location = extracted_data.get('location') or 'Unknown'

        # Validate and clean make/model/location (remove any JSON artifacts)
        if make and (len(make) > 50 or make.startswith('{') or make.startswith('[')):
            logger.warning(
                f"Make value invalid ({len(make)} chars, starts with {make[:5]}), attempting to clean: {make[:100]}...")
            # Try to extract just the brand name
            brand_match = re.search(r'\b(Ford|Toyota|Honda|BMW|Mercedes|Nissan|Hyundai|Kia|Chevrolet|Volkswagen|Audi|Lexus|Mazda|Subaru|Jeep|Dodge|GMC|Cadillac|Lincoln|Infiniti|Acura|Volvo|Porsche|Jaguar|Land Rover|Range Rover|Mini|Fiat|Peugeot|Renault|Citroen|Opel|Skoda|Seat|Alfa Romeo|Mitsubishi|Suzuki|Isuzu|Daewoo|Ssangyong)\b', make, re.I)
            if brand_match:
                make = brand_match.group(1)
                logger.info(f"Cleaned make to: {make}")
            else:
                # Take first word if it's reasonable
                first_word = make.split()[0] if make.split() else ''
                if first_word and len(first_word) < 30 and not first_word.startswith('{'):
                    make = first_word
                    logger.info(f"Using first word as make: {make}")
                else:
                    make = 'Unknown'
                    logger.warning("Could not clean make, using 'Unknown'")

        if model and (len(model) > 100 or model.startswith('{') or model.startswith('[')):
            logger.warning(
                f"Model value invalid ({len(model)} chars), attempting to clean: {model[:100]}...")
            # Take first few words
            model_parts = model.split()[:3]
            if model_parts and not model_parts[0].startswith('{'):
                model = ' '.join(model_parts)
                logger.info(f"Cleaned model to: {model}")
            else:
                model = 'Unknown'
                logger.warning("Could not clean model, using 'Unknown'")

        # Clean location if it looks like JSON
        if location and (len(location) > 100 or location.startswith('{') or location.startswith('[')):
            logger.warning(
                f"Location value invalid ({len(location)} chars), attempting to clean: {location[:100]}...")
            # Try to extract location name
            loc_match = re.search(
                r'\b(Zaxo|Duhok|Erbil|Baghdad|Basra|Mosul|Kirkuk|Sulaymaniyah|Najaf|Karbala|Nasiriyah|Ramadi|Fallujah|Samarra|Baqubah|Amara|Diwaniyah|Kut|Hillah|Halabja)\b', location, re.I)
            if loc_match:
                location = loc_match.group(1)
                logger.info(f"Cleaned location to: {location}")
            else:
                location = 'Unknown'
                logger.warning("Could not clean location, using 'Unknown'")

        # Convert extracted data to CarFeatures with validation
        try:
            car_features = CarFeatures(
                year=int(year),
                mileage=float(mileage),
                engine_size=float(engine_size),
                cylinders=int(cylinders),
                make=make,
                model=model,
                condition=condition,
                fuel_type=fuel_type,
                location=location,
            )
            logger.info(
                f"Created CarFeatures: make={make}, model={model}, year={year}, mileage={mileage}")
        except Exception as e:
            error_msg = f"Failed to create CarFeatures: {str(e)}. Extracted data: year={year}, mileage={mileage}, engine_size={engine_size}, cylinders={cylinders}, make={make[:50] if make else None}, model={model[:50] if model else None}, condition={condition}, fuel_type={fuel_type}, location={location}"
            logger.error(error_msg)
            raise HTTPException(status_code=400, detail=error_msg)

        # Validate make/model combination exists in dataset
        from app.services.dataset_loader import DatasetLoader
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset

        if df is not None and len(df) > 0:
            make = car_features.make.strip()
            model = car_features.model.strip()

            # Check if make exists
            makes_in_dataset = df['make'].str.lower().unique()
            if make.lower() not in makes_in_dataset:
                raise HTTPException(
                    status_code=400,
                    detail=f"Make '{make}' not found in dataset. The listing may contain a make not in our training data."
                )

            # Check if model exists for this make
            models_for_make = df[df['make'].str.lower(
            ) == make.lower()]['model'].str.lower().unique()
            if model.lower() not in models_for_make:
                raise HTTPException(
                    status_code=400,
                    detail=f"Model '{model}' not found for make '{make}' in dataset. The listing may contain a model not in our training data."
                )

        # Make prediction
        predictor = Predictor()
        car_data = car_features.dict()
        predicted_price = predictor.predict(car_data)

        # Validate prediction
        if predicted_price < 0:
            logger.warning(
                f"Negative prediction: {predicted_price}, using absolute value")
            predicted_price = abs(predicted_price)

        # Cap at reasonable bounds
        predicted_price = max(100, min(predicted_price, 500000))

        # Get confidence interval
        market_analyzer = MarketAnalyzer()
        precision = 20.0
        confidence_interval_data = market_analyzer.get_confidence_interval(
            predicted_price, precision)
        confidence_interval = ConfidenceInterval(**confidence_interval_data)

        # Get listing price if available
        listing_price = extracted_data.get('listing_price')

        # Calculate price comparison if listing price is available
        price_comparison = None
        message = None

        if listing_price and listing_price > 0:
            price_diff = predicted_price - listing_price
            price_diff_percent = (price_diff / listing_price) * 100

            price_comparison = {
                'listing_price': listing_price,
                'predicted_price': predicted_price,
                'difference': price_diff,
                'difference_percent': round(price_diff_percent, 2),
                'is_above_market': price_diff > 0,
                'is_below_market': price_diff < 0,
            }

            if abs(price_diff_percent) < 5:
                message = "Listing price is very close to predicted market value."
            elif price_diff_percent > 10:
                message = f"Listing price is {abs(price_diff_percent):.1f}% below predicted market value. This may be a good deal!"
            elif price_diff_percent < -10:
                message = f"Listing price is {abs(price_diff_percent):.1f}% above predicted market value. Consider negotiating."

        # Format response to match frontend expectations: { success: true, data: {...} }
        response_data = {
            "success": True,
            "data": {
                "make": car_features.make,
                "model": car_features.model,
                "year": car_features.year,
                "mileage": car_features.mileage,
                "condition": car_features.condition,
                "fuel_type": car_features.fuel_type,
                "location": car_features.location,
                "engine_size": car_features.engine_size,
                "cylinders": car_features.cylinders,
                "predicted_price": round(predicted_price, 2),
                "listing_price": listing_price,
                "price_range": {
                    "min": round(confidence_interval.lower, 2),
                    "max": round(confidence_interval.upper, 2),
                },
                "deal_explanation": message,
                "platform": extracted_data.get('platform', 'Unknown'),
                "currency": extracted_data.get('currency', 'USD'),
                "images": extracted_data.get('images', []),
            }
        }
        
        # Add price comparison if available
        if price_comparison:
            response_data["data"]["price_comparison"] = price_comparison
        
        return response_data

    except HTTPException:
        raise
    except ValueError as e:
        error_detail = f"Validation error: {str(e)}"
        logger.error(error_detail, exc_info=True)
        raise HTTPException(status_code=400, detail=error_detail)
    except Exception as e:
        error_detail = f"Error predicting from URL: {str(e)}"
        logger.error(error_detail, exc_info=True)
        # Include more details in error message
        import traceback
        tb_str = traceback.format_exc()
        logger.error(f"Full traceback: {tb_str}")
        raise HTTPException(status_code=500, detail=error_detail)
