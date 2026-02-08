"""
Feedback API endpoints for prediction accuracy tracking
"""

from fastapi import APIRouter, HTTPException, Depends
from app.models.schemas import (
    FeedbackSubmissionRequest,
    FeedbackSubmissionResponse,
    PredictionHistoryResponse,
    FeedbackMetricsResponse
)
from app.services.feedback_service import (
    init_feedback_db,
    save_prediction,
    save_feedback,
    get_user_predictions,
    get_feedback_metrics
)
from app.api.routes.auth import get_current_user, UserResponse
from typing import Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/predictions", response_model=dict)
async def create_prediction(
    request: dict,
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """
    Save a prediction attempt (called automatically after prediction)
    Returns prediction_id for later feedback submission
    """
    try:
        # Extract fields from request dict (flexible format)
        car_features = request.get('car_features') or request.get('features') or {}
        predicted_price = request.get('predicted_price') or request.get('predictedPrice') or 0
        confidence_interval = request.get('confidence_interval') or request.get('confidenceInterval')
        confidence_level = request.get('confidence_level') or request.get('confidenceLevel')
        image_features = request.get('image_features') or request.get('imageFeatures')
        
        logger.info(f"Saving prediction: user_id={current_user.id if current_user else None}, price={predicted_price}")
        user_id = current_user.id if current_user else None
        
        # Handle Supabase users (user_id might be 0)
        if current_user and current_user.id == 0:
            # Supabase user - try to get UUID from token
            user_id = None  # Will be None for Supabase users
        
        # Validate required fields
        if not car_features or not isinstance(car_features, dict):
            raise HTTPException(status_code=400, detail="car_features must be a valid dictionary")
        if not isinstance(predicted_price, (int, float)) or predicted_price < 0:
            raise HTTPException(status_code=400, detail="predicted_price must be a positive number")
        
        prediction_id = save_prediction(
            car_features=car_features,
            predicted_price=float(predicted_price),
            user_id=user_id,
            confidence_interval=confidence_interval,
            confidence_level=confidence_level,
            image_features=image_features
        )
        logger.info(f"Prediction saved successfully: prediction_id={prediction_id}")
        return {"prediction_id": prediction_id, "success": True}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating prediction record: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to save prediction: {str(e)}")


@router.post("/submit", response_model=FeedbackSubmissionResponse)
async def submit_feedback(
    request: FeedbackSubmissionRequest,
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """
    Submit feedback for a prediction
    """
    try:
        logger.info(f"Submitting feedback: prediction_id={request.prediction_id}, rating={request.rating}, is_accurate={request.is_accurate}")
        user_id = current_user.id if current_user else None

        # Validate prediction_id exists
        if not request.prediction_id or request.prediction_id <= 0:
            raise HTTPException(status_code=400, detail="Invalid prediction_id")

        # Validate rating if provided
        if request.rating is not None and (request.rating < 1 or request.rating > 5):
            raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")

        feedback_id = save_feedback(
            prediction_id=request.prediction_id,
            rating=request.rating,
            is_accurate=request.is_accurate,
            feedback_type=request.feedback_type,
            feedback_reasons=request.feedback_reasons,
            correct_make=request.correct_make,
            correct_model=request.correct_model,
            correct_year=request.correct_year,
            correct_price=request.correct_price,
            other_details=request.other_details,
            user_id=user_id
        )

        logger.info(f"Feedback submitted successfully: feedback_id={feedback_id}")
        return FeedbackSubmissionResponse(
            feedback_id=feedback_id,
            success=True,
            message="Feedback submitted successfully"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error submitting feedback: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to submit feedback: {str(e)}")


@router.get("/history", response_model=PredictionHistoryResponse)
async def get_prediction_history(
    limit: int = 50,
    offset: int = 0,
    current_user: Optional[UserResponse] = Depends(get_current_user)
):
    """
    Get prediction history for the current user
    """
    try:
        user_id = current_user.id if current_user else None
        logger.info(f"Getting prediction history: user_id={user_id}, limit={limit}, offset={offset}")

        if not user_id:
            logger.info("No user_id, returning empty history")
            return PredictionHistoryResponse(
                predictions=[],
                total=0,
                message="Please log in to view prediction history"
            )

        predictions = get_user_predictions(
            user_id=user_id,
            limit=limit,
            offset=offset
        )

        logger.info(f"Retrieved {len(predictions)} predictions for user {user_id}")
        return PredictionHistoryResponse(
            predictions=predictions,
            total=len(predictions),
            message="Prediction history retrieved successfully"
        )
    except Exception as e:
        logger.error(f"Error getting prediction history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve prediction history: {str(e)}")


@router.get("/metrics", response_model=FeedbackMetricsResponse)
async def get_metrics():
    """
    Get overall feedback metrics for model improvement tracking
    """
    try:
        logger.info("Getting feedback metrics")
        metrics = get_feedback_metrics()
        logger.info(f"Metrics retrieved successfully: total_feedback={metrics.get('overall', {}).get('total_feedback', 0)}")
        return FeedbackMetricsResponse(**metrics)
    except Exception as e:
        logger.error(f"Error getting feedback metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to retrieve feedback metrics: {str(e)}")
