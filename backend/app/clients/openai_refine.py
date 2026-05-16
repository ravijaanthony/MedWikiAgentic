from __future__ import annotations

import logging
import re

from app.clients.llm_client import complete_json, get_active_provider

logger = logging.getLogger(__name__)
from app.state.schemas import CitedInsight, ResolvedEntity

REFINE_SYSTEM = """You are a medical transcript refinement engine for Southeast Asian clinical speech.
Tasks:
1. Produce a cleaned ground_truth_transcript preserving meaning.
2. Map brand drug names to generic (e.g. Panadol -> paracetamol).
3. Extract symptoms with verbatim citations from the transcript.

Return JSON only:
{
  "ground_truth_transcript": "...",
  "resolved_entities": [{"brand": "...", "generic": "...", "confidence": "high|medium|low", "verbatim_citation": "..."}],
  "symptoms": [{"claim": "...", "verbatim_citation": "...", "confidence": "high|medium|low", "unverified": false}]
}
Every verbatim_citation MUST be an exact substring of the input transcript."""


async def refine_transcript(raw_transcript: str, dialect: str) -> dict:
    provider = get_active_provider()
    if provider == "none":
        logger.warning(
            "LLM refine skipped: no GEMINI_API_KEY or OPENAI_API_KEY. "
            "Copy backend/.env.example to backend/.env and set a key. Using heuristic fallback."
        )
        return _heuristic_refine(raw_transcript)

    result = await complete_json(
        REFINE_SYSTEM,
        f"Dialect: {dialect}\n\nTranscript:\n{raw_transcript}",
        model_kind="refine",
    )
    if not result:
        logger.warning("LLM refine failed for provider=%s; using heuristic fallback", provider)
        return _heuristic_refine(raw_transcript)
    logger.info("LLM refine completed via provider=%s", provider)
    return result


def _heuristic_refine(raw_transcript: str) -> dict:
    entities: list[dict] = []
    brand_map = {
        "Panadol": "paracetamol",
        "Amoxicillin": "amoxicillin",
        "Metformin": "metformin",
    }
    for brand, generic in brand_map.items():
        if brand.lower() in raw_transcript.lower():
            idx = raw_transcript.lower().find(brand.lower())
            span = raw_transcript[idx : idx + len(brand)]
            entities.append(
                ResolvedEntity(
                    brand=brand,
                    generic=generic,
                    confidence="high",
                    verbatim_citation=span,
                ).model_dump()
            )

    symptoms: list[dict] = []
    for kw in ["fever", "cough", "infection"]:
        if kw in raw_transcript.lower():
            idx = raw_transcript.lower().find(kw)
            span = raw_transcript[idx : idx + len(kw)]
            symptoms.append(
                CitedInsight(
                    claim=f"Patient reports {kw}",
                    verbatim_citation=span,
                    confidence="high",
                ).model_dump()
            )

    return {
        "ground_truth_transcript": raw_transcript,
        "resolved_entities": entities,
        "symptoms": symptoms,
    }


async def run_agent_json(system: str, user: str) -> dict:
    if get_active_provider() == "none":
        return {}
    return await complete_json(system, user, model_kind="agent")


def citation_in_transcript(citation: str, transcript: str, threshold: float = 0.85) -> bool:
    if not citation or not transcript:
        return False
    if citation in transcript:
        return True
    norm_c = re.sub(r"\s+", " ", citation.strip().lower())
    norm_t = re.sub(r"\s+", " ", transcript.strip().lower())
    return norm_c in norm_t
