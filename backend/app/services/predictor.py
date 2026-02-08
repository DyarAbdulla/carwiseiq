"""
Predictor service - wraps model loading and prediction logic
"""

import logging
import sys
import os

logger = logging.getLogger(__name__)

# Import predict_price function
# Try multiple locations: core/predict_price.py, predict_price.py (root)
try:
    # Add parent directories to path
    CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
    BACKEND_DIR = os.path.dirname(os.path.dirname(CURRENT_DIR))
    ROOT_DIR = os.path.dirname(BACKEND_DIR)

    # Add to path
    for path in [ROOT_DIR, BACKEND_DIR]:
        if path not in sys.path:
            sys.path.insert(0, path)

    PREDICT_FUNCTION = None

    # Try backend/app/core/predict_price.py first (NEW - production model loader)
    try:
        from app.core.predict_price import predict_price
        PREDICT_FUNCTION = predict_price
        logger.info("✅ Loaded predict_price from app.core.predict_price (production model)")
    except ImportError as e_backend:
        logger.warning(f"Failed to import from app.core.predict_price: {e_backend}")
        # Try core/predict_price.py (fallback)
        try:
            # Add core directory to path
            CORE_DIR = os.path.join(ROOT_DIR, 'core')
            if CORE_DIR not in sys.path:
                sys.path.insert(0, CORE_DIR)

            # Import utils first (needed by predict_price)
            UTILS_DIR = ROOT_DIR
            if UTILS_DIR not in sys.path:
                sys.path.insert(0, UTILS_DIR)

            from core.predict_price import predict_price
            PREDICT_FUNCTION = predict_price
            logger.info("Loaded predict_price from core.predict_price (fallback)")
        except ImportError as e1:
            logger.warning(f"Failed to import from core.predict_price: {e1}")
        # Try root level predict_price.py
        try:
            import importlib.util
            predict_path = os.path.join(ROOT_DIR, 'predict_price.py')
            if os.path.exists(predict_path):
                spec = importlib.util.spec_from_file_location("predict_price", predict_path)
                predict_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(predict_module)
                PREDICT_FUNCTION = predict_module.predict_price
                logger.info("Loaded predict_price from root predict_price.py")
            else:
                # Try direct import
                from predict_price import predict_price
                PREDICT_FUNCTION = predict_price
                logger.info("Loaded predict_price via direct import")
        except Exception as e2:
            logger.error(f"Failed to load predict_price: {e2}")
            PREDICT_FUNCTION = None

except Exception as e:
    logger.error(f"Failed to import predict_price: {e}", exc_info=True)
    PREDICT_FUNCTION = None


class Predictor:
    """Predictor service for car price prediction"""

    def __init__(self):
        if PREDICT_FUNCTION is None:
            raise RuntimeError("Prediction function not available. Please ensure predict_price.py exists.")

    def predict(self, car_data: dict) -> float:
        """
        Predict car price from car data dictionary

        Args:
            car_data: Dictionary containing car features:
                - year: int
                - mileage: float
                - engine_size: float
                - cylinders: int
                - make: str
                - model: str
                - trim: str (optional)
                - condition: str
                - fuel_type: str
                - location: str

        Returns:
            Predicted price as float
        """
        try:
            if PREDICT_FUNCTION is None:
                logger.error("❌ PREDICT_FUNCTION is None - prediction function not loaded")
                raise RuntimeError("Prediction function not available. Please ensure predict_price.py exists.")

            # Log input features for debugging
            logger.info("=" * 80)
            logger.info("🔍 PREDICTOR SERVICE - INPUT FEATURES DEBUG")
            logger.info("=" * 80)
            logger.info(f"📋 Input car_data keys: {list(car_data.keys())}")
            for key, value in car_data.items():
                logger.info(f"   {key}: {value} (type: {type(value).__name__})")
            logger.info("=" * 80)
            
            # Call the prediction function
            # Check if function accepts return_confidence parameter
            import inspect
            sig = inspect.signature(PREDICT_FUNCTION)
            if 'return_confidence' in sig.parameters:
                predicted_price = PREDICT_FUNCTION(car_data, return_confidence=False)
            else:
                predicted_price = PREDICT_FUNCTION(car_data)
            
            logger.info("=" * 80)
            logger.info("🔍 PREDICTOR SERVICE - RAW MODEL OUTPUT")
            logger.info("=" * 80)
            logger.info(f"📊 Raw prediction result: {predicted_price}")
            logger.info(f"📊 Type: {type(predicted_price)}")
            logger.info(f"📊 Repr: {repr(predicted_price)}")

            # Handle numpy arrays and other types
            import numpy as np
            if isinstance(predicted_price, np.ndarray):
                logger.info(f"📊 Converting numpy array: shape={predicted_price.shape}, dtype={predicted_price.dtype}")
                logger.info(f"📊 Array values: {predicted_price}")
                predicted_price = predicted_price.item() if predicted_price.size == 1 else float(predicted_price[0])
                logger.info(f"📊 After conversion: {predicted_price} (type: {type(predicted_price)})")
            elif isinstance(predicted_price, (list, tuple)):
                logger.info(f"📊 Converting list/tuple: length={len(predicted_price)}, values={predicted_price}")
                predicted_price = predicted_price[0] if len(predicted_price) > 0 else 0.0
                logger.info(f"📊 After conversion: {predicted_price} (type: {type(predicted_price)})")

            final_price = float(predicted_price)
            logger.info(f"✅ Final prediction: ${final_price:,.2f}")
            logger.info("=" * 80)
            return final_price

        except Exception as e:
            logger.error(f"❌ Prediction error in Predictor.predict(): {e}", exc_info=True)
            import traceback
            logger.error(f"Full traceback:\n{traceback.format_exc()}")
            raise RuntimeError(f"Failed to predict price: {str(e)}")

