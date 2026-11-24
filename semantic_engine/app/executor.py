"""Gate 4 — Read-only DuckDB Execution & Post-Query Sanity Checks."""

from __future__ import annotations

import math
import threading
import time
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from typing import Any, Optional

import duckdb

from semantic_engine.app.schemas import ColumnMeta, QueryPlan, SanityCheck, WarningItem


@dataclass
class ExecutionResult:
    rows: list[dict[str, Any]]
    latency_ms: float
    row_count: int
    sanity_checks: list[SanityCheck] = field(default_factory=list)
    warnings: list[WarningItem] = field(default_factory=list)


def _serialize_cell(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, Decimal):
        f_val = float(value)
        if math.isnan(f_val) or math.isinf(f_val):
            return None
        return int(value) if value == value.to_integral_value() else f_val
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return value


def _detect_partial_period_overlap(
    conn: duckdb.DuckDBPyConnection,
    plan: QueryPlan,
    rows: list[dict[str, Any]],
) -> tuple[bool, str]:
    """Check whether the queried period overlaps any is_partial_period = TRUE calendar dates."""
    try:
        meta = conn.execute(
            """
            SELECT
                MIN(date_day) AS min_partial,
                MAX(date_day) AS max_partial,
                MIN(month_start) AS partial_month,
                MIN(quarter_label) AS partial_quarter
            FROM gold.dim_date
            WHERE is_partial_period = TRUE
            """
        ).fetchone()
    except Exception:
        return False, "2026-11"

    if not meta or meta[0] is None:
        return False, ""

    min_partial: date = meta[0]
    max_partial: date = meta[1]
    partial_month: date = meta[2]
    partial_quarter: str = str(meta[3])
    period_label = partial_month.strftime("%Y-%m")

    # 1. Explicit quarters filter
    if plan.date_range and plan.date_range.quarters:
        return (partial_quarter in plan.date_range.quarters), period_label

    # 2. Explicit start_date / end_date filter
    if plan.date_range and (plan.date_range.start_date or plan.date_range.end_date):
        start_d = (
            date.fromisoformat(plan.date_range.start_date)
            if plan.date_range.start_date
            else date.min
        )
        end_d = (
            date.fromisoformat(plan.date_range.end_date)
            if plan.date_range.end_date
            else date.max
        )
        overlaps = start_d <= max_partial and end_d >= min_partial
        return overlaps, period_label

    # 3. Unfiltered date range (all_time): check returned order_date rows if present
    if "order_date" in plan.dimensions and rows:
        for row in rows:
            val = row.get("order_date")
            if val is None:
                continue
            val_str = str(val)
            if plan.time_grain == "quarter":
                if val_str == partial_quarter:
                    return True, period_label
            else:
                try:
                    row_date = date.fromisoformat(val_str[:10])
                    if row_date >= partial_month:
                        return True, period_label
                except ValueError:
                    continue
        return False, period_label

    # 4. Unfiltered non-time query spans entire DWH including partial current month
    return True, period_label


def run_sanity_checks(
    rows: list[dict[str, Any]],
    columns: list[ColumnMeta],
    plan: QueryPlan,
    includes_partial_period: bool,
    partial_period_label: str = "2026-11",
) -> tuple[list[SanityCheck], list[WarningItem]]:
    """Run all post-query data quality sanity checks on query results."""
    checks: list[SanityCheck] = []
    warnings: list[WarningItem] = []

    # 1. Partial period check
    if includes_partial_period and len(rows) > 0:
        checks.append(
            SanityCheck(
                name="partial_period_check",
                passed=False,
                severity="warning",
                detail=f"Data includes an incomplete current month ({partial_period_label}).",
            )
        )
        warnings.append(
            WarningItem(
                code="PARTIAL_PERIOD",
                severity="warning",
                title="Partial Period Detected",
                message=(
                    f"Periode bulan berjalan ({partial_period_label}) belum berakhir sepenuhnya. "
                    "Angka bulan berjalan mungkin lebih rendah dari bulan penuh."
                ),
            )
        )
    else:
        checks.append(
            SanityCheck(
                name="partial_period_check",
                passed=True,
                severity="info",
                detail="Queried period contains only completed calendar periods.",
            )
        )

    # 2. Missing dates check (for daily time-series queries)
    if plan.time_grain == "day" and "order_date" in plan.dimensions and len(rows) >= 2:
        parsed_dates: list[date] = []
        for row in rows:
            raw_d = row.get("order_date")
            if raw_d is not None:
                try:
                    parsed_dates.append(date.fromisoformat(str(raw_d)[:10]))
                except ValueError:
                    continue

        if len(parsed_dates) >= 2:
            date_set = set(parsed_dates)
            min_d = min(date_set)
            max_d = max(date_set)
            missing_dates: list[str] = []
            cursor = min_d
            while cursor <= max_d:
                if cursor not in date_set:
                    missing_dates.append(cursor.isoformat())
                cursor += timedelta(days=1)

            if missing_dates:
                sample = ", ".join(missing_dates[:3])
                more = f" (+{len(missing_dates) - 3} more)" if len(missing_dates) > 3 else ""
                checks.append(
                    SanityCheck(
                        name="missing_dates_check",
                        passed=False,
                        severity="warning",
                        detail=(
                            f"Detected {len(missing_dates)} missing date(s) in daily time series "
                            f"between {min_d.isoformat()} and {max_d.isoformat()} (e.g. {sample}{more})."
                        ),
                    )
                )
                warnings.append(
                    WarningItem(
                        code="MISSING_DATES",
                        severity="warning",
                        title="Missing Dates in Time Series",
                        message=(
                            f"Terdeteksi {len(missing_dates)} tanggal kosong pada deret waktu harian "
                            f"({min_d.isoformat()} s/d {max_d.isoformat()}), misalnya: {sample}{more}."
                        ),
                    )
                )
            else:
                checks.append(
                    SanityCheck(
                        name="missing_dates_check",
                        passed=True,
                        severity="info",
                        detail="No date gaps detected in daily time series.",
                    )
                )

    # 3. Null ratio check (> 10% NULL in any returned column)
    high_null_cols: list[tuple[str, float]] = []
    if len(rows) > 0:
        col_keys = [c.key for c in columns] if columns else list(rows[0].keys())
        total = len(rows)
        for col_key in col_keys:
            null_count = sum(1 for row in rows if row.get(col_key) is None)
            ratio = null_count / total
            if ratio > 0.10:
                high_null_cols.append((col_key, ratio))

    if high_null_cols:
        col_summary = ", ".join(f"{name} ({ratio * 100:.1f}%)" for name, ratio in high_null_cols)
        checks.append(
            SanityCheck(
                name="null_ratio_check",
                passed=False,
                severity="warning",
                detail=f"Columns exceeding 10% NULL threshold: {col_summary}.",
            )
        )
        warnings.append(
            WarningItem(
                code="HIGH_NULL_RATIO",
                severity="warning",
                title="High NULL Ratio Detected",
                message=(
                    f"Kolom dengan proporsi nilai NULL > 10% terdeteksi: {col_summary}. "
                    "Periksa filter atau kelengkapan data dimensi terkait."
                ),
            )
        )
    else:
        checks.append(
            SanityCheck(
                name="null_ratio_check",
                passed=True,
                severity="info",
                detail="All columns have <= 10% NULL values.",
            )
        )

    # 4. Empty result check
    if len(rows) == 0:
        checks.append(
            SanityCheck(
                name="empty_result_check",
                passed=False,
                severity="warning",
                detail="Query returned 0 rows.",
            )
        )
        warnings.append(
            WarningItem(
                code="EMPTY_RESULT",
                severity="warning",
                title="Empty Result Set",
                message=(
                    "Kueri berhasil dieksekusi namun menghasilkan 0 baris data "
                    "untuk kombinasi filter dan rentang waktu yang dipilih."
                ),
            )
        )
    else:
        checks.append(
            SanityCheck(
                name="empty_result_check",
                passed=True,
                severity="info",
                detail=f"Query returned {len(rows)} rows.",
            )
        )

    return checks, warnings


def execute_safe_sql(
    safe_sql: str,
    db_path: Path | str,
    plan: QueryPlan,
    columns: list[ColumnMeta],
    timeout_seconds: float = 10.0,
) -> ExecutionResult:
    """Execute guardrail-verified SQL against DuckDB in read_only=True mode with timeout."""
    path = Path(db_path)
    if not path.exists():
        raise FileNotFoundError(
            f"DuckDB data warehouse not found at {path}. Run data_warehouse/build_dwh.py first."
        )

    conn = duckdb.connect(str(path), read_only=True)
    timed_out = False

    def _interrupt() -> None:
        nonlocal timed_out
        timed_out = True
        try:
            conn.interrupt()
        except Exception:
            pass

    timer = threading.Timer(timeout_seconds, _interrupt)
    start_time = time.perf_counter()
    try:
        timer.start()
        cursor = conn.execute(safe_sql)
        col_names = [desc[0] for desc in (cursor.description or [])]
        raw_rows = cursor.fetchall()
        latency_ms = round((time.perf_counter() - start_time) * 1000.0, 2)

        rows = [
            {col_names[i]: _serialize_cell(val) for i, val in enumerate(raw_row)}
            for raw_row in raw_rows
        ]
        includes_partial, partial_label = _detect_partial_period_overlap(conn, plan, rows)
    except Exception as exc:
        if timed_out:
            raise TimeoutError(
                f"DuckDB query exceeded timeout of {timeout_seconds:.1f}s."
            ) from exc
        raise
    finally:
        timer.cancel()
        conn.close()

    sanity_checks, warnings = run_sanity_checks(
        rows=rows,
        columns=columns,
        plan=plan,
        includes_partial_period=includes_partial,
        partial_period_label=partial_label,
    )

    return ExecutionResult(
        rows=rows,
        latency_ms=latency_ms,
        row_count=len(rows),
        sanity_checks=sanity_checks,
        warnings=warnings,
    )


def check_duckdb_health(db_path: Path | str) -> tuple[bool, list[str]]:
    """Verify read-only DuckDB connectivity and list available gold.* tables."""
    path = Path(db_path)
    if not path.exists():
        return False, []
    conn: Optional[duckdb.DuckDBPyConnection] = None
    try:
        conn = duckdb.connect(str(path), read_only=True)
        rows = conn.execute(
            """
            SELECT table_schema || '.' || table_name AS full_name
            FROM information_schema.tables
            WHERE table_schema = 'gold'
            ORDER BY table_name
            """
        ).fetchall()
        return True, [str(r[0]) for r in rows]
    except Exception:
        return False, []
    finally:
        if conn is not None:
            conn.close()
