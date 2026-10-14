-- Support 3 Sift (1: 01-09, 2: 09-17, 3: 17-01) + 2 Laci
CREATE TABLE IF NOT EXISTS outlet_banks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS shift_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID NOT NULL,
  tanggal DATE NOT NULL,
  sift INT NOT NULL CHECK (sift IN (1,2,3)),
  start_at TIMESTAMPTZ DEFAULT now(),
  end_at TIMESTAMPTZ,
  is_closed BOOLEAN DEFAULT false,
  UNIQUE(outlet_id, tanggal, sift)
);

CREATE TABLE IF NOT EXISTS shift_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_session_id UUID REFERENCES shift_sessions(id) ON DELETE CASCADE,
  balance_type TEXT NOT NULL,
  saldo_awal BIGINT DEFAULT 0,
  saldo_saat_ini BIGINT DEFAULT 0,
  UNIQUE(shift_session_id, balance_type)
);

CREATE TABLE IF NOT EXISTS balance_mutations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_session_id UUID,
  type TEXT NOT NULL,
  from_type TEXT,
  to_type TEXT,
  amount BIGINT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
