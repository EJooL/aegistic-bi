-- ============================================================================
-- Bronze Layer Schema Initialization (Nusantara Commerce DWH)
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS bronze;
CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;

CREATE OR REPLACE TABLE bronze.raw_customers (
    customer_id      VARCHAR,
    customer_segment VARCHAR,
    region           VARCHAR,
    city             VARCHAR,
    signup_date      VARCHAR,
    ingested_at      TIMESTAMP
);

CREATE OR REPLACE TABLE bronze.raw_products (
    product_id       VARCHAR,
    product_name     VARCHAR,
    category_name    VARCHAR,
    subcategory_name VARCHAR,
    brand            VARCHAR,
    unit_price       BIGINT,
    unit_cost        BIGINT,
    ingested_at      TIMESTAMP
);

CREATE OR REPLACE TABLE bronze.raw_orders (
    order_id         VARCHAR,
    customer_id      VARCHAR,
    order_date       VARCHAR,
    order_status     VARCHAR,
    currency         VARCHAR,
    gross_amount     BIGINT,
    discount_amount  BIGINT,
    shipping_cost    BIGINT,
    ingested_at      TIMESTAMP
);

CREATE OR REPLACE TABLE bronze.raw_payments (
    payment_id       VARCHAR,
    order_id         VARCHAR,
    payment_method   VARCHAR,
    payment_status   VARCHAR,
    paid_amount      BIGINT,
    ingested_at      TIMESTAMP
);

CREATE OR REPLACE TABLE bronze.raw_order_items (
    order_item_id        VARCHAR,
    order_id             VARCHAR,
    product_id           VARCHAR,
    quantity             INTEGER,
    unit_price           BIGINT,
    unit_cost            BIGINT,
    item_gross_amount    BIGINT,
    item_discount_amount BIGINT,
    ingested_at          TIMESTAMP
);
