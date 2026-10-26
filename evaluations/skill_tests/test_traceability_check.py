import pytest

from skills.traceability_check.skill import TraceabilityCheckSkill


def test_finds_and_normalizes_valid_references():
    result = TraceabilityCheckSkill().run({"text": "Implements HU-20, RF02, RNF09 and CU-05 (also hu-20 is ignored)"})
    assert result == {
        "references": ["CU-05", "HU-20", "RF02", "RNF09"],
        "invalid": [],
        "has_traceability": True,
    }


def test_flags_references_out_of_range():
    result = TraceabilityCheckSkill().run({"text": "See HU-40 and RF32"})
    assert result["invalid"] == ["HU-40", "RF32"]
    assert result["has_traceability"] is False


def test_text_without_references():
    assert TraceabilityCheckSkill().run({"text": "Refactor helpers"})["has_traceability"] is False


def test_rejects_invalid_input():
    with pytest.raises(ValueError):
        TraceabilityCheckSkill().run({"text": 123})
