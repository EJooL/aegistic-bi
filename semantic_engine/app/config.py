"""Configuration loader for the Aegistic Semantic Engine."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(REPO_ROOT / ".env", override=False)


def resolve_repo_path(raw_path: str) -> Path:
    """Resolve a path relative to the repository root unless already absolute."""
    path = Path(raw_path)
    if path.is_absolute():
        return path
    return (REPO_ROOT / path).resolve()


@dataclass(frozen=True)
class Settings:
    """Runtime settings loaded from environment variables and `.env`."""

    repo_root: Path = REPO_ROOT
    dwh_path_raw: str = "aegistic.duckdb"
    semantic_model_path_raw: str = "semantic_models/commerce.yaml"
    dashboard_db_path_raw: str = "semantic_engine/data/dashboards.sqlite3"
    benchmark_path_raw: str = "evaluation/results/benchmark_report.json"
    parser_mode: str = "deterministic"
    cors_origins: list[str] = field(
        default_factory=lambda: ["http://localhost:5173", "http://127.0.0.1:5173"]
    )
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    query_timeout_seconds: float = 10.0

    @property
    def dwh_path(self) -> Path:
        return resolve_repo_path(self.dwh_path_raw)

    @property
    def semantic_model_path(self) -> Path:
        return resolve_repo_path(self.semantic_model_path_raw)

    @property
    def dashboard_db_path(self) -> Path:
        return resolve_repo_path(self.dashboard_db_path_raw)

    @property
    def benchmark_path(self) -> Path:
        return resolve_repo_path(self.benchmark_path_raw)


def load_settings() -> Settings:
    """Build Settings from current environment variables."""
    cors_raw = os.getenv(
        "AEGISTIC_CORS_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    cors_origins = [origin.strip() for origin in cors_raw.split(",") if origin.strip()]
    parser_mode = os.getenv("AEGISTIC_PARSER_MODE", "deterministic").strip().lower()
    if parser_mode not in {"deterministic", "openai", "gemini"}:
        parser_mode = "deterministic"

    timeout_raw = os.getenv("AEGISTIC_QUERY_TIMEOUT_SECONDS", "10.0")
    try:
        query_timeout = max(1.0, float(timeout_raw))
    except ValueError:
        query_timeout = 10.0

    return Settings(
        repo_root=REPO_ROOT,
        dwh_path_raw=os.getenv("AEGISTIC_DB_PATH", "aegistic.duckdb"),
        semantic_model_path_raw=os.getenv(
            "AEGISTIC_SEMANTIC_MODEL_PATH", "semantic_models/commerce.yaml"
        ),
        dashboard_db_path_raw=os.getenv(
            "AEGISTIC_DASHBOARD_DB_PATH", "semantic_engine/data/dashboards.sqlite3"
        ),
        benchmark_path_raw=os.getenv(
            "AEGISTIC_BENCHMARK_PATH", "evaluation/results/benchmark_report.json"
        ),
        parser_mode=parser_mode,
        cors_origins=cors_origins,
        openai_api_key=os.getenv("OPENAI_API_KEY", "").strip(),
        openai_model=os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini",
        gemini_api_key=os.getenv("GEMINI_API_KEY", "").strip(),
        gemini_model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash").strip()
        or "gemini-2.0-flash",
        query_timeout_seconds=query_timeout,
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return load_settings()
