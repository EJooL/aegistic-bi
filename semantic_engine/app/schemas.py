"""Pydantic v2 request and response schemas matching docs/api_contract.md."""

from __future__ import annotations

from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, Field


# ----------------------------------------------------------------------------
# 1. Health Check
# ----------------------------------------------------------------------------
class HealthResponse(BaseModel):
    status: Literal["ok", "degraded"]
    service: str = "aegistic-semantic-engine"
    duckdb_connected: bool
    dwh_path: str
    parser_mode: str
    metrics_loaded: int
    dimensions_loaded: int
    gold_tables: list[str] = Field(default_factory=list)


# ----------------------------------------------------------------------------
# 2. Metric Catalog
# ----------------------------------------------------------------------------
class MetricCatalogItem(BaseModel):
    key: str
    label: str
    description: str
    formula_display: str
    sql_expression: str
    format: Literal["currency_idr", "percentage", "integer", "float"]
    grain: str
    base_table: str
    mandatory_filters: list[str] = Field(default_factory=list)
    allowed_dimensions: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)
    owner: str


class DimensionCatalogItem(BaseModel):
    key: str
    label: str
    table: str
    column: str
    type: Literal["time", "categorical"]
    supported_grains: list[str] = Field(default_factory=list)
    description: str


class MetricCatalogResponse(BaseModel):
    model_name: str
    display_name: str
    version: str
    currency: str
    description: str
    metrics: list[MetricCatalogItem]
    dimensions: list[DimensionCatalogItem]


# ----------------------------------------------------------------------------
# 3. Conversational Analytics Query (5-Gate Pipeline)
# ----------------------------------------------------------------------------
class QueryRequest(BaseModel):
    question: str = Field(..., min_length=1, description="Natural language question in ID or EN.")
    parser_mode: Optional[Literal["deterministic", "openai", "gemini"]] = None


class FilterSpec(BaseModel):
    dimension: str
    operator: Literal["=", "!=", "in", "not_in"] = "="
    value: Union[str, int, float, list[Union[str, int, float]]]


class DateRangeSpec(BaseModel):
    preset: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    quarters: Optional[list[str]] = None


class SortSpec(BaseModel):
    field: str
    direction: Literal["asc", "desc"] = "desc"


class QueryPlan(BaseModel):
    metrics: list[str] = Field(default_factory=list)
    dimensions: list[str] = Field(default_factory=list)
    time_grain: Optional[Literal["day", "week", "month", "quarter"]] = None
    filters: list[FilterSpec] = Field(default_factory=list)
    date_range: Optional[DateRangeSpec] = None
    sort: list[SortSpec] = Field(default_factory=list)
    limit: int = Field(default=100, ge=1, le=1000)


class ColumnMeta(BaseModel):
    key: str
    label: str
    format: str
    is_metric: bool


class ChartYSeries(BaseModel):
    key: str
    label: str
    format: str
    color: str


class ChartSpec(BaseModel):
    chart_type: Literal["line", "bar", "kpi", "table"]
    title: str
    x_key: Optional[str] = None
    x_label: Optional[str] = None
    y_keys: list[ChartYSeries] = Field(default_factory=list)


class AuditMetricUsed(BaseModel):
    key: str
    label: str
    formula_display: str
    mandatory_filters: list[str] = Field(default_factory=list)
    caveats: list[str] = Field(default_factory=list)


class GuardrailCheck(BaseModel):
    name: str
    passed: bool
    detail: str


class SanityCheck(BaseModel):
    name: str
    passed: bool
    severity: Literal["info", "warning", "error"] = "info"
    detail: str


class AuditTrail(BaseModel):
    verified: bool
    parser_used: str
    metrics_used: list[AuditMetricUsed] = Field(default_factory=list)
    compiled_sql: Optional[str] = None
    guardrail_checks: list[GuardrailCheck] = Field(default_factory=list)
    sanity_checks: list[SanityCheck] = Field(default_factory=list)
    latency_ms: float = 0.0
    row_count: int = 0
    tables_accessed: list[str] = Field(default_factory=list)


class WarningItem(BaseModel):
    code: str
    severity: Literal["info", "warning", "error"]
    title: str
    message: str


class SuggestionItem(BaseModel):
    label: str
    question: str
    metric_key: Optional[str] = None
    reason: Optional[str] = None


class QueryResponse(BaseModel):
    status: Literal["verified", "clarification_required", "refused", "guardrail_blocked"]
    question: str
    summary: str
    query_plan: Optional[QueryPlan] = None
    columns: list[ColumnMeta] = Field(default_factory=list)
    data: list[dict[str, Any]] = Field(default_factory=list)
    chart_spec: Optional[ChartSpec] = None
    audit_trail: AuditTrail
    warnings: list[WarningItem] = Field(default_factory=list)
    suggestions: list[SuggestionItem] = Field(default_factory=list)


# ----------------------------------------------------------------------------
# 4. Live Dashboard Persistence
# ----------------------------------------------------------------------------
class PinRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    question: str = Field(..., min_length=1)


class DashboardCard(BaseModel):
    id: str
    title: str
    question: str
    created_at: str
    refreshed_at: str
    response: QueryResponse


class DashboardListResponse(BaseModel):
    cards: list[DashboardCard] = Field(default_factory=list)


class DeleteDashboardResponse(BaseModel):
    deleted: bool
    id: str
