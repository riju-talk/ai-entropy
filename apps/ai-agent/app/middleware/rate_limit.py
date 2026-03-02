"""
NOVYRA Security - Rate Limiting Middleware

Protects API endpoints from abuse through rate limiting.
"""
import logging
import time
from typing import Dict, Optional
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


class RateLimitConfig:
    """Rate limit configuration per endpoint."""
    
    def __init__(
        self,
        requests: int,
        window: int,  # seconds
        scope: str = "user"  # "user", "ip", "global"
    ):
        self.requests = requests
        self.window = window
        self.scope = scope


# Rate limit rules
RATE_LIMITS: Dict[str, RateLimitConfig] = {
    # Authentication
    "/api/auth/login": RateLimitConfig(5, 60, "ip"),
    "/api/auth/register": RateLimitConfig(3, 3600, "ip"),
    
    # AI/Reasoning
    "/api/reasoning/ask": RateLimitConfig(20, 60, "user"),
    "/api/ai-agent/ask": RateLimitConfig(20, 60, "user"),
    
    # Content creation
    "/api/doubts": RateLimitConfig(10, 60, "user"),
    "/api/answers": RateLimitConfig(15, 60, "user"),
    "/api/comments": RateLimitConfig(20, 60, "user"),
    
    # Voting
    "/api/votes": RateLimitConfig(30, 60, "user"),
    
    # Gamification
    "/api/gamification": RateLimitConfig(50, 60, "user"),
    
    # Search
    "/api/search": RateLimitConfig(30, 60, "user"),
    
    # Default for unmatched routes
    "default": RateLimitConfig(100, 60, "ip")
}


class RateLimiter:
    """
    In-memory rate limiter.
    
    In production, should use Redis for distributed rate limiting.
    """
    
    def __init__(self):
        # key -> list of timestamps
        self.requests: Dict[str, list] = defaultdict(list)
        self.last_cleanup = time.time()
    
    def _cleanup_old_requests(self):
        """Remove expired request records."""
        now = time.time()
        
        # Cleanup every 5 minutes
        if now - self.last_cleanup < 300:
            return
        
        for key in list(self.requests.keys()):
            # Remove entries older than 1 hour
            self.requests[key] = [
                ts for ts in self.requests[key]
                if now - ts < 3600
            ]
            
            # Remove empty keys
            if not self.requests[key]:
                del self.requests[key]
        
        self.last_cleanup = now
    
    def is_allowed(
        self,
        key: str,
        max_requests: int,
        window: int
    ) -> tuple[bool, int]:
        """
        Check if request is allowed.
        
        Args:
            key: Rate limit key (user_id, IP, etc.)
            max_requests: Maximum requests allowed
            window: Time window in seconds
        
        Returns:
            (is_allowed, retry_after_seconds)
        """
        now = time.time()
        
        # Cleanup periodically
        self._cleanup_old_requests()
        
        # Get request history for this key
        request_times = self.requests[key]
        
        # Remove requests outside window
        cutoff = now - window
        request_times = [ts for ts in request_times if ts > cutoff]
        self.requests[key] = request_times
        
        # Check if limit exceeded
        if len(request_times) >= max_requests:
            # Calculate retry after
            oldest_request = min(request_times)
            retry_after = int(window - (now - oldest_request)) + 1
            return False, retry_after
        
        # Allow request
        request_times.append(now)
        return True, 0


# Global rate limiter instance
rate_limiter = RateLimiter()


def get_rate_limit_key(request: Request, scope: str) -> str:
    """
    Get rate limit key based on scope.
    
    Args:
        request: FastAPI request
        scope: "user", "ip", or "global"
    
    Returns:
        Rate limit key
    """
    if scope == "user":
        # Get user ID from session/auth
        user_id = request.state.user_id if hasattr(request.state, "user_id") else None
        if user_id:
            return f"user:{user_id}"
        else:
            # Fallback to IP if not authenticated
            return f"ip:{request.client.host}"
    
    elif scope == "ip":
        return f"ip:{request.client.host}"
    
    elif scope == "global":
        return "global"
    
    return f"ip:{request.client.host}"


def get_rate_limit_config(path: str) -> RateLimitConfig:
    """
    Get rate limit config for a path.
    
    Args:
        path: Request path
    
    Returns:
        RateLimitConfig
    """
    # Check exact match
    if path in RATE_LIMITS:
        return RATE_LIMITS[path]
    
    # Check prefix match
    for pattern, config in RATE_LIMITS.items():
        if path.startswith(pattern):
            return config
    
    # Default
    return RATE_LIMITS["default"]


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware for rate limiting.
    
    Applies rate limits based on endpoint and scope.
    """
    
    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path == "/health":
            return await call_next(request)
        
        # Get rate limit config
        config = get_rate_limit_config(request.url.path)
        
        # Get rate limit key
        key = get_rate_limit_key(request, config.scope)
        
        # Check rate limit
        is_allowed, retry_after = rate_limiter.is_allowed(
            key,
            config.requests,
            config.window
        )
        
        if not is_allowed:
            logger.warning(
                f"Rate limit exceeded: {key} on {request.url.path} "
                f"(retry after {retry_after}s)"
            )
            
            raise HTTPException(
                status_code=429,
                detail={
                    "error": "Rate limit exceeded",
                    "retry_after": retry_after,
                    "limit": config.requests,
                    "window": config.window
                }
            )
        
        # Process request
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(config.requests)
        response.headers["X-RateLimit-Window"] = str(config.window)
        response.headers["X-RateLimit-Remaining"] = str(
            config.requests - len(rate_limiter.requests.get(key, []))
        )
        
        return response


logger.info("Rate limiting middleware initialized")
