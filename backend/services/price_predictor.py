"""
Price prediction service using ML model
Uses scikit-learn RandomForestRegressor
"""

import logging
import os
import pickle
from typing import Dict, Any, Optional
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import LabelEncoder
import pandas as pd

logger = logging.getLogger(__name__)


class PricePredictor:
    """ML-based price prediction service"""
    
    def __init__(self, model_path: Optional[str] = None):
        """
        Initialize price predictor
        
        Args:
            model_path: Path to pre-trained model file (optional)
        """
        self.model = None
        self.label_encoders = {}
        self.feature_names = []
        
        if model_path and os.path.exists(model_path):
            self.load_model(model_path)
        else:
            # Create a simple model with sample data for demo
            self._create_sample_model()
    
    def _create_sample_model(self):
        """Create a sample model with dummy data for demonstration"""
        try:
            # Generate sample training data
            np.random.seed(42)
            n_samples = 1000
            
            makes = ['Toyota', 'Honda', 'Ford', 'BMW', 'Mercedes-Benz']
            conditions = ['New', 'Like New', 'Excellent', 'Good', 'Fair']
            fuel_types = ['Gasoline', 'Diesel', 'Hybrid', 'Electric']
            
            X_data = {
                'year': np.random.randint(2015, 2024, n_samples),
                'mileage': np.random.randint(0, 200000, n_samples),
                'make': np.random.choice(makes, n_samples),
                'condition': np.random.choice(conditions, n_samples),
                'fuel_type': np.random.choice(fuel_types, n_samples),
                'engine_size': np.random.uniform(1.5, 5.0, n_samples),
                'cylinders': np.random.choice([4, 6, 8], n_samples),
            }
            
            # Generate prices based on features (simple formula for demo)
            base_prices = {'Toyota': 25000, 'Honda': 28000, 'Ford': 27000, 'BMW': 45000, 'Mercedes-Benz': 50000}
            condition_multipliers = {'New': 1.0, 'Like New': 0.9, 'Excellent': 0.8, 'Good': 0.7, 'Fair': 0.6}
            
            y_data = []
            for i in range(n_samples):
                base = base_prices.get(X_data['make'][i], 30000)
                condition_mult = condition_multipliers.get(X_data['condition'][i], 0.7)
                year_mult = 1.0 - (2024 - X_data['year'][i]) * 0.1
                mileage_mult = 1.0 - (X_data['mileage'][i] / 200000) * 0.3
                price = base * condition_mult * year_mult * mileage_mult * np.random.uniform(0.9, 1.1)
                y_data.append(max(price, 5000))  # Minimum price
            
            # Convert to DataFrame
            df = pd.DataFrame(X_data)
            
            # Encode categorical variables
            for col in ['make', 'condition', 'fuel_type']:
                le = LabelEncoder()
                df[col + '_encoded'] = le.fit_transform(df[col])
                self.label_encoders[col] = le
            
            # Prepare features
            feature_cols = ['year', 'mileage', 'make_encoded', 'condition_encoded', 
                          'fuel_type_encoded', 'engine_size', 'cylinders']
            X = df[feature_cols].values
            y = np.array(y_data)
            
            # Train model
            self.model = RandomForestRegressor(n_estimators=100, random_state=42, n_jobs=-1)
            self.model.fit(X, y)
            self.feature_names = feature_cols
            
            logger.info("Sample price prediction model created and trained")
            
        except Exception as e:
            logger.error(f"Error creating sample model: {e}")
            self.model = None
    
    def load_model(self, model_path: str):
        """Load pre-trained model from file"""
        try:
            with open(model_path, 'rb') as f:
                model_data = pickle.load(f)
                self.model = model_data['model']
                self.label_encoders = model_data['label_encoders']
                self.feature_names = model_data['feature_names']
            logger.info(f"Loaded price prediction model from {model_path}")
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            self._create_sample_model()
    
    def predict(self, car_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict price for car data
        
        Args:
            car_data: Dictionary with car features
            
        Returns:
            Dictionary with:
            - predicted_price: float
            - confidence: float (0-100)
            - price_range: dict with min/max
        """
        if not self.model:
            # Fallback to simple estimation
            return self._simple_estimate(car_data)
        
        try:
            # Prepare features
            features = self._prepare_features(car_data)
            
            # Make prediction
            predicted_price = self.model.predict([features])[0]
            predicted_price = max(predicted_price, 1000)  # Minimum price
            
            # Get prediction intervals (using feature importances as proxy for uncertainty)
            # In production, use proper confidence intervals
            std_dev = predicted_price * 0.15  # 15% standard deviation
            price_range = {
                'min': max(predicted_price - 2 * std_dev, predicted_price * 0.7),
                'max': predicted_price + 2 * std_dev
            }
            
            # Calculate confidence (higher for newer, lower mileage cars)
            confidence = self._calculate_confidence(car_data)
            
            return {
                'predicted_price': float(predicted_price),
                'confidence': confidence,
                'price_range': price_range,
            }
            
        except Exception as e:
            logger.error(f"Error making prediction: {e}")
            return self._simple_estimate(car_data)
    
    def _prepare_features(self, car_data: Dict[str, Any]) -> list:
        """Prepare feature vector for model"""
        features = []
        
        # Numerical features
        features.append(car_data.get('year', 2020))
        features.append(car_data.get('mileage', 50000))
        features.append(car_data.get('engine_size', 2.0))
        features.append(car_data.get('cylinders', 4))
        
        # Categorical features (encoded)
        for col in ['make', 'condition', 'fuel_type']:
            value = car_data.get(col, '')
            le = self.label_encoders.get(col)
            if le:
                try:
                    encoded = le.transform([value])[0]
                except ValueError:
                    # Unknown category, use most common
                    encoded = 0
            else:
                encoded = 0
            features.append(encoded)
        
        return features
    
    def _calculate_confidence(self, car_data: Dict[str, Any]) -> float:
        """Calculate confidence score (0-100)"""
        year = car_data.get('year', 2020)
        mileage = car_data.get('mileage', 50000)
        
        # Higher confidence for newer cars with lower mileage
        year_score = min(100, (year - 2010) / 14 * 30 + 70)  # 70-100 based on year
        mileage_score = max(50, 100 - (mileage / 200000) * 50)  # 50-100 based on mileage
        
        confidence = (year_score + mileage_score) / 2
        return min(100, max(50, confidence))
    
    def _simple_estimate(self, car_data: Dict[str, Any]) -> Dict[str, Any]:
        """Simple price estimation fallback"""
        base_prices = {
            'Toyota': 25000, 'Honda': 28000, 'Ford': 27000,
            'BMW': 45000, 'Mercedes-Benz': 50000, 'Audi': 42000,
        }
        
        make = car_data.get('make', '')
        base = base_prices.get(make, 30000)
        
        year = car_data.get('year', 2020)
        mileage = car_data.get('mileage', 50000)
        condition = car_data.get('condition', 'Good')
        
        condition_mult = {
            'New': 1.0, 'Like New': 0.9, 'Excellent': 0.8,
            'Good': 0.7, 'Fair': 0.6, 'Poor': 0.5,
        }.get(condition, 0.7)
        
        year_mult = 1.0 - (2024 - year) * 0.08
        mileage_mult = 1.0 - (mileage / 200000) * 0.3
        
        predicted_price = base * condition_mult * year_mult * mileage_mult
        predicted_price = max(predicted_price, 5000)
        
        return {
            'predicted_price': float(predicted_price),
            'confidence': 60.0,
            'price_range': {
                'min': predicted_price * 0.8,
                'max': predicted_price * 1.2,
            },
        }
