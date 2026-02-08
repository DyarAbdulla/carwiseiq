"""
Model information endpoint
Returns details about the loaded model
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class ModelInfoResponse(BaseModel):
    """Response model for model info"""
    model_name: str
    version: str
    features_count: int
    metrics: Dict[str, Any]
    model_path: str
    has_encoders: bool
    has_price_range_models: bool
    status: str
    message: str


@router.get("/model-info", response_model=ModelInfoResponse)
async def get_model_info():
    """
    Get information about the loaded model
    """
    try:
        # Try to load model info
        import sys
        import os

        # Add paths
        BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
        CORE_DIR = os.path.join(BASE_DIR, 'core')

        if CORE_DIR not in sys.path:
            sys.path.insert(0, CORE_DIR)

        try:
            from core.predict_price import load_model
            result = load_model()

            # Handle tuple return (old format)
            if isinstance(result, tuple) and len(result) >= 3:
                model, features, model_name = result[0], result[1], result[2]
                encoders = result[13] if len(result) > 13 else {}
                price_range_models = result[17] if len(result) > 17 else {}

                # Try to get model path from model data
                import pickle
                import os
                BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
                model_paths = [
                    'models/production_model.pkl',  # Production model (trained on IQCars)
                    'models/production_model_v2.pkl',  # Alternative production model name
                    'models/best_model_v4.pkl',  # Fallback: Latest model
                    'models/best_model_v3.pkl',  # Fallback: v3 model (83% accuracy)
                    'models/xgboost_model_v3.pkl',
                    'models/ensemble_model_v3.pkl',
                    'models/advanced_car_price_model.pkl',
                    'models/best_model_v2.pkl',
                    'models/car_price_model.pkl',
                    'models/best_model.pkl'
                ]
                model_path = 'Unknown'
                for mp in model_paths:
                    full_path = os.path.join(BASE_DIR, mp)
                    if os.path.exists(full_path):
                        model_path = mp
                        break

                # Get model version from path or result
                model_version = 'unknown'
                if 'v3' in model_path:
                    model_version = 'v3'
                elif 'v2' in model_path:
                    model_version = 'v2'
                elif len(result) > 20:
                    model_version = result[20] if result[20] else 'unknown'

                # Get metrics if available
                metrics = {}
                if len(result) > 21:
                    model_rmse = result[21]
                    if model_rmse:
                        metrics['rmse'] = model_rmse

                # Try to load full model data for metrics
                try:
                    import pickle
                    full_path = os.path.join(BASE_DIR, model_path)
                    if os.path.exists(full_path):
                        with open(full_path, 'rb') as f:
                            model_data = pickle.load(f)
                            if 'metrics' in model_data:
                                metrics = model_data['metrics']
                except:
                    pass

                info = {
                    'model_name': model_name,
                    'version': model_version,
                    'features_count': len(features) if features else 0,
                    'metrics': metrics,
                    'model_path': model_path,
                    'has_encoders': len(encoders) > 0 if encoders else False,
                    'has_price_range_models': len(price_range_models) > 0 if price_range_models else False,
                    'status': 'loaded',
                    'message': f'Model v{model_version} loaded successfully'
                }
            else:
                # New format (dict)
                model_info = result[1] if isinstance(result, tuple) else result
                info = {
                    'model_name': model_info.get('model_name', 'Unknown'),
                    'version': model_info.get('version', 'unknown'),
                    'features_count': len(model_info.get('features', [])),
                    'metrics': model_info.get('metrics', {}),
                    'model_path': model_info.get('model_path', 'Unknown'),
                    'has_encoders': len(model_info.get('encoders', {})) > 0,
                    'has_price_range_models': len(model_info.get('price_range_models', {})) > 0,
                    'status': 'loaded',
                    'message': 'Model loaded successfully'
                }

            return ModelInfoResponse(**info)

        except ImportError:
            # Fallback: try to get info from predictor
            from app.services.predictor import Predictor
            predictor = Predictor()

            return ModelInfoResponse(
                model_name='Unknown',
                version='unknown',
                features_count=0,
                metrics={},
                model_path='Unknown',
                has_encoders=False,
                has_price_range_models=False,
                status='loaded',
                message='Model loaded but info not available'
            )

    except Exception as e:
        logger.error(f"Error getting model info: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error getting model info: {str(e)}"
        )
