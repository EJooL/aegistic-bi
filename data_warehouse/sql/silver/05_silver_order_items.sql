-- ============================================================================
-- Silver Layer: Cleaned & Deduplicated Order Items
-- Scoped strictly to valid orders present in silver.orders and silver.products.
-- ============================================================================

CREATE OR REPLACE TABLE silver.order_items AS
WITH deduplicated AS (
    SELECT
        TRIM(order_item_id) AS order_item_id,
        TRIM(order_id) AS order_id,
        TRIM(product_id) AS product_id,
        CAST(quantity AS INTEGER) AS quantity,
        CAST(unit_price AS BIGINT) AS unit_price,
        CAST(unit_cost AS BIGINT) AS unit_cost,
        CAST(item_gross_amount AS BIGINT) AS item_gross_amount,
        CAST(COALESCE(item_discount_amount, 0) AS BIGINT) AS item_discount_amount,
        ingested_at,
        ROW_NUMBER() OVER (
            PARTITION BY TRIM(order_item_id)
            ORDER BY ingested_at DESC
        ) AS rn
    FROM bronze.raw_order_items
    WHERE order_item_id IS NOT NULL
      AND TRIM(order_item_id) <> ''
)
SELECT
    d.order_item_id,
    d.order_id,
    d.product_id,
    d.quantity,
    d.unit_price,
    d.unit_cost,
    d.item_gross_amount,
    d.item_discount_amount,
    (d.item_gross_amount - d.item_discount_amount) AS item_net_amount
FROM deduplicated d
INNER JOIN silver.orders o
    ON d.order_id = o.order_id
INNER JOIN silver.products pr
    ON d.product_id = pr.product_id
WHERE d.rn = 1
  AND d.quantity > 0
  AND d.item_gross_amount >= d.item_discount_amount
  AND d.item_discount_amount >= 0;
