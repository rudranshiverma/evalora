import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str
    model: str
    use_mock_grader: bool
    max_concurrency: int
    data_dir: Path
    username: str = "teacher"
    password: str = ""


def load_settings() -> Settings:
    load_dotenv(PROJECT_ROOT / ".env", override=False)
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        model=os.getenv("EVALORA_MODEL", "gemini-flash-latest").strip(),
        use_mock_grader=_env_bool("EVALORA_MOCK_GRADER", False),
        max_concurrency=max(1, int(os.getenv("EVALORA_MAX_CONCURRENCY", "2"))),
        data_dir=Path(os.getenv("EVALORA_DATA_DIR", str(PROJECT_ROOT / "data"))),
        username=os.getenv("EVALORA_USERNAME", "teacher").strip(),
        password=os.getenv("EVALORA_PASSWORD", "").strip(),
    )
