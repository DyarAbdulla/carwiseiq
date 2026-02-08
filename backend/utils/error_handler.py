"""Error handling utilities"""


class ScrapingError(Exception):
    """Error raised during web scraping"""
    pass


class PredictionError(Exception):
    """Error raised during price prediction"""
    pass
