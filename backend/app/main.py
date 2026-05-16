from __future__ import annotations

import json
from typing import Annotated

from fastapi import BackgroundTasks, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.clients.valsea import transcribe_audio
from app.config import _ENV_FILE, get_settings
from app.utils.audio_validation import validate_audio_payload
from app.utils.warnings import dedupe_warnings
from app.services.consultation_runner import run_consultation, store, stream_events
from app.services.patient_context import (
    add_medication,
    create_patient,
    get_patient,
    init_db,
    list_patients,
)
from app.state.schemas import dump_model

app = FastAPI(title="MedWiki API", version="0.1.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _seed_demo_patient() -> None:
    if list_patients():
        return
    create_patient(
        display_name="Mr Tan (Demo)",
        allergies=["penicillin"],
        current_meds=["Metformin 500mg"],
        age=58,
        sex="M",
        linguistic_signature="Singlish",
    )


@app.on_event("startup")
def startup() -> None:
    init_db()
    _seed_demo_patient()
    provider = get_settings().llm_provider
    if provider == "none":
        import logging

        logging.getLogger("uvicorn.error").warning(
            "MedWiki: No LLM API key configured (llm_provider=none). "
            "Refinement and agents use heuristics only. "
            "Create backend/.env from .env.example and set GEMINI_API_KEY or OPENAI_API_KEY."
        )


class PatientCreateRequest(BaseModel):
    display_name: str
    allergies: list[str] = Field(default_factory=list)
    current_meds: list[str] = Field(default_factory=list)
    age: int | None = None
    sex: str | None = None
    linguistic_signature: str = "Singlish"


class AcknowledgeWarningsRequest(BaseModel):
    warning_codes: list[str] = Field(default_factory=list)


class AddMedicationRequest(BaseModel):
    medication: str


@app.get("/health")
def health() -> dict:
    settings = get_settings()
    return {
        "status": "ok",
        "service": "medwiki",
        "llm_provider": settings.llm_provider,
        "llm_configured": settings.llm_provider != "none",
        "env_file_loaded": _ENV_FILE.exists(),
    }


@app.get("/patients")
def patients_list() -> list[dict]:
    return [dump_model(p) for p in list_patients()]


@app.post("/patients")
def patients_create(body: PatientCreateRequest) -> dict:
    patient = create_patient(
        display_name=body.display_name,
        allergies=body.allergies,
        current_meds=body.current_meds,
        age=body.age,
        sex=body.sex,
        linguistic_signature=body.linguistic_signature,
    )
    return dump_model(patient)


@app.get("/patients/{patient_id}")
def patients_get(patient_id: str) -> dict:
    patient = get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return dump_model(patient)


@app.post("/patients/{patient_id}/medications")
def patients_add_med(patient_id: str, body: AddMedicationRequest) -> dict:
    patient = add_medication(patient_id, body.medication)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return dump_model(patient)


@app.post("/transcribe")
async def transcribe_consultation_audio(
    audio: UploadFile = File(...),
    patient_id: Annotated[str | None, Form()] = None,
    duration_seconds: Annotated[float | None, Form()] = None,
    allow_demo_fallback: Annotated[bool, Form()] = False,
) -> dict:
    """Transcribe audio via VALSEA. Rejects empty/silent clips; demo fallback only when opted in."""
    settings = get_settings()
    audio_bytes = await audio.read()
    try:
        validate_audio_payload(audio_bytes, duration_seconds=duration_seconds)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    dialect = "English"
    if patient_id:
        patient = get_patient(patient_id)
        if patient:
            dialect = patient.linguistic_signature

    filename = audio.filename or "consultation.webm"
    content_type = audio.content_type or "audio/webm"
    try:
        raw, meta = await transcribe_audio(
            audio_bytes,
            use_fixture=False,
            allow_fixture_fallback=allow_demo_fallback,
            filename=filename,
            content_type=content_type,
            language=dialect,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    source = "valsea" if settings.valsea_api_key else "fixture"
    return {
        "transcript": raw,
        "metadata": meta,
        "source": source,
        "dialect": dialect,
    }


@app.post("/consultations")
async def consultations_create(
    background_tasks: BackgroundTasks,
    patient_id: Annotated[str, Form(...)],
    transcript_text: Annotated[str | None, Form()] = None,
    use_fixture: Annotated[bool, Form()] = False,
    audio: UploadFile | None = File(None),
) -> dict:
    patient = get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    audio_bytes = None
    if audio is not None:
        audio_bytes = await audio.read()

    if not transcript_text and not audio_bytes and not use_fixture:
        use_fixture = True

    from uuid import uuid4

    run_id = str(uuid4())
    initial_state = {
        "run_id": run_id,
        "patient_context": dump_model(patient),
        "transcript_text": transcript_text,
        "audio_bytes": audio_bytes,
        "use_fixture": use_fixture,
        "warnings": [],
        "events": [],
        "retry_count": 0,
    }
    store.set(run_id, {"status": "queued", "state": initial_state})
    background_tasks.add_task(run_consultation, initial_state)
    return {"run_id": run_id, "status": "queued"}


@app.get("/consultations/{run_id}")
def consultations_get(run_id: str) -> dict:
    run = store.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    state = run.get("state", {})
    return {"run_id": run_id, "status": run.get("status"), "state": {k: v for k, v in state.items() if k != "audio_bytes"}}


@app.get("/consultations/{run_id}/events")
async def consultations_events(run_id: str) -> EventSourceResponse:
    if not store.get(run_id):
        raise HTTPException(status_code=404, detail="Run not found")

    async def generator():
        async for item in stream_events(run_id):
            yield {"event": item.get("type", "message"), "data": json.dumps(item, default=str)}

    return EventSourceResponse(generator())


@app.post("/consultations/{run_id}/acknowledge-warnings")
def acknowledge_warnings(run_id: str, body: AcknowledgeWarningsRequest) -> dict:
    run = store.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    state = run.get("state", {})
    warnings = state.get("warnings", [])
    codes = set(body.warning_codes)
    for w in warnings:
        if w.get("code") in codes:
            w["dismissed"] = True
    return {"acknowledged": list(codes)}
