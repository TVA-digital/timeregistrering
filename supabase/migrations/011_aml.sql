-- AML-regler (én rad = globale regler for bedriften)
CREATE TABLE aml_rules (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  max_hours_per_day      NUMERIC,
  max_hours_per_week     NUMERIC,
  max_hours_per_year     NUMERIC,
  avg_max_hours_per_day  NUMERIC,
  avg_max_hours_per_week NUMERIC,
  avg_calculation_weeks  INTEGER,
  min_daily_rest_hours   NUMERIC,
  min_weekly_rest_hours  NUMERIC,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE aml_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autentiserte kan lese AML-regler"
  ON aml_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin kan endre AML-regler"
  ON aml_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Regeltype-enum for AML-brudd
CREATE TYPE aml_rule_type AS ENUM
  ('max_day', 'max_week', 'max_year', 'avg_day', 'avg_week', 'rest_daily', 'rest_weekly');

-- AML-brudd (historikk bevares — rader slettes aldri)
CREATE TABLE aml_violations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rule_type    aml_rule_type NOT NULL,
  violated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_start TIMESTAMPTZ NOT NULL,  -- start på det rullerende vinduet
  window_end   TIMESTAMPTZ NOT NULL,  -- slutt på det rullerende vinduet (≈ now())
  actual_value NUMERIC     NOT NULL,  -- beregnet verdi i timer
  limit_value  NUMERIC     NOT NULL,  -- grensen som ble brutt i timer
  notified     BOOLEAN     NOT NULL DEFAULT false
);

ALTER TABLE aml_violations ENABLE ROW LEVEL SECURITY;

-- Ansatt ser egne brudd
CREATE POLICY "Ansatt ser egne AML-brudd"
  ON aml_violations FOR SELECT
  USING (user_id = auth.uid());

-- Leder, fagleder, admin og lønningsansvarlig ser alle brudd
CREATE POLICY "Leder og fagleder ser AML-brudd for sine ansatte"
  ON aml_violations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users me
      WHERE me.id = auth.uid()
        AND me.role IN ('leder', 'fagleder', 'admin', 'lonningsansvarlig')
    )
  );

-- Service role skriver og oppdaterer brudd (brukes fra backend)
CREATE POLICY "Service kan skrive AML-brudd"
  ON aml_violations FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service kan oppdatere AML-brudd"
  ON aml_violations FOR UPDATE
  USING (true);
