-- Standard norske overtidsregler
-- Weekdays: 0=Man, 1=Tir, 2=Ons, 3=Tor, 4=Fre, 5=Lør, 6=Søn, 7=Helligdag
-- rate_type 'percent': rate_value = faktor (1.5 = 50% tillegg), 'fixed' = kr/time

INSERT INTO overtime_rules (name, condition_time_from, condition_time_to, condition_weekdays, condition_hours_over, rate_type, rate_value, priority)
VALUES
  -- Helligdagstillegg (100%) – høyeste prioritet
  ('Helligdagstillegg',
    NULL, NULL,
    ARRAY[7]::SMALLINT[],
    NULL,
    'percent', 2.0,
    1),

  -- Lørdagstillegg (50%)
  ('Lørdagstillegg',
    NULL, NULL,
    ARRAY[5]::SMALLINT[],
    NULL,
    'percent', 1.5,
    2),

  -- Søndagstillegg (100%)
  ('Søndagstillegg',
    NULL, NULL,
    ARRAY[6]::SMALLINT[],
    NULL,
    'percent', 2.0,
    2),

  -- Kveldsarbeid man–fre 17:00–21:00 (50%)
  ('Kveldsarbeid',
    '17:00', '21:00',
    ARRAY[0,1,2,3,4]::SMALLINT[],
    NULL,
    'percent', 1.5,
    3),

  -- Nattarbeid 21:00–06:00 (100%)
  ('Nattarbeid',
    '21:00', '06:00',
    NULL,
    NULL,
    'percent', 2.0,
    4),

  -- Overtid etter 9 timer/dag (40%) – laveste prioritet
  ('Overtid over normaldag',
    NULL, NULL,
    ARRAY[0,1,2,3,4]::SMALLINT[],
    9.0,
    'percent', 1.4,
    5);
