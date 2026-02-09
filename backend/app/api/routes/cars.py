"""
Car data endpoints - provides makes, models, and locations from dataset
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.services.dataset_loader import DatasetLoader
import logging
import pandas as pd
import os
from pathlib import Path

logger = logging.getLogger(__name__)

router = APIRouter()

# Cache for image metadata
_image_metadata_cache = None


def load_image_metadata():
    """Load image metadata CSV into memory"""
    global _image_metadata_cache
    if _image_metadata_cache is not None:
        return _image_metadata_cache

    metadata_path = Path('image_metadata.csv')
    if not metadata_path.exists():
        logger.warning("image_metadata.csv not found")
        return None

    try:
        _image_metadata_cache = pd.read_csv(metadata_path)
        logger.info(
            f"Loaded {len(_image_metadata_cache)} image metadata entries")
        return _image_metadata_cache
    except Exception as e:
        logger.error(f"Error loading image metadata: {e}")
        return None


@router.get("/makes", response_model=List[str])
async def get_makes():
    """
    Get list of all unique car makes from the dataset

    Returns sorted list of make names
    """
    try:
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset

        if df is None or len(df) == 0:
            logger.warning("Dataset not available for makes")
            return []

        # Get unique makes, sorted
        makes = df['make'].dropna().unique().tolist()
        makes = [str(m).strip() for m in makes if str(m).strip()]
        makes = sorted(list(set(makes)))

        return makes
    except Exception as e:
        logger.error(f"Error getting makes: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error retrieving makes: {str(e)}")


@router.get("/models/{make}", response_model=List[str])
async def get_models(make: str):
    """
    Get list of models for a specific make

    Args:
        make: Car make/brand name

    Returns sorted list of model names for the given make
    """
    try:
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset

        if df is None or len(df) == 0:
            logger.warning("Dataset not available for models")
            return []

        # Filter by make (case-insensitive)
        filtered = df[df['make'].str.lower() == make.lower()]

        if len(filtered) == 0:
            return []

        # Get unique models, sorted
        models = filtered['model'].dropna().unique().tolist()
        models = [str(m).strip() for m in models if str(m).strip()]
        models = sorted(list(set(models)))

        return models
    except Exception as e:
        logger.error(f"Error getting models for {make}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error retrieving models: {str(e)}")


@router.get("/locations", response_model=List[str])
async def get_locations():
    """
    Get list of all unique locations from the dataset (e.g. cleaned_car_data.csv).
    Reads the 'location' (or 'city', 'region') column and returns sorted unique values.
    """
    try:
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset

        if df is None or len(df) == 0:
            logger.warning("Dataset not available for locations")
            return []

        # Log columns to see what's available
        print("Dataset columns:", df.columns.tolist())

        # Check for location column
        location_col = None
        for col in ['location', 'Location', 'city', 'City', 'region', 'Region']:
            if col in df.columns:
                location_col = col
                break

        if location_col is None:
            logger.warning("Location column not found in dataset")
            return []

        locations = df[location_col].dropna().unique().tolist()
        locations = sorted([str(loc).strip() for loc in locations if loc and str(loc).strip()])
        locations = [loc for loc in locations if loc.lower() not in ['nan', 'none', 'null', 'n/a', '', 'unknown']]
        locations = sorted(list(set(locations)))

        logger.info(f"Returning {len(locations)} locations")
        return locations
    except Exception as e:
        logger.error(f"Error getting locations: {e}", exc_info=True)
        return []


@router.get("/trims/{make}/{model}", response_model=List[str])
async def get_trims(make: str, model: str):
    """
    Get list of trims for a specific make and model

    Args:
        make: Car make/brand name
        model: Car model name

    Returns sorted list of trim names for the given make/model combination
    """
    try:
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset

        if df is None or len(df) == 0:
            logger.warning("Dataset not available for trims")
            return []

        # Check for trim column
        trim_col = None
        for col in ['trim', 'Trim', 'variant', 'Variant', 'version', 'Version']:
            if col in df.columns:
                trim_col = col
                break

        if trim_col is None:
            return []

        # Filter by make and model (case-insensitive)
        filtered = df[
            (df['make'].str.lower() == make.lower()) &
            (df['model'].str.lower() == model.lower())
        ]

        if len(filtered) == 0:
            return []

        trims = filtered[trim_col].dropna().unique().tolist()
        trims = sorted([str(t).strip() for t in trims if t and str(t).strip()])
        trims = [t for t in trims if t.lower() not in ['nan', 'none', 'null', 'n/a', 'na', '', 'undefined']]
        trims = sorted(list(set(trims)))

        return trims
    except Exception as e:
        logger.error(
            f"Error getting trims for {make}/{model}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error retrieving trims: {str(e)}")


@router.get("/fuel-types/{make}/{model}", response_model=List[str])
async def get_fuel_types(make: str, model: str):
    """
    Get list of fuel types available for a specific make and model combination

    Args:
        make: Car make/brand name
        model: Car model name

    Returns sorted list of fuel type names for the given make/model combination
    """
    try:
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset

        valid_fuel_types = ['Gasoline', 'Diesel',
                            'Electric', 'Hybrid', 'Plug-in Hybrid', 'Other']

        # Infer fuel type from model name patterns (case-insensitive)
        model_lower = model.lower()
        inferred_fuel_types = set()

        # Plug-in Hybrid patterns
        if any(pattern in model_lower for pattern in ['dm-i', 'dm-i', 'phev', 'plug-in', 'plug in', 'phev', 'e-hybrid']):
            inferred_fuel_types.add('Plug-in Hybrid')

        # Hybrid patterns (but not plug-in)
        if any(pattern in model_lower for pattern in ['hybrid', 'hev']) and 'plug-in' not in model_lower and 'phev' not in model_lower and 'dm-i' not in model_lower:
            inferred_fuel_types.add('Hybrid')

        # Electric patterns
        if any(pattern in model_lower for pattern in ['ev', 'electric', 'e-', 'bev', 'zev']):
            inferred_fuel_types.add('Electric')

        # Diesel patterns
        if any(pattern in model_lower for pattern in ['diesel', 'tdi', 'tdci', 'cdi']):
            inferred_fuel_types.add('Diesel')

        if df is None or len(df) == 0:
            logger.warning("Dataset not available for fuel types")
            # Return inferred types if available, otherwise all valid types
            if inferred_fuel_types:
                return sorted(list(inferred_fuel_types))
            return valid_fuel_types

        # Filter by make and model (case-insensitive)
        filtered = df[
            (df['make'].str.lower() == make.lower()) &
            (df['model'].str.lower() == model.lower())
        ]

        fuel_types = set()

        # Get fuel types from dataset
        if len(filtered) > 0 and 'fuel_type' in filtered.columns:
            dataset_fuel_types = filtered['fuel_type'].dropna(
            ).unique().tolist()
            dataset_fuel_types = [str(f).strip()
                                  for f in dataset_fuel_types if str(f).strip()]
            # Normalize and map fuel types
            fuel_type_map = {
                'Gasoline': 'Gasoline',
                'Diesel': 'Diesel',
                'Electric': 'Electric',
                'EV': 'Electric',
                'Hybrid': 'Hybrid',
                'Plug-in Hybrid': 'Plug-in Hybrid',
                'Plug-In Hybrid': 'Plug-in Hybrid',
                'PHEV': 'Plug-in Hybrid',
                'LPG': 'Other',
                'Other': 'Other'
            }
            # Filter to only include valid fuel types (normalize first)
            for fuel in dataset_fuel_types:
                # Normalize fuel type
                normalized = fuel_type_map.get(fuel, fuel)
                if normalized in valid_fuel_types:
                    fuel_types.add(normalized)
                elif fuel.lower() in ['gasoline', 'petrol', 'gas']:
                    fuel_types.add('Gasoline')
                elif fuel.lower() in ['diesel']:
                    fuel_types.add('Diesel')
                elif fuel.lower() in ['electric', 'ev', 'bev', 'zev']:
                    fuel_types.add('Electric')
                elif fuel.lower() in ['hybrid', 'hev']:
                    fuel_types.add('Hybrid')
                elif fuel.lower() in ['plug-in hybrid', 'phev', 'plug in hybrid']:
                    fuel_types.add('Plug-in Hybrid')

        # If no fuel types found in dataset, use inferred types
        if not fuel_types:
            fuel_types = inferred_fuel_types

        # If still no fuel types, add inferred types to dataset types (union)
        if inferred_fuel_types:
            fuel_types = fuel_types.union(inferred_fuel_types)

        # If no fuel types at all, return all valid types as fallback
        if not fuel_types:
            fuel_types = set(valid_fuel_types)

        return sorted(list(fuel_types))
    except Exception as e:
        logger.error(
            f"Error getting fuel types for {make}/{model}: {e}", exc_info=True)
        # Try to infer from model name even on error
        model_lower = model.lower()
        inferred = set()
        if any(p in model_lower for p in ['dm-i', 'phev', 'plug-in', 'plug in']):
            inferred.add('Plug-in Hybrid')
        if any(p in model_lower for p in ['hybrid', 'hev']) and 'plug-in' not in model_lower:
            inferred.add('Hybrid')
        if any(p in model_lower for p in ['ev', 'electric', 'bev']):
            inferred.add('Electric')
        if inferred:
            return sorted(list(inferred))
        return valid_fuel_types


@router.get("/engine-sizes", response_model=List[float])
async def get_engine_sizes():
    """
    Get list of all unique engine sizes from the dataset

    Returns sorted list of engine sizes in liters.
    This endpoint returns all engine sizes regardless of make/model.
    """
    try:
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset

        if df is None or len(df) == 0:
            logger.warning("Dataset not available for engine sizes")
            # Return common engine sizes as fallback
            return [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0]

        # Get unique engine sizes from entire dataset
        if 'engine_size' not in df.columns:
            logger.warning("Engine size column not found in dataset")
            return [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0]

        engine_sizes = df['engine_size'].dropna().unique().tolist()

        # Convert to float and filter valid values
        valid_sizes = []
        for size in engine_sizes:
            try:
                size_float = float(size)
                # Validate range (0.5 to 10.0 liters)
                if 0.5 <= size_float <= 10.0:
                    valid_sizes.append(size_float)
            except (ValueError, TypeError):
                continue

        # Remove duplicates and sort
        engine_sizes = sorted(list(set(valid_sizes)))

        # Ensure common engine sizes are included even if not in dataset
        common_sizes = [1.0, 1.2, 1.4, 1.5, 1.6,
                        1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0]
        for common_size in common_sizes:
            if common_size not in engine_sizes:
                engine_sizes.append(common_size)

        # Sort again after adding common sizes
        engine_sizes = sorted(engine_sizes)

        return engine_sizes
    except Exception as e:
        logger.error(f"Error getting engine sizes: {e}", exc_info=True)
        # Return common engine sizes on error
        return [1.0, 1.2, 1.4, 1.5, 1.6, 1.8, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0, 6.0]


@router.get("/metadata")
async def get_metadata():
    """
    Get dataset metadata including conditions, fuel types, and ranges

    Returns metadata object with:
    - conditions: List of unique condition values
    - fuel_types: List of unique fuel type values
    - year_range: {min, max} year values
    - mileage_range: {min, max} mileage values
    """
    try:
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset

        if df is None or len(df) == 0:
            logger.warning("Dataset not available for metadata")
            return {
                "conditions": [],
                "fuel_types": [],
                "year_range": {"min": 2000, "max": 2025},
                "mileage_range": {"min": 0, "max": 500000}
            }

        # Get unique conditions from dataset, but also include all valid conditions
        # This ensures the form shows all possible conditions even if dataset only has some
        valid_conditions = ['New', 'Like New',
                            'Excellent', 'Good', 'Fair', 'Poor', 'Salvage']
        conditions = []
        if 'condition' in df.columns:
            dataset_conditions = df['condition'].dropna().unique().tolist()
            dataset_conditions = [str(c).strip()
                                  for c in dataset_conditions if str(c).strip()]
            # Merge dataset conditions with valid conditions, preserving order
            all_conditions = set(valid_conditions)
            for cond in dataset_conditions:
                # Normalize condition names (handle "Used" as "Good", etc.)
                normalized = cond
                if cond.lower() == 'used':
                    normalized = 'Good'
                if normalized in all_conditions:
                    conditions.append(normalized)
            # Add any valid conditions not in dataset
            for cond in valid_conditions:
                if cond not in conditions:
                    conditions.append(cond)
        else:
            conditions = valid_conditions

        # Get unique fuel types - filter to only valid values
        valid_fuel_types = ['Gasoline', 'Diesel',
                            'Electric', 'Hybrid', 'Plug-in Hybrid', 'Other']
        fuel_types = []
        if 'fuel_type' in df.columns:
            dataset_fuel_types = df['fuel_type'].dropna().unique().tolist()
            dataset_fuel_types = [str(f).strip()
                                  for f in dataset_fuel_types if str(f).strip()]
            # Normalize and map fuel types
            fuel_type_map = {
                'Gasoline': 'Gasoline',
                'Diesel': 'Diesel',
                'Electric': 'Electric',
                'EV': 'Electric',
                'Hybrid': 'Hybrid',
                'Plug-in Hybrid': 'Plug-in Hybrid',
                'Plug-In Hybrid': 'Plug-in Hybrid',
                'PHEV': 'Plug-in Hybrid',
                'LPG': 'Other',
                'Other': 'Other'
            }
            # Filter to only include valid fuel types (normalize first)
            for fuel in dataset_fuel_types:
                # Normalize fuel type
                normalized = fuel_type_map.get(fuel, fuel)
                if normalized in valid_fuel_types:
                    fuel_types.append(normalized)
                elif fuel.lower() in ['gasoline', 'petrol', 'gas']:
                    fuel_types.append('Gasoline')
                elif fuel.lower() in ['diesel']:
                    fuel_types.append('Diesel')
                elif fuel.lower() in ['electric', 'ev', 'bev', 'zev']:
                    fuel_types.append('Electric')
                elif fuel.lower() in ['hybrid', 'hev']:
                    fuel_types.append('Hybrid')
                elif fuel.lower() in ['plug-in hybrid', 'phev', 'plug in hybrid']:
                    fuel_types.append('Plug-in Hybrid')
            # Remove duplicates and sort
            fuel_types = sorted(list(set(fuel_types)))
            # If no valid fuel types found in dataset, use all valid types as fallback
            if not fuel_types:
                fuel_types = valid_fuel_types
        else:
            fuel_types = valid_fuel_types

        # Get year range
        year_min = 2000
        year_max = 2025
        if 'year' in df.columns:
            year_values = df['year'].dropna()
            if len(year_values) > 0:
                year_min = int(year_values.min())
                year_max = int(year_values.max())

        # Get mileage range
        mileage_min = 0
        mileage_max = 500000
        if 'mileage' in df.columns:
            mileage_values = df['mileage'].dropna()
            if len(mileage_values) > 0:
                mileage_min = int(mileage_values.min())
                mileage_max = int(mileage_values.max())

        return {
            "conditions": conditions,
            "fuel_types": fuel_types,
            "year_range": {"min": year_min, "max": year_max},
            "mileage_range": {"min": mileage_min, "max": mileage_max}
        }
    except Exception as e:
        logger.error(f"Error getting metadata: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail=f"Error retrieving metadata: {str(e)}")


@router.get("/car-image")
async def get_car_image(
    make: str = Query(..., description="Car make"),
    model: str = Query(..., description="Car model"),
    year: Optional[int] = Query(None, description="Car year"),
    trim: Optional[str] = Query(None, description="Car trim")
):
    """
    Get car image path based on make, model, year, and trim
    Returns image path with fallback logic:
    1. Exact match (make+model+year+trim)
    2. Same model different year
    3. Same make
    4. Default placeholder
    """
    try:
        metadata_df = load_image_metadata()
        if metadata_df is None or len(metadata_df) == 0:
            return {
                "image_path": "/images/cars/default-car.jpg",
                "found": False,
                "match_type": "default"
            }

        # Normalize inputs
        make_lower = str(make).strip().lower()
        model_lower = str(model).strip().lower() if model else ""
        trim_lower = str(trim).strip().lower() if trim else ""

        # Filter metadata
        filtered = metadata_df[
            (metadata_df['make'].str.lower() == make_lower) &
            (metadata_df['model'].str.lower() == model_lower)
        ]

        if len(filtered) == 0:
            # Try same make only
            filtered = metadata_df[metadata_df['make'].str.lower()
                                   == make_lower]
            if len(filtered) == 0:
                return {
                    "image_path": "/images/cars/default-car.jpg",
                    "found": False,
                    "match_type": "default"
                }
            # Return first image for this make
            first_match = filtered.iloc[0]
            return {
                "image_path": f"/api/car-images/{first_match['filename']}",
                "found": True,
                "match_type": "make_only",
                "filename": first_match['filename']
            }

        # Try exact match with year and trim
        if year and trim_lower:
            exact_match = filtered[
                (filtered['year'] == year) &
                (filtered['trim'].str.lower() == trim_lower)
            ]
            if len(exact_match) > 0:
                match = exact_match.iloc[0]
                return {
                    "image_path": f"/api/car-images/{match['filename']}",
                    "found": True,
                    "match_type": "exact",
                    "filename": match['filename']
                }

        # Try match with year only
        if year:
            year_match = filtered[filtered['year'] == year]
            if len(year_match) > 0:
                match = year_match.iloc[0]
                return {
                    "image_path": f"/api/car-images/{match['filename']}",
                    "found": True,
                    "match_type": "year",
                    "filename": match['filename']
                }

        # Try match with trim only
        if trim_lower:
            trim_match = filtered[filtered['trim'].str.lower() == trim_lower]
            if len(trim_match) > 0:
                match = trim_match.iloc[0]
                return {
                    "image_path": f"/api/car-images/{match['filename']}",
                    "found": True,
                    "match_type": "trim",
                    "filename": match['filename']
                }

        # Return first match for this make+model
        first_match = filtered.iloc[0]
        return {
            "image_path": f"/api/car-images/{first_match['filename']}",
            "found": True,
            "match_type": "model",
            "filename": first_match['filename']
        }

    except Exception as e:
        logger.error(f"Error getting car image: {e}", exc_info=True)
        return {
            "image_path": "/images/cars/default-car.jpg",
            "found": False,
            "match_type": "error",
            "error": str(e)
        }
