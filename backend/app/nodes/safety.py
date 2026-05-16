from __future__ import annotations

from app.clients.openfda import search_indications, symptom_matches_indication
from app.clients.rxnav import check_interactions
from app.state.schemas import (
    PatientContext,
    PipelineEvent,
    SafetyFinding,
    Warning,
    patient_from_state,
)


def _allergy_hit(drug: str, allergies: list[str]) -> str | None:
    drug_l = drug.lower()
    for allergy in allergies:
        a = allergy.lower()
        if a in drug_l or drug_l in a:
            return allergy
        if "penicillin" in a and drug_l in ("amoxicillin", "ampicillin", "penicillin"):
            return allergy
    return None


async def safety_node(state: dict) -> dict:
    patient = patient_from_state(state.get("patient_context"))
    transcript = state.get("ground_truth_transcript", "")
    entities = state.get("resolved_entities", [])
    symptoms = state.get("symptoms", [])

    findings: list[dict] = []
    warnings: list[dict] = []

    drug_names = [e.get("generic", "") for e in entities if e.get("generic")]
    for entity in entities:
        generic = entity.get("generic", "")
        citation = entity.get("verbatim_citation", generic)
        allergy = _allergy_hit(generic, patient.allergies)
        if allergy:
            sf = SafetyFinding(
                claim=f"Possible allergy conflict: {generic} vs documented allergy ({allergy})",
                verbatim_citation=citation if citation in transcript else generic,
                confidence="high",
                severity="critical",
                source="patient_context",
            )
            findings.append(sf.model_dump())
            warnings.append(
                Warning(
                    code="ALLERGY_WARN",
                    message=f"{generic} may conflict with allergy: {allergy}. Doctor review required.",
                    severity="critical",
                ).model_dump()
            )

    all_drugs_display = list(dict.fromkeys(drug_names + patient.current_meds))
    interactions = await check_interactions(all_drugs_display)
    for interaction in interactions:
        desc = interaction.get("description", "Drug interaction")
        findings.append(
            SafetyFinding(
                claim=desc,
                verbatim_citation=drug_names[0] if drug_names else desc[:40],
                confidence="medium",
                severity=interaction.get("severity", "moderate"),
                source="rxnav",
                unverified=len(interactions) == 0,
            ).model_dump()
        )
        warnings.append(
            Warning(
                code="DDI_WARN",
                message=desc,
                severity=interaction.get("severity", "moderate"),
            ).model_dump()
        )

    for entity in entities:
        generic = entity.get("generic", "")
        if not generic:
            continue
        label = await search_indications(generic)
        if label is None:
            findings.append(
                SafetyFinding(
                    claim=f"OpenFDA label unavailable for {generic} — unverified indication check",
                    verbatim_citation=entity.get("verbatim_citation", generic),
                    confidence="low",
                    severity="low",
                    source="openfda",
                    unverified=True,
                ).model_dump()
            )
            continue
        indication_text = label.get("indications_text", "")
        matched = False
        for symptom in symptoms:
            claim = symptom.get("claim", "")
            if symptom_matches_indication(claim, indication_text):
                matched = True
                break
        if symptoms and not matched:
            findings.append(
                SafetyFinding(
                    claim=f"Symptoms may not align with {generic} indications per OpenFDA label",
                    verbatim_citation=entity.get("verbatim_citation", generic),
                    confidence="medium",
                    severity="moderate",
                    source="openfda",
                ).model_dump()
            )
            warnings.append(
                Warning(
                    code="INDICATION_WARN",
                    message=f"Review whether {generic} matches patient symptoms.",
                    severity="moderate",
                ).model_dump()
            )

    events = [
        PipelineEvent(
            node="safety",
            status="completed",
            message=f"{len(findings)} safety findings (warn-only)",
        ).model_dump()
    ]
    return {"safety_findings": findings, "warnings": warnings, "events": events}
