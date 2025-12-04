-- BEAR MARKET Referral System Database Schema

-- Referrals table: Stores who referred whom
CREATE TABLE IF NOT EXISTS referrals (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(64) NOT NULL UNIQUE,
  referral_code VARCHAR(16) NOT NULL UNIQUE,
  referred_by_code VARCHAR(16),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_referral_code ON referrals(referral_code);
CREATE INDEX idx_referred_by ON referrals(referred_by_code);

-- Trades table: Records all trades for referral tracking
CREATE TABLE IF NOT EXISTS trades (
  id SERIAL PRIMARY KEY,
  trader_wallet VARCHAR(64) NOT NULL CHECK (trader_wallet ~ '^r[1-9A-HJ-NP-Za-km-z]{24,34}$'),
  input_token VARCHAR(128) NOT NULL,
  output_token VARCHAR(128) NOT NULL,
  input_amount DECIMAL(20, 6) NOT NULL CHECK (input_amount > 0),
  output_amount DECIMAL(20, 6) NOT NULL CHECK (output_amount > 0),
  fee_amount DECIMAL(20, 6) NOT NULL CHECK (fee_amount > 0 AND fee_amount < 1000000),
  fee_token VARCHAR(128) NOT NULL,
  referrer_wallet VARCHAR(64) CHECK (referrer_wallet IS NULL OR referrer_wallet ~ '^r[1-9A-HJ-NP-Za-km-z]{24,34}$'),
  referrer_payout_amount DECIMAL(20, 6) CHECK (referrer_payout_amount IS NULL OR referrer_payout_amount >= 0),
  swap_tx_hash VARCHAR(128) NOT NULL UNIQUE,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trader_wallet ON trades(trader_wallet);
CREATE INDEX idx_referrer_wallet ON trades(referrer_wallet);
CREATE INDEX idx_created_at ON trades(created_at);
CREATE INDEX idx_swap_tx_hash ON trades(swap_tx_hash);

-- Payouts table: Tracks automatic payouts to referrers
CREATE TABLE IF NOT EXISTS payouts (
  id SERIAL PRIMARY KEY,
  trade_id INTEGER UNIQUE NOT NULL REFERENCES trades(id),
  referrer_wallet VARCHAR(64) NOT NULL CHECK (referrer_wallet ~ '^r[1-9A-HJ-NP-Za-km-z]{24,34}$'),
  amount DECIMAL(20, 6) NOT NULL CHECK (amount > 0 AND amount < 1000000),
  token VARCHAR(128) NOT NULL,
  tx_hash VARCHAR(128) UNIQUE,
  status VARCHAR(32) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_payout_referrer ON payouts(referrer_wallet);
CREATE INDEX idx_payout_status ON payouts(status);
CREATE INDEX idx_payout_trade ON payouts(trade_id);

-- Rate limiting table
CREATE TABLE IF NOT EXISTS rate_limits (
  id SERIAL PRIMARY KEY,
  identifier VARCHAR(128) NOT NULL,
  endpoint VARCHAR(128) NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(identifier, endpoint)
);

CREATE INDEX idx_rate_limit_lookup ON rate_limits(identifier, endpoint, window_start);

-- Stats view for easy querying
CREATE OR REPLACE VIEW referral_stats AS
SELECT
  r.wallet_address,
  r.referral_code,
  COUNT(DISTINCT t.id) as total_referrals,
  COALESCE(SUM(p.amount), 0) as total_earned,
  COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END), 0) as pending_payouts
FROM referrals r
LEFT JOIN referrals referred ON referred.referred_by_code = r.referral_code
LEFT JOIN trades t ON t.trader_wallet = referred.wallet_address
LEFT JOIN payouts p ON p.trade_id = t.id AND p.status = 'completed'
GROUP BY r.wallet_address, r.referral_code;
