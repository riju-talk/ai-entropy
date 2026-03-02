"""
NOVYRA Database Core

Database connection and utilities using Prisma.
"""
import logging
from typing import Optional
from contextlib import asynccontextmanager

from prisma import Prisma

logger = logging.getLogger(__name__)

# Global Prisma client
_prisma_client: Optional[Prisma] = None


async def connect_db():
    """Initialize and connect Prisma client."""
    global _prisma_client
    
    if _prisma_client is None:
        _prisma_client = Prisma()
        await _prisma_client.connect()
        logger.info("Database connected via Prisma")


async def disconnect_db():
    """Disconnect Prisma client."""
    global _prisma_client
    
    if _prisma_client is not None:
        await _prisma_client.disconnect()
        _prisma_client = None
        logger.info("Database disconnected")


def get_db() -> Prisma:
    """
    Get the global Prisma client instance.
    
    Returns:
        Prisma client
    
    Raises:
        RuntimeError: If database is not connected
    """
    if _prisma_client is None:
        raise RuntimeError("Database not connected. Call connect_db() first.")
    
    return _prisma_client


@asynccontextmanager
async def db_context():
    """
    Context manager for database operations.
    
    Usage:
        async with db_context():
            db = get_db()
            # ... database operations
    """
    try:
        await connect_db()
        yield get_db()
    finally:
        await disconnect_db()


async def health_check() -> bool:
    """
    Check if database connection is healthy.
    
    Returns:
        True if healthy, False otherwise
    """
    try:
        db = get_db()
        # Simple query to test connection
        await db.query_raw("SELECT 1")
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False


logger.info("Database core initialized")
