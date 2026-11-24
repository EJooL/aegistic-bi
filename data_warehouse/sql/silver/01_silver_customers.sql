-- ============================================================================
-- Silver Layer: Cleaned & Deduplicated Customers
-- ============================================================================

CREATE OR REPLACE TABLE silver.customers AS
WITH ranked AS (
    SELECT
        TRIM(customer_id) AS customer_id,
        CASE LOWER(TRIM(customer_segment))
            WHEN 'regular'    THEN 'Regular'
            WHEN 'silver'     THEN 'Silver'
            WHEN 'gold'       THEN 'Gold'
            WHEN 'enterprise' THEN 'Enterprise'
            ELSE TRIM(customer_segment)
        END AS customer_segment,
        TRIM(region) AS region,
        TRIM(city) AS city,
        TRY_CAST(TRIM(signup_date) AS DATE) AS signup_date,
        ingested_at,
        ROW_NUMBER() OVER (
            PARTITION BY TRIM(customer_id)
            ORDER BY ingested_at DESC
        ) AS rn
    FROM bronze.raw_customers
    WHERE customer_id IS NOT NULL
      AND TRIM(customer_id) <> ''
)
SELECT
    customer_id,
    customer_segment,
    region,
    city,
    signup_date
FROM ranked
WHERE rn = 1;
