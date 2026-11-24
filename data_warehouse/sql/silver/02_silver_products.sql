-- ============================================================================
-- Silver Layer: Cleaned & Deduplicated Products
-- ============================================================================

CREATE OR REPLACE TABLE silver.products AS
WITH ranked AS (
    SELECT
        TRIM(product_id) AS product_id,
        TRIM(product_name) AS product_name,
        TRIM(category_name) AS category_name,
        TRIM(subcategory_name) AS subcategory_name,
        TRIM(brand) AS brand,
        CAST(unit_price AS BIGINT) AS unit_price,
        CAST(unit_cost AS BIGINT) AS unit_cost,
        ingested_at,
        ROW_NUMBER() OVER (
            PARTITION BY TRIM(product_id)
            ORDER BY ingested_at DESC
        ) AS rn
    FROM bronze.raw_products
    WHERE product_id IS NOT NULL
      AND TRIM(product_id) <> ''
      AND unit_price > 0
      AND unit_cost >= 0
)
SELECT
    product_id,
    product_name,
    category_name,
    subcategory_name,
    brand,
    unit_price,
    unit_cost
FROM ranked
WHERE rn = 1;
