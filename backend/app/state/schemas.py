from __future__ import annotations

import operator
from typing import Annotated, Literal, TypedDict

from pydantic import BaseModel, Field


class Demographics(BaseModel):
    age: int | None = None
    sex: str | None = None


class PatientContext(BaseModel):
    patient_id: str
    display_name: str
    allergies: list[str] = Field(default_factory=list)
    current_meds: list[str] = Field(default_factory=list)
    demographics: Demographics = Field(default_factory=Demographics)
    linguistic_signature: str = "English"


class CodeSwitchSegment(BaseModel):
    text: str
    dialect: str
    start: int = 0
    end: int = 0


class ValseaMetadata(BaseModel):
    primary_dialect: str = "English"
    code_switch_segments: list[CodeSwitchSegment] = Field(default_factory=list)
    accent_tags: list[str] = Field(default_factory=list)


class CitedInsight(BaseModel):
    claim: str
    verbatim_citation: str
    confidence: Literal["high", "medium", "low"] = "medium"
    unverified: bool = False


class ResolvedEntity(BaseModel):
    brand: str | None = None
    generic: str
    confidence: Literal["high", "medium", "low"] = "medium"
    verbatim_citation: str


class SafetyFinding(CitedInsight):
    severity: Literal["critical", "moderate", "low"] = "moderate"
    source: Literal["rxnav", "openfda", "patient_context"] = "patient_context"
    action: Literal["warn"] = "warn"


class Warning(BaseModel):
    code: str
    message: str
    severity: Literal["critical", "moderate", "low"] = "moderate"
    dismissed: bool = False


class DispatchPlan(BaseModel):
    run_vitals: bool = True
    run_safety: bool = True
    run_advocate: bool = True
    run_clinical: bool = True


class AdvocateOutput(BaseModel):
    summary: str
    dialect_label: str
    citations: list[str] = Field(default_factory=list)
    unverified: bool = False
    source: Literal["llm", "heuristic"] = "llm"


class ClinicalNoteSection(BaseModel):
    title: str
    content: str
    citations: list[str] = Field(default_factory=list)


class ClinicalNote(BaseModel):
    sections: list[ClinicalNoteSection] = Field(default_factory=list)


class IntegrityIssue(BaseModel):
    field: str
    message: str
    citation: str | None = None


class IntegrityReport(BaseModel):
    passed: bool
    issues: list[IntegrityIssue] = Field(default_factory=list)
    retry_recommended: bool = False


class PipelineEvent(BaseModel):
    node: str
    status: Literal["started", "completed", "failed"] = "completed"
    message: str = ""
    payload: dict = Field(default_factory=dict)


def merge_events(left: list[dict], right: list[dict]) -> list[dict]:
    return left + right


class GraphState(TypedDict, total=False):
    run_id: str
    patient_context: dict
    raw_transcript: str
    valsea_metadata: dict
    ground_truth_transcript: str
    resolved_entities: list[dict]
    symptoms: list[dict]
    dispatch_plan: dict
    vitals_findings: list[dict]
    safety_findings: list[dict]
    advocate_summary: dict | None
    clinical_note: dict | None
    integrity_report: dict | None
    warnings: Annotated[list[dict], operator.add]
    events: Annotated[list[dict], merge_events]
    retry_count: int
    audio_bytes: bytes | None
    transcript_text: str | None
    use_fixture: bool


def patient_from_state(data: dict | None) -> PatientContext:
    if not data:
        raise ValueError("patient_context is required")
    return PatientContext.model_validate(data)


def dump_model(model: BaseModel) -> dict:
    return model.model_dump(mode="json")
