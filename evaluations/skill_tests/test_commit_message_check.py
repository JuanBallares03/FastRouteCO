import pytest

from skills.commit_message_check.skill import CommitMessageCheckSkill


def test_valid_message():
    result = CommitMessageCheckSkill().run({"message": "feat(backend): add companies module\n\nHU-20, HU-21"})
    assert result == {"valid": True, "type": "feat", "scope": "backend", "errors": []}


def test_missing_type_is_invalid():
    result = CommitMessageCheckSkill().run({"message": "mobile: change dev script"})
    assert result["valid"] is False


def test_unknown_type_scope_and_style():
    result = CommitMessageCheckSkill().run({"message": "update(server): Added things."})
    assert result["valid"] is False
    assert len(result["errors"]) == 4


def test_rejects_empty_message():
    with pytest.raises(ValueError):
        CommitMessageCheckSkill().run({"message": "  "})
