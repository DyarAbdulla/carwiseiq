"""
Currency conversion utilities
Converts: AED, USD, EUR, IQD, SAR, EGP, JOD, KWD, CAD, GBP → USD base
"""

import logging
from typing import Dict

logger = logging.getLogger(__name__)

# Exchange rates (approximate - in production, use a live API like exchangerate-api.com)
EXCHANGE_RATES: Dict[str, float] = {
    'USD': 1.0,
    'AED': 0.27,  # 1 AED = 0.27 USD
    'EUR': 1.10,
    'IQD': 0.00076,  # 1 IQD = 0.00076 USD
    'SAR': 0.27,  # 1 SAR = 0.27 USD
    'EGP': 0.032,  # 1 EGP = 0.032 USD
    'JOD': 1.41,
    'KWD': 3.25,
    'CAD': 0.74,
    'GBP': 1.27,
    'LBP': 0.000066,  # 1 LBP = 0.000066 USD
    'IQD': 0.000763,  # 1 IQD = 0.000763 USD (approximately 1 USD = 1310 IQD)
}


class CurrencyConverter:
    """Currency conversion utility"""
    
    @staticmethod
    def to_usd(amount: float, from_currency: str) -> float:
        """
        Convert amount from given currency to USD
        
        Args:
            amount: Amount to convert
            from_currency: Source currency code
            
        Returns:
            Amount in USD
        """
        if not amount or amount <= 0:
            return 0.0
        
        currency = from_currency.upper()
        rate = EXCHANGE_RATES.get(currency, 1.0)
        
        if currency not in EXCHANGE_RATES:
            logger.warning(f"Unknown currency {currency}, assuming 1:1 with USD")
        
        return amount * rate
    
    @staticmethod
    def from_usd(amount: float, to_currency: str) -> float:
        """
        Convert amount from USD to given currency
        
        Args:
            amount: Amount in USD
            to_currency: Target currency code
            
        Returns:
            Amount in target currency
        """
        if not amount or amount <= 0:
            return 0.0
        
        currency = to_currency.upper()
        rate = EXCHANGE_RATES.get(currency, 1.0)
        
        if currency not in EXCHANGE_RATES:
            logger.warning(f"Unknown currency {currency}, assuming 1:1 with USD")
        
        return amount / rate
