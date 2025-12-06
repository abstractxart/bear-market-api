// ============================================
// BEAR MARKET - Type Definitions
// ============================================

// Fee tier types
export type FeeTier = 'regular' | 'pixel_bear' | 'ultra_rare';

export interface FeeConfig {
  tier: FeeTier;
  rate: number; // Decimal (e.g., 0.00589 for 0.589%)
  label: string;
}

export const FEE_TIERS: Record<FeeTier, FeeConfig> = {
  regular: {
    tier: 'regular',
    rate: 0.00589,
    label: '0.589%',
  },
  pixel_bear: {
    tier: 'pixel_bear',
    rate: 0.00485,
    label: '0.485%',
  },
  ultra_rare: {
    tier: 'ultra_rare',
    rate: 0.00321,
    label: '0.321%',
  },
};

// Token types
export interface Token {
  currency: string;
  issuer?: string; // undefined for XRP
  name: string;
  symbol: string;
  icon?: string;
  decimals: number;
}

// Extended token type for leaderboard/market data
export interface LeaderboardToken extends Token {
  // Price data
  price?: number;              // Current price in XRP
  priceChange5m?: number;      // 5-minute price change %
  priceChange1h?: number;      // 1-hour price change %
  priceChange24h?: number;     // 24-hour price change %
  priceChange7d?: number;      // 7-day price change %

  // Volume data
  volume24h?: number;          // 24-hour trading volume in XRP
  volumeChange24h?: number;    // 24h volume change %
  totalVolume?: number;        // Lifetime total volume

  // Market metrics
  marketCap?: number;          // Market capitalization
  tvl?: number;                // Total Value Locked / liquidity
  fdv?: number;                // Fully Diluted Valuation

  // Token stats
  holders?: number;            // Unique holder count
  trustlines?: number;         // Total trustlines
  createdAt?: number;          // Token creation timestamp

  // Metadata
  domain?: string;             // Token's domain
  verified?: boolean;          // Verified status

}

export const XRP_TOKEN: Token = {
  currency: 'XRP',
  issuer: undefined,
  name: 'XRP',
  symbol: 'XRP',
  icon: '/tokens/xrp.svg',
  decimals: 6,
};

// Wallet types
export type WalletConnectionType = 'web3auth' | 'walletconnect' | 'manual' | 'none';

export interface WalletState {
  address: string | null;
  connectionType: WalletConnectionType;
  isConnected: boolean;
  feeTier: FeeTier;
  balance: {
    xrp: string;
    tokens: TokenBalance[];
  };
  honeyPoints: number;
}

export interface TokenBalance {
  token: Token;
  balance: string;
}

// Swap types
export interface SwapQuote {
  inputToken: Token;
  outputToken: Token;
  inputAmount: string;
  outputAmount: string;
  exchangeRate: string;
  feeAmount: string;
  feeTier: FeeTier;
  priceImpact: number;
  slippage: number;
  minimumReceived: string;
  estimatedGas: string;
  expiresAt: number;
}

export interface SwapTransaction {
  id: string;
  quote: SwapQuote;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  txHash?: string;
  timestamp: number;
}

// Bear Attack Mode preset
export interface BearAttackPreset {
  id: string;
  token: Token;
  amount: string;
  slippage: number;
  enabled: boolean;
}

// Leaderboard types
export interface LeaderboardEntry {
  rank: number;
  address: string;
  username?: string; // BEARpark username
  avatarUrl?: string; // BEARpark profile pic
  volume24h: string;
  totalVolume: string;
  honeyPoints: number;
  feeTier: FeeTier;
  streak: number;
}

// Referral types
export interface ReferralInfo {
  code: string;
  referredBy?: string;
  referrals: string[];
  totalEarnings: string;
  commissionRate: number; // 0.20 to 0.35
}

// NFT types for fee verification
export interface PixelBearNFT {
  tokenId: string;
  taxon: number;
  isUltraRare: boolean;
  imageUrl?: string;
}

// Settings
export interface UserSettings {
  slippage: number; // Default 0.5%
  bearAttackMode: boolean;
  bearAttackPresets: BearAttackPreset[];
  notifications: boolean;
  theme: 'dark' | 'purple' | 'green';
}

// API Response types
export interface QuoteResponse {
  success: boolean;
  quote?: SwapQuote;
  error?: string;
}

export interface SwapResponse {
  success: boolean;
  transaction?: SwapTransaction;
  error?: string;
}
