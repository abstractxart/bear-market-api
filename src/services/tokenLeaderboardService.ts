/**
 * BEAR MARKET - Token Leaderboard Service
 *
 * INDEPENDENCE MODE ACTIVATED! 🐻
 *
 * PRIMARY SOURCE: XRPL LEDGER DIRECT (NO THIRD PARTY!)
 * FALLBACK: DexScreener, OnTheDex, xrpl.to
 *
 * We don't NEED anyone else - we query the blockchain directly!
 */

import type { LeaderboardToken } from '../types';
import { getTokenIconUrl, getTokenIconUrls } from './tokenService';

// ==================== CONFIGURATION ====================

// Use Vite proxy in dev, direct API in production
const XRPL_TO_API = import.meta.env.DEV ? '/api/xrplto' : 'https://api.xrpl.to/api';
const ONTHEDEX_API = 'https://api.onthedex.live/public/v1';
const DEXSCREENER_API = 'https://api.dexscreener.com/latest/dex';
const XRPL_META_API = 'https://s1.xrplmeta.org';

// Backend proxy for CORS
const API_PROXY = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * BLAZING FAST fetch with 2 second timeout
 */
async function fastFetch(url: string, timeoutMs = 2000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      mode: 'cors',
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Smart fetch - tries direct fetch first, falls back to proxy
 * FAST: 2 second timeouts
 */
async function smartFetch(url: string): Promise<Response> {
  // Try direct fetch first (faster, no proxy needed if CORS is allowed)
  try {
    const directResponse = await fastFetch(url, 2000);
    if (directResponse.ok) {
      return directResponse;
    }
  } catch {
    // CORS blocked, timeout, or network error - try proxy
  }

  // Fall back to proxy (with 2s timeout)
  const proxyUrl = `${API_PROXY}/api/proxy?url=${encodeURIComponent(url)}`;
  return fastFetch(proxyUrl, 2000);
}

// Legacy function for backward compatibility
async function proxyFetch(url: string): Promise<Response> {
  return smartFetch(url);
}

// ==================== CACHE ====================

interface LeaderboardCache {
  tokens: LeaderboardToken[];
  timestamp: number;
}

let leaderboardCache: LeaderboardCache | null = null;
const CACHE_DURATION = 60 * 1000; // 60 seconds - longer cache = faster loads
const STALE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes - can use stale data while refreshing

// Preload promise - tracks if we're already loading
let preloadPromise: Promise<LeaderboardToken[]> | null = null;

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
  // Scam meme tokens
  'COREUM7C8EB29E07',
  'SGBENJI',
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
 * Filter out scam/fake tokens and tokens with missing data
 */
function filterScamTokens(tokens: LeaderboardToken[]): LeaderboardToken[] {
  return tokens.filter(token => {
    // CRITICAL: Filter out tokens with completely missing currency/symbol
    if (!token.currency && !token.symbol) {
      console.log(`[Leaderboard] Filtered token with missing currency/symbol: ${token.issuer?.slice(0, 8)}...`);
      return false;
    }

    // Filter out tokens with missing issuer
    if (!token.issuer) {
      console.log(`[Leaderboard] Filtered token with missing issuer: ${token.currency}`);
      return false;
    }

    // Always allow trusted issuers
    if (TRUSTED_ISSUERS.has(token.issuer || '')) {
      return true;
    }

    // Check if token name/currency matches a scam pattern
    const upperCurrency = (token.currency || '').toUpperCase();
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
 * PRELOAD tokens on app start - call this in App.tsx!
 * Ensures tokens are ready BEFORE user opens the selector
 */
export function preloadLeaderboardTokens(): void {
  if (preloadPromise) return; // Already loading
  if (leaderboardCache && Date.now() - leaderboardCache.timestamp < CACHE_DURATION) return; // Fresh cache

  console.log('[Leaderboard] ⚡ PRELOADING tokens in background...');
  preloadPromise = fetchTokensFromAllSources()
    .then(tokens => {
      leaderboardCache = { tokens, timestamp: Date.now() };
      console.log(`[Leaderboard] ⚡ PRELOAD COMPLETE: ${tokens.length} tokens ready!`);
      preloadPromise = null;
      return tokens;
    })
    .catch(err => {
      console.error('[Leaderboard] Preload failed:', err);
      preloadPromise = null;
      return [];
    });
}

/**
 * Get all tokens for the leaderboard - BLAZING FAST
 *
 * Strategy:
 * 1. Return cached data INSTANTLY if available (even if slightly stale)
 * 2. If preload is in progress, wait for it
 * 3. Otherwise fetch fresh data
 */
export async function getLeaderboardTokens(forceRefresh = false): Promise<LeaderboardToken[]> {
  const startTime = Date.now();

  // INSTANT: Return fresh cache immediately
  if (!forceRefresh && leaderboardCache && Date.now() - leaderboardCache.timestamp < CACHE_DURATION) {
    console.log(`[Leaderboard] ⚡ INSTANT cache hit: ${leaderboardCache.tokens.length} tokens in ${Date.now() - startTime}ms`);
    return leaderboardCache.tokens;
  }

  // If preload is in progress, wait for it (it's probably almost done)
  if (preloadPromise) {
    console.log('[Leaderboard] Waiting for preload...');
    const tokens = await preloadPromise;
    if (tokens.length > 0) {
      console.log(`[Leaderboard] ⚡ Preload complete: ${tokens.length} tokens in ${Date.now() - startTime}ms`);
      return tokens;
    }
  }

  // FAST: Return stale cache immediately, refresh in background
  if (!forceRefresh && leaderboardCache && Date.now() - leaderboardCache.timestamp < STALE_CACHE_DURATION) {
    console.log(`[Leaderboard] ⚡ Returning stale cache (${leaderboardCache.tokens.length} tokens), refreshing in background...`);
    // Refresh in background (don't await)
    fetchTokensFromAllSources().then(tokens => {
      leaderboardCache = { tokens, timestamp: Date.now() };
      console.log(`[Leaderboard] Background refresh complete: ${tokens.length} tokens`);
    }).catch(() => {});
    return leaderboardCache.tokens;
  }

  // No cache - fetch fresh
  console.log('[Leaderboard] Fetching fresh tokens...');
  const tokens = await fetchTokensFromAllSources();
  console.log(`[Leaderboard] ⚡ Fresh fetch: ${tokens.length} tokens in ${Date.now() - startTime}ms`);
  return tokens;
}

/**
 * Fetch tokens from all sources - XRPL META PRIMARY!
 *
 * Strategy:
 * 1. XRPL Meta has 176,528 tokens indexed! USE IT!
 * 2. Fall back to xrpl.to/DexScreener if needed
 */
async function fetchTokensFromAllSources(): Promise<LeaderboardToken[]> {
  try {
    console.log('[Leaderboard] 🐻 Fetching from XRPL Meta (176K+ tokens indexed!)...');

    // Try XRPL Meta FIRST - it has the most complete token data!
    try {
      const xrplMetaTokens = await fetchXrplMetaTokens();
      if (xrplMetaTokens.length >= 100) {
        console.log(`[Leaderboard] 🐻🐻🐻 XRPL META SUCCESS: ${xrplMetaTokens.length} tokens!`);

        // Filter scam tokens and sort
        let tokens = filterScamTokens(xrplMetaTokens);
        tokens = sortTokens(tokens);

        // Cache results
        leaderboardCache = {
          tokens,
          timestamp: Date.now(),
        };

        return tokens;
      }
    } catch (metaError) {
      console.warn('[Leaderboard] XRPL Meta failed, trying other sources:', metaError);
    }

    // Fallback to other sources
    console.log('[Leaderboard] Falling back to xrpl.to/DexScreener...');

    // Fetch ALL sources in parallel for speed - including XRPL Meta for holders!
    const [xrplToResult, onTheDexResult, dexScreenerResult, xrplMetaResult] = await Promise.allSettled([
      fetchXrplToTokens(),
      fetchOnTheDexTokens(),
      fetchDexScreenerXRPL(),
      fetchXrplMetaHolders(), // BACKUP source for holders data!
    ]);

    // Use xrpl.to if it succeeded, otherwise OnTheDex
    let tokens: LeaderboardToken[] = [];
    if (xrplToResult.status === 'fulfilled' && xrplToResult.value.length > 0) {
      tokens = xrplToResult.value;
      console.log(`[Leaderboard] Using xrpl.to: ${tokens.length} tokens`);
    } else if (onTheDexResult.status === 'fulfilled' && onTheDexResult.value.length > 0) {
      tokens = onTheDexResult.value;
      console.log(`[Leaderboard] Using OnTheDex fallback: ${tokens.length} tokens`);
    }

    // INDEPENDENCE MODE: If both xrpl.to and OnTheDex failed, BUILD our token list from DexScreener!
    // DexScreener has REAL prices and we can create tokens from their data
    if (tokens.length === 0 && dexScreenerResult.status === 'fulfilled' && dexScreenerResult.value.size > 0) {
      console.log(`[Leaderboard] 🐻 INDEPENDENCE MODE: Building token list from DexScreener!`);
      const dexTokens: LeaderboardToken[] = [];

      for (const [key, data] of dexScreenerResult.value.entries()) {
        const [currency, issuer] = key.split(':');
        if (!currency || !issuer) continue;

        // Clean currency name (remove $ prefix if present)
        const cleanCurrency = currency.replace(/^\$/, '');

        dexTokens.push({
          currency: cleanCurrency,
          issuer,
          name: cleanCurrency,
          symbol: cleanCurrency,
          icon: getTokenIconUrl(cleanCurrency, issuer),
          decimals: 15,
          price: data.price,
          priceChange5m: data.priceChange5m,
          priceChange1h: data.priceChange1h,
          priceChange24h: data.priceChange24h,
          marketCap: data.marketCap,
          fdv: data.fdv,
          createdAt: data.createdAt,
        });
      }

      tokens = dexTokens;
      console.log(`[Leaderboard] 🐻 Built ${tokens.length} tokens from DexScreener - WE ARE INDEPENDENT!`);
    }

    if (tokens.length === 0) {
      throw new Error('No tokens from any source');
    }

    // Merge DexScreener data IMMEDIATELY (for XRP prices!)
    if (dexScreenerResult.status === 'fulfilled') {
      tokens = mergeDexScreenerData(tokens, dexScreenerResult.value);
      console.log(`[Leaderboard] DexScreener merged for XRP prices`);
    }

    // Merge XRPL Meta holders data (backup for when xrpl.to doesn't have it)
    if (xrplMetaResult.status === 'fulfilled') {
      tokens = mergeXrplMetaData(tokens, xrplMetaResult.value);
    }

    // Filter scam tokens
    tokens = filterScamTokens(tokens);

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

// Cache XRP/USD rate to avoid fetching repeatedly
let cachedXrpUsdRate: number | null = null;
let xrpRateCacheTime = 0;
const XRP_RATE_CACHE_DURATION = 60 * 1000; // 1 minute

/**
 * Get XRP/USD exchange rate from CoinGecko (free, reliable, no auth needed)
 */
async function getXrpUsdRate(): Promise<number> {
  // Return cached rate if fresh
  if (cachedXrpUsdRate && Date.now() - xrpRateCacheTime < XRP_RATE_CACHE_DURATION) {
    return cachedXrpUsdRate;
  }

  try {
    // CoinGecko free API - no auth required, reliable XRP price
    const response = await fastFetch('https://api.coingecko.com/api/v3/simple/price?ids=ripple&vs_currencies=usd', 5000);
    if (response.ok) {
      const data = await response.json();
      // Response format: { "ripple": { "usd": 2.5 } }
      const rate = data?.ripple?.usd || 2.5; // fallback to ~$2.50
      cachedXrpUsdRate = rate;
      xrpRateCacheTime = Date.now();
      console.log(`[Leaderboard] XRP/USD rate: $${rate}`);
      return rate;
    }
  } catch {
    // Ignore errors, use cached or fallback
  }

  // Return cached rate or fallback
  return cachedXrpUsdRate || 2.5;
}

/**
 * Fetch tokens from xrpl.to API (primary source - best data quality)
 * Fetches multiple pages for comprehensive token coverage.
 */
async function fetchXrplToTokens(): Promise<LeaderboardToken[]> {
  const allTokens: LeaderboardToken[] = [];
  const seen = new Set<string>();
  const LIMIT = 100; // xrpl.to returns max 100 per page
  const MAX_PAGES = 5; // Fetch 500 tokens for comprehensive coverage

  try {
    // Fetch XRP/USD rate and token pages in parallel
    // TRY DIRECT FETCH FIRST - xrpl.to allows CORS!
    const [xrpUsdRate, ...results] = await Promise.all([
      getXrpUsdRate(),
      ...Array.from({ length: MAX_PAGES }, (_, page) => {
        const start = page * LIMIT;
        const url = `${XRPL_TO_API}/tokens?limit=${LIMIT}&start=${start}&sortType=desc&sortBy=vol24hxrp`;
        // Vite proxy handles CORS - direct fetch works!
        return fetch(url, { signal: AbortSignal.timeout(15000) }) // 15 second timeout - xrpl.to can be slow
          .then(res => {
            if (res.ok) return res.json();
            console.error(`[Leaderboard] xrpl.to failed for page ${page}: ${res.status}`);
            return null;
          })
          .catch(err => {
            console.error(`[Leaderboard] xrpl.to error for page ${page}:`, err.message);
            return null;
          });
      })
    ]);

    for (const data of results) {
      if (!data?.tokens) continue;

      for (const item of data.tokens) {
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

        // Calculate XRP price from USD price
        // XRP price = USD price / XRP-USD rate
        const usdPrice = parseFloat(item.usd) || 0;
        const xrpPrice = usdPrice > 0 && xrpUsdRate > 0 ? usdPrice / xrpUsdRate : undefined;

        // xrpl.to marketcap is in XRP! Convert to USD for display
        const marketCapXrp = item.marketcap > 0 ? item.marketcap : 0;
        const marketCapUsd = marketCapXrp > 0 && xrpUsdRate > 0 ? marketCapXrp * xrpUsdRate : undefined;

        // Try ALL possible field names for TVL
        const tvlValue = item.tvl || item.liquidity || item.tvlXrp || item.total_value_locked || 0;

        // Try ALL possible field names for holders
        const holdersValue = item.holders || item.holdersCount || item.holder_count ||
                            item.holderCount || item.trustlines || item.trustlineCount || 0;

        // Try ALL possible field names for 7d change
        const change7d = item.pro7d ?? item.change7d ?? item.pct7d ?? item.priceChange7d ?? undefined;

        allTokens.push({
          currency: currency || item.name,
          issuer: item.issuer,
          name: item.name || currency,
          symbol: item.name || currency,
          icon: getTokenIconUrl(currency, item.issuer),
          decimals: 15,
          // XRP price calculated from USD price / XRP-USD rate
          price: xrpPrice,
          priceChange5m: item.pro5m,
          priceChange1h: item.pro1h,
          priceChange24h: item.pro24h,
          priceChange7d: change7d,
          volume24h: item.vol24hxrp || 0,
          // Market cap converted from XRP to USD
          marketCap: marketCapUsd,
          // TVL in XRP
          tvl: tvlValue > 0 ? tvlValue : undefined,
          // Holders count
          holders: holdersValue > 0 ? holdersValue : undefined,
          trustlines: item.trustlines || item.trustlineCount || item.trustline_count,
          domain: item.domain,
          verified: item.kyc || item.verified,
        });
      }
    }

    console.log(`[Leaderboard] xrpl.to returned ${allTokens.length} tokens (XRP/USD: $${xrpUsdRate})`);
    return allTokens;
  } catch (error) {
    console.error('[Leaderboard] xrpl.to fetch failed:', error);
    return allTokens;
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
 * Fetch XRPL tokens from DexScreener - SOURCE OF TRUTH for prices!
 * Strategy: Search + query specific tokens for COMPLETE coverage
 */
async function fetchDexScreenerXRPL(): Promise<Map<string, Partial<LeaderboardToken>>> {
  const tokenMap = new Map<string, Partial<LeaderboardToken>>();

  try {
    // AGGRESSIVE SEARCH - Query DexScreener with MANY search terms to get ALL tokens!
    // Each search can return different results, so we cast a WIDE net
    const searchTerms = [
      'xrpl',           // General XRPL search
      'BEAR xrpl',      // BEAR token
      'SOLO xrpl',      // Sologenic
      'CORE xrpl',      // Coreum
      'ARMY xrpl',      // Army
      'RLUSD xrpl',     // Ripple USD
      'XPM xrpl',       // XPMarket
      'MAG xrpl',       // Magnetic
      'CSC xrpl',       // CasinoCoin
      'DROP xrpl',      // Drops
      'FUZZY xrpl',     // Fuzzy
      'PHNIX xrpl',     // Phoenix
      'SLT xrpl',       // SmartLands
      'XCORE xrpl',     // XCore
      'mXRP xrpl',      // Magnetic XRP
      'XHO xrpl',       // XHO
      'LIONS xrpl',     // Lions
      'TAZZ xrpl',      // Tazz
      'CULT xrpl',      // Cult
      '666 xrpl',       // 666
      'EVR xrpl',       // Evernode
      'XRPH xrpl',      // XRPH
      'SPY xrpl',       // Spy
      'Teddy xrpl',     // Teddy
      'NXS xrpl',       // Nexus
      '3RDEYE xrpl',    // Third Eye
      'COBALT xrpl',    // Cobalt
      'XDawgs xrpl',    // XDawgs
      'LESS xrpl',      // Less
    ];

    // Fire ALL searches in parallel - MAXIMUM SPEED!
    const searchPromises = searchTerms.map(term =>
      fetch(`${DEXSCREENER_API}/search?q=${encodeURIComponent(term)}`)
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    );

    const results = await Promise.all(searchPromises);

    // Process ALL search results
    let pairsProcessed = 0;
    for (const data of results) {
      if (!data?.pairs) continue;

      for (const pair of data.pairs) {
        if (pair.chainId !== 'xrpl') continue;
        processDexScreenerPair(pair, tokenMap);
        pairsProcessed++;
      }
    }

    console.log(`[Leaderboard] DexScreener: ${pairsProcessed} pairs processed, ${tokenMap.size} unique tokens with REAL prices!`);
    return tokenMap;

  } catch (error) {
    console.error('[Leaderboard] DexScreener fetch failed:', error);
    return tokenMap;
  }
}

/**
 * Process a DexScreener pair and add to token map
 */
function processDexScreenerPair(pair: any, tokenMap: Map<string, Partial<LeaderboardToken>>): void {
  const baseToken = pair.baseToken;
  if (!baseToken?.address) return;

  // Parse issuer from address (format: "HEX_CURRENCY.rISSUER")
  const issuer = baseToken.address.includes('.')
    ? baseToken.address.split('.')[1]
    : baseToken.address;

  // Get currency symbol - remove $ prefix if present for matching
  let currency = baseToken.symbol || '';
  const currencyClean = currency.replace(/^\$/, ''); // Remove leading $

  // Store with BOTH key formats for better matching
  const key1 = `${currency}:${issuer}`;
  const key2 = `${currencyClean}:${issuer}`;

  const tokenData: Partial<LeaderboardToken> = {
    // ACTUAL XRP trading price from DexScreener!
    price: pair.priceNative ? parseFloat(pair.priceNative) : undefined,
    priceChange5m: pair.priceChange?.m5,
    priceChange1h: pair.priceChange?.h1,
    priceChange24h: pair.priceChange?.h24,
    // DO NOT include tvl - we use xrpl.to XRP TVL only!
    // ACTUAL USD market cap from DexScreener!
    marketCap: pair.marketCap || pair.fdv || undefined,
    fdv: pair.fdv,
    createdAt: pair.pairCreatedAt,
    icon: pair.info?.imageUrl,
  };

  // Only update if new data has better market cap
  const existing1 = tokenMap.get(key1);
  const existing2 = tokenMap.get(key2);
  const newMarketCap = tokenData.marketCap || 0;

  if (!existing1 || (newMarketCap > (existing1.marketCap || 0))) {
    tokenMap.set(key1, tokenData);
  }
  if (key1 !== key2 && (!existing2 || (newMarketCap > (existing2.marketCap || 0)))) {
    tokenMap.set(key2, tokenData);
  }
}

/**
 * Fetch tokens ONLY from DexScreener + First Ledger
 * If it's not on these platforms, it's not worth showing!
 */
async function fetchXrplMetaTokens(): Promise<LeaderboardToken[]> {
  const tokens: LeaderboardToken[] = [];

  try {
    // STEP 1: Get ALL DexScreener XRPL tokens - this is our VERIFIED list
    console.log('[Leaderboard] 🔍 Fetching verified tokens from DexScreener...');
    const dexScreenerTokens = new Map<string, any>();

    // Search DexScreener for XRPL tokens
    const searchTerms = ['xrpl', 'BEAR xrpl', 'SOLO xrpl', 'CORE xrpl', 'RLUSD xrpl', 'XPM xrpl', 'MAG xrpl', 'CSC xrpl', 'EVR xrpl'];
    const dexPromises = searchTerms.map(term =>
      fetch(`${DEXSCREENER_API}/search?q=${encodeURIComponent(term)}`, { signal: AbortSignal.timeout(10000) })
        .then(r => r.ok ? r.json() : null)
        .catch(() => null)
    );

    const dexResults = await Promise.all(dexPromises);
    for (const data of dexResults) {
      if (!data?.pairs) continue;
      for (const pair of data.pairs) {
        if (pair.chainId !== 'xrpl') continue;
        const baseToken = pair.baseToken;
        if (!baseToken?.address) continue;

        // Parse issuer from address
        const issuer = baseToken.address.includes('.') ? baseToken.address.split('.')[1] : baseToken.address;
        const symbol = (baseToken.symbol || '').replace(/^\$/, '');
        const key = `${symbol}:${issuer}`;

        if (!dexScreenerTokens.has(key)) {
          dexScreenerTokens.set(key, {
            currency: symbol,
            issuer,
            name: baseToken.name || symbol,
            price: parseFloat(pair.priceNative) || 0,
            marketCap: pair.marketCap || pair.fdv || 0,
            priceChange24h: pair.priceChange?.h24 || 0,
            volume24h: pair.volume?.h24 || 0,
            icon: pair.info?.imageUrl,
          });
        }
      }
    }
    console.log(`[Leaderboard] ✅ DexScreener: ${dexScreenerTokens.size} verified XRPL tokens`);

    // STEP 2: Get First Ledger top tokens
    console.log('[Leaderboard] 🔍 Fetching from First Ledger (via XRPL Meta)...');
    const response = await fetch(`${XRPL_META_API}/tokens?limit=500&sort_by=marketcap&sort_order=desc`, {
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      console.error('[Leaderboard] XRPL Meta failed:', response.status);
      // Fall back to DexScreener only
      for (const [, data] of dexScreenerTokens) {
        tokens.push({
          currency: data.currency,
          issuer: data.issuer,
          name: data.name,
          symbol: data.currency,
          icon: data.icon || getTokenIconUrl(data.currency, data.issuer),
          decimals: 15,
          price: data.price,
          marketCap: data.marketCap,
          priceChange24h: data.priceChange24h,
          volume24h: data.volume24h,
        });
      }
      return tokens;
    }

    const metaData = await response.json();
    const metaTokens = metaData?.tokens || [];

    // STEP 3: Only include tokens that are:
    // A) On DexScreener (verified)
    // B) Have First Ledger icon (cdn.first-ledger.com)
    // C) Are trusted issuers (BEAR, SOLO, etc.)
    for (const token of metaTokens) {
      if (!token.currency || !token.issuer) continue;

      let currency = token.currency;
      if (currency.length === 40) {
        currency = decodeHexCurrency(currency);
      }

      const key = `${currency}:${token.issuer}`;
      const metrics = token.metrics || {};
      const meta = token.meta?.token || {};
      const issuerMeta = token.meta?.issuer || {};

      // Check if this token is VERIFIED
      const isOnDexScreener = dexScreenerTokens.has(key);
      const hasFirstLedgerIcon = meta.icon && meta.icon.includes('first-ledger.com');
      const isTrustedIssuer = TRUSTED_ISSUERS.has(token.issuer);
      const hasHighTrustLevel = (meta.trust_level || 0) >= 2;

      // STRICT FILTER: Must be on DexScreener OR First Ledger OR trusted
      if (!isOnDexScreener && !hasFirstLedgerIcon && !isTrustedIssuer && !hasHighTrustLevel) {
        continue; // NOT VERIFIED - SKIP!
      }

      const marketCap = parseFloat(metrics.marketcap) || 0;
      const price = parseFloat(metrics.price) || 0;
      const volume = parseFloat(metrics.volume_24h) || 0;
      const holdersCount = metrics.holders || 0;

      // Basic quality filters still apply
      if (currency.length === 1) continue;
      if (/^\d+$/.test(currency)) continue;
      if (price <= 0 && marketCap <= 0) continue;

      // Minimum 50 holders for non-trusted tokens
      if (!isTrustedIssuer && holdersCount < 50) continue;

      // Minimum volume filter (20 XRP)
      if (!isTrustedIssuer && volume < 20) continue;

      // Get DexScreener data if available (more accurate prices)
      const dexData = dexScreenerTokens.get(key);

      tokens.push({
        currency,
        issuer: token.issuer,
        name: meta.name || currency,
        symbol: currency,
        icon: meta.icon || dexData?.icon || getTokenIconUrl(currency, token.issuer),
        decimals: 15,
        price: dexData?.price || price,
        marketCap: dexData?.marketCap || marketCap || undefined,
        priceChange24h: dexData?.priceChange24h || undefined,
        holders: holdersCount,
        trustlines: metrics.trustlines || 0,
        volume24h: dexData?.volume24h || volume,
        verified: hasFirstLedgerIcon || isOnDexScreener || isTrustedIssuer,
        domain: issuerMeta.domain,
      });

      // Remove from dexScreener map (so we can add any remaining)
      dexScreenerTokens.delete(key);
    }

    // Add any DexScreener tokens that weren't in XRPL Meta
    for (const [, data] of dexScreenerTokens) {
      if (data.price > 0 || data.marketCap > 0) {
        tokens.push({
          currency: data.currency,
          issuer: data.issuer,
          name: data.name,
          symbol: data.currency,
          icon: data.icon || getTokenIconUrl(data.currency, data.issuer),
          decimals: 15,
          price: data.price,
          marketCap: data.marketCap,
          priceChange24h: data.priceChange24h,
          volume24h: data.volume24h,
          verified: true, // On DexScreener = verified
        });
      }
    }

    console.log(`[Leaderboard] ✅ Final: ${tokens.length} VERIFIED tokens (DexScreener + First Ledger)`);
    return tokens;

  } catch (error) {
    console.error('[Leaderboard] Token fetch failed:', error);
    return tokens;
  }
}

/**
 * Fetch holders/trustlines from XRPL Meta - BACKUP SOURCE for holder data!
 */
async function fetchXrplMetaHolders(): Promise<Map<string, { holders: number; trustlines: number }>> {
  const holdersMap = new Map<string, { holders: number; trustlines: number }>();

  try {
    // Fetch top tokens from XRPL Meta - they have HOLDERS data!
    const response = await fetch(`${XRPL_META_API}/tokens?limit=200`, {
      signal: AbortSignal.timeout(10000)
    });

    if (!response.ok) {
      console.error('[Leaderboard] XRPL Meta failed:', response.status);
      return holdersMap;
    }

    const data = await response.json();
    if (!data?.tokens) return holdersMap;

    for (const token of data.tokens) {
      if (!token.currency || !token.issuer) continue;

      // Decode hex currency if needed
      let currency = token.currency;
      if (currency.length === 40) {
        currency = decodeHexCurrency(currency);
      }

      const holders = token.metrics?.holders || 0;
      const trustlines = token.metrics?.trustlines || 0;

      if (holders > 0 || trustlines > 0) {
        const key = `${currency}:${token.issuer}`;
        holdersMap.set(key, { holders, trustlines });
      }
    }

    console.log(`[Leaderboard] XRPL Meta: ${holdersMap.size} tokens with holder data`);
    return holdersMap;

  } catch (error) {
    console.error('[Leaderboard] XRPL Meta fetch failed:', error);
    return holdersMap;
  }
}

/**
 * Merge XRPL Meta holders data into tokens
 */
function mergeXrplMetaData(
  tokens: LeaderboardToken[],
  holdersData: Map<string, { holders: number; trustlines: number }>
): LeaderboardToken[] {
  let updatedCount = 0;

  const result = tokens.map(token => {
    const key = `${token.currency}:${token.issuer}`;
    const metaData = holdersData.get(key);

    if (metaData) {
      // Only fill in if we don't already have holder data
      if (!token.holders && metaData.holders > 0) {
        updatedCount++;
        return {
          ...token,
          holders: metaData.holders,
          trustlines: token.trustlines || metaData.trustlines,
        };
      }
    }
    return token;
  });

  console.log(`[Leaderboard] XRPL Meta merged: ${updatedCount} tokens got holder data`);
  return result;
}

// ==================== DATA MERGING ====================

/**
 * Merge DexScreener data into tokens
 *
 * DATA SOURCES (FINAL - DO NOT CHANGE):
 * - Price: DexScreener priceNative (actual XRP trading price) - XRP icon
 * - Volume: xrpl.to ONLY (vol24hxrp) - XRP icon - NEVER from DexScreener
 * - Market Cap: DexScreener marketCap (actual USD) - $ prefix
 * - TVL: xrpl.to ONLY (item.tvl in XRP) - XRP icon - NEVER from DexScreener
 * - Holders: xrpl.to ONLY - NEVER from DexScreener
 */
function mergeDexScreenerData(
  tokens: LeaderboardToken[],
  dexData: Map<string, Partial<LeaderboardToken>>
): LeaderboardToken[] {
  let matchedCount = 0;
  let updatedCount = 0;

  const result = tokens.map(token => {
    // Try multiple key formats to find a match
    const key1 = `${token.currency}:${token.issuer}`;
    const key2 = `$${token.currency}:${token.issuer}`; // With $ prefix
    const key3 = token.currency.replace(/^\$/, '') + `:${token.issuer}`; // Without $ prefix

    const dex = dexData.get(key1) || dexData.get(key2) || dexData.get(key3);

    if (dex) {
      matchedCount++;

      // Track what we update
      if (dex.price || dex.marketCap) {
        updatedCount++;
        // Log BEAR specifically for debugging
        if (token.currency === 'BEAR') {
          console.log(`[Leaderboard] BEAR matched! DexScreener price: ${dex.price}, mcap: ${dex.marketCap}`);
        }
      }

      return {
        ...token,
        // DexScreener priceNative is the ACTUAL XRP trading price - USE IT!
        price: dex.price || token.price,
        // DexScreener marketCap is the ACTUAL USD market cap - USE IT!
        marketCap: dex.marketCap || token.marketCap,
        // PRESERVE xrpl.to data - NEVER overwrite:
        // - volume24h (XRP volume from xrpl.to)
        // - tvl (XRP TVL from xrpl.to) - DO NOT use DexScreener USD liquidity!
        // - holders (from xrpl.to)
        // - trustlines (from xrpl.to)
        // Only fill price changes if missing
        priceChange5m: token.priceChange5m ?? dex.priceChange5m,
        priceChange1h: token.priceChange1h ?? dex.priceChange1h,
        priceChange24h: token.priceChange24h ?? dex.priceChange24h,
        fdv: token.fdv ?? dex.fdv,
        createdAt: token.createdAt ?? dex.createdAt,
        // Only use DexScreener icon if xrpl.to doesn't have one
        icon: token.icon || dex.icon,
      };
    }
    return token;
  });

  console.log(`[Leaderboard] Merged DexScreener: ${matchedCount} matches, ${updatedCount} updated with real prices`);
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
