"""Unit tests for Gate 3 (sqlglot AST SQL Guardrails) and Gate 4 (Sanity Checks)."""

from __future__ import annotations

import pytest

from semantic_engine.app.executor import run_sanity_checks
from semantic_engine.app.schemas import ColumnMeta, QueryPlan
from semantic_engine.app.sql_guardrails import verify_sql_guardrails


@pytest.mark.parametrize(
    "dangerous_sql",
    [
        "DROP TABLE gold.fact_orders",
        "DELETE FROM gold.fact_orders WHERE order_status = 'cancelled'",
        "UPDATE gold.fact_orders SET net_amount = 0",
        "INSERT INTO gold.fact_orders (order_id) VALUES ('ORD-999999')",
        "ALTER TABLE gold.fact_orders ADD COLUMN hacked INT",
        "TRUNCATE TABLE gold.fact_orders",
        "COPY gold.fact_orders TO 'stolen.csv'",
        "ATTACH 'evil.duckdb' AS evil",
        "SELECT * FROM gold.fact_orders LIMIT 5; DROP TABLE gold.fact_orders",
    ],
)
def test_blocks_ddl_dml_and_multi_statement_sql(dangerous_sql):
    res = verify_sql_guardrails(dangerous_sql)
    assert res.passed is False
    checks = {c.name: c for c in res.checks}
    assert checks["read_only_ast"].passed is False


@pytest.mark.parametrize(
    "forbidden_table_sql",
    [
        "SELECT * FROM bronze.raw_orders LIMIT 50",
        "SELECT * FROM silver.orders LIMIT 50",
        "SELECT * FROM raw_orders LIMIT 50",
        "SELECT * FROM fact_orders LIMIT 50",
        "SELECT * FROM information_schema.tables LIMIT 20",
        "SELECT * FROM read_csv('secrets.csv') LIMIT 10",
    ],
)
def test_blocks_non_gold_schema_access(forbidden_table_sql):
    res = verify_sql_guardrails(forbidden_table_sql)
    assert res.passed is False
    checks = {c.name: c for c in res.checks}
    assert checks["gold_schema_only"].passed is False


@pytest.mark.parametrize(
    "cross_join_sql",
    [
        "SELECT * FROM gold.fact_orders CROSS JOIN gold.dim_products LIMIT 100",
        "SELECT fo.order_id, dp.category_name FROM gold.fact_orders fo, gold.dim_products dp LIMIT 100",
    ],
)
def test_blocks_cross_join(cross_join_sql):
    res = verify_sql_guardrails(cross_join_sql)
    assert res.passed is False
    checks = {c.name: c for c in res.checks}
    assert checks["no_cross_join"].passed is False


def test_injects_limit_when_absent_and_clamps_excessive_limit():
    no_limit_sql = "SELECT order_id, net_amount FROM gold.fact_orders WHERE order_status = 'completed'"
    res = verify_sql_guardrails(no_limit_sql)
    assert res.passed is True
    assert "LIMIT 1000" in res.safe_sql
    assert res.tables_accessed == ["gold.fact_orders"]

    huge_limit_sql = "SELECT order_id FROM gold.fact_orders LIMIT 50000"
    res2 = verify_sql_guardrails(huge_limit_sql)
    assert res2.passed is True
    assert "LIMIT 1000" in res2.safe_sql
    checks = {c.name: c for c in res2.checks}
    assert "Clamped" in checks["row_limit_enforced"].detail


def test_allows_valid_cte_query_on_gold_schema():
    cte_sql = """
    WITH completed AS (
        SELECT customer_id, net_amount
        FROM gold.fact_orders
        WHERE order_status = 'completed'
    )
    SELECT dc.region, SUM(c.net_amount) AS net_revenue
    FROM completed c
    LEFT JOIN gold.dim_customers dc ON c.customer_id = dc.customer_id
    GROUP BY dc.region
    LIMIT 50
    """
    res = verify_sql_guardrails(cte_sql)
    assert res.passed is True
    assert res.tables_accessed == ["gold.dim_customers", "gold.fact_orders"]


def test_sanity_checks_detect_partial_period_missing_dates_null_ratio_and_empty():
    cols = [
        ColumnMeta(key="order_date", label="Order Date", format="date", is_metric=False),
        ColumnMeta(key="net_revenue", label="Net Revenue", format="currency_idr", is_metric=True),
    ]
    daily_plan = QueryPlan(
        metrics=["net_revenue"],
        dimensions=["order_date"],
        time_grain="day",
    )

    # 1. Partial period + missing dates + high NULL ratio
    rows_with_issues = [
        {"order_date": "2026-11-01", "net_revenue": 1000000},
        {"order_date": "2026-11-02", "net_revenue": None},
        # 2026-11-03 is missing!
        {"order_date": "2026-11-04", "net_revenue": 2000000},
    ]
    checks, warnings = run_sanity_checks(
        rows=rows_with_issues,
        columns=cols,
        plan=daily_plan,
        includes_partial_period=True,
        partial_period_label="2026-11",
    )
    check_map = {c.name: c for c in checks}
    warning_codes = {w.code for w in warnings}
    assert check_map["partial_period_check"].passed is False
    assert check_map["missing_dates_check"].passed is False
    assert check_map["null_ratio_check"].passed is False
    assert check_map["empty_result_check"].passed is True
    assert {"PARTIAL_PERIOD", "MISSING_DATES", "HIGH_NULL_RATIO"} <= warning_codes

    # 2. Empty result check
    checks_empty, warnings_empty = run_sanity_checks(
        rows=[],
        columns=cols,
        plan=daily_plan,
        includes_partial_period=False,
    )
    empty_map = {c.name: c for c in checks_empty}
    assert empty_map["empty_result_check"].passed is False
    assert any(w.code == "EMPTY_RESULT" for w in warnings_empty)
