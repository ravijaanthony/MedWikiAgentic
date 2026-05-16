from __future__ import annotations

from app.clients.fixtures import FIXTURE_TRANSCRIPT_SINGLISH, FIXTURE_VALSEA_METADATA
from app.config import get_settings
from app.state.schemas import ValseaMetadata, dump_model


async def transcribe_audio(audio_bytes: bytes | None, *, use_fixture: bool = False) -> tuple[str, dict]:
    settings = get_settings()
    if use_fixture or not settings.valsea_api_key or not audio_bytes:
        meta = ValseaMetadata.model_validate(FIXTURE_VALSEA_METADATA)
        return FIXTURE_TRANSCRIPT_SINGLISH, dump_model(meta)

    # VALSEA RTT integration placeholder — swap URL/body per VALSEA docs when key is set
    try:
        import httpx

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{settings.valsea_base_url.rstrip('/')}/v1/transcribe",
                headers={"Authorization": f"Bearer {settings.valsea_api_key}"},
                files={"audio": ("consultation.wav", audio_bytes, "audio/wav")},
            )
            response.raise_for_status()
            data = response.json()
            transcript = data.get("transcript", FIXTURE_TRANSCRIPT_SINGLISH)
            metadata = data.get("metadata", FIXTURE_VALSEA_METADATA)
            return transcript, metadata
    except Exception:
        meta = ValseaMetadata.model_validate(FIXTURE_VALSEA_METADATA)
        return FIXTURE_TRANSCRIPT_SINGLISH, dump_model(meta)


async def transcribe_text(transcript: str, dialect: str = "English") -> tuple[str, dict]:
    meta = ValseaMetadata(primary_dialect=dialect, accent_tags=[dialect])
    return transcript, dump_model(meta)
