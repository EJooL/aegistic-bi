# Aegistic — REST API & Data Contract

> **Base URL (Local Dev):** `http://localhost:8000`
> **Frontend Dev Origin (CORS Allowed):** `http://localhost:5173`
> **Content-Type:** `application/json`

All endpoints are served by the FastAPI application in `semantic_engine/app/main.py`. Both `semantic_engine/` (Backend), `frontend/` (UI), and `evaluation/` (Benchmark) MUST adhere strictly to these request/response schemas.

---

## 1. Health Check — `GET /api/v1/health`

Returns live service status, DuckDB connectivity, parser mode, and loaded semantic model stats.

### Response `200 OK`
```json
{
  "status": "ok",
  "service": "aegistic-semantic-engine",
  "duckdb_connected": true,
  "dwh_path": "aegistic.duckdb",
  "parser_mode": "deterministic",
  "metrics_loaded": 7,
  "dimensions_loaded": 5,
  "gold_tables": [
    "gold.fact_orders",
    "gold.fact_order_items",
    "gold.dim_products",
    "gold.dim_customers",
    "gold.dim_date"
  ]
}
```

---

## 2. Metric Catalog — `GET /api/v1/metrics`

Returns official metrics, dimensions, mandatory filters, formulas, and caveats loaded directly from `semantic_models/commerce.yaml`.

### Response `200 OK`
```json
{
  "model_name": "nusantara_commerce",
  "display_name": "Nusantara Commerce Semantic Model",
  "version": "1.0.0",
  "currency": "IDR",
  "description": "Governed metrics-as-code semantic layer for Nusantara Commerce omnichannel retail.",
  "metrics": [
    {
      "key": "net_revenue",
      "label": "Net Revenue",
      "description": "Recognized net revenue from completed orders after discounts, excluding shipping fees and refunds.",
      "formula_display": "SUM(gross_amount - discount_amount) WHERE order_status = 'completed'",
      "sql_expression": "SUM(CASE WHEN fo.order_status = 'completed' THEN fo.net_amount ELSE 0 END)",
      "format": "currency_idr",
      "grain": "order",
      "base_table": "gold.fact_orders",
      "mandatory_filters": [
        "order_status = 'completed'"
      ],
      "allowed_dimensions": [
        "order_date",
        "product_category",
        "customer_segment",
        "region",
        "payment_method"
      ],
      "caveats": [
        "Excludes shipping cost, cancelled orders, and refunded orders.",
        "When sliced by product_category, uses item-level net revenue (item_gross_amount - item_discount_amount) on completed orders to prevent join fan-out."
      ],
      "owner": "Finance & BI Governance"
    }
  ],
  "dimensions": [
    {
      "key": "order_date",
      "label": "Order Date",
      "table": "gold.dim_date",
      "column": "date_day",
      "type": "time",
      "supported_grains": ["day", "week", "month", "quarter"],
      "description": "Order transaction date with calendar rollups."
    }
  ]
}
```

---

## 3. Conversational Analytics Query — `POST /api/v1/query`

Executes the 5-Gate Aegistic Pipeline:
1. Intent Parsing & Semantic Matching
2. Deterministic SQL Compilation
3. `sqlglot` AST Guardrails
4. Safe Read-Only DuckDB Execution & Post-Query Sanity Checks
5. Chart Recommendation & Audit Payload Assembly

### Request Body
```json
{
  "question": "Bandingkan Net Revenue per kategori produk 6 bulan terakhir",
  "parser_mode": null
}
```
* `question` (`string`, required): Natural language question in Indonesian or English.
* `parser_mode` (`"deterministic" | "openai" | "gemini" | null`, optional): Overrides `AEGISTIC_PARSER_MODE` for this request when provided.

### Response `200 OK`
```json
{
  "status": "verified",
  "question": "Bandingkan Net Revenue per kategori produk 6 bulan terakhir",
  "summary": "Menampilkan Net Revenue berdasarkan Kategori Produk untuk 6 bulan terakhir (6 baris data).",
  "query_plan": {
    "metrics": ["net_revenue"],
    "dimensions": ["product_category"],
    "time_grain": null,
    "filters": [],
    "date_range": {
      "preset": "last_6_months",
      "start_date": "2026-06-01",
      "end_date": "2026-11-24"
    },
    "sort": [
      { "field": "net_revenue", "direction": "desc" }
    ],
    "limit": 100
  },
  "columns": [
    { "key": "product_category", "label": "Product Category", "format": "string", "is_metric": false },
    { "key": "net_revenue", "label": "Net Revenue", "format": "currency_idr", "is_metric": true }
  ],
  "data": [
    { "product_category": "Electronics", "net_revenue": 4520100000 }
  ],
  "chart_spec": {
    "chart_type": "bar",
    "title": "Net Revenue by Product Category (Last 6 Months)",
    "x_key": "product_category",
    "x_label": "Product Category",
    "y_keys": [
      { "key": "net_revenue", "label": "Net Revenue", "format": "currency_idr", "color": "#4DA8E5" }
    ]
  },
  "audit_trail": {
    "verified": true,
    "parser_used": "deterministic",
    "metrics_used": [
      {
        "key": "net_revenue",
        "label": "Net Revenue",
        "formula_display": "SUM(gross_amount - discount_amount) WHERE order_status = 'completed'",
        "mandatory_filters": ["order_status = 'completed'"],
        "caveats": [
          "Excludes shipping cost, cancelled orders, and refunded orders."
        ]
      }
    ],
    "compiled_sql": "SELECT ...",
    "guardrail_checks": [
      { "name": "read_only_ast", "passed": true, "detail": "AST verified as read-only SELECT." },
      { "name": "gold_schema_only", "passed": true, "detail": "All tables belong to gold.* schema." },
      { "name": "no_cross_join", "passed": true, "detail": "No CROSS JOIN present." },
      { "name": "row_limit_enforced", "passed": true, "detail": "LIMIT 100 enforced (<= 1000)." }
    ],
    "sanity_checks": [
      { "name": "partial_period_check", "passed": false, "severity": "warning", "detail": "Data includes an incomplete current month (2026-11)." },
      { "name": "null_ratio_check", "passed": true, "severity": "info", "detail": "All columns have <= 10% NULL values." },
      { "name": "empty_result_check", "passed": true, "severity": "info", "detail": "Query returned 6 rows." }
    ],
    "latency_ms": 14.3,
    "row_count": 6,
    "tables_accessed": ["gold.fact_order_items", "gold.fact_orders", "gold.dim_products"]
  },
  "warnings": [
    {
      "code": "PARTIAL_PERIOD",
      "severity": "warning",
      "title": "Partial Period Detected",
      "message": "Periode bulan berjalan (2026-11) belum berakhir sepenuhnya. Angka bulan berjalan mungkin lebih rendah dari bulan penuh."
    }
  ],
  "suggestions": []
}
```

### Status Enum Values
* `"verified"`: Passed all 5 gates; `data`, `chart_spec`, and `audit_trail` are populated.
* `"clarification_required"`: Question is ambiguous (e.g., *"Produk mana yang paling bagus?"*). Returns `suggestions` of official metrics/questions.
* `"refused"`: Metric/topic is out of scope or unregistered in `commerce.yaml` (e.g., *"Berapa Employee NPS?"*). Returns `suggestions`.
* `"guardrail_blocked"`: Adversarial/destructive SQL or forbidden schema request detected (e.g., `DROP TABLE`, `bronze.raw_orders`). Returns failed `guardrail_checks` and `warnings` with `severity: "error"`.

---

## 4. Live Dashboard Persistence

### 4.1 List Pinned Cards — `GET /api/v1/dashboards`
```json
{
  "cards": [
    {
      "id": "card-uuid-1",
      "title": "Net Revenue by Product Category",
      "question": "Bandingkan Net Revenue per kategori produk 6 bulan terakhir",
      "created_at": "2026-11-24T16:30:00Z",
      "refreshed_at": "2026-11-24T16:35:00Z",
      "response": { "... QueryResponse ..." }
    }
  ]
}
```

### 4.2 Pin Query to Dashboard — `POST /api/v1/dashboards/pin`
Request:
```json
{
  "title": "Net Revenue by Product Category",
  "question": "Bandingkan Net Revenue per kategori produk 6 bulan terakhir"
}
```
Response `201 Created`: Returns the newly created `DashboardCard` (freshly executed against DuckDB to ensure verified live data).

### 4.3 Refresh Pinned Card — `POST /api/v1/dashboards/{card_id}/refresh`
Re-runs the card's `question` live against the 5-Gate Semantic Engine + DuckDB, updates stored snapshot and `refreshed_at`, and returns the updated `DashboardCard` (`200 OK`).

### 4.4 Delete Pinned Card — `DELETE /api/v1/dashboards/{card_id}`
Response `200 OK`:
```json
{
  "deleted": true,
  "id": "card-uuid-1"
}
```

---

## 5. Evaluation Benchmark — `GET /api/v1/benchmark`

Serves `evaluation/results/benchmark_report.json` produced by `evaluation/run_benchmark.py`.

### Response `200 OK`
```json
{
  "generated_at": "2026-11-24T16:45:00Z",
  "dataset_size": 60,
  "summary": {
    "baseline": {
      "execution_accuracy_pct": 44.4,
      "hallucination_error_rate_pct": 55.6,
      "safe_refusal_rate_pct": 13.3,
      "median_latency_ms": 14.5,
      "overall_pass_rate_pct": 36.7
    },
    "aegistic": {
      "execution_accuracy_pct": 100.0,
      "hallucination_error_rate_pct": 0.0,
      "safe_refusal_rate_pct": 100.0,
      "median_latency_ms": 12.8,
      "overall_pass_rate_pct": 100.0
    }
  },
  "by_category": [
    {
      "category": "standard",
      "label": "Standard Business Queries",
      "total": 25,
      "baseline_passed": 20,
      "aegistic_passed": 25,
      "baseline_accuracy_pct": 80.0,
      "aegistic_accuracy_pct": 100.0
    },
    {
      "category": "definition_trap",
      "label": "Definition Traps",
      "total": 20,
      "baseline_passed": 0,
      "aegistic_passed": 20,
      "baseline_accuracy_pct": 0.0,
      "aegistic_accuracy_pct": 100.0
    },
    {
      "category": "out_of_scope",
      "label": "Out-of-Scope & Adversarial",
      "total": 15,
      "baseline_passed": 2,
      "aegistic_passed": 15,
      "baseline_accuracy_pct": 13.3,
      "aegistic_accuracy_pct": 100.0
    }
  ],
  "cases": [
    {
      "id": "STD-01",
      "category": "standard",
      "question": "Tampilkan tren Net Revenue bulanan selama 12 bulan terakhir",
      "expected_behavior": "verified",
      "baseline": {
        "status": "executed",
        "passed": false,
        "error_type": "definition_error",
        "latency_ms": 12.1,
        "sql": "SELECT ...",
        "note": "Included cancelled/refunded orders and shipping cost."
      },
      "aegistic": {
        "status": "verified",
        "passed": true,
        "error_type": null,
        "latency_ms": 10.4,
        "sql": "SELECT ...",
        "note": "Matched ground truth within 0.01% tolerance."
      }
    }
  ]
}
```
