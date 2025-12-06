/**
 * BEAR MARKET - Token Leaderboard Service
 *
 * Aggregates token data from multiple sources for the leaderboard page:
 * - OnTheDex: Price, 24h volume, 24h change
 * - DexScreener: 5m, 1h, 24h changes, liquidity, creation date
 * - XRPL Meta: Holders, trustlines, market cap
 */

import type { LeaderboardToken } from '../types';
import { getTokenIconUrl, getTokenIconUrls } from './tokenService';

// ==================== CONFIGURATION ====================

const XRPL_TO_API = 'https://api.xrpl.to/api';
const ONTHEDEX_API = 'https://api.onthedex.live/public/v1';
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';

// Backend proxy for CORS
const API_PROXY = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function proxyFetch(url: string): Promise<Response> {
  const proxyUrl = `${API_PROXY}/api/proxy?url=${encodeURIComponent(url)}`;
  return fetch(proxyUrl);
}

// ==================== CACHE ====================

interface LeaderboardCache {
  tokens: LeaderboardToken[];
  timestamp: number;
}

let leaderboardCache: LeaderboardCache | null = null;
const CACHE_DURATION = 30 * 1000; // 30 seconds

// BEAR token issuer
const BEAR_ISSUER = 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW';

// ==================== SCAM TOKEN FILTER ====================

/**
 * Blocklist of fake tokens impersonating real companies
 * These tokens use brand names to mislead users
 */
const SCAM_TOKEN_NAMES = new Set([
  // Fake company tokens
  'GOOGLE',
  'ALPHABET',
  'BANK OF AMERICA',
  'BANKOFAMERICA',
  'BOA',
  'BERKSHIRE HATHAWAY',
  'BERKSHIRE',
  'DBS BANK',
  'DBS',
  'BBVA',
  'AMERICAN EXPRESS',
  'AMEX',
  'YELLOW CARD',
  'YELLOWCARD',
  'RELIANCE XRP',
  'RELIANCE',
  'UPHOLD',
  'EVOLVE ETF',
  'EVOLVE',
  'AMINA BANK',
  'AMINA',
  'STRATEGIC RESERVE',
  'BAHRAIN FINTECH',
  'BAHRAIN FINTECH BAY',
  'FINTECH BAY',
  'VBILL',
  'VERT CAPITAL',
  'VERT',
  // Wrapped assets & stablecoins (not native XRPL tokens)
  'BTC',
  'ETH',
  'WBTC',
  'WETH',
  'USD',
  'USDC',
  'USDT',
  'EUR',
  'CNY',
  'JPY',
  'GBP',
  // Unwanted tokens
  'EUROP',
  'REAL',
  'BXE',
  'MXI',
  'OPULENCE',
  'XRPS',
  'XLM',
  'XRPFI',
  'BNY',
  // Additional common scam names
  'PAYPAL',
  'TESLA',
  'APPLE',
  'MICROSOFT',
  'AMAZON',
  'META',
  'FACEBOOK',
  'NETFLIX',
  'NVIDIA',
  'VISA',
  'MASTERCARD',
  'JPMORGAN',
  'JP MORGAN',
  'GOLDMAN SACHS',
  'GOLDMAN',
  'MORGAN STANLEY',
  'CITI',
  'CITIBANK',
  'CITIGROUP',
  'HSBC',
  'WELLS FARGO',
  'BLACKROCK',
  'FIDELITY',
  'VANGUARD',
  'SCHWAB',
  'COINBASE',
  'BINANCE',
  'KRAKEN',
]);

/**
 * Trusted issuers - tokens from these issuers bypass the filter
 * Only include native XRPL project tokens, not wrapped assets
 */
const TRUSTED_ISSUERS = new Set([
  // BEAR
  'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW',
  // Sologenic (SOLO is a native XRPL token)
  'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz',
]);

/**
 * Filter out scam/fake tokens
 */
function filterScamTokens(tokens: LeaderboardToken[]): LeaderboardToken[] {
  return tokens.filter(token => {
    // Always allow trusted issuers
    if (TRUSTED_ISSUERS.has(token.issuer || '')) {
      return true;
    }

    // Check if token name/currency matches a scam pattern
    const upperCurrency = token.currency.toUpperCase();
    const upperName = (token.name || '').toUpperCase();
    const upperSymbol = (token.symbol || '').toUpperCase();

    // Block exact matches
    if (SCAM_TOKEN_NAMES.has(upperCurrency) ||
        SCAM_TOKEN_NAMES.has(upperName) ||
        SCAM_TOKEN_NAMES.has(upperSymbol)) {
      console.log(`[Leaderboard] Filtered scam token: ${token.currency} (${token.issuer?.slice(0, 8)}...)`);
      return false;
    }

    return true;
  });
}

// ==================== HEX DECODING ====================

/**
 * Decode hex-encoded XRPL currency to readable string
 * XRPL currencies > 3 chars are stored as 40-char hex strings
 */
function decodeHexCurrency(hex: string): string {
  // If not 40 chars, it's already readable
  if (hex.length !== 40) return hex;

  try {
    // Remove trailing zeros and convert hex to ASCII
    let result = '';
    for (let i = 0; i < hex.length; i += 2) {
      const charCode = parseInt(hex.substr(i, 2), 16);
      if (charCode === 0) break; // Stop at null terminator
      result += String.fromCharCode(charCode);
    }
    return result || hex;
  } catch {
    return hex;
  }
}


// ==================== MAIN FUNCTIONS ====================

/**
 * Get all tokens for the leaderboard with full data
 * Primary source: xrpl.to (best data quality)
 * Fallback: OnTheDex
 */
export async function getLeaderboardTokens(forceRefresh = false): Promise<LeaderboardToken[]> {
  // Return cache if valid
  if (!forceRefresh && leaderboardCache && Date.now() - leaderboardCache.timestamp < CACHE_DURATION) {
    return leaderboardCache.tokens;
  }

  console.log('[Leaderboard] Fetching fresh token data from xrpl.to...');

  try {
    // Try xrpl.to first (best data)
    let tokens = await fetchXrplToTokens();

    // Fallback to OnTheDex if xrpl.to fails
    if (tokens.length === 0) {
      console.log('[Leaderboard] xrpl.to failed, falling back to OnTheDex...');
      tokens = await fetchOnTheDexTokens();
    }

    // Fetch DexScreener data for market caps (works better for many tokens)
    try {
      const dexScreenerData = await fetchDexScreenerXRPL();
      tokens = mergeDexScreenerData(tokens, dexScreenerData);
      console.log(`[Leaderboard] Merged DexScreener data for market caps`);
    } catch (err) {
      console.log('[Leaderboard] DexScreener merge skipped:', err);
    }

    // Filter out scam tokens impersonating real companies
    const beforeFilter = tokens.length;
    tokens = filterScamTokens(tokens);
    console.log(`[Leaderboard] Filtered ${beforeFilter - tokens.length} scam tokens`);

    // Sort by market cap (highest first), BEAR always at top
    tokens = sortTokens(tokens);

    // Cache results
    leaderboardCache = {
      tokens,
      timestamp: Date.now(),
    };

    console.log(`[Leaderboard] Loaded ${tokens.length} tokens`);
    return tokens;

  } catch (error) {
    console.error('[Leaderboard] Error fetching tokens:', error);
    // Return cache even if stale
    return leaderboardCache?.tokens || [];
  }
}

/**
 * Fetch tokens from xrpl.to API (primary source - best data quality)
 * Fetches multiple pages to get more tokens
 */
async function fetchXrplToTokens(): Promise<LeaderboardToken[]> {
  const allTokens: LeaderboardToken[] = [];
  const seen = new Set<string>();
  const LIMIT = 100; // xrpl.to returns max 100 per page
  const MAX_PAGES = 10; // Fetch up to 1000 tokens total

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const start = page * LIMIT;
      const response = await proxyFetch(
        `${XRPL_TO_API}/tokens?limit=${LIMIT}&start=${start}&sortType=desc&sortBy=vol24hxrp`
      );

      if (!response.ok) {
        console.warn(`[Leaderboard] xrpl.to page ${page} failed`);
        break;
      }

      const data = await response.json();
      const pageTokens = data.tokens || [];

      // Stop if no more tokens
      if (pageTokens.length === 0) {
        console.log(`[Leaderboard] xrpl.to: No more tokens at page ${page}`);
        break;
      }

      for (const item of pageTokens) {
        // Decode hex currency if needed
        let currency = item.currency;
        if (currency && currency.length === 40) {
          currency = decodeHexCurrency(currency);
        }

        // Skip duplicates
        const key = `${currency}:${item.issuer}`;
        if (seen.has(key)) continue;
        seen.add(key);

        // Skip tokens with no trading activity
        if (!item.vol24hxrp && item.vol24hxrp !== 0) continue;

        allTokens.push({
          currency: currency || item.name,
          issuer: item.issuer,
          name: item.name || currency,
          symbol: item.name || currency,
          icon: getTokenIconUrl(currency, item.issuer),
          decimals: 15,
          // Price data
          price: parseFloat(item.usd) || undefined,
          priceChange5m: item.pro5m,
          priceChange1h: item.pro1h,
          priceChange24h: item.pro24h,
          priceChange7d: item.pro7d,
          // Volume
          volume24h: item.vol24hxrp || 0,
          // Market metrics - xrpl.to has accurate market caps
          marketCap: item.marketcap > 0 ? item.marketcap : undefined,
          tvl: item.tvl > 0 ? item.tvl : undefined,
          // Token stats
          holders: item.holders,
          trustlines: item.trustlines,
          // Metadata
          domain: item.domain,
          verified: item.kyc || item.verified,
        });
      }

      console.log(`[Leaderboard] xrpl.to page ${page}: ${pageTokens.length} tokens (total: ${allTokens.length})`);

      // If we got less than LIMIT, we've reached the end
      if (pageTokens.length < LIMIT) break;
    }

    console.log(`[Leaderboard] xrpl.to returned ${allTokens.length} tokens total`);
    return allTokens;
  } catch (error) {
    console.error('[Leaderboard] xrpl.to fetch failed:', error);
    return allTokens; // Return what we have
  }
}

// ==================== DATA SOURCES ====================

/**
 * Fetch tokens from OnTheDex (primary source for traded tokens)
 */
async function fetchOnTheDexTokens(): Promise<LeaderboardToken[]> {
  const response = await proxyFetch(`${ONTHEDEX_API}/daily/pairs`);
  if (!response.ok) throw new Error('OnTheDex API failed');

  const data = await response.json();
  const tokens: LeaderboardToken[] = [];
  const seen = new Set<string>();

  for (const pair of data.pairs || []) {
    // Only XRP pairs (API uses "quote" not "counter_currency")
    if (pair.quote !== 'XRP') continue;

    // API nests currency/issuer under "base" object
    const currency = pair.base?.currency;
    const issuer = pair.base?.issuer;

    if (!currency || !issuer) continue;

    const key = `${currency}:${issuer}`;

    if (seen.has(key)) continue;
    seen.add(key);

    tokens.push({
      currency,
      issuer,
      name: currency,
      symbol: currency,
      icon: getTokenIconUrl(currency, issuer),
      decimals: 15,
      price: pair.last,
      priceChange24h: pair.pc24,
      volume24h: pair.volume_quote || 0,
    });
  }

  return tokens;
}

/**
 * Fetch XRPL tokens from DexScreener (market cap, liquidity, creation)
 * DexScreener has better market cap data for many tokens
 */
async function fetchDexScreenerXRPL(): Promise<Map<string, Partial<LeaderboardToken>>> {
  // DexScreener search for XRPL tokens - direct fetch (they allow CORS)
  const response = await fetch(`${DEXSCREENER_API}/search?q=xrpl`);
  if (!response.ok) throw new Error('DexScreener API failed');

  const data = await response.json();
  const tokenMap = new Map<string, Partial<LeaderboardToken>>();

  for (const pair of data.pairs || []) {
    if (pair.chainId !== 'xrpl') continue;

    const baseToken = pair.baseToken;
    if (!baseToken?.address) continue;

    // Parse issuer from address (format: "HEX_CURRENCY.rISSUER")
    // DexScreener uses DOT separator, not colon
    const issuer = baseToken.address.includes('.')
      ? baseToken.address.split('.')[1]
      : baseToken.address;

    const currency = baseToken.symbol || '';
    const key = `${currency}:${issuer}`;

    // Only update if we don't have data for this token yet, or if new data has better market cap
    const existing = tokenMap.get(key);
    const newMarketCap = pair.marketCap || pair.fdv || 0;

    if (!existing || (newMarketCap > (existing.marketCap || 0))) {
      tokenMap.set(key, {
        // Get XRP price from DexScreener (priceNative is the XRP price)
        price: pair.priceNative ? parseFloat(pair.priceNative) : undefined,
        priceChange5m: pair.priceChange?.m5,
        priceChange1h: pair.priceChange?.h1,
        priceChange24h: pair.priceChange?.h24,
        tvl: pair.liquidity?.usd,
        // Market cap in USD from DexScreener
        marketCap: newMarketCap > 0 ? newMarketCap : undefined,
        fdv: pair.fdv,
        createdAt: pair.pairCreatedAt,
        icon: pair.info?.imageUrl,
      });
    }
  }

  console.log(`[Leaderboard] DexScreener found ${tokenMap.size} XRPL tokens with data`);
  return tokenMap;
}

// ==================== DATA MERGING ====================

/**
 * Merge DexScreener data into tokens
 * Prioritizes DexScreener market cap when xrpl.to has 0 or undefined
 */
function mergeDexScreenerData(
  tokens: LeaderboardToken[],
  dexData: Map<string, Partial<LeaderboardToken>>
): LeaderboardToken[] {
  let matchedCount = 0;
  let marketCapFillCount = 0;

  const result = tokens.map(token => {
    const key = `${token.currency}:${token.issuer}`;
    const dex = dexData.get(key);
    if (dex) {
      matchedCount++;
      // Use DexScreener market cap if xrpl.to doesn't have one
      const usesDexMcap = !token.marketCap && dex.marketCap;
      if (usesDexMcap) marketCapFillCount++;

      return {
        ...token,
        // Use DexScreener XRP price (more accurate than xrpl.to)
        price: dex.price ?? token.price,
        priceChange5m: dex.priceChange5m ?? token.priceChange5m,
        priceChange1h: dex.priceChange1h ?? token.priceChange1h,
        priceChange24h: dex.priceChange24h ?? token.priceChange24h,
        tvl: dex.tvl ?? token.tvl,
        // Use DexScreener market cap (USD) - more accurate
        marketCap: dex.marketCap || token.marketCap,
        fdv: dex.fdv ?? token.fdv,
        createdAt: dex.createdAt ?? token.createdAt,
        icon: dex.icon || token.icon,
      };
    }
    return token;
  });

  console.log(`[Leaderboard] Merged DexScreener: ${matchedCount} matches, ${marketCapFillCount} market caps filled`);
  return result;
}

// ==================== SORTING ====================

/**
 * Sort tokens (BEAR first, then by market cap)
 */
function sortTokens(tokens: LeaderboardToken[]): LeaderboardToken[] {
  return tokens.sort((a, b) => {
    // BEAR always first
    if (a.currency === 'BEAR' && a.issuer === BEAR_ISSUER) return -1;
    if (b.currency === 'BEAR' && b.issuer === BEAR_ISSUER) return 1;

    // Then by market cap
    return (b.marketCap || 0) - (a.marketCap || 0);
  });
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Sort tokens by a specific field
 */
export function sortLeaderboardTokens(
  tokens: LeaderboardToken[],
  sortBy: keyof LeaderboardToken,
  direction: 'asc' | 'desc' = 'desc'
): LeaderboardToken[] {
  const sorted = [...tokens].sort((a, b) => {
    // BEAR always first regardless of sort
    if (a.currency === 'BEAR' && a.issuer === BEAR_ISSUER) return -1;
    if (b.currency === 'BEAR' && b.issuer === BEAR_ISSUER) return 1;

    const aVal = a[sortBy] ?? 0;
    const bVal = b[sortBy] ?? 0;

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'desc' ? bVal - aVal : aVal - bVal;
    }

    // String comparison
    const aStr = String(aVal);
    const bStr = String(bVal);
    return direction === 'desc' ? bStr.localeCompare(aStr) : aStr.localeCompare(bStr);
  });

  return sorted;
}

/**
 * Filter tokens by search query
 */
export function filterLeaderboardTokens(
  tokens: LeaderboardToken[],
  query: string
): LeaderboardToken[] {
  if (!query) return tokens;

  const lowerQuery = query.toLowerCase();
  return tokens.filter(token =>
    token.currency.toLowerCase().includes(lowerQuery) ||
    token.name.toLowerCase().includes(lowerQuery) ||
    token.symbol.toLowerCase().includes(lowerQuery) ||
    token.issuer?.toLowerCase().includes(lowerQuery) ||
    token.domain?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Format time ago string from timestamp
 */
export function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return '--';

  const now = Date.now();
  const diff = now - timestamp;

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 365) {
    const years = Math.floor(days / 365);
    return `${years}y`;
  }
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  const minutes = Math.floor(diff / (1000 * 60));
  return `${minutes}m`;
}

/**
 * Format large numbers (1000 -> 1k, 1000000 -> 1M)
 */
export function formatCompactNumber(num?: number): string {
  if (num === undefined || num === null) return '--';
  if (num === 0) return '0';

  const absNum = Math.abs(num);

  if (absNum >= 1e9) {
    return (num / 1e9).toFixed(2) + 'B';
  }
  if (absNum >= 1e6) {
    return (num / 1e6).toFixed(2) + 'M';
  }
  if (absNum >= 1e3) {
    return (num / 1e3).toFixed(2) + 'k';
  }

  return num.toFixed(2);
}

/**
 * Format price with appropriate decimals
 */
export function formatPrice(price?: number): string {
  if (price === undefined || price === null) return '--';
  if (price === 0) return '0';

  // Show full decimals instead of scientific notation
  if (price < 0.0000001) {
    return price.toFixed(10);
  }
  if (price < 0.000001) {
    return price.toFixed(9);
  }
  if (price < 0.00001) {
    return price.toFixed(8);
  }
  if (price < 0.0001) {
    return price.toFixed(7);
  }
  if (price < 1) {
    return price.toFixed(6);
  }
  if (price < 100) {
    return price.toFixed(4);
  }
  return price.toFixed(2);
}

/**
 * Get icon URLs for a token (multiple fallbacks)
 */
export { getTokenIconUrls };
