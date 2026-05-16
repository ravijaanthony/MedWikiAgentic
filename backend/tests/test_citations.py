from app.clients.openai_refine import citation_in_transcript
from app.state.schemas import CitedInsight


def test_citation_must_be_substring():
    transcript = "Patient has fever and cough for three days."
    assert citation_in_transcript("fever", transcript)
    assert not citation_in_transcript("diabetes", transcript)


def test_cited_insight_model():
    insight = CitedInsight(
        claim="Fever noted",
        verbatim_citation="fever",
        confidence="high",
    )
    assert insight.claim == "Fever noted"
