-- Migrasjon 007: Sanntids fraværsperioder (absence_periods)
-- Gjør det mulig å stemple ut til fraværskode midt i arbeidsdagen

-- 1. Ny kolonne på absence_codes: om koden kan brukes ved utstempling
ALTER TABLE absence_codes
  ADD COLUMN allow_clock_out BOOLEAN NOT NULL DEFAULT false;

-- 2. Ny tabell for sanntids fraværsperioder
CREATE TABLE absence_periods (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  absence_code_id  UUID NOT NULL REFERENCES absence_codes(id),
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ,          -- NULL = aktiv fraværsperiode
  flex_minutes     NUMERIC(8,2),         -- beregnet ved avslutning, negativ = trekk
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bare én aktiv fraværsperiode per bruker om gangen
CREATE UNIQUE INDEX absence_periods_active_unique
  ON absence_periods(user_id) WHERE ended_at IS NULL;

-- 3. Ny kolonne på flex_transactions for kobling til absence_period
ALTER TABLE flex_transactions
  ADD COLUMN absence_period_id UUID REFERENCES absence_periods(id) ON DELETE SET NULL;

-- 4. RLS for absence_periods
ALTER TABLE absence_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ansatt kan se egne fraværsperioder"
  ON absence_periods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Ansatt kan opprette egne fraværsperioder"
  ON absence_periods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Ansatt kan oppdatere egne fraværsperioder"
  ON absence_periods FOR UPDATE
  USING (auth.uid() = user_id);
