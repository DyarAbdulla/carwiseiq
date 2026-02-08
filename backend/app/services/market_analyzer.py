"""
Market analysis service - provides market comparison, trends, and similar cars
"""

import pandas as pd
import numpy as np
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import logging

from app.services.dataset_loader import DatasetLoader
from app.config import settings

logger = logging.getLogger(__name__)


class MarketAnalyzer:
    """Service for analyzing market data and providing insights"""

    def __init__(self):
        self.dataset_loader = DatasetLoader.get_instance()

    def get_market_comparison(self, predicted_price: float, car_features: Dict) -> Dict:
        """
        Compare predicted price to market average for similar cars

        Returns:
            {
                "your_car": predicted_price,
                "market_average": average_price,
                "difference": price_difference,
                "percentage_difference": percentage_diff
            }
        """
        try:
            df = self.dataset_loader.dataset
            if df is None or len(df) == 0:
                logger.warning("Dataset not available for market comparison")
                return {
                    "your_car": round(predicted_price, 2),
                    "market_average": round(predicted_price * 0.9, 2),
                    "difference": round(predicted_price * 0.1, 2),
                    "percentage_difference": 10.0
                }

            # Filter for similar cars (same make and model)
            similar = df[
                (df['make'].str.lower() == car_features.get('make', '').lower()) &
                (df['model'].str.lower() == car_features.get('model', '').lower())
            ]

            # If no exact match, broaden search to same make
            if len(similar) < 10:
                similar = df[df['make'].str.lower(
                ) == car_features.get('make', '').lower()]

            # If still not enough, use all cars
            if len(similar) < 10:
                similar = df.copy()

            # Get price column name
            price_col = self.dataset_loader.get_price_column()
            if price_col is None or price_col not in similar.columns:
                logger.warning("No price column found in dataset")
                return {
                    "your_car": round(predicted_price, 2),
                    "market_average": round(predicted_price * 0.9, 2),
                    "difference": round(predicted_price * 0.1, 2),
                    "percentage_difference": 10.0
                }

            # Calculate market average
            market_avg = float(similar[price_col].mean())

            # Calculate difference
            difference = predicted_price - market_avg
            percentage_diff = (difference / market_avg *
                               100) if market_avg > 0 else 0

            return {
                "your_car": round(predicted_price, 2),
                "market_average": round(market_avg, 2),
                "difference": round(difference, 2),
                "percentage_difference": round(percentage_diff, 2)
            }
        except Exception as e:
            logger.error(
                f"Error calculating market comparison: {e}", exc_info=True)
            # Return defaults
            return {
                "your_car": round(predicted_price, 2),
                "market_average": round(predicted_price * 0.9, 2),
                "difference": round(predicted_price * 0.1, 2),
                "percentage_difference": 10.0
            }

    def get_deal_analysis(self, predicted_price: float, market_comparison: Dict) -> str:
        """
        Determine if the deal is excellent, good, fair, or poor

        Returns: 'excellent', 'good', 'fair', or 'poor'
        """
        percentage_diff = market_comparison.get('percentage_difference', 0)

        # Excellent: 10%+ below market average
        if percentage_diff <= -10:
            return 'excellent'
        # Good: 5-10% below market average
        elif percentage_diff <= -5:
            return 'good'
        # Poor: 15%+ above market average
        elif percentage_diff >= 15:
            return 'poor'
        # Fair: within -5% to +15% of market average
        else:
            return 'fair'

    def get_similar_cars(self, car_features: Dict, limit: int = 10, predicted_price: float = None) -> List[Dict]:
        """
        Find similar cars from the dataset with intelligent filtering

        Filters by:
        - Brand tier (luxury/premium/mid-range)
        - Price range (±30% of predicted price, expands to ±50% if needed)
        - Year range (±3 years)
        - Excludes same make/model combination

        Returns list of similar cars with their details
        """
        try:
            df = self.dataset_loader.dataset
            if df is None or len(df) == 0:
                logger.warning("Dataset not available for similar cars")
                return []

            df = df.copy()

            # Get price column name
            price_col = self.dataset_loader.get_price_column() or 'price'

            # Define brand tiers
            luxury_brands = [
                'rolls royce', 'rolls-royce', 'bentley', 'ferrari', 'lamborghini',
                'aston martin', 'mclaren', 'bugatti', 'maybach'
            ]
            premium_brands = [
                'mercedes-benz', 'mercedes', 'bmw', 'audi', 'porsche',
                'lexus', 'land rover', 'jaguar', 'maserati', 'cadillac',
                'infiniti', 'acura', 'genesis', 'tesla', 'lincoln'
            ]
            mid_range_brands = [
                'toyota', 'honda', 'nissan', 'mazda', 'volkswagen',
                'hyundai', 'kia', 'ford', 'chevrolet', 'gmc', 'dodge',
                'jeep', 'chrysler', 'subaru', 'mitsubishi', 'suzuki'
            ]

            # Normalize brand names for comparison (lowercase, handle variations)
            input_make = str(car_features.get('make', '')).lower().strip()
            input_model = str(car_features.get('model', '')).lower().strip()

            # Safety check: ensure we have valid make and model
            if not input_make or input_make == 'nan':
                logger.warning("Invalid or missing make in car_features")
                return []

            try:
                input_year = int(car_features.get('year', 2020))
            except (ValueError, TypeError):
                input_year = 2020
                logger.warning(
                    f"Invalid year in car_features, using default: {input_year}")

            # Normalize "Rolls Royce" variations (handle spaces, hyphens, etc.)
            if 'rolls' in input_make and 'royce' in input_make:
                input_make = 'rolls royce'  # Normalize to standard form

            # Determine input vehicle tier
            input_tier = 'mid_range'  # default
            allowed_brands = mid_range_brands.copy()

            # Check for luxury brands (handle variations)
            is_luxury = any(
                brand in input_make for brand in luxury_brands) or 'rolls' in input_make and 'royce' in input_make
            is_premium = any(brand in input_make for brand in premium_brands)

            if is_luxury:
                input_tier = 'luxury'
                allowed_brands = luxury_brands + premium_brands
            elif is_premium:
                input_tier = 'premium'
                allowed_brands = premium_brands + luxury_brands

            # Price range filtering (if predicted_price is provided)
            price_min = None
            price_max = None
            if predicted_price and predicted_price > 0:
                # Primary search: ±30% of predicted price
                price_min = predicted_price * 0.7
                price_max = predicted_price * 1.3
            else:
                # Fallback: use dataset price range if no predicted_price
                if price_col in df.columns:
                    valid_prices = df[price_col].dropna()
                    if len(valid_prices) > 0:
                        price_min = valid_prices.quantile(0.1)
                        price_max = valid_prices.quantile(0.9)

            # Start with filtered dataset
            filtered_df = df.copy()

            # Filter by brand tier
            if input_tier in ['luxury', 'premium']:
                # Normalize make column for comparison (handle "Rolls Royce" variations and NaN)
                df_make_normalized = filtered_df['make'].astype(
                    str).str.lower().str.strip()
                # Normalize "Rolls Royce" variations in dataset
                df_make_normalized = df_make_normalized.apply(
                    lambda x: 'rolls royce' if pd.notna(x) and 'rolls' in str(
                        x) and 'royce' in str(x) else (str(x) if pd.notna(x) else '')
                )

                # Create allowed brands list with normalized "Rolls Royce"
                normalized_allowed_brands = []
                for brand in allowed_brands:
                    if 'rolls' in brand.lower() and 'royce' in brand.lower():
                        normalized_allowed_brands.append('rolls royce')
                    else:
                        normalized_allowed_brands.append(brand.lower())

                # Create a mask for allowed brands (case-insensitive)
                brand_mask = df_make_normalized.isin(normalized_allowed_brands)
                filtered_df = filtered_df[brand_mask]

            # Filter by price range
            if price_min is not None and price_max is not None and price_col in filtered_df.columns:
                price_mask = (
                    (filtered_df[price_col] >= price_min) &
                    (filtered_df[price_col] <= price_max) &
                    (filtered_df[price_col] > 0)
                )
                filtered_df = filtered_df[price_mask]

            # Filter by year range (±3 years)
            year_mask = (
                (filtered_df['year'] >= input_year - 3) &
                (filtered_df['year'] <= input_year + 3)
            )
            filtered_df = filtered_df[year_mask]

            # Prioritize exact make/model matches (these are most similar)
            # Normalize make/model columns for comparison (handle NaN values)
            df_make_normalized = filtered_df['make'].astype(str).str.lower().str.strip().apply(
                lambda x: 'rolls royce' if pd.notna(x) and 'rolls' in str(
                    x) and 'royce' in str(x) else (str(x) if pd.notna(x) else '')
            )
            df_model_normalized = filtered_df['model'].astype(
                str).str.lower().str.strip()

            exact_make_model = filtered_df[
                (df_make_normalized == input_make) &
                (df_model_normalized == input_model)
            ]

            # If we have exact matches, use them (they're the most similar)
            if len(exact_make_model) >= limit:
                # We have enough exact matches, use only those
                filtered_df = exact_make_model
            elif len(exact_make_model) > 0:
                # We have some exact matches, combine with other similar cars
                other_similar = filtered_df[
                    ~((df_make_normalized == input_make) & (
                        df_model_normalized == input_model))
                ]
                # Combine: exact matches first, then others (only if other_similar has rows)
                if len(other_similar) > 0:
                    filtered_df = pd.concat(
                        [exact_make_model, other_similar]).reset_index(drop=True)
                else:
                    filtered_df = exact_make_model
            # If no exact matches, filtered_df already contains other similar cars

            # If we have enough results, calculate similarity and sort
            if len(filtered_df) > 0:
                # Calculate similarity score based on year, mileage, and price
                filtered_df = filtered_df.copy()
                filtered_df['year_diff'] = abs(
                    filtered_df['year'] - input_year)
                filtered_df['mileage_diff'] = abs(
                    filtered_df['mileage'] - car_features.get('mileage', 50000))

                # Price similarity (if predicted_price available)
                if predicted_price and predicted_price > 0 and price_col in filtered_df.columns:
                    filtered_df['price_diff'] = abs(
                        filtered_df[price_col] - predicted_price)
                    # Normalize price difference (divide by predicted_price to get percentage)
                    filtered_df['price_diff_normalized'] = filtered_df['price_diff'] / \
                        predicted_price
                    filtered_df['similarity_score'] = (
                        # Normalize year difference
                        filtered_df['year_diff'] / 10 +
                        # Normalize mileage difference
                        filtered_df['mileage_diff'] / 10000 +
                        filtered_df['price_diff_normalized'] *
                        5  # Weight price similarity
                    )
                else:
                    filtered_df['similarity_score'] = (
                        filtered_df['year_diff'] / 10 +
                        filtered_df['mileage_diff'] / 10000
                    )

                # Sort by similarity and take top N
                similar = filtered_df.sort_values(
                    'similarity_score').head(limit)
            else:
                similar = pd.DataFrame()

            # If still not enough results, expand search criteria
            if len(similar) < 3 and predicted_price and predicted_price > 0:
                # Expand price range to ±50%
                expanded_price_min = predicted_price * 0.5
                expanded_price_max = predicted_price * 1.5

                # Re-filter with expanded price range
                expanded_df = df.copy()

                # Still apply brand tier filter
                if input_tier in ['luxury', 'premium']:
                    # Normalize make column for comparison (handle "Rolls Royce" variations and NaN)
                    expanded_make_normalized = expanded_df['make'].astype(
                        str).str.lower().str.strip()
                    expanded_make_normalized = expanded_make_normalized.apply(
                        lambda x: 'rolls royce' if pd.notna(x) and 'rolls' in str(
                            x) and 'royce' in str(x) else (str(x) if pd.notna(x) else '')
                    )

                    # Create allowed brands list with normalized "Rolls Royce"
                    normalized_allowed_brands = []
                    for brand in allowed_brands:
                        if 'rolls' in brand.lower() and 'royce' in brand.lower():
                            normalized_allowed_brands.append('rolls royce')
                        else:
                            normalized_allowed_brands.append(brand.lower())

                    brand_mask = expanded_make_normalized.isin(
                        normalized_allowed_brands)
                    expanded_df = expanded_df[brand_mask]

                # Expanded price range
                if price_col in expanded_df.columns:
                    price_mask = (
                        (expanded_df[price_col] >= expanded_price_min) &
                        (expanded_df[price_col] <= expanded_price_max) &
                        (expanded_df[price_col] > 0)
                    )
                    expanded_df = expanded_df[price_mask]

                # Year range (±3 years)
                year_mask = (
                    (expanded_df['year'] >= input_year - 3) &
                    (expanded_df['year'] <= input_year + 3)
                )
                expanded_df = expanded_df[year_mask]

                # Prioritize exact make/model matches in expanded search too
                expanded_make_normalized = expanded_df['make'].astype(str).str.lower().str.strip().apply(
                    lambda x: 'rolls royce' if pd.notna(x) and 'rolls' in str(
                        x) and 'royce' in str(x) else (str(x) if pd.notna(x) else '')
                )
                expanded_model_normalized = expanded_df['model'].astype(
                    str).str.lower().str.strip()

                expanded_exact_make_model = expanded_df[
                    (expanded_make_normalized == input_make) &
                    (expanded_model_normalized == input_model)
                ]

                # If we have exact matches, prioritize them
                if len(expanded_exact_make_model) >= limit:
                    expanded_df = expanded_exact_make_model
                elif len(expanded_exact_make_model) > 0:
                    expanded_other_similar = expanded_df[
                        ~((expanded_make_normalized == input_make) & (
                            expanded_model_normalized == input_model))
                    ]
                    # Combine: exact matches first, then others (only if other_similar has rows)
                    if len(expanded_other_similar) > 0:
                        expanded_df = pd.concat(
                            [expanded_exact_make_model, expanded_other_similar]).reset_index(drop=True)
                    else:
                        expanded_df = expanded_exact_make_model
                # If no exact matches, expanded_df already contains other similar cars

                # Calculate similarity and sort
                if len(expanded_df) > 0:
                    expanded_df = expanded_df.copy()
                    expanded_df['year_diff'] = abs(
                        expanded_df['year'] - input_year)
                    expanded_df['mileage_diff'] = abs(
                        expanded_df['mileage'] - car_features.get('mileage', 50000))

                    if price_col in expanded_df.columns:
                        expanded_df['price_diff'] = abs(
                            expanded_df[price_col] - predicted_price)
                        expanded_df['price_diff_normalized'] = expanded_df['price_diff'] / \
                            predicted_price
                        expanded_df['similarity_score'] = (
                            expanded_df['year_diff'] / 10 +
                            expanded_df['mileage_diff'] / 10000 +
                            expanded_df['price_diff_normalized'] * 5
                        )
                    else:
                        expanded_df['similarity_score'] = (
                            expanded_df['year_diff'] / 10 +
                            expanded_df['mileage_diff'] / 10000
                        )

                    expanded_similar = expanded_df.sort_values(
                        'similarity_score').head(limit)

                    # Combine with previous results (avoid duplicates)
                    if len(similar) > 0:
                        combined = pd.concat([similar, expanded_similar]).drop_duplicates(
                            subset=['make', 'model', 'year', price_col])
                        similar = combined.sort_values(
                            'similarity_score').head(limit)
                    else:
                        similar = expanded_similar

            # Format results
            results = []
            for idx, row in similar.iterrows():
                try:
                    # Check for link/url column (case-insensitive)
                    link = None
                    for col in ['link', 'url', 'href', 'source_url', 'listing_url']:
                        if col in row and pd.notna(row.get(col)):
                            link = str(row.get(col))
                            break

                    # Get image URL from dataset (check image_1 column)
                    image_url = None
                    if 'image_1' in row and pd.notna(row.get('image_1')):
                        image_url = str(row.get('image_1')).strip()
                        # Fix backslashes in URLs (Windows path issue)
                        if image_url:
                            image_url = image_url.replace('\\', '/')
                            # Convert relative paths to full API URLs for high-quality images
                            if image_url.startswith('car_') and image_url.endswith('.jpg'):
                                # Convert car_XXXXXX.jpg to API endpoint
                                image_url = f"/api/car-images/{image_url}"
                            elif image_url.startswith('/car_images/'):
                                # Convert /car_images/car_XXXXXX.jpg to API endpoint
                                filename = image_url.replace(
                                    '/car_images/', '')
                                image_url = f"/api/car-images/{filename}"

                    # Generate image_id from dataset row index (e.g., row 0 -> car_000000.jpg)
                    image_id = f"car_{idx:06d}.jpg"

                    # If no image_url found, use image_id to create full API URL
                    if not image_url:
                        image_url = f"/api/car-images/{image_id}"

                    results.append({
                        "year": int(row.get('year', 2020)),
                        # Handle float mileage
                        "mileage": int(float(row.get('mileage', 0))),
                        "condition": str(row.get('condition', 'Good')),
                        "price": float(row.get(price_col, row.get('price', 0))),
                        "make": str(row.get('make', '')),
                        "model": str(row.get('model', '')),
                        "link": link,
                        "image_id": image_id,
                        "image_url": image_url  # Always set to full API URL for high-quality images
                    })
                except (ValueError, TypeError) as e:
                    logger.warning(f"Error processing similar car row: {e}")
                    continue

            return results[:limit]
        except Exception as e:
            logger.error(f"Error finding similar cars: {e}", exc_info=True)
            return []

    def get_market_trends(self, car_features: Dict, months: int = 6) -> List[Dict]:
        """
        Get market price trends for similar cars over time

        Returns list of monthly average prices
        """
        try:
            df = self.dataset_loader.dataset
            if df is None or len(df) == 0:
                logger.warning("Dataset not available for market trends")
                base_price = 20000
            else:
                df = df.copy()

                # Filter for similar cars (same make and model)
                similar = df[
                    (df['make'].str.lower() == car_features.get('make', '').lower()) &
                    (df['model'].str.lower() ==
                     car_features.get('model', '').lower())
                ]

                # If no exact match, use same make
                if len(similar) < 10:
                    similar = df[df['make'].str.lower(
                    ) == car_features.get('make', '').lower()]

                # If still not enough, use all cars
                if len(similar) < 10:
                    similar = df.copy()

                # Get price column name
                price_col = self.dataset_loader.get_price_column()
                if price_col is None or price_col not in similar.columns:
                    logger.warning("No price column found for trends")
                    base_price = 20000
                else:
                    base_price = float(similar[price_col].mean())

            # Generate monthly trends (simulated based on year)
            # In a real scenario, you'd have date data
            trends = []

            # Create trend data for last N months
            for i in range(months, 0, -1):
                # Simulate slight variation
                variation = np.random.normal(0, 0.02)  # 2% standard deviation
                price = base_price * (1 + variation)

                # Calculate month name
                date = datetime.now() - timedelta(days=30 * i)
                month_name = date.strftime("%b %Y")

                trends.append({
                    "month": month_name,
                    "average_price": round(price, 2),
                    "date": date.isoformat()
                })

            return trends
        except Exception as e:
            logger.error(
                f"Error calculating market trends: {e}", exc_info=True)
            # Return default trend
            base_price = 20000
            trends = []
            for i in range(months, 0, -1):
                date = datetime.now() - timedelta(days=30 * i)
                month_name = date.strftime("%b %Y")
                trends.append({
                    "month": month_name,
                    "average_price": round(base_price, 2),
                    "date": date.isoformat()
                })
            return trends

    def get_confidence_interval(self, predicted_price: float, precision: float = 20.0) -> Dict:
        """
        Calculate confidence interval for prediction

        Returns:
            {
                "lower": lower_bound,
                "upper": upper_bound
            }
        """
        # Calculate range based on precision percentage
        range_amount = predicted_price * (precision / 100)

        return {
            "lower": round(max(0, predicted_price - range_amount), 2),
            "upper": round(predicted_price + range_amount, 2)
        }

    def get_confidence_level(self, precision: float) -> str:
        """
        Determine confidence level based on precision

        Returns: 'high', 'medium', or 'low'
        """
        if precision < 15:
            return 'high'
        elif precision < 30:
            return 'medium'
        else:
            return 'low'

    def get_price_factors(self, car_features: Dict, predicted_price: float) -> List[Dict]:
        """
        Calculate top 6 price impact factors using rule-based approach

        Returns list of factors with impact amounts
        """
        try:
            df = self.dataset_loader.dataset
            factors = []

            # Get market averages for comparison
            if df is not None and len(df) > 0:
                price_col = self.dataset_loader.get_price_column() or 'price'

                # Factor 1: Year impact
                year = car_features.get('year', 2020)
                similar_by_year = df[df['year'] == year]
                if len(similar_by_year) > 0:
                    avg_price_year = float(similar_by_year[price_col].mean())
                    year_impact = predicted_price - avg_price_year
                    factors.append({
                        "factor": "Year",
                        "impact": round(year_impact, 2),
                        "direction": "up" if year_impact > 0 else "down",
                        "description": f"{year} model year"
                    })

                # Factor 2: Mileage impact
                mileage = car_features.get('mileage', 50000)
                similar_mileage = df[
                    (df['mileage'] >= mileage * 0.8) &
                    (df['mileage'] <= mileage * 1.2)
                ]
                if len(similar_mileage) > 0:
                    avg_price_mileage = float(
                        similar_mileage[price_col].mean())
                    mileage_impact = predicted_price - avg_price_mileage
                    # Lower mileage = higher price
                    mileage_factor = -mileage_impact if mileage < 50000 else mileage_impact
                    factors.append({
                        "factor": "Mileage",
                        "impact": round(abs(mileage_factor), 2),
                        "direction": "up" if mileage < 50000 else "down",
                        "description": f"{mileage:,} km"
                    })

                # Factor 3: Condition impact
                condition = car_features.get('condition', 'Good')
                similar_condition = df[df['condition'] == condition]
                if len(similar_condition) > 0:
                    avg_price_condition = float(
                        similar_condition[price_col].mean())
                    condition_impact = predicted_price - avg_price_condition
                    factors.append({
                        "factor": "Condition",
                        "impact": round(condition_impact, 2),
                        "direction": "up" if condition_impact > 0 else "down",
                        "description": condition
                    })

                # Factor 4: Location impact
                location = car_features.get('location', '')
                if location:
                    similar_location = df[df['location'].str.lower(
                    ) == location.lower()]
                    if len(similar_location) > 0:
                        avg_price_location = float(
                            similar_location[price_col].mean())
                        location_impact = predicted_price - avg_price_location
                        factors.append({
                            "factor": "Location",
                            "impact": round(location_impact, 2),
                            "direction": "up" if location_impact > 0 else "down",
                            "description": location
                        })

                # Factor 5: Make/Model popularity (simplified)
                make = car_features.get('make', '')
                model = car_features.get('model', '')
                if make and model:
                    similar_make_model = df[
                        (df['make'].str.lower() == make.lower()) &
                        (df['model'].str.lower() == model.lower())
                    ]
                    if len(similar_make_model) > 0:
                        avg_price_make_model = float(
                            similar_make_model[price_col].mean())
                        make_model_impact = predicted_price - avg_price_make_model
                        factors.append({
                            "factor": "Make/Model",
                            "impact": round(make_model_impact, 2),
                            "direction": "up" if make_model_impact > 0 else "down",
                            "description": f"{make} {model}"
                        })

                # Factor 6: Fuel Type impact
                fuel_type = car_features.get('fuel_type', 'Gasoline')
                similar_fuel = df[df['fuel_type'] == fuel_type]
                if len(similar_fuel) > 0:
                    avg_price_fuel = float(similar_fuel[price_col].mean())
                    fuel_impact = predicted_price - avg_price_fuel
                    factors.append({
                        "factor": "Fuel Type",
                        "impact": round(fuel_impact, 2),
                        "direction": "up" if fuel_impact > 0 else "down",
                        "description": fuel_type
                    })

            # Sort by absolute impact and return top 6
            factors.sort(key=lambda x: abs(x['impact']), reverse=True)
            return factors[:6]

        except Exception as e:
            logger.error(
                f"Error calculating price factors: {e}", exc_info=True)
            # Return default factors
            return [
                {"factor": "Year", "impact": 0, "direction": "up",
                    "description": str(car_features.get('year', 2020))},
                {"factor": "Mileage", "impact": 0, "direction": "down",
                    "description": f"{car_features.get('mileage', 0):,} km"},
                {"factor": "Condition", "impact": 0, "direction": "up",
                    "description": car_features.get('condition', 'Good')},
            ]

    def get_deal_score(self, predicted_price: float, market_comparison: Dict) -> Dict:
        """
        Calculate deal score with badge

        Returns deal score analysis
        """
        percentage_diff = market_comparison.get('percentage_difference', 0)

        if percentage_diff <= -15:
            return {
                "score": "excellent",
                "badge": "🔥",
                "percentage": round(abs(percentage_diff), 1),
                "label": "Great Deal"
            }
        elif percentage_diff <= -5:
            return {
                "score": "good",
                "badge": "✅",
                "percentage": round(abs(percentage_diff), 1),
                "label": "Fair Deal"
            }
        elif percentage_diff <= 10:
            return {
                "score": "fair",
                "badge": "✅",
                "percentage": round(abs(percentage_diff), 1),
                "label": "Fair Price"
            }
        else:
            return {
                "score": "poor",
                "badge": "⚠️",
                "percentage": round(percentage_diff, 1),
                "label": "Overpriced"
            }

    def get_market_demand(self, car_features: Dict) -> Dict:
        """
        Calculate market demand indicator for make/model

        Returns demand level
        """
        try:
            df = self.dataset_loader.dataset
            if df is None or len(df) == 0:
                return {"level": "medium", "badge": "Medium Demand", "description": None}

            make = car_features.get('make', '')
            model = car_features.get('model', '')

            # Count listings for this make/model
            if make and model:
                count = len(df[
                    (df['make'].str.lower() == make.lower()) &
                    (df['model'].str.lower() == model.lower())
                ])
            elif make:
                count = len(df[df['make'].str.lower() == make.lower()])
            else:
                return {"level": "medium", "badge": "Medium Demand", "description": None}

            # Determine demand based on listing count
            # High demand = many listings (popular), Low demand = few listings (rare)
            total_cars = len(df)
            percentage = (count / total_cars * 100) if total_cars > 0 else 0

            if percentage > 2:
                return {"level": "high", "badge": "High Demand", "description": f"{count:,} listings in dataset"}
            elif percentage > 0.5:
                return {"level": "medium", "badge": "Medium Demand", "description": f"{count:,} listings in dataset"}
            else:
                return {"level": "low", "badge": "Low Demand", "description": f"{count:,} listings in dataset"}

        except Exception as e:
            logger.error(
                f"Error calculating market demand: {e}", exc_info=True)
            return {"level": "medium", "badge": "Medium Demand", "description": None}
