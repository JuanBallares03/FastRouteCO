import pytest

from skills.plan_limit_check.skill import PlanLimitCheckSkill


def run(**params):
    base = {"resource": "branches", "current_count": 0, "max_allowed": 1, "modality": "subscription", "included_drivers": None}
    return PlanLimitCheckSkill().run({**base, **params})


def test_branch_limit():
    assert run(current_count=0)["allowed"] is True
    assert run(current_count=1)["allowed"] is False


def test_unlimited_plan():
    assert run(resource="drivers", current_count=500, max_allowed=None)["allowed"] is True


def test_pay_per_use_drivers_become_additional():
    result = run(resource="drivers", modality="pay_per_use", current_count=2, max_allowed=None, included_drivers=2)
    assert result == {"allowed": True, "is_additional": True, "reason": "Charged as an additional driver"}


def test_rejects_unknown_resource():
    with pytest.raises(ValueError):
        run(resource="vehicles")
