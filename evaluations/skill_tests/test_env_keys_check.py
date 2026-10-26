import pytest

import skills.env_keys_check.skill as module
from skills.env_keys_check.skill import EnvKeysCheckSkill


@pytest.fixture
def repo(tmp_path, monkeypatch):
    backend = tmp_path / "backend"
    backend.mkdir()
    (backend / ".env.example").write_text("# comment\nJWT_SECRET=\nRESEND_API_KEY=\nPORT=\n", encoding="utf-8")
    (backend / ".env").write_text("JWT_SECRET=super-secret-value\nRESEND_API_KEY=\nEXTRA=1\n", encoding="utf-8")
    monkeypatch.setattr(module, "REPO_ROOT", tmp_path)
    return tmp_path


def test_reports_missing_empty_and_extra_keys(repo):
    result = EnvKeysCheckSkill().run({"example_file": "backend/.env.example", "env_file": "backend/.env"})
    assert result == {"missing_keys": ["PORT"], "empty_keys": ["RESEND_API_KEY"], "extra_keys": ["EXTRA"]}


def test_never_returns_values(repo):
    result = EnvKeysCheckSkill().run({"example_file": "backend/.env.example", "env_file": "backend/.env"})
    assert "super-secret-value" not in str(result)


def test_blocks_non_env_files(repo):
    (repo / "notes.txt").write_text("A=1", encoding="utf-8")
    with pytest.raises(PermissionError):
        EnvKeysCheckSkill().run({"example_file": "notes.txt", "env_file": "backend/.env"})
