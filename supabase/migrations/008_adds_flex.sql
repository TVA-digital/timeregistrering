-- Legg til adds_flex-flagg på absence_codes
-- Koder med adds_flex = true betyr at tid brukt med koden teller som tilstedeværelse
-- og legger til fleksitid (i stedet for å trekke fra)
ALTER TABLE absence_codes ADD COLUMN adds_flex BOOLEAN NOT NULL DEFAULT false;
