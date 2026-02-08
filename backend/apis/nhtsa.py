"""
NHTSA API integration (Free - No API key needed)
Endpoint: https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVin/{VIN}?format=json
Use for: VIN decoding, vehicle specs
"""

import logging
import requests
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class NHTSAClient:
    """Client for NHTSA Vehicle API"""
    
    BASE_URL = "https://vpic.nhtsa.dot.gov/api/vehicles"
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'CarPricePredictor/1.0',
            'Accept': 'application/json',
        })
    
    def decode_vin(self, vin: str) -> Dict[str, Any]:
        """
        Decode VIN to get vehicle specifications
        
        Args:
            vin: Vehicle Identification Number (17 characters)
            
        Returns:
            Dictionary with vehicle data:
            - make: str
            - model: str
            - year: int
            - engine: str
            - fuel_type: str
            - etc.
        """
        try:
            url = f"{self.BASE_URL}/DecodeVin/{vin}?format=json"
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            results = data.get('Results', [])
            
            decoded_data = {}
            for result in results:
                variable = result.get('Variable')
                value = result.get('Value')
                
                if variable and value and value != 'Not Applicable':
                    if 'Make' in variable:
                        decoded_data['make'] = value
                    elif 'Model' in variable:
                        decoded_data['model'] = value
                    elif 'Model Year' in variable:
                        try:
                            decoded_data['year'] = int(value)
                        except ValueError:
                            pass
                    elif 'Fuel Type' in variable or 'Fuel Type - Primary' in variable:
                        decoded_data['fuel_type'] = value
                    elif 'Engine' in variable:
                        decoded_data['engine'] = value
                    elif 'Cylinders' in variable:
                        try:
                            decoded_data['cylinders'] = int(value)
                        except ValueError:
                            pass
            
            return decoded_data
            
        except requests.RequestException as e:
            logger.error(f"Error decoding VIN {vin}: {e}")
            return {}
        except Exception as e:
            logger.error(f"Unexpected error decoding VIN {vin}: {e}")
            return {}
