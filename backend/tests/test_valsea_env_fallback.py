from pathlib import Path

import app.config as config_module
from app.config import get_settings


def _clear_settings_cache() -> None:
    get_settings.cache_clear()


def test_valsea_key_falls_back_to_global_env(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("VALSEA_API_KEY", "")
    global_env = tmp_path / ".env"
    global_env.write_text("VALSEA_API_KEY=test-root-valsea-key\n", encoding="utf-8")
    monkeypatch.setattr(config_module, "_GLOBAL_ENV_FILE", global_env)

    _clear_settings_cache()
    settings = get_settings()
    assert settings.valsea_api_key == "test-root-valsea-key"
    _clear_settings_cache()


def test_global_env_only_overrides_valsea_key(monkeypatch, tmp_path: Path):
    monkeypatch.setenv("VALSEA_API_KEY", "")
    monkeypatch.setenv("OPENAI_API_KEY", "")
    global_env = tmp_path / ".env"
    global_env.write_text(
        "VALSEA_API_KEY=test-root-valsea-key\nOPENAI_API_KEY=should-not-be-loaded\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(config_module, "_GLOBAL_ENV_FILE", global_env)

    _clear_settings_cache()
    settings = get_settings()
    assert settings.valsea_api_key == "test-root-valsea-key"
    assert settings.openai_api_key == ""
    _clear_settings_cache()

