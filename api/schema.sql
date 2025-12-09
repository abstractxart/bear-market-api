-- Token Metadata Table
-- Stores token information, social links, and admin settings

CREATE TABLE IF NOT EXISTS token_metadata (
  id SERIAL PRIMARY KEY,
  currency VARCHAR(40) NOT NULL,
  issuer VARCHAR(35) NOT NULL,

  -- CTO (Community Take Over) Management
  cto_wallet VARCHAR(35),

  -- Social & Media Links
  kick_stream_url TEXT,
  discord_url TEXT,
  twitter_url TEXT,
  telegram_url TEXT,
  website1_url TEXT,
  website2_url TEXT,
  website3_url TEXT,

  -- Token Info
  description TEXT,
  logo_url TEXT,

  -- Audit Trail
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_by VARCHAR(35) NOT NULL,

  -- Unique constraint on currency + issuer
  UNIQUE(currency, issuer)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_token_metadata_lookup ON token_metadata(currency, issuer);

-- Index for CTO wallet lookups
CREATE INDEX IF NOT EXISTS idx_token_metadata_cto ON token_metadata(cto_wallet) WHERE cto_wallet IS NOT NULL;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_token_metadata_updated_at BEFORE UPDATE
  ON token_metadata FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- Insert default $BEAR metadata
INSERT INTO token_metadata (currency, issuer, cto_wallet, updated_by)
VALUES (
  'BEAR',
  'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW',
  'rKkkYMCvC63HEgxjQHmayKADaxYqnsMUkT',
  'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW'
)
ON CONFLICT (currency, issuer) DO NOTHING;
