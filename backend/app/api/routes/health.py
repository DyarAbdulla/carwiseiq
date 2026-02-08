"""
Health check endpoint
"""

from fastapi import APIRouter
from app.models.schemas import HealthResponse
# ModelLoader removed - using Predictor service instead
from app.services.dataset_loader import DatasetLoader
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/health")
async def health_check_simple():
    """
    Simple health check endpoint
    Returns { ok: true } for basic connectivity check
    """
    return {"ok": True}


@router.get("/health/detailed", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    Returns API status, model loading status, and dataset status
    """
    try:
        # Check if Predictor can be instantiated (model loaded)
        model_loaded = False
        model_info = {}
        try:
            from app.services.predictor import Predictor
            predictor = Predictor()
            model_loaded = True

            # Try to get model info
            try:
                import sys
                import os
                BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
                CORE_DIR = os.path.join(BASE_DIR, 'core')
                if CORE_DIR not in sys.path:
                    sys.path.insert(0, CORE_DIR)
                from core.predict_price import load_model
                result = load_model()
                # Handle tuple return (now includes version and RMSE)
                if isinstance(result, tuple) and len(result) >= 3:
                    model_name = result[2]
                    features = result[1]
                    model_version = result[20] if len(result) > 20 else 'unknown'
                    model_rmse = result[21] if len(result) > 21 else None

                    model_info = {
                        'model_name': model_name,
                        'version': model_version,
                        'features_count': len(features) if features else 0,
                        'rmse': model_rmse
                    }
                else:
                    model_info = {
                        'model_name': 'Unknown',
                        'version': 'unknown',
                        'features_count': 0
                    }
            except Exception as e:
                logger.debug(f"Could not get detailed model info: {e}")

        except Exception as e:
            logger.error(f"Model loading failed: {e}", exc_info=True)
            model_loaded = False

        dataset_loader = DatasetLoader.get_instance()
        dataset_loaded = dataset_loader.is_loaded
        dataset_count = 0
        if dataset_loader.dataset is not None:
            dataset_count = len(dataset_loader.dataset)

        message_parts = ["API is running"]
        if model_loaded:
            version_info = f"v{model_info.get('version', 'unknown')}" if model_info.get('version') != 'unknown' else ""
            model_name_info = model_info.get('model_name', 'model')
            message_parts.append(f"{model_name_info} {version_info} is loaded".strip())
            if model_info.get('rmse'):
                message_parts.append(f"RMSE: ${model_info['rmse']:,.2f}")
        if dataset_loaded and dataset_count > 0:
            message_parts.append(f"dataset loaded ({dataset_count:,} rows)")
        elif dataset_loaded:
            message_parts.append("dataset file found but empty")
        else:
            message_parts.append("dataset not loaded")

        return HealthResponse(
            status="healthy" if model_loaded else "degraded",
            message=", ".join(message_parts),
            model_loaded=model_loaded,
            model_name=model_info.get('model_name', 'Unknown'),
            model_version=model_info.get('version', 'unknown'),
            model_features_count=model_info.get('features_count', 0),
            model_metrics={'rmse': model_info.get('rmse')} if model_info.get('rmse') else {},
            dataset_loaded=dataset_loaded,
            dataset_count=dataset_count
        )
    except Exception as e:
        return HealthResponse(
            status="unhealthy",
            message=f"Error: {str(e)}",
            model_loaded=False,
            dataset_loaded=False,
            dataset_count=0
        )



