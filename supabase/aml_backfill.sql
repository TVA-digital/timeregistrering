-- =============================================================
-- AML-backfill: sjekk historiske stemplinger mot alle regler
--
-- Script 1: Forhåndsvisning — ingen endringer i databasen
-- Script 2: Sett inn brudd i aml_violations
--
-- Regler:
--   max_day     : enkelt innslag > maks timer/dag
--   max_week    : verste rullerende 7-dagers sum > maks timer/uke
--   max_year    : siste 365 dager sum > maks timer/år
--   avg_day     : snitt t/dag (Man–Fre) i beregningsvindu > grense
--   avg_week    : snitt t/uke i beregningsvindu > grense
--   rest_daily  : pause mellom clock_out og neste clock_in < min hviletid
--   rest_weekly : lengste sammenhengende hvile i ISO-uke < min ukehvile
--
-- Merk: Helligdager ekskluderes ikke fra arbeidsdagtellingen
-- (kun helger) i avg_day. Gir marginal underestimering av snittet.
-- =============================================================


-- =============================================================
-- SCRIPT 1 — Forhåndsvisning (kjør dette først)
-- =============================================================

WITH rule AS (
  SELECT * FROM aml_rules LIMIT 1
),

-- ── avg_day / avg_week – felles grunnlag ─────────────────────
avg_window AS (
  SELECT
    now() - (r.avg_calculation_weeks * 7 || ' days')::INTERVAL AS window_start,
    now()                                                        AS window_end,
    r.avg_calculation_weeks,
    r.avg_max_hours_per_day,
    r.avg_max_hours_per_week
  FROM rule r
  WHERE r.avg_calculation_weeks IS NOT NULL
),
avg_workdays AS (
  SELECT COUNT(*)::int AS days
  FROM avg_window wb,
    generate_series(wb.window_start::date, wb.window_end::date, '1 day') AS d
  WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
),
avg_user_hours AS (
  SELECT
    u.id   AS user_id,
    u.name AS user_name,
    COALESCE(
      SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0), 0
    ) AS total_hours
  FROM users u
  LEFT JOIN time_entries te
    ON  te.user_id   = u.id
    AND te.status    = 'approved'
    AND te.clock_out IS NOT NULL
    AND te.clock_in >= (SELECT window_start FROM avg_window)
    AND te.clock_in <= (SELECT window_end   FROM avg_window)
  WHERE u.is_active = true
  GROUP BY u.id, u.name
),

-- ── max_day ──────────────────────────────────────────────────
max_day_violations AS (
  SELECT
    u.name                                                         AS user_name,
    'max_day'                                                      AS rule_type,
    te.clock_in::date::text                                        AS period,
    ROUND((EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0)::numeric, 2)
                                                                   AS actual_value,
    r.max_hours_per_day                                            AS limit_value
  FROM rule r, time_entries te
  JOIN users u ON u.id = te.user_id
  WHERE r.max_hours_per_day IS NOT NULL
    AND te.status    = 'approved'
    AND te.clock_out IS NOT NULL
    AND u.is_active  = true
    AND (EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0) > r.max_hours_per_day
),

-- ── max_week (verste rullerende 7-dagers vindu per bruker) ───
max_week_windows AS (
  SELECT
    te.user_id,
    te.clock_in::date                                              AS win_start,
    (te.clock_in::date + 6)                                        AS win_end,
    SUM(EXTRACT(EPOCH FROM (te2.clock_out - te2.clock_in)) / 3600.0)
                                                                   AS total_hours
  FROM time_entries te
  JOIN time_entries te2
    ON  te2.user_id   = te.user_id
    AND te2.status    = 'approved'
    AND te2.clock_out IS NOT NULL
    AND te2.clock_in::date BETWEEN te.clock_in::date AND (te.clock_in::date + 6)
  WHERE te.status    = 'approved'
    AND te.clock_out IS NOT NULL
  GROUP BY te.user_id, te.clock_in::date
),
max_week_worst AS (
  SELECT DISTINCT ON (mw.user_id)
    mw.user_id,
    mw.win_start,
    mw.win_end,
    mw.total_hours
  FROM max_week_windows mw
  ORDER BY mw.user_id, mw.total_hours DESC
),
max_week_violations AS (
  SELECT
    u.name                                                         AS user_name,
    'max_week'                                                     AS rule_type,
    mw.win_start::text || ' – ' || mw.win_end::text               AS period,
    ROUND(mw.total_hours::numeric, 2)                              AS actual_value,
    r.max_hours_per_week                                           AS limit_value
  FROM rule r, max_week_worst mw
  JOIN users u ON u.id = mw.user_id
  WHERE r.max_hours_per_week IS NOT NULL
    AND u.is_active = true
    AND mw.total_hours > r.max_hours_per_week
),

-- ── max_year (siste 365 dager) ────────────────────────────────
max_year_violations AS (
  SELECT
    u.name                                                         AS user_name,
    'max_year'                                                     AS rule_type,
    'siste 365 dager'                                              AS period,
    ROUND(
      COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0), 0)::numeric,
      2
    )                                                              AS actual_value,
    r.max_hours_per_year                                           AS limit_value
  FROM rule r
  CROSS JOIN users u
  LEFT JOIN time_entries te
    ON  te.user_id   = u.id
    AND te.status    = 'approved'
    AND te.clock_out IS NOT NULL
    AND te.clock_in >= now() - INTERVAL '365 days'
  WHERE r.max_hours_per_year IS NOT NULL
    AND u.is_active = true
  GROUP BY u.name, r.max_hours_per_year
  HAVING COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0), 0) > r.max_hours_per_year
),

-- ── avg_day / avg_week ────────────────────────────────────────
avg_violations AS (
  SELECT
    uh.user_name,
    'avg_day'                                                      AS rule_type,
    'vindu ' || (SELECT avg_calculation_weeks FROM avg_window) || ' uker' AS period,
    CASE WHEN wd.days > 0
      THEN ROUND((uh.total_hours / wd.days)::numeric, 2)
    END                                                            AS actual_value,
    (SELECT avg_max_hours_per_day FROM avg_window)                 AS limit_value
  FROM avg_user_hours uh, avg_workdays wd
  WHERE uh.total_hours > 0
    AND (SELECT avg_max_hours_per_day FROM avg_window) IS NOT NULL
    AND wd.days > 0
    AND (uh.total_hours / wd.days) > (SELECT avg_max_hours_per_day FROM avg_window)

  UNION ALL

  SELECT
    uh.user_name,
    'avg_week'                                                     AS rule_type,
    'vindu ' || (SELECT avg_calculation_weeks FROM avg_window) || ' uker' AS period,
    ROUND((uh.total_hours / NULLIF((SELECT avg_calculation_weeks FROM avg_window), 0))::numeric, 2)
                                                                   AS actual_value,
    (SELECT avg_max_hours_per_week FROM avg_window)                AS limit_value
  FROM avg_user_hours uh
  WHERE uh.total_hours > 0
    AND (SELECT avg_max_hours_per_week FROM avg_window) IS NOT NULL
    AND (uh.total_hours / NULLIF((SELECT avg_calculation_weeks FROM avg_window), 0))
        > (SELECT avg_max_hours_per_week FROM avg_window)
),

-- ── rest_daily (pause mellom clock_out og neste clock_in) ────
rest_daily_gaps AS (
  SELECT
    te.user_id,
    te.clock_out,
    LEAD(te.clock_in) OVER (PARTITION BY te.user_id ORDER BY te.clock_in) AS next_clock_in,
    EXTRACT(EPOCH FROM (
      LEAD(te.clock_in) OVER (PARTITION BY te.user_id ORDER BY te.clock_in) - te.clock_out
    )) / 3600.0                                                    AS rest_hours
  FROM time_entries te
  WHERE te.status    = 'approved'
    AND te.clock_out IS NOT NULL
),
rest_daily_violations AS (
  SELECT
    u.name                                                         AS user_name,
    'rest_daily'                                                   AS rule_type,
    rdg.clock_out::date::text                                      AS period,
    ROUND(rdg.rest_hours::numeric, 2)                              AS actual_value,
    r.min_daily_rest_hours                                         AS limit_value
  FROM rule r, rest_daily_gaps rdg
  JOIN users u ON u.id = rdg.user_id
  WHERE r.min_daily_rest_hours IS NOT NULL
    AND u.is_active   = true
    AND rdg.rest_hours IS NOT NULL
    AND rdg.rest_hours > 0      -- utelukker negative (overlappende)
    AND rdg.rest_hours < r.min_daily_rest_hours
),

-- ── rest_weekly (lengste hvile i ISO-uke) ─────────────────────
-- Bygger alle "hvileintervaller" i uken:
--   1. Mandag 00:00 → første clock_in
--   2. clock_out → neste clock_in (innad i uken)
--   3. siste clock_out → søndag 24:00
-- Tar lengste sammenhengende hvile per bruker per uke.
rest_weekly_gaps AS (
  -- gap mellom stemplinger innen uken
  SELECT
    te.user_id,
    DATE_TRUNC('week', te.clock_in)                                AS iso_week,
    te.clock_out                                                   AS gap_start,
    LEAD(te.clock_in) OVER (PARTITION BY te.user_id, DATE_TRUNC('week', te.clock_in) ORDER BY te.clock_in)
                                                                   AS gap_end
  FROM time_entries te
  WHERE te.status    = 'approved'
    AND te.clock_out IS NOT NULL

  UNION ALL

  -- gap fra mandag 00:00 til første stempling i uken
  SELECT
    te.user_id,
    DATE_TRUNC('week', te.clock_in)                                AS iso_week,
    DATE_TRUNC('week', te.clock_in)                                AS gap_start,
    MIN(te.clock_in) OVER (PARTITION BY te.user_id, DATE_TRUNC('week', te.clock_in))
                                                                   AS gap_end
  FROM time_entries te
  WHERE te.status    = 'approved'
    AND te.clock_out IS NOT NULL

  UNION ALL

  -- gap fra siste stempling til søndag 24:00
  SELECT
    te.user_id,
    DATE_TRUNC('week', te.clock_in)                                AS iso_week,
    MAX(te.clock_out) OVER (PARTITION BY te.user_id, DATE_TRUNC('week', te.clock_in))
                                                                   AS gap_start,
    DATE_TRUNC('week', te.clock_in) + INTERVAL '7 days'           AS gap_end
  FROM time_entries te
  WHERE te.status    = 'approved'
    AND te.clock_out IS NOT NULL
),
rest_weekly_max AS (
  SELECT
    user_id,
    iso_week,
    MAX(EXTRACT(EPOCH FROM (gap_end - gap_start)) / 3600.0)        AS max_rest_hours
  FROM rest_weekly_gaps
  WHERE gap_end > gap_start
  GROUP BY user_id, iso_week
),
rest_weekly_violations AS (
  SELECT
    u.name                                                         AS user_name,
    'rest_weekly'                                                  AS rule_type,
    rwm.iso_week::date::text                                       AS period,
    ROUND(rwm.max_rest_hours::numeric, 2)                          AS actual_value,
    r.min_weekly_rest_hours                                        AS limit_value
  FROM rule r, rest_weekly_max rwm
  JOIN users u ON u.id = rwm.user_id
  WHERE r.min_weekly_rest_hours IS NOT NULL
    AND u.is_active          = true
    AND rwm.max_rest_hours   < r.min_weekly_rest_hours
),

-- ── Samle alle potensielle brudd ─────────────────────────────
all_violations AS (
  SELECT user_name, rule_type, period, actual_value, limit_value FROM max_day_violations
  UNION ALL
  SELECT user_name, rule_type, period, actual_value, limit_value FROM max_week_violations
  UNION ALL
  SELECT user_name, rule_type, period, actual_value, limit_value FROM max_year_violations
  UNION ALL
  SELECT user_name, rule_type, period, actual_value, limit_value FROM avg_violations
  UNION ALL
  SELECT user_name, rule_type, period, actual_value, limit_value FROM rest_daily_violations
  UNION ALL
  SELECT user_name, rule_type, period, actual_value, limit_value FROM rest_weekly_violations
)
SELECT
  user_name      AS "Ansatt",
  rule_type      AS "Regeltype",
  period         AS "Periode",
  actual_value   AS "Faktisk verdi (t)",
  limit_value    AS "Grense (t)",
  CASE
    WHEN rule_type IN ('rest_daily','rest_weekly') THEN
      CASE WHEN actual_value < limit_value THEN '⚠ BRUDD' ELSE 'OK' END
    ELSE
      CASE WHEN actual_value > limit_value THEN '⚠ BRUDD' ELSE 'OK' END
  END            AS "Status"
FROM all_violations
ORDER BY
  CASE rule_type
    WHEN 'max_day'     THEN 1
    WHEN 'max_week'    THEN 2
    WHEN 'max_year'    THEN 3
    WHEN 'avg_day'     THEN 4
    WHEN 'avg_week'    THEN 5
    WHEN 'rest_daily'  THEN 6
    WHEN 'rest_weekly' THEN 7
  END,
  user_name;


-- =============================================================
-- SCRIPT 2 — Sett inn brudd (kjør etter at Script 1 ser riktig ut)
-- =============================================================

WITH rule AS (
  SELECT * FROM aml_rules LIMIT 1
),

-- ── avg_day / avg_week – felles grunnlag ─────────────────────
avg_window AS (
  SELECT
    now() - (r.avg_calculation_weeks * 7 || ' days')::INTERVAL AS window_start,
    now()                                                        AS window_end,
    r.avg_calculation_weeks,
    r.avg_max_hours_per_day,
    r.avg_max_hours_per_week
  FROM rule r
  WHERE r.avg_calculation_weeks IS NOT NULL
),
avg_workdays AS (
  SELECT COUNT(*)::int AS days
  FROM avg_window wb,
    generate_series(wb.window_start::date, wb.window_end::date, '1 day') AS d
  WHERE EXTRACT(DOW FROM d) NOT IN (0, 6)
),
avg_user_hours AS (
  SELECT
    u.id AS user_id,
    COALESCE(
      SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0), 0
    ) AS total_hours
  FROM users u
  LEFT JOIN time_entries te
    ON  te.user_id   = u.id
    AND te.status    = 'approved'
    AND te.clock_out IS NOT NULL
    AND te.clock_in >= (SELECT window_start FROM avg_window)
    AND te.clock_in <= (SELECT window_end   FROM avg_window)
  WHERE u.is_active = true
  GROUP BY u.id
),

-- ── max_day ──────────────────────────────────────────────────
new_max_day AS (
  SELECT
    te.user_id,
    'max_day'::aml_rule_type                                       AS rule_type,
    te.clock_in                                                    AS window_start,
    te.clock_out                                                   AS window_end,
    ROUND((EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0)::numeric, 2)
                                                                   AS actual_value,
    r.max_hours_per_day                                            AS limit_value
  FROM rule r, time_entries te
  JOIN users u ON u.id = te.user_id
  WHERE r.max_hours_per_day IS NOT NULL
    AND te.status    = 'approved'
    AND te.clock_out IS NOT NULL
    AND u.is_active  = true
    AND (EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0) > r.max_hours_per_day
    AND NOT EXISTS (
      SELECT 1 FROM aml_violations v
      WHERE v.user_id   = te.user_id
        AND v.rule_type = 'max_day'
        AND v.violated_at >= now() - INTERVAL '30 days'
    )
),

-- ── max_week ──────────────────────────────────────────────────
max_week_windows AS (
  SELECT
    te.user_id,
    te.clock_in::date                                              AS win_start,
    (te.clock_in::date + 6)                                        AS win_end,
    SUM(EXTRACT(EPOCH FROM (te2.clock_out - te2.clock_in)) / 3600.0)
                                                                   AS total_hours
  FROM time_entries te
  JOIN time_entries te2
    ON  te2.user_id   = te.user_id
    AND te2.status    = 'approved'
    AND te2.clock_out IS NOT NULL
    AND te2.clock_in::date BETWEEN te.clock_in::date AND (te.clock_in::date + 6)
  WHERE te.status    = 'approved'
    AND te.clock_out IS NOT NULL
  GROUP BY te.user_id, te.clock_in::date
),
max_week_worst AS (
  SELECT DISTINCT ON (mw.user_id)
    mw.user_id,
    mw.win_start,
    mw.win_end,
    mw.total_hours
  FROM max_week_windows mw
  ORDER BY mw.user_id, mw.total_hours DESC
),
new_max_week AS (
  SELECT
    mw.user_id,
    'max_week'::aml_rule_type                                      AS rule_type,
    mw.win_start::timestamptz                                      AS window_start,
    (mw.win_end::timestamptz + INTERVAL '1 day - 1 second')        AS window_end,
    ROUND(mw.total_hours::numeric, 2)                              AS actual_value,
    r.max_hours_per_week                                           AS limit_value
  FROM rule r, max_week_worst mw
  JOIN users u ON u.id = mw.user_id
  WHERE r.max_hours_per_week IS NOT NULL
    AND u.is_active      = true
    AND mw.total_hours   > r.max_hours_per_week
    AND NOT EXISTS (
      SELECT 1 FROM aml_violations v
      WHERE v.user_id   = mw.user_id
        AND v.rule_type = 'max_week'
        AND v.violated_at >= now() - INTERVAL '30 days'
    )
),

-- ── max_year ──────────────────────────────────────────────────
new_max_year AS (
  SELECT
    u.id                                                           AS user_id,
    'max_year'::aml_rule_type                                      AS rule_type,
    (now() - INTERVAL '365 days')                                  AS window_start,
    now()                                                          AS window_end,
    ROUND(
      COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0), 0)::numeric,
      2
    )                                                              AS actual_value,
    r.max_hours_per_year                                           AS limit_value
  FROM rule r
  CROSS JOIN users u
  LEFT JOIN time_entries te
    ON  te.user_id   = u.id
    AND te.status    = 'approved'
    AND te.clock_out IS NOT NULL
    AND te.clock_in >= now() - INTERVAL '365 days'
  WHERE r.max_hours_per_year IS NOT NULL
    AND u.is_active = true
  GROUP BY u.id, r.max_hours_per_year
  HAVING COALESCE(SUM(EXTRACT(EPOCH FROM (te.clock_out - te.clock_in)) / 3600.0), 0) > r.max_hours_per_year
    AND NOT EXISTS (
      SELECT 1 FROM aml_violations v
      WHERE v.user_id   = u.id
        AND v.rule_type = 'max_year'
        AND v.violated_at >= now() - INTERVAL '30 days'
    )
),

-- ── avg_day ───────────────────────────────────────────────────
new_avg_day AS (
  SELECT
    uh.user_id,
    'avg_day'::aml_rule_type                                       AS rule_type,
    (SELECT window_start FROM avg_window)                          AS window_start,
    (SELECT window_end   FROM avg_window)                          AS window_end,
    CASE WHEN (SELECT days FROM avg_workdays) > 0
      THEN ROUND((uh.total_hours / (SELECT days FROM avg_workdays))::numeric, 2)
    END                                                            AS actual_value,
    (SELECT avg_max_hours_per_day FROM avg_window)                 AS limit_value
  FROM avg_user_hours uh
  WHERE uh.total_hours > 0
    AND (SELECT avg_max_hours_per_day FROM avg_window) IS NOT NULL
    AND (SELECT days FROM avg_workdays) > 0
    AND (uh.total_hours / (SELECT days FROM avg_workdays))
        > (SELECT avg_max_hours_per_day FROM avg_window)
    AND NOT EXISTS (
      SELECT 1 FROM aml_violations v
      WHERE v.user_id   = uh.user_id
        AND v.rule_type = 'avg_day'
        AND v.violated_at >= now() - INTERVAL '30 days'
    )
),

-- ── avg_week ──────────────────────────────────────────────────
new_avg_week AS (
  SELECT
    uh.user_id,
    'avg_week'::aml_rule_type                                      AS rule_type,
    (SELECT window_start FROM avg_window)                          AS window_start,
    (SELECT window_end   FROM avg_window)                          AS window_end,
    ROUND((uh.total_hours / NULLIF((SELECT avg_calculation_weeks FROM avg_window), 0))::numeric, 2)
                                                                   AS actual_value,
    (SELECT avg_max_hours_per_week FROM avg_window)                AS limit_value
  FROM avg_user_hours uh
  WHERE uh.total_hours > 0
    AND (SELECT avg_max_hours_per_week FROM avg_window) IS NOT NULL
    AND (uh.total_hours / NULLIF((SELECT avg_calculation_weeks FROM avg_window), 0))
        > (SELECT avg_max_hours_per_week FROM avg_window)
    AND NOT EXISTS (
      SELECT 1 FROM aml_violations v
      WHERE v.user_id   = uh.user_id
        AND v.rule_type = 'avg_week'
        AND v.violated_at >= now() - INTERVAL '30 days'
    )
),

-- ── rest_daily ────────────────────────────────────────────────
rest_daily_gaps AS (
  SELECT
    te.user_id,
    te.clock_out                                                   AS gap_start,
    LEAD(te.clock_in) OVER (PARTITION BY te.user_id ORDER BY te.clock_in)
                                                                   AS gap_end,
    EXTRACT(EPOCH FROM (
      LEAD(te.clock_in) OVER (PARTITION BY te.user_id ORDER BY te.clock_in) - te.clock_out
    )) / 3600.0                                                    AS rest_hours
  FROM time_entries te
  WHERE te.status    = 'approved'
    AND te.clock_out IS NOT NULL
),
new_rest_daily AS (
  SELECT DISTINCT ON (rdg.user_id)
    rdg.user_id,
    'rest_daily'::aml_rule_type                                    AS rule_type,
    rdg.gap_start                                                  AS window_start,
    rdg.gap_end                                                    AS window_end,
    ROUND(rdg.rest_hours::numeric, 2)                              AS actual_value,
    r.min_daily_rest_hours                                         AS limit_value
  FROM rule r, rest_daily_gaps rdg
  JOIN users u ON u.id = rdg.user_id
  WHERE r.min_daily_rest_hours IS NOT NULL
    AND u.is_active    = true
    AND rdg.rest_hours IS NOT NULL
    AND rdg.rest_hours > 0
    AND rdg.rest_hours < r.min_daily_rest_hours
    AND NOT EXISTS (
      SELECT 1 FROM aml_violations v
      WHERE v.user_id   = rdg.user_id
        AND v.rule_type = 'rest_daily'
        AND v.violated_at >= now() - INTERVAL '30 days'
    )
  ORDER BY rdg.user_id, rdg.rest_hours ASC  -- verste (korteste) hvile
),

-- ── rest_weekly ───────────────────────────────────────────────
rest_weekly_gaps AS (
  SELECT
    te.user_id,
    DATE_TRUNC('week', te.clock_in)                                AS iso_week,
    te.clock_out                                                   AS gap_start,
    LEAD(te.clock_in) OVER (PARTITION BY te.user_id, DATE_TRUNC('week', te.clock_in) ORDER BY te.clock_in)
                                                                   AS gap_end
  FROM time_entries te
  WHERE te.status = 'approved' AND te.clock_out IS NOT NULL

  UNION ALL

  SELECT
    te.user_id,
    DATE_TRUNC('week', te.clock_in)                                AS iso_week,
    DATE_TRUNC('week', te.clock_in)                                AS gap_start,
    MIN(te.clock_in) OVER (PARTITION BY te.user_id, DATE_TRUNC('week', te.clock_in))
                                                                   AS gap_end
  FROM time_entries te
  WHERE te.status = 'approved' AND te.clock_out IS NOT NULL

  UNION ALL

  SELECT
    te.user_id,
    DATE_TRUNC('week', te.clock_in)                                AS iso_week,
    MAX(te.clock_out) OVER (PARTITION BY te.user_id, DATE_TRUNC('week', te.clock_in))
                                                                   AS gap_start,
    DATE_TRUNC('week', te.clock_in) + INTERVAL '7 days'           AS gap_end
  FROM time_entries te
  WHERE te.status = 'approved' AND te.clock_out IS NOT NULL
),
rest_weekly_max AS (
  SELECT
    user_id,
    iso_week,
    MAX(EXTRACT(EPOCH FROM (gap_end - gap_start)) / 3600.0)        AS max_rest_hours
  FROM rest_weekly_gaps
  WHERE gap_end > gap_start
  GROUP BY user_id, iso_week
),
new_rest_weekly AS (
  SELECT DISTINCT ON (rwm.user_id)
    rwm.user_id,
    'rest_weekly'::aml_rule_type                                   AS rule_type,
    rwm.iso_week                                                   AS window_start,
    rwm.iso_week + INTERVAL '7 days'                               AS window_end,
    ROUND(rwm.max_rest_hours::numeric, 2)                          AS actual_value,
    r.min_weekly_rest_hours                                        AS limit_value
  FROM rule r, rest_weekly_max rwm
  JOIN users u ON u.id = rwm.user_id
  WHERE r.min_weekly_rest_hours IS NOT NULL
    AND u.is_active          = true
    AND rwm.max_rest_hours   < r.min_weekly_rest_hours
    AND NOT EXISTS (
      SELECT 1 FROM aml_violations v
      WHERE v.user_id   = rwm.user_id
        AND v.rule_type = 'rest_weekly'
        AND v.violated_at >= now() - INTERVAL '30 days'
    )
  ORDER BY rwm.user_id, rwm.max_rest_hours ASC  -- verste uke
),

-- ── Samle alle nye brudd ──────────────────────────────────────
all_new AS (
  SELECT user_id, rule_type, window_start, window_end, actual_value, limit_value FROM new_max_day
  UNION ALL
  SELECT user_id, rule_type, window_start, window_end, actual_value, limit_value FROM new_max_week
  UNION ALL
  SELECT user_id, rule_type, window_start, window_end, actual_value, limit_value FROM new_max_year
  UNION ALL
  SELECT user_id, rule_type, window_start, window_end, actual_value, limit_value FROM new_avg_day
  UNION ALL
  SELECT user_id, rule_type, window_start, window_end, actual_value, limit_value FROM new_avg_week
  UNION ALL
  SELECT user_id, rule_type, window_start, window_end, actual_value, limit_value FROM new_rest_daily
  UNION ALL
  SELECT user_id, rule_type, window_start, window_end, actual_value, limit_value FROM new_rest_weekly
)
INSERT INTO aml_violations (user_id, rule_type, window_start, window_end, actual_value, limit_value, notified)
SELECT user_id, rule_type, window_start, window_end, actual_value, limit_value, false
FROM all_new
RETURNING
  user_id,
  rule_type,
  actual_value,
  limit_value;
