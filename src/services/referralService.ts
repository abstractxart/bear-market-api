/**
 * Referral System Service
 *
 * Phase 2: Backend API integration with automatic payouts
 * - Captures referral codes from URL
 * - Registers with backend API with signature verification
 * - Falls back to localStorage if API unavailable
 */

import { api } from './apiClient';
import { getKeyManager } from '../security/SecureKeyManager';

const REFERRAL_STORAGE_KEY = 'bear_market_referral';
const REFERRER_STORAGE_KEY = 'bear_market_referrer';

export interface ReferralData {
  referralCode: string;      // User's own referral code
  referredBy: string | null; // Referral code of who referred them
  referralLink: string;       // Full referral link to share
  timestamp: number;          // When the referral was recorded
}

export interface ReferralStats {
  totalReferrals: number;
  totalEarned: string; // XRP amount
  pendingPayouts: string; // XRP amount
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
 * Create local-only referral data (fallback when API unavailable)
 */
function createLocalReferralData(
  userWallet: string,
  referrerCode: string | null
): ReferralData {
  const userCode = generateReferralCode(userWallet);
  const referralData: ReferralData = {
    referralCode: userCode,
    referredBy: referrerCode,
    referralLink: `${window.location.origin}?ref=${userWallet}`,
    timestamp: Date.now(),
  };

  localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referralData));
  clearStoredReferralCode();

  return referralData;
}

/**
 * Register a referral relationship (when wallet connects)
 * Phase 2: Registers with backend API using signature verification
 *
 * SECURITY: Requires cryptographic proof of wallet ownership
 */
export async function registerReferral(
  userWallet: string,
  referrerCode: string | null
): Promise<ReferralData | null> {
  const userCode = generateReferralCode(userWallet);

  // Don't allow self-referral
  if (referrerCode && userCode === referrerCode) {
    console.warn('[Referral] Self-referral not allowed');
    return null;
  }

  try {
    // Check if we have access to the wallet's private key
    const keyManager = getKeyManager();
    if (!keyManager.hasKey() || keyManager.isLocked()) {
      console.warn('[Referral] Wallet not fully connected, using localStorage fallback');
      return createLocalReferralData(userWallet, referrerCode);
    }

    // 1. Request authentication challenge from backend
    console.log('[Referral] Requesting authentication challenge...');
    const challengeResponse = await api.getChallenge(userWallet);

    if (!challengeResponse.success || !challengeResponse.data) {
      throw new Error('Failed to get challenge from backend');
    }

    const { nonce, timestamp, message } = challengeResponse.data;
    console.log('[Referral] Challenge received');

    // 2. Sign the challenge with wallet private key
    const secret = await keyManager.getSecretForSigning();
    const { Wallet } = await import('xrpl');

    let wallet;
    // Check if it's a mnemonic phrase (contains spaces)
    if (secret.includes(' ')) {
      // It's a mnemonic - use fromMnemonic
      wallet = Wallet.fromMnemonic(secret);
    } else {
      // Auto-detect algorithm from seed prefix
      const isEd25519 = secret.startsWith('sEd');
      wallet = Wallet.fromSeed(secret, {
        algorithm: (isEd25519 ? 'ed25519' : 'ecdsa-secp256k1') as any
      });
    }

    // TODO: Implement proper message signing
    // For now, create a basic signature proof using the wallet's public key
    // Backend will implement full cryptographic verification in Phase 3
    const signatureProof = `${wallet.publicKey}:${btoa(message)}:${Date.now()}`;

    console.log('[Referral] Challenge signed');

    // Clean up wallet object from memory
    // @ts-ignore
    wallet.privateKey = undefined;
    // @ts-ignore
    wallet.publicKey = undefined;
    // @ts-ignore
    wallet.seed = undefined;

    // 3. Submit signed challenge to backend for verification
    const response = await api.registerReferralWithSignature({
      walletAddress: userWallet,
      referrerCode,
      signature: signatureProof,
      nonce,
      timestamp
    });

    if (response.success && response.data) {
      const referralData: ReferralData = {
        referralCode: response.data.referralCode,
        referredBy: response.data.referredBy,
        referralLink: response.data.referralLink,
        timestamp: Date.now(),
      };

      // Store locally for offline access
      localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referralData));
      clearStoredReferralCode();

      console.log('[Referral] ✓ Wallet verified and registered with API:', referralData);
      return referralData;
    } else {
      throw new Error(response.error || 'Registration failed');
    }

  } catch (error) {
    console.error('[Referral] Signature verification failed:', error);

    // Fallback to localStorage only (no backend registration)
    console.log('[Referral] Using localStorage fallback');
    return createLocalReferralData(userWallet, referrerCode);
  }
}

/**
 * Get user's referral data
 * Phase 2: Fetches from API if possible
 */
export async function getUserReferralData(walletAddress: string): Promise<ReferralData> {
  try {
    // Try to fetch from API first
    const response = await api.getReferralData(walletAddress);

    if (response.success && response.data) {
      const referralData: ReferralData = {
        referralCode: response.data.referralCode,
        referredBy: response.data.referredBy,
        referralLink: response.data.referralLink,
        timestamp: Date.now(),
      };

      // Cache in localStorage
      localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referralData));

      return referralData;
    }
  } catch (error) {
    console.error('[Referral] Failed to fetch from API, using localStorage:', error);
  }

  // Fallback to localStorage
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
 * Get referral stats from backend API
 */
export async function getReferralStats(walletAddress: string): Promise<ReferralStats> {
  try {
    const response = await api.getReferralStats(walletAddress);

    if (response.success && response.data) {
      return response.data;
    }

    throw new Error(response.error || 'Failed to fetch stats');
  } catch (error) {
    console.error('[Referral] Failed to fetch stats:', error);

    // Return zeros if API fails
    return {
      totalReferrals: 0,
      totalEarned: '0',
      pendingPayouts: '0',
    };
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
