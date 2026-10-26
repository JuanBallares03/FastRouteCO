"""Skill: plan limits for branches and drivers (HU-26 CA03, HU-27 CA04)."""

from core.skill_base.base_skill import BaseSkill
from core.skill_base.skill_registry import register_skill

RESOURCES = {"branches", "drivers"}
MODALITIES = {"subscription", "pay_per_use"}


@register_skill
class PlanLimitCheckSkill(BaseSkill):
    name = "plan_limit_check"

    def run(self, params: dict) -> dict:
        resource = params.get("resource")
        modality = params.get("modality")
        current = params.get("current_count")
        max_allowed = params.get("max_allowed")  # None = unlimited (for example Premium)
        if resource not in RESOURCES:
            raise ValueError(f"'resource' must be one of {sorted(RESOURCES)}")
        if modality not in MODALITIES:
            raise ValueError(f"'modality' must be one of {sorted(MODALITIES)}")
        if not isinstance(current, int) or current < 0:
            raise ValueError("'current_count' must be a non-negative integer")

        # Pay-per-use: drivers above the included ones are allowed and charged as additional.
        if resource == "drivers" and modality == "pay_per_use":
            included = params.get("included_drivers") or 0
            is_additional = current + 1 > included
            reason = "Charged as an additional driver" if is_additional else "Included in the membership"
            return {"allowed": True, "is_additional": is_additional, "reason": reason}

        if max_allowed is None:
            return {"allowed": True, "is_additional": False, "reason": "Unlimited in the current plan"}

        allowed = current < max_allowed
        reason = "Within the plan limit" if allowed else f"Plan limit reached ({max_allowed} {resource})"
        return {"allowed": allowed, "is_additional": False, "reason": reason}
