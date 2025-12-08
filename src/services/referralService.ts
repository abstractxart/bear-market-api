/**
 * Referral System Service - Simplified
 *
 * Simple referral system using wallet addresses directly in URLs
 * - No backend API needed
 * - No code generation - uses wallet addresses directly
 * - Pure localStorage tracking
 */

const REFERRAL_STORAGE_KEY = 'bear_market_referral';
const REFERRER_STORAGE_KEY = 'bear_market_referrer';

export interface ReferralData {
  referralLink: string;       // Full referral link to share
  referredBy: string | null;  // Wallet address of who referred this user
  timestamp: number;
}

/**
 * Get referrer wallet address from URL parameters
 */
export function getReferralCodeFromURL(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('ref');
}

/**
 * Store referrer wallet address in localStorage (before wallet connection)
 */
export function storeReferralCode(referrerWallet: string): void {
  if (referrerWallet && referrerWallet.startsWith('r')) {
    localStorage.setItem(REFERRER_STORAGE_KEY, referrerWallet);
    console.log(`[Referral] Stored referrer wallet: ${referrerWallet}`);
  }
}

/**
 * Get stored referrer wallet (the person who referred current user)
 */
export function getStoredReferralCode(): string | null {
  return localStorage.getItem(REFERRER_STORAGE_KEY);
}

/**
 * Clear stored referrer wallet
 */
export function clearStoredReferralCode(): void {
  localStorage.removeItem(REFERRER_STORAGE_KEY);
}

/**
 * Register a referral relationship (when wallet connects)
 */
export async function registerReferral(
  userWallet: string,
  referrerWallet: string | null
): Promise<ReferralData | null> {
  // Don't allow self-referral
  if (referrerWallet && userWallet === referrerWallet) {
    console.warn('[Referral] Self-referral not allowed');
    return null;
  }

  const referralData: ReferralData = {
    referralLink: `${window.location.origin}?ref=${userWallet}`,
    referredBy: referrerWallet,
    timestamp: Date.now(),
  };

  localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referralData));
  clearStoredReferralCode();

  console.log('[Referral] ✓ Registered:', referralData);
  return referralData;
}

/**
 * Get user's referral data
 */
export async function getUserReferralData(walletAddress: string): Promise<ReferralData> {
  // Check localStorage first
  const stored = localStorage.getItem(REFERRAL_STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as ReferralData;
    } catch (e) {
      console.error('[Referral] Failed to parse stored data:', e);
    }
  }

  // Generate new referral data if none exists
  return {
    referralLink: `${window.location.origin}?ref=${walletAddress}`,
    referredBy: null,
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
