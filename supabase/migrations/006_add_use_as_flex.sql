-- Legg til valg for om ekstra timer skal registreres som fleksitid i stedet for overtid
ALTER TABLE time_entries ADD COLUMN use_as_flex BOOLEAN NOT NULL DEFAULT false;
