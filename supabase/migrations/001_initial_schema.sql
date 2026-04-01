-- Timeregistrering – Initiell databaseskjema
-- Kjør mot nytt Supabase-prosjekt

-- Krev btree_gist for eksklusjonsconstraint på arbeidsplaner
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ============================================================
-- Avdelinger
-- ============================================================
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Brukerprofiler (kobles til auth.users)
-- ============================================================
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_number TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ansatt', 'leder', 'admin', 'lonningsansvarlig')),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Arbeidsplaner
-- ============================================================
CREATE TABLE work_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,  -- NULL = aktiv plan
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Forhindre overlappende arbeidsplaner for samme bruker
  EXCLUDE USING gist (
    user_id WITH =,
    daterange(effective_from, COALESCE(effective_to, '9999-12-31'::DATE), '[)') WITH &&
  )
);

CREATE TABLE work_schedule_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES work_schedules(id) ON DELETE CASCADE,
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6), -- 0=Mandag, 6=Søndag
  hours NUMERIC(4, 2) NOT NULL CHECK (hours >= 0 AND hours <= 24),
  UNIQUE (schedule_id, weekday)
);

-- ============================================================
-- Timeregistreringer (inn/ut-stempling)
-- ============================================================
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,  -- NULL = aktivt innstemplet
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  overtime_data JSONB,  -- Forhåndsberegnet ved godkjenning
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Kun én aktiv innstempeling per bruker (ingen clock_out)
CREATE UNIQUE INDEX idx_time_entries_one_active
  ON time_entries (user_id)
  WHERE clock_out IS NULL;

CREATE INDEX idx_time_entries_user_clock_in
  ON time_entries (user_id, clock_in DESC);

CREATE INDEX idx_time_entries_status
  ON time_entries (status);

-- ============================================================
-- Fraværskoder
-- ============================================================
CREATE TABLE absence_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  requires_approval BOOLEAN NOT NULL DEFAULT true,
  deducts_flex BOOLEAN NOT NULL DEFAULT false,
  deducts_vacation BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Fraværssøknader
-- ============================================================
CREATE TABLE absence_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  absence_code_id UUID NOT NULL REFERENCES absence_codes(id),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  hours_per_day NUMERIC(4, 2),  -- NULL = full dag per arbeidsplan
  comment TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_date_range CHECK (date_to >= date_from)
);

CREATE INDEX idx_absence_requests_user_date
  ON absence_requests (user_id, date_from DESC);

-- ============================================================
-- Overtidsregler
-- ============================================================
CREATE TABLE overtime_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  condition_time_from TIME,      -- F.eks. '17:00' – NULL = ingen tidsbetingelse
  condition_time_to TIME,        -- F.eks. '21:00'
  condition_weekdays SMALLINT[], -- Ukedager: 0=Man..6=Søn, 7=Helligdag. NULL = alle
  condition_hours_over NUMERIC(4, 2), -- Overtid etter X timer/dag
  rate_type TEXT NOT NULL CHECK (rate_type IN ('percent', 'fixed')),
  rate_value NUMERIC(8, 4) NOT NULL, -- 1.5 = 50% tillegg, eller kr/time
  priority SMALLINT NOT NULL DEFAULT 0, -- Lavere verdi = høyere prioritet
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- Fleksitidssaldo og transaksjonslogg
-- ============================================================
CREATE TABLE flex_balance (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE flex_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  time_entry_id UUID REFERENCES time_entries(id) ON DELETE SET NULL,
  absence_request_id UUID REFERENCES absence_requests(id) ON DELETE SET NULL,
  minutes INTEGER NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Maks én kilde per transaksjon
  CONSTRAINT one_source CHECK (
    (time_entry_id IS NOT NULL)::int + (absence_request_id IS NOT NULL)::int <= 1
  )
);

CREATE INDEX idx_flex_transactions_user
  ON flex_transactions (user_id, created_at DESC);

-- ============================================================
-- In-app-varsler
-- ============================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  related_id UUID,
  related_type TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE is_read = false;

-- ============================================================
-- Postgres-funksjon: atomisk fleksitidsoppdatering
-- ============================================================
CREATE OR REPLACE FUNCTION update_flex_balance(
  p_user_id UUID,
  p_delta_minutes INTEGER
) RETURNS void AS $$
BEGIN
  INSERT INTO flex_balance (user_id, balance_minutes)
  VALUES (p_user_id, p_delta_minutes)
  ON CONFLICT (user_id) DO UPDATE
    SET balance_minutes = flex_balance.balance_minutes + p_delta_minutes,
        updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Trigger: oppdater updated_at automatisk
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_time_entries
  BEFORE UPDATE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_absence_requests
  BEFORE UPDATE ON absence_requests
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ============================================================
-- Trigger: opprett flex_balance for ny bruker automatisk
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO flex_balance (user_id, balance_minutes)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_user_created
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
