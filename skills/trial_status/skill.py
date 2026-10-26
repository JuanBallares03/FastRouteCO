"""Skill: Free Trial status (RF19, HU-16 CA06 and CA07).

Dates are ISO strings (YYYY-MM-DD). The caller passes `today` already calculated in America/Bogota,
so the skill stays deterministic and free of time zone logic.
"""

from datetime import date

from core.skill_base.base_skill import BaseSkill
from core.skill_base.skill_registry import register_skill

NOTICE_DAYS = 2  # HU-16 CA07: notify two days before the Free Trial ends


def _parse(params: dict, key: str) -> date:
    try:
        return date.fromisoformat(params.get(key))
    except (TypeError, ValueError):
        raise ValueError(f"'{key}' must be a date in YYYY-MM-DD format") from None


@register_skill
class TrialStatusSkill(BaseSkill):
    name = "trial_status"

    def run(self, params: dict) -> dict:
        renewal = _parse(params, "renewal_date")  # Free Trial expiration date (subscriptions.renewal_date)
        today = _parse(params, "today")
        days_remaining = max(0, (renewal - today).days)

        return {
            "days_remaining": days_remaining,
            "expired": today >= renewal,
            "notify_expiration": days_remaining == NOTICE_DAYS,
        }
