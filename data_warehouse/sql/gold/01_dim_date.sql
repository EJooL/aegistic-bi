-- ============================================================================
-- Gold Layer: Calendar Date Dimension (2025-06-01 through 2026-11-24)
-- Includes every calendar day; flags incomplete partial month 2026-11.
-- ============================================================================

CREATE OR REPLACE TABLE gold.dim_date AS
WITH calendar AS (
    SELECT CAST(gs AS DATE) AS date_day
    FROM generate_series(DATE '2025-06-01', DATE '2026-11-24', INTERVAL 1 DAY) AS t(gs)
)
SELECT
    date_day,
    CAST(DATE_TRUNC('week', date_day) AS DATE) AS week_start,
    CAST(DATE_TRUNC('month', date_day) AS DATE) AS month_start,
    CONCAT(
        CAST(EXTRACT(YEAR FROM date_day) AS VARCHAR),
        '-Q',
        CAST(EXTRACT(QUARTER FROM date_day) AS VARCHAR)
    ) AS quarter_label,
    CAST(EXTRACT(YEAR FROM date_day) AS INTEGER) AS year_num,
    CASE
        WHEN CAST(DATE_TRUNC('month', date_day) AS DATE) = DATE '2026-11-01'
            THEN TRUE
        ELSE FALSE
    END AS is_partial_period
FROM calendar
ORDER BY date_day;
