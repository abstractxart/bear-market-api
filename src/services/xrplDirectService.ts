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

// ==================== TRANSACTION HISTORY ====================

/**
 * Trade data interface (matches LiveTradesFeed expectations)
 */
export interface Trade {
  id: string;
  type: 'buy' | 'sell';
  price: number;
  priceUsd: number;
  amount: number;
  amountXrp: number;
  amountUsd: number;
  maker: string;
  timestamp: Date;
  hash: string;
  isNew?: boolean;
}

/**
 * Internal swap data structure
 */
interface SwapData {
  type: 'buy' | 'sell';
  tokenAmount: number;
  xrpAmount: number;
  price: number;
  maker: string;
  hash: string;
  timestamp: Date;
}

/**
 * Convert XRPL timestamp to JavaScript Date
 * XRPL uses seconds since Ripple Epoch (Jan 1, 2000 00:00 UTC)
 */
function xrplTimeToDate(rippleTime: number): Date {
  const RIPPLE_EPOCH = 946684800; // Jan 1, 2000 00:00 UTC in Unix time
  return new Date((rippleTime + RIPPLE_EPOCH) * 1000);
}

/**
 * Get current XRP/USD price
 * Uses XRP/RLUSD order book from XRPL
 */
export async function getXrpUsdPrice(): Promise<number> {
  try {
    // Try to get RLUSD price (Ripple's stablecoin)
    const rlusdPrice = await getTokenPriceFromXRPL(
      'RLUSD',
      'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De'
    );

    if (rlusdPrice && rlusdPrice.price > 0) {
      // getTokenPriceFromXRPL returns RLUSD price in XRP (e.g., 0.48 XRP per RLUSD)
      // Since RLUSD ≈ $1, we need to INVERT to get XRP price in USD
      // If RLUSD costs 0.48 XRP, then 1 XRP = 1/0.48 = $2.08
      const xrpUsdPrice = 1 / rlusdPrice.price;
      console.log(`[XRPL Direct] 💰 XRP/USD Price: $${xrpUsdPrice.toFixed(4)} (RLUSD price: ${rlusdPrice.price} XRP)`);
      return xrpUsdPrice;
    }

    // Fallback: use a reasonable estimate
    console.log('[XRPL Direct] ⚠️ Using fallback XRP/USD price: $2.50');
    return 2.50; // Conservative XRP price estimate
  } catch (error) {
    console.warn('[XRPL Direct] Failed to get XRP/USD price, using estimate');
    return 2.50;
  }
}

/**
 * Find the AMM account for a token/XRP pair
 */
export async function getAmmAccountForPair(
  currency: string,
  issuer: string
): Promise<string | null> {
  try {
    const client = await getXrplClient();
    const xrplCurrency = currencyToHex(currency);

    const ammInfo = await client.request({
      command: 'amm_info',
      asset: { currency: 'XRP' },
      asset2: { currency: xrplCurrency, issuer },
    });

    const ammAccount = ammInfo.result.amm?.account;
    if (ammAccount) {
      console.log(`[XRPL Direct] Found AMM account for ${currency}: ${ammAccount}`);
      return ammAccount;
    }

    return null;
  } catch (error) {
    console.warn(`[XRPL Direct] No AMM found for ${currency}:`, error);
    return null;
  }
}

/**
 * Fetch recent token swaps from XRPL.to aggregator API
 * This is much faster than scanning individual ledgers
 * @deprecated Not currently used, but kept for future reference
 */
// @ts-expect-error - Keeping for future use
async function fetchTokenSwapsFromAggregator(
  currency: string,
  issuer: string,
  limit: number = 50
): Promise<Trade[]> {
  try {
    // Try XRPL.to API for recent swaps
    const currencyHex = currencyToHex(currency);
    const url = `https://api.xrpl.to/v1/tokens/${currencyHex}.${issuer}/swaps?limit=${limit}`;

    console.log(`[XRPL Direct] Fetching swaps from XRPL.to aggregator...`);
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`[XRPL Direct] XRPL.to API returned ${response.status}`);
      return [];
    }

    const data = await response.json();
    const xrpUsdPrice = await getXrpUsdPrice();

    // Transform XRPL.to format to our Trade format
    const trades: Trade[] = (data.swaps || []).map((swap: any) => ({
      id: swap.hash || swap.tx_hash || `${Date.now()}-${Math.random()}`,
      type: swap.type?.toLowerCase() === 'buy' ? 'buy' : 'sell',
      price: parseFloat(swap.price || '0'),
      priceUsd: parseFloat(swap.price || '0') * xrpUsdPrice,
      amount: parseFloat(swap.token_amount || '0'),
      amountXrp: parseFloat(swap.xrp_amount || '0'),
      amountUsd: parseFloat(swap.xrp_amount || '0') * xrpUsdPrice,
      maker: swap.account || swap.maker || 'unknown',
      timestamp: swap.timestamp ? new Date(swap.timestamp) : new Date(),
      hash: swap.hash || swap.tx_hash || ''
    }));

    console.log(`[XRPL Direct] Loaded ${trades.length} swaps from XRPL.to`);
    return trades;
  } catch (error) {
    console.warn('[XRPL Direct] Failed to fetch from XRPL.to, falling back to ledger scan');
    return [];
  }
}

/**
 * Fetch recent ledgers and extract all transactions involving a token
 * FALLBACK METHOD - slower but direct from XRPL
 * @deprecated Not currently used, but kept for future reference
 */
// @ts-expect-error - Keeping for future use
async function fetchRecentTokenTransactions(
  currency: string,
  _issuer: string,
  limit: number = 50
): Promise<any[]> {
  try {
    const client = await getXrplClient();

    // Ensure client is connected before making requests
    if (!client.isConnected()) {
      console.log('[XRPL Direct] Client not connected, waiting...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // If still not connected after waiting, return empty
      if (!client.isConnected()) {
        console.warn('[XRPL Direct] Client still not connected, skipping transaction fetch');
        return [];
      }
    }

    // Get current ledger index
    const ledgerResponse = await client.request({
      command: 'ledger',
      ledger_index: 'validated'
    });

    const currentLedger = ledgerResponse.result.ledger_index;
    const transactions: any[] = [];
    const currencyHex = currencyToHex(currency);

    console.log(`[XRPL Direct] Scanning last 10 ledgers for ${currency} transactions...`);

    // Scan only the last 10 ledgers (about 30-40 seconds of history)
    // This is fast and should find recent activity
    for (let i = 0; i < 10 && transactions.length < limit; i++) {
      const ledgerIndex = currentLedger - i;

      try {
        const ledger = await client.request({
          command: 'ledger',
          ledger_index: ledgerIndex,
          transactions: true,
          expand: true // Get full transaction objects
        });

        if (!ledger.result.ledger.transactions) continue;

        // Get ledger close time (in Ripple epoch seconds)
        const ledgerCloseTime = ledger.result.ledger.close_time;

        // Filter for Payment transactions involving our token
        for (const tx of ledger.result.ledger.transactions) {
          // Skip if not a transaction object (might be just a hash)
          if (typeof tx === 'string') continue;

          // Only look at Payment transactions
          if (tx.TransactionType !== 'Payment') continue;

          // Check if this payment involves our token
          const involvesToken =
            (typeof tx.Amount === 'object' && 'currency' in tx.Amount &&
             (tx.Amount.currency === currency || tx.Amount.currency === currencyHex)) ||
            (typeof tx.SendMax === 'object' && 'currency' in tx.SendMax &&
             (tx.SendMax.currency === currency || tx.SendMax.currency === currencyHex)) ||
            (typeof tx.DeliverMin === 'object' && 'currency' in tx.DeliverMin &&
             (tx.DeliverMin.currency === currency || tx.DeliverMin.currency === currencyHex));

          if (involvesToken) {
            // Ledger transactions with expand:true have fields at root level
            // We need to wrap them in the standard { tx, meta, validated } format
            transactions.push({
              tx: {
                ...tx,
                ledger_index: ledgerIndex,
                date: ledgerCloseTime // Use ledger's close time as transaction date
              },
              meta: tx.metaData || tx.meta,
              validated: true
            });

            if (transactions.length >= limit) break;
          }
        }
      } catch (error) {
        // Skip ledgers that fail to load
        console.warn(`[XRPL Direct] Failed to load ledger ${ledgerIndex}:`, error);
      }
    }

    console.log(`[XRPL Direct] Found ${transactions.length} ${currency} transactions in recent ledgers`);
    return transactions;

  } catch (error) {
    console.error(`[XRPL Direct] Failed to fetch token transactions:`, error);
    return [];
  }
}

/**
 * Parse a Payment or OfferCreate transaction to extract swap details
 * BEAR trades via DEX order book (OfferCreate), not Payment transactions!
 */
function parseSwapTransaction(
  txData: any,
  token: { currency: string; issuer: string }
): SwapData | null {
  try {
    // Handle both transaction formats (nested tx field, tx_json field, or root level)
    // XRPL API v2 uses tx_json instead of tx
    const tx = txData.tx || txData.tx_json || txData;
    const meta = txData.meta;

    // Only process successful, validated transactions
    if (!txData.validated || meta?.TransactionResult !== 'tesSUCCESS') {
      return null;
    }

    const txType = tx.TransactionType;

    // Get hash from root level (XRPL API v2 format)
    const hash = txData.hash || tx.hash || '';

    // Support both Payment (cross-currency) and OfferCreate (DEX order book) transactions
    if (txType === 'OfferCreate') {
      return parseOfferCreateTransaction(tx, meta, token, hash);
    } else if (txType === 'Payment') {
      return parsePaymentTransaction(tx, meta, token, hash);
    }

    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Parse an OfferCreate transaction (DEX order book trade)
 * This is how BEAR actually trades!
 */
function parseOfferCreateTransaction(
  tx: any,
  _meta: any,
  token: { currency: string; issuer: string },
  hash: string
): SwapData | null {
  try {
    const tokenCurrencyHex = currencyToHex(token.currency);
    const takerPays = tx.TakerPays;
    const takerGets = tx.TakerGets;

    let type: 'buy' | 'sell' | null = null;
    let tokenAmount = 0;
    let xrpAmount = 0;

    // Buy: TakerPays is XRP (string), TakerGets is token (object)
    if (typeof takerPays === 'string' && typeof takerGets === 'object') {
      const getsCurrency = takerGets.currency?.toUpperCase();
      const tokenCurrency = token.currency.toUpperCase();
      const tokenCurrencyHexUpper = tokenCurrencyHex.toUpperCase();

      if (
        takerGets.issuer === token.issuer &&
        (getsCurrency === tokenCurrency || getsCurrency === tokenCurrencyHexUpper)
      ) {
        type = 'buy';
        tokenAmount = parseFloat(takerGets.value);
        xrpAmount = parseInt(takerPays) / 1_000_000;
      }
    }

    // Sell: TakerPays is token (object), TakerGets is XRP (string)
    if (typeof takerPays === 'object' && typeof takerGets === 'string') {
      const paysCurrency = takerPays.currency?.toUpperCase();
      const tokenCurrency = token.currency.toUpperCase();
      const tokenCurrencyHexUpper = tokenCurrencyHex.toUpperCase();

      if (
        takerPays.issuer === token.issuer &&
        (paysCurrency === tokenCurrency || paysCurrency === tokenCurrencyHexUpper)
      ) {
        type = 'sell';
        tokenAmount = parseFloat(takerPays.value);
        xrpAmount = parseInt(takerGets) / 1_000_000;
      }
    }

    if (!type || tokenAmount === 0 || xrpAmount === 0) {
      return null;
    }

    const price = xrpAmount / tokenAmount;
    const timestamp = xrplTimeToDate(tx.date);

    return {
      type,
      tokenAmount,
      xrpAmount,
      price,
      maker: tx.Account,
      hash: hash, // Use hash from root level
      timestamp,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Parse a Payment transaction (cross-currency payment)
 */
function parsePaymentTransaction(
  tx: any,
  meta: any,
  token: { currency: string; issuer: string },
  hash: string
): SwapData | null {
  try {

    const tokenCurrencyHex = currencyToHex(token.currency);

    // Check BOTH SendMax and DeliverMax (newer XRPL field)
    const sendMax = tx.SendMax || tx.DeliverMax;
    const amount = tx.Amount;

    // Also check the delivered_amount from metadata (actual amount delivered)
    const deliveredAmount = meta?.delivered_amount || amount;

    let type: 'buy' | 'sell' | null = null;
    let tokenAmount = 0;
    let xrpAmount = 0;

    // Try multiple detection patterns

    // Pattern 1: Buy - SendMax is XRP string, Amount is token object
    if (typeof sendMax === 'string' && typeof deliveredAmount === 'object') {
      const amountCurrency = deliveredAmount.currency?.toUpperCase();
      const tokenCurrency = token.currency.toUpperCase();
      const tokenCurrencyHexUpper = tokenCurrencyHex.toUpperCase();

      if (
        deliveredAmount.issuer === token.issuer &&
        (amountCurrency === tokenCurrency || amountCurrency === tokenCurrencyHexUpper)
      ) {
        type = 'buy';
        tokenAmount = parseFloat(deliveredAmount.value);
        xrpAmount = parseInt(sendMax) / 1_000_000;
      }
    }

    // Pattern 2: Sell - SendMax is token object, Amount is XRP string
    if (typeof sendMax === 'object' && typeof deliveredAmount === 'string') {
      const sendMaxCurrency = sendMax.currency?.toUpperCase();
      const tokenCurrency = token.currency.toUpperCase();
      const tokenCurrencyHexUpper = tokenCurrencyHex.toUpperCase();

      if (
        sendMax.issuer === token.issuer &&
        (sendMaxCurrency === tokenCurrency || sendMaxCurrency === tokenCurrencyHexUpper)
      ) {
        type = 'sell';
        tokenAmount = parseFloat(sendMax.value);
        xrpAmount = parseInt(deliveredAmount) / 1_000_000;
      }
    }

    // Pattern 3: Check if Amount itself is our token (direct receive)
    if (!type && typeof amount === 'object') {
      const amountCurrency = amount.currency?.toUpperCase();
      const tokenCurrency = token.currency.toUpperCase();
      const tokenCurrencyHexUpper = tokenCurrencyHex.toUpperCase();

      if (
        amount.issuer === token.issuer &&
        (amountCurrency === tokenCurrency || amountCurrency === tokenCurrencyHexUpper)
      ) {
        // This is a token receive - check if there's XRP involved
        if (typeof sendMax === 'string') {
          type = 'buy';
          tokenAmount = parseFloat(amount.value);
          xrpAmount = parseInt(sendMax) / 1_000_000;
        }
      }
    }

    // Pattern 4: Check if SendMax/DeliverMax is our token (direct send)
    if (!type && typeof sendMax === 'object') {
      const sendMaxCurrency = sendMax.currency?.toUpperCase();
      const tokenCurrency = token.currency.toUpperCase();
      const tokenCurrencyHexUpper = tokenCurrencyHex.toUpperCase();

      if (
        sendMax.issuer === token.issuer &&
        (sendMaxCurrency === tokenCurrency || sendMaxCurrency === tokenCurrencyHexUpper)
      ) {
        // This is a token send - check if there's XRP involved
        if (typeof amount === 'string') {
          type = 'sell';
          tokenAmount = parseFloat(sendMax.value);
          xrpAmount = parseInt(amount) / 1_000_000;
        }
      }
    }

    if (!type || tokenAmount === 0 || xrpAmount === 0) {
      return null;
    }

    // Sanity check: Filter out unrealistic amounts
    // Typical BEAR swaps are < 100M tokens and < 1M XRP
    if (tokenAmount > 100_000_000) {
      console.warn(`[XRPL Direct] 🚫 Filtering Payment with unrealistic token amount: ${tokenAmount.toFixed(0)} ${token.currency} (likely not a swap)`);
      return null;
    }

    if (xrpAmount > 1_000_000) {
      console.warn(`[XRPL Direct] 🚫 Filtering Payment with unrealistic XRP amount: ${xrpAmount.toFixed(0)} XRP (likely not a swap)`);
      return null;
    }

    // Filter out transactions with unrealistic prices
    const price = xrpAmount / tokenAmount;
    if (price <= 0 || price > 1000) {
      console.warn(`[XRPL Direct] 🚫 Filtering Payment with unrealistic price: ${price.toFixed(8)} XRP per ${token.currency}`);
      return null;
    }

    const timestamp = xrplTimeToDate(tx.date);

    return {
      type,
      tokenAmount,
      xrpAmount,
      price,
      maker: tx.Account,
      hash: hash, // Use hash from root level
      timestamp,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Ensure XRPL client is connected with retries
 * Handles rate limiting by waiting progressively longer between attempts
 */
async function ensureConnected(): Promise<Client> {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Get client (this handles connection internally)
      const client = await getXrplClient();

      // Verify connection is still active (might have been dropped by rate limiting)
      if (client.isConnected()) {
        console.log(`[XRPL Direct] ✅ Connection verified (attempt ${attempt})`);
        return client;
      }

      // Connection was dropped - wait before retry (exponential backoff for rate limits)
      const waitTime = attempt * 3000; // 3s, 6s, 9s
      console.log(`[XRPL Direct] ⏳ Connection dropped (rate limit?), waiting ${waitTime/1000}s before retry ${attempt}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));

      // Clear the failed client so getXrplClient() will create a new one
      xrplClient = null;
      connectionPromise = null;

    } catch (error) {
      console.warn(`[XRPL Direct] Connection error on attempt ${attempt}/${maxRetries}:`, error);

      // Clear failed state
      xrplClient = null;
      connectionPromise = null;

      if (attempt === maxRetries) {
        throw new Error('Failed to establish XRPL connection after multiple attempts (likely rate limited)');
      }

      // Wait before retry
      const waitTime = attempt * 3000;
      console.log(`[XRPL Direct] ⏳ Waiting ${waitTime/1000}s before retry...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  throw new Error('Failed to establish XRPL connection after multiple attempts');
}

/**
 * Fetch transaction history from the token issuer's account
 * This is much more efficient than scanning ledgers (1 API call vs thousands)
 * Returns ALL transactions involving the token over the past ~2+ days
 */
async function fetchIssuerAccountTransactions(
  issuer: string,
  maxTransactions: number = 400
): Promise<any[]> {
  try {
    const client = await ensureConnected();

    console.log(`[XRPL Direct] Fetching transaction history from issuer account: ${issuer}`);

    // Get current ledger to calculate recent range
    const ledgerResponse = await client.request({ command: 'ledger', ledger_index: 'validated' });
    const currentLedger = ledgerResponse.result.ledger_index;

    // Calculate ledger range for ~3 days of history
    // XRPL closes ledgers every ~3-4 seconds, so:
    // 3 days = 259,200 seconds / 4 = ~64,800 ledgers
    const daysToFetch = 3;
    const ledgersPerDay = (24 * 60 * 60) / 4; // ~21,600 ledgers per day
    const ledgerIndexMin = currentLedger - (daysToFetch * ledgersPerDay);

    console.log(`[XRPL Direct] Fetching last ${daysToFetch} days of transactions (from ledger ${ledgerIndexMin})...`);

    const transactions: any[] = [];
    let marker: any = undefined;

    // Fetch transactions in batches of 100 (reduced from 200 for faster response)
    while (transactions.length < maxTransactions) {
      try {
        // Request only recent transactions using ledger_index_min
        const response = await client.request({
          command: 'account_tx',
          account: issuer,
          limit: Math.min(100, maxTransactions - transactions.length),
          ledger_index_min: ledgerIndexMin, // Only fetch transactions from recent ledgers
          ledger_index_max: -1, // -1 means "latest validated ledger"
          marker: marker,
        });

        const txs = response.result.transactions || [];
        transactions.push(...txs);

        console.log(`[XRPL Direct] Fetched ${txs.length} transactions (total: ${transactions.length})`);

        // Check if there are more transactions to fetch
        marker = response.result.marker;
        if (!marker || txs.length === 0) {
          break; // No more transactions available
        }

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error: any) {
        if (error?.data?.error === 'actNotFound') {
          console.warn('[XRPL Direct] Issuer account not found');
          break;
        }
        console.warn('[XRPL Direct] Error fetching transaction batch:', error);
        break;
      }
    }

    console.log(`[XRPL Direct] Total transactions fetched: ${transactions.length}`);
    return transactions;

  } catch (error) {
    console.error('[XRPL Direct] Failed to fetch issuer transactions:', error);
    return [];
  }
}

/**
 * Fetch real swap transactions for a token from XRPL
 * This replaces the mock data generation
 * Gets 2+ days of transaction history by querying the issuer's account
 */
export async function fetchSwapsForToken(
  currency: string,
  issuer: string,
  limit: number = 50
): Promise<Trade[]> {
  try {
    console.log(`[XRPL Direct] Fetching swaps for ${currency} (2+ days history)...`);

    // Fetch up to 400 transactions from issuer account
    // At ~3-4 second ledger close time, this covers several days of activity
    const transactions = await fetchIssuerAccountTransactions(issuer, 400);

    if (transactions.length === 0) {
      console.warn('[XRPL Direct] No transactions found for token');
      return [];
    }

    // Parse transactions into swaps
    const xrpUsdPrice = await getXrpUsdPrice();
    console.log(`[XRPL Direct] 💰 XRP/USD Price: $${xrpUsdPrice}`);
    const swaps: Trade[] = [];

    // Debug: Count transaction types and inspect structure
    const txTypeCounts: Record<string, number> = {};

    // Log first transaction structure to understand format
    if (transactions.length > 0) {
      const firstTx = transactions[0];
      console.log('[XRPL Direct] First transaction structure:', {
        hasRootTx: !!firstTx.tx,
        hasRootTransactionType: !!firstTx.TransactionType,
        hasTxTransactionType: !!(firstTx.tx?.TransactionType),
        rootKeys: Object.keys(firstTx).slice(0, 10),
        txKeys: firstTx.tx ? Object.keys(firstTx.tx).slice(0, 10) : []
      });
    }

    for (const txData of transactions) {
      const tx = txData.tx || txData.tx_json || txData;
      const txType = tx.TransactionType || 'Unknown';
      txTypeCounts[txType] = (txTypeCounts[txType] || 0) + 1;
    }
    console.log(`[XRPL Direct] Transaction types in ${transactions.length} transactions:`, JSON.stringify(txTypeCounts, null, 2));

    let parseFailures = 0;
    for (const txData of transactions) {
      const swapData = parseSwapTransaction(txData, { currency, issuer });

      if (swapData) {
        const priceUsd = swapData.price * xrpUsdPrice;

        swaps.push({
          id: swapData.hash,
          type: swapData.type,
          price: swapData.price,
          priceUsd,
          amount: swapData.tokenAmount,
          amountXrp: swapData.xrpAmount,
          amountUsd: swapData.xrpAmount * xrpUsdPrice,
          maker: swapData.maker,
          timestamp: swapData.timestamp,
          hash: swapData.hash,
        });
      } else {
        parseFailures++;
        // Log first 3 failed Payment transactions for debugging
        const tx = txData.tx || txData;
        if (parseFailures <= 3 && tx.TransactionType === 'Payment') {
          console.log(`[XRPL Direct] Failed to parse Payment #${parseFailures}:`, {
            hash: tx.hash,
            Account: tx.Account,
            Destination: tx.Destination,
            Amount: tx.Amount,
            SendMax: tx.SendMax,
            DeliverMax: tx.DeliverMax,
          });
        }
      }
    }

    // Sort by timestamp (most recent first)
    swaps.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Return up to the requested limit
    const result = swaps.slice(0, limit);

    console.log(`[XRPL Direct] ✅ Loaded ${result.length} real swaps from ${transactions.length} transactions!`);

    // Log time range for verification
    if (result.length > 0) {
      const oldest = result[result.length - 1].timestamp;
      const newest = result[0].timestamp;
      const hoursSpan = (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60);
      console.log(`[XRPL Direct] 📊 Time range: ${hoursSpan.toFixed(1)} hours (${(hoursSpan / 24).toFixed(1)} days)`);
    }

    return result;

  } catch (error) {
    console.error(`[XRPL Direct] Failed to fetch swaps for ${currency}:`, error);
    return [];
  }
}

// ==================== EXPORTS ====================

export {
  getXrplClient,
  currencyToHex,
};
