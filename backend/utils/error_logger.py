"""
Error logging utility
Logs errors to file with timestamps
"""

import logging
import os
from datetime import datetime
from pathlib import Path

# Create logs directory if it doesn't exist
LOGS_DIR = Path(__file__).parent.parent / 'logs'
LOGS_DIR.mkdir(exist_ok=True)

ERROR_LOG_FILE = LOGS_DIR / 'errors.log'

# Configure error file handler
error_handler = logging.FileHandler(ERROR_LOG_FILE, encoding='utf-8')
error_handler.setLevel(logging.ERROR)
error_formatter = logging.Formatter(
    '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
error_handler.setFormatter(error_formatter)

# Get root logger and add handler
root_logger = logging.getLogger()
if error_handler not in root_logger.handlers:
    root_logger.addHandler(error_handler)


def log_error(error_type: str, url: str, error_message: str, details: str = ''):
    """
    Log error to file
    
    Args:
        error_type: Type of error (e.g., 'ScrapingError', 'TimeoutError')
        url: URL that caused the error
        error_message: Error message
        details: Additional error details
    """
    logger = logging.getLogger('error_logger')
    log_message = f"{error_type} | URL: {url} | Message: {error_message}"
    if details:
        log_message += f" | Details: {details}"
    logger.error(log_message)
