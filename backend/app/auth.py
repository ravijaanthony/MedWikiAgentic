"""Supabase JWT verification for FastAPI dependencies.

Supabase issues JWTs that are signed either with a symmetric HS256 secret
(legacy projects) or an asymmetric ES256 / RS256 key (default for new
projects). To support both, we read the token's `alg` and `kid` from the
header, then either:

- HS256: verify with the project's JWT Secret (`SUPABASE_JWT_SECRET`).
- ES256 / RS256 / others: fetch the project's JWKS once at startup
  (`{SUPABASE_URL}/auth/v1/.well-known/jwks.json`), look up the public key by
  `kid`, and verify with that.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx
from fastapi import Header, HTTPException, status
from jose import JWTError, jwt

from app.config import get_settings

_logger = logging.getLogger(__name__)
_AUDIENCE = "authenticated"
_SYMMETRIC_ALGS = {"HS256", "HS384", "HS512"}

_jwks_cache: dict[str, dict[str, Any]] | None = None


def _load_jwks() -> dict[str, dict[str, Any]]:
    """Fetch the Supabase JWKS once and cache by `kid`. Failures are logged
    but don't crash the app — an asymmetric token will get a clean 401 with
    a meaningful message instead."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache
    settings = get_settings()
    try:
        resp = httpx.get(settings.jwks_url, timeout=5.0)
        resp.raise_for_status()
        keys = resp.json().get("keys", [])
        _jwks_cache = {k["kid"]: k for k in keys if "kid" in k}
        _logger.info("Loaded %d JWKS key(s) from %s", len(_jwks_cache), settings.jwks_url)
    except Exception as exc:
        _logger.warning("Failed to load JWKS from %s: %s", settings.jwks_url, exc)
        _jwks_cache = {}
    return _jwks_cache


def _refresh_jwks() -> dict[str, dict[str, Any]]:
    """Force-refresh the cache (e.g. after a key rotation)."""
    global _jwks_cache
    _jwks_cache = None
    return _load_jwks()


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


def _key_for(token: str) -> tuple[Any, str]:
    """Pick the right key + algorithm for verifying this token."""
    try:
        header = jwt.get_unverified_header(token)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token header: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    alg = header.get("alg")
    kid = header.get("kid")

    if not alg:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token header missing 'alg'",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if alg in _SYMMETRIC_ALGS:
        secret = get_settings().supabase_jwt_secret
        if not secret:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    f"Token uses {alg} but SUPABASE_JWT_SECRET is not configured."
                ),
                headers={"WWW-Authenticate": "Bearer"},
            )
        return secret, alg

    keys = _load_jwks()
    jwk_dict = keys.get(kid) if kid else None
    if jwk_dict is None:
        keys = _refresh_jwks()
        jwk_dict = keys.get(kid) if kid else None
    if jwk_dict is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                f"No JWKS key found for kid={kid!r}. "
                "Token may be from a different project or the JWKS endpoint is unreachable."
            ),
            headers={"WWW-Authenticate": "Bearer"},
        )
    return jwk_dict, alg


def verify_token(token: str) -> dict:
    key, alg = _key_for(token)
    try:
        return jwt.decode(token, key, algorithms=[alg], audience=_AUDIENCE)
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
