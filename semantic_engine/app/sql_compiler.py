"""Gate 2 — Deterministic SQL Compiler (QueryPlan + SemanticModel -> DuckDB SQL)."""

from __future__ import annotations

import re
from dataclasses import dataclass

import sqlglot

from semantic_engine.app.schemas import ColumnMeta, FilterSpec, QueryPlan
from semantic_engine.app.semantic_loader import DimensionDef, MetricDef, SemanticModel

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_QUARTER_RE = re.compile(r"^\d{4}-Q[1-4]$")


@dataclass
class CompiledQuery:
    sql: str
    columns: list[ColumnMeta]
    tables_used: list[str]
    item_grain_used: bool


def _quote_sql_value(value: str | int | float) -> str:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    escaped = str(value).replace("'", "''")
    return f"'{escaped}'"


def _dimension_select_expr(dim: DimensionDef, time_grain: str | None) -> str:
    if dim.type == "time":
        grain = time_grain or "month"
        if grain in dim.grain_columns:
            return dim.grain_columns[grain]
        return f"{dim.alias}.{dim.column}"
    return f"{dim.alias}.{dim.column}"


def _dimension_filter_expr(dim: DimensionDef, flt: FilterSpec) -> str:
    if dim.type == "time":
        vals = flt.value if isinstance(flt.value, list) else [flt.value]
        if vals and all(isinstance(v, str) and _QUARTER_RE.match(v) for v in vals):
            return dim.grain_columns.get("quarter", f"{dim.alias}.quarter_label")
        return f"{dim.alias}.{dim.column}"
    return f"{dim.alias}.{dim.column}"


def _compile_filter(flt: FilterSpec, dim: DimensionDef) -> str:
    col_expr = _dimension_filter_expr(dim, flt)
    if flt.operator == "=":
        if isinstance(flt.value, list):
            val = flt.value[0]
        else:
            val = flt.value
        return f"{col_expr} = {_quote_sql_value(val)}"
    if flt.operator == "!=":
        if isinstance(flt.value, list):
            val = flt.value[0]
        else:
            val = flt.value
        return f"{col_expr} != {_quote_sql_value(val)}"
    if flt.operator in {"in", "not_in"}:
        values = flt.value if isinstance(flt.value, list) else [flt.value]
        quoted = ", ".join(_quote_sql_value(v) for v in values)
        op_sql = "IN" if flt.operator == "in" else "NOT IN"
        return f"{col_expr} {op_sql} ({quoted})"
    raise ValueError(f"Unsupported filter operator: {flt.operator}")


def _common_mandatory_filters(metrics: list[MetricDef]) -> list[str]:
    """Return mandatory WHERE filters only if ALL selected metrics share the exact same rule.

    When metrics have differing rules (e.g. net_revenue + refund_rate), we omit
    order_status from WHERE so each metric's conditional CASE WHEN aggregation
    computes accurately in a single query without zeroing out other metrics.
    """
    if not metrics:
        return []
    first = list(metrics[0].mandatory_filters)
    if not first:
        return []
    if all(list(m.mandatory_filters) == first for m in metrics[1:]):
        qualified: list[str] = []
        for clause in first:
            if clause.startswith("order_status"):
                qualified.append(f"fo.{clause}")
            else:
                qualified.append(clause)
        return qualified
    return []


def compile_query(plan: QueryPlan, model: SemanticModel) -> CompiledQuery:
    """Deterministically compile a validated QueryPlan into DuckDB SQL targeting gold.* only."""
    if not plan.metrics:
        raise ValueError("QueryPlan must contain at least one metric.")

    metric_defs: list[MetricDef] = [model.get_metric(key) for key in plan.metrics]
    dim_defs: list[DimensionDef] = [model.get_dimension(key) for key in plan.dimensions]

    for metric in metric_defs:
        for dim_key in plan.dimensions:
            if dim_key not in metric.allowed_dimensions:
                raise ValueError(
                    f"Dimension '{dim_key}' is not allowed for metric '{metric.key}'."
                )

    filter_dims: list[DimensionDef] = [
        model.get_dimension(flt.dimension) for flt in plan.filters
    ]
    referenced_dim_keys = {d.key for d in dim_defs} | {d.key for d in filter_dims}

    # Fan-out prevention: switch to item grain whenever an order_item metric OR
    # product_category dimension/filter is requested. All metrics have item-grain
    # safe expressions (item_net_amount / item_gross_amount / COUNT(DISTINCT ...)).
    item_grain_used = (
        any(m.grain == "order_item" for m in metric_defs)
        or "product_category" in referenced_dim_keys
    )

    needs_dim_products = "product_category" in referenced_dim_keys
    needs_dim_customers = bool({"customer_segment", "region"} & referenced_dim_keys)
    needs_dim_date = ("order_date" in referenced_dim_keys) or (
        plan.date_range is not None
    )

    # ------------------------------------------------------------------
    # SELECT clauses & Column Metadata
    # ------------------------------------------------------------------
    select_parts: list[str] = []
    group_by_parts: list[str] = []
    columns: list[ColumnMeta] = []

    for dim in dim_defs:
        dim_expr = _dimension_select_expr(dim, plan.time_grain)
        select_parts.append(f"{dim_expr} AS {dim.key}")
        group_by_parts.append(dim_expr)
        col_format = (
            "string"
            if (dim.type == "time" and plan.time_grain == "quarter")
            else ("date" if dim.type == "time" else "string")
        )
        columns.append(
            ColumnMeta(
                key=dim.key,
                label=dim.label,
                format=col_format,
                is_metric=False,
            )
        )

    for metric in metric_defs:
        expr = (
            metric.item_grain_sql_expression or metric.sql_expression
            if item_grain_used
            else metric.sql_expression
        )
        select_parts.append(f"{expr} AS {metric.key}")
        columns.append(
            ColumnMeta(
                key=metric.key,
                label=metric.label,
                format=metric.format,
                is_metric=True,
            )
        )

    # ------------------------------------------------------------------
    # FROM & Governed JOINs (gold.* only)
    # ------------------------------------------------------------------
    tables_used: list[str] = []
    join_clauses: list[str] = []

    if item_grain_used:
        from_clause = "FROM gold.fact_order_items AS foi"
        tables_used.append("gold.fact_order_items")
        join_clauses.append(
            "INNER JOIN gold.fact_orders AS fo ON foi.order_id = fo.order_id"
        )
        tables_used.append("gold.fact_orders")
        if needs_dim_products:
            join_clauses.append(
                "LEFT JOIN gold.dim_products AS dp ON foi.product_id = dp.product_id"
            )
            tables_used.append("gold.dim_products")
    else:
        from_clause = "FROM gold.fact_orders AS fo"
        tables_used.append("gold.fact_orders")

    if needs_dim_customers:
        join_clauses.append(
            "LEFT JOIN gold.dim_customers AS dc ON fo.customer_id = dc.customer_id"
        )
        tables_used.append("gold.dim_customers")

    if needs_dim_date:
        join_clauses.append(
            "LEFT JOIN gold.dim_date AS dd ON fo.order_date = dd.date_day"
        )
        tables_used.append("gold.dim_date")

    # ------------------------------------------------------------------
    # WHERE clauses (mandatory filters + date_range + dimension filters)
    # ------------------------------------------------------------------
    where_clauses: list[str] = []

    where_clauses.extend(_common_mandatory_filters(metric_defs))

    if plan.date_range is not None:
        dr = plan.date_range
        if dr.quarters:
            valid_quarters = [q for q in dr.quarters if _QUARTER_RE.match(q)]
            if valid_quarters:
                q_list = ", ".join(_quote_sql_value(q) for q in valid_quarters)
                where_clauses.append(f"dd.quarter_label IN ({q_list})")
        elif dr.start_date and dr.end_date:
            if not _DATE_RE.match(dr.start_date) or not _DATE_RE.match(dr.end_date):
                raise ValueError("date_range start_date/end_date must be YYYY-MM-DD.")
            where_clauses.append(
                f"dd.date_day BETWEEN DATE '{dr.start_date}' AND DATE '{dr.end_date}'"
            )
        elif dr.start_date:
            if not _DATE_RE.match(dr.start_date):
                raise ValueError("date_range start_date must be YYYY-MM-DD.")
            where_clauses.append(f"dd.date_day >= DATE '{dr.start_date}'")
        elif dr.end_date:
            if not _DATE_RE.match(dr.end_date):
                raise ValueError("date_range end_date must be YYYY-MM-DD.")
            where_clauses.append(f"dd.date_day <= DATE '{dr.end_date}'")

    for flt in plan.filters:
        dim = model.get_dimension(flt.dimension)
        where_clauses.append(_compile_filter(flt, dim))

    # ------------------------------------------------------------------
    # ORDER BY & LIMIT
    # ------------------------------------------------------------------
    valid_fields = {d.key for d in dim_defs} | {m.key for m in metric_defs}
    order_parts: list[str] = []

    for sort_spec in plan.sort:
        if sort_spec.field in valid_fields:
            direction = "ASC" if sort_spec.direction.lower() == "asc" else "DESC"
            order_parts.append(f"{sort_spec.field} {direction}")

    if not order_parts:
        if "order_date" in plan.dimensions:
            order_parts.append("order_date ASC")
            if len(plan.dimensions) > 1 and plan.metrics:
                order_parts.append(f"{plan.metrics[0]} DESC")
        elif plan.dimensions and plan.metrics:
            order_parts.append(f"{plan.metrics[0]} DESC")

    limit_val = max(1, min(int(plan.limit), 1000))

    # ------------------------------------------------------------------
    # Assemble & Pretty-Format SQL via sqlglot
    # ------------------------------------------------------------------
    sql_lines = [
        "SELECT",
        "    " + ",\n    ".join(select_parts),
        from_clause,
    ]
    sql_lines.extend(join_clauses)
    if where_clauses:
        sql_lines.append("WHERE " + "\n  AND ".join(where_clauses))
    if group_by_parts:
        sql_lines.append("GROUP BY " + ", ".join(group_by_parts))
    if order_parts:
        sql_lines.append("ORDER BY " + ", ".join(order_parts))
    sql_lines.append(f"LIMIT {limit_val}")

    raw_sql = "\n".join(sql_lines)
    pretty_sql = sqlglot.transpile(
        raw_sql, read="duckdb", write="duckdb", pretty=True
    )[0]

    return CompiledQuery(
        sql=pretty_sql,
        columns=columns,
        tables_used=sorted(set(tables_used)),
        item_grain_used=item_grain_used,
    )
