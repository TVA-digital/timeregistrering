-- Opprett Martin Gustavsen som admin-bruker
-- Kjør i Supabase SQL-editoren
-- Midlertidig passord: Tidrek2025! — endre ved første innlogging

DO $$
DECLARE
  user_id UUID;
BEGIN
  -- Opprett auth-bruker
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    created_at,
    updated_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role
  )
  VALUES (
    gen_random_uuid(),
    'martin.gustavsen@tvaksjonen.no',
    crypt('Tidrek2025!', gen_salt('bf')),
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{}',
    'authenticated',
    'authenticated'
  )
  RETURNING id INTO user_id;

  -- Opprett brukerprofil
  INSERT INTO users (id, employee_number, name, role)
  VALUES (user_id, '001', 'Martin Gustavsen', 'admin');

  RAISE NOTICE 'Bruker opprettet med ID: %', user_id;
END $$;
