"""
Retry utilities for Entropy AI Agent
Centralized retry logic with exponential backoff
"""
import logging
from typing import Callable, Any, TypeVar, Awaitable
from functools import wraps

logger = logging.getLogger(__name__)

T = TypeVar("T")


def retry_with_backoff(
    max_retries: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 30.0,
    retryable_exceptions: tuple = (Exception,)
):
    """
    Decorator for retrying async functions with exponential backoff
    
    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay in seconds
        max_delay: Maximum delay cap in seconds
        retryable_exceptions: Tuple of exceptions to retry on
    """
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            last_exception = None
            delay = base_delay
            
            for attempt in range(max_retries + 1):
                try:
                    if attempt > 0:
                        logger.info(
                            f"Retrying {func.__name__} (attempt {attempt + 1}/{max_retries + 1}) "
                            f"after {delay:.1f}s delay"
                        )
                    return await func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e
                    logger.warning(
                        f"{func.__name__} failed (attempt {attempt + 1}/{max_retries + 1}): {e}"
                    )
                    
                    if attempt < max_retries:
                        import asyncio
                        await asyncio.sleep(delay)
                        delay = min(delay * 2, max_delay)
            
            logger.error(f"{func.__name__} failed after {max_retries + 1} attempts")
            raise last_exception
        
        return wrapper
    return decorator


def circuit_breaker(
    failure_threshold: int = 5,
    recovery_timeout: float = 30.0,
    half_open_requests: int = 3
):
    """
    Decorator implementing circuit breaker pattern
    
    Args:
        failure_threshold: Number of failures before opening circuit
        recovery_timeout: Seconds to wait before attempting recovery
        half_open_requests: Number of requests to allow in half-open state
    """
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        # Circuit state storage
        state = {
            "failures": 0,
            "last_failure_time": None,
            "is_open": False,
            "half_open_requests": 0
        }
        
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            import time
            
            current_time = time.time()
            
            # Check if circuit should close
            if state["is_open"] and state["last_failure_time"]:
                if current_time - state["last_failure_time"] > recovery_timeout:
                    state["is_open"] = False
                    state["half_open_requests"] = 0
                    logger.info(f"Circuit {func.__name__} transitioning to half-open")
            
            # Check if circuit is open
            if state["is_open"]:
                raise CircuitOpenError(f"Circuit {func.__name__} is open")
            
            try:
                result = await func(*args, **kwargs)
                
                # Success - reset circuit
                if state["is_open"]:
                    state["is_open"] = False
                    state["failures"] = 0
                    logger.info(f"Circuit {func.__name__} closed after recovery")
                else:
                    state["failures"] = max(0, state["failures"] - 1)
                
                return result
                
            except Exception as e:
                state["failures"] += 1
                state["last_failure_time"] = current_time
                
                if state["failures"] >= failure_threshold:
                    state["is_open"] = True
                    logger.warning(f"Circuit {func.__name__} opened after {state['failures']} failures")
                
                raise
        
        return wrapper
    return decorator


class CircuitOpenError(Exception):
    """Raised when circuit breaker is open"""
    pass
