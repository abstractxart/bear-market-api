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

// ==================== TOKEN ICONS (DexScreener CDN) ====================

/**
 * REAL token icons from DexScreener CDN - same as First Ledger uses!
 * Format: 'SYMBOL:issuer' -> 'https://cdn.dexscreener.com/cms/images/...'
 */
const DEXSCREENER_ICONS: Record<string, string> = {
  // Top tokens with verified DexScreener icons
  'BEAR:rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW': 'https://cdn.dexscreener.com/cms/images/aa9f8178c7bd1e8b6ec7d36c26ade56149f751a3227ff9df763030034739bbe5',
  'MAG:rXmagwMmnFtVet3uL26Q2iwk287SxYHov': 'https://cdn.dexscreener.com/cms/images/23a66da0d3b631ebec758f5cfd0c85a6ca98dbb9cf2b7340be9bd0069b8c1a3c',
  'XPM:rXPMxBeefHGxx3Z3CMFqwzGi3Vt19LHvCR': 'https://cdn.dexscreener.com/cms/images/52e1af2085e486325ba71f8290551f469a08a24afd9f35b7a91201c0de525506',
  'ARMY:rGG3wQ4kfSgJgHRpWPAu5NxVA18q6gcSnZ': 'https://cdn.dexscreener.com/cms/images/ed1f6d19db7e44c91785ffa0d1082ffb3e0a0da0c93027d307ccb246e17cdb92',
  'FUZZY:rhCAT4hRdi1J4fh1LK5qcUTsVcGWxNpVjh': 'https://cdn.dexscreener.com/cms/images/3cf16daefe237f160d943e53324a200b90fbe982ea43300c872c5f5bca60941c',
  'DROP:rszenFJoDdicWqfK2F9U9VWTxqEfB2HNJ6': 'https://cdn.dexscreener.com/cms/images/237caaf20769c4f611c3c242dc33da0c665c22fd2240c44f989f04a8514d5811',
  'CSC:rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr': 'https://cdn.dexscreener.com/cms/images/7961c5de7298f3436610f8c496dd142561251933133b6382178ff71482ba1de9',
  'PHNIX': 'https://cdn.dexscreener.com/cms/images/45ac1f4fde3c704c57789ac0399336cbb1b9afc6724b3ffd76b2a6b344ef0089',
  'SLT': 'https://cdn.dexscreener.com/cms/images/2447af16f7dbc28426615c32424277fecf0f5e5968198f441acaa46c1d8f8bbe',
  'SIGMA': 'https://cdn.dexscreener.com/cms/images/0d842ca17f4b5ab92f237abf8c2aa47b6fed14b5e420645d3473f4a1bedbb652',
  'CULT': 'https://cdn.dexscreener.com/cms/images/c64a0f792ff19f8468f898280fa67ed85cbde57e15d374dad6188cb39355cacc',
  'JELLY': 'https://cdn.dexscreener.com/cms/images/a635c021e7a0ada3163e5e12b052b6e637ad3bb7013b1c2b13a7206c8d3ed892',
  'GOAT': 'https://cdn.dexscreener.com/cms/images/86db2add041f94699931d7d0a845da3c7f154f5ef8e55027c475c0beaa459731',
  'OLX': 'https://cdn.dexscreener.com/cms/images/4bd3efc5218579a57c9d213e09df10ee3b2f89cf47af1510ffa1db17bf8604b8',
  'CO2': 'https://cdn.dexscreener.com/cms/images/c9f7be92f53c521cc090912c47e5d749f2c3f721a2f9b5e0ae5cc15c1dce41e5',
  'MALLARD': 'https://cdn.dexscreener.com/cms/images/f6b5ef097295e1b083d6d2832022615980d1d90d681a95b45f7b5de2c49b64f1',
  '666': 'https://cdn.dexscreener.com/cms/images/44fe722a5aea5847e8ed441246d8d0a604654f60a22da3e4ec82264fd7e287cf',
  '589': 'https://cdn.dexscreener.com/cms/images/4a0969cf5787f495af665a95dfbfaf80c29c46ed93514b642e892d37a7291e46',
  'DONNIE': 'https://cdn.dexscreener.com/cms/images/80fdacbe116bd052b11327e926aab415197a33609b0c648854e1d98713197ef3',
  'SEAL': 'https://cdn.dexscreener.com/cms/images/69878be5f14ae0e0cbaaa45178d3190ae38b97d51ab2882b60ba8ef2349dd2f9',
  'CBIRD': 'https://cdn.dexscreener.com/cms/images/c63349105d407605fd2908c1bbc34af4dea74b68e50fdda51ee2b65c78d34212',
  'FLIPPY': 'https://cdn.dexscreener.com/cms/images/c7dfd777f4c7ba098acbaa9bb63816a6b86c6aa8ac1321bfdd3fab4b891f28e3',
  '$FLIPPY': 'https://cdn.dexscreener.com/cms/images/c7dfd777f4c7ba098acbaa9bb63816a6b86c6aa8ac1321bfdd3fab4b891f28e3',
  'BERT': 'https://cdn.dexscreener.com/cms/images/d85a51a786ac61c7668ae38c256eab88a77dc87b3af7acd1c82e3145a45df1b3',
  'PIGEONS': 'https://cdn.dexscreener.com/cms/images/5fa79ec7f125929e17daa181f8c297898712d973679cfc3227edcb299c36259c',
  'ATM': 'https://cdn.dexscreener.com/cms/images/b912ada213e37a79135c3ee3c8ca21818b5c4dce5db5f8909fd4654fcc850caf',
  'Horizon': 'https://cdn.dexscreener.com/cms/images/f911fea0b87e05aa260aab697dfd7e8e12f6816297d048e9afa3512b6ca74d0e',
  'Opulence': 'https://cdn.dexscreener.com/cms/images/2e378aded56e20773293e584bc61c915c8e8c8972545d568b14aed250af28c87',
  'bull': 'https://cdn.dexscreener.com/cms/images/364494165161887247a37fafc7691d300191ad605b9408faf5aeefea82c75a00',
  'scrap': 'https://cdn.dexscreener.com/cms/images/26837eb3fc7c1d2f7f060adad69e1aa50b3c2ffcba72b760ac6d9b97359450b9',
  'XDawgs': 'https://cdn.dexscreener.com/cms/images/795c5d8e76b2e0df8c48740e1f37a6104695dfbca8a99eeef4aa83b0c2fc28b6',
  'COBALT': 'https://cdn.dexscreener.com/cms/images/394986e68744d2f78f1a83dccb13a8e91adace7e51ec700c93ec44ec52327177',
};

// Dynamic icon cache from DexScreener API
const dynamicIconCache: Record<string, string | null> = {};
const pendingIconFetches: Record<string, Promise<string | null>> = {};

/**
 * Fetch icon from DexScreener API dynamically
 */
async function fetchDexScreenerIcon(currency: string): Promise<string | null> {
  const cacheKey = currency;

  // Return cached result
  if (cacheKey in dynamicIconCache) {
    return dynamicIconCache[cacheKey];
  }

  // Return pending fetch if exists
  if (cacheKey in pendingIconFetches) {
    return pendingIconFetches[cacheKey];
  }

  // Start new fetch
  pendingIconFetches[cacheKey] = (async () => {
    try {
      const response = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(currency)}`);
      if (!response.ok) return null;

      const data = await response.json();
      const pairs = data.pairs || [];

      // Find XRPL pair with matching currency
      for (const pair of pairs) {
        if (pair.chainId === 'xrpl' && pair.info?.imageUrl) {
          const symbol = pair.baseToken?.symbol?.toUpperCase();
          if (symbol === currency.toUpperCase()) {
            dynamicIconCache[cacheKey] = pair.info.imageUrl;
            return pair.info.imageUrl;
          }
        }
      }

      dynamicIconCache[cacheKey] = null;
      return null;
    } catch {
      dynamicIconCache[cacheKey] = null;
      return null;
    } finally {
      delete pendingIconFetches[cacheKey];
    }
  })();

  return pendingIconFetches[cacheKey];
}

// Export for use in components
export { fetchDexScreenerIcon };

/**
 * Local fallback SVG icons (for XRP and tokens without DexScreener icons)
 */
const LOCAL_TOKEN_ICONS: Record<string, string> = {
  'XRP': '/tokens/xrp.svg',
  'RLUSD:rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De': '/tokens/rlusd.svg',
  'SOLO:rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz': '/tokens/solo.svg',
  'CORE:rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D': '/tokens/core.svg',
  'XRPH:rNmKNMsHnpLmLXKL3bvwnqsr6MwxfPGvJf': '/tokens/xrph.svg',
  'VGB:rhcyBrowwApgNonehVqrg6JgzqaM1DLRv8': '/tokens/vgb.svg',
  'XMEME:rMeMEz93gAbQfs5LB9bR9XFXBC9u6NEVYt': '/tokens/xmeme.svg',
  'USDC:rGm7uYknXfn7RhNzEuvwu4p98f3hkRzWhE': '/tokens/usdc.svg',
  'EUROP:rMkEJxjXRV7SvDaGP3tX4MQ3pWyvnfLLjg': '/tokens/europ.svg',
  // User requested tokens
  'SPIFFY': '/tokens/spiffy.svg',
  'FARM': '/tokens/farm.svg',
  'PUPPET': '/tokens/puppet.svg',
};

// ==================== HELPER FUNCTIONS ====================

// XMagnetic CDN - predictable URL pattern for ALL XRPL tokens!
const XMAGNETIC_CDN = 'https://img.xmagnetic.org/u';

/**
 * Get token icon URL - XMagnetic CDN (predictable pattern!) then fallbacks
 */
export function getTokenIconUrl(currency: string, issuer?: string): string {
  // XRP always uses local
  if (currency === 'XRP') {
    return '/tokens/xrp.svg';
  }

  const fullKey = `${currency}:${issuer}`;

  // 1. Check local icons first (fastest)
  if (LOCAL_TOKEN_ICONS[fullKey]) {
    return LOCAL_TOKEN_ICONS[fullKey];
  }
  if (LOCAL_TOKEN_ICONS[currency]) {
    return LOCAL_TOKEN_ICONS[currency];
  }

  // 2. Check hardcoded DexScreener icons
  if (DEXSCREENER_ICONS[fullKey]) {
    return DEXSCREENER_ICONS[fullKey];
  }
  if (DEXSCREENER_ICONS[currency]) {
    return DEXSCREENER_ICONS[currency];
  }

  // 3. XMagnetic CDN - predictable pattern for ANY token with issuer!
  if (issuer) {
    return `${XMAGNETIC_CDN}/${issuer}_${currency}.webp`;
  }

  return '';
}

/**
 * Get multiple icon URLs to try - XMagnetic FIRST (works for most XRPL tokens!)
 */
export function getTokenIconUrls(currency: string, issuer?: string): string[] {
  if (currency === 'XRP') {
    return ['/tokens/xrp.svg'];
  }

  const fullKey = `${currency}:${issuer}`;
  const urls: string[] = [];

  // 1. XMagnetic CDN FIRST - predictable pattern, works for most tokens!
  if (issuer) {
    urls.push(`${XMAGNETIC_CDN}/${issuer}_${currency}.webp`);
  }

  // 2. Local fallback icons
  if (LOCAL_TOKEN_ICONS[fullKey]) {
    urls.push(LOCAL_TOKEN_ICONS[fullKey]);
  } else if (LOCAL_TOKEN_ICONS[currency]) {
    urls.push(LOCAL_TOKEN_ICONS[currency]);
  }

  // 3. DexScreener CDN (hardcoded)
  if (DEXSCREENER_ICONS[fullKey]) {
    urls.push(DEXSCREENER_ICONS[fullKey]);
  } else if (DEXSCREENER_ICONS[currency]) {
    urls.push(DEXSCREENER_ICONS[currency]);
  }

  if (!issuer) {
    return urls;
  }

  // 4. Other CDNs as last resort
  urls.push(
    `${XRPL_META_API}/token/${currency}:${issuer}/icon`,
    `${BITHOMP_CDN}/token/${currency}.${issuer}.png`,
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

// Cache for BEAR price from DexScreener
let bearPriceCache: { price?: number; volume24h?: number; priceChange24h?: number } | null = null;
let bearPriceCacheTime = 0;

/**
 * Fetch BEAR token price from DexScreener API
 * OnTheDex doesn't have BEAR, so we use DexScreener
 */
async function fetchBearPriceFromDexScreener(): Promise<{ price?: number; volume24h?: number; priceChange24h?: number }> {
  // Return cache if valid (30 seconds)
  if (bearPriceCache && Date.now() - bearPriceCacheTime < 30000) {
    return bearPriceCache;
  }

  try {
    const response = await fetch('https://api.dexscreener.com/latest/dex/search?q=BEAR%20xrpl');
    if (!response.ok) return {};

    const data = await response.json();
    const pairs = data.pairs || [];

    // Find BEAR on XRPL
    for (const pair of pairs) {
      if (pair.chainId === 'xrpl') {
        const baseToken = pair.baseToken;
        if (baseToken?.symbol?.toUpperCase() === 'BEAR') {
          // Check if it's our BEAR token (issuer contains 'rBEARGU')
          const address = baseToken.address || '';
          if (address.includes('rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW')) {
            bearPriceCache = {
              price: pair.priceNative ? parseFloat(pair.priceNative) : undefined,
              volume24h: pair.volume?.h24 || 0,
              priceChange24h: pair.priceChange?.h24,
            };
            bearPriceCacheTime = Date.now();
            return bearPriceCache;
          }
        }
      }
    }

    return {};
  } catch (error) {
    console.error('Failed to fetch BEAR price from DexScreener:', error);
    return {};
  }
}

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
 * Search tokens using DexScreener API - finds ALL XRPL tokens!
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

  // 1. DexScreener API FIRST - has ALL XRPL tokens!
  try {
    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`
    );

    if (response.ok) {
      const data = await response.json();
      const pairs = data.pairs || [];

      for (const pair of pairs) {
        // Only XRPL tokens
        if (pair.chainId !== 'xrpl') continue;

        const baseToken = pair.baseToken;
        if (!baseToken) continue;

        // Parse the address - format is "CURRENCY.issuer" or hex
        const address = baseToken.address || '';
        let currency = baseToken.symbol || '';
        let issuer = '';

        // Extract issuer from address (format: "hex.issuer" or "SYMBOL.issuer")
        if (address.includes('.')) {
          const parts = address.split('.');
          issuer = parts[1] || '';
        }

        if (!issuer) continue;

        // Decode hex currency if needed
        currency = formatCurrencyCode(currency);

        const token: XRPLToken = {
          currency: baseToken.symbol || currency,
          issuer,
          name: baseToken.name || currency,
          symbol: baseToken.symbol || currency,
          icon: getTokenIconUrl(baseToken.symbol || currency, issuer),
          decimals: 15,
          price: pair.priceUsd ? parseFloat(pair.priceUsd) : undefined,
          volume24h: pair.volume?.h24 || 0,
          priceChange24h: pair.priceChange?.h24,
        };

        addToken(token);
      }
    }
  } catch (error) {
    console.error('DexScreener search error:', error);
  }

  // 2. Also search COMMON_TOKENS
  for (const token of COMMON_TOKENS) {
    if (matchesQuery(token)) {
      addToken(token);
    }
  }

  // 3. Fetch and search OnTheDex tokens
  try {
    const onTheDexTokens = await fetchOnTheDexTokens();
    for (const token of onTheDexTokens) {
      if (matchesQuery(token)) {
        addToken(token);
      }
    }
  } catch (error) {
    console.error('OnTheDex search error:', error);
  }

  // 4. Try XRPL Meta API for additional tokens
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

  // 5. Try XRPScan API for even more tokens
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
 * BEAR token is ALWAYS at the top with price from DexScreener!
 */
export async function getPopularTokens(): Promise<XRPLToken[]> {
  // Use short cache for popular tokens (30 seconds)
  if (popularTokensCache && Date.now() - (popularTokensCacheTime || 0) < 30000) {
    return popularTokensCache;
  }

  try {
    // Fetch ALL traded tokens from OnTheDex AND BEAR price from DexScreener
    const [onTheDexTokens, bearPrice] = await Promise.all([
      fetchOnTheDexTokens(),
      fetchBearPriceFromDexScreener(),
    ]);

    // Sort by 24h volume (highest first) - this gives us the most active tokens
    const sortedByVolume = [...onTheDexTokens].sort((a, b) => {
      return (b.volume24h || 0) - (a.volume24h || 0);
    });

    // Take top 50 by volume (excluding BEAR since we'll add it at top)
    const topTokens = sortedByVolume
      .filter(t => !(t.currency === 'BEAR' && t.issuer === 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW'))
      .slice(0, 49);

    // Get BEAR token - use COMMON_TOKENS info with DexScreener price data
    const bearBase = COMMON_TOKENS.find(t => t.currency === 'BEAR')!;

    // Merge: use nice name/icon from COMMON_TOKENS, but price data from DexScreener
    const bearToken: XRPLToken = {
      ...bearBase,
      price: bearPrice.price,
      volume24h: bearPrice.volume24h,
      priceChange24h: bearPrice.priceChange24h,
    };

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
    name: 'BEAR',
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
