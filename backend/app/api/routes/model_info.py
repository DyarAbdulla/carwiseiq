"""
Model information endpoint — reads backend/models/model_info.json and pipeline status.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

BASE_DIR = Path(__file__).resolve().parent.parent.parent
MODELS_DIR = BASE_DIR / "models"


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
    """Return metrics and paths for the active price prediction pipeline."""
    try:
        from app.core import predict_price as pp

        pipeline, _meta = pp.load_model()

        info_path = MODELS_DIR / "model_info.json"
        metrics: Dict[str, Any] = {}
        features_count = 0
        version = "2"
        model_name = "xgb"

        if info_path.exists():
            with open(info_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            metrics = data.get("metrics", {})
            features_count = len(data.get("feature_columns", []))
            model_name = str(metrics.get("best_model", "xgb"))

        loaded = pipeline is not None
        return ModelInfoResponse(
            model_name=model_name if loaded else "none",
            version=version,
            features_count=features_count,
            metrics=metrics,
            model_path="models/price_prediction_pipeline.joblib",
            has_encoders=(MODELS_DIR / "column_transformer.joblib").exists(),
            has_price_range_models=False,
            status="loaded" if loaded else "fallback",
            message=(
                "Kurdistan price model (tuned XGBoost pipeline) is active"
                if loaded
                else "Pipeline not found; predictions use dataset statistics"
            ),
        )
    except Exception as e:
        logger.error("Error getting model info: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="Error getting model info") from e
