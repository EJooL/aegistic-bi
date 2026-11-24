"""Automatic chart recommendation using Palette 1 (Adjusted) color tokens."""

from __future__ import annotations

from typing import Any

from semantic_engine.app.schemas import ChartSpec, ChartYSeries, QueryPlan
from semantic_engine.app.semantic_loader import SemanticModel

PRIMARY_SERIES_COLOR = "#4DA8E5"
MULTI_SERIES_RAMP = ["#3B498B", "#4DA8E5", "#7685C4", "#2A7EB5", "#9BCBF0"]

PRESET_LABELS = {
    "last_6_months": "Last 6 Months",
    "last_12_months": "Last 12 Months",
    "last_3_months": "Last 3 Months",
    "last_30_days": "Last 30 Days",
    "last_14_days": "Last 14 Days",
    "last_7_days": "Last 7 Days",
    "last_90_days": "Last 90 Days",
    "current_month": "Current Month",
    "last_month": "Last Month",
    "current_quarter": "Current Quarter",
    "last_quarter": "Last Quarter",
    "ytd": "Year to Date",
    "all_time": "All Time",
}

GRAIN_LABELS = {
    "day": "Daily",
    "week": "Weekly",
    "month": "Monthly",
    "quarter": "Quarterly",
}


def _format_date_suffix(plan: QueryPlan) -> str:
    if plan.date_range is None:
        return ""
    if plan.date_range.quarters:
        return f" ({' vs '.join(plan.date_range.quarters)})"
    if plan.date_range.preset and plan.date_range.preset in PRESET_LABELS:
        return f" ({PRESET_LABELS[plan.date_range.preset]})"
    if plan.date_range.start_date and plan.date_range.end_date:
        return f" ({plan.date_range.start_date} to {plan.date_range.end_date})"
    return ""


def _build_chart_title(plan: QueryPlan, model: SemanticModel) -> str:
    metric_labels = [model.get_metric(k).label for k in plan.metrics]
    metrics_text = " & ".join(metric_labels)
    date_suffix = _format_date_suffix(plan)

    if not plan.dimensions:
        return f"{metrics_text}{date_suffix}"

    if plan.dimensions == ["order_date"]:
        grain_prefix = GRAIN_LABELS.get(plan.time_grain or "month", "Time")
        return f"{grain_prefix} {metrics_text} Trend{date_suffix}"

    dim_labels = [model.get_dimension(k).label for k in plan.dimensions]
    dims_text = " & ".join(dim_labels)
    return f"{metrics_text} by {dims_text}{date_suffix}"


def recommend_chart(
    plan: QueryPlan,
    model: SemanticModel,
    rows: list[dict[str, Any]],
) -> ChartSpec:
    """Choose the best chart type and Palette 1 Adjusted colors for query results."""
    y_keys: list[ChartYSeries] = []
    use_ramp = len(plan.metrics) > 1
    for idx, metric_key in enumerate(plan.metrics):
        metric = model.get_metric(metric_key)
        color = (
            MULTI_SERIES_RAMP[idx % len(MULTI_SERIES_RAMP)]
            if use_ramp
            else PRIMARY_SERIES_COLOR
        )
        y_keys.append(
            ChartYSeries(
                key=metric.key,
                label=metric.label,
                format=metric.format,
                color=color,
            )
        )

    title = _build_chart_title(plan, model)

    if len(rows) == 0:
        x_key = plan.dimensions[0] if plan.dimensions else None
        x_label = model.get_dimension(x_key).label if x_key else None
        return ChartSpec(
            chart_type="table",
            title=title,
            x_key=x_key,
            x_label=x_label,
            y_keys=y_keys,
        )

    if len(plan.dimensions) == 0:
        return ChartSpec(
            chart_type="kpi",
            title=title,
            x_key=None,
            x_label=None,
            y_keys=y_keys,
        )

    if len(plan.dimensions) == 1:
        dim_key = plan.dimensions[0]
        dim = model.get_dimension(dim_key)
        if dim.type == "time":
            # Use bar chart when comparing only 2-4 quarters side by side? No: spec says
            # "line untuk tren waktu" (time dimension present -> line).
            chart_type = "line"
        elif len(rows) <= 25:
            chart_type = "bar"
        else:
            chart_type = "table"

        return ChartSpec(
            chart_type=chart_type,
            title=title,
            x_key=dim.key,
            x_label=dim.label,
            y_keys=y_keys,
        )

    # 2+ dimensions -> table for dense multi-dimensional results
    first_dim = model.get_dimension(plan.dimensions[0])
    return ChartSpec(
        chart_type="table",
        title=title,
        x_key=first_dim.key,
        x_label=first_dim.label,
        y_keys=y_keys,
    )
