"""
Budget finder endpoint - search cars within budget range
"""

from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
from app.services.dataset_loader import DatasetLoader
from app.services.marketplace_service import search_listings, get_listing
import logging
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

router = APIRouter()


class BudgetCarResult(BaseModel):
    """Single car result for budget search"""
    make: str
    model: str
    year: int
    mileage: float
    condition: str
    fuel_type: str
    location: str
    engine_size: float
    cylinders: int
    price: float
    trim: Optional[str] = None
    image_filename: Optional[str] = None
    image_url: Optional[str] = None
    price_difference: Optional[float] = None  # Difference from target budget
    source: str = "database"  # "database" or "marketplace"
    listing_id: Optional[int] = None  # For marketplace listings
    is_new: bool = False  # True if added in last 24 hours


class BudgetSearchResponse(BaseModel):
    """Response from budget search"""
    total: int
    page: int
    page_size: int
    results: List[BudgetCarResult]
    error: Optional[str] = None


@router.get("/search", response_model=BudgetSearchResponse)
async def search_budget(
    budget: Optional[float] = Query(None, ge=0, description="Target budget (will search ±15% range)"),
    min_price: Optional[float] = Query(None, ge=0, description="Minimum price"),
    max_price: Optional[float] = Query(None, ge=0, description="Maximum price"),
    make: Optional[str] = Query(None, description="Filter by make"),
    model: Optional[str] = Query(None, description="Filter by model (requires make)"),
    min_year: Optional[int] = Query(None, ge=1900, le=2026, description="Minimum year"),
    max_year: Optional[int] = Query(None, ge=1900, le=2026, description="Maximum year"),
    max_mileage: Optional[float] = Query(None, ge=0, description="Maximum mileage"),
    condition: Optional[str] = Query(None, description="Filter by condition"),
    fuel_type: Optional[str] = Query(None, description="Filter by fuel type"),
    transmission: Optional[str] = Query(None, description="Filter by transmission"),
    location: Optional[str] = Query(None, description="Filter by location"),
    source: Optional[str] = Query(None, description="Filter by source: database, marketplace, or both"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Results per page"),
):
    """
    Search for cars within budget range with filters
    Merges results from both dataset and marketplace listings.

    If 'budget' is provided, searches within ±15% of that value.
    Otherwise uses min_price and max_price if provided.

    Returns paginated list of cars matching criteria, sorted by closest to budget.
    """
    try:
        # Calculate price range from budget if provided
        target_budget = None
        if budget is not None and budget > 0:
            target_budget = budget
            min_price = budget * 0.85  # 15% below
            max_price = budget * 1.15  # 15% above
            logger.info(f"Budget search: ${budget:,.2f} (±15% = ${min_price:,.2f} - ${max_price:,.2f})")

        all_results = []

        # ===== SEARCH DATASET CARS =====
        if source is None or source.lower() in ['database', 'both']:
            try:
                dataset_loader = DatasetLoader.get_instance()
                df = dataset_loader.dataset

                if df is not None and len(df) > 0:
                    price_col = dataset_loader.get_price_column() or 'price'
                    if price_col in df.columns:
                        filtered = df.copy()

                        # Apply price filters
                        if min_price is not None:
                            filtered = filtered[
                                (filtered[price_col] >= min_price) &
                                (filtered[price_col] > 0) &
                                (filtered[price_col].notna())
                            ]
                        if max_price is not None:
                            filtered = filtered[filtered[price_col] <= max_price]

                        # Apply other filters
                        if make:
                            filtered = filtered[filtered['make'].str.lower() == make.lower()]
                        if model and make:
                            filtered = filtered[filtered['model'].str.lower() == model.lower()]
                        if min_year is not None:
                            filtered = filtered[filtered['year'] >= min_year]
                        if max_year is not None:
                            filtered = filtered[filtered['year'] <= max_year]
                        if max_mileage is not None:
                            filtered = filtered[filtered['mileage'] <= max_mileage]
                        if condition:
                            filtered = filtered[filtered['condition'].str.lower() == condition.lower()]
                        if fuel_type:
                            filtered = filtered[filtered['fuel_type'].str.lower() == fuel_type.lower()]
                        if location:
                            filtered = filtered[filtered['location'].str.lower() == location.lower()]

                        # Remove rows with missing critical data
                        required_cols = ['make', 'model', 'year', price_col]
                        for col in required_cols:
                            if col in filtered.columns:
                                filtered = filtered[filtered[col].notna()]

                        # Calculate price difference for sorting
                        if target_budget is not None:
                            filtered = filtered.copy()
                            filtered['price_difference'] = abs(filtered[price_col] - target_budget)
                            filtered = filtered.sort_values('price_difference')
                        else:
                            filtered = filtered.sort_values(price_col)

                        # Load image metadata
                        image_metadata = None
                        try:
                            from pathlib import Path
                            metadata_path = Path('image_metadata.csv')
                            if metadata_path.exists():
                                image_metadata = pd.read_csv(metadata_path)
                        except Exception as e:
                            logger.debug(f"Could not load image metadata: {e}")

                        # Convert dataset rows to BudgetCarResult
                        for idx, row in filtered.iterrows():
                            try:
                                car_price = float(row.get(price_col, 0))
                                if car_price <= 0:
                                    continue

                                # Find matching image
                                image_filename = None
                                if image_metadata is not None and len(image_metadata) > 0:
                                    try:
                                        car_idx = int(idx) if isinstance(idx, (int, np.integer)) else 0
                                        image_idx = car_idx % len(image_metadata)
                                        match = image_metadata.iloc[image_idx]
                                        image_filename = match.get('filename')
                                    except Exception:
                                        pass

                                price_diff = None
                                if target_budget is not None:
                                    price_diff = abs(car_price - target_budget)

                                all_results.append(BudgetCarResult(
                                    make=str(row.get('make', 'Unknown')).strip(),
                                    model=str(row.get('model', 'Unknown')).strip(),
                                    year=int(row.get('year', 2020)),
                                    mileage=float(row.get('mileage', 0)),
                                    condition=str(row.get('condition', 'Good')).strip(),
                                    fuel_type=str(row.get('fuel_type', 'Gasoline')).strip(),
                                    location=str(row.get('location', 'Unknown')).strip(),
                                    engine_size=float(row.get('engine_size', 2.0)),
                                    cylinders=int(row.get('cylinders', 4)),
                                    price=round(car_price, 2),
                                    trim=str(row.get('trim', '')).strip() if pd.notna(row.get('trim')) else None,
                                    image_filename=image_filename,
                                    price_difference=round(price_diff, 2) if price_diff is not None else None,
                                    source="database"
                                ))
                            except Exception as e:
                                logger.debug(f"Error processing dataset car at index {idx}: {e}")
                                continue
            except Exception as e:
                logger.warning(f"Error searching dataset: {e}")

        # ===== SEARCH MARKETPLACE LISTINGS =====
        if source is None or source.lower() in ['marketplace', 'both']:
            try:
                # Build marketplace filters
                marketplace_filters = {}
                if min_price is not None:
                    marketplace_filters['min_price'] = min_price
                if max_price is not None:
                    marketplace_filters['max_price'] = max_price
                if make:
                    marketplace_filters['makes'] = [make]
                if model:
                    marketplace_filters['models'] = [model]
                if min_year is not None:
                    marketplace_filters['min_year'] = min_year
                if max_year is not None:
                    marketplace_filters['max_year'] = max_year
                if max_mileage is not None:
                    marketplace_filters['max_mileage'] = max_mileage
                if condition:
                    marketplace_filters['condition'] = condition
                if fuel_type:
                    marketplace_filters['fuel_type'] = fuel_type
                if transmission:
                    marketplace_filters['transmission'] = transmission
                if location:
                    marketplace_filters['location'] = location

                # Search marketplace (get all matching, we'll paginate after merging)
                marketplace_listings, marketplace_total = search_listings(
                    marketplace_filters,
                    page=1,
                    page_size=10000,  # Get all to merge properly
                    sort_by='newest'
                )

                # Convert marketplace listings to BudgetCarResult
                now = datetime.now()
                for listing in marketplace_listings:
                    try:
                        # Check if listing is new (created in last 24 hours)
                        created_at = listing.get('created_at')
                        is_new = False
                        if created_at:
                            try:
                                if isinstance(created_at, str):
                                    created_dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                                else:
                                    created_dt = created_at
                                is_new = (now - created_dt.replace(tzinfo=None) if created_dt.tzinfo else created_dt) < timedelta(hours=24)
                            except Exception:
                                pass

                        # Get cover image URL
                        cover_image_url = None
                        images = listing.get('images', [])
                        if images:
                            # Find primary image or first image
                            primary = next((img for img in images if img.get('is_primary')), None)
                            if primary:
                                cover_image_url = primary.get('url') or primary.get('file_path')
                            elif images:
                                cover_image_url = images[0].get('url') or images[0].get('file_path')

                        # Convert mileage if needed
                        mileage = float(listing.get('mileage', 0))
                        mileage_unit = listing.get('mileage_unit', 'km')
                        if mileage_unit == 'mi':
                            mileage = mileage * 1.60934  # Convert to km

                        # Build location string
                        loc_parts = []
                        if listing.get('location_city'):
                            loc_parts.append(listing['location_city'])
                        if listing.get('location_state'):
                            loc_parts.append(listing['location_state'])
                        if listing.get('location_country'):
                            loc_parts.append(listing['location_country'])
                        location_str = ', '.join(loc_parts) if loc_parts else 'Unknown'

                        price_diff = None
                        if target_budget is not None:
                            price_diff = abs(listing.get('price', 0) - target_budget)

                        all_results.append(BudgetCarResult(
                            make=str(listing.get('make', 'Unknown')).strip(),
                            model=str(listing.get('model', 'Unknown')).strip(),
                            year=int(listing.get('year', 2020)),
                            mileage=round(mileage, 2),
                            condition=str(listing.get('condition', 'Good')).strip(),
                            fuel_type=str(listing.get('fuel_type', 'Gasoline')).strip(),
                            location=location_str,
                            engine_size=float(listing.get('engine_size', 2.0)) if listing.get('engine_size') else 2.0,
                            cylinders=int(listing.get('cylinders', 4)) if listing.get('cylinders') else 4,
                            price=round(float(listing.get('price', 0)), 2),
                            trim=str(listing.get('trim', '')).strip() if listing.get('trim') else None,
                            image_url=cover_image_url,
                            price_difference=round(price_diff, 2) if price_diff is not None else None,
                            source="marketplace",
                            listing_id=int(listing.get('id', 0)),
                            is_new=is_new
                        ))
                    except Exception as e:
                        logger.debug(f"Error processing marketplace listing {listing.get('id')}: {e}")
                        continue
            except Exception as e:
                logger.warning(f"Error searching marketplace: {e}")

        # ===== MERGE AND SORT ALL RESULTS =====
        # Ensure all_results is a list
        if not isinstance(all_results, list):
            all_results = []
        
        # Filter out any None or invalid results
        all_results = [r for r in all_results if r is not None and isinstance(r, BudgetCarResult)]
        
        # Sort by price difference (closest to budget) if budget provided, otherwise by price
        if target_budget is not None:
            all_results.sort(key=lambda x: (x.price_difference or float('inf'), x.price))
        else:
            all_results.sort(key=lambda x: x.price)

        # Get total count
        total = len(all_results)

        # Paginate
        start_idx = (page - 1) * page_size
        end_idx = start_idx + page_size
        paginated_results = all_results[start_idx:end_idx]

        logger.info(f"Budget search completed: {total} total results ({len([r for r in all_results if r.source == 'database'])} database, {len([r for r in all_results if r.source == 'marketplace'])} marketplace), returning {len(paginated_results)} for page {page}")

        return BudgetSearchResponse(
            total=total,
            page=page,
            page_size=page_size,
            results=paginated_results if paginated_results else []
        )

    except Exception as e:
        logger.error(f"Error in budget search: {e}", exc_info=True)
        import traceback
        error_details = traceback.format_exc()
        logger.error(f"Full traceback: {error_details}")
        return BudgetSearchResponse(
            total=0,
            page=page,
            page_size=page_size,
            results=[],  # Ensure results is always an array
            error=f"Error searching budget: {str(e)}"
        )









