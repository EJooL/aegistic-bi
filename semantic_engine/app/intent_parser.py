"""Gate 1 — Intent Parsing & Semantic Matching (LLM adapters + deterministic parser)."""

from __future__ import annotations

import calendar
import json
import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Literal, Optional

import httpx

from semantic_engine.app.config import Settings
from semantic_engine.app.schemas import (
    DateRangeSpec,
    FilterSpec,
    QueryPlan,
    SortSpec,
    SuggestionItem,
)
from semantic_engine.app.semantic_loader import SemanticModel

IntentOutcome = Literal["parsed", "clarification_required", "refused", "guardrail_blocked"]


@dataclass
class ParseResult:
    outcome: IntentOutcome
    parser_used: str
    query_plan: Optional[QueryPlan] = None
    reason: str = ""
    attempted_sql: Optional[str] = None
    suggestions: list[SuggestionItem] = field(default_factory=list)


# ----------------------------------------------------------------------------
# Adversarial / Destructive / Forbidden-Schema Detection Patterns
# ----------------------------------------------------------------------------
_SQL_START_RE = re.compile(
    r"^\s*(SELECT|WITH|DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|TRUNCATE|COPY|ATTACH|DETACH|PRAGMA)\b",
    re.IGNORECASE,
)

_DESTRUCTIVE_SQL_PATTERNS = [
    re.compile(r"\bDROP\s+(TABLE|SCHEMA|DATABASE|VIEW)\b", re.IGNORECASE),
    re.compile(r"\bDELETE\s+FROM\b", re.IGNORECASE),
    re.compile(r"\bTRUNCATE\s+(TABLE\s+)?\w+", re.IGNORECASE),
    re.compile(r"\bUPDATE\s+[\w.]+\s+SET\b", re.IGNORECASE),
    re.compile(r"\bINSERT\s+INTO\b", re.IGNORECASE),
    re.compile(r"\bALTER\s+TABLE\b", re.IGNORECASE),
    re.compile(r"\bCREATE\s+(OR\s+REPLACE\s+)?(TABLE|VIEW|SCHEMA)\b", re.IGNORECASE),
    re.compile(r"\bCOPY\s+[\w.()]+\s+TO\b", re.IGNORECASE),
    re.compile(r"\bATTACH\s+", re.IGNORECASE),
    re.compile(r"\bDETACH\s+", re.IGNORECASE),
    re.compile(r"\bPRAGMA\b", re.IGNORECASE),
    re.compile(r";\s*(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE)\b", re.IGNORECASE),
    re.compile(r"\bUNION\s+(ALL\s+)?SELECT\b", re.IGNORECASE),
    re.compile(r"\bOR\s+1\s*=\s*1\b", re.IGNORECASE),
]

_NL_DESTRUCTIVE_PATTERNS = [
    re.compile(
        r"\b(hapus|delete|drop|truncate|buang|bersihkan|hilangkan)\b.{0,40}\b(tabel|table|data|transaksi|order|pesanan|baris|record|database|db|semua)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(ubah|update|modifikasi|modify|edit|ganti)\b.{0,35}\b(tabel|table|order_status|status pesanan|data mentah|record|database)\b",
        re.IGNORECASE,
    ),
    re.compile(
        r"\b(sisipkan|masukkan|insert|tambahkan baris)\b.{0,35}\b(tabel|table|database|fact_orders|orders)\b",
        re.IGNORECASE,
    ),
]

_FORBIDDEN_SCHEMA_PATTERNS = [
    re.compile(r"\bbronze\.\w+", re.IGNORECASE),
    re.compile(r"\bsilver\.\w+", re.IGNORECASE),
    re.compile(
        r"\b(raw_orders|raw_order_items|raw_products|raw_customers|raw_payments)\b",
        re.IGNORECASE,
    ),
    re.compile(r"\b(information_schema|pg_catalog|sqlite_master|duckdb_tables)\b", re.IGNORECASE),
    re.compile(r"\b(bronze|silver)\s+(layer|schema|table|tabel)\b", re.IGNORECASE),
    re.compile(r"\b(tabel|table)\s+(bronze|silver)\b", re.IGNORECASE),
]

_CROSS_JOIN_RE = re.compile(r"\bCROSS\s+JOIN\b", re.IGNORECASE)


def _detect_adversarial(question: str) -> Optional[tuple[str, str]]:
    """Return (reason, attempted_sql) if the prompt is destructive or forbidden."""
    q = question.strip()
    looks_like_sql = bool(_SQL_START_RE.match(q))

    for pat in _DESTRUCTIVE_SQL_PATTERNS:
        if pat.search(q):
            attempted = q if looks_like_sql else f"DELETE FROM gold.fact_orders -- {q}"
            return (
                "Permintaan diblokir oleh SQL Guardrails karena mengandung perintah DDL/DML atau SQL injection yang tidak diperbolehkan (hanya SELECT read-only pada skema gold.*).",
                attempted,
            )

    if _CROSS_JOIN_RE.search(q):
        attempted = (
            q
            if looks_like_sql
            else "SELECT * FROM gold.fact_orders CROSS JOIN gold.dim_products LIMIT 100"
        )
        return (
            "Permintaan diblokir oleh SQL Guardrails karena mengandung CROSS JOIN yang berpotensi menyebabkan ledakan baris (cartesian fan-out).",
            attempted,
        )

    for pat in _FORBIDDEN_SCHEMA_PATTERNS:
        m = pat.search(q)
        if m:
            matched_token = m.group(0)
            if looks_like_sql:
                attempted = q
            elif "." in matched_token:
                attempted = f"SELECT * FROM {matched_token} LIMIT 50"
            elif matched_token.lower().startswith("raw_"):
                attempted = f"SELECT * FROM bronze.{matched_token.lower()} LIMIT 50"
            elif "silver" in matched_token.lower():
                attempted = "SELECT * FROM silver.orders LIMIT 50"
            else:
                attempted = "SELECT * FROM bronze.raw_orders LIMIT 50"
            return (
                f"Akses ke tabel/skema non-gold ({matched_token}) diblokir oleh SQL Guardrails. Aegistic hanya mengizinkan kueri pada skema gold.* yang telah terverifikasi.",
                attempted,
            )

    for pat in _NL_DESTRUCTIVE_PATTERNS:
        if pat.search(q):
            q_lower = q.lower()
            if any(w in q_lower for w in ("ubah", "update", "modifikasi", "modify", "edit", "ganti")):
                attempted = "UPDATE gold.fact_orders SET order_status = 'cancelled'"
            elif any(w in q_lower for w in ("insert", "sisipkan", "masukkan", "tambahkan baris")):
                attempted = "INSERT INTO gold.fact_orders (order_id) VALUES ('TEST-1')"
            elif "drop" in q_lower or "tabel" in q_lower or "table" in q_lower:
                attempted = "DROP TABLE gold.fact_orders"
            else:
                attempted = "DELETE FROM gold.fact_orders WHERE order_status = 'refunded'"
            return (
                "Permintaan modifikasi/penghapusan data diblokir oleh SQL Guardrails. Aegistic beroperasi dalam mode read-only SELECT.",
                attempted,
            )

    return None


# ----------------------------------------------------------------------------
# Out-of-Scope & Ambiguity Detection
# ----------------------------------------------------------------------------
_OUT_OF_SCOPE_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (re.compile(r"\b(employee\s*nps|enps|net\s+promoter\s+score|\bnps\b)\b", re.IGNORECASE), "Employee NPS / Net Promoter Score"),
    (re.compile(r"\b(customer\s+acquisition\s+cost|\bcac\b|biaya\s+akuisisi)\b", re.IGNORECASE), "Customer Acquisition Cost (CAC)"),
    (re.compile(r"\b(customer\s+lifetime\s+value|lifetime\s+value|\bltv\b|\bclv\b)\b", re.IGNORECASE), "Customer Lifetime Value (LTV)"),
    (re.compile(r"\b(\broas\b|return\s+on\s+ad\s+spend|\bcpc\b|\bcpm\b|\bctr\b|ad\s+spend|biaya\s+iklan|marketing\s+spend)\b", re.IGNORECASE), "Marketing / Ad Spend Metrics (ROAS/CPC/CTR)"),
    (re.compile(r"\b(churn\s*rate|tingkat\s+churn|\bchurn\b)\b", re.IGNORECASE), "Churn Rate"),
    (re.compile(r"\b(inventory|sisa\s+stok|stok\s+gudang|\bstok\b|stock\s+level|warehouse\s+stock|out\s+of\s+stock|kehabisan\s+stok)\b", re.IGNORECASE), "Inventory / Warehouse Stock"),
    (re.compile(r"\b(gaji|salary|payroll|headcount|karyawan|employee\s+turnover|pegawai)\b", re.IGNORECASE), "HR / Employee Data"),
    (re.compile(r"\b(stock\s+price|harga\s+saham|\bsaham\b|crypto|bitcoin|kurs\s+dollar)\b", re.IGNORECASE), "Market / Stock Price"),
    (re.compile(r"\b(cuaca|weather|hujan|suhu|temperatur|resep|recipe|berita|news|presiden|lelucon|joke|puisi)\b", re.IGNORECASE), "Non-Analytics / General Topic"),
    (re.compile(r"\b(ebitda|net\s+profit|laba\s+bersih|operating\s+expense|\bopex\b|\bcapex\b|cash\s+flow|arus\s+kas|balance\s+sheet|neraca|pajak|tax)\b", re.IGNORECASE), "Corporate Accounting / Operating Expense Metrics"),
    (re.compile(r"\b(conversion\s+rate|tingkat\s+konversi|bounce\s+rate|page\s*views?|website\s+traffic|\bdau\b|\bmau\b|session\s+duration)\b", re.IGNORECASE), "Web Traffic / Funnel Analytics"),
    (re.compile(r"\b(delivery\s+time|waktu\s+pengiriman|lama\s+pengiriman|sla\s+pengiriman|lead\s+time|supplier)\b", re.IGNORECASE), "Logistics / Delivery SLA"),
    (re.compile(r"\b(market\s+share|pangsa\s+pasar|kompetitor|competitor)\b", re.IGNORECASE), "External Market Share / Competitor Data"),
]

_AMBIGUOUS_PATTERNS = [
    re.compile(r"\b(paling\s+bagus|terbaik|best|top\s+performing|mana\s+yang\s+bagus|paling\s+sukses|most\s+successful)\b", re.IGNORECASE),
    re.compile(r"\b(bagaimana\s+performa|how\s+is\s+(our\s+)?performance|how\s+are\s+we\s+doing|performa\s+bisnis|business\s+performance|kinerja\s+(bisnis|kita|toko))\b", re.IGNORECASE),
    re.compile(r"\b(harus\s+(kita\s+)?fokus|should\s+we\s+focus|rekomendasi|mana\s+yang\s+perlu\s+diperbaiki|what\s+should\s+we\s+do)\b", re.IGNORECASE),
    re.compile(r"\b(terburuk|paling\s+jelek|worst|underperforming)\b", re.IGNORECASE),
    re.compile(r"\b(ringkasan|summary|overview|cek\s+bisnis|apa\s+kabar\s+bisnis)\b", re.IGNORECASE),
]


def _default_suggestions(context_dim: Optional[str] = None) -> list[SuggestionItem]:
    if context_dim == "product_category":
        return [
            SuggestionItem(
                label="Net Revenue per Kategori Produk",
                question="Bandingkan Net Revenue per kategori produk 6 bulan terakhir",
                metric_key="net_revenue",
                reason="Mengukur pendapatan bersih terbesar setelah diskon (pesanan completed).",
            ),
            SuggestionItem(
                label="Gross Margin (%) per Kategori Produk",
                question="Kategori produk mana yang memiliki Gross Margin tertinggi?",
                metric_key="gross_margin_pct",
                reason="Mengukur profitabilitas bersih tiap kategori produk.",
            ),
            SuggestionItem(
                label="Completed Orders per Kategori Produk",
                question="Tampilkan jumlah pesanan selesai per kategori produk",
                metric_key="total_orders",
                reason="Mengukur volume pesanan selesai tertinggi per kategori.",
            ),
        ]
    if context_dim == "region":
        return [
            SuggestionItem(
                label="Net Revenue per Wilayah",
                question="Bandingkan Net Revenue per region 6 bulan terakhir",
                metric_key="net_revenue",
                reason="Mengukur kontribusi pendapatan bersih per wilayah.",
            ),
            SuggestionItem(
                label="AOV per Wilayah",
                question="Berapa Average Order Value (AOV) per wilayah?",
                metric_key="aov",
                reason="Mengukur rata-rata nilai pesanan selesai per wilayah.",
            ),
            SuggestionItem(
                label="Net Revenue & Refund Rate per Wilayah",
                question="Berapa Net Revenue dan Refund Rate per region?",
                metric_key="refund_rate",
                reason="Membandingkan pendapatan bersih dan tingkat pembatalan/refund per wilayah.",
            ),
        ]
    if context_dim == "customer_segment":
        return [
            SuggestionItem(
                label="Net Revenue per Segmen Pelanggan",
                question="Tampilkan Net Revenue per segmen pelanggan",
                metric_key="net_revenue",
                reason="Mengukur kontribusi pendapatan bersih tiap segmen pelanggan.",
            ),
            SuggestionItem(
                label="Repeat Purchase Rate per Segmen",
                question="Berapa Repeat Purchase Rate per segmen pelanggan?",
                metric_key="repeat_purchase_rate",
                reason="Mengukur loyalitas pembelian berulang tiap segmen.",
            ),
            SuggestionItem(
                label="AOV per Segmen Pelanggan",
                question="Bandingkan AOV per segmen pelanggan",
                metric_key="aov",
                reason="Mengukur rata-rata nilai pesanan tiap segmen.",
            ),
        ]
    return [
        SuggestionItem(
            label="Tren Net Revenue Bulanan (12 Bulan)",
            question="Tampilkan tren Net Revenue bulanan selama 12 bulan terakhir",
            metric_key="net_revenue",
            reason="Metrik pendapatan bersih resmi (order_status = 'completed').",
        ),
        SuggestionItem(
            label="Net Revenue per Kategori Produk",
            question="Bandingkan Net Revenue per kategori produk 6 bulan terakhir",
            metric_key="net_revenue",
            reason="Perbandingan pendapatan bersih bebas fan-out per kategori.",
        ),
        SuggestionItem(
            label="Gross Margin (%) per Kategori",
            question="Berapa Gross Margin (%) per kategori produk?",
            metric_key="gross_margin_pct",
            reason="Profitabilitas margin kotor resmi di level item.",
        ),
        SuggestionItem(
            label="Repeat Purchase Rate per Segmen",
            question="Berapa Repeat Purchase Rate per segmen pelanggan?",
            metric_key="repeat_purchase_rate",
            reason="Rasio pelanggan aktif dengan pembelian berulang.",
        ),
    ]


# ----------------------------------------------------------------------------
# Deterministic Metric Extraction (ordered specificity, span-stripping)
# ----------------------------------------------------------------------------
# Each entry: (metric_key, regex_pattern) — most specific multi-word phrases FIRST
_METRIC_RULES: list[tuple[str, re.Pattern[str]]] = [
    # 1. Gross Margin (%)
    ("gross_margin_pct", re.compile(r"\b(gross\s+profit\s+margin|gross\s+margin\s*(%|pct|percentage)?|margin\s+kotor|marjin\s+kotor|persentase\s+margin|profit\s+margin)\b", re.IGNORECASE)),
    # 2. Repeat Purchase Rate
    ("repeat_purchase_rate", re.compile(r"\b(repeat\s+purchase\s+rate|repeat\s+purchase|repeat\s+buyer\s+rate|repeat\s+buyers?|repeat\s+customer\s+rate|repeat\s+customers?|repeat\s+rate|tingkat\s+pembelian\s+(ber)?ulang|rasio\s+pembelian\s+(ber)?ulang|pembelian\s+(ber)?ulang|pelanggan\s+berulang|customer\s+retention|retensi\s+pelanggan|tingkat\s+retensi)\b", re.IGNORECASE)),
    # 3. Refund & Cancellation Rate (requires rate/tingkat/rasio/persentase to avoid false match on exclusion clauses)
    ("refund_rate", re.compile(r"\b(refund\s*(?:&|and|dan|\/)\s*cancellation\s+rate|refund\s+rate|cancellation\s+rate|cancel\s+rate|return\s+rate|tingkat\s+refund(?:\s+dan\s+pembatalan)?|rasio\s+refund(?:\s+dan\s+pembatalan)?|tingkat\s+pembatalan|rasio\s+pembatalan|persentase\s+refund|persentase\s+(?:pembatalan|batal)|tingkat\s+pengembalian)\b", re.IGNORECASE)),
    # 4. Average Order Value (AOV) — match BEFORE total_orders so "nilai pesanan" doesn't trigger total_orders
    ("aov", re.compile(r"\b(average\s+order\s+value|\baov\b|average\s+basket(?:\s+size)?|basket\s+size|rata[\s-]+rata\s+(?:nilai\s+)?(?:pesanan|order|transaksi)|nilai\s+rata[\s-]+rata\s+(?:pesanan|order|transaksi)|nilai\s+(?:pesanan|order)\s+rata[\s-]+rata)\b", re.IGNORECASE)),
    # 5. Gross Revenue / GMV — match BEFORE generic revenue/pendapatan
    ("gross_revenue", re.compile(r"\b(gross\s+merchandise\s+value|\bgmv\b|gross\s+revenue|gross\s+sales|pendapatan\s+kotor|om[zs]et\s+kotor|penjualan\s+kotor|total\s+gmv)\b", re.IGNORECASE)),
    # 6. Net Revenue (explicit)
    ("net_revenue", re.compile(r"\b(net\s+revenue|net\s+sales|pendapatan\s+bersih|om[zs]et\s+bersih|penjualan\s+bersih|total\s+net\s+revenue|recognized\s+revenue)\b", re.IGNORECASE)),
    # 7. Total / Completed Orders
    ("total_orders", re.compile(r"\b(completed\s+orders?|total\s+orders?|order\s+count|number\s+of\s+orders?|orders?\s+volume|order\s+volume|jumlah\s+(?:pesanan|order|transaksi)(?:\s+selesai)?|total\s+(?:pesanan|order|transaksi)(?:\s+selesai)?|pesanan\s+selesai|transaksi\s+selesai|banyaknya\s+(?:pesanan|order|transaksi)|berapa\s+(?:banyak\s+)?(?:pesanan|order|transaksi))\b", re.IGNORECASE)),
    # 8. Generic fallbacks (only matched on remaining unconsumed text)
    ("gross_margin_pct", re.compile(r"\b(margin|marjin)\b", re.IGNORECASE)),
    ("net_revenue", re.compile(r"\b(total\s+revenue|revenue|pendapatan|om[zs]et)\b", re.IGNORECASE)),
]


def _extract_metrics(question: str) -> list[str]:
    """Extract official metric keys in order of appearance, avoiding substring double-matches."""
    working = question
    matches: list[tuple[int, str]] = []

    for metric_key, pattern in _METRIC_RULES:
        for match in pattern.finditer(working):
            start, end = match.span()
            matches.append((start, metric_key))
            # Mask matched span with spaces so generic rules cannot double-match it
            working = working[:start] + (" " * (end - start)) + working[end:]

    matches.sort(key=lambda item: item[0])
    ordered_unique: list[str] = []
    for _, key in matches:
        if key not in ordered_unique:
            ordered_unique.append(key)
    return ordered_unique


# ----------------------------------------------------------------------------
# Dimension Values (Filters) & Dimension Group-By Extraction
# ----------------------------------------------------------------------------
_VALUE_ALIASES: dict[str, list[tuple[str, re.Pattern[str]]]] = {
    "product_category": [
        ("Electronics", re.compile(r"\b(electronics|elektronik)\b", re.IGNORECASE)),
        ("Fashion", re.compile(r"\b(fashion|fesyen|pakaian)\b", re.IGNORECASE)),
        ("Home & Living", re.compile(r"\b(home\s*(?:&|and|dan)\s*living|rumah\s+tangga)\b", re.IGNORECASE)),
        ("Beauty & Personal Care", re.compile(r"\b(beauty\s*(?:&|and|dan)\s*personal\s*care|beauty|kecantikan)\b", re.IGNORECASE)),
        ("Groceries", re.compile(r"\b(groceries|grocery|sembako|bahan\s+pokok)\b", re.IGNORECASE)),
        ("Sports & Outdoors", re.compile(r"\b(sports?\s*(?:&|and|dan)\s*outdoors?|olahraga)\b", re.IGNORECASE)),
    ],
    "customer_segment": [
        ("Enterprise", re.compile(r"\benterprise\b", re.IGNORECASE)),
        ("Gold", re.compile(r"\b(?<!schema\s)(?<!layer\s)gold\b(?!\.)", re.IGNORECASE)),
        ("Silver", re.compile(r"\b(?<!schema\s)(?<!layer\s)silver\b(?!\.)", re.IGNORECASE)),
        ("Regular", re.compile(r"\b(regular|reguler)\b", re.IGNORECASE)),
    ],
    "region": [
        ("Jabodetabek", re.compile(r"\bjabodetabek\b", re.IGNORECASE)),
        ("Jawa Barat", re.compile(r"\b(jawa\s+barat|west\s+java|jabar)\b", re.IGNORECASE)),
        ("Jawa Tengah & DIY", re.compile(r"\b(jawa\s+tengah(?:\s*(?:&|and|dan)\s*diy)?|central\s+java|jateng|yogyakarta|\bdiy\b)\b", re.IGNORECASE)),
        ("Jawa Timur", re.compile(r"\b(jawa\s+timur|east\s+java|jatim)\b", re.IGNORECASE)),
        ("Sumatera", re.compile(r"\b(sumatera|sumatra)\b", re.IGNORECASE)),
        ("Kalimantan & Sulawesi", re.compile(r"\b(kalimantan(?:\s*(?:&|and|dan)\s*sulawesi)?|sulawesi)\b", re.IGNORECASE)),
    ],
    "payment_method": [
        ("QRIS", re.compile(r"\bqris\b", re.IGNORECASE)),
        ("Virtual Account", re.compile(r"\b(virtual\s+account|\bva\b)\b", re.IGNORECASE)),
        ("Credit Card", re.compile(r"\b(credit\s+card|kartu\s+kredit)\b", re.IGNORECASE)),
        ("E-Wallet", re.compile(r"\b(e[\s-]?wallet|dompet\s+digital)\b", re.IGNORECASE)),
        ("COD", re.compile(r"\b(cod|cash\s+on\s+delivery|bayar\s+di\s+tempat)\b", re.IGNORECASE)),
    ],
}

_GROUP_BY_PATTERNS: dict[str, re.Pattern[str]] = {
    "product_category": re.compile(
        r"\b(per\s+kategori(?:\s+produk)?|by\s+(?:product\s+)?categor(?:y|ies)|berdasarkan\s+kategori(?:\s+produk)?|(?:tiap|setiap|antar|semua)\s+kategori(?:\s+produk)?|across\s+(?:product\s+)?categor(?:y|ies)|each\s+(?:product\s+)?category|kategori(?:\s+produk)?\s+mana|which\s+(?:product\s+)?category|product\s+categor(?:y|ies)|category\s+breakdown|kategori\s+produk|lini\s+produk)\b",
        re.IGNORECASE,
    ),
    "customer_segment": re.compile(
        r"\b(per\s+segmen(?:\s+pelanggan)?|by\s+(?:customer\s+)?segment(?:s)?|berdasarkan\s+segmen(?:\s+pelanggan)?|(?:tiap|setiap|antar|semua)\s+segmen(?:\s+pelanggan)?|across\s+(?:customer\s+)?segments?|each\s+(?:customer\s+)?segment|segmen(?:\s+pelanggan)?\s+mana|which\s+(?:customer\s+)?segment|customer\s+segments?|segmen\s+pelanggan|tier\s+pelanggan)\b",
        re.IGNORECASE,
    ),
    "region": re.compile(
        r"\b(per\s+(?:region|wilayah|daerah|area|provinsi)|by\s+region(?:s)?|berdasarkan\s+(?:region|wilayah|daerah|area)|(?:tiap|setiap|antar|semua)\s+(?:region|wilayah|daerah)|across\s+regions?|each\s+region|(?:region|wilayah|daerah)\s+mana|which\s+region|regional\s+breakdown|perbandingan\s+wilayah)\b",
        re.IGNORECASE,
    ),
    "payment_method": re.compile(
        r"\b(per\s+(?:metode\s+pembayaran|pembayaran|payment(?:\s+method)?|channel\s+pembayaran)|by\s+payment(?:\s+method)?s?|berdasarkan\s+(?:metode\s+pembayaran|pembayaran)|(?:tiap|setiap|antar|semua)\s+(?:metode\s+pembayaran|payment\s+method)|across\s+payment\s+methods?|each\s+payment\s+method|(?:metode\s+pembayaran|pembayaran)\s+mana|which\s+payment\s+method|payment\s+methods?|metode\s+pembayaran|cara\s+bayar|channel\s+pembayaran)\b",
        re.IGNORECASE,
    ),
}


def _extract_filters_and_categorical_dims(
    question: str,
) -> tuple[list[FilterSpec], list[str]]:
    filters: list[FilterSpec] = []
    dimensions: list[str] = []

    for dim_key, aliases in _VALUE_ALIASES.items():
        matched_values: list[str] = []
        for canonical_val, pattern in aliases:
            if pattern.search(question):
                if canonical_val not in matched_values:
                    matched_values.append(canonical_val)

        if len(matched_values) == 1:
            filters.append(
                FilterSpec(dimension=dim_key, operator="=", value=matched_values[0])
            )
            # Only group by this dim if user explicitly asks "per <dim>" AND did NOT
            # just write "kategori Electronics" / "segmen Enterprise" / "metode pembayaran QRIS" / "wilayah Jabodetabek"
        elif len(matched_values) > 1:
            filters.append(
                FilterSpec(dimension=dim_key, operator="in", value=matched_values)
            )
            # Comparing multiple values of the same dimension -> include it in GROUP BY
            dimensions.append(dim_key)
        else:
            # No specific value filter -> check if user wants breakdown by this dimension
            if _GROUP_BY_PATTERNS[dim_key].search(question):
                dimensions.append(dim_key)

    return filters, dimensions


# ----------------------------------------------------------------------------
# Date Range & Time Grain Extraction
# ----------------------------------------------------------------------------
_MONTH_MAP = {
    "januari": 1, "january": 1, "jan": 1,
    "februari": 2, "february": 2, "feb": 2,
    "maret": 3, "march": 3, "mar": 3,
    "april": 4, "apr": 4,
    "mei": 5, "may": 5,
    "juni": 6, "june": 6, "jun": 6,
    "juli": 7, "july": 7, "jul": 7,
    "agustus": 8, "august": 8, "aug": 8, "agu": 8,
    "september": 9, "sep": 9, "sept": 9,
    "oktober": 10, "october": 10, "oct": 10, "okt": 10,
    "november": 11, "nov": 11,
    "desember": 12, "december": 12, "dec": 12, "des": 12,
}


def _subtract_months_start(ref: date, months_count: int) -> date:
    """Return the 1st day of the calendar month `months_count - 1` months before ref.

    Example: ref = 2026-11-24, months_count = 6 -> 2026-06-01 (Jun..Nov = 6 months).
    """
    offset = max(0, months_count - 1)
    total_months = ref.year * 12 + (ref.month - 1) - offset
    year, month_zero = divmod(total_months, 12)
    return date(year, month_zero + 1, 1)


def _quarter_bounds(year: int, q: int, ref: date) -> tuple[date, date]:
    start_month = (q - 1) * 3 + 1
    end_month = start_month + 2
    start_d = date(year, start_month, 1)
    end_day = calendar.monthrange(year, end_month)[1]
    end_d = min(date(year, end_month, end_day), ref)
    return start_d, end_d


def _extract_time_and_date_range(
    question: str, ref_date: date
) -> tuple[bool, Optional[Literal["day", "week", "month", "quarter"]], Optional[DateRangeSpec]]:
    q = question
    q_lower = q.lower()

    date_range: Optional[DateRangeSpec] = None
    include_time_dim = False
    time_grain: Optional[Literal["day", "week", "month", "quarter"]] = None

    # 1. Explicit time grain words
    if re.search(r"\b(harian|per\s+hari|tiap\s+hari|setiap\s+hari|daily|by\s+day|per\s+day|day\s+by\s+day)\b", q_lower):
        include_time_dim = True
        time_grain = "day"
    elif re.search(r"\b(mingguan|per\s+minggu|tiap\s+minggu|setiap\s+minggu|weekly|by\s+week|per\s+week)\b", q_lower):
        include_time_dim = True
        time_grain = "week"
    elif re.search(r"\b(bulanan|per\s+bulan|tiap\s+bulan|setiap\s+bulan|monthly|by\s+month|per\s+month|month\s+over\s+month|\bmom\b|bulan\s+ke\s+bulan)\b", q_lower):
        include_time_dim = True
        time_grain = "month"
    elif re.search(r"\b(kuartalan|per\s+kuartal|tiap\s+kuartal|setiap\s+kuartal|quarterly|by\s+quarter|per\s+quarter|\bqoq\b)\b", q_lower):
        include_time_dim = True
        time_grain = "quarter"

    # Generic trend keyword without explicit grain
    if not include_time_dim and re.search(
        r"\b(tren|trend|over\s+time|dari\s+waktu\s+ke\s+waktu|perkembangan|pertumbuhan\s+bulanan|time\s*series)\b",
        q_lower,
    ):
        include_time_dim = True

    # 2. Specific Quarters (e.g. "Q3 vs Q2", "Q3 2026 vs Q2 2026", "Q4 2025", "Q3")
    quarter_tokens = re.findall(r"\b(?:(202\d)[\s-]*)?Q([1-4])(?:\s*(202\d))?\b", q, re.IGNORECASE)
    if quarter_tokens:
        # Check if a global year is mentioned once at the end (e.g. "Q3 vs Q2 2026")
        years_mentioned = [int(y) for y in re.findall(r"\b(202[56])\b", q)]
        fallback_year = years_mentioned[-1] if years_mentioned else ref_date.year
        quarters: list[str] = []
        for pre_y, q_num_str, post_y in quarter_tokens:
            yr = int(pre_y or post_y or fallback_year)
            q_label = f"{yr}-Q{q_num_str}"
            if q_label not in quarters:
                quarters.append(q_label)

        quarters.sort()
        if len(quarters) >= 2:
            include_time_dim = True
            time_grain = "quarter"
            date_range = DateRangeSpec(preset="custom_quarters", quarters=quarters)
        elif len(quarters) == 1:
            yr_s, q_s = quarters[0].split("-Q")
            start_d, end_d = _quarter_bounds(int(yr_s), int(q_s), ref_date)
            date_range = DateRangeSpec(
                preset=quarters[0],
                start_date=start_d.isoformat(),
                end_date=end_d.isoformat(),
                quarters=quarters,
            )

    # 3. Relative N months / N days
    if date_range is None:
        m_months = re.search(
            r"\b(?:last|past|selama|dalam)?\s*(\d{1,2})\s*(?:bulan\s+terakhir|months?)\b",
            q_lower,
        )
        m_days = re.search(
            r"\b(?:last|past|selama|dalam)?\s*(\d{1,3})\s*(?:hari\s+terakhir|days?)\b",
            q_lower,
        )
        if m_months:
            n_months = int(m_months.group(1))
            start_d = _subtract_months_start(ref_date, n_months)
            preset = f"last_{n_months}_months"
            date_range = DateRangeSpec(
                preset=preset,
                start_date=start_d.isoformat(),
                end_date=ref_date.isoformat(),
            )
        elif m_days:
            n_days = int(m_days.group(1))
            start_d = ref_date - timedelta(days=max(0, n_days - 1))
            preset = f"last_{n_days}_days"
            date_range = DateRangeSpec(
                preset=preset,
                start_date=start_d.isoformat(),
                end_date=ref_date.isoformat(),
            )
            if include_time_dim and time_grain is None and n_days <= 45:
                time_grain = "day"

    # 4. Named relative periods (this/last month, this/last quarter, YTD)
    if date_range is None:
        if re.search(r"\b(bulan\s+ini|this\s+month|current\s+month)\b", q_lower):
            start_d = date(ref_date.year, ref_date.month, 1)
            date_range = DateRangeSpec(
                preset="current_month",
                start_date=start_d.isoformat(),
                end_date=ref_date.isoformat(),
            )
        elif re.search(r"\b(bulan\s+lalu|bulan\s+kemarin|last\s+month|previous\s+month)\b", q_lower):
            first_this = date(ref_date.year, ref_date.month, 1)
            last_prev = first_this - timedelta(days=1)
            first_prev = date(last_prev.year, last_prev.month, 1)
            date_range = DateRangeSpec(
                preset="last_month",
                start_date=first_prev.isoformat(),
                end_date=last_prev.isoformat(),
            )
        elif re.search(r"\b(kuartal\s+ini|this\s+quarter|current\s+quarter)\b", q_lower):
            curr_q = (ref_date.month - 1) // 3 + 1
            start_d, end_d = _quarter_bounds(ref_date.year, curr_q, ref_date)
            date_range = DateRangeSpec(
                preset="current_quarter",
                start_date=start_d.isoformat(),
                end_date=end_d.isoformat(),
                quarters=[f"{ref_date.year}-Q{curr_q}"],
            )
        elif re.search(r"\b(kuartal\s+lalu|last\s+quarter|previous\s+quarter)\b", q_lower):
            curr_q = (ref_date.month - 1) // 3 + 1
            prev_q = curr_q - 1 if curr_q > 1 else 4
            prev_yr = ref_date.year if curr_q > 1 else ref_date.year - 1
            start_d, end_d = _quarter_bounds(prev_yr, prev_q, ref_date)
            date_range = DateRangeSpec(
                preset="last_quarter",
                start_date=start_d.isoformat(),
                end_date=end_d.isoformat(),
                quarters=[f"{prev_yr}-Q{prev_q}"],
            )
        elif re.search(r"\b(ytd|year\s+to\s+date|tahun\s+ini|this\s+year)\b", q_lower):
            date_range = DateRangeSpec(
                preset="ytd",
                start_date=f"{ref_date.year}-01-01",
                end_date=ref_date.isoformat(),
            )

    # 5. Specific Month + Year (e.g., "Oktober 2026", "November 2026", "Desember 2025")
    if date_range is None:
        month_names_pattern = "|".join(sorted(_MONTH_MAP.keys(), key=len, reverse=True))
        m_spec_month = re.search(
            rf"\b({month_names_pattern})\s+(202[56])\b", q_lower
        )
        if m_spec_month:
            m_num = _MONTH_MAP[m_spec_month.group(1)]
            yr = int(m_spec_month.group(2))
            start_d = date(yr, m_num, 1)
            end_d = min(date(yr, m_num, calendar.monthrange(yr, m_num)[1]), ref_date)
            date_range = DateRangeSpec(
                preset=f"{yr}-{m_num:02d}",
                start_date=start_d.isoformat(),
                end_date=end_d.isoformat(),
            )

    # 6. Explicit ISO date range (YYYY-MM-DD to YYYY-MM-DD)
    if date_range is None:
        iso_dates = re.findall(r"\b(202\d-\d{2}-\d{2})\b", q)
        if len(iso_dates) >= 2:
            date_range = DateRangeSpec(
                preset="custom_range",
                start_date=min(iso_dates[0], iso_dates[1]),
                end_date=max(iso_dates[0], iso_dates[1]),
            )

    # 7. Specific Year (2025 or 2026)
    if date_range is None:
        years = re.findall(r"\b(202[56])\b", q)
        unique_years = sorted(set(years))
        if len(unique_years) == 1:
            yr = int(unique_years[0])
            if yr == ref_date.year:
                date_range = DateRangeSpec(
                    preset="ytd",
                    start_date=f"{yr}-01-01",
                    end_date=ref_date.isoformat(),
                )
            else:
                date_range = DateRangeSpec(
                    preset=f"year_{yr}",
                    start_date=f"{yr}-01-01",
                    end_date=f"{yr}-12-31",
                )

    # Default time grain when time dimension is requested without explicit grain
    if include_time_dim and time_grain is None:
        time_grain = "month"

    return include_time_dim, time_grain, date_range


# ----------------------------------------------------------------------------
# Sorting & Top-N Extraction
# ----------------------------------------------------------------------------
def _extract_sort_and_limit(
    question: str,
    metrics: list[str],
    dimensions: list[str],
) -> tuple[list[SortSpec], int]:
    q_lower = question.lower()
    limit = 100
    sort_specs: list[SortSpec] = []

    top_match = re.search(r"\btop\s+(\d{1,3})\b|\b(\d{1,3})\s+(?:tertinggi|teratas|terbesar)\b", q_lower)
    bottom_match = re.search(r"\bbottom\s+(\d{1,3})\b|\b(\d{1,3})\s+(?:terendah|terkecil|terbawah)\b", q_lower)

    if top_match and metrics:
        n_str = top_match.group(1) or top_match.group(2)
        limit = max(1, min(int(n_str), 1000))
        sort_specs.append(SortSpec(field=metrics[0], direction="desc"))
    elif bottom_match and metrics:
        n_str = bottom_match.group(1) or bottom_match.group(2)
        limit = max(1, min(int(n_str), 1000))
        sort_specs.append(SortSpec(field=metrics[0], direction="asc"))
    elif re.search(r"\b(terendah|terkecil|paling\s+rendah|paling\s+kecil|lowest|smallest)\b", q_lower) and metrics:
        sort_specs.append(SortSpec(field=metrics[0], direction="asc"))
    elif re.search(r"\b(tertinggi|terbesar|paling\s+tinggi|paling\s+besar|highest|largest|most)\b", q_lower) and metrics:
        sort_specs.append(SortSpec(field=metrics[0], direction="desc"))
    elif "order_date" in dimensions:
        sort_specs.append(SortSpec(field="order_date", direction="asc"))
    elif dimensions and metrics:
        sort_specs.append(SortSpec(field=metrics[0], direction="desc"))

    return sort_specs, limit


# ----------------------------------------------------------------------------
# Deterministic Parser
# ----------------------------------------------------------------------------
def parse_deterministic(question: str, model: SemanticModel) -> ParseResult:
    """High-accuracy offline deterministic semantic intent parser (ID & EN)."""
    # 1. Adversarial / destructive / forbidden schema check
    adv = _detect_adversarial(question)
    if adv is not None:
        reason, attempted_sql = adv
        return ParseResult(
            outcome="guardrail_blocked",
            parser_used="deterministic",
            reason=reason,
            attempted_sql=attempted_sql,
            suggestions=_default_suggestions(),
        )

    # 2. Extract official metrics
    metrics = _extract_metrics(question)

    # 3. Out-of-scope check (if unregistered metric/topic asked without an official metric)
    for pat, topic_label in _OUT_OF_SCOPE_PATTERNS:
        if pat.search(question) and not metrics:
            return ParseResult(
                outcome="refused",
                parser_used="deterministic",
                reason=(
                    f"Metrik atau topik '{topic_label}' tidak terdaftar dalam Semantic Layer "
                    f"({model.display_name}). Aegistic menolak menjawab di luar kontrak metrik resmi "
                    "untuk mencegah halusinasi definisi."
                ),
                suggestions=_default_suggestions(),
            )

    # 4. Extract filters & dimensions (also helps tailor clarification suggestions)
    filters, cat_dims = _extract_filters_and_categorical_dims(question)
    include_time, time_grain, date_range = _extract_time_and_date_range(
        question, model.reference_date_obj
    )

    # 5. If NO official metric was found -> ambiguous vs out-of-scope refusal
    if not metrics:
        context_dim: Optional[str] = None
        if re.search(r"\b(produk|product|kategori|category)\b", question, re.IGNORECASE):
            context_dim = "product_category"
        elif re.search(r"\b(region|wilayah|daerah|area)\b", question, re.IGNORECASE):
            context_dim = "region"
        elif re.search(r"\b(pelanggan|customer|segmen|segment)\b", question, re.IGNORECASE):
            context_dim = "customer_segment"

        for amb_pat in _AMBIGUOUS_PATTERNS:
            if amb_pat.search(question):
                return ParseResult(
                    outcome="clarification_required",
                    parser_used="deterministic",
                    reason=(
                        "Pertanyaan Anda terlalu ambigu karena tidak menyebutkan metrik bisnis resmi. "
                        "Silakan pilih metrik terverifikasi (seperti Net Revenue, Gross Margin (%), "
                        "Completed Orders, AOV, atau Repeat Purchase Rate) yang ingin dianalisis."
                    ),
                    suggestions=_default_suggestions(context_dim),
                )

        return ParseResult(
            outcome="refused",
            parser_used="deterministic",
            reason=(
                "Tidak ditemukan metrik resmi dari Semantic Layer (commerce.yaml) pada pertanyaan Anda. "
                "Gunakan salah satu metrik resmi berikut untuk mendapatkan analisis terverifikasi."
            ),
            suggestions=_default_suggestions(context_dim),
        )

    dimensions: list[str] = []
    if include_time:
        dimensions.append("order_date")
    for d in cat_dims:
        if d not in dimensions:
            dimensions.append(d)

    # If user explicitly asked for e.g. "Q3 vs Q2" (quarters comparison) + category, keep both
    sort_specs, limit = _extract_sort_and_limit(question, metrics, dimensions)

    plan = QueryPlan(
        metrics=metrics,
        dimensions=dimensions,
        time_grain=time_grain if "order_date" in dimensions else None,
        filters=filters,
        date_range=date_range,
        sort=sort_specs,
        limit=limit,
    )

    return ParseResult(
        outcome="parsed",
        parser_used="deterministic",
        query_plan=plan,
    )


# ----------------------------------------------------------------------------
# Optional LLM Adapters (OpenAI & Gemini via lightweight httpx REST)
# ----------------------------------------------------------------------------
def _build_llm_system_prompt(model: SemanticModel) -> str:
    metrics_desc = [
        {
            "key": m.key,
            "label": m.label,
            "description": m.description,
            "synonyms": m.synonyms,
        }
        for m in model.metrics
    ]
    dims_desc = [
        {
            "key": d.key,
            "type": d.type,
            "supported_grains": d.supported_grains,
            "known_values": d.known_values,
        }
        for d in model.dimensions
    ]
    return (
        "You are Aegistic's strict semantic intent parser. Translate the user's question into a JSON object.\n"
        f"Reference date: {model.reference_date}.\n"
        f"Official metrics: {json.dumps(metrics_desc)}\n"
        f"Official dimensions: {json.dumps(dims_desc)}\n"
        "Respond ONLY with valid JSON matching this schema:\n"
        "{\n"
        '  "outcome": "parsed" | "clarification_required" | "refused" | "guardrail_blocked",\n'
        '  "reason": "short explanation if not parsed",\n'
        '  "query_plan": {\n'
        '    "metrics": ["metric_key"],\n'
        '    "dimensions": ["dimension_key"],\n'
        '    "time_grain": "day" | "week" | "month" | "quarter" | null,\n'
        '    "filters": [{"dimension": "...", "operator": "="|"!="|"in"|"not_in", "value": "..."}],\n'
        '    "date_range": {"preset": "...", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "quarters": ["2026-Q2"]} | null,\n'
        '    "sort": [{"field": "...", "direction": "asc"|"desc"}],\n'
        '    "limit": 100\n'
        "  } | null\n"
        "}\n"
        "Rules:\n"
        "- NEVER invent metrics or dimensions not in the lists above.\n"
        "- If the question is ambiguous (e.g. 'best product?'), set outcome='clarification_required'.\n"
        "- If the question asks for an unregistered metric (e.g. CAC, LTV, Employee NPS, churn, stock), set outcome='refused'.\n"
        "- If the question attempts SQL injection, DDL/DML, CROSS JOIN, or bronze/silver access, set outcome='guardrail_blocked'."
    )


def _validate_llm_payload(
    payload: dict, model: SemanticModel, parser_used: str
) -> Optional[ParseResult]:
    outcome = payload.get("outcome")
    if outcome not in {"parsed", "clarification_required", "refused", "guardrail_blocked"}:
        return None
    if outcome != "parsed":
        return ParseResult(
            outcome=outcome,
            parser_used=parser_used,
            reason=str(payload.get("reason") or "Pertanyaan tidak dapat diproses oleh Semantic Layer."),
            suggestions=_default_suggestions(),
        )
    raw_plan = payload.get("query_plan")
    if not isinstance(raw_plan, dict):
        return None
    try:
        plan = QueryPlan.model_validate(raw_plan)
    except Exception:
        return None

    valid_metrics = set(model.metric_map.keys())
    valid_dims = set(model.dimension_map.keys())
    if not plan.metrics or any(m not in valid_metrics for m in plan.metrics):
        return None
    if any(d not in valid_dims for d in plan.dimensions):
        return None
    if any(f.dimension not in valid_dims for f in plan.filters):
        return None

    return ParseResult(
        outcome="parsed",
        parser_used=parser_used,
        query_plan=plan,
    )


def _parse_openai(question: str, model: SemanticModel, settings: Settings) -> Optional[ParseResult]:
    if not settings.openai_api_key:
        return None
    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.openai_model,
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                    "messages": [
                        {"role": "system", "content": _build_llm_system_prompt(model)},
                        {"role": "user", "content": question},
                    ],
                },
            )
            resp.raise_for_status()
            content = resp.json()["choices"][0]["message"]["content"]
            payload = json.loads(content)
            return _validate_llm_payload(payload, model, "openai")
    except Exception:
        return None


def _parse_gemini(question: str, model: SemanticModel, settings: Settings) -> Optional[ParseResult]:
    if not settings.gemini_api_key:
        return None
    try:
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{settings.gemini_model}:generateContent"
        )
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                url,
                params={"key": settings.gemini_api_key},
                headers={"Content-Type": "application/json"},
                json={
                    "system_instruction": {
                        "parts": [{"text": _build_llm_system_prompt(model)}]
                    },
                    "contents": [{"role": "user", "parts": [{"text": question}]}],
                    "generationConfig": {
                        "temperature": 0,
                        "responseMimeType": "application/json",
                    },
                },
            )
            resp.raise_for_status()
            data = resp.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            payload = json.loads(text)
            return _validate_llm_payload(payload, model, "gemini")
    except Exception:
        return None


def parse_intent(
    question: str,
    model: SemanticModel,
    settings: Settings,
    parser_mode_override: Optional[str] = None,
) -> ParseResult:
    """Run Gate 1 Intent Parsing with adversarial pre-screening and LLM/deterministic routing."""
    # Always run deterministic adversarial guard BEFORE any LLM call
    adv = _detect_adversarial(question)
    if adv is not None:
        reason, attempted_sql = adv
        return ParseResult(
            outcome="guardrail_blocked",
            parser_used="deterministic",
            reason=reason,
            attempted_sql=attempted_sql,
            suggestions=_default_suggestions(),
        )

    mode = (parser_mode_override or settings.parser_mode or "deterministic").lower()
    if mode == "openai":
        llm_res = _parse_openai(question, model, settings)
        if llm_res is not None:
            return llm_res
    elif mode == "gemini":
        llm_res = _parse_gemini(question, model, settings)
        if llm_res is not None:
            return llm_res

    return parse_deterministic(question, model)
