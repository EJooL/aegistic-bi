-- ============================================================================
-- Silver Layer: Cleaned, Deduplicated & Standardized Orders (IDR)
-- Filters out NULL/invalid order_date rows and eliminates Bronze duplicates.
-- ============================================================================

CREATE OR REPLACE TABLE silver.orders AS
WITH deduplicated AS (
    SELECT
        TRIM(order_id) AS order_id,
        TRIM(customer_id) AS customer_id,
        TRY_CAST(NULLIF(TRIM(order_date), '') AS DATE) AS order_date,
        LOWER(TRIM(order_status)) AS order_status,
        UPPER(COALESCE(NULLIF(TRIM(currency), ''), 'IDR')) AS currency,
        CAST(gross_amount AS BIGINT) AS gross_amount,
        CAST(COALESCE(discount_amount, 0) AS BIGINT) AS discount_amount,
        CAST(COALESCE(shipping_cost, 0) AS BIGINT) AS shipping_cost,
        ingested_at,
        ROW_NUMBER() OVER (
            PARTITION BY TRIM(order_id)
            ORDER BY ingested_at DESC
        ) AS rn
    FROM bronze.raw_orders
    WHERE order_id IS NOT NULL
      AND TRIM(order_id) <> ''
)
SELECT
    d.order_id,
    d.customer_id,
    d.order_date,
    d.order_status,
    COALESCE(p.payment_method, 'QRIS') AS payment_method,
    d.currency,
    d.gross_amount,
    d.discount_amount,
    d.shipping_cost,
    (d.gross_amount - d.discount_amount) AS net_amount
FROM deduplicated d
INNER JOIN silver.customers c
    ON d.customer_id = c.customer_id
LEFT JOIN silver.payments p
    ON d.order_id = p.order_id
WHERE d.rn = 1
  AND d.order_date IS NOT NULL
  AND d.order_date BETWEEN DATE '2025-06-01' AND DATE '2026-11-24'
  AND d.order_status IN ('completed', 'cancelled', 'refunded')
  AND d.gross_amount >= d.discount_amount
  AND d.discount_amount >= 0;
