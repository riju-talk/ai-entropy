"""
Authentication middleware for Entropy AI Agent
Validates API tokens and JWT authentication
"""
import logging
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)


async def validate_api_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> bool:
    """Validate API backend token for internal service communication"""
    from app.core.config import settings
    
    if not credentials:
        # Allow requests without token for public endpoints
        return True
    
    token = credentials.credentials
    expected_token = settings.AI_BACKEND_TOKEN
    
    if not expected_token:
        logger.warning("AI_BACKEND_TOKEN not configured - accepting all tokens")
        return True
    
    if token != expected_token:
        logger.warning("Invalid API token provided")
        raise HTTPException(
            status_code=401,
            detail="Invalid API token"
        )
    
    return True


async def require_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> None:
    """Require API token - raises 401 if missing or invalid"""
    from app.core.config import settings
    
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="API token required"
        )
    
    token = credentials.credentials
    expected_token = settings.AI_BACKEND_TOKEN
    
    if not expected_token:
        logger.warning("AI_BACKEND_TOKEN not configured - accepting all tokens")
        return
    
    if token != expected_token:
        logger.warning("Invalid API token provided")
        raise HTTPException(
            status_code=401,
            detail="Invalid API token"
        )


async def validate_jwt_token(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> dict:
    """Validate JWT token and return user info"""
    from app.core.config import settings
    from jose import jwt, JWTError
    
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    token = credentials.credentials
    
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM]
        )
        return payload
    except JWTError as e:
        logger.warning(f"Invalid JWT token: {e}")
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token"
        )
