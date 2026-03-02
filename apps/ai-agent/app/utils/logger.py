"""
Logging configuration
"""

import logging
import sys
from app.config import settings

def setup_logger(name: str) -> logging.Logger:
    """
    Setup and return a configured logger
    """
    logger = logging.getLogger(name)

    if not logger.handlers:
        # Set level
        level = logging.DEBUG if settings.DEBUG else logging.INFO
        logger.setLevel(level)

        # Create handler
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(level)

        # Create formatter
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
        handler.setFormatter(formatter)

        # Add handler
        logger.addHandler(handler)

    return logger
