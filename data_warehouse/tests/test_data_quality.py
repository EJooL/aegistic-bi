"""Data quality test suite for the Aegistic DuckDB Gold Star Schema."""

from __future__ import annotations

import os
from datetime import date
from pathlib import Path

import duckdb
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = Path(os.environ.get("AEGISTIC_DB_PATH", str(REPO_ROOT / "aegistic.duckdb")))


@pytest.fixture(scope="module")
def dwh_conn() -> duckdb.DuckDBPyConnection:
    assert DB_PATH.exists(), (
        f"DuckDB warehouse not found at {DB_PATH}. Run `python data_warehouse/build_dwh.py` first."
    )
    conn = duckdb.connect(str(DB_PATH), read_only=True)
    yield conn
    conn.close()


def test_gold_tables_exist_with_expected_counts(dwh_conn: duckdb.DuckDBPyConnection) -> None:
    tables = {
        row[0]
        for row in dwh_conn.execute(
            """
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'gold'
            """
        ).fetchall()
    }
    expected = {
        "fact_orders",
        "fact_order_items",
        "dim_products",
        "dim_customers",
        "dim_date",
    }
    assert expected.issubset(tables), f"Missing Gold tables: {expected - tables}"

    fact_orders_cnt = dwh_conn.execute("SELECT COUNT(*) FROM gold.fact_orders").fetchone()[0]
    fact_items_cnt = dwh_conn.execute("SELECT COUNT(*) FROM gold.fact_order_items").fetchone()[0]
    dim_customers_cnt = dwh_conn.execute("SELECT COUNT(*) FROM gold.dim_customers").fetchone()[0]
    dim_products_cnt = dwh_conn.execute("SELECT COUNT(*) FROM gold.dim_products").fetchone()[0]
    dim_date_cnt = dwh_conn.execute("SELECT COUNT(*) FROM gold.dim_date").fetchone()[0]

    assert fact_orders_cnt >= 45_000, f"Expected >= 45,000 fact_orders, got {fact_orders_cnt}"
    assert fact_items_cnt >= 70_000, f"Expected >= 70,000 fact_order_items, got {fact_items_cnt}"
    assert dim_customers_cnt >= 10_000, f"Expected >= 10,000 dim_customers, got {dim_customers_cnt}"
    assert dim_products_cnt >= 100, f"Expected >= 100 dim_products, got {dim_products_cnt}"
    # 2025-06-01 through 2026-11-24 inclusive = 542 calendar days
    assert dim_date_cnt == 542, f"Expected 542 calendar days in dim_date, got {dim_date_cnt}"


@pytest.mark.parametrize(
    ("table", "pk_col"),
    [
        ("gold.fact_orders", "order_id"),
        ("gold.fact_order_items", "order_item_id"),
        ("gold.dim_products", "product_id"),
        ("gold.dim_customers", "customer_id"),
        ("gold.dim_date", "date_day"),
    ],
)
def test_primary_key_unique_and_not_null(
    dwh_conn: duckdb.DuckDBPyConnection, table: str, pk_col: str
) -> None:
    total, distinct_cnt, null_cnt = dwh_conn.execute(
        f"""
        SELECT
            COUNT(*) AS total_rows,
            COUNT(DISTINCT {pk_col}) AS distinct_pk,
            SUM(CASE WHEN {pk_col} IS NULL THEN 1 ELSE 0 END) AS null_pk
        FROM {table}
        """
    ).fetchone()
    assert null_cnt == 0, f"{table}.{pk_col} contains {null_cnt} NULL values"
    assert total == distinct_cnt, (
        f"{table}.{pk_col} is not unique: total={total}, distinct={distinct_cnt}"
    )


def test_foreign_key_integrity(dwh_conn: duckdb.DuckDBPyConnection) -> None:
    orphan_customers = dwh_conn.execute(
        """
        SELECT COUNT(*)
        FROM gold.fact_orders fo
        LEFT JOIN gold.dim_customers dc ON fo.customer_id = dc.customer_id
        WHERE dc.customer_id IS NULL
        """
    ).fetchone()[0]
    assert orphan_customers == 0, f"Found {orphan_customers} fact_orders with missing dim_customers"

    orphan_dates = dwh_conn.execute(
        """
        SELECT COUNT(*)
        FROM gold.fact_orders fo
        LEFT JOIN gold.dim_date dd ON fo.order_date = dd.date_day
        WHERE dd.date_day IS NULL
        """
    ).fetchone()[0]
    assert orphan_dates == 0, f"Found {orphan_dates} fact_orders with missing dim_date"

    orphan_item_orders = dwh_conn.execute(
        """
        SELECT COUNT(*)
        FROM gold.fact_order_items foi
        LEFT JOIN gold.fact_orders fo ON foi.order_id = fo.order_id
        WHERE fo.order_id IS NULL
        """
    ).fetchone()[0]
    assert orphan_item_orders == 0, (
        f"Found {orphan_item_orders} fact_order_items with missing fact_orders"
    )

    orphan_item_products = dwh_conn.execute(
        """
        SELECT COUNT(*)
        FROM gold.fact_order_items foi
        LEFT JOIN gold.dim_products dp ON foi.product_id = dp.product_id
        WHERE dp.product_id IS NULL
        """
    ).fetchone()[0]
    assert orphan_item_products == 0, (
        f"Found {orphan_item_products} fact_order_items with missing dim_products"
    )


def test_completed_order_financial_invariants(dwh_conn: duckdb.DuckDBPyConnection) -> None:
    invalid_net, mismatched_formula = dwh_conn.execute(
        """
        SELECT
            SUM(CASE WHEN net_amount < 0 THEN 1 ELSE 0 END),
            SUM(CASE WHEN net_amount <> (gross_amount - discount_amount) THEN 1 ELSE 0 END)
        FROM gold.fact_orders
        WHERE order_status = 'completed'
        """
    ).fetchone()
    assert invalid_net == 0, f"Found {invalid_net} completed orders with net_amount < 0"
    assert mismatched_formula == 0, (
        f"Found {mismatched_formula} completed orders where net_amount != gross - discount"
    )


def test_order_rank_completed_only(dwh_conn: duckdb.DuckDBPyConnection) -> None:
    missing_completed_rank, non_null_noncompleted_rank = dwh_conn.execute(
        """
        SELECT
            SUM(CASE WHEN order_status = 'completed' AND (order_rank IS NULL OR order_rank < 1) THEN 1 ELSE 0 END),
            SUM(CASE WHEN order_status <> 'completed' AND order_rank IS NOT NULL THEN 1 ELSE 0 END)
        FROM gold.fact_orders
        """
    ).fetchone()
    assert missing_completed_rank == 0, "Every completed order must have order_rank >= 1"
    assert non_null_noncompleted_rank == 0, "Cancelled/refunded orders must have NULL order_rank"


def test_bronze_duplicates_and_null_dates_eliminated_in_gold(
    dwh_conn: duckdb.DuckDBPyConnection,
) -> None:
    bronze_total, bronze_distinct, bronze_null_dates = dwh_conn.execute(
        """
        SELECT
            COUNT(*),
            COUNT(DISTINCT order_id),
            SUM(CASE WHEN order_date IS NULL OR TRIM(order_date) = '' THEN 1 ELSE 0 END)
        FROM bronze.raw_orders
        """
    ).fetchone()
    assert bronze_total > bronze_distinct, (
        "Expected intentional duplicate order_id rows in bronze.raw_orders"
    )
    assert bronze_null_dates > 0, (
        "Expected intentional NULL order_date rows in bronze.raw_orders"
    )

    gold_total, gold_distinct, gold_null_dates = dwh_conn.execute(
        """
        SELECT
            COUNT(*),
            COUNT(DISTINCT order_id),
            SUM(CASE WHEN order_date IS NULL THEN 1 ELSE 0 END)
        FROM gold.fact_orders
        """
    ).fetchone()
    assert gold_total == gold_distinct, "gold.fact_orders must have zero duplicate order_ids"
    assert gold_null_dates == 0, "gold.fact_orders must have zero NULL order_dates"


def test_partial_period_flag_on_dim_date(dwh_conn: duckdb.DuckDBPyConnection) -> None:
    nov_2026_false, other_true, nov_2026_days = dwh_conn.execute(
        """
        SELECT
            SUM(CASE WHEN month_start = DATE '2026-11-01' AND NOT is_partial_period THEN 1 ELSE 0 END),
            SUM(CASE WHEN month_start <> DATE '2026-11-01' AND is_partial_period THEN 1 ELSE 0 END),
            SUM(CASE WHEN month_start = DATE '2026-11-01' THEN 1 ELSE 0 END)
        FROM gold.dim_date
        """
    ).fetchone()
    assert nov_2026_days == 24, f"Expected 24 days in partial month 2026-11, got {nov_2026_days}"
    assert nov_2026_false == 0, "All 2026-11 dates must have is_partial_period = TRUE"
    assert other_true == 0, "No dates outside 2026-11 should have is_partial_period = TRUE"


def test_item_level_reconciles_with_order_level_net_revenue(
    dwh_conn: duckdb.DuckDBPyConnection,
) -> None:
    order_net_rev = dwh_conn.execute(
        """
        SELECT SUM(net_amount)
        FROM gold.fact_orders
        WHERE order_status = 'completed'
        """
    ).fetchone()[0]

    item_net_rev = dwh_conn.execute(
        """
        SELECT SUM(foi.item_net_amount)
        FROM gold.fact_order_items foi
        INNER JOIN gold.fact_orders fo ON foi.order_id = fo.order_id
        WHERE fo.order_status = 'completed'
        """
    ).fetchone()[0]

    assert order_net_rev > 0
    assert order_net_rev == item_net_rev, (
        f"Item-level net revenue ({item_net_rev}) != order-level net revenue ({order_net_rev})"
    )


def test_intentional_zero_order_dates_present_in_dim_date(
    dwh_conn: duckdb.DuckDBPyConnection,
) -> None:
    target_dates = [date(2026, 8, 17), date(2026, 9, 3)]
    for d in target_dates:
        in_dim = dwh_conn.execute(
            "SELECT COUNT(*) FROM gold.dim_date WHERE date_day = ?", [d]
        ).fetchone()[0]
        order_cnt = dwh_conn.execute(
            "SELECT COUNT(*) FROM gold.fact_orders WHERE order_date = ?", [d]
        ).fetchone()[0]
        assert in_dim == 1, f"{d} must exist in gold.dim_date"
        assert order_cnt == 0, f"{d} must have 0 orders in gold.fact_orders (got {order_cnt})"
