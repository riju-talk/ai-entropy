"""
Observability middleware for Entropy AI Agent
Provides structured logging, metrics, and tracing
"""
import time
import logging
import json
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from typing import Dict, Any

logger = logging.getLogger(__name__)


class StructuredLoggingMiddleware(BaseHTTPMiddleware):
    """Add structured JSON logging to all requests"""
    
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        
        # Extract request info
        request_id = request.headers.get("X-Request-ID", request.scope.get("path", "unknown"))
        user_agent = request.headers.get("user-agent", "unknown")
        client_host = request.client.host if request.client else "unknown"
        
        # Log request start
        logger.info(
            json.dumps({
                "event": "request_start",
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "client_ip": client_host,
                "user_agent": user_agent
            })
        )
        
        try:
            response = await call_next(request)
            
            # Calculate duration
            duration = time.time() - start_time
            
            # Log request completion
            logger.info(
                json.dumps({
                    "event": "request_complete",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "status_code": response.status_code,
                    "duration_ms": round(duration * 1000, 2),
                    "client_ip": client_host
                })
            )
            
            # Add request ID to response
            response.headers["X-Request-ID"] = request_id
            return response
            
        except Exception as e:
            duration = time.time() - start_time
            
            logger.error(
                json.dumps({
                    "event": "request_error",
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.url.path,
                    "error": str(e),
                    "duration_ms": round(duration * 1000, 2),
                    "client_ip": client_host
                })
            )
            
            raise


class MetricsMiddleware(BaseHTTPMiddleware):
    """Track request metrics for monitoring"""
    
    # Class-level metrics storage
    metrics: Dict[str, Dict[str, Any]] = {
        "total_requests": 0,
        "error_count": 0,
        "latency_sum": 0.0,
        "status_codes": {}
    }
    
    async def dispatch(self, request: Request, call_next) -> Response:
        start_time = time.time()
        response = await call_next(request)
        duration = time.time() - start_time
        
        # Update metrics
        MetricsMiddleware.metrics["total_requests"] += 1
        MetricsMiddleware.metrics["latency_sum"] += duration
        
        status_key = str(response.status_code)
        MetricsMiddleware.metrics["status_codes"][status_key] = \
            MetricsMiddleware.metrics["status_codes"].get(status_key, 0) + 1
        
        if response.status_code >= 400:
            MetricsMiddleware.metrics["error_count"] += 1
        
        return response
    
    @classmethod
    def get_metrics(cls) -> Dict[str, Any]:
        """Get current metrics snapshot"""
        total = cls.metrics["total_requests"]
        return {
            "total_requests": total,
            "error_count": cls.metrics["error_count"],
            "error_rate": cls.metrics["error_count"] / total if total > 0 else 0,
            "avg_latency_ms": (cls.metrics["latency_sum"] / total * 1000) if total > 0 else 0,
            "status_codes": cls.metrics["status_codes"]
        }


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiting"""
    
    # Rate limit storage: {client_ip: [(timestamp, ...)]}
    rate_limit_store: Dict[str, list] = {}
    rate_limit_window = 60  # seconds
    rate_limit_max_requests = 100  # requests per window
    
    async def dispatch(self, request: Request, call_next) -> Response:
        client_ip = request.client.host if request.client else "unknown"
        current_time = time.time()
        
        # Clean old entries
        if client_ip in self.rate_limit_store:
            self.rate_limit_store[client_ip] = [
                t for t in self.rate_limit_store[client_ip]
                if current_time - t < self.rate_limit_window
            ]
        else:
            self.rate_limit_store[client_ip] = []
        
        # Check rate limit
        if len(self.rate_limit_store[client_ip]) >= self.rate_limit_max_requests:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return Response(
                status_code=429,
                content=json.dumps({
                    "error": "Rate limit exceeded",
                    "retry_after": self.rate_limit_window
                })
            )
        
        # Record request
        self.rate_limit_store[client_ip].append(current_time)
        
        return await call_next(request)
