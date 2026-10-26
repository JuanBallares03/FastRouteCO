"""Skill: extracts the API contract from an Express routes file in backend/src/modules."""

import re
from pathlib import Path

from core.skill_base.base_skill import BaseSkill
from core.skill_base.skill_registry import register_skill

REPO_ROOT = Path(__file__).resolve().parents[2]
ALLOWED_DIR = REPO_ROOT / "backend" / "src" / "modules"
ROUTE = re.compile(r"router\.(get|post|put|patch|delete)\(\s*['\"]([^'\"]+)['\"]")
AUTHORIZE = re.compile(r"authorize\(([^)]*)\)")
ROLE = re.compile(r"['\"]([a-z_]+)['\"]")
ROUTER_USE = re.compile(r"router\.use\(([^;]*)\);")


@register_skill
class ApiContractExtractSkill(BaseSkill):
    name = "api_contract_extract"

    def run(self, params: dict) -> dict:
        routes_file = params.get("routes_file")
        if not isinstance(routes_file, str):
            raise ValueError("'routes_file' must be a string")

        path = (REPO_ROOT / routes_file).resolve()
        # Least privilege: only routes files inside backend/src/modules can be read.
        if ALLOWED_DIR not in path.parents or not path.name.endswith(".routes.ts"):
            raise PermissionError("Only *.routes.ts files inside backend/src/modules are allowed")

        source = path.read_text(encoding="utf-8")

        # Middlewares applied to the whole router with router.use(...) count for every endpoint.
        shared = " ".join(ROUTER_USE.findall(source))
        shared_authorize = AUTHORIZE.search(shared)
        shared_roles = ROLE.findall(shared_authorize.group(1)) if shared_authorize else []

        matches = list(ROUTE.finditer(source))
        endpoints = []
        for index, match in enumerate(matches):
            end = matches[index + 1].start() if index + 1 < len(matches) else len(source)
            call = source[match.start():end]
            authorize = AUTHORIZE.search(call)
            endpoints.append({
                "method": match.group(1).upper(),
                "path": match.group(2),
                "roles": ROLE.findall(authorize.group(1)) if authorize else shared_roles,
                "authenticated": "authenticate" in call or "authenticate" in shared,
                "validated": "validate(" in call,
            })

        return {"endpoints": endpoints}
