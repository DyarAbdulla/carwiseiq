"""
Pydantic schemas for API request/response models.
"""
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field


# --- Health ---
class HealthResponse(BaseModel):
    status: str
    message: str
    model_loaded: bool = False
    model_name: str = "Unknown"
    model_version: str = "unknown"
    model_features_count: int = 0
    model_metrics: Dict[str, Any] = {}
    dataset_loaded: bool = False
    dataset_count: int = 0


# --- Car features (input) ---
class CarFeatures(BaseModel):
    year: int
    mileage: Optional[float] = Field(None, ge=0)  # Optional; >= 0 when provided; backend uses 50000 when missing
    engine_size: float
    cylinders: int
    make: str
    model: str
    condition: str = "Good"
    fuel_type: str = "Gasoline"
    location: str = "Unknown"


# --- Prediction request/response ---
class PredictionRequest(BaseModel):
    features: CarFeatures
    image_features: Optional[List[float]] = None


class ConfidenceInterval(BaseModel):
    lower: float
    upper: float


class MarketComparison(BaseModel):
    your_car: float
    market_average: float
    difference: float
    percentage_difference: float


class DealScore(BaseModel):
    score: str
    badge: str
    percentage: float
    label: str


class PriceFactor(BaseModel):
    factor: str
    impact: float
    direction: str
    description: str


class MarketDemand(BaseModel):
    level: str
    badge: str
    description: Optional[str] = None


class SimilarCar(BaseModel):
    year: int
    mileage: int
    condition: str
    price: float
    make: str
    model: str
    link: Optional[str] = None
    image_id: Optional[str] = None
    image_url: Optional[str] = None


class MarketTrend(BaseModel):
    month: str
    average_price: float
    date: str


class PredictionResponse(BaseModel):
    predicted_price: float
    message: Optional[str] = None
    confidence_interval: Optional[ConfidenceInterval] = None
    confidence_range: Optional[float] = None
    precision: Optional[float] = None
    confidence_level: Optional[str] = None
    market_comparison: Optional[MarketComparison] = None
    deal_analysis: Optional[str] = None
    deal_score: Optional[DealScore] = None
    price_factors: Optional[List[PriceFactor]] = None
    market_demand: Optional[MarketDemand] = None
    similar_cars: Optional[List[SimilarCar]] = None
    market_trends: Optional[List[MarketTrend]] = None
    car_image_path: Optional[str] = None
    preview_image: Optional[str] = None
    image_match_type: Optional[str] = None
    image_match_info: Optional[str] = None


# --- Feedback ---
class FeedbackSubmissionRequest(BaseModel):
    prediction_id: int
    rating: Optional[int] = None
    is_accurate: Optional[bool] = None
    feedback_type: Optional[str] = None
    feedback_reasons: Optional[List[str]] = None
    correct_make: Optional[str] = None
    correct_model: Optional[str] = None
    correct_year: Optional[int] = None
    correct_price: Optional[float] = None
    other_details: Optional[str] = None


class FeedbackSubmissionResponse(BaseModel):
    feedback_id: int
    success: bool
    message: str


class PredictionHistoryResponse(BaseModel):
    predictions: List[Any]
    total: int
    message: str


class FeedbackMetricsResponse(BaseModel):
    overall: Optional[Dict[str, Any]] = None
    by_make: Optional[List[Dict[str, Any]]] = None
    trend: Optional[List[Dict[str, Any]]] = None
    improvement: Optional[Dict[str, Any]] = None
