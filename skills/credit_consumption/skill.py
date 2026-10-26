"""Skill: credit consumption for one route optimization (RF20, HU-16 CA01-CA03, HU-16 R02)."""

from core.skill_base.base_skill import BaseSkill
from core.skill_base.skill_registry import register_skill

LOW_BALANCE_RATIO = 0.2  # HU-16 CA03: alert when plan credits drop below 20 %


def _non_negative_int(params: dict, key: str) -> int:
    value = params.get(key)
    if not isinstance(value, int) or isinstance(value, bool) or value < 0:
        raise ValueError(f"'{key}' must be a non-negative integer")
    return value


@register_skill
class CreditConsumptionSkill(BaseSkill):
    name = "credit_consumption"

    def run(self, params: dict) -> dict:
        plan = _non_negative_int(params, "plan_credits")
        extra = _non_negative_int(params, "extra_credits")
        monthly = _non_negative_int(params, "monthly_credits")
        successful = params.get("optimization_successful")
        if not isinstance(successful, bool):
            raise ValueError("'optimization_successful' must be a boolean")

        allowed = plan + extra > 0  # HU-16 R02: no credits, no optimization
        consumed_from = "none"
        if allowed and successful:  # failed optimizations do not consume credits
            if plan > 0:
                plan, consumed_from = plan - 1, "plan"
            else:
                extra, consumed_from = extra - 1, "extra"

        return {
            "allowed": allowed,
            "consumed_from": consumed_from,
            "plan_credits": plan,
            "extra_credits": extra,
            "low_balance_alert": monthly > 0 and plan < monthly * LOW_BALANCE_RATIO,
            "blocked": plan + extra == 0,
        }
