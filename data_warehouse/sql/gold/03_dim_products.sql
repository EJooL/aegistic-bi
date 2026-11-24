-- ============================================================================
-- Gold Layer: Product Dimension
-- ============================================================================

CREATE OR REPLACE TABLE gold.dim_products AS
SELECT
    product_id,
    product_name,
    category_name,
    subcategory_name,
    brand
FROM silver.products;
