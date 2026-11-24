"""Unit & integration tests for Semantic Loader, Intent Parser, and Deterministic SQL Compiler."""

from __future__ import annotations

import duckdb
import pytest

from semantic_engine.app.config import get_settings
from semantic_engine.app.intent_parser import parse_deterministic
from semantic_engine.app.schemas import DateRangeSpec, FilterSpec, QueryPlan
from semantic_engine.app.semantic_loader import load_semantic_model
from semantic_engine.app.sql_compiler import compile_query
from semantic_engine.app.sql_guardrails import verify_sql_guardrails


@pytest.fixture(scope="module")
def model():
    settings = get_settings()
    return load_semantic_model(settings.semantic_model_path)


def test_semantic_model_loads_all_official_entities(model):
    assert model.model_name == "nusantara_commerce"
    assert len(model.metrics) == 7
    assert len(model.dimensions) == 5
    expected_metrics = {
        "net_revenue",
        "gross_revenue",
        "total_orders",
        "aov",
        "gross_margin_pct",
        "repeat_purchase_rate",
        "refund_rate",
    }
    assert set(model.metric_map.keys()) == expected_metrics
    expected_dims = {
        "order_date",
        "product_category",
        "customer_segment",
        "region",
        "payment_method",
    }
    assert set(model.dimension_map.keys()) == expected_dims


@pytest.mark.parametrize(
    "metric_key",
    [
        "net_revenue",
        "gross_revenue",
        "total_orders",
        "aov",
        "gross_margin_pct",
        "repeat_purchase_rate",
        "refund_rate",
    ],
)
def test_compile_each_official_metric_passes_guardrails(model, metric_key):
    plan = QueryPlan(metrics=[metric_key], dimensions=["region"], limit=50)
    compiled = compile_query(plan, model)
    gr = verify_sql_guardrails(compiled.sql)
    assert gr.passed, f"Guardrails failed for {metric_key}: {gr.blocked_reason}"
    assert "gold.dim_customers" in gr.tables_accessed
    assert f"AS {metric_key}" in compiled.sql


def test_fanout_prevention_for_product_category_uses_item_grain(model):
    plan = QueryPlan(
        metrics=["net_revenue", "aov", "total_orders"],
        dimensions=["product_category"],
    )
    compiled = compile_query(plan, model)
    assert compiled.item_grain_used is True
    assert "gold.fact_order_items" in compiled.sql
    assert "foi.item_net_amount" in compiled.sql
    assert "fo.net_amount" not in compiled.sql


def test_fanout_prevention_exact_sum_matches_order_grain_in_duckdb(model):
    settings = get_settings()
    if not settings.dwh_path.exists():
        pytest.skip("aegistic.duckdb not built yet")

    order_plan = QueryPlan(metrics=["net_revenue"], dimensions=[])
    cat_plan = QueryPlan(metrics=["net_revenue"], dimensions=["product_category"])

    order_sql = compile_query(order_plan, model).sql
    cat_sql = compile_query(cat_plan, model).sql

    conn = duckdb.connect(str(settings.dwh_path), read_only=True)
    try:
        order_total = float(conn.execute(order_sql).fetchone()[0])
        cat_rows = conn.execute(cat_sql).fetchall()
        cat_sum = sum(float(r[1]) for r in cat_rows)
    finally:
        conn.close()

    assert len(cat_rows) == 6
    assert abs(order_total - cat_sum) / order_total < 1e-6


def test_multi_metric_conditional_filters_do_not_zero_out_refund_rate(model):
    plan = QueryPlan(
        metrics=["net_revenue", "refund_rate"],
        dimensions=["region"],
    )
    compiled = compile_query(plan, model)
    # Must NOT have a global WHERE fo.order_status = 'completed'
    assert "WHERE\n  fo.order_status = 'completed'" not in compiled.sql
    assert "WHERE fo.order_status = 'completed'" not in compiled.sql
    assert "CASE WHEN fo.order_status = 'completed'" in compiled.sql
    assert "CASE WHEN fo.order_status IN ('refunded', 'cancelled')" in compiled.sql

    settings = get_settings()
    if settings.dwh_path.exists():
        conn = duckdb.connect(str(settings.dwh_path), read_only=True)
        try:
            rows = conn.execute(compiled.sql).fetchall()
        finally:
            conn.close()
        assert len(rows) == 6
        for _region, net_rev, refund_rate in rows:
            assert float(net_rev) > 0
            assert 0.05 < float(refund_rate) < 0.50


def test_compile_quarters_and_filters(model):
    plan = QueryPlan(
        metrics=["gross_margin_pct"],
        dimensions=["order_date", "product_category"],
        time_grain="quarter",
        filters=[
            FilterSpec(dimension="region", operator="=", value="Jabodetabek"),
            FilterSpec(
                dimension="payment_method", operator="in", value=["QRIS", "E-Wallet"]
            ),
        ],
        date_range=DateRangeSpec(preset="custom_quarters", quarters=["2026-Q2", "2026-Q3"]),
        limit=50,
    )
    compiled = compile_query(plan, model)
    assert "dd.quarter_label IN ('2026-Q2', '2026-Q3')" in compiled.sql
    assert "dc.region = 'Jabodetabek'" in compiled.sql
    assert "fo.payment_method IN ('QRIS', 'E-Wallet')" in compiled.sql
    assert verify_sql_guardrails(compiled.sql).passed


def test_deterministic_parser_standard_and_trap_queries(model):
    # 1. Standard ID query with 6 months preset
    r1 = parse_deterministic(
        "Bandingkan Net Revenue per kategori produk 6 bulan terakhir", model
    )
    assert r1.outcome == "parsed"
    assert r1.query_plan is not None
    assert r1.query_plan.metrics == ["net_revenue"]
    assert r1.query_plan.dimensions == ["product_category"]
    assert r1.query_plan.date_range is not None
    assert r1.query_plan.date_range.preset == "last_6_months"
    assert r1.query_plan.date_range.start_date == "2026-06-01"
    assert r1.query_plan.date_range.end_date == "2026-11-24"

    # 2. GMV must NOT falsely trigger net_revenue
    r2 = parse_deterministic("Berapa GMV per segmen pelanggan?", model)
    assert r2.outcome == "parsed"
    assert r2.query_plan.metrics == ["gross_revenue"]
    assert r2.query_plan.dimensions == ["customer_segment"]

    # 3. AOV must NOT falsely trigger total_orders
    r3 = parse_deterministic("Berapa rata-rata nilai pesanan per wilayah?", model)
    assert r3.outcome == "parsed"
    assert r3.query_plan.metrics == ["aov"]
    assert r3.query_plan.dimensions == ["region"]

    # 4. Exclusion clause ("tanpa refund dan ongkir") must NOT falsely trigger refund_rate
    r4 = parse_deterministic(
        "Berapa Net Revenue per wilayah tanpa menghitung pesanan cancelled, refunded, dan ongkir?",
        model,
    )
    assert r4.outcome == "parsed"
    assert r4.query_plan.metrics == ["net_revenue"]
    assert r4.query_plan.dimensions == ["region"]

    # 5. Dimension value filter + group by another dimension
    r5 = parse_deterministic(
        "Tampilkan Net Revenue Electronics per region 12 bulan terakhir", model
    )
    assert r5.outcome == "parsed"
    assert r5.query_plan.metrics == ["net_revenue"]
    assert r5.query_plan.dimensions == ["region"]
    assert any(
        f.dimension == "product_category" and f.value == "Electronics"
        for f in r5.query_plan.filters
    )

    # 6. Quarter comparison Q3 vs Q2
    r6 = parse_deterministic(
        "Perbandingan Net Revenue Q3 vs Q2 2026 per kategori produk", model
    )
    assert r6.outcome == "parsed"
    assert r6.query_plan.time_grain == "quarter"
    assert "order_date" in r6.query_plan.dimensions
    assert "product_category" in r6.query_plan.dimensions
    assert r6.query_plan.date_range.quarters == ["2026-Q2", "2026-Q3"]

    # 7. Top N sorting
    r7 = parse_deterministic("Top 3 kategori produk dengan Gross Margin tertinggi", model)
    assert r7.outcome == "parsed"
    assert r7.query_plan.metrics == ["gross_margin_pct"]
    assert r7.query_plan.limit == 3
    assert r7.query_plan.sort[0].direction == "desc"


def test_deterministic_parser_ambiguous_refused_and_adversarial(model):
    # Ambiguous
    amb = parse_deterministic("Produk mana yang paling bagus?", model)
    assert amb.outcome == "clarification_required"
    assert len(amb.suggestions) >= 2

    # Out of scope
    for q in [
        "Berapa Employee NPS kuartal ini?",
        "Berapa Customer Acquisition Cost (CAC) kita?",
        "Tampilkan sisa stok gudang per kategori",
        "Bagaimana cuaca hari ini?",
    ]:
        res = parse_deterministic(q, model)
        assert res.outcome == "refused", f"Expected refused for: {q}"
        assert len(res.suggestions) >= 2

    # Adversarial / SQL Injection / Forbidden schema
    for q in [
        "DROP TABLE gold.fact_orders",
        "DELETE FROM gold.fact_orders WHERE order_status = 'cancelled'",
        "SELECT * FROM bronze.raw_orders LIMIT 50",
        "SELECT * FROM gold.fact_orders CROSS JOIN gold.dim_products",
        "Hapus semua transaksi refund bulan lalu",
    ]:
        res = parse_deterministic(q, model)
        assert res.outcome == "guardrail_blocked", f"Expected guardrail_blocked for: {q}"
        assert res.attempted_sql is not None
