import pytest

from skills.usage_charge_calculator.skill import UsageChargeCalculatorSkill

BASE = {
    "successful_optimizations": 100,
    "price_per_optimization": 700,
    "active_drivers": 4,
    "included_drivers": 2,
    "price_per_additional_driver": 29900,
    "early_charge_threshold": 500000,
    "spending_limit": None,
}  # placeholder prices (TO BE DEFINED)


def test_amount_and_additional_drivers():
    result = UsageChargeCalculatorSkill().run(BASE)
    assert result["additional_drivers"] == 2
    assert result["amount"] == 100 * 700 + 2 * 29900
    assert result["early_charge_due"] is False
    assert result["limit_reached"] is False


def test_early_charge_and_spending_limit():
    result = UsageChargeCalculatorSkill().run({**BASE, "successful_optimizations": 800, "spending_limit": 600000})
    assert result["early_charge_due"] is True
    assert result["limit_alert"] is True
    assert result["limit_reached"] is True


def test_rejects_negative_values():
    with pytest.raises(ValueError):
        UsageChargeCalculatorSkill().run({**BASE, "active_drivers": -1})
