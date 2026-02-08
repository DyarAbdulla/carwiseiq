"""
Sell Car endpoint - predicts selling price with adjustments
Simplified version based on user requirements
"""

from fastapi import APIRouter, HTTPException
from app.models.schemas import SellCarRequest, SellCarResponse, SellAdjustment, RecommendedPrice, SellMarketComparison
from app.services.predictor import Predictor
from app.services.market_analyzer import MarketAnalyzer
from app.services.model_service import ModelService
from typing import Optional
import logging
import numpy as np

logger = logging.getLogger(__name__)

router = APIRouter()


def calculate_condition_adjustment(condition: str, base_price: float) -> tuple[float, str]:
    """Calculate price adjustment based on condition"""
    adjustments = {
        'Excellent': (0.05, "Excellent condition adds 5% value"),
        'Good': (0.0, "Good condition - standard market value"),
        'Fair': (-0.10, "Fair condition reduces value by 10%"),
        'Poor': (-0.25, "Poor condition reduces value by 25%"),
    }
    multiplier, reason = adjustments.get(condition, (0.0, "Standard condition"))
    return base_price * multiplier, reason


def calculate_accident_deduction(has_accident: bool, damaged_parts_count: int,
                                  severity: str, base_price: float) -> tuple[float, str]:
    """Calculate deduction from accident history"""
    if not has_accident:
        return 0.0, ""

    # Base deduction per severity
    severity_rates = {
        'minor': 0.05,
        'moderate': 0.12,
        'severe': 0.25,
    }
    base_rate = severity_rates.get(severity, 0.05)

    # Additional deduction per damaged part (1% per part, max 25% total from parts)
    parts_rate = min(damaged_parts_count * 0.01, 0.25)

    # Total deduction (capped at 40%)
    total_rate = min(base_rate + parts_rate, 0.40)
    deduction = base_price * total_rate

    reason = f"Accident ({severity}) with {damaged_parts_count} damaged parts"
    return deduction, reason


def calculate_mileage_adjustment(mileage: int, year: int, base_price: float) -> tuple[float, str]:
    """Calculate adjustment based on mileage for the car's age"""
    current_year = 2025
    age = current_year - year
    expected_mileage = age * 15000  # Average 15k km per year

    mileage_diff = mileage - expected_mileage

    if abs(mileage_diff) < 10000:
        return 0.0, ""  # Within normal range
    elif mileage_diff < 0:
        # Low mileage - add value (1% per 10k under)
        bonus = min(abs(mileage_diff) / 10000 * 0.01, 0.10) * base_price
        return bonus, f"Low mileage ({mileage:,} km) adds value"
    else:
        # High mileage - reduce value (2% per 10k over)
        penalty = min(mileage_diff / 10000 * 0.02, 0.20) * base_price
        return -penalty, f"High mileage ({mileage:,} km) reduces value"


def generate_recommendations(request: SellCarRequest, final_price: float) -> list[str]:
    """Generate selling recommendations"""
    recommendations = []

    # Condition recommendations
    if request.condition in ['Fair', 'Poor']:
        recommendations.append("Consider professional detailing to improve presentation")

    # Accident recommendations
    if request.has_accident:
        recommendations.append("Provide repair documentation to build buyer trust")
        if request.severity == 'severe':
            recommendations.append("Be prepared for buyer price negotiation due to accident history")

    # Mileage recommendations
    if request.mileage > 150000:
        recommendations.append("Highlight recent maintenance and service history")
    elif request.mileage < 50000:
        recommendations.append("Low mileage is a strong selling point - emphasize it")

    # Price recommendations
    if final_price > 30000:
        recommendations.append("Consider professional photos to attract serious buyers")

    if not recommendations:
        recommendations.append("Your car is well-positioned for sale at the estimated price")

    return recommendations


@router.post("/predict", response_model=SellCarResponse)
async def predict_sell_price(request: SellCarRequest):
    """
    Predict selling price for a car with detailed adjustments.

    Returns base price, final price, list of adjustments, and recommendations.
    """
    try:
        # Validate make/model combination exists in dataset
        from app.services.dataset_loader import DatasetLoader
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset

        if df is not None and len(df) > 0:
            make = request.make.strip()
            model = request.model.strip()

            # Check if make exists
            makes_in_dataset = df['make'].str.lower().unique()
            if make.lower() not in makes_in_dataset:
                raise HTTPException(
                    status_code=400,
                    detail=f"Make '{make}' not found. Please select a valid make from the list."
                )

            # Check if model exists for this make
            models_for_make = df[df['make'].str.lower() == make.lower()]['model'].str.lower().unique()
            if model.lower() not in models_for_make:
                raise HTTPException(
                    status_code=400,
                    detail=f"Model '{model}' not available for {make}. Please select a valid model."
                )

        # Prepare car_data for base prediction
        car_data = {
            'year': request.year,
            'mileage': float(request.mileage),
            'engine_size': 2.5,  # Default
            'cylinders': 4,      # Default
            'make': request.make,
            'model': request.model,
            'trim': request.trim or '',
            'condition': request.condition,
            'fuel_type': 'Gasoline',  # Default
            'location': request.location,
        }

        # Get base prediction (with or without images)
        model_service = ModelService()

        # Convert image features if provided
        image_features_array = None
        if hasattr(request, 'image_features') and request.image_features:
            try:
                image_features_array = np.array(request.image_features)
                # Validate shape (must be exactly 2048 for ResNet50)
                if len(image_features_array.shape) == 1:
                    if image_features_array.shape[0] != 2048:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Invalid image_features length: expected 2048, got {image_features_array.shape[0]}"
                        )
                    # Valid - 2048 features
                    logger.info(f"Received image_features with length {len(image_features_array)}")
                else:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid image_features shape: expected 1D array (2048,), got {image_features_array.shape}"
                    )
            except HTTPException:
                raise
            except Exception as e:
                logger.error(f"Error processing image features: {e}", exc_info=True)
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid image_features format: {str(e)}"
                )

        # Use ModelService for prediction (supports multimodal if available)
        if image_features_array is not None and model_service.is_multimodal_available:
            base_price = model_service.predict(car_data, image_features_array)
        else:
            # Use tabular-only prediction
            predictor = Predictor()
            base_price = predictor.predict(car_data)

        # Validate base prediction
        if base_price < 0:
            logger.warning(f"Negative base prediction: {base_price}, using absolute value")
            base_price = abs(base_price)
        base_price = max(base_price, 500.0)  # Minimum $500

        # Calculate adjustments
        adjustments = []
        running_total = base_price

        # 1. Condition adjustment
        cond_adj, cond_reason = calculate_condition_adjustment(request.condition, base_price)
        if cond_adj != 0:
            adjustments.append(SellAdjustment(
                name="Condition",
                amount=round(cond_adj, 2),
                reason=cond_reason
            ))
            running_total += cond_adj

        # 2. Mileage adjustment
        mile_adj, mile_reason = calculate_mileage_adjustment(request.mileage, request.year, base_price)
        if mile_adj != 0:
            adjustments.append(SellAdjustment(
                name="Mileage",
                amount=round(mile_adj, 2),
                reason=mile_reason
            ))
            running_total += mile_adj

        # 3. Accident deduction
        if request.has_accident:
            acc_ded, acc_reason = calculate_accident_deduction(
                request.has_accident,
                request.damaged_parts_count,
                request.severity or 'minor',
                base_price
            )
            if acc_ded > 0:
                adjustments.append(SellAdjustment(
                    name="Accident History",
                    amount=round(-acc_ded, 2),  # Negative because it's a deduction
                    reason=acc_reason
                ))
                running_total -= acc_ded

        # Ensure final price is reasonable
        final_price = max(running_total, 100.0)

        # Generate recommendations
        recommendations = generate_recommendations(request, final_price)

        # Generate recommended listing prices
        recommended_prices = [
            RecommendedPrice(
                label="Quick Sale",
                price=round(final_price * 0.90, 2),
                percentage=90.0,
                description="Price competitively for faster sale (10% below market)"
            ),
            RecommendedPrice(
                label="Market Price",
                price=round(final_price, 2),
                percentage=100.0,
                description="Fair market value - balanced pricing"
            ),
            RecommendedPrice(
                label="Max Profit",
                price=round(final_price * 1.10, 2),
                percentage=110.0,
                description="Higher price for maximum profit (may take longer to sell)"
            ),
        ]

        # Calculate market comparison
        market_comparison = None
        try:
            market_analyzer = MarketAnalyzer()
            market_data = market_analyzer.get_market_comparison(final_price, car_data)

            # Determine badge based on percentage difference
            percentage_diff = market_data.get('percentage_difference', 0)
            if percentage_diff > 10:
                badge = 'Above Average'
            elif percentage_diff < -10:
                badge = 'Below Market'
            else:
                badge = 'Fair Price'

            market_comparison = SellMarketComparison(
                market_average=market_data.get('market_average', final_price),
                your_price=final_price,
                difference=market_data.get('difference', 0),
                percentage_difference=percentage_diff,
                badge=badge
            )
        except Exception as e:
            logger.warning(f"Failed to calculate market comparison: {e}")
            # Continue without market comparison

        return SellCarResponse(
            base_price=round(base_price, 2),
            final_price=round(final_price, 2),
            adjustments=adjustments,
            recommendations=recommendations,
            recommended_prices=recommended_prices,
            market_comparison=market_comparison
        )

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Sell prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error calculating price: {str(e)}")
