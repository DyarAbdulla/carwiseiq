"""
Request models for API endpoints
"""

from pydantic import BaseModel, Field, validator
from typing import Optional, List

class VINDecodeRequest(BaseModel):
    """Request model for VIN decoding"""
    vin: str = Field(..., description="17-character Vehicle Identification Number", min_length=17, max_length=17)
    
    @validator('vin')
    def validate_vin(cls, v):
        v = v.strip().upper()
        if len(v) != 17:
            raise ValueError('VIN must be exactly 17 characters')
        return v

class SimilarCarsRequest(BaseModel):
    """Request model for similar cars search"""
    make: str = Field(..., description="Car make")
    model: str = Field(..., description="Car model")
    year: Optional[int] = Field(None, description="Car year", ge=1900, le=2025)
    limit: int = Field(10, description="Maximum number of results", ge=1, le=50)

class PriceAlertRequest(BaseModel):
    """Request model for price alert"""
    make: str = Field(..., description="Car make")
    model: str = Field(..., description="Car model")
    year: Optional[int] = Field(None, description="Car year", ge=1900, le=2025)
    target_price: float = Field(..., description="Target price to alert on", gt=0)
    alert_type: str = Field("below", description="Alert type: 'below' or 'above'", regex="^(below|above)$")
    email: Optional[str] = Field(None, description="Email for alerts")
