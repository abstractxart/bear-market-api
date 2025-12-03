/**
 * BEAR MARKET - Token Service
 *
 * Fetches and caches XRPL token data from multiple APIs:
 * - OnTheDex: Primary source for ALL traded XRPL tokens
 * - XRPL Meta: Additional token metadata
 * - Bithomp CDN: Token icons (free, no auth)
 */

import type { Token } from '../types';

// ==================== CONFIGURATION ====================

const ONTHEDEX_API = 'https://api.onthedex.live/public/v1';
const XRPL_META_API = 'https://s1.xrplmeta.org';
const BITHOMP_CDN = 'https://cdn.bithomp.com';

// Cache duration: 5 minutes for tokens, 1 minute for prices
const TOKENS_CACHE_DURATION = 5 * 60 * 1000;
const PRICES_CACHE_DURATION = 60 * 1000;

// ==================== TYPES ====================

export interface XRPLToken extends Token {
  issuer: string;
  trustlines?: number;
  holders?: number;
  marketCap?: number;
  volume24h?: number;
  price?: number;
  priceChange24h?: number;
  verified?: boolean;
  domain?: string;
}

interface TokenCache {
  tokens: XRPLToken[];
  timestamp: number;
}

interface PriceCache {
  prices: Record<string, number>;
  timestamp: number;
}

interface XRPLMetaToken {
  currency: string;
  issuer: string;
  meta?: {
    token?: {
      name?: string;
      icon?: string;
      description?: string;
    };
    issuer?: {
      name?: string;
      domain?: string;
      verified?: boolean;
    };
  };
  metrics?: {
    trustlines?: number;
    holders?: number;
    marketcap?: number;
    volume_24h?: number;
    price?: number;
    price_change_24h?: number;
  };
}

// ==================== CACHE ====================

let tokenCache: TokenCache | null = null;
let priceCache: PriceCache | null = null;
let popularTokensCache: XRPLToken[] | null = null;

// ==================== HELPER FUNCTIONS ====================

/**
 * Get token icon URL from Bithomp CDN
 * Falls back to a generated icon if not available
 */
export function getTokenIconUrl(currency: string, issuer?: string): string {
  if (currency === 'XRP') {
    // Use a reliable XRP icon URL
    return 'https://cdn.bithomp.com/xrp.svg';
  }

  if (!issuer) {
    return '';
  }

  // Use Bithomp CDN for issued tokens
  return `${BITHOMP_CDN}/issued-token/${issuer}/${currency}`;
}

/**
 * Convert currency code to readable format
 * Handles hex-encoded currency codes (browser-compatible)
 */
export function formatCurrencyCode(currency: string): string {
  if (currency.length === 40 && /^[0-9A-Fa-f]+$/.test(currency)) {
    // Hex-encoded currency code - decode it (browser-compatible)
    try {
      let decoded = '';
      for (let i = 0; i < currency.length; i += 2) {
        const byte = parseInt(currency.substr(i, 2), 16);
        if (byte !== 0) { // Skip null bytes
          decoded += String.fromCharCode(byte);
        }
      }
      return decoded.trim() || currency.slice(0, 8);
    } catch {
      return currency.slice(0, 8);
    }
  }
  return currency;
}

/**
 * Create a unique token identifier
 */
export function getTokenId(currency: string, issuer?: string): string {
  if (currency === 'XRP' || !issuer) {
    return 'XRP';
  }
  return `${currency}:${issuer}`;
}

// ==================== API FUNCTIONS ====================

/**
 * Fetch all tokens from XRPL Meta API
 */
async function fetchTokensFromXRPLMeta(): Promise<XRPLToken[]> {
  try {
    // Fetch tokens sorted by market cap
    const response = await fetch(`${XRPL_META_API}/tokens?limit=200&sort_by=marketcap&sort_order=desc`);

    if (!response.ok) {
      // Try alternative endpoint
      const altResponse = await fetch(`${XRPL_META_API}/tokens?limit=200`);
      if (!altResponse.ok) {
        throw new Error(`XRPL Meta API error: ${altResponse.status}`);
      }
      const data = await altResponse.json();
      return parseTokensResponse(data);
    }

    const data = await response.json();
    return parseTokensResponse(data);
  } catch (error) {
    console.error('Failed to fetch from XRPL Meta:', error);
    // Return common tokens as fallback
    return COMMON_TOKENS;
  }
}

/**
 * Parse tokens response from API
 */
function parseTokensResponse(data: any): XRPLToken[] {
  const tokens: XRPLToken[] = [];
  const items = data.tokens || data || [];

  for (const item of items) {
    const token = parseXRPLMetaToken(item);
    if (token) {
      tokens.push(token);
    }
  }

  return tokens;
}

/**
 * Parse XRPL Meta token response into our format
 */
function parseXRPLMetaToken(item: XRPLMetaToken): XRPLToken | null {
  if (!item.currency || !item.issuer) {
    return null;
  }

  const formattedCurrency = formatCurrencyCode(item.currency);
  const name = item.meta?.token?.name || formattedCurrency;

  // Ensure numeric values are actually numbers (API might return strings)
  const parseNum = (val: any): number | undefined => {
    if (val === undefined || val === null) return undefined;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? undefined : num;
  };

  return {
    currency: item.currency,
    issuer: item.issuer,
    name: name,
    symbol: formattedCurrency,
    icon: item.meta?.token?.icon || getTokenIconUrl(item.currency, item.issuer),
    decimals: 15,
    trustlines: parseNum(item.metrics?.trustlines),
    holders: parseNum(item.metrics?.holders),
    marketCap: parseNum(item.metrics?.marketcap),
    volume24h: parseNum(item.metrics?.volume_24h),
    price: parseNum(item.metrics?.price),
    priceChange24h: parseNum(item.metrics?.price_change_24h),
    verified: item.meta?.issuer?.verified,
    domain: item.meta?.issuer?.domain,
  };
}

// Cache for OnTheDex tokens
let onTheDexCache: XRPLToken[] | null = null;
let onTheDexCacheTime = 0;
const ONTHEDEX_CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

/**
 * Fetch ALL traded tokens from OnTheDex daily pairs
 */
async function fetchOnTheDexTokens(): Promise<XRPLToken[]> {
  // Return cache if valid
  if (onTheDexCache && Date.now() - onTheDexCacheTime < ONTHEDEX_CACHE_DURATION) {
    return onTheDexCache;
  }

  const tokens: XRPLToken[] = [];
  const seen = new Set<string>();

  try {
    const response = await fetch(`${ONTHEDEX_API}/daily/pairs`);
    if (!response.ok) return [];

    const data = await response.json();
    const pairs = data.pairs || [];

    for (const pair of pairs) {
      // Get the base token (the non-XRP side)
      const base = pair.base;
      if (!base || typeof base === 'string') continue; // Skip XRP base
      if (!base.currency || !base.issuer) continue;

      const key = `${base.currency}:${base.issuer}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const formattedCurrency = formatCurrencyCode(base.currency);
      tokens.push({
        currency: base.currency,
        issuer: base.issuer,
        name: formattedCurrency,
        symbol: formattedCurrency,
        icon: getTokenIconUrl(base.currency, base.issuer),
        decimals: 15,
        volume24h: pair.volume_quote || 0, // XRP volume
        price: pair.last,
        priceChange24h: pair.pc24,
      });
    }

    // Cache the results
    onTheDexCache = tokens;
    onTheDexCacheTime = Date.now();

    return tokens;
  } catch (error) {
    console.error('OnTheDex fetch error:', error);
    return onTheDexCache || [];
  }
}

/**
 * Search tokens - fetches ALL traded tokens and filters locally
 */
export async function searchTokens(query: string): Promise<XRPLToken[]> {
  if (!query || query.length < 2) {
    return getPopularTokens();
  }

  const lowerQuery = query.toLowerCase();
  const results: XRPLToken[] = [];
  const seen = new Set<string>();

  // Helper to add token if not already in results
  const addToken = (token: XRPLToken) => {
    const key = `${token.currency}:${token.issuer}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(token);
    }
  };

  // Helper to check if token matches query
  const matchesQuery = (token: XRPLToken): boolean => {
    const formattedCurrency = formatCurrencyCode(token.currency).toLowerCase();
    const matchesCurrency = token.currency.toLowerCase().includes(lowerQuery) || formattedCurrency.includes(lowerQuery);
    const matchesName = token.name?.toLowerCase().includes(lowerQuery) || false;
    const matchesSymbol = token.symbol?.toLowerCase().includes(lowerQuery) || false;
    const matchesIssuer = token.issuer?.toLowerCase().includes(lowerQuery) || false;
    const matchesDomain = token.domain?.toLowerCase().includes(lowerQuery) || false;
    return matchesCurrency || matchesName || matchesSymbol || matchesIssuer || matchesDomain;
  };

  // 1. ALWAYS search COMMON_TOKENS first
  for (const token of COMMON_TOKENS) {
    if (matchesQuery(token)) {
      addToken(token);
    }
  }

  // 2. Fetch and search ALL OnTheDex tokens
  const onTheDexTokens = await fetchOnTheDexTokens();
  for (const token of onTheDexTokens) {
    if (matchesQuery(token)) {
      addToken(token);
    }
  }

  // 3. Also try XRPL Meta API for additional tokens
  try {
    const response = await fetch(
      `${XRPL_META_API}/tokens?search=${encodeURIComponent(query)}&limit=50`
    );

    if (response.ok) {
      const data = await response.json();
      const items = data.tokens || data || [];

      for (const item of items) {
        const token = parseXRPLMetaToken(item);
        if (token && matchesQuery(token)) {
          addToken(token);
        }
      }
    }
  } catch (error) {
    console.error('XRPL Meta search error:', error);
  }

  // 4. Search in cached tokens
  if (tokenCache?.tokens) {
    for (const token of tokenCache.tokens) {
      if (matchesQuery(token)) {
        addToken(token);
      }
    }
  }

  // Sort results: exact matches first, then by volume
  results.sort((a, b) => {
    const aExact = a.symbol?.toLowerCase() === lowerQuery || formatCurrencyCode(a.currency).toLowerCase() === lowerQuery;
    const bExact = b.symbol?.toLowerCase() === lowerQuery || formatCurrencyCode(b.currency).toLowerCase() === lowerQuery;
    if (aExact && !bExact) return -1;
    if (bExact && !aExact) return 1;
    // Sort by volume (more active tokens first)
    return (b.volume24h || 0) - (a.volume24h || 0);
  });

  return results.slice(0, 100);
}


/**
 * Get all available tokens (with caching)
 */
export async function getAllTokens(): Promise<XRPLToken[]> {
  // Return cached tokens if still valid
  if (tokenCache && Date.now() - tokenCache.timestamp < TOKENS_CACHE_DURATION) {
    return tokenCache.tokens;
  }

  // Fetch fresh tokens
  const tokens = await fetchTokensFromXRPLMeta();

  // Sort by market cap / volume
  tokens.sort((a, b) => {
    const aScore = (a.marketCap || 0) + (a.volume24h || 0) * 10;
    const bScore = (b.marketCap || 0) + (b.volume24h || 0) * 10;
    return bScore - aScore;
  });

  // Update cache
  tokenCache = {
    tokens,
    timestamp: Date.now(),
  };

  return tokens;
}

/**
 * Get popular/featured tokens
 */
export async function getPopularTokens(): Promise<XRPLToken[]> {
  if (popularTokensCache) {
    return popularTokensCache;
  }

  const allTokens = await getAllTokens();

  // Filter for tokens with good liquidity
  popularTokensCache = allTokens
    .filter(t => (t.holders || 0) > 100 || (t.volume24h || 0) > 1000)
    .slice(0, 20);

  return popularTokensCache;
}

/**
 * Get specific token metadata
 */
export async function getTokenMetadata(currency: string, issuer: string): Promise<XRPLToken | null> {
  // Check cache first
  if (tokenCache) {
    const cached = tokenCache.tokens.find(
      t => t.currency === currency && t.issuer === issuer
    );
    if (cached) return cached;
  }

  // Fetch from API
  try {
    const response = await fetch(`${XRPL_META_API}/token/${currency}:${issuer}`);

    if (response.ok) {
      const data = await response.json();
      return parseXRPLMetaToken(data);
    }
  } catch (error) {
    console.error('Failed to fetch token metadata:', error);
  }

  // Return basic token info if API fails
  return {
    currency,
    issuer,
    name: formatCurrencyCode(currency),
    symbol: formatCurrencyCode(currency),
    icon: getTokenIconUrl(currency, issuer),
    decimals: 15,
  };
}

/**
 * Get token prices from OnTheDex
 */
export async function getTokenPrices(tokens: string[]): Promise<Record<string, number>> {
  // Return cached prices if still valid
  if (priceCache && Date.now() - priceCache.timestamp < PRICES_CACHE_DURATION) {
    return priceCache.prices;
  }

  const prices: Record<string, number> = {};

  try {
    // Batch request to OnTheDex
    const tokenIds = tokens.join('+');
    const response = await fetch(`${ONTHEDEX_API}/ticker/${tokenIds}`);

    if (response.ok) {
      const data = await response.json();

      for (const ticker of data.tickers || []) {
        const id = getTokenId(ticker.base.currency, ticker.base.issuer);
        prices[id] = ticker.last || 0;
      }
    }
  } catch (error) {
    console.error('Failed to fetch prices:', error);
  }

  // Update cache
  priceCache = {
    prices,
    timestamp: Date.now(),
  };

  return prices;
}

/**
 * Validate if a token exists on XRPL
 */
export async function validateToken(currency: string, issuer: string): Promise<boolean> {
  try {
    const response = await fetch(`${XRPL_META_API}/token/${currency}:${issuer}`);
    return response.ok;
  } catch {
    return false;
  }
}

// ==================== COMMON TOKENS ====================

/**
 * Well-known tokens for quick access
 */
export const COMMON_TOKENS: XRPLToken[] = [
  {
    currency: 'XRP',
    issuer: '',
    name: 'XRP',
    symbol: 'XRP',
    icon: 'https://cdn.bithomp.com/xrp.svg',
    decimals: 6,
  },
  {
    currency: 'RLUSD',
    issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
    name: 'Ripple USD',
    symbol: 'RLUSD',
    icon: getTokenIconUrl('RLUSD', 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'),
    decimals: 15,
    verified: true,
  },
  {
    currency: 'SOLO',
    issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz',
    name: 'Sologenic',
    symbol: 'SOLO',
    icon: getTokenIconUrl('SOLO', 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz'),
    decimals: 15,
    verified: true,
  },
  {
    currency: 'CSC',
    issuer: 'rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr',
    name: 'CasinoCoin',
    symbol: 'CSC',
    icon: getTokenIconUrl('CSC', 'rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr'),
    decimals: 15,
    verified: true,
  },
  {
    currency: 'XRPH',
    issuer: 'rNmKNMsHnpLmLXKL3bvwnqsr6MwxfPGvJf',
    name: 'XRPHealthcare',
    symbol: 'XRPH',
    icon: getTokenIconUrl('XRPH', 'rNmKNMsHnpLmLXKL3bvwnqsr6MwxfPGvJf'),
    decimals: 15,
    verified: true,
  },
  {
    currency: 'BEAR',
    issuer: 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW',
    name: 'BEAR Token',
    symbol: 'BEAR',
    icon: getTokenIconUrl('BEAR', 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW'),
    decimals: 15,
  },
];

/**
 * Get XRP token constant
 */
export const XRP_TOKEN: Token = COMMON_TOKENS[0];

// ==================== PRELOAD ====================

/**
 * Preload tokens on app start
 */
export function preloadTokens(): void {
  // Start fetching in background
  getAllTokens().catch(console.error);
}
