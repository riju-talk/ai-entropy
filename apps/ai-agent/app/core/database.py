"""
Entropy AI Database Core

Database connection and utilities using Prisma.
"""
import logging
from typing import Optional
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)

try:
    from prisma import Prisma
    _prisma_available = True
except Exception:
    Prisma = None  # type: ignore[assignment,misc]
    _prisma_available = False
    logger.warning("Prisma client not available — database features disabled")

# Global Prisma client
_prisma_client: Optional["Prisma"] = None  # type: ignore[type-arg]


async def connect_db():
    """Initialize and connect Prisma client."""
    global _prisma_client

    if not _prisma_available:
        logger.warning("Skipping DB connect — Prisma not available")
        return

    if _prisma_client is None:
        import asyncio
        _prisma_client = Prisma()
        try:
            # A cold Supabase pooler can take >5 s to accept the first connection
            await asyncio.wait_for(_prisma_client.connect(), timeout=20.0)
            logger.info("Database connected via Prisma")
        except BaseException as exc:
            # BaseException catches SystemExit which Prisma's Rust binary raises
            # on Windows when Postgres is unreachable
            logger.error("PostgreSQL connection failed (will continue without DB): %s", exc)
            _prisma_client = None


_reconnecting: Optional["asyncio.Task"] = None  # type: ignore[name-defined]


def ensure_db_in_background(interval: float = 20.0) -> None:
    """
    Startup connects once; if that fails the service used to stay without a database until the next restart
    (every mastery / gamification call then failed). This keeps retrying in the background until it connects.
    """
    import asyncio

    global _reconnecting
    if _reconnecting is not None and not _reconnecting.done():
        return

    async def loop():
        while _prisma_client is None and _prisma_available:
            await asyncio.sleep(interval)
            await connect_db()
            if _prisma_client is not None:
                logger.info("Database reconnected after earlier failure")

    _reconnecting = asyncio.get_event_loop().create_task(loop())


async def disconnect_db():
    """Disconnect Prisma client."""
    global _prisma_client

    if _prisma_client is not None:
        await _prisma_client.disconnect()
        _prisma_client = None
        logger.info("Database disconnected")


def get_db():
    """
    Get the global Prisma client instance.
    
    Returns:
        Prisma client
    
    Raises:
        RuntimeError: If database is not connected
    """
    global _prisma_client
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
    if _prisma_client is None:
        ensure_db_in_background()  # a probe (or the keep-alive ping) also nudges a reconnect
    try:
        db = get_db()
        # Simple query to test connection
        await db.query_raw("SELECT 1")
        return True
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return False


logger.info("Database core initialized")
