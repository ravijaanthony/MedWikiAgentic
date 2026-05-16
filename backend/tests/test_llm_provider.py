from app.clients.llm_client import get_active_provider
from app.config import Settings, get_settings

_TEST_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/postgres"
_TEST_JWT_SECRET = "test-jwt-secret"


def _clear_settings_cache() -> None:
    get_settings.cache_clear()


def _set_required_env(monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", _TEST_DATABASE_URL)
    monkeypatch.setenv("SUPABASE_JWT_SECRET", _TEST_JWT_SECRET)


def test_llm_provider_gemini_only(monkeypatch):
    _set_required_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    _clear_settings_cache()
    assert Settings().llm_provider == "gemini"
    assert get_active_provider() == "gemini"
    _clear_settings_cache()


def test_llm_provider_openai_only(monkeypatch):
    _set_required_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    _clear_settings_cache()
    assert Settings().llm_provider == "openai"
    assert get_active_provider() == "openai"
    _clear_settings_cache()


def test_llm_provider_none(monkeypatch):
    _set_required_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    _clear_settings_cache()
    assert Settings().llm_provider == "none"
    assert get_active_provider() == "none"
    _clear_settings_cache()


def test_llm_provider_gemini_wins_when_both(monkeypatch):
    _set_required_env(monkeypatch)
    monkeypatch.setenv("GEMINI_API_KEY", "test-gemini-key")
    monkeypatch.setenv("OPENAI_API_KEY", "test-openai-key")
    _clear_settings_cache()
    assert Settings().llm_provider == "gemini"
    _clear_settings_cache()
