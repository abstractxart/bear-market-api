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
 */
export async function registerReferral(
  walletAddress: string,
  referrerCode: string | null
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

  // Verify referrer code exists (if provided)
  if (referrerCode) {
    const referrerQuery = await pool.query(
      'SELECT * FROM referrals WHERE referral_code = $1',
      [referrerCode]
    );

    if (referrerQuery.rows.length === 0) {
      console.warn(`[Referral] Invalid referrer code: ${referrerCode}`);
      // Continue without referrer rather than failing
      referrerCode = null;
    }
  }

  // Insert new referral
  const result = await pool.query(
    `INSERT INTO referrals (wallet_address, referral_code, referred_by_code)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [walletAddress, referralCode, referrerCode]
  );

  const row = result.rows[0];
  console.log(`[Referral] Registered: ${walletAddress} (referred by: ${referrerCode || 'none'})`);

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
 */
export async function getReferrerWallet(traderWallet: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT ref.wallet_address
     FROM referrals trader
     JOIN referrals ref ON ref.referral_code = trader.referred_by_code
     WHERE trader.wallet_address = $1`,
    [traderWallet]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].wallet_address;
}
