-- Migrasjon 009: Grupper og fagleder-rolle

-- 1. Ny gruppe-tabell (hierarkinivå under avdeling)
CREATE TABLE groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Ny group_id FK på brukere
ALTER TABLE users ADD COLUMN group_id UUID REFERENCES groups(id) ON DELETE SET NULL;

-- 3. Oppdater rolle-constraint med fagleder
ALTER TABLE users DROP CONSTRAINT users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('ansatt', 'leder', 'admin', 'lonningsansvarlig', 'fagleder'));

-- 4. RLS for groups
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Alle autentiserte kan se grupper"
  ON groups FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admin kan opprette grupper"
  ON groups FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin kan oppdatere grupper"
  ON groups FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admin kan slette grupper"
  ON groups FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
