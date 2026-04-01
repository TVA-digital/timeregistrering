-- Standard norske fraværskoder
INSERT INTO absence_codes (code, name, description, requires_approval, deducts_flex, deducts_vacation)
VALUES
  ('SYK',  'Egenmelding sykdom',   'Egenmelding ved kortvarig sykdom (maks 3 dager per tilfelle)',         false, false, false),
  ('SYKM', 'Sykemelding',          'Sykemelding fra lege',                                                  true,  false, false),
  ('FERIE','Ferie',                 'Avtalefestet ferie',                                                    true,  false, true),
  ('BARN', 'Sykt barn',            'Permisjon ved sykt barn (maks 10 dager per år)',                         false, false, false),
  ('PERM', 'Permisjon',            'Lønnet eller ulønnet permisjon – avtal med leder',                       true,  false, false),
  ('AVSP', 'Avspasering',          'Avspasering av opparbeidet fleksitid',                                   true,  true,  false),
  ('KURS', 'Kurs/opplæring',       'Deltakelse på kurs, konferanse eller intern opplæring',                 false, false, false),
  ('VELFD','Velferdspermisjon',    'Kort permisjon ved ekstraordinære hendelser (bryllup, begravelse osv.)', true,  false, false);
