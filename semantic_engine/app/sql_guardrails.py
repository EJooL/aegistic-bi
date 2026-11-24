"""Gate 3 — sqlglot AST SQL Guardrails for DuckDB read-only analytical queries."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

import sqlglot
from sqlglot import exp

from semantic_engine.app.schemas import GuardrailCheck

MAX_ROW_LIMIT = 1000

# Forbidden AST expression names checked across the entire parsed tree
_FORBIDDEN_NODE_NAMES = (
    "Drop",
    "Delete",
    "Update",
    "Insert",
    "Alter",
    "AlterTable",
    "Create",
    "Command",
    "Copy",
    "Attach",
    "Detach",
    "Pragma",
    "TruncateTable",
    "Merge",
    "Grant",
    "Revoke",
    "Commit",
    "Rollback",
    "Transaction",
    "Into",
    "Set",
    "LoadData",
    "Export",
    "Use",
)

FORBIDDEN_AST_TYPES: tuple[type[exp.Expression], ...] = tuple(
    cls
    for name in _FORBIDDEN_NODE_NAMES
    if (cls := getattr(exp, name, None)) is not None
    and isinstance(cls, type)
    and issubclass(cls, exp.Expression)
)

# DuckDB table functions that can bypass schema isolation or read local files/metadata
FORBIDDEN_TABLE_FUNCTIONS = {
    "read_csv",
    "read_csv_auto",
    "read_parquet",
    "read_json",
    "read_json_auto",
    "read_ndjson",
    "read_text",
    "read_blob",
    "glob",
    "parquet_scan",
    "csv_scan",
    "sqlite_scan",
    "postgres_scan",
    "mysql_scan",
    "duckdb_tables",
    "duckdb_columns",
    "duckdb_schemas",
    "duckdb_databases",
    "duckdb_settings",
    "duckdb_secrets",
    "pragma_table_info",
    "pragma_database_list",
    "pragma_storage_info",
}


@dataclass
class GuardrailResult:
    passed: bool
    safe_sql: str
    checks: list[GuardrailCheck] = field(default_factory=list)
    tables_accessed: list[str] = field(default_factory=list)
    blocked_reason: Optional[str] = None


def _extract_limit_value(limit_expr: exp.Limit) -> Optional[int]:
    expr = limit_expr.expression
    if isinstance(expr, exp.Literal) and expr.is_int:
        try:
            return int(expr.this)
        except ValueError:
            return None
    if isinstance(expr, exp.Neg):
        return -1
    return None


def verify_sql_guardrails(sql: str, max_limit: int = MAX_ROW_LIMIT) -> GuardrailResult:
    """Parse SQL with sqlglot (DuckDB dialect) and enforce all 4 mandatory AST guardrails."""
    cleaned_sql = (sql or "").strip()
    if not cleaned_sql:
        checks = [
            GuardrailCheck(
                name="read_only_ast",
                passed=False,
                detail="Empty SQL query rejected.",
            ),
            GuardrailCheck(
                name="gold_schema_only",
                passed=False,
                detail="No gold.* tables verified.",
            ),
            GuardrailCheck(
                name="no_cross_join",
                passed=True,
                detail="No CROSS JOIN present.",
            ),
            GuardrailCheck(
                name="row_limit_enforced",
                passed=False,
                detail="No LIMIT enforced on empty SQL.",
            ),
        ]
        return GuardrailResult(
            passed=False,
            safe_sql=cleaned_sql,
            checks=checks,
            tables_accessed=[],
            blocked_reason="Empty SQL query rejected.",
        )

    try:
        statements = [
            stmt
            for stmt in sqlglot.parse(cleaned_sql, read="duckdb")
            if stmt is not None
        ]
    except sqlglot.errors.ParseError as exc:
        checks = [
            GuardrailCheck(
                name="read_only_ast",
                passed=False,
                detail=f"SQL parse error rejected by AST guardrail: {exc}",
            ),
            GuardrailCheck(
                name="gold_schema_only",
                passed=False,
                detail="Unable to verify gold.* schema due to parse error.",
            ),
            GuardrailCheck(
                name="no_cross_join",
                passed=False,
                detail="Unable to verify joins due to parse error.",
            ),
            GuardrailCheck(
                name="row_limit_enforced",
                passed=False,
                detail="Unable to enforce LIMIT due to parse error.",
            ),
        ]
        return GuardrailResult(
            passed=False,
            safe_sql=cleaned_sql,
            checks=checks,
            tables_accessed=[],
            blocked_reason="SQL failed DuckDB AST parsing.",
        )

    # ------------------------------------------------------------------
    # Check 1: read_only_ast
    # ------------------------------------------------------------------
    read_only_passed = True
    read_only_detail = "AST verified as read-only SELECT."

    if len(statements) != 1:
        read_only_passed = False
        read_only_detail = (
            f"Multi-statement SQL is prohibited (detected {len(statements)} statements)."
        )
        stmt = statements[0] if statements else exp.Select()
    else:
        stmt = statements[0]
        if not isinstance(stmt, (exp.Select, exp.Union)):
            read_only_passed = False
            read_only_detail = (
                f"Blocked non-SELECT statement type: {type(stmt).__name__}. "
                "Only read-only SELECT queries are permitted."
            )
        else:
            forbidden_found: list[str] = []
            for node in stmt.walk():
                if FORBIDDEN_AST_TYPES and isinstance(node, FORBIDDEN_AST_TYPES):
                    forbidden_found.append(type(node).__name__)
            if forbidden_found:
                unique_names = sorted(set(forbidden_found))
                read_only_passed = False
                read_only_detail = (
                    f"Blocked forbidden SQL operation(s) in AST: {', '.join(unique_names)}."
                )

    # ------------------------------------------------------------------
    # Check 2: gold_schema_only
    # ------------------------------------------------------------------
    cte_names: set[str] = set()
    for cte in stmt.find_all(exp.CTE):
        if cte.alias:
            cte_names.add(cte.alias.lower())

    forbidden_tables: list[str] = []
    gold_tables: set[str] = set()

    for table in stmt.find_all(exp.Table):
        schema_name = (table.db or "").strip().lower()
        table_name = (table.name or "").strip()
        catalog_name = (table.catalog or "").strip().lower()

        if not table_name:
            continue
        if not schema_name and table_name.lower() in cte_names:
            continue

        if catalog_name:
            forbidden_tables.append(f"{catalog_name}.{schema_name}.{table_name}")
        elif schema_name != "gold":
            full_ref = f"{schema_name}.{table_name}" if schema_name else table_name
            forbidden_tables.append(full_ref)
        else:
            gold_tables.add(f"gold.{table_name.lower()}")

    forbidden_funcs: set[str] = set()
    for func in stmt.find_all(exp.Anonymous, exp.Func):
        func_name = (
            func.name.lower()
            if isinstance(func, exp.Anonymous)
            else func.sql_name().lower()
        )
        if func_name in FORBIDDEN_TABLE_FUNCTIONS:
            forbidden_funcs.add(func_name)

    tables_accessed = sorted(gold_tables)
    if forbidden_tables or forbidden_funcs:
        gold_passed = False
        reasons: list[str] = []
        if forbidden_tables:
            reasons.append(
                f"Blocked table access outside gold.* schema: {', '.join(sorted(set(forbidden_tables)))}"
            )
        if forbidden_funcs:
            reasons.append(
                f"Blocked restricted system/file function(s): {', '.join(sorted(forbidden_funcs))}"
            )
        gold_detail = "; ".join(reasons) + "."
    elif not tables_accessed and read_only_passed:
        gold_passed = False
        gold_detail = "Query must reference at least one governed gold.* table."
    else:
        gold_passed = True
        gold_detail = "All tables belong to gold.* schema."

    # ------------------------------------------------------------------
    # Check 3: no_cross_join
    # ------------------------------------------------------------------
    cross_join_detected = False
    for join in stmt.find_all(exp.Join):
        kind = (join.args.get("kind") or "").upper()
        side = (join.args.get("side") or "").upper()
        method = (join.args.get("method") or "").upper()
        has_condition = (
            join.args.get("on") is not None or join.args.get("using") is not None
        )
        if kind == "CROSS" or side == "CROSS" or (not has_condition and kind != "NATURAL" and method != "NATURAL"):
            cross_join_detected = True
            break

    no_cross_join_passed = not cross_join_detected
    no_cross_join_detail = (
        "No CROSS JOIN present."
        if no_cross_join_passed
        else "Blocked CROSS JOIN / cartesian join detected in AST."
    )

    # ------------------------------------------------------------------
    # Check 4: row_limit_enforced
    # ------------------------------------------------------------------
    safe_sql = cleaned_sql
    limit_passed = True
    limit_detail = f"LIMIT {max_limit} enforced (<= {max_limit})."

    if read_only_passed and isinstance(stmt, (exp.Select, exp.Union)):
        existing_limit = stmt.args.get("limit")
        if existing_limit is None:
            stmt = stmt.limit(max_limit)
            limit_detail = f"Injected LIMIT {max_limit} automatically (<= {max_limit})."
        else:
            limit_val = _extract_limit_value(existing_limit)
            if limit_val is None or limit_val <= 0:
                stmt = stmt.limit(max_limit)
                limit_detail = f"Replaced invalid LIMIT with LIMIT {max_limit} (<= {max_limit})."
            elif limit_val > max_limit:
                stmt = stmt.limit(max_limit)
                limit_detail = (
                    f"Clamped LIMIT {limit_val} to {max_limit} (max allowed <= {max_limit})."
                )
            else:
                limit_detail = f"LIMIT {limit_val} enforced (<= {max_limit})."

        safe_sql = stmt.sql(dialect="duckdb", pretty=True)
    else:
        limit_passed = False
        limit_detail = "LIMIT not enforced because statement failed read-only AST check."

    checks = [
        GuardrailCheck(
            name="read_only_ast",
            passed=read_only_passed,
            detail=read_only_detail,
        ),
        GuardrailCheck(
            name="gold_schema_only",
            passed=gold_passed,
            detail=gold_detail,
        ),
        GuardrailCheck(
            name="no_cross_join",
            passed=no_cross_join_passed,
            detail=no_cross_join_detail,
        ),
        GuardrailCheck(
            name="row_limit_enforced",
            passed=limit_passed,
            detail=limit_detail,
        ),
    ]

    all_passed = all(check.passed for check in checks)
    blocked_reason: Optional[str] = None
    if not all_passed:
        failed_details = [c.detail for c in checks if not c.passed]
        blocked_reason = " ".join(failed_details)

    return GuardrailResult(
        passed=all_passed,
        safe_sql=safe_sql,
        checks=checks,
        tables_accessed=tables_accessed,
        blocked_reason=blocked_reason,
    )
