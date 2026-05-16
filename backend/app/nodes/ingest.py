from __future__ import annotations

from app.clients.valsea import transcribe_audio, transcribe_text
from app.state.schemas import PipelineEvent, dump_model


async def ingest_node(state: dict) -> dict:
    events = [
        PipelineEvent(node="ingest", status="started", message="VALSEA transcription").model_dump()
    ]

    if state.get("transcript_text"):
        raw, meta = await transcribe_text(
            state["transcript_text"],
            dialect=state.get("patient_context", {}).get("linguistic_signature", "English"),
        )
    else:
        raw, meta = await transcribe_audio(
            state.get("audio_bytes"),
            use_fixture=state.get("use_fixture", False),
        )

    events.append(
        PipelineEvent(
            node="ingest",
            status="completed",
            message="Transcript captured",
            payload={"length": len(raw)},
        ).model_dump()
    )
    return {
        "raw_transcript": raw,
        "valsea_metadata": meta,
        "events": events,
    }
