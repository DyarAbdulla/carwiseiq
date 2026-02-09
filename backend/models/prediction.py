"""
Prediction response models
"""

from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from .car import CarData


class PriceRange(BaseModel):
    """Price range for predictions"""
    min: float = Field(..., description="Minimum predicted price")
    max: float = Field(..., description="Maximum predicted price")


class PredictionResponse(BaseModel):
    """Response from prediction endpoint"""
    success: bool = Field(..., description="Whether the prediction was successful")
    data: Optional[Dict[str, Any]] = Field(None, description="Prediction data")
    error: Optional[str] = Field(None, description="Error message if failed")
    
    class Config:
        schema_extra = {
            "example": {
                "success": True,
                "data": {
                    "make": "Toyota",
                    "model": "Camry",
                    "year": 2020,
                    "mileage": 30000,
                    "condition": "Excellent",
                    "fuel_type": "Hybrid",
                    "location": "Dubai",
                    "listing_price": 75000,
                    "predicted_price": 72000,
                    "price_range": {"min": 68000, "max": 76000},
                    "confidence": 85,
                    "deal_quality": "Fair",
                    "deal_explanation": "Price is 4% above predicted value",
                    "market_position": "Above Average",
                    "images": [],
                    "platform": "Dubizzle",
                    "currency": "AED"
                }
            }
        }


class BatchPredictionResponse(BaseModel):
    """Response from batch prediction endpoint"""
    results: List[PredictionResponse] = Field(default_factory=list)
    summary: Dict[str, Any] = Field(default_factory=dict)
