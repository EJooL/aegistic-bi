"""Medallion Data Warehouse builder for Aegistic (Bronze -> Silver -> Gold).

Builds `aegistic.duckdb` in the repository root (or the path specified in
`AEGISTIC_DB_PATH`). Runs schema initialization, deterministic Bronze data
seeding, and all Silver & Gold SQL transformations in alphabetical order.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

import duckdb

# Support running as `python data_warehouse/build_dwh.py` or as a module
DWH_DIR = Path(__file__).resolve().parent
REPO_ROOT = DWH_DIR.parent
if str(DWH_DIR) not in sys.path:
    sys.path.insert(0, str(DWH_DIR))

from seed_raw_data import populate_bronze  # noqa: E402

SQL_DIR = DWH_DIR / "sql"

SUMMARY_TABLES = [
    ("bronze", "raw_customers"),
    ("bronze", "raw_products"),
    ("bronze", "raw_orders"),
    ("bronze", "raw_payments"),
    ("bronze", "raw_order_items"),
    ("silver", "customers"),
    ("silver", "products"),
    ("silver", "payments"),
    ("silver", "orders"),
    ("silver", "order_items"),
    ("gold", "dim_date"),
    ("gold", "dim_customers"),
    ("gold", "dim_products"),
    ("gold", "fact_orders"),
    ("gold", "fact_order_items"),
]


def _run_sql_folder(conn: duckdb.DuckDBPyConnection, folder: Path) -> list[str]:
    executed: list[str] = []
    for sql_file in sorted(folder.glob("*.sql")):
        sql_text = sql_file.read_text(encoding="utf-8")
        conn.execute(sql_text)
        executed.append(sql_file.name)
    return executed


def build_warehouse(db_path: Path | None = None) -> Path:
    """Build the complete DuckDB Medallion warehouse and return its path."""
    target_path = db_path or Path(
        os.environ.get("AEGISTIC_DB_PATH", str(REPO_ROOT / "aegistic.duckdb"))
    )
    target_path.parent.mkdir(parents=True, exist_ok=True)

    started = time.perf_counter()
    print(f"Building Aegistic DuckDB warehouse at: {target_path}")

    with duckdb.connect(str(target_path)) as conn:
        # 1. Create schemas and Bronze tables
        conn.execute("CREATE SCHEMA IF NOT EXISTS bronze;")
        conn.execute("CREATE SCHEMA IF NOT EXISTS silver;")
        conn.execute("CREATE SCHEMA IF NOT EXISTS gold;")
        bronze_files = _run_sql_folder(conn, SQL_DIR / "bronze")
        print(f"  [Bronze DDL] Executed: {', '.join(bronze_files)}")

        # 2. Populate Bronze raw tables deterministically
        populate_bronze(conn)
        print("  [Bronze Seed] Populated raw tables via deterministic generator (seed=42)")

        # 3. Transform Bronze -> Silver
        silver_files = _run_sql_folder(conn, SQL_DIR / "silver")
        print(f"  [Silver SQL] Executed: {', '.join(silver_files)}")

        # 4. Transform Silver -> Gold (Star Schema)
        gold_files = _run_sql_folder(conn, SQL_DIR / "gold")
        print(f"  [Gold SQL]   Executed: {', '.join(gold_files)}")

        # 5. Print concise layer summary
        print("\nLayer Summary (Row Counts):")
        print(f"  {'Table':<26} {'Rows':>12}")
        print(f"  {'-' * 26} {'-' * 12}")
        for schema_name, table_name in SUMMARY_TABLES:
            count = conn.execute(
                f"SELECT COUNT(*) FROM {schema_name}.{table_name}"
            ).fetchone()[0]
            print(f"  {schema_name + '.' + table_name:<26} {count:>12,}")

        stats = conn.execute(
            """
            SELECT
                COUNT(DISTINCT CASE WHEN order_status = 'completed' THEN order_id END) AS completed_orders,
                SUM(CASE WHEN order_status = 'completed' THEN net_amount ELSE 0 END) AS net_revenue,
                COUNT(DISTINCT CASE WHEN order_status = 'completed' AND order_rank > 1 THEN customer_id END) * 1.0
                    / NULLIF(COUNT(DISTINCT CASE WHEN order_status = 'completed' THEN customer_id END), 0) AS repeat_rate,
                COUNT(DISTINCT CASE WHEN order_status IN ('refunded', 'cancelled') THEN order_id END) * 1.0
                    / NULLIF(COUNT(DISTINCT order_id), 0) AS refund_rate
            FROM gold.fact_orders
            """
        ).fetchone()

        elapsed = time.perf_counter() - started
        print("\nGold Star Schema Snapshot:")
        print(f"  Completed Orders : {stats[0]:,}")
        print(f"  Net Revenue (IDR): {stats[1]:,}")
        print(f"  Repeat Rate      : {stats[2] * 100:.2f}%")
        print(f"  Refund/Cancel    : {stats[3] * 100:.2f}%")
        print(f"  Build Time       : {elapsed:.2f}s")

    return target_path


if __name__ == "__main__":
    build_warehouse()
