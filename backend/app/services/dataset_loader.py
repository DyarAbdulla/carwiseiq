"""
Dataset loader service - loads and caches the car dataset
"""

import pandas as pd
import numpy as np
from pathlib import Path
from typing import Optional
import logging
from functools import lru_cache

from app.config import settings

logger = logging.getLogger(__name__)


class DatasetLoader:
    """Singleton class to load and cache the car dataset"""
    
    _instance = None
    _dataset: Optional[pd.DataFrame] = None
    _loaded = False
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(DatasetLoader, cls).__new__(cls)
        return cls._instance
    
    @classmethod
    def get_instance(cls):
        """Get singleton instance and ensure dataset is loaded"""
        instance = cls()
        if not instance._loaded:
            instance.load_dataset()
        return instance
    
    def load_dataset(self):
        """Load the car dataset from CSV"""
        try:
            # Check if file exists
            if not settings.DATA_FILE.exists():
                logger.error(f"Dataset file not found at: {settings.DATA_FILE}")
                logger.error(f"Please ensure the dataset file exists at one of these locations:")
                logger.error(f"  - {settings.DATA_FILE}")
                logger.error(f"  - {settings.DATA_FILE.parent.parent / 'data' / 'cleaned_car_data.csv'}")
                self._dataset = None
                self._loaded = True
                return
            
            # Check if file is readable
            if not settings.DATA_FILE.is_file():
                logger.error(f"Dataset path exists but is not a file: {settings.DATA_FILE}")
                self._dataset = None
                self._loaded = True
                return
            
            logger.info(f"Loading dataset from: {settings.DATA_FILE}")
            self._dataset = pd.read_csv(settings.DATA_FILE)
            
            # Verify dataset is not empty
            if len(self._dataset) == 0:
                logger.error("Dataset file is empty")
                self._dataset = None
                self._loaded = True
                return
            
            # Ensure price column exists (might be named differently)
            price_columns = ['price', 'Price', 'PRICE', 'predicted_price', 'target']
            price_col = None
            for col in price_columns:
                if col in self._dataset.columns:
                    price_col = col
                    break
            
            if price_col is None:
                logger.warning("No price column found in dataset")
            else:
                logger.info(f"Dataset loaded successfully: {len(self._dataset):,} rows, price column: {price_col}")
            
            # Verify required columns exist
            required_columns = ['make', 'model', 'location']
            missing_columns = [col for col in required_columns if col not in self._dataset.columns]
            if missing_columns:
                logger.warning(f"Missing columns in dataset: {missing_columns}")
            
            self._loaded = True
        except pd.errors.EmptyDataError:
            logger.error(f"Dataset file is empty or corrupted: {settings.DATA_FILE}")
            self._dataset = None
            self._loaded = True
        except pd.errors.ParserError as e:
            logger.error(f"Failed to parse dataset CSV: {e}")
            self._dataset = None
            self._loaded = True
        except PermissionError:
            logger.error(f"Permission denied reading dataset file: {settings.DATA_FILE}")
            self._dataset = None
            self._loaded = True
        except Exception as e:
            logger.error(f"Failed to load dataset: {e}", exc_info=True)
            self._dataset = None
            self._loaded = True
    
    @property
    def dataset(self) -> Optional[pd.DataFrame]:
        """Get the loaded dataset"""
        if not self._loaded:
            self.load_dataset()
        return self._dataset
    
    @property
    def is_loaded(self) -> bool:
        """Check if dataset is loaded"""
        return self._loaded
    
    def get_price_column(self) -> Optional[str]:
        """Get the name of the price column"""
        if self._dataset is None:
            return None
        
        price_columns = ['price', 'Price', 'PRICE', 'predicted_price', 'target']
        for col in price_columns:
            if col in self._dataset.columns:
                return col
        return None

