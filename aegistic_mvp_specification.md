# Aegistic — MVP Product & Technical Specification

> **Versi:** 1.1 (MVP — Lightweight Local Stack Locked)  
> **Kategori:** Verified Self-Service BI powered by a Semantic Layer & SQL Guardrails  
> **Platform Target:** Web App (*Desktop-first*)  
> **Dokumen Referensi:** `aegistic_project_blueprint_handoff.md`

---

## 1. Tujuan & Ruang Lingkup MVP

MVP **Aegistic** bertujuan membuktikan secara *end-to-end* bahwa analitik percakapan (*conversational BI*) dapat dijalankan secara akurat, aman, dan dapat diaudit menggunakan **Semantic Layer (*metrics-as-code*)** dan **AST SQL Guardrails**—sekaligus tampil kuat sebagai *Data Product* kelas industri dengan jejak *resource* lokal yang sangat ringan.

### 1.1 Konfigurasi Stack Ringan (Terkunci untuk MVP)
Agar proyek hemat *storage*, hemat RAM, dan *zero-friction* saat dijalankan di mesin lokal:
* **Isolasi Python (`.venv`):** Seluruh dependensi Python wajib dipasang di virtual environment lokal (`.venv`) dengan daftar paket minimal (`fastapi`, `uvicorn`, `pydantic`, `pyyaml`, `sqlglot`, `duckdb`, `pytest`, `httpx`). **Tanpa** `dbt`, **tanpa** Docker, dan **tanpa** library ML berat (PyTorch/TensorFlow).
* **Data Warehouse (DuckDB In-Process):** Menggunakan **DuckDB** (OLAP *columnar* dalam satu file lokal `aegistic.duckdb`). Tidak memerlukan *background database server* (MySQL/PostgreSQL). Transformasi Medallion dijalankan melalui skrip SQL murni + Python runner.
* **Frontend (Vite + React + TypeScript):** Menggunakan **Vite + React** (bukan Next.js) + Tailwind CSS + Recharts + Lucide Icons agar *dev server* ringan, *build* cepat, dan `node_modules` lebih ramping.

### 1.2 Termasuk dalam Ruang Lingkup (In-Scope MVP)
1. **Data Warehouse Lokal Multi-Tabel (Medallion Architecture):** Pipeline transformasi `Bronze → Silver → Gold` (*Star Schema*) berbasis **DuckDB** dengan *data quality tests*.
2. **Semantic Layer (YAML) & Deterministic SQL Compiler:** Definisi metrik, relasi tabel, dimensi, filter wajib, dan *caveat* bisnis berbasis kode YAML yang dikompilasi menjadi SQL terstruktur.
3. **SQL Guardrails (`sqlglot` AST) & Eksekusi Aman:** Validasi AST untuk memblokir operasi DDL/DML, mengunci akses hanya ke skema `gold.*`, mencegah `CROSS JOIN`, menyisipkan `LIMIT`, menjalankan koneksi *read-only*, serta melakukan *post-query sanity checks*.
4. **Desktop-First Web UI (4 Modul Utama):**
   * **Ask Aegistic (Conversational Analytics):** Input pertanyaan natural, grafik interaktif otomatis, tabel hasil, laci **Verification & Audit Trail**, dan tombol **Pin to Dashboard**.
   * **Live Dashboard:** Kumpulan grafik yang telah di-*pin* dari percakapan (tersimpan persisten di SQLite/JSON lokal dan dapat di-*refresh* langsung ke DWH).
   * **Metric Catalog:** Kamus metrik resmi yang dirender langsung dari file YAML *Semantic Layer*.
   * **Evaluation Benchmark:** Tampilan transparan hasil uji akurasi **Baseline (Raw Text-to-SQL)** vs **Aegistic (Semantic Layer + Guardrails)**.
5. **Evaluation Harness (`pytest` + Golden Dataset):** Pengujian otomatis terhadap 60 pertanyaan uji (*Standard*, *Definition Traps*, *Out-of-Scope/Ambiguous*).

### 1.3 Di Luar Ruang Lingkup MVP (Out-of-Scope)
* Autentikasi multi-tenant / RBAC enterprise (cukup *single workspace* untuk MVP).
* Konektor *live* ke cloud DWH eksternal atau server PostgreSQL/MySQL (arsitektur tetap modular berbasis dialek `sqlglot` agar mudah dimigrasi di v2).
* Pengeditan YAML langsung melalui GUI (*read-only catalog* di UI, edit lewat kode).

---

## 2. Studi Kasus Bisnis & Arsitektur Data

Untuk memamerkan jebakan definisi bisnis (*definition traps*) secara realistis, MVP menggunakan studi kasus **E-Commerce & Retail Omnichannel (Nusantara Commerce)** dengan data transaksi 18 bulan yang dibangkitkan secara deterministik (*reproducible seed script*, ~50.000 baris transaksi) sehingga proyek dapat langsung dijalankan tanpa ketergantungan *credentials* eksternal.

### 2.1 Lapisan Medallion (DuckDB — `aegistic.duckdb`)
* **Bronze (`bronze.*`):** `raw_orders`, `raw_order_items`, `raw_products`, `raw_customers`, `raw_payments` (mengandung duplikasi disengaja, status `cancelled`/`refunded`, nilai `NULL` pada tanggal tertentu, dan *partial current month* untuk menguji *sanity check*).
* **Silver (`silver.*`):** Data bersih, terdeduplikasi, tipe data terstandardisasi, normalisasi mata uang (IDR) dan zona waktu.
* **Gold (`gold.*` — Star Schema):**
  * `gold.fact_orders`: Granularitas per pesanan (`order_id`, `customer_id`, `order_date`, `order_status`, `gross_amount`, `discount_amount`, `shipping_cost`, `net_amount`, `order_rank`).
  * `gold.fact_order_items`: Granularitas per item pesanan (`order_item_id`, `order_id`, `product_id`, `quantity`, `unit_price`, `unit_cost`, `item_gross_amount`, `item_discount_amount`).
  * `gold.dim_products`: (`product_id`, `product_name`, `category_name`, `subcategory_name`, `brand`).
  * `gold.dim_customers`: (`customer_id`, `customer_segment`, `region`, `city`, `first_order_date`).
  * `gold.dim_date`: (`date_day`, `week_start`, `month_start`, `quarter_label`, `year_num`, `is_partial_period`).

### 2.2 Kontrak Data Quality Tests
Setiap *build* DWH wajib lolos pengecekan otomatis:
* `unique` & `not_null` pada seluruh *primary key* tabel `gold.*`.
* Integritas relasi (*foreign key check*) antara `fact_orders`/`fact_order_items` dan seluruh tabel dimensi.
* Validasi aturan bisnis: `net_amount >= 0` untuk pesanan `completed`, tidak ada duplikasi `order_id` di `gold.fact_orders`.

### 2.3 Kontrak Semantic Layer (`semantic_models/commerce.yaml`)
Metrik minimum yang wajib terdaftar dan terkunci definisinya:

| Metric Key | Label Resmi | Aturan Bisnis / Jebakan yang Dicegah | Format |
|---|---|---|---|
| `net_revenue` | Net Revenue | `SUM(gross_amount - discount_amount)` wajib filter `order_status = 'completed'`; tidak termasuk ongkir & *refund*. | `currency_idr` |
| `gross_revenue` | Gross Merchandise Value (GMV) | `SUM(gross_amount)` seluruh pesanan non-cancelled. | `currency_idr` |
| `total_orders` | Completed Orders | `COUNT(DISTINCT order_id)` dengan `order_status = 'completed'`. | `integer` |
| `aov` | Average Order Value (AOV) | `net_revenue / NULLIF(total_orders, 0)`. | `currency_idr` |
| `gross_margin_pct` | Gross Margin (%) | `(SUM(item_net_revenue - (quantity * unit_cost))) / NULLIF(SUM(item_net_revenue), 0)` pada pesanan `completed`. | `percentage` |
| `repeat_purchase_rate` | Repeat Purchase Rate | `COUNT(DISTINCT CASE WHEN order_rank > 1 THEN customer_id END) * 1.0 / NULLIF(COUNT(DISTINCT customer_id), 0)`. | `percentage` |
| `refund_rate` | Refund & Cancellation Rate | Persentase pesanan berstatus `refunded` atau `cancelled` terhadap total seluruh pesanan. | `percentage` |

**Dimensi Resmi:** `order_date` (`day`, `week`, `month`, `quarter`), `product_category`, `customer_segment`, `region`, `payment_method`.

---

## 3. Alur 5 Gerbang Sistem (Backend & Guardrail Engine)

Setiap permintaan ke endpoint `POST /api/v1/query` wajib melewati 5 gerbang berurutan:

1. **Gerbang 1 — Intent Parsing & Semantic Matching:**
   * LLM (dengan dukungan *structured JSON output* + *deterministic fallback parser* untuk pengujian lokal/offline) menerjemahkan pertanyaan menjadi `QueryPlan` (Pydantic model: `metrics`, `dimensions`, `time_grain`, `filters`, `date_range`, `sort`, `limit`).
   * Jika metrik tidak ditemukan di YAML atau pertanyaan ambigu (mis. *"Produk mana yang paling bagus?"*), sistem mengembalikan status `clarification_required` atau `refused` beserta saran metrik resmi (*graceful refusal*).
2. **Gerbang 2 — Deterministic SQL Compilation:**
   * *Compiler* Python menyusun SQL murni dari `QueryPlan` + definisi YAML (otomatis menyelesaikan *join path* yang aman, menyisipkan filter wajib metrik, dan mencegah *fan-out join* antar tabel fakta).
3. **Gerbang 3 — SQL Guardrails (`sqlglot` AST Verification):**
   * Mem-parsing SQL hasil kompilasi ke AST (`sqlglot`).
   * **Aturan Blokir Mutlak:** Tolak jika ada ekspresi selain `SELECT` (`DROP`, `DELETE`, `UPDATE`, `INSERT`, `ALTER`, `COPY`, `ATTACH`), tolak referensi tabel di luar skema `gold.*`, tolak `CROSS JOIN`, dan paksa `LIMIT <= 1000` jika belum ada.
   * Mencatat daftar *checks passed* (mis. `read_only_ast`, `gold_schema_only`, `no_cross_join`, `row_limit_enforced`) untuk dikirim ke panel Audit Trail.
4. **Gerbang 4 — Safe Execution & Post-Query Sanity Checks:**
   * Menjalankan kueri di DuckDB dengan mode `read_only=True` dan *timeout*.
   * Menjalankan *sanity checks* pada hasil:
     * Deteksi *partial period* (periode bulan/kuartal berjalan belum selesai).
     * Deteksi *missing dates* pada deret waktu (*time-series gap*).
     * Deteksi proporsi `NULL` > 10% pada dimensi/metrik.
     * Deteksi *empty result set*.
5. **Gerbang 5 — Chart Recommendation & Audit Payload:**
   * Menentukan tipe visualisasi otomatis (`line` untuk tren waktu, `bar` untuk perbandingan kategori, `kpi` untuk angka tunggal, `table` untuk multi-dimensi padat).
   * Mengembalikan payload lengkap berisi: `data`, `chart_spec`, `audit_trail` (rumus bisnis, SQL terformat, *guardrail checks*, *latency_ms*, `row_count`), dan `warnings` (*caveat* resmi + *sanity check warnings*).

---

## 4. Sistem Desain & Palet Warna UI (Palet 1 — Adjusted)

Antarmuka **Aegistic** mengadopsi **Palet 1** dengan penyesuaian kontras ketat agar ramah untuk aplikasi *data-heavy* (*desktop-first*) dan memenuhi standar keterbacaan WCAG AA.

### 4.1 Token Warna Resmi (Tailwind / CSS Variables)

| Peran UI | Nama Warna | Kode HEX | Aturan Penggunaan |
|---|---|---|---|
| **Primary Brand & CTA** | Deep Indigo / Slate Blue | `#3B498B` (Hover: `#2D3870`, Tint: `#EEF0FA`) | Logo, tombol utama (*Ask*, *Pin to Dashboard*), *active navigation state*, fokus input. |
| **Data Viz Primary & Verified Badge** | Sky Blue | `#4DA8E5` (Tint: `#EBF6FD`, Text: `#1B6CA8`) | Seri utama *bar/line chart*, *badge* status **"Verified by Semantic Layer"**, indikator lolos *guardrails*. |
| **Data Viz Multi-Series Scale** | Indigo–Sky Ramp | `['#3B498B', '#4DA8E5', '#7685C4', '#2A7EB5', '#9BCBF0']` | Membedakan beberapa seri data/kategori secara harmonis dan sejuk di mata. |
| **Guardrails, Caveat & Warnings** | Crimson / Coral-Red | `#E11D48` (Bg Tint: `#FFF1F2`, Border: `#FECDD3`, Text: `#9F1239`) | **Gunakan secara hemat** khusus untuk blokir *SQL Guardrails*, *graceful refusal*, *partial period warning*, dan *caveat* penting metrik. |
| **Canvas & Card Surface** | Pure White & Cool Tint | Canvas: `#F8FAFC`, Card: `#FFFFFF` | Latar utama bersih agar angka, grafik, dan sintaks SQL menjadi fokus utama. |
| **Surface, Border & Audit Trail** | Cool Slate Gray | Border: `#CBD5E1` / `#E2E8F0`, Code/Audit Bg: `#F1F5F9`, Muted Label: `#526075` | Garis pemisah, latar blok kode SQL di laci *Audit Trail*, *header* tabel, label sekunder. **DILARANG** memakai *Cool Slate Gray* muda (`#CBD5E1` ke atas) untuk judul utama atau teks angka karena kontras terlalu rendah. |
| **Primary Text & KPI Numbers** | Dark Charcoal | Heading/KPI: `#111827`, Body: `#1F2937` | Seluruh judul, teks utama, nilai KPI, dan sel tabel angka agar tajam dan tidak melelahkan mata. |

### 4.2 Tipografi & Tata Letak (*Desktop-First*)
* **Font UI:** `Inter` atau `Plus Jakarta Sans` (bersih dan modern).
* **Font Kode SQL & Angka:** `JetBrains Mono` untuk blok SQL/YAML; aktifkan `font-variant-numeric: tabular-nums` pada seluruh KPI dan tabel data agar digit angka sejajar rapi secara vertikal.
* **Layout Utama:** Sidebar navigasi kiri ramping (240px), area kerja analitik di tengah, dan **Verification & Audit Trail Drawer** yang dapat dibuka/tutup di sisi kanan (380px–420px) tanpa menutupi grafik utama.

---

## 5. Evaluation Benchmark (Baseline vs. Aegistic)

Folder `/evaluation` berisi **60 pertanyaan Golden Dataset** (`golden_dataset.json`) yang dibagi menjadi 3 kategori:
1. **Standard Business Queries (25 soal):** Tren *Net Revenue* bulanan, perbandingan kategori Q3 vs Q2, AOV per wilayah, dll.
2. **Definition Traps (20 soal):** Pertanyaan yang menjebak LLM biasa (mis. meminta *Net Revenue* padahal di tabel mentah ada *refund/cancelled* dan ongkir; atau meminta *Repeat Purchase Rate* yang rawan salah `JOIN` / *double counting*).
3. **Out-of-Scope & Ambiguous (15 soal):** Pertanyaan ambigu (*"Produk terbaik?"*), metrik tak terdaftar (*"Berapa Employee NPS?"*), atau upaya *SQL injection / destructive prompt* (*"Hapus transaksi bulan lalu"*).

**Metrik Evaluasi yang Ditampilkan di UI:**
* **Execution Accuracy (%):** Persentase hasil kueri yang cocok secara numerik dengan *ground truth SQL*.
* **Hallucination / Definition Error Rate (%):** Persentase jawaban yang berjalan tanpa error sintaks namun angkanya salah secara definisi bisnis.
* **Safe Refusal Rate (%):** Ketepatan menolak/mengklarifikasi soal *out-of-scope* dan *prompt* berbahaya.
* **Median Query Latency (ms).**

---

## 6. Struktur Folder Repositori (Isolasi Engine vs UI)

```text
aegistic/
├── .venv/                        # Virtual environment Python lokal (gitignored)
├── .gitignore
├── requirements.txt              # Dependensi Python minimal & ringan
├── .env.example
├── mvp.md
├── README.md
├── docs/
│   └── api_contract.md
├── data_warehouse/               # Lapisan 1: Data Modeling & DQ (Pure Python + DuckDB SQL)
│   ├── seed_raw_data.py          # Generator data deterministik (~50k baris)
│   ├── build_dwh.py              # Runner Bronze -> Silver -> Gold (aegistic.duckdb)
│   ├── sql/
│   │   ├── bronze/
│   │   ├── silver/
│   │   └── gold/
│   └── tests/
│       └── test_data_quality.py  # Tes unique, not_null, integritas relasi
├── semantic_models/              # Kontrak Metrics-as-Code
│   └── commerce.yaml
├── semantic_engine/              # Lapisan 2: Compiler, Guardrails & FastAPI
│   ├── app/
│   │   ├── main.py
│   │   ├── schemas.py            # Pydantic models (QueryPlan, AuditTrail, Response)
│   │   ├── semantic_loader.py    # Parser & validator YAML
│   │   ├── intent_parser.py      # LLM adapter + deterministic fallback
│   │   ├── sql_compiler.py       # QueryPlan + YAML -> SQL
│   │   ├── sql_guardrails.py     # sqlglot AST verification
│   │   ├── executor.py           # Read-only DuckDB + sanity checks
│   │   ├── chart_recommender.py
│   │   └── dashboard_store.py    # Persistensi Pin to Dashboard (SQLite/JSON)
│   └── tests/
│       ├── test_compiler.py
│       └── test_guardrails.py
├── evaluation/                   # Lapisan 4: Evaluation Harness
│   ├── golden_dataset.json       # 60 pertanyaan uji + ground truth SQL
│   ├── run_benchmark.py          # Runner Baseline vs Aegistic
│   └── results/
│       └── benchmark_report.json # Dibaca langsung oleh tab Benchmark di UI
└── frontend/                     # Lapisan 3: Vite + React (TS) Desktop-First UI
    ├── index.html
    ├── vite.config.ts
    ├── tailwind.config.ts
    ├── package.json
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── styles/tokens.css     # Implementasi token warna Palet 1 Adjusted
        ├── components/
        │   ├── Sidebar.tsx
        │   ├── QueryWorkspace.tsx
        │   ├── ChartRenderer.tsx
        │   ├── AuditTrailDrawer.tsx
        │   ├── MetricCatalogView.tsx
        │   ├── PinnedDashboardView.tsx
        │   └── BenchmarkView.tsx
        └── lib/api.ts
```

---

## 7. Kriteria Penerimaan MVP (Definition of Done)

- [ ] Seluruh dependensi Python terpasang bersih di dalam `.venv` lokal dari `requirements.txt` (tanpa Docker, tanpa `dbt`, tanpa server DB eksternal).
- [ ] Menjalankan `build_dwh.py` lewat `.venv` membentuk `aegistic.duckdb` secara bersih dan seluruh tes `pytest data_warehouse/tests` berstatus **PASS**.
- [ ] Seluruh unit test *compiler* dan *sqlglot guardrails* (`pytest semantic_engine/tests`) berstatus **PASS**, termasuk uji pemblokiran `DROP/DELETE/UPDATE`, akses tabel `bronze.*`/`silver.*`, dan `CROSS JOIN`.
- [ ] Menjalankan `evaluation/run_benchmark.py` menghasilkan `benchmark_report.json` nyata yang membandingkan *Baseline* vs *Aegistic* pada 60 kasus uji.
- [ ] Frontend **Vite + React** lolos `npm run build` tanpa error TypeScript dan menampilkan 4 modul penuh (*Ask Aegistic*, *Live Dashboard*, *Metric Catalog*, *Evaluation Benchmark*) dengan data nyata dari API FastAPI.
- [ ] Penerapan warna UI mematuhi **Palet 1 Adjusted**: *Deep Indigo* untuk CTA, *Sky Blue* untuk visualisasi & *Verified Badge*, *Crimson* khusus untuk *Guardrails/Caveat*, *Cool Slate Gray* hanya untuk *border/surface/code bg*, dan *Dark Charcoal* untuk seluruh teks utama serta angka KPI.