from __future__ import annotations

import json
import logging
from typing import Literal

from app.config import LlmProvider, get_settings

logger = logging.getLogger(__name__)

ModelKind = Literal["refine", "agent"]


def get_active_provider() -> LlmProvider:
    return get_settings().llm_provider


def _model_name(kind: ModelKind, provider: LlmProvider) -> str:
    settings = get_settings()
    if provider == "gemini":
        return settings.gemini_refine_model if kind == "refine" else settings.gemini_agent_model
    return settings.openai_refine_model if kind == "refine" else settings.openai_agent_model


async def complete_json(system: str, user: str, *, model_kind: ModelKind = "agent") -> dict:
    provider = get_active_provider()
    if provider == "none":
        return {}

    model = _model_name(model_kind, provider)
    try:
        if provider == "gemini":
            return await _complete_gemini(system, user, model)
        return await _complete_openai(system, user, model)
    except Exception:
        logger.exception("LLM completion failed (%s, %s)", provider, model)
        return {}


async def _complete_openai(system: str, user: str, model: str) -> dict:
    from openai import AsyncOpenAI

    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    content = response.choices[0].message.content or "{}"
    return json.loads(content)


async def _complete_gemini(system: str, user: str, model: str) -> dict:
    from google import genai
    from google.genai import types

    settings = get_settings()
    client = genai.Client(api_key=settings.gemini_api_key)
    response = await client.aio.models.generate_content(
        model=model,
        contents=f"{system}\n\n{user}",
        config=types.GenerateContentConfig(
            temperature=0.2,
            response_mime_type="application/json",
        ),
    )
    text = response.text or "{}"
    return json.loads(text)
