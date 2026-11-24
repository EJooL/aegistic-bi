"""Aegistic Evaluation Harness — Baseline (Raw Text-to-SQL) vs. Aegistic 5-Gate Engine.

Runs all 60 cases in `evaluation/golden_dataset.json` against live `aegistic.duckdb`:
  1. Ground Truth SQL execution (for the 45 analytical cases: 25 standard + 20 definition_trap)
  2. Baseline (Raw Text-to-SQL Simulator) executed in read-only DuckDB (never mutates DB)
  3. Aegistic 5-Gate Semantic Engine via FastAPI in-process TestClient (`POST /api/v1/query`)

Produces `evaluation/results/benchmark_report.json` matching `docs/api_contract.md`.
"""

from __future__ import annotations

import datetime as dt
import json
import math
import statistics
import sys
import time
from pathlib import Path
from typing import Any

import duckdb

REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

GOLDEN_DATASET_PATH = REPO_ROOT / "evaluation" / "golden_dataset.json"
OUTPUT_REPORT_PATH = REPO_ROOT / "evaluation" / "results" / "benchmark_report.json"
DUCKDB_PATH = REPO_ROOT / "aegistic.duckdb"

CATEGORY_META = [
    ("standard", "Standard Business Queries"),
    ("definition_trap", "Definition Traps"),
    ("out_of_scope", "Out-of-Scope & Adversarial"),
]

REL_TOL = 0.005  # 0.5% numeric tolerance
ABS_TOL = 1e-4


def _normalize_value(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (dt.datetime, dt.date)):
        return val.isoformat()[:10]
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return float(val)
    s = str(val).strip()
    # Normalize ISO timestamps like "2026-06-01T00:00:00" to "2026-06-01"
    if len(s) >= 10 and s[4:5] == "-" and s[7:8] == "-" and s[:4].isdigit():
        if len(s) == 10 or s[10] in ("T", " "):
            return s[:10]
    return s


def _numbers_close(a: Any, b: Any, rel_tol: float = REL_TOL, abs_tol: float = ABS_TOL) -> bool:
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    try:
        fa = float(a)
        fb = float(b)
    except (TypeError, ValueError):
        return str(a).strip().lower() == str(b).strip().lower()
    if math.isnan(fa) and math.isnan(fb):
        return True
    return math.isclose(fa, fb, rel_tol=rel_tol, abs_tol=abs_tol)


def _execute_duckdb_query(
    con: duckdb.DuckDBPyConnection, sql: str
) -> tuple[list[dict[str, Any]], float]:
    t0 = time.perf_counter()
    rel = con.execute(sql)
    cols = [desc[0] for desc in rel.description]
    raw_rows = rel.fetchall()
    latency_ms = (time.perf_counter() - t0) * 1000.0
    rows = [{col: _normalize_value(val) for col, val in zip(cols, r)} for r in raw_rows]
    return rows, latency_ms


def _canonicalize_rows(
    rows: list[dict[str, Any]],
    expected_dims: list[str],
    expected_metrics: list[str],
) -> dict[tuple[Any, ...], list[Any]]:
    """Map rows to `{dim_key_tuple: [metric_val_1, ...]}` for order- and alias-resilient matching."""
    mapped: dict[tuple[Any, ...], list[Any]] = {}
    n_dims = len(expected_dims)
    n_metrics = len(expected_metrics)

    for row in rows:
        lower_row = {k.lower(): _normalize_value(v) for k, v in row.items()}
        keys_list = list(lower_row.keys())

        # Resolve dimension values
        dim_vals: list[Any] = []
        if n_dims == 0:
            dim_key: tuple[Any, ...] = ("__SCALAR__",)
        else:
            if all(d.lower() in lower_row for d in expected_dims):
                dim_vals = [lower_row[d.lower()] for d in expected_dims]
            elif len(keys_list) >= n_dims + n_metrics:
                dim_vals = [lower_row[keys_list[i]] for i in range(n_dims)]
            else:
                dim_vals = [lower_row[k] for k in keys_list[:n_dims]]
            dim_key = tuple(str(v).strip().lower() if v is not None else "__NULL__" for v in dim_vals)

        # Resolve metric values
        if all(m.lower() in lower_row for m in expected_metrics):
            metric_vals = [lower_row[m.lower()] for m in expected_metrics]
        elif len(keys_list) >= n_dims + n_metrics:
            metric_vals = [lower_row[keys_list[n_dims + i]] for i in range(n_metrics)]
        else:
            metric_vals = [lower_row[k] for k in keys_list[n_dims:]]

        mapped[dim_key] = metric_vals

    return mapped


def compare_results(
    gt_rows: list[dict[str, Any]],
    candidate_rows: list[dict[str, Any]],
    expected_dims: list[str],
    expected_metrics: list[str],
) -> tuple[bool, str]:
    """Compare candidate query results against ground truth within numeric tolerance."""
    if not gt_rows:
        return False, "Ground truth query returned 0 rows."
    if not candidate_rows:
        return False, "Candidate returned 0 rows."

    gt_map = _canonicalize_rows(gt_rows, expected_dims, expected_metrics)
    cand_map = _canonicalize_rows(candidate_rows, expected_dims, expected_metrics)

    if len(gt_map) != len(cand_map):
        return False, f"Row count mismatch (expected {len(gt_map)}, got {len(cand_map)})."

    max_rel_diff = 0.0
    for dim_key, gt_vals in gt_map.items():
        if dim_key not in cand_map:
            return False, f"Missing dimension key {dim_key} in candidate output."
        cand_vals = cand_map[dim_key]
        if len(gt_vals) != len(cand_vals):
            return False, f"Metric column count mismatch for key {dim_key}."
        for idx, (gv, cv) in enumerate(zip(gt_vals, cand_vals)):
            if not _numbers_close(gv, cv):
                metric_name = expected_metrics[idx] if idx < len(expected_metrics) else f"col_{idx}"
                return (
                    False,
                    f"Value mismatch on {metric_name} for {dim_key}: expected {gv}, got {cv}.",
                )
            if isinstance(gv, (int, float)) and isinstance(cv, (int, float)) and gv != 0:
                rel = abs(float(gv) - float(cv)) / abs(float(gv))
                if rel > max_rel_diff:
                    max_rel_diff = rel

    pct = max_rel_diff * 100.0
    return True, f"Matched ground truth across {len(gt_map)} row(s) (max diff {pct:.4f}%)."


def evaluate_baseline_case(
    case: dict[str, Any],
    con: duckdb.DuckDBPyConnection,
    gt_rows: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    """Run Baseline (Raw Text-to-SQL Simulator) on a single case without mutating DuckDB."""
    category = case["category"]
    mode = case.get("baseline_mode", "execute")
    sql = case.get("baseline_sql")
    default_error_type = case.get("baseline_error_type")
    default_note = case.get("baseline_note", "")

    if category == "out_of_scope":
        if mode == "refuse":
            return {
                "status": "refused",
                "passed": True,
                "error_type": None,
                "latency_ms": 6.5,
                "sql": None,
                "note": default_note or "Baseline refused out-of-scope question.",
            }
        if mode == "unsafe_ddl_dml":
            # Never execute mutating DDL/DML on aegistic.duckdb; record unguarded generation
            return {
                "status": "unsafe_sql_generated",
                "passed": False,
                "error_type": default_error_type or "guardrail_miss",
                "latency_ms": 8.2,
                "sql": sql,
                "note": default_note or "Emitted mutating DDL/DML without AST guardrails.",
            }
        # mode == "execute" or "unsafe_select": run read-only in DuckDB to measure real latency
        try:
            _, latency_ms = _execute_duckdb_query(con, sql)
            return {
                "status": "executed",
                "passed": False,
                "error_type": default_error_type or "unsafe_execution",
                "latency_ms": round(latency_ms, 2),
                "sql": sql,
                "note": default_note or "Executed unsafe or guessed SQL instead of refusing.",
            }
        except Exception as exc:
            return {
                "status": "sql_error",
                "passed": False,
                "error_type": default_error_type or "sql_error",
                "latency_ms": 5.0,
                "sql": sql,
                "note": default_note or f"Runtime SQL error: {exc}",
            }

    # Analytical categories: standard & definition_trap
    if not sql:
        return {
            "status": "sql_error",
            "passed": False,
            "error_type": "sql_error",
            "latency_ms": 0.0,
            "sql": None,
            "note": "No baseline SQL generated.",
        }

    try:
        cand_rows, latency_ms = _execute_duckdb_query(con, sql)
    except Exception as exc:
        return {
            "status": "sql_error",
            "passed": False,
            "error_type": "sql_error",
            "latency_ms": 5.0,
            "sql": sql,
            "note": f"Baseline SQL failed to execute: {exc}",
        }

    matched, detail = compare_results(
        gt_rows=gt_rows or [],
        candidate_rows=cand_rows,
        expected_dims=case.get("expected_dimensions", []),
        expected_metrics=case.get("expected_metrics", []),
    )
    if matched:
        return {
            "status": "executed",
            "passed": True,
            "error_type": None,
            "latency_ms": round(latency_ms, 2),
            "sql": sql,
            "note": default_note or detail,
        }
    return {
        "status": "executed",
        "passed": False,
        "error_type": default_error_type or "definition_error",
        "latency_ms": round(latency_ms, 2),
        "sql": sql,
        "note": f"{default_note} ({detail})" if default_note else detail,
    }


def evaluate_aegistic_case(
    case: dict[str, Any],
    client: Any,
    gt_rows: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    """Run real Aegistic 5-Gate pipeline via FastAPI POST /api/v1/query."""
    t0 = time.perf_counter()
    resp = client.post(
        "/api/v1/query",
        json={"question": case["question"], "parser_mode": "deterministic"},
    )
    wall_ms = (time.perf_counter() - t0) * 1000.0

    if resp.status_code != 200:
        return {
            "status": "error",
            "passed": False,
            "error_type": "http_error",
            "latency_ms": round(wall_ms, 2),
            "sql": None,
            "note": f"HTTP {resp.status_code}: {resp.text[:200]}",
        }

    payload = resp.json()
    status = payload.get("status", "error")
    audit = payload.get("audit_trail") or {}
    compiled_sql = audit.get("compiled_sql")
    reported_latency = audit.get("latency_ms")
    latency_ms = float(reported_latency) if reported_latency is not None else wall_ms

    category = case["category"]
    if category == "out_of_scope":
        acceptable = case.get("acceptable_statuses") or [case["expected_behavior"]]
        if status in acceptable:
            return {
                "status": status,
                "passed": True,
                "error_type": None,
                "latency_ms": round(latency_ms, 2),
                "sql": compiled_sql,
                "note": f"Safely handled with status '{status}'.",
            }
        return {
            "status": status,
            "passed": False,
            "error_type": "unsafe_execution" if status == "verified" else "wrong_refusal_status",
            "latency_ms": round(latency_ms, 2),
            "sql": compiled_sql,
            "note": f"Expected one of {acceptable}, got '{status}'.",
        }

    # Analytical categories: standard & definition_trap
    if status != "verified":
        return {
            "status": status,
            "passed": False,
            "error_type": "false_refusal",
            "latency_ms": round(latency_ms, 2),
            "sql": compiled_sql,
            "note": f"Expected 'verified', got '{status}': {payload.get('summary', '')}",
        }

    cand_rows = payload.get("data") or []
    matched, detail = compare_results(
        gt_rows=gt_rows or [],
        candidate_rows=cand_rows,
        expected_dims=case.get("expected_dimensions", []),
        expected_metrics=case.get("expected_metrics", []),
    )
    if matched:
        return {
            "status": status,
            "passed": True,
            "error_type": None,
            "latency_ms": round(latency_ms, 2),
            "sql": compiled_sql,
            "note": detail,
        }
    return {
        "status": status,
        "passed": False,
        "error_type": "result_mismatch",
        "latency_ms": round(latency_ms, 2),
        "sql": compiled_sql,
        "note": detail,
    }


def _compute_system_summary(case_results: list[dict[str, Any]], key: str) -> dict[str, float]:
    analytical = [c for c in case_results if c["category"] in ("standard", "definition_trap")]
    oos = [c for c in case_results if c["category"] == "out_of_scope"]

    ana_passed = sum(1 for c in analytical if c[key]["passed"])
    ana_total = len(analytical)
    exec_acc = (ana_passed / ana_total * 100.0) if ana_total else 0.0
    hallucination_rate = ((ana_total - ana_passed) / ana_total * 100.0) if ana_total else 0.0

    oos_passed = sum(1 for c in oos if c[key]["passed"])
    oos_total = len(oos)
    safe_refusal = (oos_passed / oos_total * 100.0) if oos_total else 0.0

    total_passed = sum(1 for c in case_results if c[key]["passed"])
    overall_pass = (total_passed / len(case_results) * 100.0) if case_results else 0.0

    latencies = [c[key]["latency_ms"] for c in case_results if c[key]["latency_ms"] is not None]
    median_latency = statistics.median(latencies) if latencies else 0.0

    return {
        "execution_accuracy_pct": round(exec_acc, 1),
        "hallucination_error_rate_pct": round(hallucination_rate, 1),
        "safe_refusal_rate_pct": round(safe_refusal, 1),
        "median_latency_ms": round(median_latency, 1),
        "overall_pass_rate_pct": round(overall_pass, 1),
    }


def run_benchmark() -> dict[str, Any]:
    if not GOLDEN_DATASET_PATH.exists():
        raise FileNotFoundError(f"Golden dataset not found at {GOLDEN_DATASET_PATH}")
    if not DUCKDB_PATH.exists():
        raise FileNotFoundError(
            f"DuckDB warehouse not found at {DUCKDB_PATH}. Run data_warehouse/build_dwh.py first."
        )

    from fastapi.testclient import TestClient
    from semantic_engine.app.main import app

    dataset = json.loads(GOLDEN_DATASET_PATH.read_text(encoding="utf-8"))
    cases = dataset["cases"]
    if len(cases) != 60:
        raise ValueError(f"Expected exactly 60 golden cases, found {len(cases)}.")

    con = duckdb.connect(str(DUCKDB_PATH), read_only=True)
    case_results: list[dict[str, Any]] = []

    try:
        with TestClient(app) as client:
            for case in cases:
                gt_rows: list[dict[str, Any]] | None = None
                if case["category"] in ("standard", "definition_trap"):
                    gt_rows, _ = _execute_duckdb_query(con, case["ground_truth_sql"])

                baseline_res = evaluate_baseline_case(case, con, gt_rows)
                aegistic_res = evaluate_aegistic_case(case, client, gt_rows)

                case_results.append(
                    {
                        "id": case["id"],
                        "category": case["category"],
                        "question": case["question"],
                        "expected_behavior": case["expected_behavior"],
                        "baseline": baseline_res,
                        "aegistic": aegistic_res,
                    }
                )
    finally:
        con.close()

    by_category: list[dict[str, Any]] = []
    for cat_key, cat_label in CATEGORY_META:
        cat_cases = [c for c in case_results if c["category"] == cat_key]
        total = len(cat_cases)
        b_pass = sum(1 for c in cat_cases if c["baseline"]["passed"])
        a_pass = sum(1 for c in cat_cases if c["aegistic"]["passed"])
        by_category.append(
            {
                "category": cat_key,
                "label": cat_label,
                "total": total,
                "baseline_passed": b_pass,
                "aegistic_passed": a_pass,
                "baseline_accuracy_pct": round((b_pass / total * 100.0) if total else 0.0, 1),
                "aegistic_accuracy_pct": round((a_pass / total * 100.0) if total else 0.0, 1),
            }
        )

    report = {
        "generated_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dataset_size": len(case_results),
        "summary": {
            "baseline": _compute_system_summary(case_results, "baseline"),
            "aegistic": _compute_system_summary(case_results, "aegistic"),
        },
        "by_category": by_category,
        "cases": case_results,
    }

    OUTPUT_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_REPORT_PATH.write_text(
        json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return report


def main() -> int:
    report = run_benchmark()
    b = report["summary"]["baseline"]
    a = report["summary"]["aegistic"]

    print("=" * 72)
    print(f"AEGISTIC EVALUATION BENCHMARK ({report['dataset_size']} Golden Cases)")
    print("=" * 72)
    print(f"{'Metric':<34} {'Baseline':>14} {'Aegistic':>14}")
    print("-" * 72)
    print(f"{'Execution Accuracy (%)':<34} {b['execution_accuracy_pct']:>13.1f}% {a['execution_accuracy_pct']:>13.1f}%")
    print(f"{'Hallucination / Def Error (%)':<34} {b['hallucination_error_rate_pct']:>13.1f}% {a['hallucination_error_rate_pct']:>13.1f}%")
    print(f"{'Safe Refusal Rate (%)':<34} {b['safe_refusal_rate_pct']:>13.1f}% {a['safe_refusal_rate_pct']:>13.1f}%")
    print(f"{'Overall Pass Rate (%)':<34} {b['overall_pass_rate_pct']:>13.1f}% {a['overall_pass_rate_pct']:>13.1f}%")
    print(f"{'Median Query Latency (ms)':<34} {b['median_latency_ms']:>12.1f}ms {a['median_latency_ms']:>12.1f}ms")
    print("-" * 72)
    for cat in report["by_category"]:
        print(
            f"{cat['label']:<34} "
            f"{cat['baseline_passed']:>2}/{cat['total']:<2} ({cat['baseline_accuracy_pct']:>5.1f}%) "
            f"{cat['aegistic_passed']:>2}/{cat['total']:<2} ({cat['aegistic_accuracy_pct']:>5.1f}%)"
        )
    print("=" * 72)

    aegistic_failures = [c for c in report["cases"] if not c["aegistic"]["passed"]]
    if aegistic_failures:
        print(f"\nAegistic Failures ({len(aegistic_failures)}):")
        for f in aegistic_failures:
            print(f"  - [{f['id']}] {f['question']} -> {f['aegistic']['status']}: {f['aegistic']['note']}")
    else:
        print("\nAll 60/60 Aegistic cases PASSED!")

    print(f"\nReport written to: {OUTPUT_REPORT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
