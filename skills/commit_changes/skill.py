"""Skill: commit changes the agreed way (Conventional Commits in English, one logical change per commit)."""

import re
import subprocess
from pathlib import Path

from core.skill_base.base_skill import BaseSkill
from core.skill_base.skill_registry import register_skill

REPO_ROOT = Path(__file__).resolve().parents[2]
TYPES = {"feat", "fix", "chore", "docs", "test", "refactor"}
SCOPES = {"backend", "web", "mobile", "ci", "opencode", "skills", "readme", "build-plan", "design", "data-model"}
HEADER = re.compile(r"^(?P<type>[a-z]+)(\((?P<scope>[a-z0-9-]+)\))?: (?P<description>.+)$")
MAX_HEADER_LENGTH = 72


def validate_message(message: str) -> list:
    header = message.strip().splitlines()[0] if message.strip() else ""
    match = HEADER.match(header)
    if not match:
        return ["Header must follow 'type(scope): description'"]
    errors = []
    if match["type"] not in TYPES:
        errors.append(f"Unknown type '{match['type']}'. Use one of: {', '.join(sorted(TYPES))}")
    if match["scope"] and match["scope"] not in SCOPES:
        errors.append(f"Unknown scope '{match['scope']}'")
    description = match["description"]
    if description[0].isupper():
        errors.append("Description must start in lowercase (imperative mood, in English)")
    if description.endswith("."):
        errors.append("Description must not end with a period")
    if len(header) > MAX_HEADER_LENGTH:
        errors.append(f"Header is longer than {MAX_HEADER_LENGTH} characters")
    return errors


def git(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True, text=True)


@register_skill
class CommitChangesSkill(BaseSkill):
    name = "commit_changes"

    def run(self, params: dict) -> dict:
        message = params.get("message")
        files = params.get("files")
        if not isinstance(message, str) or not isinstance(files, list) or not files:
            raise ValueError("'message' must be a string and 'files' a non-empty list")

        errors = validate_message(message)
        if any(Path(file).name.startswith(".env") and not Path(file).name.endswith((".example", ".test")) for file in files):
            errors.append("Refusing to commit .env files")
        if errors:
            return {"committed": False, "commit": "", "errors": errors}

        added = git("add", "--", *files)
        if added.returncode != 0:
            return {"committed": False, "commit": "", "errors": [added.stderr.strip()]}
        if git("diff", "--cached", "--quiet").returncode == 0:
            return {"committed": False, "commit": "", "errors": ["Nothing to commit (no empty commits)"]}

        committed = git("commit", "-m", message)
        if committed.returncode != 0:
            return {"committed": False, "commit": "", "errors": [committed.stderr.strip() or committed.stdout.strip()]}
        return {"committed": True, "commit": git("log", "--oneline", "-1").stdout.strip(), "errors": []}
