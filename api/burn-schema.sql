-- Burn Transactions Table
-- Tracks all XRP→LP conversions and LP token burns

CREATE TABLE IF NOT EXISTS burn_transactions (
  id SERIAL PRIMARY KEY,

  -- Action type: 'deposit' (XRP → LP) or 'burn' (LP → blackhole)
  action VARCHAR(10) NOT NULL CHECK (action IN ('deposit', 'burn')),

  -- XRPL transaction hash
  tx_hash VARCHAR(64) NOT NULL UNIQUE,

  -- XRP amount (only for deposits)
  xrp_amount VARCHAR(50),

  -- LP token details
  lp_token_amount VARCHAR(50) NOT NULL,
  lp_token_currency VARCHAR(40) NOT NULL,
  lp_token_issuer VARCHAR(35) NOT NULL,

  -- Timestamp
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Index for fast lookups
  CONSTRAINT unique_tx_hash UNIQUE (tx_hash)
);

-- Index for action type
CREATE INDEX IF NOT EXISTS idx_burn_action ON burn_transactions(action);

-- Index for timestamp (most recent first)
CREATE INDEX IF NOT EXISTS idx_burn_timestamp ON burn_transactions(timestamp DESC);

-- Index for stats queries
CREATE INDEX IF NOT EXISTS idx_burn_stats ON burn_transactions(action, timestamp);
