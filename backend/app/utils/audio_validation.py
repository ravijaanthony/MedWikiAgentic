from __future__ import annotations

# WebM/Opus silence is typically a few KB; real speech is usually larger.
MIN_AUDIO_BYTES = 2_048
MIN_RECORDING_SECONDS = 1.0


def validate_audio_payload(
    audio_bytes: bytes | None,
    *,
    duration_seconds: float | None = None,
) -> None:
    if not audio_bytes:
        raise ValueError("No audio data received.")
    if len(audio_bytes) < MIN_AUDIO_BYTES:
        raise ValueError(
            "Recording is too short or silent. Speak for at least one second, then stop."
        )
    if duration_seconds is not None and duration_seconds < MIN_RECORDING_SECONDS:
        raise ValueError(
            "Recording is too short. Speak for at least one second before stopping."
        )
