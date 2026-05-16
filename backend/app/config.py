from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

LlmProvider = Literal["gemini", "openai", "none"]

_BACKEND_ROOT = Path(__file__).resolve().parent.parent
_ENV_FILE = _BACKEND_ROOT / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE) if _ENV_FILE.exists() else None,
        env_file_encoding="utf-8",
        extra="ignore",
    )

    gemini_api_key: str = ""
    gemini_refine_model: str = "gemini-2.0-flash"
    gemini_agent_model: str = "gemini-2.0-flash"

    openai_api_key: str = ""
    openai_refine_model: str = "gpt-4o-mini"
    openai_agent_model: str = "gpt-4o-mini"

    valsea_api_key: str = ""
    valsea_base_url: str = "https://api.valsea.ai"

    database_url: str = ""
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    @field_validator("database_url")
    @classmethod
    def validate_database_url(cls, value: str) -> str:
        url = value.strip()
        if not url:
            raise ValueError("DATABASE_URL is required (Supabase PostgreSQL connection string)")
        if not url.startswith(("postgresql://", "postgres://")):
            raise ValueError("DATABASE_URL must start with postgresql:// or postgres://")
        return url

    @property
    def llm_provider(self) -> LlmProvider:
        if self.gemini_api_key:
            return "gemini"
        if self.openai_api_key:
            return "openai"
        return "none"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
