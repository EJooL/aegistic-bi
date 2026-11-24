"""End-to-end 5-Gate Aegistic Semantic & SQL Guardrail Pipeline."""

from __future__ import annotations

from typing import Optional

from semantic_engine.app.chart_recommender import PRESET_LABELS, recommend_chart
from semantic_engine.app.config import Settings, get_settings
from semantic_engine.app.executor import execute_safe_sql
from semantic_engine.app.intent_parser import parse_intent
from semantic_engine.app.schemas import (
    AuditMetricUsed,
    AuditTrail,
    QueryPlan,
    QueryResponse,
    WarningItem,
)
from semantic_engine.app.semantic_loader import SemanticModel, load_semantic_model
from semantic_engine.app.sql_compiler import compile_query
from semantic_engine.app.sql_guardrails import verify_sql_guardrails


def _build_verified_summary(
    plan: QueryPlan, model: SemanticModel, row_count: int
) -> str:
    metric_labels = ", ".join(model.get_metric(k).label for k in plan.metrics)
    dim_part = ""
    if plan.dimensions:
        dim_labels = ", ".join(model.get_dimension(k).label for k in plan.dimensions)
        dim_part = f" berdasarkan {dim_labels}"

    date_part = ""
    if plan.date_range:
        if plan.date_range.quarters:
            date_part = f" untuk periode {', '.join(plan.date_range.quarters)}"
        elif plan.date_range.preset and plan.date_range.preset in PRESET_LABELS:
            date_part = f" untuk {PRESET_LABELS[plan.date_range.preset]}"
        elif plan.date_range.start_date and plan.date_range.end_date:
            date_part = (
                f" periode {plan.date_range.start_date} s/d {plan.date_range.end_date}"
            )

    return f"Menampilkan {metric_labels}{dim_part}{date_part} ({row_count} baris data)."


class SemanticPipeline:
    """Orchestrates Gates 1 through 5 for conversational BI queries."""

    def __init__(
        self,
        settings: Optional[Settings] = None,
        model: Optional[SemanticModel] = None,
    ) -> None:
        self.settings = settings or get_settings()
        self.model = model or load_semantic_model(self.settings.semantic_model_path)

    def run_query(
        self,
        question: str,
        parser_mode: Optional[str] = None,
    ) -> QueryResponse:
        clean_question = question.strip()

        # ------------------------------------------------------------------
        # GATE 1: Intent Parsing & Semantic Matching
        # ------------------------------------------------------------------
        parse_res = parse_intent(
            question=clean_question,
            model=self.model,
            settings=self.settings,
            parser_mode_override=parser_mode,
        )

        if parse_res.outcome == "guardrail_blocked":
            attempted_sql = parse_res.attempted_sql or clean_question
            gr = verify_sql_guardrails(attempted_sql)
            return QueryResponse(
                status="guardrail_blocked",
                question=clean_question,
                summary=parse_res.reason,
                query_plan=None,
                columns=[],
                data=[],
                chart_spec=None,
                audit_trail=AuditTrail(
                    verified=False,
                    parser_used=parse_res.parser_used,
                    metrics_used=[],
                    compiled_sql=attempted_sql,
                    guardrail_checks=gr.checks,
                    sanity_checks=[],
                    latency_ms=0.0,
                    row_count=0,
                    tables_accessed=gr.tables_accessed,
                ),
                warnings=[
                    WarningItem(
                        code="GUARDRAIL_BLOCKED",
                        severity="error",
                        title="Blocked by SQL Guardrails",
                        message=gr.blocked_reason or parse_res.reason,
                    )
                ],
                suggestions=parse_res.suggestions,
            )

        if parse_res.outcome == "clarification_required":
            return QueryResponse(
                status="clarification_required",
                question=clean_question,
                summary=parse_res.reason,
                query_plan=None,
                columns=[],
                data=[],
                chart_spec=None,
                audit_trail=AuditTrail(
                    verified=False,
                    parser_used=parse_res.parser_used,
                    metrics_used=[],
                    compiled_sql=None,
                    guardrail_checks=[],
                    sanity_checks=[],
                    latency_ms=0.0,
                    row_count=0,
                    tables_accessed=[],
                ),
                warnings=[
                    WarningItem(
                        code="AMBIGUOUS_QUERY",
                        severity="warning",
                        title="Clarification Required",
                        message=parse_res.reason,
                    )
                ],
                suggestions=parse_res.suggestions,
            )

        if parse_res.outcome == "refused" or parse_res.query_plan is None:
            return QueryResponse(
                status="refused",
                question=clean_question,
                summary=parse_res.reason,
                query_plan=None,
                columns=[],
                data=[],
                chart_spec=None,
                audit_trail=AuditTrail(
                    verified=False,
                    parser_used=parse_res.parser_used,
                    metrics_used=[],
                    compiled_sql=None,
                    guardrail_checks=[],
                    sanity_checks=[],
                    latency_ms=0.0,
                    row_count=0,
                    tables_accessed=[],
                ),
                warnings=[
                    WarningItem(
                        code="OUT_OF_SCOPE",
                        severity="warning",
                        title="Metric Not Registered in Semantic Layer",
                        message=parse_res.reason,
                    )
                ],
                suggestions=parse_res.suggestions,
            )

        plan = parse_res.query_plan

        # ------------------------------------------------------------------
        # GATE 2: Deterministic SQL Compilation
        # ------------------------------------------------------------------
        compiled = compile_query(plan, self.model)

        # ------------------------------------------------------------------
        # GATE 3: sqlglot AST SQL Guardrails
        # ------------------------------------------------------------------
        guardrail_res = verify_sql_guardrails(compiled.sql)
        if not guardrail_res.passed:
            return QueryResponse(
                status="guardrail_blocked",
                question=clean_question,
                summary=(
                    "SQL hasil kompilasi diblokir oleh AST SQL Guardrails: "
                    f"{guardrail_res.blocked_reason}"
                ),
                query_plan=plan,
                columns=[],
                data=[],
                chart_spec=None,
                audit_trail=AuditTrail(
                    verified=False,
                    parser_used=parse_res.parser_used,
                    metrics_used=[],
                    compiled_sql=compiled.sql,
                    guardrail_checks=guardrail_res.checks,
                    sanity_checks=[],
                    latency_ms=0.0,
                    row_count=0,
                    tables_accessed=guardrail_res.tables_accessed,
                ),
                warnings=[
                    WarningItem(
                        code="GUARDRAIL_BLOCKED",
                        severity="error",
                        title="Blocked by SQL Guardrails",
                        message=guardrail_res.blocked_reason or "AST verification failed.",
                    )
                ],
                suggestions=[],
            )

        # ------------------------------------------------------------------
        # GATE 4: Safe Read-Only DuckDB Execution & Sanity Checks
        # ------------------------------------------------------------------
        exec_res = execute_safe_sql(
            safe_sql=guardrail_res.safe_sql,
            db_path=self.settings.dwh_path,
            plan=plan,
            columns=compiled.columns,
            timeout_seconds=self.settings.query_timeout_seconds,
        )

        # ------------------------------------------------------------------
        # GATE 5: Chart Recommendation & Audit Trail Assembly
        # ------------------------------------------------------------------
        chart_spec = recommend_chart(plan, self.model, exec_res.rows)
        metrics_used = [
            AuditMetricUsed(
                key=m.key,
                label=m.label,
                formula_display=m.formula_display,
                mandatory_filters=list(m.mandatory_filters),
                caveats=list(m.caveats),
            )
            for m in (self.model.get_metric(k) for k in plan.metrics)
        ]

        summary = _build_verified_summary(plan, self.model, exec_res.row_count)

        return QueryResponse(
            status="verified",
            question=clean_question,
            summary=summary,
            query_plan=plan,
            columns=compiled.columns,
            data=exec_res.rows,
            chart_spec=chart_spec,
            audit_trail=AuditTrail(
                verified=True,
                parser_used=parse_res.parser_used,
                metrics_used=metrics_used,
                compiled_sql=guardrail_res.safe_sql,
                guardrail_checks=guardrail_res.checks,
                sanity_checks=exec_res.sanity_checks,
                latency_ms=exec_res.latency_ms,
                row_count=exec_res.row_count,
                tables_accessed=guardrail_res.tables_accessed,
            ),
            warnings=exec_res.warnings,
            suggestions=[],
        )
