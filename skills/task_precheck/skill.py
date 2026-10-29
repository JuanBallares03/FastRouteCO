"""Skill: check existing work before a new task (avoid duplicating or overwriting it)."""

import subprocess
from pathlib import Path

from core.skill_base.base_skill import BaseSkill
from core.skill_base.skill_registry import register_skill

REPO_ROOT = Path(__file__).resolve().parents[2]
MAX_FILES = 200


def git(*args: str) -> list:
    result = subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, text=True, check=True)
    return [line for line in result.stdout.splitlines() if line.strip()]


@register_skill
class TaskPrecheckSkill(BaseSkill):
    name = "task_precheck"

    def run(self, params: dict) -> dict:
        paths = params.get("paths")
        if not isinstance(paths, list) or not all(isinstance(path, str) for path in paths):
            raise ValueError("'paths' must be a list of repository paths, for example ['backend/src/modules/company']")

        existing_files, missing_paths, valid_paths = [], [], []
        for relative in paths:
            path = (REPO_ROOT / relative).resolve()
            if REPO_ROOT not in path.parents and path != REPO_ROOT:
                raise PermissionError(f"Path outside the repository: {relative}")
            if not path.exists():
                missing_paths.append(relative)
                continue
            valid_paths.append(relative)
            files = [path] if path.is_file() else sorted(p for p in path.rglob("*") if p.is_file())
            for file in files:
                # .env files are never listed, even by name, to keep secrets out of the agent context.
                if file.name == ".env" or "node_modules" in file.parts:
                    continue
                existing_files.append(file.relative_to(REPO_ROOT).as_posix())

        recent_commits = git("log", "--oneline", "-10", "--", *valid_paths) if valid_paths else []
        uncommitted = git("status", "--porcelain", "--", *valid_paths) if valid_paths else []

        return {
            "existing_files": existing_files[:MAX_FILES],
            "recent_commits": recent_commits,
            "uncommitted_changes": uncommitted,
            "missing_paths": missing_paths,
        }
