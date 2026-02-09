"""
Car data models
"""

from typing import Optional, List
from pydantic import BaseModel, Field, validator


class CarData(BaseModel):
    """Car data extracted from listings"""
    make: str = Field(..., description="Car manufacturer/brand")
    model: str = Field(..., description="Car model")
    year: int = Field(..., ge=1900, le=2025, description="Manufacturing year")
    mileage: float = Field(..., ge=0, description="Mileage in kilometers")
    price: Optional[float] = Field(None, ge=0, description="Listing price")
    condition: str = Field(..., description="Condition: New, Like New, Excellent, Good, Fair, Poor, Salvage")
    fuel_type: str = Field(..., description="Fuel type: Gasoline, Diesel, Electric, Hybrid, Plug-in Hybrid, Other")
    location: Optional[str] = Field(None, description="Location")
    images: List[str] = Field(default_factory=list, description="List of image URLs")
    platform: str = Field(..., description="Platform name (e.g., 'Cars.com', 'Dubizzle')")
    currency: str = Field(default='USD', description="Currency code (USD, AED, EUR, etc.)")
    engine_size: Optional[float] = Field(None, ge=0.5, le=10.0, description="Engine size in liters")
    cylinders: Optional[int] = Field(None, ge=2, le=12, description="Number of cylinders")
    transmission: Optional[str] = Field(None, description="Transmission type")
    color: Optional[str] = Field(None, description="Car color")
    vin: Optional[str] = Field(None, description="Vehicle Identification Number")
    
    @validator('condition')
    def validate_condition(cls, v):
        valid_conditions = ['New', 'Like New', 'Excellent', 'Good', 'Fair', 'Poor', 'Salvage']
        if v not in valid_conditions:
            # Try to normalize
            v_lower = v.lower().strip()
            if 'new' in v_lower and 'like' not in v_lower:
                return 'New'
            elif 'like new' in v_lower:
                return 'Like New'
            elif 'excellent' in v_lower:
                return 'Excellent'
            elif 'good' in v_lower:
                return 'Good'
            elif 'fair' in v_lower:
                return 'Fair'
            elif 'poor' in v_lower:
                return 'Poor'
            elif 'salvage' in v_lower:
                return 'Salvage'
            return 'Good'  # Default
        return v
    
    @validator('fuel_type')
    def validate_fuel_type(cls, v):
        valid_fuels = ['Gasoline', 'Diesel', 'Electric', 'Hybrid', 'Plug-in Hybrid', 'Other']
        if v not in valid_fuels:
            # Try to normalize
            v_lower = v.lower().strip()
            if 'plug-in hybrid' in v_lower or 'phev' in v_lower:
                return 'Plug-in Hybrid'
            elif 'hybrid' in v_lower:
                return 'Hybrid'
            elif 'electric' in v_lower or 'ev' in v_lower:
                return 'Electric'
            elif 'diesel' in v_lower:
                return 'Diesel'
            elif 'gasoline' in v_lower or 'gas' in v_lower or 'petrol' in v_lower:
                return 'Gasoline'
            return 'Gasoline'  # Default
        return v


class Car(BaseModel):
    """Extended car model with prediction data"""
    data: CarData
    predicted_price: Optional[float] = None
    confidence: Optional[float] = None
    price_range: Optional[dict] = None
    deal_quality: Optional[str] = None
