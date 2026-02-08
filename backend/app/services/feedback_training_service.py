"""
Feedback Training Service
Exports feedback data for model retraining and tracks improvement metrics
"""

import sqlite3
import os
import logging
import pandas as pd
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta
import numpy as np

logger = logging.getLogger(__name__)

# Database path
DB_PATH = os.path.join(os.path.dirname(
    os.path.dirname(os.path.dirname(__file__))), "users.db")


def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def export_feedback_for_training(
    min_feedback_count: int = 10,
    min_rating: int = 1,
    include_corrected_data: bool = True
) -> pd.DataFrame:
    """
    Export feedback data as training dataset

    Args:
        min_feedback_count: Minimum number of feedback entries to export
        min_rating: Minimum rating to include (1-5)
        include_corrected_data: Whether to use corrected make/model/price from feedback

    Returns:
        DataFrame with training data ready for model training
    """
    conn = get_db()

    try:
        # Get all predictions with feedback
        query = """
            SELECT
                p.id as prediction_id,
                p.car_features,
                p.predicted_price,
                p.image_features,
                p.timestamp as prediction_timestamp,
                f.rating,
                f.is_accurate,
                f.feedback_type,
                f.feedback_reasons,
                f.correct_make,
                f.correct_model,
                f.correct_year,
                f.correct_price,
                f.other_details,
                f.timestamp as feedback_timestamp
            FROM predictions p
            INNER JOIN feedback f ON p.id = f.prediction_id
            WHERE f.rating >= ?
            ORDER BY f.timestamp DESC
        """

        cursor = conn.cursor()
        cursor.execute(query, (min_rating,))
        rows = cursor.fetchall()

        if len(rows) < min_feedback_count:
            logger.info(f"Not enough feedback data ({len(rows)} < {min_feedback_count})")
            return pd.DataFrame()

        # Convert to DataFrame
        training_data = []
        for row in rows:
            car_features = json.loads(row['car_features'])

            # Use corrected data if available and include_corrected_data is True
            if include_corrected_data:
                if row['correct_make']:
                    car_features['make'] = row['correct_make']
                if row['correct_model']:
                    car_features['model'] = row['correct_model']
                if row['correct_year']:
                    car_features['year'] = row['correct_year']

            # Determine actual price
            # If user provided correct_price, use it; otherwise use predicted_price
            actual_price = row['correct_price'] if row['correct_price'] else row['predicted_price']

            # Only include if rating indicates accuracy
            # For ratings 4-5, use predicted_price as actual_price
            # For ratings 1-3, prefer correct_price if available
            if row['rating'] >= 4:
                actual_price = row['predicted_price']
            elif row['correct_price']:
                actual_price = row['correct_price']

            training_data.append({
                'year': car_features.get('year'),
                'mileage': car_features.get('mileage'),
                'engine_size': car_features.get('engine_size'),
                'cylinders': car_features.get('cylinders'),
                'make': car_features.get('make'),
                'model': car_features.get('model'),
                'trim': car_features.get('trim'),
                'condition': car_features.get('condition'),
                'fuel_type': car_features.get('fuel_type'),
                'location': car_features.get('location'),
                'price': actual_price,
                'rating': row['rating'],
                'is_accurate': bool(row['is_accurate']) if row['is_accurate'] is not None else None,
                'feedback_type': row['feedback_type'],
                'prediction_timestamp': row['prediction_timestamp'],
                'feedback_timestamp': row['feedback_timestamp']
            })

        df = pd.DataFrame(training_data)

        # Filter out invalid data
        df = df[df['price'] > 0]
        df = df[df['price'].notna()]
        df = df[df['make'].notna()]
        df = df[df['model'].notna()]

        logger.info(f"Exported {len(df)} training samples from feedback data")
        return df

    except Exception as e:
        logger.error(f"Error exporting feedback for training: {e}", exc_info=True)
        return pd.DataFrame()
    finally:
        conn.close()


def get_improvement_metrics(
    days: int = 30
) -> Dict:
    """
    Calculate improvement metrics over time

    Args:
        days: Number of days to look back

    Returns:
        Dictionary with improvement metrics
    """
    conn = get_db()

    try:
        # Get current period metrics (last N days)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                COUNT(*) as total_feedback,
                AVG(rating) as avg_rating,
                SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as positive_percent,
                SUM(CASE WHEN is_accurate = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as accuracy_percent
            FROM feedback
            WHERE timestamp >= datetime('now', '-' || ? || ' days')
            AND rating IS NOT NULL
        """, (days,))
        current = cursor.fetchone()

        # Get previous period metrics (N days before that)
        cursor.execute("""
            SELECT
                COUNT(*) as total_feedback,
                AVG(rating) as avg_rating,
                SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as positive_percent,
                SUM(CASE WHEN is_accurate = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as accuracy_percent
            FROM feedback
            WHERE timestamp >= datetime('now', '-' || ? || ' days')
            AND timestamp < datetime('now', '-' || ? || ' days')
            AND rating IS NOT NULL
        """, (days * 2, days))
        previous = cursor.fetchone()

        # Calculate improvement
        current_accuracy = current['accuracy_percent'] or 0
        previous_accuracy = previous['accuracy_percent'] or 0

        improvement_percent = 0
        if previous_accuracy > 0:
            improvement_percent = ((current_accuracy - previous_accuracy) / previous_accuracy) * 100

        return {
            'current_period': {
                'days': days,
                'total_feedback': current['total_feedback'] or 0,
                'avg_rating': round(current['avg_rating'] or 0, 2),
                'accuracy_percent': round(current_accuracy, 2),
                'positive_percent': round(current['positive_percent'] or 0, 2)
            },
            'previous_period': {
                'total_feedback': previous['total_feedback'] or 0,
                'avg_rating': round(previous['avg_rating'] or 0, 2),
                'accuracy_percent': round(previous_accuracy, 2),
                'positive_percent': round(previous['positive_percent'] or 0, 2)
            },
            'improvement_percent': round(improvement_percent, 2),
            'improvement_absolute': round(current_accuracy - previous_accuracy, 2)
        }

    except Exception as e:
        logger.error(f"Error calculating improvement metrics: {e}", exc_info=True)
        return {
            'current_period': {'days': days, 'total_feedback': 0, 'avg_rating': 0, 'accuracy_percent': 0, 'positive_percent': 0},
            'previous_period': {'total_feedback': 0, 'avg_rating': 0, 'accuracy_percent': 0, 'positive_percent': 0},
            'improvement_percent': 0,
            'improvement_absolute': 0
        }
    finally:
        conn.close()


def get_accuracy_by_make_model() -> List[Dict]:
    """
    Get accuracy metrics grouped by make and model

    Returns:
        List of dictionaries with make, model, and accuracy metrics
    """
    conn = get_db()

    try:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT
                json_extract(p.car_features, '$.make') as make,
                json_extract(p.car_features, '$.model') as model,
                COUNT(*) as total_feedback,
                AVG(f.rating) as avg_rating,
                SUM(CASE WHEN f.rating >= 4 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as positive_percent,
                SUM(CASE WHEN f.is_accurate = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as accuracy_percent
            FROM feedback f
            JOIN predictions p ON f.prediction_id = p.id
            WHERE f.rating IS NOT NULL
            GROUP BY make, model
            HAVING COUNT(*) >= 3
            ORDER BY accuracy_percent DESC, total_feedback DESC
            LIMIT 50
        """)

        rows = cursor.fetchall()
        return [
            {
                'make': row['make'],
                'model': row['model'],
                'total_feedback': row['total_feedback'],
                'avg_rating': round(row['avg_rating'] or 0, 2),
                'accuracy_percent': round(row['accuracy_percent'] or 0, 2),
                'positive_percent': round(row['positive_percent'] or 0, 2)
            }
            for row in rows
        ]

    except Exception as e:
        logger.error(f"Error getting accuracy by make/model: {e}", exc_info=True)
        return []
    finally:
        conn.close()
