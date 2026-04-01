-- Row Level Security — forsvarsdybde for alle tabeller
-- Serveren bruker service role (omgår RLS), men disse policiene beskytter
-- direkte klienttilgang via Supabase JS-klient med brukertoken.

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedule_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE overtime_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE flex_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Hjelpefunksjon: hent rollen til innlogget bruker
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_department()
RETURNS UUID AS $$
  SELECT department_id FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- departments: alle kan lese, kun admin kan endre
-- ============================================================
CREATE POLICY "Alle kan lese avdelinger"
  ON departments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admin kan endre avdelinger"
  ON departments FOR ALL
  USING (get_my_role() = 'admin');

-- ============================================================
-- users: brukere ser seg selv; leder ser avdeling; admin ser alle
-- ============================================================
CREATE POLICY "Bruker ser seg selv"
  ON users FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Leder ser sin avdeling"
  ON users FOR SELECT
  USING (
    get_my_role() IN ('leder', 'admin', 'lonningsansvarlig')
  );

CREATE POLICY "Admin kan endre brukere"
  ON users FOR ALL
  USING (get_my_role() = 'admin');

-- ============================================================
-- time_entries: brukere ser egne; leder ser avdeling; admin ser alle
-- ============================================================
CREATE POLICY "Bruker ser egne timer"
  ON time_entries FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Leder ser avdelingens timer"
  ON time_entries FOR SELECT
  USING (
    get_my_role() IN ('leder', 'admin', 'lonningsansvarlig')
  );

CREATE POLICY "Bruker kan opprette egne timer"
  ON time_entries FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Bruker kan oppdatere egne utkast"
  ON time_entries FOR UPDATE
  USING (user_id = auth.uid() AND status = 'draft');

CREATE POLICY "Leder kan godkjenne/avvise timer"
  ON time_entries FOR UPDATE
  USING (get_my_role() IN ('leder', 'admin'));

-- ============================================================
-- absence_codes: alle kan lese aktive; admin kan endre
-- ============================================================
CREATE POLICY "Alle kan lese aktive fraværskoder"
  ON absence_codes FOR SELECT
  USING (is_active = true OR get_my_role() = 'admin');

CREATE POLICY "Admin kan endre fraværskoder"
  ON absence_codes FOR ALL
  USING (get_my_role() = 'admin');

-- ============================================================
-- absence_requests: brukere ser egne; leder/admin ser mer
-- ============================================================
CREATE POLICY "Bruker ser egne fraværssøknader"
  ON absence_requests FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Leder ser avdelingens søknader"
  ON absence_requests FOR SELECT
  USING (get_my_role() IN ('leder', 'admin'));

CREATE POLICY "Bruker kan opprette søknad"
  ON absence_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Leder kan behandle søknader"
  ON absence_requests FOR UPDATE
  USING (get_my_role() IN ('leder', 'admin'));

-- ============================================================
-- overtime_rules: alle kan lese aktive; admin kan endre
-- ============================================================
CREATE POLICY "Alle kan lese aktive overtidsregler"
  ON overtime_rules FOR SELECT
  USING (is_active = true OR get_my_role() = 'admin');

CREATE POLICY "Admin kan endre overtidsregler"
  ON overtime_rules FOR ALL
  USING (get_my_role() = 'admin');

-- ============================================================
-- flex_balance: brukere ser kun sin egen saldo
-- ============================================================
CREATE POLICY "Bruker ser egen fleksaldo"
  ON flex_balance FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Admin ser all fleksaldo"
  ON flex_balance FOR SELECT
  USING (get_my_role() = 'admin');

-- ============================================================
-- flex_transactions: brukere ser egne transaksjoner
-- ============================================================
CREATE POLICY "Bruker ser egne flekstransaksjoner"
  ON flex_transactions FOR SELECT
  USING (user_id = auth.uid());

-- ============================================================
-- notifications: brukere ser og oppdaterer kun sine egne
-- ============================================================
CREATE POLICY "Bruker ser egne varsler"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Bruker kan markere egne varsler som lest"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- ============================================================
-- work_schedules og work_schedule_days
-- ============================================================
CREATE POLICY "Bruker ser egne arbeidsplaner"
  ON work_schedules FOR SELECT
  USING (user_id = auth.uid() OR get_my_role() IN ('admin', 'leder'));

CREATE POLICY "Admin kan endre arbeidsplaner"
  ON work_schedules FOR ALL
  USING (get_my_role() = 'admin');

CREATE POLICY "Alle kan lese plansdager"
  ON work_schedule_days FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM work_schedules ws
      WHERE ws.id = work_schedule_days.schedule_id
        AND (ws.user_id = auth.uid() OR get_my_role() IN ('admin', 'leder'))
    )
  );

CREATE POLICY "Admin kan endre plansdager"
  ON work_schedule_days FOR ALL
  USING (get_my_role() = 'admin');
