/**
 * API Client for BEAR MARKET Backend
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Generic API request handler
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}`,
      };
    }

    return data;
  } catch (error: any) {
    console.error(`[API] ${endpoint} failed:`, error);
    return {
      success: false,
      error: error.message || 'Network error',
    };
  }
}

export const api = {
  /**
   * Register a referral relationship
   */
  registerReferral: (walletAddress: string, referrerCode: string | null) =>
    apiRequest('/api/referrals/register', {
      method: 'POST',
      body: JSON.stringify({ walletAddress, referrerCode }),
    }),

  /**
   * Get referral data for a wallet
   */
  getReferralData: (walletAddress: string) =>
    apiRequest(`/api/referrals/${walletAddress}`),

  /**
   * Get referral stats
   */
  getReferralStats: (walletAddress: string) =>
    apiRequest(`/api/referrals/${walletAddress}/stats`),

  /**
   * Get payout history
   */
  getPayoutHistory: (walletAddress: string) =>
    apiRequest(`/api/referrals/${walletAddress}/payouts`),

  /**
   * Record a trade and trigger payout
   */
  recordTrade: (tradeData: {
    traderWallet: string;
    inputToken: string;
    outputToken: string;
    inputAmount: number;
    outputAmount: number;
    feeAmount: number;
    feeToken: string;
    swapTxHash?: string;
  }) =>
    apiRequest('/api/trades/record', {
      method: 'POST',
      body: JSON.stringify(tradeData),
    }),
};
