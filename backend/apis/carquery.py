"""
CarQuery API integration (Free)
Endpoint: http://www.carqueryapi.com/api/0.3/?cmd=getModels&make={make}
Use for: Make/model database, specs
"""

import logging
import requests
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)


class CarQueryClient:
    """Client for CarQuery API"""
    
    BASE_URL = "http://www.carqueryapi.com/api/0.3/"
    
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'CarPricePredictor/1.0',
            'Accept': 'application/json',
        })
    
    def get_models(self, make: str) -> List[Dict[str, Any]]:
        """
        Get all models for a given make
        
        Args:
            make: Car manufacturer name
            
        Returns:
            List of model dictionaries
        """
        try:
            url = f"{self.BASE_URL}?cmd=getModels&make={make}"
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            return data.get('Models', [])
            
        except requests.RequestException as e:
            logger.error(f"Error fetching models for {make}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching models for {make}: {e}")
            return []
    
    def get_trims(self, make: str, model: str, year: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Get trim levels for a make/model/year
        
        Args:
            make: Car manufacturer
            model: Car model
            year: Optional year filter
            
        Returns:
            List of trim dictionaries
        """
        try:
            url = f"{self.BASE_URL}?cmd=getTrims&make={make}&model={model}"
            if year:
                url += f"&year={year}"
            
            response = self.session.get(url, timeout=10)
            response.raise_for_status()
            
            data = response.json()
            return data.get('Trims', [])
            
        except requests.RequestException as e:
            logger.error(f"Error fetching trims for {make} {model}: {e}")
            return []
        except Exception as e:
            logger.error(f"Unexpected error fetching trims: {e}")
            return []
