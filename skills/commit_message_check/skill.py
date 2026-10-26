"""Skill: validates commit messages (Conventional Commits with the project types and scopes)."""

import re

from core.skill_base.base_skill import BaseSkill
from core.skill_base.skill_registry import register_skill

TYPES = {"feat", "fix", "chore", "docs", "test", "refactor"}
SCOPES = {
    "backend", "web", "mobile", "ci", "opencode", "mcp", "readme", "build-plan",
    "design", "data-model", "use-cases", "architecture", "user-stories",
}
HEADER = re.compile(r"^(?P<type>[a-z]+)(\((?P<scope>[a-z0-9-]+)\))?: (?P<description>.+)$")
MAX_HEADER_LENGTH = 72


@register_skill
class CommitMessageCheckSkill(BaseSkill):
    name = "commit_message_check"

    def run(self, params: dict) -> dict:
        message = params.get("message")
        if not isinstance(message, str) or not message.strip():
            raise ValueError("'message' must be a non-empty string")

        header = message.strip().splitlines()[0]
        match = HEADER.match(header)
        if not match:
            return {
                "valid": False,
                "type": "",
                "scope": "",
                "errors": ["Header must follow 'type(scope): description'"],
            }

        commit_type = match["type"]
        scope = match["scope"] or ""
        description = match["description"]
        errors = []

        if commit_type not in TYPES:
            errors.append(f"Unknown type '{commit_type}'. Use one of: {', '.join(sorted(TYPES))}")
        if scope and scope not in SCOPES:
            errors.append(f"Unknown scope '{scope}'")
        if description[0].isupper():
            errors.append("Description must start in lowercase (imperative mood)")
        if description.endswith("."):
            errors.append("Description must not end with a period")
        if len(header) > MAX_HEADER_LENGTH:
            errors.append(f"Header is longer than {MAX_HEADER_LENGTH} characters")

        return {"valid": not errors, "type": commit_type, "scope": scope, "errors": errors}
