from __future__ import annotations

from app.clients.fixtures import FIXTURE_TRANSCRIPT_SINGLISH, FIXTURE_VALSEA_METADATA
from app.config import get_settings
from app.state.schemas import ValseaMetadata, dump_model

_VALSEA_LANGUAGE_ALIASES = {
    "en": "english",
    "en-us": "english-us",
    "en-gb": "english-gb",
    "english-uk": "english-gb",
    "singapore-english": "singlish",
    "sg-english": "singlish",
}
_VALSEA_SAFE_LANGUAGES = {
    "singlish",
    "english",
    "english-us",
    "english-gb",
    "english-in",
    "english-philippines",
    "sinhala",
    "tamil",
}


def _normalize_valsea_language(language_hint: str | None, default_language: str) -> str:
    fallback = (default_language or "singlish").strip().lower().replace("_", "-")
    fallback = "-".join(fallback.split()) or "singlish"
    if not language_hint:
        return fallback

    candidate = language_hint.strip().lower().replace("_", "-")
    candidate = "-".join(candidate.split())
    candidate = _VALSEA_LANGUAGE_ALIASES.get(candidate, candidate)
    return candidate if candidate in _VALSEA_SAFE_LANGUAGES else fallback


async def transcribe_audio(
    audio_bytes: bytes | None,
    *,
    use_fixture: bool = False,
    allow_fixture_fallback: bool = False,
    filename: str = "consultation.wav",
    content_type: str = "audio/wav",
    language: str | None = None,
) -> tuple[str, dict]:
    settings = get_settings()

    if use_fixture:
        meta = ValseaMetadata.model_validate(FIXTURE_VALSEA_METADATA)
        return FIXTURE_TRANSCRIPT_SINGLISH, dump_model(meta)

    if not audio_bytes:
        raise ValueError("No audio data to transcribe.")

    if not settings.valsea_api_key:
        if allow_fixture_fallback:
            meta = ValseaMetadata.model_validate(FIXTURE_VALSEA_METADATA)
            return FIXTURE_TRANSCRIPT_SINGLISH, dump_model(meta)
        raise ValueError(
            "VALSEA is not configured. Set VALSEA_API_KEY in backend/.env for live transcription."
        )

    # VALSEA RTT integration — uploads and live recordings use the same path
    try:
        import httpx

        request_language = _normalize_valsea_language(language, settings.valsea_language)
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.valsea_base_url.rstrip('/')}/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {settings.valsea_api_key}"},
                files={"file": (filename, audio_bytes, content_type)},
                data={
                    "model": settings.valsea_model,
                    "language": request_language,
                    "response_format": "json",
                },
            )
            response.raise_for_status()
            data = response.json()
            transcript = (data.get("text") or data.get("transcript") or "").strip()
            metadata = data.get("metadata")
            if not transcript:
                raise ValueError("VALSEA returned an empty transcript.")
            if isinstance(metadata, dict):
                return transcript, metadata
            if metadata:
                return transcript, dump_model(ValseaMetadata.model_validate(metadata))
            meta = ValseaMetadata(primary_dialect=request_language, accent_tags=[request_language])
            return transcript, dump_model(meta)
    except ValueError:
        raise
    except Exception as exc:
        if allow_fixture_fallback:
            meta = ValseaMetadata.model_validate(FIXTURE_VALSEA_METADATA)
            return FIXTURE_TRANSCRIPT_SINGLISH, dump_model(meta)
        response = getattr(exc, "response", None)
        detail = (response.text or "").strip() if response is not None else ""
        if detail:
            raise ValueError(f"VALSEA transcription failed: {detail}") from exc
        raise ValueError(f"VALSEA transcription failed: {exc}") from exc


async def transcribe_text(transcript: str, dialect: str = "English") -> tuple[str, dict]:
    meta = ValseaMetadata(primary_dialect=dialect, accent_tags=[dialect])
    return transcript, dump_model(meta)
