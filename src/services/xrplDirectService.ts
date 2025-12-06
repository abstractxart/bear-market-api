/**
 * BEAR MARKET - PURE XRPL DIRECT SERVICE
 *
 * NO DEPENDENCIES ON:
 * - xrpl.to ❌
 * - DexScreener ❌
 * - OnTheDex ❌
 * - ANY THIRD PARTY ❌
 *
 * 100% XRPL LEDGER DATA ONLY! 🐻
 *
 * We query the XRPL directly for:
 * - Token prices (from order book mid price)
 * - Token supply (from gateway_balances)
 * - Market cap (supply × price)
 * - Real-time trades (via subscription)
 */

import { Client } from 'xrpl';
import type { LeaderboardToken } from '../types';

// ==================== XRPL CONNECTION ====================

const XRPL_ENDPOINTS = [
  'wss://xrplcluster.com',
  'wss://s1.ripple.com',
  'wss://s2.ripple.com',
];

let xrplClient: Client | null = null;
let connectionPromise: Promise<Client> | null = null;

/**
 * Get or create XRPL client connection
 */
async function getXrplClient(): Promise<Client> {
  if (xrplClient?.isConnected()) {
    return xrplClient;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = (async () => {
    for (const endpoint of XRPL_ENDPOINTS) {
      try {
        const client = new Client(endpoint);
        await client.connect();
        console.log(`[XRPL Direct] 🐻 Connected to ${endpoint}`);
        xrplClient = client;
        connectionPromise = null;
        return client;
      } catch (e) {
        console.warn(`[XRPL Direct] Failed to connect to ${endpoint}`);
      }
    }
    connectionPromise = null;
    throw new Error('Failed to connect to any XRPL node');
  })();

  return connectionPromise;
}

// ==================== KNOWN XRPL TOKENS ====================

/**
 * Registry of known XRPL tokens
 * These are REAL tokens with active trading
 *
 * Format: { currency, issuer, name, icon? }
 */
export const XRPL_TOKEN_REGISTRY: Array<{
  currency: string;
  issuer: string;
  name: string;
  symbol: string;
  icon?: string;
}> = [
  // BEAR - THE KING 👑
  {
    currency: 'BEAR',
    issuer: 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW',
    name: 'BEAR',
    symbol: 'BEAR',
    icon: 'https://cdn.first-ledger.com/token/BEAR_rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW.webp',
  },
  // Sologenic
  {
    currency: 'SOLO',
    issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz',
    name: 'Sologenic',
    symbol: 'SOLO',
    icon: 'https://cdn.first-ledger.com/token/SOLO_rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz.webp',
  },
  // Coreum
  {
    currency: 'CORE',
    issuer: 'rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D',
    name: 'Coreum',
    symbol: 'CORE',
    icon: 'https://cdn.first-ledger.com/token/CORE_rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D.webp',
  },
  // Ripple USD (RLUSD)
  {
    currency: 'RLUSD',
    issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
    name: 'Ripple USD',
    symbol: 'RLUSD',
  },
  // Magnetic
  {
    currency: 'MAG',
    issuer: 'rMagnetM1nFraTLvHgZboMwGUcoT4jhLsm',
    name: 'Magnetic',
    symbol: 'MAG',
  },
  // XPMarket
  {
    currency: 'XPM',
    issuer: 'rXPMxBeefHGxx9Xhx4ZTqdg6n4fXNB1hJK',
    name: 'XPMarket',
    symbol: 'XPM',
  },
  // CasinoCoin
  {
    currency: 'CSC',
    issuer: 'rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr',
    name: 'CasinoCoin',
    symbol: 'CSC',
  },
  // Evernode
  {
    currency: 'EVR',
    issuer: 'rEvernodee8dJLaFsujS6q1EiXvZYmHXr8',
    name: 'Evernode',
    symbol: 'EVR',
  },
  // Equilibrium
  {
    currency: 'EQ',
    issuer: 'rpakCr61Q92abPXJnVboKENmpKssWyHpwu',
    name: 'Equilibrium',
    symbol: 'EQ',
  },
  // XRdoge
  {
    currency: 'XRdoge',
    issuer: 'rLqUC2eCPohYvJCEBJ77eCCqVL2uEiczjA',
    name: 'XRdoge',
    symbol: 'XRdoge',
  },
  // Elysian
  {
    currency: 'ELS',
    issuer: 'rHXuEaRYnnJHbDeuBH5w8yPh5uwNVh5zAg',
    name: 'Elysian',
    symbol: 'ELS',
  },
  // xSPECTAR
  {
    currency: 'xSPECTAR',
    issuer: 'rh5jzTCdMRCVjQ7LT6zucjezC47KATkuvv',
    name: 'xSPECTAR',
    symbol: 'xSPECTAR',
  },
  // ARMY
  {
    currency: 'ARMY',
    issuer: 'rM1EvqCwWooG97m1tgRNqPBmBPMQKaRmH',
    name: 'ARMY',
    symbol: 'ARMY',
  },
  // FURY
  {
    currency: 'FURY',
    issuer: 'rfunYsWk96HNwvPuT8P7BFcV5rjBdQxLJG',
    name: 'FURY',
    symbol: 'FURY',
  },
  // Xahau
  {
    currency: 'XAH',
    issuer: 'rswh1fvyLqHizBS2awu1vs6QcmwTBd9qiv',
    name: 'Xahau',
    symbol: 'XAH',
  },
  // RPR
  {
    currency: 'RPR',
    issuer: 'r3qWgpz2ry5yP9JWykdNmEskCj1LdPFcdT',
    name: 'RPR',
    symbol: 'RPR',
  },
  // XRPH
  {
    currency: 'XRPH',
    issuer: 'rXRPHs4e5RYRPAkKqBZ82S9aN2d2FpvWyA',
    name: 'XRPH',
    symbol: 'XRPH',
  },
];

// ==================== PRICE CALCULATION ====================

/**
 * Convert currency to HEX for XRPL (required for currencies > 3 chars)
 */
function currencyToHex(currency: string): string {
  if (currency.length === 3) return currency;
  if (currency.length === 40 && /^[0-9A-Fa-f]+$/.test(currency)) return currency;

  let hex = '';
  for (let i = 0; i < currency.length; i++) {
    hex += currency.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex.padEnd(40, '0').toUpperCase();
}

/**
 * Get token price from XRPL order book
 * Returns price in XRP
 */
export async function getTokenPriceFromXRPL(
  currency: string,
  issuer: string
): Promise<{ price: number; bidPrice: number; askPrice: number } | null> {
  try {
    const client = await getXrplClient();
    const xrplCurrency = currencyToHex(currency);

    // Get SELL side (people selling token for XRP)
    const sellOffers = await client.request({
      command: 'book_offers',
      taker_gets: { currency: 'XRP' },
      taker_pays: { currency: xrplCurrency, issuer },
      limit: 1,
    });

    // Get BUY side (people buying token with XRP)
    const buyOffers = await client.request({
      command: 'book_offers',
      taker_gets: { currency: xrplCurrency, issuer },
      taker_pays: { currency: 'XRP' },
      limit: 1,
    });

    let bidPrice = 0; // Best price someone will buy at
    let askPrice = 0; // Best price someone will sell at

    // Calculate bid price (buy offers)
    if (buyOffers.result.offers && buyOffers.result.offers.length > 0) {
      const offer = buyOffers.result.offers[0];
      const xrpAmount = typeof offer.TakerPays === 'string'
        ? parseInt(offer.TakerPays) / 1_000_000
        : 0;
      const tokenAmount = typeof offer.TakerGets === 'object'
        ? parseFloat(offer.TakerGets.value)
        : 0;
      if (tokenAmount > 0) {
        bidPrice = xrpAmount / tokenAmount;
      }
    }

    // Calculate ask price (sell offers)
    if (sellOffers.result.offers && sellOffers.result.offers.length > 0) {
      const offer = sellOffers.result.offers[0];
      const xrpAmount = typeof offer.TakerGets === 'string'
        ? parseInt(offer.TakerGets) / 1_000_000
        : 0;
      const tokenAmount = typeof offer.TakerPays === 'object'
        ? parseFloat(offer.TakerPays.value)
        : 0;
      if (tokenAmount > 0) {
        askPrice = xrpAmount / tokenAmount;
      }
    }

    // Mid price
    let price = 0;
    if (bidPrice > 0 && askPrice > 0) {
      price = (bidPrice + askPrice) / 2;
    } else if (bidPrice > 0) {
      price = bidPrice;
    } else if (askPrice > 0) {
      price = askPrice;
    }

    return { price, bidPrice, askPrice };
  } catch (error) {
    console.error(`[XRPL Direct] Failed to get price for ${currency}:`, error);
    return null;
  }
}

/**
 * Get token supply from issuer's gateway balances
 * This gives us the total amount issued
 */
export async function getTokenSupply(
  currency: string,
  issuer: string
): Promise<number> {
  try {
    const client = await getXrplClient();
    const xrplCurrency = currencyToHex(currency);

    const result = await client.request({
      command: 'gateway_balances',
      account: issuer,
      strict: true,
    });

    // The obligations field shows how much the gateway owes (= circulating supply)
    const obligations = result.result.obligations;
    if (obligations && obligations[xrplCurrency]) {
      return parseFloat(obligations[xrplCurrency]);
    }

    // Fallback: try to get from assets
    const assets = result.result.assets;
    if (assets) {
      for (const holder in assets) {
        const balances = assets[holder];
        for (const balance of balances) {
          if (balance.currency === xrplCurrency || balance.currency === currency) {
            return Math.abs(parseFloat(balance.value));
          }
        }
      }
    }

    return 0;
  } catch (error) {
    console.error(`[XRPL Direct] Failed to get supply for ${currency}:`, error);
    return 0;
  }
}

// ==================== MAIN TOKEN FETCH ====================

// Cache for token data
interface TokenCache {
  tokens: LeaderboardToken[];
  timestamp: number;
}

let tokenCache: TokenCache | null = null;
const CACHE_DURATION = 30 * 1000; // 30 seconds

/**
 * Fetch ALL token data directly from XRPL
 * NO THIRD PARTY APIs!
 */
export async function getTokensFromXRPL(): Promise<LeaderboardToken[]> {
  // Return cache if fresh
  if (tokenCache && Date.now() - tokenCache.timestamp < CACHE_DURATION) {
    console.log(`[XRPL Direct] 🐻 Cache hit: ${tokenCache.tokens.length} tokens`);
    return tokenCache.tokens;
  }

  console.log('[XRPL Direct] 🐻 Fetching tokens DIRECTLY from XRPL...');
  const startTime = Date.now();

  const tokens: LeaderboardToken[] = [];

  // Fetch prices for all known tokens in parallel
  const pricePromises = XRPL_TOKEN_REGISTRY.map(async (token) => {
    const priceData = await getTokenPriceFromXRPL(token.currency, token.issuer);
    const supply = await getTokenSupply(token.currency, token.issuer);

    const price = priceData?.price || 0;
    const marketCap = price * supply;

    return {
      currency: token.currency,
      issuer: token.issuer,
      name: token.name,
      symbol: token.symbol,
      icon: token.icon,
      decimals: 15,
      price,
      marketCap: marketCap > 0 ? marketCap : undefined,
      supply: supply > 0 ? supply : undefined,
    } as LeaderboardToken;
  });

  const results = await Promise.allSettled(pricePromises);

  for (const result of results) {
    if (result.status === 'fulfilled' && (result.value.price ?? 0) > 0) {
      tokens.push(result.value);
    }
  }

  // Sort by market cap (BEAR always first)
  tokens.sort((a, b) => {
    if (a.currency === 'BEAR') return -1;
    if (b.currency === 'BEAR') return 1;
    return (b.marketCap || 0) - (a.marketCap || 0);
  });

  // Cache results
  tokenCache = { tokens, timestamp: Date.now() };

  const elapsed = Date.now() - startTime;
  console.log(`[XRPL Direct] 🐻 Loaded ${tokens.length} tokens in ${elapsed}ms - 100% XRPL!`);

  return tokens;
}

/**
 * Get a single token's data from XRPL
 */
export async function getTokenFromXRPL(
  currency: string,
  issuer: string
): Promise<LeaderboardToken | null> {
  try {
    const priceData = await getTokenPriceFromXRPL(currency, issuer);
    const supply = await getTokenSupply(currency, issuer);

    if (!priceData || priceData.price === 0) {
      return null;
    }

    const registryToken = XRPL_TOKEN_REGISTRY.find(
      t => t.currency === currency && t.issuer === issuer
    );

    return {
      currency,
      issuer,
      name: registryToken?.name || currency,
      symbol: registryToken?.symbol || currency,
      icon: registryToken?.icon,
      decimals: 15,
      price: priceData.price,
      marketCap: priceData.price * supply,
      supply,
    };
  } catch (error) {
    console.error(`[XRPL Direct] Failed to get token ${currency}:`, error);
    return null;
  }
}

// ==================== EXPORTS ====================

export {
  getXrplClient,
  currencyToHex,
};
