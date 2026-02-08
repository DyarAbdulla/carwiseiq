"""
Utility functions for Car Price Predictor
Helper functions used across the project
"""

import pandas as pd
import numpy as np
import os
import logging
from typing import Union, Tuple, Dict, List
import config


def validate_year(year: int) -> bool:
    """
    Validate year value
    
    Args:
        year: Year to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    return config.MIN_YEAR <= year <= config.MAX_YEAR


def validate_mileage(mileage: float) -> bool:
    """
    Validate mileage value
    
    Args:
        mileage: Mileage to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    return config.MIN_MILEAGE <= mileage <= config.MAX_MILEAGE


def validate_engine_size(engine_size: float) -> bool:
    """
    Validate engine size value
    
    Args:
        engine_size: Engine size to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    return config.MIN_ENGINE_SIZE <= engine_size <= config.MAX_ENGINE_SIZE


def validate_cylinders(cylinders: int) -> bool:
    """
    Validate number of cylinders
    
    Args:
        cylinders: Number of cylinders to validate
        
    Returns:
        bool: True if valid, False otherwise
    """
    return config.MIN_CYLINDERS <= cylinders <= config.MAX_CYLINDERS


def calculate_age_of_car(year: int, current_year: int = None) -> int:
    """
    Calculate age of car from year
    
    Args:
        year: Manufacturing year
        current_year: Current year (defaults to config.CURRENT_YEAR)
        
    Returns:
        int: Age of car in years
    """
    if current_year is None:
        current_year = config.CURRENT_YEAR
    return current_year - year


def format_currency(amount: float, decimals: int = 2) -> str:
    """
    Format number as currency
    
    Args:
        amount: Amount to format
        decimals: Number of decimal places
        
    Returns:
        str: Formatted currency string
    """
    return f"${amount:,.{decimals}f}"


def detect_outliers_iqr(series: pd.Series) -> pd.Series:
    """
    Detect outliers using IQR method
    
    Args:
        series: Pandas Series to analyze
        
    Returns:
        pd.Series: Boolean series indicating outliers
    """
    Q1 = series.quantile(0.25)
    Q3 = series.quantile(0.75)
    IQR = Q3 - Q1
    lower_bound = Q1 - 1.5 * IQR
    upper_bound = Q3 + 1.5 * IQR
    return (series < lower_bound) | (series > upper_bound)


def cap_outliers_percentile(series: pd.Series, lower: float = 0.01, upper: float = 0.99) -> pd.Series:
    """
    Cap outliers at specified percentiles
    
    Args:
        series: Pandas Series to process
        lower: Lower percentile (default 0.01)
        upper: Upper percentile (default 0.99)
        
    Returns:
        pd.Series: Series with capped outliers
    """
    lower_bound = series.quantile(lower)
    upper_bound = series.quantile(upper)
    return series.clip(lower=lower_bound, upper=upper_bound)


def ensure_directory_exists(directory: str) -> None:
    """
    Ensure directory exists, create if it doesn't
    
    Args:
        directory: Directory path
    """
    if not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)


def load_data(file_path: str, **kwargs) -> pd.DataFrame:
    """
    Load data from file (CSV or Excel)
    
    Args:
        file_path: Path to data file
        **kwargs: Additional arguments for pd.read_csv or pd.read_excel
        
    Returns:
        pd.DataFrame: Loaded dataframe
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"Data file not found: {file_path}")
    
    if file_path.endswith('.csv'):
        return pd.read_csv(file_path, **kwargs)
    elif file_path.endswith(('.xlsx', '.xls')):
        return pd.read_excel(file_path, **kwargs)
    else:
        raise ValueError(f"Unsupported file format: {file_path}")


def save_data(df: pd.DataFrame, file_path: str, **kwargs) -> None:
    """
    Save dataframe to file
    
    Args:
        df: DataFrame to save
        file_path: Output file path
        **kwargs: Additional arguments for pd.to_csv or pd.to_excel
    """
    ensure_directory_exists(os.path.dirname(file_path))
    
    if file_path.endswith('.csv'):
        df.to_csv(file_path, index=False, **kwargs)
    elif file_path.endswith(('.xlsx', '.xls')):
        df.to_excel(file_path, index=False, **kwargs)
    else:
        raise ValueError(f"Unsupported file format: {file_path}")


def get_dataset_statistics(df: pd.DataFrame) -> Dict:
    """
    Get basic statistics about the dataset
    
    Args:
        df: DataFrame to analyze
        
    Returns:
        dict: Dictionary with statistics
    """
    stats = {
        'total_rows': len(df),
        'total_columns': len(df.columns),
        'missing_values': df.isnull().sum().sum(),
        'duplicate_rows': df.duplicated().sum()
    }
    
    if 'price' in df.columns:
        stats['price_mean'] = df['price'].mean()
        stats['price_median'] = df['price'].median()
        stats['price_std'] = df['price'].std()
        stats['price_min'] = df['price'].min()
        stats['price_max'] = df['price'].max()
    
    if 'year' in df.columns:
        stats['year_min'] = int(df['year'].min())
        stats['year_max'] = int(df['year'].max())
        stats['year_range'] = f"{stats['year_min']} - {stats['year_max']}"
    
    return stats


def clean_text_column(series: pd.Series) -> pd.Series:
    """
    Clean text column: remove extra spaces, standardize case
    
    Args:
        series: Pandas Series with text data
        
    Returns:
        pd.Series: Cleaned series
    """
    cleaned = series.astype(str).str.strip()
    cleaned = cleaned.str.replace(r'\s+', ' ', regex=True)
    cleaned = cleaned.str.title()
    return cleaned


def encode_condition(condition: str) -> int:
    """
    Encode condition to numeric value
    
    Args:
        condition: Condition string
        
    Returns:
        int: Encoded condition value
    """
    return config.CONDITION_MAP.get(condition, 3)  # Default to 'Good'


def encode_fuel_type(fuel_type: str) -> int:
    """
    Encode fuel type to numeric value
    
    Args:
        fuel_type: Fuel type string
        
    Returns:
        int: Encoded fuel type value
    """
    return config.FUEL_TYPE_MAP.get(fuel_type, 0)  # Default to 'Gasoline'


def calculate_confidence_interval(predictions: np.ndarray, std: np.ndarray, 
                                   z_score: float = None) -> Dict[str, np.ndarray]:
    """
    Calculate confidence intervals for predictions
    
    Args:
        predictions: Array of predictions
        std: Array of standard deviations
        z_score: Z-score for confidence level (defaults to config.CONFIDENCE_Z_SCORE)
        
    Returns:
        dict: Dictionary with lower and upper bounds
    """
    if z_score is None:
        z_score = config.CONFIDENCE_Z_SCORE
    
    return {
        'lower': predictions - z_score * std,
        'upper': predictions + z_score * std,
        'mean': predictions,
        'std': std
    }


def validate_car_data(car_data: Dict) -> Tuple[bool, List[str]]:
    """
    Validate car data dictionary
    
    Args:
        car_data: Dictionary with car information
        
    Returns:
        tuple: (is_valid, list_of_errors)
    """
    errors = []
    
    if 'year' in car_data:
        if not validate_year(car_data['year']):
            errors.append(f"Invalid year: {car_data['year']} (must be between {config.MIN_YEAR} and {config.MAX_YEAR})")
    
    if 'mileage' in car_data:
        if not validate_mileage(car_data['mileage']):
            errors.append(f"Invalid mileage: {car_data['mileage']} (must be between {config.MIN_MILEAGE} and {config.MAX_MILEAGE} km)")
    
    if 'engine_size' in car_data:
        if not validate_engine_size(car_data['engine_size']):
            errors.append(f"Invalid engine size: {car_data['engine_size']} (must be between {config.MIN_ENGINE_SIZE} and {config.MAX_ENGINE_SIZE} L)")
    
    if 'cylinders' in car_data:
        if not validate_cylinders(car_data['cylinders']):
            errors.append(f"Invalid cylinders: {car_data['cylinders']} (must be between {config.MIN_CYLINDERS} and {config.MAX_CYLINDERS})")
    
    # Check required fields
    required_fields = ['make', 'model', 'condition', 'fuel_type', 'location']
    for field in required_fields:
        if field not in car_data or not car_data[field] or str(car_data[field]).strip() == '':
            errors.append(f"Missing or empty required field: {field}")
    
    return len(errors) == 0, errors


def setup_logging(log_file: str = None, log_level: str = None) -> None:
    """
    Setup logging configuration
    
    Args:
        log_file: Path to log file (optional)
        log_level: Logging level (defaults to config.LOG_LEVEL)
    """
    import logging
    
    if log_level is None:
        log_level = config.LOG_LEVEL
    
    # Create logger
    logger = logging.getLogger('car_price_predictor')
    logger.setLevel(getattr(logging, log_level.upper()))
    
    # Create formatter
    formatter = logging.Formatter(config.LOG_FORMAT)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(getattr(logging, log_level.upper()))
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # File handler (if specified)
    if log_file:
        ensure_directory_exists(os.path.dirname(log_file) if os.path.dirname(log_file) else '.')
        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(getattr(logging, log_level.upper()))
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger


def get_logger(name: str = 'car_price_predictor') -> logging.Logger:
    """
    Get logger instance
    
    Args:
        name: Logger name
        
    Returns:
        logging.Logger: Logger instance
    """
    import logging
    return logging.getLogger(name)

