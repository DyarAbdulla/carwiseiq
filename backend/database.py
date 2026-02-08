"""
SQLite database for storing search history and price predictions
Tables: searches, cars
"""

import sqlite3
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from contextlib import contextmanager

logger = logging.getLogger(__name__)

# Database file path
DB_PATH = Path(__file__).parent / 'car_predictions.db'


class Database:
    """SQLite database manager for car predictions"""
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or str(DB_PATH)
        self._init_database()
    
    def _init_database(self):
        """Initialize database tables if they don't exist"""
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                # Create searches table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS searches (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        url TEXT NOT NULL,
                        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                        success BOOLEAN DEFAULT 1,
                        user_ip TEXT,
                        platform TEXT,
                        error_message TEXT
                    )
                ''')
                
                # Create cars table
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS cars (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        search_id INTEGER,
                        make TEXT,
                        model TEXT,
                        year INTEGER,
                        mileage REAL,
                        price REAL,
                        predicted_price REAL,
                        listing_price REAL,
                        platform TEXT,
                        currency TEXT,
                        condition TEXT,
                        fuel_type TEXT,
                        location TEXT,
                        confidence REAL,
                        deal_quality TEXT,
                        FOREIGN KEY (search_id) REFERENCES searches(id)
                    )
                ''')
                
                # Create indexes for faster queries
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_searches_timestamp ON searches(timestamp)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_searches_platform ON searches(platform)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_cars_search_id ON cars(search_id)')
                cursor.execute('CREATE INDEX IF NOT EXISTS idx_cars_make_model_year ON cars(make, model, year)')
                
                conn.commit()
                logger.info("Database initialized successfully")
        except Exception as e:
            logger.error(f"Error initializing database: {e}")
            raise
    
    @contextmanager
    def _get_connection(self):
        """Get database connection with context manager"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Return rows as dictionaries
        try:
            yield conn
        finally:
            conn.close()
    
    def save_search(self, url: str, result: Dict[str, Any], user_ip: str = None, error: str = None) -> int:
        """
        Save a search result to database
        
        Args:
            url: URL that was searched
            result: Prediction result data
            user_ip: User IP address (optional)
            error: Error message if search failed
            
        Returns:
            search_id: ID of the saved search
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                # Insert search record
                success = error is None
                platform = result.get('platform') if result else None
                
                cursor.execute('''
                    INSERT INTO searches (url, success, user_ip, platform, error_message)
                    VALUES (?, ?, ?, ?, ?)
                ''', (url, success, user_ip, platform, error))
                
                search_id = cursor.lastrowid
                
                # Insert car data if search was successful
                if success and result:
                    car_data = result.get('data') if 'data' in result else result
                    
                    cursor.execute('''
                        INSERT INTO cars (
                            search_id, make, model, year, mileage, price, predicted_price,
                            listing_price, platform, currency, condition, fuel_type,
                            location, confidence, deal_quality
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (
                        search_id,
                        car_data.get('make'),
                        car_data.get('model'),
                        car_data.get('year'),
                        car_data.get('mileage'),
                        car_data.get('price'),
                        car_data.get('predicted_price'),
                        car_data.get('listing_price'),
                        car_data.get('platform'),
                        car_data.get('currency', 'USD'),
                        car_data.get('condition'),
                        car_data.get('fuel_type'),
                        car_data.get('location'),
                        car_data.get('confidence'),
                        car_data.get('deal_quality'),
                    ))
                
                conn.commit()
                logger.info(f"Saved search {search_id} to database")
                return search_id
                
        except Exception as e:
            logger.error(f"Error saving search to database: {e}")
            raise
    
    def get_search_history(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Get search history
        
        Args:
            limit: Maximum number of results
            offset: Offset for pagination
            
        Returns:
            List of search records with car data
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                cursor.execute('''
                    SELECT 
                        s.id, s.url, s.timestamp, s.success, s.platform, s.error_message,
                        c.make, c.model, c.year, c.predicted_price, c.listing_price,
                        c.condition, c.fuel_type, c.location, c.confidence
                    FROM searches s
                    LEFT JOIN cars c ON s.id = c.search_id
                    ORDER BY s.timestamp DESC
                    LIMIT ? OFFSET ?
                ''', (limit, offset))
                
                rows = cursor.fetchall()
                results = []
                
                for row in rows:
                    results.append({
                        'id': row['id'],
                        'url': row['url'],
                        'timestamp': row['timestamp'],
                        'success': bool(row['success']),
                        'platform': row['platform'],
                        'error_message': row['error_message'],
                        'car': {
                            'make': row['make'],
                            'model': row['model'],
                            'year': row['year'],
                            'predicted_price': row['predicted_price'],
                            'listing_price': row['listing_price'],
                            'condition': row['condition'],
                            'fuel_type': row['fuel_type'],
                            'location': row['location'],
                            'confidence': row['confidence'],
                        } if row['make'] else None,
                    })
                
                return results
                
        except Exception as e:
            logger.error(f"Error getting search history: {e}")
            return []
    
    def get_price_trends(self, make: str, model: str, year: Optional[int] = None) -> Dict[str, Any]:
        """
        Get price trends for a specific make/model/year
        
        Args:
            make: Car make
            model: Car model
            year: Car year (optional)
            
        Returns:
            Dictionary with price statistics
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                if year:
                    cursor.execute('''
                        SELECT 
                            AVG(predicted_price) as avg_price,
                            MIN(predicted_price) as min_price,
                            MAX(predicted_price) as max_price,
                            COUNT(*) as count
                        FROM cars
                        WHERE make = ? AND model = ? AND year = ?
                        AND predicted_price IS NOT NULL
                    ''', (make, model, year))
                else:
                    cursor.execute('''
                        SELECT 
                            AVG(predicted_price) as avg_price,
                            MIN(predicted_price) as min_price,
                            MAX(predicted_price) as max_price,
                            COUNT(*) as count
                        FROM cars
                        WHERE make = ? AND model = ?
                        AND predicted_price IS NOT NULL
                    ''', (make, model))
                
                row = cursor.fetchone()
                
                if row and row['count'] > 0:
                    return {
                        'make': make,
                        'model': model,
                        'year': year,
                        'avg_price': row['avg_price'],
                        'min_price': row['min_price'],
                        'max_price': row['max_price'],
                        'count': row['count'],
                    }
                else:
                    return {
                        'make': make,
                        'model': model,
                        'year': year,
                        'avg_price': None,
                        'min_price': None,
                        'max_price': None,
                        'count': 0,
                    }
                    
        except Exception as e:
            logger.error(f"Error getting price trends: {e}")
            return {
                'make': make,
                'model': model,
                'year': year,
                'avg_price': None,
                'min_price': None,
                'max_price': None,
                'count': 0,
            }


    def get_similar_cars(self, make: str, model: str, year: Optional[int] = None, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get similar cars from database
        
        Args:
            make: Car make
            model: Car model
            year: Car year (optional)
            limit: Maximum number of results
            
        Returns:
            List of similar car records
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                if year:
                    cursor.execute('''
                        SELECT 
                            make, model, year, mileage, predicted_price, listing_price,
                            condition, fuel_type, location, confidence, platform
                        FROM cars
                        WHERE make = ? AND model = ? AND year = ?
                        AND predicted_price IS NOT NULL
                        ORDER BY timestamp DESC
                        LIMIT ?
                    ''', (make, model, year, limit))
                else:
                    cursor.execute('''
                        SELECT 
                            make, model, year, mileage, predicted_price, listing_price,
                            condition, fuel_type, location, confidence, platform
                        FROM cars
                        WHERE make = ? AND model = ?
                        AND predicted_price IS NOT NULL
                        ORDER BY timestamp DESC
                        LIMIT ?
                    ''', (make, model, limit))
                
                rows = cursor.fetchall()
                results = []
                
                for row in rows:
                    results.append({
                        'make': row['make'],
                        'model': row['model'],
                        'year': row['year'],
                        'mileage': row['mileage'],
                        'predicted_price': row['predicted_price'],
                        'listing_price': row['listing_price'],
                        'condition': row['condition'],
                        'fuel_type': row['fuel_type'],
                        'location': row['location'],
                        'confidence': row['confidence'],
                        'platform': row['platform'],
                    })
                
                return results
                
        except Exception as e:
            logger.error(f"Error getting similar cars: {e}")
            return []
    
    def save_price_alert(self, make: str, model: str, year: Optional[int], target_price: float, 
                        alert_type: str, email: Optional[str] = None) -> int:
        """
        Save a price alert
        
        Args:
            make: Car make
            model: Car model
            year: Car year (optional)
            target_price: Target price
            alert_type: 'below' or 'above'
            email: Email for notifications (optional)
            
        Returns:
            alert_id: ID of the saved alert
        """
        try:
            with self._get_connection() as conn:
                cursor = conn.cursor()
                
                # Create alerts table if it doesn't exist
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS price_alerts (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        make TEXT NOT NULL,
                        model TEXT NOT NULL,
                        year INTEGER,
                        target_price REAL NOT NULL,
                        alert_type TEXT NOT NULL,
                        email TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        active BOOLEAN DEFAULT 1
                    )
                ''')
                
                cursor.execute('''
                    INSERT INTO price_alerts (make, model, year, target_price, alert_type, email)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (make, model, year, target_price, alert_type, email))
                
                alert_id = cursor.lastrowid
                conn.commit()
                logger.info(f"Saved price alert {alert_id}")
                return alert_id
                
        except Exception as e:
            logger.error(f"Error saving price alert: {e}")
            raise


# Global database instance
_db_instance: Optional[Database] = None


def get_database() -> Database:
    """Get global database instance"""
    global _db_instance
    if _db_instance is None:
        _db_instance = Database()
    return _db_instance
