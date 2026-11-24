-- ============================================================================
-- Gold Layer: Fact Orders (Order Grain)
-- order_rank is computed ONLY over completed orders per customer_id so
-- repeat purchase rate never counts cancelled or refunded orders.
-- ============================================================================

CREATE OR REPLACE TABLE gold.fact_orders AS
WITH completed_ranked AS (
    SELECT
        order_id,
        CAST(
            ROW_NUMBER() OVER (
                PARTITION BY customer_id
                ORDER BY order_date ASC, order_id ASC
            ) AS INTEGER
        ) AS completed_order_rank
    FROM silver.orders
    WHERE order_status = 'completed'
)
SELECT
    o.order_id,
    o.customer_id,
    o.order_date,
    o.order_status,
    o.payment_method,
    o.gross_amount,
    o.discount_amount,
    o.shipping_cost,
    o.net_amount,
    cr.completed_order_rank AS order_rank
FROM silver.orders o
LEFT JOIN completed_ranked cr
    ON o.order_id = cr.order_id;
