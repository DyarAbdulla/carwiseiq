"""
Data normalization service
Standardizes make/model names, currencies, units, conditions
"""

import logging
from typing import Dict, Any
from utils.currency_converter import CurrencyConverter

logger = logging.getLogger(__name__)

# Make name normalization (case-insensitive mapping)
MAKE_NORMALIZATION = {
    'toyota': 'Toyota',
    'honda': 'Honda',
    'ford': 'Ford',
    'chevrolet': 'Chevrolet',
    'nissan': 'Nissan',
    'bmw': 'BMW',
    'mercedes-benz': 'Mercedes-Benz',
    'mercedes': 'Mercedes-Benz',
    'audi': 'Audi',
    'hyundai': 'Hyundai',
    'kia': 'Kia',
    'volkswagen': 'Volkswagen',
    'vw': 'Volkswagen',
    'mazda': 'Mazda',
    'subaru': 'Subaru',
    'jeep': 'Jeep',
    'dodge': 'Dodge',
    'gmc': 'GMC',
    'lexus': 'Lexus',
    'acura': 'Acura',
    'infiniti': 'Infiniti',
    'cadillac': 'Cadillac',
    'lincoln': 'Lincoln',
    'volvo': 'Volvo',
    'porsche': 'Porsche',
    'jaguar': 'Jaguar',
    'land rover': 'Land Rover',
    'range rover': 'Range Rover',
    'mini': 'Mini',
    'fiat': 'Fiat',
    'peugeot': 'Peugeot',
    'renault': 'Renault',
    'citroen': 'Citroen',
    'opel': 'Opel',
    'skoda': 'Skoda',
    'seat': 'Seat',
    'alfa romeo': 'Alfa Romeo',
    'mitsubishi': 'Mitsubishi',
    'suzuki': 'Suzuki',
}


class DataNormalizer:
    """Normalizes car data to standard formats"""
    
    @staticmethod
    def normalize_make(make: str) -> str:
        """Normalize make name to standard format"""
        if not make:
            return ''
        
        make_lower = make.lower().strip()
        normalized = MAKE_NORMALIZATION.get(make_lower, make.title())
        
        if normalized != make:
            logger.debug(f"Normalized make: '{make}' -> '{normalized}'")
        
        return normalized
    
    @staticmethod
    def normalize_model(model: str) -> str:
        """Normalize model name (capitalize properly)"""
        if not model:
            return ''
        
        # Simple title case normalization
        normalized = ' '.join(word.capitalize() for word in model.strip().split())
        return normalized
    
    @staticmethod
    def normalize_condition(condition: str) -> str:
        """Normalize condition to standard values"""
        if not condition:
            return 'Good'
        
        condition_lower = condition.lower().strip()
        condition_mapping = {
            'new': 'New',
            'like new': 'Like New',
            'like-new': 'Like New',
            'excellent': 'Excellent',
            'very good': 'Excellent',
            'good': 'Good',
            'fair': 'Fair',
            'poor': 'Poor',
            'salvage': 'Salvage',
        }
        
        for key, value in condition_mapping.items():
            if key in condition_lower:
                return value
        
        return 'Good'  # Default
    
    @staticmethod
    def normalize_fuel_type(fuel_type: str) -> str:
        """Normalize fuel type to standard values"""
        if not fuel_type:
            return 'Gasoline'
        
        fuel_lower = fuel_type.lower().strip()
        fuel_mapping = {
            'plug-in hybrid': 'Plug-in Hybrid',
            'phev': 'Plug-in Hybrid',
            'hybrid': 'Hybrid',
            'electric': 'Electric',
            'ev': 'Electric',
            'gasoline': 'Gasoline',
            'gas': 'Gasoline',
            'petrol': 'Gasoline',
            'diesel': 'Diesel',
        }
        
        for key, value in fuel_mapping.items():
            if key in fuel_lower:
                return value
        
        return 'Gasoline'  # Default
    
    @staticmethod
    def normalize_currency(data: Dict[str, Any]) -> Dict[str, Any]:
        """Convert price to USD if needed"""
        price = data.get('price')
        currency = data.get('currency', 'USD')
        
        if price and currency and currency.upper() != 'USD':
            # Convert to USD
            price_usd = CurrencyConverter.to_usd(price, currency)
            data['price_usd'] = price_usd
            data['original_price'] = price
            data['original_currency'] = currency
            logger.debug(f"Converted {price} {currency} to {price_usd} USD")
        
        return data
    
    @staticmethod
    def normalize_mileage(data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize mileage (ensure it's in km)"""
        mileage = data.get('mileage')
        
        # If mileage is very high (> 1 million), might be in meters, divide by 1000
        if mileage and mileage > 1000000:
            mileage = mileage / 1000
            data['mileage'] = mileage
            logger.debug(f"Adjusted mileage from {mileage * 1000} to {mileage} km")
        
        return data
    
    @classmethod
    def normalize(cls, data: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize all fields in car data"""
        normalized = data.copy()
        
        # Normalize make/model
        if 'make' in normalized:
            normalized['make'] = cls.normalize_make(normalized['make'])
        if 'model' in normalized:
            normalized['model'] = cls.normalize_model(normalized['model'])
        
        # Normalize condition
        if 'condition' in normalized:
            normalized['condition'] = cls.normalize_condition(normalized['condition'])
        
        # Normalize fuel type
        if 'fuel_type' in normalized:
            normalized['fuel_type'] = cls.normalize_fuel_type(normalized['fuel_type'])
        
        # Normalize currency
        normalized = cls.normalize_currency(normalized)
        
        # Normalize mileage
        normalized = cls.normalize_mileage(normalized)
        
        return normalized
