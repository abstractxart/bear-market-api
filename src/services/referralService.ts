/**
 * Referral System Service
 *
 * Phase 1: Client-side tracking with manual claim
 * - Captures referral codes from URL
 * - Stores relationships in localStorage
 * - Generates unique referral codes
 */

const REFERRAL_STORAGE_KEY = 'bear_market_referral';
const REFERRER_STORAGE_KEY = 'bear_market_referrer';

export interface ReferralData {
  referralCode: string;      // User's own referral code
  referredBy: string | null; // Wallet address of who referred them
  referralLink: string;       // Full referral link to share
  timestamp: number;          // When the referral was recorded
}

/**
 * Generate a unique referral code from wallet address
 */
export function generateReferralCode(walletAddress: string): string {
  // Use first 6 chars of wallet + last 4 chars for uniqueness
  const first = walletAddress.substring(0, 6).toUpperCase();
  const last = walletAddress.substring(walletAddress.length - 4).toUpperCase();
  return `${first}${last}`;
}

/**
 * Get referral code from URL parameters
 */
export function getReferralCodeFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('ref');
}

/**
 * Store referral code in localStorage (before wallet connection)
 */
export function storeReferralCode(code: string): void {
  if (code && code.length > 0) {
    localStorage.setItem(REFERRER_STORAGE_KEY, code);
    console.log(`[Referral] Stored referral code: ${code}`);
  }
}

/**
 * Get stored referral code (the person who referred current user)
 */
export function getStoredReferralCode(): string | null {
  return localStorage.getItem(REFERRER_STORAGE_KEY);
}

/**
 * Clear stored referral code
 */
export function clearStoredReferralCode(): void {
  localStorage.removeItem(REFERRER_STORAGE_KEY);
}

/**
 * Register a referral relationship (when wallet connects)
 */
export function registerReferral(
  userWallet: string,
  referrerCode: string
): ReferralData | null {
  // Don't allow self-referral
  const userCode = generateReferralCode(userWallet);
  if (userCode === referrerCode) {
    console.warn('[Referral] Self-referral not allowed');
    return null;
  }

  const referralData: ReferralData = {
    referralCode: userCode,
    referredBy: referrerCode,
    referralLink: `${window.location.origin}?ref=${userCode}`,
    timestamp: Date.now(),
  };

  // Store in localStorage (Phase 1)
  localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referralData));

  // Clear the stored referrer code since we've registered it
  clearStoredReferralCode();

  console.log('[Referral] Registered:', referralData);
  return referralData;
}

/**
 * Get user's referral data
 */
export function getUserReferralData(walletAddress: string): ReferralData {
  const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);

  if (stored) {
    try {
      return JSON.parse(stored) as ReferralData;
    } catch (e) {
      console.error('[Referral] Failed to parse stored data:', e);
    }
  }

  // Generate new referral data if none exists
  const referralCode = generateReferralCode(walletAddress);
  return {
    referralCode,
    referredBy: null,
    referralLink: `${window.location.origin}?ref=${referralCode}`,
    timestamp: Date.now(),
  };
}

/**
 * Check if user was referred by someone
 */
export function wasReferred(): boolean {
  const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (!stored) return false;

  try {
    const data = JSON.parse(stored) as ReferralData;
    return data.referredBy !== null;
  } catch (e) {
    return false;
  }
}

/**
 * Get referral stats (placeholder for Phase 2 backend integration)
 */
export interface ReferralStats {
  totalReferrals: number;
  totalEarned: string; // XRP amount
  pendingPayouts: string; // XRP amount
}

export function getReferralStats(): ReferralStats {
  // Phase 1: Return mock data
  // Phase 2: This will fetch from backend API
  return {
    totalReferrals: 0,
    totalEarned: '0',
    pendingPayouts: '0',
  };
}

/**
 * Copy referral link to clipboard
 */
export async function copyReferralLink(referralLink: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(referralLink);
    return true;
  } catch (e) {
    console.error('[Referral] Failed to copy to clipboard:', e);
    return false;
  }
}
