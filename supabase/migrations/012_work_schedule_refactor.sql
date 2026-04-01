-- =============================================================
-- Migrering: Arbeidsplaner som delte maler
--
-- work_schedules mister user_id / effective_from / effective_to
-- og blir rene gjenbrukbare maler.
-- Ny tabell user_schedule_assignments kobler bruker ↔ mal
-- med datoperiode (effective_from / effective_to).
-- =============================================================

-- 1. Opprett tilordningstabell FØR vi fjerner kolonner fra work_schedules
CREATE TABLE user_schedule_assignments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  schedule_id    UUID NOT NULL REFERENCES work_schedules(id) ON DELETE RESTRICT,
  effective_from DATE NOT NULL,
  effective_to   DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  EXCLUDE USING gist (
    user_id WITH =,
    daterange(effective_from, COALESCE(effective_to, '9999-12-31'::DATE), '[)') WITH &&
  )
);

-- 2. Migrer eksisterende tilordninger (én per gammel work_schedule-rad)
INSERT INTO user_schedule_assignments (user_id, schedule_id, effective_from, effective_to, created_at)
SELECT user_id, id, effective_from, effective_to, created_at
FROM work_schedules
WHERE user_id IS NOT NULL;

-- 3. Gjør work_schedules om til rene maler
ALTER TABLE work_schedules DROP COLUMN IF EXISTS user_id;
ALTER TABLE work_schedules DROP COLUMN IF EXISTS effective_from;
ALTER TABLE work_schedules DROP COLUMN IF EXISTS effective_to;

-- 3b. Dedupliser work_schedules etter navn (behold eldste rad per navn)
--     og oppdater tilordninger til å peke på den beholdte raden.
WITH canonical AS (
  SELECT DISTINCT ON (name) id, name
  FROM work_schedules
  ORDER BY name, created_at ASC
),
duplicates AS (
  SELECT ws.id AS dup_id, c.id AS canonical_id
  FROM work_schedules ws
  JOIN canonical c ON c.name = ws.name
  WHERE ws.id != c.id
)
UPDATE user_schedule_assignments usa
SET schedule_id = d.canonical_id
FROM duplicates d
WHERE usa.schedule_id = d.dup_id;

DELETE FROM work_schedules
WHERE id NOT IN (
  SELECT DISTINCT ON (name) id
  FROM work_schedules
  ORDER BY name, created_at ASC
);

-- Unik navngiving for maler (trygt etter deduplisering)
ALTER TABLE work_schedules ADD CONSTRAINT work_schedules_name_key UNIQUE (name);

-- 4. RLS for user_schedule_assignments
ALTER TABLE user_schedule_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ansatt ser egne tilordninger"
  ON user_schedule_assignments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin og leder ser alle tilordninger"
  ON user_schedule_assignments FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
      AND role IN ('admin', 'leder', 'fagleder', 'lonningsansvarlig')
  ));

CREATE POLICY "Admin kan skrive tilordninger"
  ON user_schedule_assignments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
  ));

-- 5. Oppdater work_schedules RLS — alle autentiserte kan lese maler
DROP POLICY IF EXISTS "Autentiserte kan lese arbeidsplaner" ON work_schedules;
CREATE POLICY "Autentiserte kan lese arbeidsplaner"
  ON work_schedules FOR SELECT
  USING (auth.role() = 'authenticated');
