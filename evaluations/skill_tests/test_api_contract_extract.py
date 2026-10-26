import pytest

import skills.api_contract_extract.skill as module
from skills.api_contract_extract.skill import ApiContractExtractSkill

ROUTES = """
router.get('/', authenticate, authorize('company_admin', 'supervisor'), listBranchesHandler);
router.post(
  '/',
  authenticate,
  authorize('company_admin'),
  validate(createBranchSchema),
  createBranchHandler,
);
router.post('/login', validate(loginSchema), loginHandler);
"""


@pytest.fixture
def repo(tmp_path, monkeypatch):
    modules = tmp_path / "backend" / "src" / "modules" / "company"
    modules.mkdir(parents=True)
    (modules / "branch.routes.ts").write_text(ROUTES, encoding="utf-8")
    monkeypatch.setattr(module, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(module, "ALLOWED_DIR", tmp_path / "backend" / "src" / "modules")
    return tmp_path


def test_extracts_endpoints(repo):
    result = ApiContractExtractSkill().run({"routes_file": "backend/src/modules/company/branch.routes.ts"})
    assert result["endpoints"] == [
        {"method": "GET", "path": "/", "roles": ["company_admin", "supervisor"], "authenticated": True, "validated": False},
        {"method": "POST", "path": "/", "roles": ["company_admin"], "authenticated": True, "validated": True},
        {"method": "POST", "path": "/login", "roles": [], "authenticated": False, "validated": True},
    ]


def test_blocks_files_outside_modules(repo):
    (repo / "secret.routes.ts").write_text("", encoding="utf-8")
    with pytest.raises(PermissionError):
        ApiContractExtractSkill().run({"routes_file": "secret.routes.ts"})


def test_applies_router_use_middlewares(repo):
    file = repo / "backend" / "src" / "modules" / "company" / "admin.routes.ts"
    file.write_text("router.use(authenticate);\nrouter.use(authorize('platform_admin'));\nrouter.get('/companies', listHandler);\n", encoding="utf-8")
    result = ApiContractExtractSkill().run({"routes_file": "backend/src/modules/company/admin.routes.ts"})
    assert result["endpoints"] == [
        {"method": "GET", "path": "/companies", "roles": ["platform_admin"], "authenticated": True, "validated": False},
    ]
