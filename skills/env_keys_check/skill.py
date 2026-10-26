"""Skill: checks that a .env has every variable of .env.example, returning names only (never values)."""

from pathlib import Path

from core.skill_base.base_skill import BaseSkill
from core.skill_base.skill_registry import register_skill

REPO_ROOT = Path(__file__).resolve().parents[2]


def _read_keys(path: Path) -> dict:
    # Returns {key: is_empty}; values are discarded right away so they never leave this function.
    keys = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        keys[key.strip()] = value.strip().strip("'\"") == ""
    return keys


def _resolve(relative: str) -> Path:
    path = (REPO_ROOT / relative).resolve()
    if REPO_ROOT not in path.parents or not path.name.startswith(".env"):
        raise PermissionError("Only .env files inside the repository are allowed")
    return path


@register_skill
class EnvKeysCheckSkill(BaseSkill):
    name = "env_keys_check"

    def run(self, params: dict) -> dict:
        example_file = params.get("example_file")
        env_file = params.get("env_file")
        if not isinstance(example_file, str) or not isinstance(env_file, str):
            raise ValueError("'example_file' and 'env_file' must be strings")

        expected = _read_keys(_resolve(example_file))
        actual = _read_keys(_resolve(env_file))

        return {
            "missing_keys": sorted(set(expected) - set(actual)),
            "empty_keys": sorted(key for key, empty in actual.items() if key in expected and empty),
            "extra_keys": sorted(set(actual) - set(expected)),
        }
