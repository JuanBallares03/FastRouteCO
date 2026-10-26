import pytest

from skills.credit_consumption.skill import CreditConsumptionSkill


def run(plan, extra, successful=True, monthly=50):
    return CreditConsumptionSkill().run(
        {"plan_credits": plan, "extra_credits": extra, "monthly_credits": monthly, "optimization_successful": successful}
    )


def test_consumes_plan_credits_first():
    result = run(10, 5)
    assert (result["consumed_from"], result["plan_credits"], result["extra_credits"]) == ("plan", 9, 5)


def test_uses_extra_credits_when_plan_is_empty():
    result = run(0, 5)
    assert (result["consumed_from"], result["plan_credits"], result["extra_credits"]) == ("extra", 0, 4)


def test_failed_optimization_is_free():
    result = run(10, 5, successful=False)
    assert (result["consumed_from"], result["plan_credits"]) == ("none", 10)


def test_low_balance_alert_and_block():
    assert run(10, 0)["low_balance_alert"] is True  # 9 < 20 % of 50
    blocked = run(0, 0)
    assert blocked["allowed"] is False
    assert blocked["blocked"] is True


def test_rejects_negative_credits():
    with pytest.raises(ValueError):
        run(-1, 0)
