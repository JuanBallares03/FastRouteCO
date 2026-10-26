"""Skill: pay-per-use charge for a billing period (RF29-RF31, HU-37 CA04, HU-38 CA01, HU-39 CA02-CA03)."""

from core.skill_base.base_skill import BaseSkill
from core.skill_base.skill_registry import register_skill

LIMIT_ALERT_RATIO = 0.8  # HU-39 CA02: alert at 80 % of the spending limit


def _number(params: dict, key: str, integer: bool = False) -> float:
    value = params.get(key)
    valid_type = int if integer else (int, float)
    if not isinstance(value, valid_type) or isinstance(value, bool) or value < 0:
        kind = "non-negative integer" if integer else "non-negative number"
        raise ValueError(f"'{key}' must be a {kind}")
    return value


@register_skill
class UsageChargeCalculatorSkill(BaseSkill):
    name = "usage_charge_calculator"

    def run(self, params: dict) -> dict:
        optimizations = _number(params, "successful_optimizations", integer=True)
        price_optimization = _number(params, "price_per_optimization")
        active = _number(params, "active_drivers", integer=True)
        included = _number(params, "included_drivers", integer=True)
        price_driver = _number(params, "price_per_additional_driver")
        threshold = _number(params, "early_charge_threshold")
        limit = params.get("spending_limit")  # optional (HU-39 R02): None means no limit
        if limit is not None:
            limit = _number(params, "spending_limit")

        additional = max(0, active - included)
        amount = round(optimizations * price_optimization + additional * price_driver, 2)

        return {
            "additional_drivers": additional,
            "amount": amount,
            "early_charge_due": threshold > 0 and amount >= threshold,
            "limit_alert": limit is not None and amount >= limit * LIMIT_ALERT_RATIO,
            "limit_reached": limit is not None and amount >= limit,
        }
