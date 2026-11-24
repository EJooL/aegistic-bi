-- ============================================================================
-- Gold Layer: Customer Dimension
-- ============================================================================

CREATE OR REPLACE TABLE gold.dim_customers AS
WITH customer_first_order AS (
    SELECT
        customer_id,
        MIN(order_date) AS first_order_date
    FROM silver.orders
    GROUP BY customer_id
)
SELECT
    c.customer_id,
    c.customer_segment,
    c.region,
    c.city,
    COALESCE(cfo.first_order_date, c.signup_date) AS first_order_date
FROM silver.customers c
LEFT JOIN customer_first_order cfo
    ON c.customer_id = cfo.customer_id;
