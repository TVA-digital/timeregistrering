-- Feriesaldo per bruker
CREATE TABLE vacation_balance (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  remaining_days NUMERIC(5,1) NOT NULL DEFAULT 25,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Revisjonslogg for trekk/reverseringer
CREATE TABLE vacation_transactions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  absence_request_id UUID REFERENCES absence_requests(id) ON DELETE SET NULL,
  days               NUMERIC(5,1) NOT NULL,
  description        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Atomisk delta-funksjon (samme mønster som update_flex_balance)
CREATE OR REPLACE FUNCTION update_vacation_balance(
  p_user_id    UUID,
  p_delta_days NUMERIC
) RETURNS void AS $$
  INSERT INTO vacation_balance (user_id, remaining_days)
  VALUES (p_user_id, 25 + p_delta_days)
  ON CONFLICT (user_id) DO UPDATE
    SET remaining_days = vacation_balance.remaining_days + p_delta_days,
        updated_at     = now();
$$ LANGUAGE sql SECURITY DEFINER;

-- Auto-opprett feriesaldo for nye brukere
CREATE OR REPLACE FUNCTION create_vacation_balance_for_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO vacation_balance (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_create_vacation_balance
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_vacation_balance_for_new_user();

-- Seed feriesaldo for eksisterende brukere (standard 25 dager)
INSERT INTO vacation_balance (user_id)
SELECT id FROM users
ON CONFLICT DO NOTHING;

-- RLS — kun service role har tilgang (samme som flex_balance)
ALTER TABLE vacation_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE vacation_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON vacation_balance
  USING (auth.role() = 'service_role');
CREATE POLICY "service role only" ON vacation_transactions
  USING (auth.role() = 'service_role');
