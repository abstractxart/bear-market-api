import pool from '../db';

export interface ReferralData {
  walletAddress: string;
  referralCode: string;
  referredByCode: string | null;
  createdAt: Date;
}

export interface ReferralStats {
  totalReferrals: number;
  totalEarned: string;
  pendingPayouts: string;
}

/**
 * Generate referral code from wallet address
 * Same format as frontend: first 6 + last 4 characters
 */
export function generateReferralCode(walletAddress: string): string {
  const first = walletAddress.substring(0, 6).toUpperCase();
  const last = walletAddress.substring(walletAddress.length - 4).toUpperCase();
  return `${first}${last}`;
}

/**
 * Register a new referral relationship
 *
 * @param walletAddress - The wallet address to register
 * @param referrerCode - The referral code of who referred this wallet (optional)
 * @param verified - Whether this registration has signature verification (default: false)
 */
export async function registerReferral(
  walletAddress: string,
  referrerCode: string | null,
  verified: boolean = false
): Promise<ReferralData> {
  const referralCode = generateReferralCode(walletAddress);

  // Prevent self-referral
  if (referrerCode && referrerCode === referralCode) {
    throw new Error('Self-referral not allowed');
  }

  // Check if wallet already registered
  const existingQuery = await pool.query(
    'SELECT * FROM referrals WHERE wallet_address = $1',
    [walletAddress]
  );

  if (existingQuery.rows.length > 0) {
    // Already registered, return existing data
    const row = existingQuery.rows[0];
    return {
      walletAddress: row.wallet_address,
      referralCode: row.referral_code,
      referredByCode: row.referred_by_code,
      createdAt: row.created_at,
    };
  }

  // Accept referrer code even if referrer hasn't registered yet
  // The referral code format is: first 6 chars + last 4 chars of wallet address
  // This allows referrers to share codes before connecting their wallet
  // Payout service will resolve the actual wallet address when needed
  if (referrerCode) {
    console.log(`[Referral] Accepting referrer code: ${referrerCode} (will resolve at payout time)`);
  }

  // Insert new referral with verified flag
  const result = await pool.query(
    `INSERT INTO referrals (wallet_address, referral_code, referred_by_code, verified)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [walletAddress, referralCode, referrerCode, verified]
  );

  const row = result.rows[0];
  const verifiedStatus = verified ? '✓ VERIFIED' : 'unverified';
  console.log(`[Referral] Registered [${verifiedStatus}]: ${walletAddress} (referred by: ${referrerCode || 'none'})`);

  return {
    walletAddress: row.wallet_address,
    referralCode: row.referral_code,
    referredByCode: row.referred_by_code,
    createdAt: row.created_at,
  };
}

/**
 * Get referral data for a wallet
 */
export async function getReferralData(walletAddress: string): Promise<ReferralData | null> {
  const result = await pool.query(
    'SELECT * FROM referrals WHERE wallet_address = $1',
    [walletAddress]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    walletAddress: row.wallet_address,
    referralCode: row.referral_code,
    referredByCode: row.referred_by_code,
    createdAt: row.created_at,
  };
}

/**
 * Get referral stats for a wallet
 */
export async function getReferralStats(walletAddress: string): Promise<ReferralStats> {
  const result = await pool.query(
    `SELECT
      COUNT(DISTINCT t.id) as total_referrals,
      COALESCE(SUM(CASE WHEN p.status = 'completed' THEN p.amount ELSE 0 END), 0) as total_earned,
      COALESCE(SUM(CASE WHEN p.status = 'pending' THEN p.amount ELSE 0 END), 0) as pending_payouts
    FROM referrals r
    LEFT JOIN referrals referred ON referred.referred_by_code = r.referral_code
    LEFT JOIN trades t ON t.trader_wallet = referred.wallet_address
    LEFT JOIN payouts p ON p.trade_id = t.id
    WHERE r.wallet_address = $1
    GROUP BY r.wallet_address`,
    [walletAddress]
  );

  if (result.rows.length === 0) {
    return {
      totalReferrals: 0,
      totalEarned: '0',
      pendingPayouts: '0',
    };
  }

  const row = result.rows[0];
  return {
    totalReferrals: parseInt(row.total_referrals) || 0,
    totalEarned: parseFloat(row.total_earned || '0').toFixed(6),
    pendingPayouts: parseFloat(row.pending_payouts || '0').toFixed(6),
  };
}

/**
 * Get referrer wallet address for a trader
 * Returns wallet only if referrer has registered
 */
export async function getReferrerWallet(traderWallet: string): Promise<string | null> {
  // Look up trader's referred_by_code and find matching registered wallet
  const result = await pool.query(
    `SELECT ref.wallet_address
     FROM referrals trader
     JOIN referrals ref ON ref.referral_code = trader.referred_by_code
     WHERE trader.wallet_address = $1`,
    [traderWallet]
  );

  if (result.rows.length === 0) {
    // Referrer hasn't registered yet - no payout
    console.log(`[Referral] No registered referrer found for trader ${traderWallet}`);
    return null;
  }

  return result.rows[0].wallet_address;
}
