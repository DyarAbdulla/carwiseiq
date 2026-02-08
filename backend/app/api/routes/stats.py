"""
Statistics endpoint - provides aggregated dataset statistics
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict
from app.services.dataset_loader import DatasetLoader
import pandas as pd
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class TopMake(BaseModel):
    """Top make statistic"""
    make: str
    count: int


class FuelTypeStat(BaseModel):
    """Fuel type distribution"""
    fuel_type: str
    count: int
    percentage: float


class PriceByYear(BaseModel):
    """Price trend by year"""
    year: int
    average_price: float
    count: int


class PriceByCondition(BaseModel):
    """Price by condition"""
    condition: str
    average_price: float
    count: int


class StatsSummaryResponse(BaseModel):
    """Complete statistics summary"""
    top_makes: List[TopMake]
    fuel_type_distribution: List[FuelTypeStat]
    price_trends_by_year: List[PriceByYear]
    price_by_condition: List[PriceByCondition]


class BasicStatsResponse(BaseModel):
    """Basic dataset statistics"""
    total_cars: int
    average_price: float
    median_price: float
    min_price: float
    max_price: float
    year_range: Dict[str, int]
    top_makes: List[TopMake]


@router.get("/basic", response_model=BasicStatsResponse)
async def get_basic_stats():
    """
    Get basic dataset statistics
    
    Returns:
    - Total cars count
    - Average, median, min, max prices
    - Year range
    - Top 5 makes
    """
    try:
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset
        
        if df is None or len(df) == 0:
            return BasicStatsResponse(
                total_cars=0,
                average_price=0.0,
                median_price=0.0,
                min_price=0.0,
                max_price=0.0,
                year_range={"min": 2000, "max": 2025},
                top_makes=[]
            )
        
        price_col = dataset_loader.get_price_column() or 'price'
        total_cars = len(df)
        
        # Price statistics
        if price_col in df.columns:
            average_price = float(df[price_col].mean())
            median_price = float(df[price_col].median())
            min_price = float(df[price_col].min())
            max_price = float(df[price_col].max())
        else:
            average_price = median_price = min_price = max_price = 0.0
        
        # Year range
        if 'year' in df.columns:
            year_min = int(df['year'].min())
            year_max = int(df['year'].max())
        else:
            year_min = 2000
            year_max = 2025
        
        # Top makes (top 5)
        top_makes_data = df['make'].value_counts().head(5)
        top_makes = [
            TopMake(make=str(make), count=int(count))
            for make, count in top_makes_data.items()
        ]
        
        return BasicStatsResponse(
            total_cars=total_cars,
            average_price=round(average_price, 2),
            median_price=round(median_price, 2),
            min_price=round(min_price, 2),
            max_price=round(max_price, 2),
            year_range={"min": year_min, "max": year_max},
            top_makes=top_makes
        )
        
    except Exception as e:
        logger.error(f"Error getting basic stats: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving statistics: {str(e)}")


@router.get("/summary", response_model=StatsSummaryResponse)
async def get_stats_summary():
    """
    Get comprehensive dataset statistics
    
    Returns aggregated statistics including:
    - Top makes
    - Fuel type distribution
    - Price trends by year
    - Price by condition
    """
    try:
        dataset_loader = DatasetLoader.get_instance()
        df = dataset_loader.dataset
        
        if df is None or len(df) == 0:
            return StatsSummaryResponse(
                top_makes=[],
                fuel_type_distribution=[],
                price_trends_by_year=[],
                price_by_condition=[]
            )
        
        price_col = dataset_loader.get_price_column() or 'price'
        
        # Top Makes (top 10)
        top_makes_data = df['make'].value_counts().head(10)
        top_makes = [
            TopMake(make=str(make), count=int(count))
            for make, count in top_makes_data.items()
        ]
        
        # Fuel Type Distribution
        fuel_type_counts = df['fuel_type'].value_counts()
        total_cars = len(df)
        fuel_type_distribution = [
            FuelTypeStat(
                fuel_type=str(ft),
                count=int(count),
                percentage=round((count / total_cars) * 100, 2)
            )
            for ft, count in fuel_type_counts.items()
        ]
        
        # Price Trends by Year
        if price_col in df.columns:
            price_by_year = df.groupby('year')[price_col].agg(['mean', 'count']).reset_index()
            price_by_year.columns = ['year', 'average_price', 'count']
            price_trends_by_year = [
                PriceByYear(
                    year=int(row['year']),
                    average_price=round(float(row['average_price']), 2),
                    count=int(row['count'])
                )
                for _, row in price_by_year.iterrows()
            ]
            price_trends_by_year.sort(key=lambda x: x.year)
        else:
            price_trends_by_year = []
        
        # Price by Condition
        if price_col in df.columns:
            price_by_cond = df.groupby('condition')[price_col].agg(['mean', 'count']).reset_index()
            price_by_cond.columns = ['condition', 'average_price', 'count']
            price_by_condition = [
                PriceByCondition(
                    condition=str(row['condition']),
                    average_price=round(float(row['average_price']), 2),
                    count=int(row['count'])
                )
                for _, row in price_by_cond.iterrows()
            ]
            # Sort by condition quality (New -> Salvage)
            condition_order = ['New', 'Like New', 'Excellent', 'Good', 'Fair', 'Poor', 'Salvage']
            price_by_condition.sort(key=lambda x: condition_order.index(x.condition) if x.condition in condition_order else 999)
        else:
            price_by_condition = []
        
        return StatsSummaryResponse(
            top_makes=top_makes,
            fuel_type_distribution=fuel_type_distribution,
            price_trends_by_year=price_trends_by_year,
            price_by_condition=price_by_condition
        )
        
    except Exception as e:
        logger.error(f"Error getting stats summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error retrieving statistics: {str(e)}")









