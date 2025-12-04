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
const XRPSCAN_API = 'https://api.xrpscan.com/api/v1';
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
let popularTokensCacheTime: number = 0;

// ==================== LOCAL ICONS ====================

/**
 * Map of tokens with local SVG icons (hosted on our server)
 * These are guaranteed to work - no external CDN dependencies!
 */
const LOCAL_TOKEN_ICONS: Record<string, string> = {
  'XRP': '/tokens/xrp.svg',
  'BEAR:rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW': '/tokens/bear.svg',
  'RLUSD:rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De': '/tokens/rlusd.svg',
  'SOLO:rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz': '/tokens/solo.svg',
  'CORE:rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D': '/tokens/core.svg',
  'XRPH:rNmKNMsHnpLmLXKL3bvwnqsr6MwxfPGvJf': '/tokens/xrph.svg',
  'FUZZY:rhCAT4hRdi1J4fh1LK5qcUTsVcGWxNpVjh': '/tokens/fuzzy.svg',
  'ARMY:rGG3wQ4kfSgJgHRpWPAu5NxVA18q6gcSnZ': '/tokens/army.svg',
  'DROP:rszenFJoDdicWqfK2F9U9VWTxqEfB2HNJ6': '/tokens/drop.svg',
  'VGB:rhcyBrowwApgNonehVqrg6JgzqaM1DLRv8': '/tokens/vgb.svg',
  'MAG:rXmagwMmnFtVet3uL26Q2iwk287SxYHov': '/tokens/mag.svg',
  'XPM:rXPMxBeefHGxx3Z3CMFqwzGi3Vt19LHvCR': '/tokens/xpm.svg',
  'XMEME:rMeMEz93gAbQfs5LB9bR9XFXBC9u6NEVYt': '/tokens/xmeme.svg',
  'USDC:rGm7uYknXfn7RhNzEuvwu4p98f3hkRzWhE': '/tokens/usdc.svg',
  'EUROP:rMkEJxjXRV7SvDaGP3tX4MQ3pWyvnfLLjg': '/tokens/europ.svg',
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get token icon URL - LOCAL FIRST, then CDN fallback
 */
export function getTokenIconUrl(currency: string, issuer?: string): string {
  // Check for local icon first (always works!)
  if (currency === 'XRP') {
    return '/tokens/xrp.svg';
  }

  const localKey = `${currency}:${issuer}`;
  if (LOCAL_TOKEN_ICONS[localKey]) {
    return LOCAL_TOKEN_ICONS[localKey];
  }

  if (!issuer) {
    return '';
  }

  // Fallback to CDN
  return `${XRPL_META_API}/token/${currency}:${issuer}/icon`;
}

/**
 * Get multiple icon URLs to try (LOCAL FIRST, then CDN fallbacks)
 */
export function getTokenIconUrls(currency: string, issuer?: string): string[] {
  if (currency === 'XRP') {
    return ['/tokens/xrp.svg'];
  }

  const localKey = `${currency}:${issuer}`;
  const urls: string[] = [];

  // LOCAL ICON FIRST (always works!)
  if (LOCAL_TOKEN_ICONS[localKey]) {
    urls.push(LOCAL_TOKEN_ICONS[localKey]);
  }

  if (!issuer) {
    return urls;
  }

  // Then try CDNs as fallback for tokens without local icons
  urls.push(
    `${XRPL_META_API}/token/${currency}:${issuer}/icon`,
    `${BITHOMP_CDN}/token/${currency}.${issuer}.png`,
    `https://cdn.xrplmeta.org/icon/${currency}:${issuer}`,
  );

  return urls;
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

  // 4. Try XRPScan API for even more tokens
  try {
    const response = await fetch(`${XRPSCAN_API}/names/${encodeURIComponent(query)}`);
    if (response.ok) {
      const data = await response.json();
      // XRPScan returns account names, but we can use it to find tokens
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.account && item.name) {
            // This is an issuer - check if we can find tokens from them
            const issuer = item.account;
            const name = item.name.toLowerCase();
            if (name.includes(lowerQuery)) {
              // Try to get tokens from this issuer via XRPL Meta
              try {
                const tokensResp = await fetch(`${XRPL_META_API}/issuer/${issuer}/tokens?limit=10`);
                if (tokensResp.ok) {
                  const tokensData = await tokensResp.json();
                  for (const t of tokensData.tokens || []) {
                    const token = parseXRPLMetaToken(t);
                    if (token) addToken(token);
                  }
                }
              } catch {}
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('XRPScan search error:', error);
  }

  // 5. Search in cached tokens
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
 * Get popular/featured tokens - Top tokens by 24h volume from OnTheDex
 * BEAR token is ALWAYS at the top!
 */
export async function getPopularTokens(): Promise<XRPLToken[]> {
  // Use short cache for popular tokens (30 seconds)
  if (popularTokensCache && Date.now() - (popularTokensCacheTime || 0) < 30000) {
    return popularTokensCache;
  }

  try {
    // Fetch ALL traded tokens from OnTheDex
    const onTheDexTokens = await fetchOnTheDexTokens();

    // Sort by 24h volume (highest first) - this gives us the most active tokens
    const sortedByVolume = [...onTheDexTokens].sort((a, b) => {
      return (b.volume24h || 0) - (a.volume24h || 0);
    });

    // Take top 50 by volume (excluding BEAR since we'll add it at top)
    const topTokens = sortedByVolume
      .filter(t => !(t.currency === 'BEAR' && t.issuer === 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW'))
      .slice(0, 49);

    // Get BEAR token from the list or use our defined one
    const bearFromList = sortedByVolume.find(
      t => t.currency === 'BEAR' && t.issuer === 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW'
    );
    const bearToken = bearFromList || COMMON_TOKENS.find(t => t.currency === 'BEAR')!;

    // BEAR always at top!
    popularTokensCache = [bearToken, ...topTokens];
    popularTokensCacheTime = Date.now();

    return popularTokensCache;
  } catch (error) {
    console.error('Failed to fetch popular tokens:', error);
    // Fallback to common tokens with BEAR at top
    const bear = COMMON_TOKENS.find(t => t.currency === 'BEAR')!;
    const others = COMMON_TOKENS.filter(t => t.currency !== 'BEAR');
    return [bear, ...others];
  }
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
 * BEAR is FIRST - it's our token!
 */
export const COMMON_TOKENS: XRPLToken[] = [
  // BEAR is ALWAYS first!
  {
    currency: 'BEAR',
    issuer: 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW',
    name: 'BEAR Token',
    symbol: 'BEAR',
    icon: getTokenIconUrl('BEAR', 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW'),
    decimals: 15,
  },
  {
    currency: 'XRP',
    issuer: '',
    name: 'XRP',
    symbol: 'XRP',
    icon: '/tokens/xrp.svg',
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
  // Top memecoins from First Ledger
  {
    currency: 'FUZZY',
    issuer: 'rhCAT4hRdi1J4fh1LK5qcUTsVcGWxNpVjh',
    name: 'Fuzzy',
    symbol: 'FUZZY',
    icon: getTokenIconUrl('FUZZY', 'rhCAT4hRdi1J4fh1LK5qcUTsVcGWxNpVjh'),
    decimals: 15,
  },
  {
    currency: 'ARMY',
    issuer: 'rGG3wQ4kfSgJgHRpWPAu5NxVA18q6gcSnZ',
    name: 'Army',
    symbol: 'ARMY',
    icon: getTokenIconUrl('ARMY', 'rGG3wQ4kfSgJgHRpWPAu5NxVA18q6gcSnZ'),
    decimals: 15,
  },
  {
    currency: 'DROP',
    issuer: 'rszenFJoDdicWqfK2F9U9VWTxqEfB2HNJ6',
    name: 'Drop',
    symbol: 'DROP',
    icon: getTokenIconUrl('DROP', 'rszenFJoDdicWqfK2F9U9VWTxqEfB2HNJ6'),
    decimals: 15,
  },
  {
    currency: 'VGB',
    issuer: 'rhcyBrowwApgNonehVqrg6JgzqaM1DLRv8',
    name: 'VGB',
    symbol: 'VGB',
    icon: getTokenIconUrl('VGB', 'rhcyBrowwApgNonehVqrg6JgzqaM1DLRv8'),
    decimals: 15,
  },
  {
    currency: 'MAG',
    issuer: 'rXmagwMmnFtVet3uL26Q2iwk287SxYHov',
    name: 'Magnetic',
    symbol: 'MAG',
    icon: getTokenIconUrl('MAG', 'rXmagwMmnFtVet3uL26Q2iwk287SxYHov'),
    decimals: 15,
  },
  {
    currency: 'XPM',
    issuer: 'rXPMxBeefHGxx3Z3CMFqwzGi3Vt19LHvCR',
    name: 'XPMarket',
    symbol: 'XPM',
    icon: getTokenIconUrl('XPM', 'rXPMxBeefHGxx3Z3CMFqwzGi3Vt19LHvCR'),
    decimals: 15,
  },
  {
    currency: 'XMEME',
    issuer: 'rMeMEz93gAbQfs5LB9bR9XFXBC9u6NEVYt',
    name: 'XMeme',
    symbol: 'XMEME',
    icon: getTokenIconUrl('XMEME', 'rMeMEz93gAbQfs5LB9bR9XFXBC9u6NEVYt'),
    decimals: 15,
  },
];

/**
 * Get XRP token constant
 */
export const XRP_TOKEN: Token = COMMON_TOKENS.find(t => t.currency === 'XRP')!;

/**
 * Get BEAR token constant
 */
export const BEAR_TOKEN: Token = COMMON_TOKENS[0]; // BEAR is always first!

// ==================== PRELOAD ====================

/**
 * Preload tokens on app start
 */
export function preloadTokens(): void {
  // Start fetching in background
  getAllTokens().catch(console.error);
}
