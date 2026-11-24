-- ============================================================================
-- Silver Layer: Cleaned & Deduplicated Payments
-- ============================================================================

CREATE OR REPLACE TABLE silver.payments AS
WITH ranked AS (
    SELECT
        TRIM(payment_id) AS payment_id,
        TRIM(order_id) AS order_id,
        CASE LOWER(TRIM(payment_method))
            WHEN 'qris'            THEN 'QRIS'
            WHEN 'virtual account' THEN 'Virtual Account'
            WHEN 'va'              THEN 'Virtual Account'
            WHEN 'credit card'     THEN 'Credit Card'
            WHEN 'e-wallet'        THEN 'E-Wallet'
            WHEN 'ewallet'         THEN 'E-Wallet'
            WHEN 'cod'             THEN 'COD'
            ELSE TRIM(payment_method)
        END AS payment_method,
        LOWER(TRIM(payment_status)) AS payment_status,
        CAST(paid_amount AS BIGINT) AS paid_amount,
        ingested_at,
        ROW_NUMBER() OVER (
            PARTITION BY TRIM(order_id)
            ORDER BY ingested_at DESC, TRIM(payment_id) DESC
        ) AS rn
    FROM bronze.raw_payments
    WHERE order_id IS NOT NULL
      AND TRIM(order_id) <> ''
)
SELECT
    payment_id,
    order_id,
    payment_method,
    payment_status,
    paid_amount
FROM ranked
WHERE rn = 1;
