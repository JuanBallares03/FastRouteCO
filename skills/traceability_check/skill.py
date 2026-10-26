"""Skill: validates traceability references (HU, RF, RNF, CU) in plans, commits or docs."""

import re

from core.skill_base.base_skill import BaseSkill
from core.skill_base.skill_registry import register_skill

# Valid ranges defined in README.md, the user stories and the use case diagrams.
RANGES = {"HU": (1, 39), "RF": (1, 31), "RNF": (1, 11), "CU": (1, 43)}
PATTERN = re.compile(r"\b(HU|RNF|RF|CU)-?(\d{1,2})\b")


def _normalize(prefix: str, number: int) -> str:
    # HU and CU use a hyphen (HU-01); RF and RNF do not (RF01).
    separator = "-" if prefix in ("HU", "CU") else ""
    return f"{prefix}{separator}{number:02d}"


@register_skill
class TraceabilityCheckSkill(BaseSkill):
    name = "traceability_check"

    def run(self, params: dict) -> dict:
        text = params.get("text")
        if not isinstance(text, str):
            raise ValueError("'text' must be a string")

        references, invalid = set(), set()
        for prefix, digits in PATTERN.findall(text):
            number = int(digits)
            reference = _normalize(prefix, number)
            low, high = RANGES[prefix]
            (references if low <= number <= high else invalid).add(reference)

        return {
            "references": sorted(references),
            "invalid": sorted(invalid),
            "has_traceability": bool(references) and not invalid,
        }
