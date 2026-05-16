from __future__ import annotations

import json
from typing import Annotated

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from app.auth import get_current_user_id, verify_token
from app.clients.valsea import transcribe_audio
from app.config import _ENV_FILE, get_settings
from app.services.consultation_repo import (
    get_consultation as get_consultation_record,
    init_consultations_db,
    list_consultations_for_user,
)
from app.utils.audio_validation import validate_audio_payload
from app.utils.warnings import dedupe_warnings
from app.services.consultation_runner import run_consultation, store, stream_events
from app.services.user_profile import (
    add_medication,
    create_or_update_profile,
    get_profile,
    init_db as init_profiles_db,
)
from app.state.schemas import dump_model

app = FastAPI(title="MedWiki API", version="0.2.0")

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    import logging
    import threading
    _log = logging.getLogger("uvicorn.error")

    def _init_db_background() -> None:
        try:
            init_profiles_db()
            init_consultations_db()
            _log.info("MedWiki: Database tables initialised.")
        except Exception as exc:
            _log.warning(
                "MedWiki: Database init failed (%s). "
                "Set DATABASE_URL in backend/.env to a valid postgresql:// connection string. "
                "Endpoints that require the DB will return 503 until this is fixed.",
                exc,
            )

    threading.Thread(target=_init_db_background, daemon=True).start()

    provider = get_settings().llm_provider
    if provider == "none":
        _log.warning(
            "MedWiki: No LLM API key configured (llm_provider=none). "
            "Refinement and agents use heuristics only. "
            "Create backend/.env from .env.example and set GEMINI_API_KEY or OPENAI_API_KEY."
        )


class ProfileUpsertRequest(BaseModel):
    display_name: str
    allergies: list[str] = Field(default_factory=list)
    current_meds: list[str] = Field(default_factory=list)
    age: int | None = None
    sex: str | None = None
    linguistic_signature: str = "English"


class AcknowledgeWarningsRequest(BaseModel):
    warning_codes: list[str] = Field(default_factory=list)


class AddMedicationRequest(BaseModel):
    medication: str


@app.get("/health")
def health() -> dict:
    s = get_settings()
    return {
        "status": "ok",
        "service": "medwiki",
        "llm_provider": s.llm_provider,
        "llm_configured": s.llm_provider != "none",
        "env_file_loaded": _ENV_FILE.exists(),
    }


# --- Profile (the authenticated user) -----------------------------------------


@app.get("/me")
def me_get(user_id: str = Depends(get_current_user_id)) -> dict:
    try:
        profile = get_profile(user_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return dump_model(profile)


@app.post("/me")
def me_upsert(
    body: ProfileUpsertRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    try:
        profile = create_or_update_profile(
            user_id=user_id,
            display_name=body.display_name,
            allergies=body.allergies,
            current_meds=body.current_meds,
            age=body.age,
            sex=body.sex,
            linguistic_signature=body.linguistic_signature,
        )
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {exc}") from exc
    return dump_model(profile)


@app.post("/me/medications")
def me_add_medication(
    body: AddMedicationRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    profile = add_medication(user_id, body.medication)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return dump_model(profile)


@app.get("/me/consultations")
def me_consultations(
    user_id: str = Depends(get_current_user_id),
    limit: int = 20,
) -> list[dict]:
    return list_consultations_for_user(user_id, limit=limit)


# --- Consultations ------------------------------------------------------------


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
    user_id: Annotated[str, Depends(get_current_user_id)],
    transcript_text: Annotated[str | None, Form()] = None,
    use_fixture: Annotated[bool, Form()] = False,
    audio: UploadFile | None = File(None),
) -> dict:
    profile = get_profile(user_id)
    if not profile:
        raise HTTPException(
            status_code=400,
            detail="Profile not set up. POST /me first to create your profile.",
        )

    audio_bytes = None
    if audio is not None:
        audio_bytes = await audio.read()

    if not transcript_text and not audio_bytes and not use_fixture:
        use_fixture = True

    from uuid import uuid4

    run_id = str(uuid4())
    initial_state = {
        "run_id": run_id,
        "patient_context": dump_model(profile),
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


def _ensure_run_owned_by(run_id: str, user_id: str) -> dict | None:
    """Return the in-memory run dict if it exists and belongs to user_id;
    otherwise return None. Raises 403 if a foreign run is found in memory."""
    run = store.get(run_id)
    if not run:
        return None
    state = run.get("state", {})
    pc = state.get("patient_context") or {}
    owner = pc.get("patient_id") if isinstance(pc, dict) else None
    if owner and owner != user_id:
        raise HTTPException(status_code=403, detail="Run belongs to a different user")
    return run


@app.get("/consultations/{run_id}")
def consultations_get(
    run_id: str,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    run = _ensure_run_owned_by(run_id, user_id)
    if run:
        state = run.get("state", {})
        return {
            "run_id": run_id,
            "status": run.get("status"),
            "state": {k: v for k, v in state.items() if k != "audio_bytes"},
        }
    record = get_consultation_record(run_id)
    if not record:
        raise HTTPException(status_code=404, detail="Run not found")
    if record.get("user_id") and record["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Run belongs to a different user")
    return {
        "run_id": record["run_id"],
        "status": record["status"],
        "state": record["state"],
    }


@app.get("/consultations/{run_id}/events")
async def consultations_events(
    run_id: str,
    authorization: str | None = None,
    access_token: str | None = Query(default=None),
) -> EventSourceResponse:
    """SSE stream. Browsers' native EventSource cannot send Authorization
    headers, so this endpoint accepts the JWT as `?access_token=` instead.
    """
    if access_token:
        payload = verify_token(access_token)
        user_id = payload.get("sub")
    else:
        user_id = get_current_user_id(authorization)
    if not user_id:
        raise HTTPException(status_code=401, detail="Missing user")

    run = _ensure_run_owned_by(run_id, user_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    async def generator():
        async for item in stream_events(run_id):
            yield {"event": item.get("type", "message"), "data": json.dumps(item, default=str)}

    return EventSourceResponse(generator())


@app.post("/consultations/{run_id}/acknowledge-warnings")
def acknowledge_warnings(
    run_id: str,
    body: AcknowledgeWarningsRequest,
    user_id: str = Depends(get_current_user_id),
) -> dict:
    run = _ensure_run_owned_by(run_id, user_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    state = run.get("state", {})
    warnings = state.get("warnings", [])
    codes = set(body.warning_codes)
    for w in warnings:
        if w.get("code") in codes:
            w["dismissed"] = True
    return {"acknowledged": list(codes)}
