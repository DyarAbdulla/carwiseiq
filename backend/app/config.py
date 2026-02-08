"""
Configuration file for Backend API
Contains all constants, file paths, and configuration settings.
All secrets MUST be loaded from .env - never hardcoded.
"""

import os
from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional, List


class Settings(BaseSettings):
    """Application settings using pydantic-settings"""

    # Environment: development | production
    ENV: str = "development"

    # API Configuration
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DEBUG: bool = True

    # JWT Configuration - SECRET_KEY must be at least 256-bit (32 chars) in production
    JWT_SECRET_KEY: Optional[str] = None
    SECRET_KEY: Optional[str] = None  # Alias for JWT_SECRET_KEY
    # Token expiry: short access, longer refresh with rotation
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    # JWT issuer and audience for claim validation
    JWT_ISSUER: str = "carwiseiq-api"
    JWT_AUDIENCE: str = "carwiseiq-app"

    # CORS - in production only allow carwiseiq.com
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3002"
    # Set in production: https://carwiseiq.com,https://www.carwiseiq.com

    # Supabase Configuration (for JWT verification)
    SUPABASE_URL: Optional[str] = None
    SUPABASE_JWT_SECRET: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None  # For fetching listings via REST API

    # Anthropic Claude (optional; used only by 01_label_images --mode=claude_sample)
    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: Optional[str] = None

    # Local car classifier (detect-car-vision). If unset, uses {ROOT}/models/car_classifier.keras
    CAR_CLASSIFIER_MODEL: Optional[str] = None
    CAR_CLASSIFIER_LABEL_MAPS: Optional[str] = None

    # Paths - relative to backend directory
    BASE_DIR: Path = Path(__file__).parent.parent
    ROOT_DIR: Path = Path(__file__).parent.parent.parent

    # Dataset image paths - external folders containing car images
    DATASET_PATHS: list[str] = [
        r"C:\Car price prection program Local E\car_images",
        r"C:\Car price prection program Local E\images"
    ]

    @property
    def DATA_FILE(self) -> Path:
        """Path to the dataset file"""
        # Priority: iqcars_cleaned.csv (production dataset), then final_dataset_with_images.csv, then cleaned_car_data.csv
        paths = [
            # Try iqcars_cleaned.csv first (production dataset with locations and fuel_types)
            self.ROOT_DIR / "data" / "iqcars_cleaned.csv",
            self.BASE_DIR / "data" / "iqcars_cleaned.csv",
            Path("data/iqcars_cleaned.csv"),
            # Try final_dataset_with_images.csv (has image URLs)
            self.ROOT_DIR / "data" / "final_dataset_with_images.csv",
            self.BASE_DIR / "data" / "final_dataset_with_images.csv",
            Path("data/final_dataset_with_images.csv"),
            # Fallback to cleaned_car_data.csv
            self.ROOT_DIR / "data" / "cleaned_car_data.csv",
            self.BASE_DIR / "data" / "cleaned_car_data.csv",
            Path("data/cleaned_car_data.csv"),
        ]
        for p in paths:
            if p.exists():
                return p
        return paths[8]  # Default to cleaned_car_data.csv

    @property
    def MODEL_DIR(self) -> Path:
        """Path to models directory"""
        paths = [
            self.ROOT_DIR / "models",
            self.BASE_DIR / "models",
        ]
        for p in paths:
            if p.exists():
                return p
        return paths[0]  # Default

    # Data validation
    MIN_YEAR: int = 1900
    MAX_YEAR: int = 2025
    MIN_MILEAGE: int = 0
    MAX_MILEAGE: int = 1000000
    MIN_ENGINE_SIZE: float = 0.5
    MAX_ENGINE_SIZE: float = 10.0
    MIN_CYLINDERS: int = 2
    MAX_CYLINDERS: int = 12

    # Prediction confidence
    CONFIDENCE_LEVEL: float = 0.95
    CONFIDENCE_Z_SCORE: float = 1.96

    @property
    def is_production(self) -> bool:
        return self.ENV.lower() == "production"

    def get_cors_origins_list(self) -> List[str]:
        """Return CORS origins as list; in production omit localhost if not in CORS_ORIGINS."""
        if not self.CORS_ORIGINS:
            return []
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"
        case_sensitive = True


# Create singleton settings instance
settings = Settings()


def check_required_env_production() -> None:
    """
    Fail startup if critical env vars are missing in production.
    Call this from main.py startup_event when ENV=production.
    """
    if not settings.is_production:
        return
    missing = []
    secret = settings.SECRET_KEY or settings.JWT_SECRET_KEY
    if not secret or len(secret) < 32:
        missing.append("SECRET_KEY (min 32 chars)")
    if not settings.SUPABASE_URL and not os.getenv("SUPABASE_URL"):
        # Supabase optional if using only REST auth
        pass
    if missing:
        raise RuntimeError(
            f"Production startup aborted: missing or invalid env: {', '.join(missing)}. "
            "Set these in .env or environment."
        )

# ============================================================================
# Feature Configuration (kept for compatibility)
# ============================================================================
CURRENT_YEAR = 2025

# Categorical encoding maps
CONDITION_MAP = {
    'New': 0, 'Like New': 1, 'Excellent': 2, 'Good': 3,
    'Fair': 4, 'Poor': 5, 'Salvage': 6
}

FUEL_TYPE_MAP = {
    'Gasoline': 0, 'Diesel': 1, 'Electric': 2, 'Hybrid': 3,
    'Plug-in Hybrid': 4, 'Other': 5
}

# Debug configuration
DEBUG_PREDICTIONS = False

# Model files (for compatibility with core/predict_price.py)
# Get ROOT_DIR from settings instance
_settings_instance = Settings()
ROOT_DIR = _settings_instance.ROOT_DIR
MODEL_DIR = ROOT_DIR / "models"
MODEL_FILE = MODEL_DIR / "best_model_v2.pkl"
MAKE_ENCODER_FILE = MODEL_DIR / "make_encoder.pkl"
MODEL_ENCODER_FILE = MODEL_DIR / "model_encoder.pkl"

# Data files (for compatibility)
DATA_DIR = ROOT_DIR / "data"
CLEANED_DATA_FILE = DATA_DIR / "cleaned_car_data.csv"

