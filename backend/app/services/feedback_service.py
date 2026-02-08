"""
Feedback service for prediction accuracy tracking and model improvement
"""

import sqlite3
import os
import logging
from typing import Optional, Dict, List, Tuple
from datetime import datetime
import json

logger = logging.getLogger(__name__)

# Database path (same as auth service)
DB_PATH = os.path.join(os.path.dirname(
    os.path.dirname(os.path.dirname(__file__))), "users.db")


def get_db():
    """Get database connection"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_feedback_db():
    """Initialize database with feedback tables"""
    conn = get_db()
    cursor = conn.cursor()

    # Create predictions table (stores prediction attempts)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            car_features TEXT NOT NULL,  -- JSON string of CarFeatures
            predicted_price REAL NOT NULL,
            confidence_interval_lower REAL,
            confidence_interval_upper REAL,
            confidence_level TEXT,
            image_features TEXT,  -- JSON array of floats
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    """)

    # Create feedback table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            prediction_id INTEGER NOT NULL,
            user_id INTEGER,
            rating INTEGER CHECK(rating >= 1 AND rating <= 5),
            is_accurate BOOLEAN,
            feedback_type TEXT,  -- 'accurate', 'inaccurate', 'partial'
            feedback_reasons TEXT,  -- JSON array of reasons
            correct_make TEXT,
            correct_model TEXT,
            correct_year INTEGER,
            correct_price REAL,
            other_details TEXT,  -- Text field for "Other" feedback
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        )
    """)

    # Create indexes for better query performance
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_predictions_timestamp ON predictions(timestamp)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_feedback_prediction_id ON feedback(prediction_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_feedback_rating ON feedback(rating)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_feedback_timestamp ON feedback(timestamp)
    """)

    conn.commit()
    conn.close()
    logger.info("Feedback database initialized")


def save_prediction(
    car_features: Dict,
    predicted_price: float,
    user_id: Optional[int] = None,
    confidence_interval: Optional[Dict[str, float]] = None,
    confidence_level: Optional[str] = None,
    image_features: Optional[List[float]] = None
) -> int:
    """
    Save a prediction attempt
    Returns prediction_id
    """
    conn = get_db()
    cursor = conn.cursor()

    try:
        cursor.execute("""
            INSERT INTO predictions (
                user_id, car_features, predicted_price,
                confidence_interval_lower, confidence_interval_upper,
                confidence_level, image_features
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            json.dumps(car_features),
            predicted_price,
            confidence_interval.get('lower') if confidence_interval else None,
            confidence_interval.get('upper') if confidence_interval else None,
            confidence_level,
            json.dumps(image_features) if image_features else None
        ))

        prediction_id = cursor.lastrowid
        conn.commit()
        return prediction_id
    except Exception as e:
        conn.rollback()
        logger.error(f"Error saving prediction: {e}")
        raise
    finally:
        conn.close()


def save_feedback(
    prediction_id: int,
    rating: Optional[int] = None,
    is_accurate: Optional[bool] = None,
    feedback_type: Optional[str] = None,
    feedback_reasons: Optional[List[str]] = None,
    correct_make: Optional[str] = None,
    correct_model: Optional[str] = None,
    correct_year: Optional[int] = None,
    correct_price: Optional[float] = None,
    other_details: Optional[str] = None,
    user_id: Optional[int] = None
) -> int:
    """
    Save feedback for a prediction
    Returns feedback_id
    """
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Check if feedback already exists for this prediction
        cursor.execute("""
            SELECT id FROM feedback WHERE prediction_id = ?
        """, (prediction_id,))
        existing = cursor.fetchone()

        if existing:
            # Update existing feedback
            cursor.execute("""
                UPDATE feedback SET
                    rating = COALESCE(?, rating),
                    is_accurate = COALESCE(?, is_accurate),
                    feedback_type = COALESCE(?, feedback_type),
                    feedback_reasons = COALESCE(?, feedback_reasons),
                    correct_make = COALESCE(?, correct_make),
                    correct_model = COALESCE(?, correct_model),
                    correct_year = COALESCE(?, correct_year),
                    correct_price = COALESCE(?, correct_price),
                    other_details = COALESCE(?, other_details),
                    updated_at = CURRENT_TIMESTAMP
                WHERE prediction_id = ?
            """, (
                rating, is_accurate, feedback_type,
                json.dumps(feedback_reasons) if feedback_reasons else None,
                correct_make, correct_model, correct_year, correct_price,
                other_details, prediction_id
            ))
            feedback_id = existing['id']
        else:
            # Insert new feedback
            cursor.execute("""
                INSERT INTO feedback (
                    prediction_id, user_id, rating, is_accurate,
                    feedback_type, feedback_reasons,
                    correct_make, correct_model, correct_year, correct_price,
                    other_details
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                prediction_id, user_id, rating, is_accurate,
                feedback_type,
                json.dumps(feedback_reasons) if feedback_reasons else None,
                correct_make, correct_model, correct_year, correct_price,
                other_details
            ))
            feedback_id = cursor.lastrowid

        conn.commit()
        return feedback_id
    except Exception as e:
        conn.rollback()
        logger.error(f"Error saving feedback: {e}")
        raise
    finally:
        conn.close()


def get_user_predictions(
    user_id: Optional[int] = None,
    limit: int = 50,
    offset: int = 0
) -> List[Dict]:
    """Get prediction history for a user (or all if user_id is None)"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        if user_id:
            cursor.execute("""
                SELECT
                    p.id, p.car_features, p.predicted_price,
                    p.confidence_interval_lower, p.confidence_interval_upper,
                    p.confidence_level, p.timestamp,
                    f.rating, f.is_accurate, f.feedback_type,
                    f.feedback_reasons, f.correct_make, f.correct_model,
                    f.correct_price, f.updated_at as feedback_updated_at
                FROM predictions p
                LEFT JOIN feedback f ON p.id = f.prediction_id
                WHERE p.user_id = ?
                ORDER BY p.timestamp DESC
                LIMIT ? OFFSET ?
            """, (user_id, limit, offset))
        else:
            # For anonymous users, use session-based tracking (would need session_id)
            # For now, return empty list
            logger.info("No user_id provided, returning empty prediction history")
            return []

        rows = cursor.fetchall()
        results = []
        for row in rows:
            try:
                car_features = json.loads(row['car_features']) if row['car_features'] else {}
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse car_features for prediction {row['id']}")
                car_features = {}
            
            try:
                feedback_reasons = json.loads(row['feedback_reasons']) if row['feedback_reasons'] else None
            except json.JSONDecodeError:
                logger.warning(f"Failed to parse feedback_reasons for prediction {row['id']}")
                feedback_reasons = None
            
            results.append({
                'id': row['id'],
                'car_features': car_features,
                'predicted_price': row['predicted_price'],
                'confidence_interval': {
                    'lower': row['confidence_interval_lower'],
                    'upper': row['confidence_interval_upper']
                } if row['confidence_interval_lower'] is not None else None,
                'confidence_level': row['confidence_level'],
                'timestamp': row['timestamp'],
                'feedback': {
                    'rating': row['rating'],
                    'is_accurate': bool(row['is_accurate']) if row['is_accurate'] is not None else None,
                    'feedback_type': row['feedback_type'],
                    'feedback_reasons': feedback_reasons,
                    'correct_make': row['correct_make'],
                    'correct_model': row['correct_model'],
                    'correct_price': row['correct_price'],
                    'updated_at': row['feedback_updated_at']
                } if row['rating'] is not None else None
            })

        logger.info(f"Retrieved {len(results)} predictions for user {user_id}")
        return results
    except Exception as e:
        logger.error(f"Error getting user predictions: {e}", exc_info=True)
        raise
    finally:
        conn.close()


def get_feedback_metrics() -> Dict:
    """Get overall feedback metrics for model improvement tracking"""
    conn = get_db()
    cursor = conn.cursor()

    try:
        # Overall accuracy
        cursor.execute("""
            SELECT
                COUNT(*) as total_feedback,
                AVG(rating) as avg_rating,
                SUM(CASE WHEN is_accurate = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as accuracy_percent,
                SUM(CASE WHEN rating >= 4 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as positive_feedback_percent
            FROM feedback
            WHERE rating IS NOT NULL
        """)
        overall = cursor.fetchone()

        # Accuracy by make
        cursor.execute("""
            SELECT
                json_extract(p.car_features, '$.make') as make,
                COUNT(*) as count,
                AVG(f.rating) as avg_rating,
                SUM(CASE WHEN f.is_accurate = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as accuracy_percent
            FROM feedback f
            JOIN predictions p ON f.prediction_id = p.id
            WHERE f.rating IS NOT NULL
            GROUP BY make
            ORDER BY count DESC
            LIMIT 20
        """)
        by_make = cursor.fetchall()

        # Improvement trend (last 30 days)
        cursor.execute("""
            SELECT
                DATE(f.timestamp) as date,
                AVG(f.rating) as avg_rating,
                SUM(CASE WHEN f.is_accurate = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as accuracy_percent
            FROM feedback f
            WHERE f.timestamp >= datetime('now', '-30 days')
            GROUP BY DATE(f.timestamp)
            ORDER BY date DESC
        """)
        trend = cursor.fetchall()

        # Calculate improvement percentage (last 30 days vs previous 30 days)
        from app.services.feedback_training_service import get_improvement_metrics
        improvement = get_improvement_metrics(days=30)

        return {
            'overall': {
                'total_feedback': overall['total_feedback'] or 0,
                'avg_rating': round(overall['avg_rating'] or 0, 2),
                'accuracy_percent': round(overall['accuracy_percent'] or 0, 2),
                'positive_feedback_percent': round(overall['positive_feedback_percent'] or 0, 2)
            },
            'by_make': [
                {
                    'make': row['make'],
                    'count': row['count'],
                    'avg_rating': round(row['avg_rating'] or 0, 2),
                    'accuracy_percent': round(row['accuracy_percent'] or 0, 2)
                }
                for row in by_make
            ],
            'trend': [
                {
                    'date': row['date'],
                    'avg_rating': round(row['avg_rating'] or 0, 2),
                    'accuracy_percent': round(row['accuracy_percent'] or 0, 2)
                }
                for row in trend
            ],
            'improvement': improvement
        }
    except Exception as e:
        logger.error(f"Error getting feedback metrics: {e}")
        raise
    finally:
        conn.close()
