# MedWiki Data Contracts

Single source of truth for LangGraph shared state and agent I/O.

LLM backend (Gemini or OpenAI) is pluggable via environment keys; agent payload shapes below are unchanged regardless of provider.

## GraphState fields

| Field | Type | Written by |
|-------|------|------------|
| `patient_context` | `PatientContext` | API inject at start |
| `raw_transcript` | `str` | `ingest` |
| `valsea_metadata` | `ValseaMetadata` | `ingest` |
| `ground_truth_transcript` | `str` | `refine` |
| `resolved_entities` | `list[ResolvedEntity]` | `refine` |
| `symptoms` | `list[CitedInsight]` | `refine` |
| `dispatch_plan` | `DispatchPlan` | `dispatch` |
| `vitals_findings` | `list[CitedInsight]` | `vitals` |
| `safety_findings` | `list[SafetyFinding]` | `safety` |
| `advocate_summary` | `AdvocateOutput \| null` | `advocate` |
| `clinical_note` | `ClinicalNote \| null` | `clinical` |
| `integrity_report` | `IntegrityReport \| null` | `integrity` |
| `warnings` | `list[Warning]` | `safety`, `integrity` |
| `events` | `list[PipelineEvent]` | all nodes |
| `retry_count` | `int` | `integrity` |
| `run_id` | `str` | API |

## Core types

### CitedInsight

Every agent claim MUST include a `verbatim_citation` that is an exact substring of `ground_truth_transcript` (or `raw_transcript` before refinement completes).

- `claim`: human-readable insight
- `verbatim_citation`: exact transcript span
- `confidence`: `high` | `medium` | `low`
- `unverified`: if true, UI shows "Unverified - Doctor Review Required"

### SafetyFinding

Extends `CitedInsight` with:

- `severity`: `critical` | `moderate` | `low`
- `source`: `rxnav` | `openfda` | `patient_context`
- `action`: always `warn` in MVP (never block)

### PatientContext

Injected before graph run:

- `patient_id`, `display_name`
- `allergies[]`, `current_meds[]`
- `demographics` (age, sex)
- `linguistic_signature` (dialect label for advocate mirroring)

### DispatchPlan

Boolean flags: `run_vitals`, `run_safety`, `run_advocate`, `run_clinical`

### IntegrityReport

- `passed`: bool
- `issues[]`: citation/hallucination problems
- `retry_recommended`: bool
