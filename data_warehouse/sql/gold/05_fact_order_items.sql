-- ============================================================================
-- Gold Layer: Fact Order Items (Order Item Grain)
-- ============================================================================

CREATE OR REPLACE TABLE gold.fact_order_items AS
SELECT
    order_item_id,
    order_id,
    product_id,
    quantity,
    unit_price,
    unit_cost,
    item_gross_amount,
    item_discount_amount,
    item_net_amount
FROM silver.order_items;
