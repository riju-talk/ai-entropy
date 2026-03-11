"""
Redis caching layer for Entropy AI Agent
Caches embeddings, concepts, and frequently accessed data
"""
import logging
import json
import hashlib
from typing import Optional, Any, Dict
from functools import wraps

logger = logging.getLogger(__name__)


class CacheClient:
    """Redis cache client wrapper"""
    
    def __init__(self, host: str = "localhost", port: int = 6379, db: int = 0, password: str = None):
        self.host = host
        self.port = port
        self.db = db
        self.password = password
        self._client = None
        self._connected = False
    
    async def connect(self) -> bool:
        """Connect to Redis server"""
        try:
            import redis.asyncio as redis
            
            self._client = redis.Redis(
                host=self.host,
                port=self.port,
                db=self.db,
                password=self.password if self.password else None,
                decode_responses=True
            )
            # Test connection
            await self._client.ping()
            self._connected = True
            logger.info("Redis connection established")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self._connected = False
            return False
    
    async def close(self) -> None:
        """Close Redis connection"""
        if self._client:
            await self._client.close()
            self._connected = False
            logger.info("Redis connection closed")
    
    def _generate_key(self, prefix: str, *args) -> str:
        """Generate cache key from prefix and arguments"""
        key_data = ":".join(str(a) for a in args)
        key_hash = hashlib.md5(key_data.encode()).hexdigest()[:12]
        return f"{prefix}:{key_hash}"
    
    async def get(self, key: str) -> Optional[str]:
        """Get value from cache"""
        if not self._connected or not self._client:
            return None
        try:
            return await self._client.get(key)
        except Exception as e:
            logger.error(f"Cache GET error for key {key}: {e}")
            return None
    
    async def set(
        self,
        key: str,
        value: Any,
        ttl: int = 3600
    ) -> bool:
        """Set value in cache with TTL (default 1 hour)"""
        if not self._connected or not self._client:
            return False
        try:
            if isinstance(value, (dict, list)):
                value = json.dumps(value)
            await self._client.setex(key, ttl, value)
            return True
        except Exception as e:
            logger.error(f"Cache SET error for key {key}: {e}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete key from cache"""
        if not self._connected or not self._client:
            return False
        try:
            await self._client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache DELETE error for key {key}: {e}")
            return False
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self._connected or not self._client:
            return False
        try:
            return await self._client.exists(key) > 0
        except Exception as e:
            logger.error(f"Cache EXISTS error for key {key}: {e}")
            return False


# Global cache instance
# Initialize with settings from environment
from app.core.config import settings
cache = CacheClient(
    host=settings.REDIS_HOST,
    port=settings.REDIS_PORT,
    db=settings.REDIS_DB,
    password=settings.REDIS_PASSWORD if settings.REDIS_PASSWORD else None
)


def cached(prefix: str, ttl: int = 3600):
    """Decorator for caching function results"""
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key from function name and arguments
            cache_key = cache._generate_key(
                prefix,
                func.__name__,
                args,
                tuple(sorted(kwargs.items()))
            )
            
            # Try to get from cache
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache HIT for {cache_key}")
                return json.loads(cached_value) if cached_value.startswith("{") else cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            await cache.set(cache_key, result, ttl)
            logger.debug(f"Cache MISS for {cache_key} - stored with TTL {ttl}s")
            
            return result
        
        return wrapper
    return decorator


def cached_method(prefix: str, ttl: int = 3600):
    """Decorator for caching class method results"""
    def decorator(func):
        @wraps(func)
        async def wrapper(self, *args, **kwargs):
            cache_key = cache._generate_key(
                prefix,
                func.__name__,
                id(self),
                args,
                tuple(sorted(kwargs.items()))
            )
            
            cached_value = await cache.get(cache_key)
            if cached_value is not None:
                logger.debug(f"Cache HIT for {cache_key}")
                return json.loads(cached_value) if cached_value.startswith("{") else cached_value
            
            result = await func(self, *args, **kwargs)
            await cache.set(cache_key, result, ttl)
            logger.debug(f"Cache MISS for {cache_key} - stored with TTL {ttl}s")
            
            return result
        
        return wrapper
    return decorator
