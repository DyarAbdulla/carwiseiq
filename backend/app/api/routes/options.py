"""
Options endpoints - provides available engines, cylinders, and colors for specific make/model combinations
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.services.dataset_loader import DatasetLoader
from pydantic import BaseModel
import logging
import pandas as pd
import numpy as np

logger = logging.getLogger(__name__)

router = APIRouter()


class EngineOption(BaseModel):
    """Engine option with size and display name"""
    size: float
    display: str


class OptionsResponse(BaseModel):
    """Response model for options endpoints"""
    engines: Optional[List[EngineOption]] = None
    cylinders: Optional[List[int]] = None
    colors: Optional[List[str]] = None
    error: Optional[str] = None


@router.get("/available-engines")
async def get_available_engines(
    make: str = Query(..., description="Car make/brand name"),
    model: str = Query(..., description="Car model name")
) -> OptionsResponse:
    """
    Get available engine options for a specific make/model combination

    Returns list of engine options with size and display name.
    Engines are sorted by size.
    """
    try:
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset

        if df is None or len(df) == 0:
            logger.warning("Dataset not available for engines")
            return OptionsResponse(engines=[], error="Dataset not available")

        # Filter by make and model (case-insensitive)
        filtered = df[
            (df['make'].str.lower() == make.lower()) &
            (df['model'].str.lower() == model.lower())
        ]

        if len(filtered) == 0:
            return OptionsResponse(engines=[])

        # Get unique engine sizes - convert to numeric first
        if 'engine_size' not in filtered.columns:
            return OptionsResponse(engines=[], error="Engine size column not found in dataset")

        # Convert engine_size to numeric, handling string values
        engine_sizes_numeric = pd.to_numeric(filtered['engine_size'], errors='coerce')
        engine_sizes = engine_sizes_numeric.dropna().unique().tolist()

        # Create engine options with display names
        engines = []
        for size in sorted(set(engine_sizes)):
            try:
                # Ensure size is numeric
                size_float = float(size)
                if pd.isna(size_float) or np.isnan(size_float):
                    continue
                # Format display: "2.0L" or "2L" (remove trailing zero)
                if size_float == int(size_float):
                    display = f"{int(size_float)}L"
                else:
                    display = f"{size_float}L"
                engines.append(EngineOption(size=size_float, display=display))
            except (ValueError, TypeError):
                continue

        return OptionsResponse(engines=engines)

    except Exception as e:
        logger.error(f"Error getting engines for {make}/{model}: {e}", exc_info=True)
        return OptionsResponse(engines=[], error=str(e))


@router.get("/available-cylinders")
async def get_available_cylinders(
    make: str = Query(..., description="Car make/brand name"),
    model: str = Query(..., description="Car model name"),
    engine: float = Query(..., description="Engine size in liters")
) -> OptionsResponse:
    """
    Get available cylinder options for a specific make/model/engine combination

    Returns sorted list of cylinder counts.
    """
    try:
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset

        if df is None or len(df) == 0:
            logger.warning("Dataset not available for cylinders")
            return OptionsResponse(cylinders=[], error="Dataset not available")

        # Convert engine_size to numeric, handling string values
        df['engine_size_numeric'] = pd.to_numeric(df['engine_size'], errors='coerce')
        
        # Filter by make, model, and engine size (case-insensitive, allow small float differences)
        filtered = df[
            (df['make'].str.lower() == make.lower()) &
            (df['model'].str.lower() == model.lower()) &
            (df['engine_size_numeric'].notna()) &
            (np.abs(df['engine_size_numeric'] - float(engine)) < 0.1)  # Allow small floating point differences
        ]

        if len(filtered) == 0:
            # Return default [4] if no data found (most cars are 4-cylinder)
            return OptionsResponse(cylinders=[4], error="No matching data found, returning default")

        # Get unique cylinder counts
        if 'cylinders' not in filtered.columns:
            return OptionsResponse(cylinders=[4], error="Cylinders column not found, returning default")

        # Convert cylinders to numeric, handling string values
        cylinders_numeric = pd.to_numeric(filtered['cylinders'], errors='coerce')
        cylinders_list = cylinders_numeric.dropna().unique().tolist()
        cylinders = []
        for c in cylinders_list:
            try:
                c_int = int(float(c))  # Convert to float first, then int
                if not pd.isna(c_int) and c_int > 0:
                    cylinders.append(c_int)
            except (ValueError, TypeError):
                continue
        cylinders = sorted(set(cylinders))

        # If no cylinders found, return default [4]
        if not cylinders:
            cylinders = [4]

        return OptionsResponse(cylinders=cylinders)

    except Exception as e:
        logger.error(f"Error getting cylinders for {make}/{model}/{engine}: {e}", exc_info=True)
        # Return default [4] on error
        return OptionsResponse(cylinders=[4], error=str(e))


@router.get("/available-colors")
async def get_available_colors(
    make: str = Query(..., description="Car make/brand name"),
    model: str = Query(..., description="Car model name")
) -> OptionsResponse:
    """
    Get available color options for a specific make/model combination

    If color column exists in dataset, returns unique colors.
    Otherwise, returns common default colors.
    """
    try:
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset

        if df is None or len(df) == 0:
            # Return default colors if dataset not available
            default_colors = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Gold', 'Brown', 'Orange', 'Yellow', 'Purple', 'Beige', 'Other']
            return OptionsResponse(colors=default_colors)

        # Check if color column exists
        if 'color' in df.columns:
            # Filter by make and model (case-insensitive)
            filtered = df[
                (df['make'].str.lower() == make.lower()) &
                (df['model'].str.lower() == model.lower())
            ]

            if len(filtered) > 0:
                colors = filtered['color'].dropna().unique().tolist()
                colors = [str(c).strip() for c in colors if str(c).strip() and str(c).lower() not in ['nan', 'none', 'null', 'n/a', '']]
                colors = sorted(set(colors))

                # Add "Other" option if we have colors
                if colors and 'Other' not in colors:
                    colors.append('Other')

                if colors:
                    return OptionsResponse(colors=colors)

        # Default colors if column doesn't exist or no colors found
        default_colors = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Gold', 'Brown', 'Orange', 'Yellow', 'Purple', 'Beige', 'Other']
        return OptionsResponse(colors=default_colors)

    except Exception as e:
        logger.error(f"Error getting colors for {make}/{model}: {e}", exc_info=True)
        # Return default colors on error
        default_colors = ['White', 'Black', 'Silver', 'Gray', 'Red', 'Blue', 'Green', 'Gold', 'Brown', 'Orange', 'Yellow', 'Purple', 'Beige', 'Other']
        return OptionsResponse(colors=default_colors, error=str(e))
