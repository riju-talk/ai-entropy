"""
Service-to-service auth (BFF pattern).

Only the Next.js server calls this service. It authenticates with a shared secret in
`X-Internal-Token` and forwards the user it verified in `X-User-Id`. The browser never
sees the token.
"""

import hmac
import logging
from typing import Optional

from fastapi import Header, HTTPException, Request

from app.core.config import settings

logger = logging.getLogger(__name__)


async def require_internal(
    request: Request,
    x_internal_token: Optional[str] = Header(default=None),
    x_user_id: Optional[str] = Header(default=None),
) -> None:
    """Router dependency: reject calls that lack the shared secret; expose the verified user id."""
    expected = settings.AI_BACKEND_TOKEN
    if not expected:
        if settings.DEBUG:  # local development without a token
            request.state.user_id = x_user_id
            return
        logger.error("AI_BACKEND_TOKEN is not configured; rejecting request")
        raise HTTPException(status_code=503, detail="Service not configured")
    if not x_internal_token or not hmac.compare_digest(x_internal_token, expected):
        raise HTTPException(status_code=401, detail="Invalid or missing service token")
    request.state.user_id = x_user_id
