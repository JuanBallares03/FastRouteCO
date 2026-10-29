"""Skill: project context for a new session (sessions do not remember each other)."""

import subprocess
from pathlib import Path

from core.skill_base.base_skill import BaseSkill
from core.skill_base.skill_registry import register_skill

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCES_OF_TRUTH = [
    "docs/build-plan.md",
    "README.md",
    "docs/data-model/entity-relationship-model.sql",
    "docs/user-stories/user-stories.xlsx",
]


def git(*args: str) -> list:
    result = subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=True)
    return [line for line in result.stdout.splitlines() if line.strip()]


@register_skill
class SessionContextSkill(BaseSkill):
    name = "session_context"

    def run(self, params: dict) -> dict:
        existing = [path for path in SOURCES_OF_TRUTH if (REPO_ROOT / path).exists()]
        missing = [path for path in SOURCES_OF_TRUTH if path not in existing]

        progress = []
        build_plan = REPO_ROOT / "docs" / "build-plan.md"
        if build_plan.exists():
            progress = [
                line.strip()
                for line in build_plan.read_text(encoding="utf-8").splitlines()
                if line.strip().startswith("Progress:")
            ]

        return {
            "sources_of_truth": existing,
            "missing_sources": missing,
            "progress": progress,
            "uncommitted_changes": git("status", "--porcelain"),
            "recent_commits": git("log", "--oneline", "-10"),
        }
