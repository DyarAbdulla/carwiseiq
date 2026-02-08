"""
Model Retraining Service
Retrains the model using accumulated feedback data
"""

import os
import sys
import logging
import pandas as pd
from typing import Optional, Dict, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

# Add paths for imports
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.services.feedback_training_service import export_feedback_for_training
from app.services.dataset_loader import DatasetLoader


def retrain_model_with_feedback(
    min_feedback_samples: int = 50,
    combine_with_main_dataset: bool = True,
    feedback_weight: float = 1.5
) -> Dict:
    """
    Retrain model using feedback data

    Args:
        min_feedback_samples: Minimum number of feedback samples required
        combine_with_main_dataset: Whether to combine feedback data with main dataset
        feedback_weight: Weight multiplier for feedback samples (higher = more importance)

    Returns:
        Dictionary with retraining results
    """
    try:
        logger.info("Starting model retraining with feedback data...")

        # Export feedback data
        feedback_df = export_feedback_for_training(
            min_feedback_count=min_feedback_samples,
            min_rating=1,
            include_corrected_data=True
        )

        if len(feedback_df) < min_feedback_samples:
            return {
                'success': False,
                'message': f'Not enough feedback samples ({len(feedback_df)} < {min_feedback_samples})',
                'feedback_samples': len(feedback_df),
                'required_samples': min_feedback_samples
            }

        logger.info(f"Exported {len(feedback_df)} feedback samples")

        # Load main dataset if combining
        combined_df = None
        if combine_with_main_dataset:
            try:
                dataset_loader = DatasetLoader.get_instance()
                main_df = dataset_loader.dataset

                if main_df is not None and len(main_df) > 0:
                    # Combine datasets
                    # Weight feedback samples by duplicating them
                    feedback_weighted = pd.concat([feedback_df] * int(feedback_weight))

                    # Ensure columns match
                    main_price_col = dataset_loader.get_price_column()
                    if main_price_col and main_price_col in main_df.columns:
                        main_df_renamed = main_df.rename(columns={main_price_col: 'price'})
                        combined_df = pd.concat([main_df_renamed, feedback_weighted], ignore_index=True)
                    else:
                        combined_df = feedback_weighted

                    logger.info(f"Combined dataset: {len(combined_df)} samples ({len(main_df)} main + {len(feedback_weighted)} feedback)")
                else:
                    combined_df = feedback_df
                    logger.warning("Main dataset not available, using only feedback data")
            except Exception as e:
                logger.warning(f"Could not load main dataset: {e}, using only feedback data")
                combined_df = feedback_df
        else:
            combined_df = feedback_df

        # Save combined dataset for training
        training_data_path = os.path.join(BASE_DIR, 'data', 'feedback_training_data.csv')
        os.makedirs(os.path.dirname(training_data_path), exist_ok=True)
        combined_df.to_csv(training_data_path, index=False)
        logger.info(f"Saved training data to {training_data_path}")

        # Call model training script
        # Note: This would typically be done via subprocess or direct import
        # For now, we'll return instructions
        return {
            'success': True,
            'message': f'Training data prepared with {len(combined_df)} samples',
            'feedback_samples': len(feedback_df),
            'total_samples': len(combined_df),
            'training_data_path': training_data_path,
            'next_step': 'Run model training script with feedback_training_data.csv'
        }

    except Exception as e:
        logger.error(f"Error retraining model with feedback: {e}", exc_info=True)
        return {
            'success': False,
            'message': f'Error during retraining: {str(e)}',
            'error': str(e)
        }


def should_retrain_model(
    min_feedback_since_last_training: int = 50,
    days_since_last_training: int = 7
) -> Tuple[bool, str]:
    """
    Determine if model should be retrained

    Args:
        min_feedback_since_last_training: Minimum new feedback entries required
        days_since_last_training: Days since last training

    Returns:
        Tuple of (should_retrain: bool, reason: str)
    """
    try:
        from app.services.feedback_training_service import get_db

        conn = get_db()
        cursor = conn.cursor()

        # Check feedback count since last training
        # (We'll use a simple heuristic: feedback in last N days)
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM feedback
            WHERE timestamp >= datetime('now', '-' || ? || ' days')
            AND rating IS NOT NULL
        """, (days_since_last_training,))

        result = cursor.fetchone()
        feedback_count = result['count'] if result else 0

        conn.close()

        if feedback_count >= min_feedback_since_last_training:
            return True, f"{feedback_count} new feedback entries in last {days_since_last_training} days"

        return False, f"Only {feedback_count} feedback entries (need {min_feedback_since_last_training})"

    except Exception as e:
        logger.error(f"Error checking if should retrain: {e}")
        return False, f"Error checking: {str(e)}"
