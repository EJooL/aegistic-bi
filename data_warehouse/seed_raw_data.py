"""Deterministic raw data generator for Nusantara Commerce (Bronze layer).

Uses only Python standard library modules plus DuckDB (no pandas/numpy/faker).
Produces ~50,200 base orders (~50,950 Bronze rows with ~1.5% intentional
duplicates and ~0.3% NULL order dates) spanning 2025-06-01 through 2026-11-24.
"""

from __future__ import annotations

import csv
import random
import tempfile
from datetime import date, datetime, timedelta
from pathlib import Path

import duckdb

SEED = 42
START_DATE = date(2025, 6, 1)
END_DATE = date(2026, 11, 24)
ZERO_ORDER_DATES = {date(2026, 8, 17), date(2026, 9, 3)}

NUM_CUSTOMERS = 12_000
NUM_BASE_ORDERS = 50_200
DUPLICATE_RATE = 0.015
NULL_DATE_RATE = 0.003

SEGMENTS = ["Regular", "Silver", "Gold", "Enterprise"]
SEGMENT_WEIGHTS = [0.52, 0.25, 0.16, 0.07]
SEGMENT_REPEAT_PROB = {
    "Regular": 0.26,
    "Silver": 0.44,
    "Gold": 0.62,
    "Enterprise": 0.78,
}
SEGMENT_ORDER_WEIGHT = {
    "Regular": 1.0,
    "Silver": 1.6,
    "Gold": 2.5,
    "Enterprise": 4.2,
}

REGION_CITIES: dict[str, list[str]] = {
    "Jabodetabek": [
        "Jakarta Selatan",
        "Jakarta Pusat",
        "Jakarta Barat",
        "Tangerang",
        "Bekasi",
        "Depok",
        "Bogor",
    ],
    "Jawa Barat": ["Bandung", "Cirebon", "Tasikmalaya", "Sukabumi", "Karawang"],
    "Jawa Tengah & DIY": ["Semarang", "Yogyakarta", "Surakarta", "Magelang", "Purwokerto"],
    "Jawa Timur": ["Surabaya", "Malang", "Sidoarjo", "Kediri", "Gresik"],
    "Sumatera": ["Medan", "Palembang", "Pekanbaru", "Padang", "Bandar Lampung"],
    "Kalimantan & Sulawesi": ["Makassar", "Balikpapan", "Samarinda", "Banjarmasin", "Manado"],
}
REGIONS = list(REGION_CITIES.keys())
REGION_WEIGHTS = [0.34, 0.17, 0.14, 0.16, 0.11, 0.08]

PAYMENT_METHODS = ["QRIS", "Virtual Account", "Credit Card", "E-Wallet", "COD"]
PAYMENT_WEIGHTS = [0.32, 0.22, 0.12, 0.26, 0.08]

CATEGORY_SPECS: list[dict] = [
    {
        "category": "Electronics",
        "subcategories": [
            "Smartphones & Accessories",
            "Audio & Headphones",
            "Computing",
            "Smart Home",
        ],
        "brands": ["NusaTech", "AetherAudio", "KaryaVolt", "SinarByte", "Orbitron"],
        "price_range": (160_000, 3_600_000),
        "margin_range": (0.21, 0.33),
        "weight": 0.17,
        "item_nouns": [
            "Wireless Earbuds",
            "USB-C Power Bank",
            "Mechanical Keyboard",
            "Smart Wi-Fi Plug",
            "Noise-Cancelling Headset",
            "4K Webcam",
            "GaN Fast Charger",
            "Bluetooth Speaker",
            "Portable SSD",
            "Smart LED Strip",
        ],
    },
    {
        "category": "Fashion",
        "subcategories": [
            "Men's Apparel",
            "Women's Apparel",
            "Footwear",
            "Bags & Accessories",
        ],
        "brands": ["BatikKala", "LokaWear", "SuryaStep", "RupaCraft", "TenunModa"],
        "price_range": (95_000, 720_000),
        "margin_range": (0.40, 0.54),
        "weight": 0.21,
        "item_nouns": [
            "Linen Overshirt",
            "Canvas Sneakers",
            "Leather Crossbody Bag",
            "Slim Chino Pants",
            "Batik Modern Shirt",
            "Knit Cardigan",
            "Everyday Tote Bag",
            "Running Jacket",
            "Cotton Polo Tee",
            "Minimalist Loafers",
        ],
    },
    {
        "category": "Home & Living",
        "subcategories": [
            "Kitchenware",
            "Bedding & Bath",
            "Storage & Decor",
            "Lighting",
        ],
        "brands": ["RumahTeduh", "DapurLestari", "KamarNyaman", "KayuAsri", "CahayaLoka"],
        "price_range": (75_000, 1_150_000),
        "margin_range": (0.35, 0.49),
        "weight": 0.16,
        "item_nouns": [
            "Non-Stick Ceramic Pan",
            "Bamboo Bedding Set",
            "Stackable Organizer Box",
            "Warm Desk Lamp",
            "Pour-Over Coffee Kettle",
            "Cotton Bath Towel Set",
            "Aroma Diffuser",
            "Cast Iron Skillet",
            "Modular Shoe Rack",
            "Glass Food Container Set",
        ],
    },
    {
        "category": "Beauty & Personal Care",
        "subcategories": ["Skincare", "Makeup", "Haircare", "Fragrances"],
        "brands": ["SariGlow", "KiranaBotanicals", "Lembayung", "BeningLab", "AromaNusa"],
        "price_range": (55_000, 440_000),
        "margin_range": (0.42, 0.55),
        "weight": 0.18,
        "item_nouns": [
            "Niacinamide Serum",
            "Daily UV Sunscreen",
            "Hydrating Gel Moisturizer",
            "Velvet Lip Tint",
            "Argan Repair Shampoo",
            "Botanical Eau de Parfum",
            "Gentle Amino Cleanser",
            "Retinol Night Cream",
            "Mineral Setting Powder",
            "Scalp Tonic Mist",
        ],
    },
    {
        "category": "Groceries",
        "subcategories": [
            "Coffee & Tea",
            "Healthy Snacks",
            "Pantry Staples",
            "Beverages",
        ],
        "brands": ["KopiGayo", "TaniMurni", "CemilanSehat", "SariBumi", "TehPriangan"],
        "price_range": (28_000, 185_000),
        "margin_range": (0.20, 0.31),
        "weight": 0.16,
        "item_nouns": [
            "Arabica Roast Beans 500g",
            "Organic Granola Mix",
            "Raw Forest Honey 350ml",
            "Cold-Pressed Coconut Oil",
            "Artisan Green Tea Tin",
            "Roasted Almond Pack",
            "Oat Milk Barista 1L",
            "Single-Origin Drip Coffee",
            "Spiced Cashew Nuts",
            "Dark Chocolate Bar 72%",
        ],
    },
    {
        "category": "Sports & Outdoors",
        "subcategories": [
            "Fitness Equipment",
            "Running & Cycling",
            "Camping Gear",
            "Activewear",
        ],
        "brands": ["GerakAktif", "PuncakGear", "LariNusa", "VeloIndo", "KuatFit"],
        "price_range": (110_000, 1_450_000),
        "margin_range": (0.32, 0.46),
        "weight": 0.12,
        "item_nouns": [
            "Non-Slip Yoga Mat",
            "Adjustable Dumbbell Pair",
            "Ultralight Camping Tent",
            "Hydration Running Vest",
            "Resistance Band Kit",
            "Insulated Trail Flask",
            "Cycling Helmet Pro",
            "Dry-Fit Training Shorts",
            "Trekking Pole Pair",
            "Foldable Camp Chair",
        ],
    },
]


def _build_date_pool() -> tuple[list[date], list[float]]:
    """Build valid calendar dates (excluding intentional zero-order dates) and weights."""
    dates: list[date] = []
    weights: list[float] = []
    cur = START_DATE
    while cur <= END_DATE:
        if cur not in ZERO_ORDER_DATES:
            month_idx = (cur.year - START_DATE.year) * 12 + (cur.month - START_DATE.month)
            w = 1.0 + 0.024 * month_idx

            if cur.month == 11:
                w *= 1.22  # 11.11 Harbolnas
            elif cur.month == 12:
                w *= 1.30  # 12.12 & year-end promo
            elif (cur.year, cur.month) in {(2026, 2), (2026, 3)}:
                w *= 1.18  # Ramadan & Lebaran peak

            if cur.day >= 25 or cur.day <= 3:
                w *= 1.16  # Payday effect
            if cur.weekday() >= 5:
                w *= 1.07  # Weekend lift

            dates.append(cur)
            weights.append(w)
        cur += timedelta(days=1)
    return dates, weights


def _generate_products(rng: random.Random) -> tuple[list[dict], list[float]]:
    """Generate 120 realistic Nusantara Commerce products across 6 categories."""
    products: list[dict] = []
    product_weights: list[float] = []
    ingested_base = datetime(2025, 5, 20, 8, 0, 0)
    prod_idx = 1

    for spec in CATEGORY_SPECS:
        cat = spec["category"]
        subcats = spec["subcategories"]
        brands = spec["brands"]
        p_min, p_max = spec["price_range"]
        m_min, m_max = spec["margin_range"]
        nouns = spec["item_nouns"]
        cat_weight = spec["weight"]

        for i in range(20):
            subcat = subcats[i % len(subcats)]
            brand = brands[i % len(brands)]
            noun = nouns[i % len(nouns)]
            edition = "Pro" if i >= 10 else "Essential"
            product_name = f"{brand} {noun} {edition} {((i // 2) % 5) + 1}"

            raw_price = rng.uniform(p_min, p_max)
            unit_price = max(15_000, int(round(raw_price / 5_000.0)) * 5_000)
            margin = rng.uniform(m_min, m_max)
            unit_cost = max(5_000, int(round((unit_price * (1.0 - margin)) / 1_000.0)) * 1_000)

            products.append(
                {
                    "product_id": f"PRD-{prod_idx:04d}",
                    "product_name": product_name,
                    "category_name": cat,
                    "subcategory_name": subcat,
                    "brand": brand,
                    "unit_price": unit_price,
                    "unit_cost": unit_cost,
                    "ingested_at": (ingested_base + timedelta(minutes=prod_idx)).isoformat(
                        sep=" "
                    ),
                }
            )
            # Popularity skew inside each category
            popularity = rng.uniform(0.6, 1.8)
            product_weights.append(cat_weight * popularity)
            prod_idx += 1

    return products, product_weights


def _generate_customers(rng: random.Random) -> list[dict]:
    """Generate ~12,000 customers across 4 segments and 6 Indonesian regions."""
    customers: list[dict] = []
    ingested_base = datetime(2025, 5, 25, 9, 0, 0)

    for idx in range(1, NUM_CUSTOMERS + 1):
        segment = rng.choices(SEGMENTS, weights=SEGMENT_WEIGHTS, k=1)[0]
        region = rng.choices(REGIONS, weights=REGION_WEIGHTS, k=1)[0]
        city = rng.choice(REGION_CITIES[region])
        # Signup dates between 2024-06-01 and 2026-10-31
        signup_offset = rng.randint(0, 880)
        signup_date = date(2024, 6, 1) + timedelta(days=signup_offset)
        if signup_date > END_DATE:
            signup_date = END_DATE - timedelta(days=rng.randint(1, 30))

        # Subtle Bronze casing quirk on ~2% of customer segments
        raw_segment = segment.lower() if rng.random() < 0.02 else segment

        customers.append(
            {
                "customer_id": f"CUST-{idx:05d}",
                "customer_segment": raw_segment,
                "clean_segment": segment,
                "region": region,
                "city": city,
                "signup_date": signup_date.isoformat(),
                "ingested_at": (ingested_base + timedelta(seconds=idx * 5)).isoformat(sep=" "),
            }
        )
    return customers


def _assign_order_customers(rng: random.Random, customers: list[dict]) -> list[dict]:
    """Assign each of NUM_BASE_ORDERS to a customer with realistic ~35-45% repeat rate."""
    one_time_customers: list[dict] = []
    repeat_customers: list[dict] = []
    repeat_weights: list[float] = []

    for c in customers:
        seg = c["clean_segment"]
        if rng.random() < SEGMENT_REPEAT_PROB[seg]:
            repeat_customers.append(c)
            repeat_weights.append(SEGMENT_ORDER_WEIGHT[seg] * rng.uniform(0.6, 1.6))
        else:
            one_time_customers.append(c)

    assigned: list[dict] = []
    # Every one-time customer gets exactly 1 order
    assigned.extend(one_time_customers)
    # Every repeat customer gets at least 3 orders so most achieve >=2 completed orders
    for rc in repeat_customers:
        assigned.extend([rc, rc, rc])

    remaining = NUM_BASE_ORDERS - len(assigned)
    if remaining > 0:
        extra = rng.choices(repeat_customers, weights=repeat_weights, k=remaining)
        assigned.extend(extra)
    elif remaining < 0:
        assigned = assigned[:NUM_BASE_ORDERS]

    rng.shuffle(assigned)
    return assigned


def _pick_order_status(rng: random.Random, payment_method: str) -> str:
    """Choose order status (~78% completed, ~13% cancelled, ~9% refunded overall)."""
    r = rng.random()
    if payment_method == "COD":
        # COD has realistically higher cancellation/refund friction
        if r < 0.68:
            status = "completed"
        elif r < 0.88:
            status = "cancelled"
        else:
            status = "refunded"
    else:
        if r < 0.789:
            status = "completed"
        elif r < 0.913:
            status = "cancelled"
        else:
            status = "refunded"

    # Introduce occasional Bronze formatting noise (~3%) cleaned by Silver
    quirk = rng.random()
    if quirk < 0.015:
        return status.upper()
    if quirk < 0.03:
        return f" {status.capitalize()} "
    return status


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict]) -> None:
    with path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(fh, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def populate_bronze(conn: duckdb.DuckDBPyConnection) -> dict[str, int]:
    """Generate deterministic Bronze data and load into DuckDB via temp CSVs."""
    rng = random.Random(SEED)

    # Ensure schemas and Bronze tables exist even if invoked standalone
    bronze_ddl_path = Path(__file__).resolve().parent / "sql" / "bronze" / "01_bronze_schema.sql"
    if bronze_ddl_path.exists():
        conn.execute(bronze_ddl_path.read_text(encoding="utf-8"))

    valid_dates, date_weights = _build_date_pool()
    products, product_weights = _generate_products(rng)
    customers = _generate_customers(rng)
    order_customers = _assign_order_customers(rng, customers)

    # Pre-sample order dates in one fast batch
    sampled_dates = rng.choices(valid_dates, weights=date_weights, k=len(order_customers))
    sampled_payments = rng.choices(PAYMENT_METHODS, weights=PAYMENT_WEIGHTS, k=len(order_customers))

    raw_orders: list[dict] = []
    raw_order_items: list[dict] = []
    raw_payments: list[dict] = []

    item_counter = 1
    duplicate_orders: list[dict] = []

    for idx, (cust, o_date, pay_method) in enumerate(
        zip(order_customers, sampled_dates, sampled_payments), start=1
    ):
        order_id = f"ORD-{idx:06d}"
        is_null_date = rng.random() < NULL_DATE_RATE
        date_str = "" if is_null_date else o_date.isoformat()

        raw_status = _pick_order_status(rng, pay_method)
        clean_status = raw_status.strip().lower()

        # 1-3 distinct products per order (~1.8 items avg -> ~90k items)
        n_items = rng.choices([1, 2, 3], weights=[0.40, 0.40, 0.20], k=1)[0]
        picked_indices: list[int] = []
        while len(picked_indices) < n_items:
            p_idx = rng.choices(range(len(products)), weights=product_weights, k=1)[0]
            if p_idx not in picked_indices:
                picked_indices.append(p_idx)

        # 45% of orders have 0% discount, 55% have 3%-20% discount
        disc_rate = 0.0 if rng.random() < 0.45 else rng.uniform(0.03, 0.20)
        is_enterprise = cust["clean_segment"] == "Enterprise"

        ingested_dt = datetime(
            o_date.year,
            o_date.month,
            o_date.day,
            rng.randint(8, 22),
            rng.randint(0, 59),
            rng.randint(0, 59),
        )
        ingested_str = ingested_dt.isoformat(sep=" ")

        order_gross = 0
        order_discount = 0

        for p_idx in picked_indices:
            prod = products[p_idx]
            if is_enterprise:
                qty = rng.choices([1, 2, 3, 4, 5], weights=[0.25, 0.30, 0.25, 0.12, 0.08], k=1)[0]
            else:
                qty = rng.choices([1, 2, 3], weights=[0.70, 0.22, 0.08], k=1)[0]

            item_gross = qty * prod["unit_price"]
            if disc_rate > 0.0:
                item_disc = int(round((item_gross * disc_rate) / 100.0)) * 100
                item_disc = max(0, min(item_disc, item_gross))
            else:
                item_disc = 0

            order_gross += item_gross
            order_discount += item_disc

            raw_order_items.append(
                {
                    "order_item_id": f"ITM-{item_counter:07d}",
                    "order_id": order_id,
                    "product_id": prod["product_id"],
                    "quantity": qty,
                    "unit_price": prod["unit_price"],
                    "unit_cost": prod["unit_cost"],
                    "item_gross_amount": item_gross,
                    "item_discount_amount": item_disc,
                    "ingested_at": ingested_str,
                }
            )
            item_counter += 1

        shipping_cost = rng.randint(12, 45) * 1_000
        currency = "idr" if rng.random() < 0.02 else "IDR"

        order_row = {
            "order_id": order_id,
            "customer_id": cust["customer_id"],
            "order_date": date_str,
            "order_status": raw_status,
            "currency": currency,
            "gross_amount": order_gross,
            "discount_amount": order_discount,
            "shipping_cost": shipping_cost,
            "ingested_at": ingested_str,
        }
        raw_orders.append(order_row)

        # ~1.5% intentional duplicate ingestion rows in Bronze (earlier ingested_at)
        if rng.random() < DUPLICATE_RATE:
            dup_row = dict(order_row)
            dup_row["ingested_at"] = (ingested_dt - timedelta(hours=2)).isoformat(sep=" ")
            duplicate_orders.append(dup_row)

        payment_status = (
            "settled"
            if clean_status == "completed"
            else ("refunded" if clean_status == "refunded" else "voided")
        )
        paid_amount = 0 if clean_status == "cancelled" else (order_gross - order_discount + shipping_cost)
        raw_pay_method = pay_method.lower() if rng.random() < 0.02 else pay_method

        raw_payments.append(
            {
                "payment_id": f"PAY-{idx:06d}",
                "order_id": order_id,
                "payment_method": raw_pay_method,
                "payment_status": payment_status,
                "paid_amount": paid_amount,
                "ingested_at": ingested_str,
            }
        )

    raw_orders.extend(duplicate_orders)

    customer_rows = [
        {
            "customer_id": c["customer_id"],
            "customer_segment": c["customer_segment"],
            "region": c["region"],
            "city": c["city"],
            "signup_date": c["signup_date"],
            "ingested_at": c["ingested_at"],
        }
        for c in customers
    ]

    with tempfile.TemporaryDirectory(prefix="aegistic_bronze_") as tmp_dir:
        tmp_path = Path(tmp_dir)

        cust_csv = tmp_path / "raw_customers.csv"
        prod_csv = tmp_path / "raw_products.csv"
        ord_csv = tmp_path / "raw_orders.csv"
        pay_csv = tmp_path / "raw_payments.csv"
        itm_csv = tmp_path / "raw_order_items.csv"

        _write_csv(
            cust_csv,
            ["customer_id", "customer_segment", "region", "city", "signup_date", "ingested_at"],
            customer_rows,
        )
        _write_csv(
            prod_csv,
            [
                "product_id",
                "product_name",
                "category_name",
                "subcategory_name",
                "brand",
                "unit_price",
                "unit_cost",
                "ingested_at",
            ],
            products,
        )
        _write_csv(
            ord_csv,
            [
                "order_id",
                "customer_id",
                "order_date",
                "order_status",
                "currency",
                "gross_amount",
                "discount_amount",
                "shipping_cost",
                "ingested_at",
            ],
            raw_orders,
        )
        _write_csv(
            pay_csv,
            ["payment_id", "order_id", "payment_method", "payment_status", "paid_amount", "ingested_at"],
            raw_payments,
        )
        _write_csv(
            itm_csv,
            [
                "order_item_id",
                "order_id",
                "product_id",
                "quantity",
                "unit_price",
                "unit_cost",
                "item_gross_amount",
                "item_discount_amount",
                "ingested_at",
            ],
            raw_order_items,
        )

        conn.execute("DELETE FROM bronze.raw_customers")
        conn.execute(
            """
            INSERT INTO bronze.raw_customers
            SELECT
                customer_id,
                customer_segment,
                region,
                city,
                signup_date,
                CAST(ingested_at AS TIMESTAMP)
            FROM read_csv_auto(?, header=true, all_varchar=true)
            """,
            [cust_csv.as_posix()],
        )

        conn.execute("DELETE FROM bronze.raw_products")
        conn.execute(
            """
            INSERT INTO bronze.raw_products
            SELECT
                product_id,
                product_name,
                category_name,
                subcategory_name,
                brand,
                CAST(unit_price AS BIGINT),
                CAST(unit_cost AS BIGINT),
                CAST(ingested_at AS TIMESTAMP)
            FROM read_csv_auto(?, header=true, all_varchar=true)
            """,
            [prod_csv.as_posix()],
        )

        conn.execute("DELETE FROM bronze.raw_orders")
        conn.execute(
            """
            INSERT INTO bronze.raw_orders
            SELECT
                order_id,
                customer_id,
                NULLIF(order_date, ''),
                order_status,
                currency,
                CAST(gross_amount AS BIGINT),
                CAST(discount_amount AS BIGINT),
                CAST(shipping_cost AS BIGINT),
                CAST(ingested_at AS TIMESTAMP)
            FROM read_csv_auto(?, header=true, all_varchar=true)
            """,
            [ord_csv.as_posix()],
        )

        conn.execute("DELETE FROM bronze.raw_payments")
        conn.execute(
            """
            INSERT INTO bronze.raw_payments
            SELECT
                payment_id,
                order_id,
                payment_method,
                payment_status,
                CAST(paid_amount AS BIGINT),
                CAST(ingested_at AS TIMESTAMP)
            FROM read_csv_auto(?, header=true, all_varchar=true)
            """,
            [pay_csv.as_posix()],
        )

        conn.execute("DELETE FROM bronze.raw_order_items")
        conn.execute(
            """
            INSERT INTO bronze.raw_order_items
            SELECT
                order_item_id,
                order_id,
                product_id,
                CAST(quantity AS INTEGER),
                CAST(unit_price AS BIGINT),
                CAST(unit_cost AS BIGINT),
                CAST(item_gross_amount AS BIGINT),
                CAST(item_discount_amount AS BIGINT),
                CAST(ingested_at AS TIMESTAMP)
            FROM read_csv_auto(?, header=true, all_varchar=true)
            """,
            [itm_csv.as_posix()],
        )

    return {
        "bronze.raw_customers": len(customer_rows),
        "bronze.raw_products": len(products),
        "bronze.raw_orders": len(raw_orders),
        "bronze.raw_payments": len(raw_payments),
        "bronze.raw_order_items": len(raw_order_items),
    }


if __name__ == "__main__":
    default_db = Path(__file__).resolve().parent.parent / "aegistic.duckdb"
    with duckdb.connect(str(default_db)) as connection:
        counts = populate_bronze(connection)
        for tbl, cnt in counts.items():
            print(f"{tbl}: {cnt:,}")
