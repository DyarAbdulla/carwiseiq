"""
VIN Decoder using NHTSA API
Decodes Vehicle Identification Numbers to get car specifications
"""

import requests
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

NHTSA_API_BASE = "https://vpic.nhtsa.dot.gov/api/vehicles"


class VINDecoder:
    """VIN decoder using NHTSA API"""
    
    @staticmethod
    def decode(vin: str) -> Dict[str, Any]:
        """
        Decode VIN using NHTSA API
        
        Args:
            vin: 17-character Vehicle Identification Number
            
        Returns:
            Dictionary with decoded vehicle information
        """
        try:
            # Validate VIN format (17 characters, alphanumeric)
            vin = vin.strip().upper()
            if len(vin) != 17:
                raise ValueError("VIN must be exactly 17 characters")
            
            if not vin.replace('I', '').replace('O', '').replace('Q', '').isalnum():
                raise ValueError("VIN contains invalid characters (I, O, Q not allowed)")
            
            # Call NHTSA API
            url = f"{NHTSA_API_BASE}/DecodeVin/{vin}?format=json"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            results = data.get('Results', [])
            
            if not results:
                raise ValueError("No data returned from NHTSA API")
            
            # Parse results into structured format
            decoded = {}
            for result in results:
                variable = result.get('Variable', '')
                value = result.get('Value', '')
                
                if value and value != 'Not Applicable' and value != 'Not Provided':
                    # Map NHTSA variables to our format
                    if 'Make' in variable:
                        decoded['make'] = value
                    elif 'Model' in variable and 'Model Year' not in variable:
                        decoded['model'] = value
                    elif 'Model Year' in variable:
                        try:
                            decoded['year'] = int(value)
                        except (ValueError, TypeError):
                            pass
                    elif 'Engine Model' in variable:
                        decoded['engine'] = value
                    elif 'Fuel Type - Primary' in variable:
                        fuel_map = {
                            'Gasoline': 'Gasoline',
                            'Diesel': 'Diesel',
                            'Electric': 'Electric',
                            'Hybrid': 'Hybrid',
                        }
                        decoded['fuel_type'] = fuel_map.get(value, 'Gasoline')
                    elif 'Displacement (L)' in variable:
                        try:
                            decoded['engine_size'] = float(value.replace('L', '').strip())
                        except (ValueError, TypeError):
                            pass
                    elif 'Number of Cylinders' in variable:
                        try:
                            decoded['cylinders'] = int(value)
                        except (ValueError, TypeError):
                            pass
            
            # Set defaults for missing values
            decoded.setdefault('fuel_type', 'Gasoline')
            decoded.setdefault('engine_size', 2.0)
            decoded.setdefault('cylinders', 4)
            
            return {
                'success': True,
                'vin': vin,
                'data': decoded,
            }
            
        except requests.RequestException as e:
            logger.error(f"Error calling NHTSA API: {e}")
            raise ValueError(f"Failed to decode VIN: {str(e)}")
        except Exception as e:
            logger.error(f"Error decoding VIN {vin}: {e}")
            raise ValueError(f"Error decoding VIN: {str(e)}")
