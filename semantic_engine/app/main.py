"""FastAPI entrypoint for the Aegistic Semantic Engine."""

from __future__ import annotations

import json
from typing import Any, Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

from semantic_engine.app.config import Settings, get_settings
from semantic_engine.app.dashboard_store import DashboardStore
from semantic_engine.app.executor import check_duckdb_health
from semantic_engine.app.pipeline import SemanticPipeline
from semantic_engine.app.schemas import (
    DashboardCard,
    DashboardListResponse,
    DeleteDashboardResponse,
    HealthResponse,
    MetricCatalogResponse,
    PinRequest,
    QueryRequest,
    QueryResponse,
)


def create_app(settings_override: Optional[Settings] = None) -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = settings_override or get_settings()
    pipeline = SemanticPipeline(settings=settings)
    dashboard_store = DashboardStore(settings.dashboard_db_path)

    app = FastAPI(
        title="Aegistic Semantic & SQL Guardrail Engine",
        version=pipeline.model.version,
        description=(
            "Verified Self-Service BI backend powered by a Metrics-as-Code Semantic Layer "
            "and sqlglot AST SQL Guardrails."
        ),
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Expose internals on app.state for programmatic inspection/testing
    app.state.settings = settings
    app.state.pipeline = pipeline
    app.state.dashboard_store = dashboard_store

    @app.get("/api/v1/health", response_model=HealthResponse, tags=["Health"])
    def get_health() -> HealthResponse:
        connected, gold_tables = check_duckdb_health(settings.dwh_path)
        return HealthResponse(
            status="ok" if connected else "degraded",
            service="aegistic-semantic-engine",
            duckdb_connected=connected,
            dwh_path=settings.dwh_path_raw,
            parser_mode=settings.parser_mode,
            metrics_loaded=len(pipeline.model.metrics),
            dimensions_loaded=len(pipeline.model.dimensions),
            gold_tables=gold_tables,
        )

    @app.get("/api/v1/metrics", response_model=MetricCatalogResponse, tags=["Semantic Layer"])
    def get_metrics() -> MetricCatalogResponse:
        return pipeline.model.to_catalog_response()

    @app.post("/api/v1/query", response_model=QueryResponse, tags=["Analytics"])
    def post_query(request: QueryRequest) -> QueryResponse:
        try:
            return pipeline.run_query(
                question=request.question,
                parser_mode=request.parser_mode,
            )
        except FileNotFoundError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=str(exc),
            ) from exc
        except TimeoutError as exc:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail=str(exc),
            ) from exc

    @app.get("/api/v1/dashboards", response_model=DashboardListResponse, tags=["Dashboards"])
    def list_dashboards() -> DashboardListResponse:
        return DashboardListResponse(cards=dashboard_store.list_cards())

    @app.post(
        "/api/v1/dashboards/pin",
        response_model=DashboardCard,
        status_code=status.HTTP_201_CREATED,
        tags=["Dashboards"],
    )
    def pin_dashboard_card(request: PinRequest) -> DashboardCard:
        response = pipeline.run_query(question=request.question)
        if response.status != "verified":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Only verified queries can be pinned to Live Dashboard "
                    f"(received status='{response.status}')."
                ),
            )
        return dashboard_store.create_card(
            title=request.title,
            question=request.question,
            response=response,
        )

    @app.post(
        "/api/v1/dashboards/{card_id}/refresh",
        response_model=DashboardCard,
        tags=["Dashboards"],
    )
    def refresh_dashboard_card(card_id: str) -> DashboardCard:
        existing = dashboard_store.get_card(card_id)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dashboard card '{card_id}' not found.",
            )
        fresh_response = pipeline.run_query(question=existing.question)
        updated = dashboard_store.update_card(card_id, fresh_response)
        if updated is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dashboard card '{card_id}' not found.",
            )
        return updated

    @app.delete(
        "/api/v1/dashboards/{card_id}",
        response_model=DeleteDashboardResponse,
        tags=["Dashboards"],
    )
    def delete_dashboard_card(card_id: str) -> DeleteDashboardResponse:
        deleted = dashboard_store.delete_card(card_id)
        if not deleted:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Dashboard card '{card_id}' not found.",
            )
        return DeleteDashboardResponse(deleted=True, id=card_id)

    @app.get("/api/v1/benchmark", tags=["Benchmark"])
    def get_benchmark() -> dict[str, Any]:
        benchmark_path = settings.benchmark_path
        if not benchmark_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=(
                    f"Benchmark report not found at '{settings.benchmark_path_raw}'. "
                    "Run evaluation/run_benchmark.py first."
                ),
            )
        with benchmark_path.open("r", encoding="utf-8") as fh:
            return json.load(fh)

    return app


app = create_app()
