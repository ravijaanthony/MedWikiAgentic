"""Supabase JWT verification for FastAPI dependencies.

The frontend obtains a JWT via Supabase Auth (email + password) and includes it
on every API call as `Authorization: Bearer <jwt>`. We verify the signature with
the shared HMAC secret from Project Settings -> API -> JWT Settings, then
extract the `sub` claim (the auth.users.id UUID).
"""

from __future__ import annotations

from fastapi import Header, HTTPException, status
from jose import JWTError, jwt

from app.config import get_settings

_AUDIENCE = "authenticated"
_ALGORITHMS = ["HS256"]


def _extract_token(authorization: str | None) -> str:
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    parts = authorization.split(maxsplit=1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must be 'Bearer <token>'",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return parts[1].strip()


def verify_token(token: str) -> dict:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=_ALGORITHMS,
            audience=_AUDIENCE,
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user_id(authorization: str | None = Header(default=None)) -> str:
    """FastAPI dependency: returns the authenticated user's UUID (auth.users.id)."""
    token = _extract_token(authorization)
    payload = verify_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing 'sub' claim",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id
