import importlib
from pathlib import Path

import pytest

from app.config import load_settings

RUNTIME_MODULES = [
    "fastapi",
    "uvicorn",
    "python_multipart",
    "pydantic",
    "google.genai",
    "httpx",
    "pymupdf",
    "docx",
    "dotenv",
]


@pytest.mark.parametrize("module_name", RUNTIME_MODULES)
def test_runtime_dependency_imports(module_name: str) -> None:
    importlib.import_module(module_name)


def test_settings_load(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    monkeypatch.setenv("EVALORA_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("EVALORA_MAX_CONCURRENCY", "0")
    settings = load_settings()
    assert settings.data_dir == tmp_path
    assert settings.max_concurrency == 1
    assert settings.model
