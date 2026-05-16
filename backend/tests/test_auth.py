"""JWT verification round-trip. No live Supabase required — we mint a token
with the same secret that the backend's verifier uses."""

from __future__ import annotations

import time
import uuid

import pytest
from fastapi import HTTPException
from jose import jwt

from app.auth import get_current_user_id, verify_token
from app.config import get_settings

_TEST_SECRET = "test-jwt-secret-for-auth-roundtrip-32+chars"
_TEST_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres"


def _setup_settings(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", _TEST_DATABASE_URL)
    monkeypatch.setenv("SUPABASE_JWT_SECRET", _TEST_SECRET)
    get_settings.cache_clear()


def _mint_token(sub: str, secret: str = _TEST_SECRET, audience: str = "authenticated") -> str:
    now = int(time.time())
    return jwt.encode(
        {
            "sub": sub,
            "aud": audience,
            "iat": now,
            "exp": now + 3600,
            "role": "authenticated",
        },
        secret,
        algorithm="HS256",
    )


def test_verify_token_extracts_user_id(monkeypatch: pytest.MonkeyPatch) -> None:
    _setup_settings(monkeypatch)
    user_id = str(uuid.uuid4())
    token = _mint_token(user_id)
    payload = verify_token(token)
    assert payload["sub"] == user_id
    assert payload["aud"] == "authenticated"


def test_get_current_user_id_happy_path(monkeypatch: pytest.MonkeyPatch) -> None:
    _setup_settings(monkeypatch)
    user_id = str(uuid.uuid4())
    token = _mint_token(user_id)
    assert get_current_user_id(f"Bearer {token}") == user_id


def test_get_current_user_id_rejects_missing_header(monkeypatch: pytest.MonkeyPatch) -> None:
    _setup_settings(monkeypatch)
    with pytest.raises(HTTPException) as exc:
        get_current_user_id(None)
    assert exc.value.status_code == 401


def test_get_current_user_id_rejects_malformed(monkeypatch: pytest.MonkeyPatch) -> None:
    _setup_settings(monkeypatch)
    with pytest.raises(HTTPException) as exc:
        get_current_user_id("Token abc")
    assert exc.value.status_code == 401


def test_get_current_user_id_rejects_wrong_secret(monkeypatch: pytest.MonkeyPatch) -> None:
    _setup_settings(monkeypatch)
    bad_token = _mint_token(str(uuid.uuid4()), secret="different-secret-please")
    with pytest.raises(HTTPException) as exc:
        get_current_user_id(f"Bearer {bad_token}")
    assert exc.value.status_code == 401


def test_get_current_user_id_rejects_wrong_audience(monkeypatch: pytest.MonkeyPatch) -> None:
    _setup_settings(monkeypatch)
    bad_token = _mint_token(str(uuid.uuid4()), audience="anonymous")
    with pytest.raises(HTTPException) as exc:
        get_current_user_id(f"Bearer {bad_token}")
    assert exc.value.status_code == 401
