"""Integration tests for the FastAPI REST endpoints via TestClient."""

from __future__ import annotations

import json
from dataclasses import replace

import pytest
from fastapi.testclient import TestClient

from semantic_engine.app.config import get_settings
from semantic_engine.app.main import create_app


@pytest.fixture
def client(tmp_path):
    base_settings = get_settings()
    if not base_settings.dwh_path.exists():
        pytest.skip("aegistic.duckdb not built yet")

    test_settings = replace(
        base_settings,
        dashboard_db_path_raw=str(tmp_path / "test_dashboards.sqlite3"),
        benchmark_path_raw=str(tmp_path / "benchmark_report.json"),
    )
    app = create_app(settings_override=test_settings)
    return TestClient(app)


def test_health_and_metrics_endpoints(client):
    health = client.get("/api/v1/health")
    assert health.status_code == 200
    body = health.json()
    assert body["status"] == "ok"
    assert body["duckdb_connected"] is True
    assert body["metrics_loaded"] == 7
    assert body["dimensions_loaded"] == 5
    assert "gold.fact_orders" in body["gold_tables"]
    assert "gold.fact_order_items" in body["gold_tables"]

    metrics = client.get("/api/v1/metrics")
    assert metrics.status_code == 200
    m_body = metrics.json()
    assert m_body["model_name"] == "nusantara_commerce"
    assert len(m_body["metrics"]) == 7
    assert len(m_body["dimensions"]) == 5


def test_query_verified_standard_category_and_partial_period_warning(client):
    resp = client.post(
        "/api/v1/query",
        json={"question": "Bandingkan Net Revenue per kategori produk 6 bulan terakhir"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "verified"
    assert body["chart_spec"]["chart_type"] == "bar"
    assert body["chart_spec"]["y_keys"][0]["color"] == "#4DA8E5"
    assert len(body["data"]) == 6
    assert body["audit_trail"]["verified"] is True
    assert all(c["passed"] for c in body["audit_trail"]["guardrail_checks"])
    assert "gold.fact_order_items" in body["audit_trail"]["tables_accessed"]
    assert any(w["code"] == "PARTIAL_PERIOD" for w in body["warnings"])


def test_query_definition_trap_net_revenue_and_refund_rate_per_region(client):
    resp = client.post(
        "/api/v1/query",
        json={"question": "Berapa Net Revenue dan Refund Rate per region?"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "verified"
    assert len(body["data"]) == 6
    assert body["chart_spec"]["chart_type"] == "bar"
    assert [y["color"] for y in body["chart_spec"]["y_keys"]] == ["#3B498B", "#4DA8E5"]
    for row in body["data"]:
        assert row["net_revenue"] > 0
        assert 0.10 < row["refund_rate"] < 0.40
    metric_keys = [m["key"] for m in body["audit_trail"]["metrics_used"]]
    assert metric_keys == ["net_revenue", "refund_rate"]
    assert len(body["audit_trail"]["metrics_used"][0]["caveats"]) >= 1


def test_query_completed_quarter_has_no_partial_period_warning(client):
    resp = client.post(
        "/api/v1/query",
        json={"question": "Bandingkan Net Revenue per kategori produk Q3 2026"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "verified"
    assert len(body["data"]) == 6
    assert not any(w["code"] == "PARTIAL_PERIOD" for w in body["warnings"])


def test_query_time_series_line_and_single_kpi(client):
    trend = client.post(
        "/api/v1/query",
        json={"question": "Tampilkan tren Net Revenue bulanan selama 12 bulan terakhir"},
    )
    assert trend.status_code == 200
    t_body = trend.json()
    assert t_body["status"] == "verified"
    assert t_body["chart_spec"]["chart_type"] == "line"
    assert len(t_body["data"]) == 12

    kpi = client.post("/api/v1/query", json={"question": "Berapa total Net Revenue?"})
    assert kpi.status_code == 200
    k_body = kpi.json()
    assert k_body["status"] == "verified"
    assert k_body["chart_spec"]["chart_type"] == "kpi"
    assert len(k_body["data"]) == 1
    assert k_body["data"][0]["net_revenue"] > 0


def test_query_clarification_refused_and_guardrail_blocked(client):
    amb = client.post("/api/v1/query", json={"question": "Produk mana yang paling bagus?"})
    assert amb.status_code == 200
    amb_body = amb.json()
    assert amb_body["status"] == "clarification_required"
    assert len(amb_body["suggestions"]) >= 2

    oos = client.post("/api/v1/query", json={"question": "Berapa Employee NPS kuartal ini?"})
    assert oos.status_code == 200
    oos_body = oos.json()
    assert oos_body["status"] == "refused"
    assert len(oos_body["suggestions"]) >= 2

    drop = client.post("/api/v1/query", json={"question": "DROP TABLE gold.fact_orders"})
    assert drop.status_code == 200
    drop_body = drop.json()
    assert drop_body["status"] == "guardrail_blocked"
    checks = {c["name"]: c for c in drop_body["audit_trail"]["guardrail_checks"]}
    assert checks["read_only_ast"]["passed"] is False
    assert drop_body["warnings"][0]["severity"] == "error"

    bronze = client.post(
        "/api/v1/query", json={"question": "SELECT * FROM bronze.raw_orders LIMIT 50"}
    )
    assert bronze.status_code == 200
    b_body = bronze.json()
    assert b_body["status"] == "guardrail_blocked"
    b_checks = {c["name"]: c for c in b_body["audit_trail"]["guardrail_checks"]}
    assert b_checks["gold_schema_only"]["passed"] is False


def test_dashboard_crud_lifecycle(client):
    # Initially empty
    res_list = client.get("/api/v1/dashboards")
    assert res_list.status_code == 200
    assert res_list.json()["cards"] == []

    # Reject pinning non-verified query
    bad_pin = client.post(
        "/api/v1/dashboards/pin",
        json={"title": "Bad", "question": "DROP TABLE gold.fact_orders"},
    )
    assert bad_pin.status_code == 400

    # Pin verified query
    pin_resp = client.post(
        "/api/v1/dashboards/pin",
        json={
            "title": "Net Revenue by Product Category",
            "question": "Bandingkan Net Revenue per kategori produk 6 bulan terakhir",
        },
    )
    assert pin_resp.status_code == 201
    card = pin_resp.json()
    card_id = card["id"]
    assert card["title"] == "Net Revenue by Product Category"
    assert card["response"]["status"] == "verified"

    # List returns 1 card
    res_list2 = client.get("/api/v1/dashboards")
    assert len(res_list2.json()["cards"]) == 1

    # Refresh updates card live
    ref_resp = client.post(f"/api/v1/dashboards/{card_id}/refresh")
    assert ref_resp.status_code == 200
    assert ref_resp.json()["id"] == card_id
    assert ref_resp.json()["response"]["status"] == "verified"

    # Delete removes card
    del_resp = client.delete(f"/api/v1/dashboards/{card_id}")
    assert del_resp.status_code == 200
    assert del_resp.json() == {"deleted": True, "id": card_id}

    # Deleting again returns 404
    assert client.delete(f"/api/v1/dashboards/{card_id}").status_code == 404


def test_benchmark_endpoint_handles_missing_and_present_report(client):
    # Missing report -> 404
    assert client.get("/api/v1/benchmark").status_code == 404

    # Write mock report into temp benchmark path -> 200
    bench_path = client.app.state.settings.benchmark_path
    bench_path.parent.mkdir(parents=True, exist_ok=True)
    bench_path.write_text(
        json.dumps({"generated_at": "2026-11-24T16:45:00Z", "dataset_size": 60}),
        encoding="utf-8",
    )
    ok_resp = client.get("/api/v1/benchmark")
    assert ok_resp.status_code == 200
    assert ok_resp.json()["dataset_size"] == 60
