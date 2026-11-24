# Antigravity Swarm Prompt — Build Aegistic MVP (Lightweight Stack)

Salin seluruh blok prompt di bawah ini ke **Antigravity IDE (Orchestrator / Swarm Mode)** di direktori kerja yang sudah berisi file `mvp.md`.

```
ROLE: Engineering Orchestrator & Multi-Agent Swarm
PROJECT: Aegistic — Verified Self-Service BI powered by a Semantic Layer & SQL Guardrails
SOURCE OF TRUTH: Read `mvp.md` completely before writing any code. Every architectural decision, lightweight stack constraint, schema, semantic metric, API contract, and UI color token MUST strictly follow `mvp.md`.

========================================================================
1. NON-NEGOTIABLE GLOBAL RULES (ALL AGENTS)
========================================================================
1. LIGHTWEIGHT LOCAL FOOTPRINT & `.venv` ISOLATION (STRICT):
   - Create and use a local Python virtual environment (`.venv`) in the repository root. NEVER install Python packages globally.
   - Keep `requirements.txt` strictly minimal: `fastapi`, `uvicorn`, `pydantic`, `pyyaml`, `sqlglot`, `duckdb`, `pytest`, `httpx`, `python-dotenv`. DO NOT add `dbt`, Docker, PostgreSQL/MySQL drivers, PyTorch, or heavy ML frameworks.
   - Data Warehouse MUST be **DuckDB** (in-process OLAP, single local file `aegistic.duckdb`) built with pure Python + SQL Medallion scripts.
   - Frontend MUST be **Vite + React + TypeScript** + Tailwind CSS + Recharts + Lucide icons. DO NOT use Next.js.
2. STRICT ENGINE/UI ISOLATION:
   Keep `data_warehouse/`, `semantic_models/`, `semantic_engine/`, `evaluation/`, and `frontend/` cleanly separated. Never put SQL generation or business metric formulas inside frontend code.
3. ZERO FAKE/MOCKED UI DATA:
   The frontend MUST fetch live query results, Metric Catalog definitions, Pinned Dashboards, and Evaluation Benchmark numbers from the FastAPI backend (`semantic_engine`) backed by real DuckDB execution.
4. LLM ADAPTER + DETERMINISTIC FALLBACK:
   In `semantic_engine/app/intent_parser.py`, support optional LLM providers via environment variables (`OPENAI_API_KEY` or `GEMINI_API_KEY` via lightweight HTTP/httpx calls—no heavy SDK bloat), AND implement a high-accuracy deterministic semantic intent parser fallback when `AEGISTIC_PARSER_MODE=deterministic` (or when no API key is set). This guarantees full E2E demoability, reproducible benchmarks, and CI test execution without external key blockers.
5. MANDATORY UI DESIGN SYSTEM (PALETTE 1 — ACCESSIBILITY ADJUSTED):
   Strictly enforce these exact roles and hex tokens in `frontend/src/styles/tokens.css` and `tailwind.config.ts`:
   - Primary Brand & CTA (Ask, Pin to Dashboard, Active Nav): Deep Indigo `#3B498B` (hover `#2D3870`, tint `#EEF0FA`).
   - Primary Data Visualization & "Verified" Badge: Sky Blue `#4DA8E5` (tint `#EBF6FD`, text `#1B6CA8`), multi-series chart ramp: `['#3B498B', '#4DA8E5', '#7685C4', '#2A7EB5', '#9BCBF0']`.
   - Guardrails, Blocked SQL, Graceful Refusal & Caveat Badges: Crimson `#E11D48` (bg `#FFF1F2`, border `#FECDD3`, text `#9F1239`) — use SPARINGLY only for warnings/errors/caveats.
   - Surface, Borders & Audit Trail Drawer: Canvas `#F8FAFC`, Cards `#FFFFFF`, Borders `#CBD5E1`/`#E2E8F0`, SQL Code Block Bg `#F1F5F9`, Secondary Labels `#526075`.
   - Primary Text & KPI Numbers: Dark Charcoal `#111827` (headings/KPIs) and `#1F2937` (body).
   - FORBIDDEN: Do NOT use light Cool Slate Gray for headings, KPI values, or primary copy. Enforce `font-variant-numeric: tabular-nums` on all numeric tables and KPIs.
6. MANUAL GIT WORKFLOW ONLY (STRICT — NO AUTOMATED GIT MUTATIONS):
   - NEVER execute `git add`, `git commit`, `git push`, `git reset`, `git checkout`, or `git rebase` automatically under any circumstance.
   - Staging (`git add .`), committing (`git commit`), and pushing (`git push`) are strictly performed MANUALLY by the human user.
   - Read-only checks (`git status`, `git diff`) are permitted only if needed for inspection. At the end of each completed Wave/Gate, provide a brief summary of modified/created files and a suggested commit message so the user can manually run `git add .`, `git commit`, and `git push`.

========================================================================
2. SWARM TOPOLOGY & AGENT RESPONSIBILITIES
========================================================================
Spawn and coordinate 4 specialist agents under the Orchestrator:

[ORCHESTRATOR — Tech Lead & Contract Owner]
- Bootstrap repository layout exactly as defined in Section 6 of `mvp.md` (including `.gitignore` ignoring `.venv/`, `node_modules/`, `*.duckdb`, and `.env`).
- Create `.venv` (`python -m venv .venv`), write minimal `requirements.txt`, and install Python dependencies strictly inside `.venv`.
- Create `docs/api_contract.md` and `.env.example` BEFORE Wave 2 starts so Backend and Frontend build against identical JSON schemas.
- Coordinate dependency waves, resolve integration issues, and run the final E2E verification suite using the `.venv` interpreter.

[AGENT 1 — Data Warehouse & Semantic Engineer]
Scope: `data_warehouse/`, `semantic_models/commerce.yaml`
Deliverables:
- `data_warehouse/seed_raw_data.py`: Deterministic generator (~50,000 orders over 18 months for Nusantara Commerce in IDR) with intentional real-world data quirks: duplicate raw order rows, `completed`/`cancelled`/`refunded` statuses, shipping fees, partial current month, and minor missing dates to exercise sanity checks.
- `data_warehouse/sql/{bronze,silver,gold}/*.sql` & `build_dwh.py`: Pure Python + DuckDB SQL runner that builds `aegistic.duckdb` implementing the Star Schema (`gold.fact_orders`, `gold.fact_order_items`, `gold.dim_products`, `gold.dim_customers`, `gold.dim_date`).
- `data_warehouse/tests/test_data_quality.py`: Pytest suite verifying PK uniqueness, non-null constraints, FK integrity, and business invariants.
- `semantic_models/commerce.yaml`: Complete, rich metrics-as-code definition for all 7 metrics (`net_revenue`, `gross_revenue`, `total_orders`, `aov`, `gross_margin_pct`, `repeat_purchase_rate`, `refund_rate`), joins, dimensions, formats, and explicit business caveats.

[AGENT 2 — Backend Semantic & SQL Guardrail Engineer]
Scope: `semantic_engine/`
Deliverables:
- FastAPI service (`uvicorn semantic_engine.app.main:app`) with CORS configured for the Vite frontend (`http://localhost:5173`).
- `semantic_loader.py`: Loads & validates `semantic_models/commerce.yaml` with Pydantic.
- `intent_parser.py`: Converts natural language (Indonesian & English) into structured `QueryPlan`, detects ambiguous/unregistered metrics, and returns structured `clarification_required` or `refused` payloads with official metric suggestions.
- `sql_compiler.py`: Deterministically compiles `QueryPlan` + YAML into safe DuckDB SQL (proper join resolution, mandatory metric filters, fan-out protection, date truncation).
- `sql_guardrails.py`: Uses `sqlglot` AST parsing to block all non-SELECT statements, block tables outside `gold.*`, block `CROSS JOIN`, enforce `LIMIT <= 1000`, and emit an itemized `guardrail_checks` audit list.
- `executor.py`: Runs SQL via DuckDB `read_only=True` with timeout + runs post-query sanity checks (partial period warning, missing time-series dates, NULL ratio > 10%, empty result).
- `chart_recommender.py` & `dashboard_store.py`: Recommends chart spec and persists pinned dashboard cards in local SQLite/JSON with live re-execution endpoint.
- REST Endpoints:
  * `POST /api/v1/query`
  * `GET /api/v1/metrics`
  * `GET /api/v1/dashboards`, `POST /api/v1/dashboards/pin`, `DELETE /api/v1/dashboards/{id}`, `POST /api/v1/dashboards/{id}/refresh`
  * `GET /api/v1/benchmark` (serves `evaluation/results/benchmark_report.json`)
  * `GET /api/v1/health`
- `semantic_engine/tests/`: Comprehensive `pytest` unit tests for compiler correctness, AST guardrail rejections (DDL/DML, non-gold access, cross join), and sanity checks.

[AGENT 3 — Frontend BI & Design System Engineer]
Scope: `frontend/`
Deliverables:
- Desktop-first **Vite + React + TypeScript** app + Tailwind CSS + Recharts + Lucide icons (configure Vite proxy or `.env` API base URL pointing to `http://localhost:8000`).
- Strict implementation of Palette 1 (Adjusted) in `src/styles/tokens.css` & `tailwind.config.ts`.
- 4 complete views accessible from a clean 240px left sidebar:
  1. **Ask Aegistic (Workspace):** Prompt bar with curated sample queries (including a definition-trap example & an out-of-scope example), verified status badge (Sky Blue), interactive chart + formatted tabular data view, "Pin to Dashboard" button (Deep Indigo CTA), inline Crimson caveat/sanity warning banners, and a collapsible right-hand **Verification & Audit Trail Drawer** (380px–420px, `#F1F5F9` SQL code block in `JetBrains Mono`, business formula, guardrail checklist, latency & row count).
  2. **Live Dashboard:** Grid of pinned cards with live refresh button, chart rendering, and delete action.
  3. **Metric Catalog:** Searchable table/cards of all official metrics, formulas, mandatory filters, and caveats from `GET /api/v1/metrics`.
  4. **Evaluation Benchmark:** Executive comparison view of **Baseline (Raw Text-to-SQL)** vs **Aegistic (Semantic Layer + Guardrails)** showing Execution Accuracy, Hallucination/Definition Error Rate, Safe Refusal Rate, Median Latency, and a filterable breakdown table by question category.

[AGENT 4 — Evaluation & QA Engineer]
Scope: `evaluation/`, root `README.md`
Deliverables:
- `evaluation/golden_dataset.json`: 60 realistic evaluation cases across 3 categories (25 Standard, 20 Definition Traps, 15 Out-of-Scope/Ambiguous/Adversarial) with exact `ground_truth_sql` or expected `refusal/clarification` status.
- `evaluation/run_benchmark.py`: Executes all 60 cases against both a realistic Baseline (raw-table Text-to-SQL without semantic filters/guardrails) and the actual Aegistic engine, compares numeric outputs against `ground_truth_sql` on `aegistic.duckdb`, and saves `evaluation/results/benchmark_report.json`.
- Root `README.md`: Clear `.venv` setup instructions (Windows PowerShell & Unix), architecture diagram (Mermaid), commands to rebuild DuckDB DWH, run tests, run benchmark, and launch FastAPI + Vite dev servers.

========================================================================
3. EXECUTION WAVES (DEPENDENCY ORDER)
========================================================================
- WAVE 1 (Foundation): Orchestrator creates repo skeleton, `.venv`, `requirements.txt`, and `docs/api_contract.md` while Agent 1 builds `data_warehouse/` and `semantic_models/commerce.yaml`.
  -> Gate 1: Run `data_warehouse/build_dwh.py` and `pytest data_warehouse/tests` using `.venv`. Must be 100% GREEN.
- WAVE 2 (Parallel Build): Agent 2 builds `semantic_engine/` and Agent 3 scaffolds & builds Vite+React `frontend/` against `docs/api_contract.md`.
  -> Gate 2: Run `pytest semantic_engine/tests` (via `.venv`) and `cd frontend && npm run build`. Must be 100% GREEN.
- WAVE 3 (Evaluation & Integration): Agent 4 builds `evaluation/` and runs `evaluation/run_benchmark.py` (via `.venv`) against the live DuckDB + Aegistic engine to generate `benchmark_report.json`. Agent 3 verifies all 4 UI views render live API responses cleanly with zero console/type errors.
- WAVE 4 (Final E2E Smoke Test by Orchestrator):
  1. Start FastAPI backend via `.venv` and verify `/api/v1/health`, `/api/v1/metrics`, `/api/v1/benchmark`.
  2. Test 3 queries via `/api/v1/query`:
     (a) Standard: "Bandingkan Net Revenue per kategori produk 6 bulan terakhir" -> returns verified chart + SQL audit trail.
     (b) Guardrail/Trap: "Berapa Net Revenue dan Refund Rate per region?" -> enforces `order_status='completed'` for net_revenue and includes caveat.
     (c) Out-of-Scope/Adversarial: "Produk mana yang paling bagus?" and "DROP TABLE gold.fact_orders" -> gracefully refuses / blocks.
  3. Verify `Pin to Dashboard` persists and refreshes cleanly.
  4. Verify visual adherence to Palette 1 Adjusted (no low-contrast slate gray headings/KPIs).
  5. Do NOT run any git add/commit/push commands; present a final summary of changed files and a suggested commit message for the user to commit and push manually.

Start immediately with WAVE 1. Report concise status updates at each Gate (including a reminder for manual git commit if desired) before proceeding to the next wave.
```