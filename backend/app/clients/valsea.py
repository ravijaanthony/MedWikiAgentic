from __future__ import annotations

from app.clients.fixtures import FIXTURE_TRANSCRIPT_SINGLISH, FIXTURE_VALSEA_METADATA
from app.config import get_settings
from app.state.schemas import ValseaMetadata, dump_model


async def transcribe_audio(
    audio_bytes: bytes | None,
    *,
    use_fixture: bool = False,
    allow_fixture_fallback: bool = False,
    filename: str = "consultation.wav",
    content_type: str = "audio/wav",
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

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.valsea_base_url.rstrip('/')}/v1/transcribe",
                headers={"Authorization": f"Bearer {settings.valsea_api_key}"},
                files={"audio": (filename, audio_bytes, content_type)},
            )
            response.raise_for_status()
            data = response.json()
            transcript = (data.get("transcript") or "").strip()
            metadata = data.get("metadata", FIXTURE_VALSEA_METADATA)
            if not transcript:
                raise ValueError("VALSEA returned an empty transcript.")
            if isinstance(metadata, dict):
                return transcript, metadata
            return transcript, dump_model(ValseaMetadata.model_validate(metadata))
    except ValueError:
        raise
    except Exception as exc:
        if allow_fixture_fallback:
            meta = ValseaMetadata.model_validate(FIXTURE_VALSEA_METADATA)
            return FIXTURE_TRANSCRIPT_SINGLISH, dump_model(meta)
        raise ValueError(f"VALSEA transcription failed: {exc}") from exc


async def transcribe_text(transcript: str, dialect: str = "English") -> tuple[str, dict]:
    meta = ValseaMetadata(primary_dialect=dialect, accent_tags=[dialect])
    return transcript, dump_model(meta)
