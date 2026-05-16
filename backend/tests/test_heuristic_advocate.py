from app.clients.heuristic_agents import heuristic_advocate_summary


def test_advocate_heuristic_uses_transcript_not_template():
    transcript = (
        "Doctor: Please take ibuprofen 200mg after meals. "
        "Patient: I will follow that. No fever today."
    )
    summary, citations = heuristic_advocate_summary(
        transcript, "Sathindu", "English", ["penicillin"]
    )
    assert "ibuprofen" in summary.lower() or "ibuprofen" in " ".join(citations).lower()
    assert "fever still high" not in summary
    assert "Drink more water" not in summary


def test_advocate_heuristic_singlish_greeting_when_lah_in_transcript():
    transcript = "Doctor: Rest well lah. Patient: Okay doctor."
    summary, _ = heuristic_advocate_summary(transcript, "Tan", "Singlish", [])
    assert summary.startswith("Okay Tan,")
