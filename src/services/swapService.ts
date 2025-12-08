import { Client } from 'xrpl';
import type { Token, SwapQuote, FeeTier } from '../types';
import { getFeeRate } from './nftService';

/**
 * BEAR MARKET Swap Service
 *
 * FAST quotes using OnTheDex API (pre-computed prices)
 * Fee is ALWAYS collected in XRP (0.589% of XRP amount in trade).
 */

const ONTHEDEX_API = 'https://api.onthedex.live/public/v1';

// BEAR Treasury wallet - ALL swap fees go here
export const BEAR_TREASURY_WALLET = 'rBEARKfWJS1LYdg2g6t99BgbvpWY5pgMB9';

/**
 * Extract a clean error message from XRPL errors or other error types
 */
function getErrorMessage(error: any): string {
  if (!error) return 'Unknown error';

  // XRPL errors often have nested error structures
  if (error.data?.error_message) return error.data.error_message;
  if (error.data?.error) return error.data.error;
  if (error.message) return error.message;
  if (typeof error === 'string') return error;

  // Fallback: stringify but avoid showing internal objects
  return 'Transaction failed';
}

/**
 * Convert currency code to XRPL-compatible format
 * - 3-char codes stay as-is (USD, EUR, etc)
 * - Longer codes get hex-encoded (BEAR -> 4245415200...)
 * - Already hex codes (40 chars) stay as-is
 */
function toXRPLCurrency(currency: string): string {
  // XRP is special
  if (currency === 'XRP') return 'XRP';

  // Already a hex currency code (40 characters)
  if (currency.length === 40 && /^[0-9A-Fa-f]+$/.test(currency)) {
    return currency.toUpperCase();
  }

  // Standard 3-char code
  if (currency.length === 3) {
    return currency.toUpperCase();
  }

  // Non-standard code - convert to hex (pad to 20 bytes / 40 hex chars)
  let hex = '';
  for (let i = 0; i < currency.length && i < 20; i++) {
    hex += currency.charCodeAt(i).toString(16).padStart(2, '0');
  }
  // Pad to 40 characters
  return hex.padEnd(40, '0').toUpperCase();
}

// Price cache for instant quotes (5 second TTL)
const priceCache = new Map<string, { price: number; timestamp: number }>();
const PRICE_CACHE_TTL = 5000;

interface QuoteParams {
  inputToken: Token;
  outputToken: Token;
  inputAmount: string;
  slippage: number;
  feeTier: FeeTier;
}

/**
 * Get a swap quote with fee calculation - FAST using OnTheDex!
 *
 * FEE IS ALWAYS IN XRP:
 * - XRP → Token: Fee = 0.589% of input XRP
 * - Token → XRP: Fee = 0.589% of output XRP
 */
export async function getSwapQuote(
  client: Client,
  params: QuoteParams
): Promise<SwapQuote> {
  const { inputToken, outputToken, inputAmount, slippage, feeTier } = params;

  // Validate that XRP is on one side
  const isInputXRP = inputToken.currency === 'XRP';
  const isOutputXRP = outputToken.currency === 'XRP';

  if (!isInputXRP && !isOutputXRP) {
    throw new Error('XRP must be on one side of every trade');
  }

  const inputAmountNum = parseFloat(inputAmount);

  // Get price from OnTheDex (FAST!) with XRPL fallback
  const tokenToPrice = isInputXRP ? outputToken : inputToken;
  const priceInXRP = await getTokenPriceInXRP(tokenToPrice, client, params);

  // Calculate output amount
  let outputBeforeFee: number;

  if (isInputXRP) {
    // XRP → Token: output = input / price
    outputBeforeFee = inputAmountNum / priceInXRP;
  } else {
    // Token → XRP: output = input * price
    outputBeforeFee = inputAmountNum * priceInXRP;
  }

  // CRITICAL SANITY CHECK for Token → XRP - Auto-correct inverted rates
  if (!isInputXRP && outputBeforeFee > inputAmountNum * 10) {
    // Auto-correct by inverting the price
    const correctedPrice = 1 / priceInXRP;
    outputBeforeFee = inputAmountNum * correctedPrice;
  }

  // Calculate fee - ALWAYS IN XRP
  const feeRate = getFeeRate(feeTier);
  let xrpFeeAmount: number;
  let outputAfterFee: number;

  if (isInputXRP) {
    // Selling XRP for tokens: fee from input XRP
    xrpFeeAmount = inputAmountNum * feeRate;
    outputAfterFee = outputBeforeFee;
  } else {
    // Selling tokens for XRP: fee from output XRP
    xrpFeeAmount = outputBeforeFee * feeRate;
    outputAfterFee = outputBeforeFee - xrpFeeAmount;
  }

  // Calculate minimum received with slippage
  const slippageMultiplier = 1 - slippage / 100;
  const minimumReceived = outputAfterFee * slippageMultiplier;

  // Estimate price impact (simplified - based on amount vs typical volume)
  const priceImpact = estimatePriceImpact(inputAmountNum, isInputXRP);

  return {
    inputToken,
    outputToken,
    inputAmount,
    outputAmount: outputAfterFee.toFixed(6),
    exchangeRate: (outputAfterFee / inputAmountNum).toFixed(6),
    feeAmount: xrpFeeAmount.toFixed(6), // Always in XRP!
    feeTier,
    priceImpact,
    slippage,
    minimumReceived: minimumReceived.toFixed(6),
    estimatedGas: '0.000012', // ~12 drops
    expiresAt: Date.now() + 30000, // 30 second expiry
  };
}

/**
 * Get token price in XRP - tries multiple sources for accuracy
 * Returns: price of 1 token in XRP (e.g., 1 BEAR = 0.00132 XRP)
 */
async function getTokenPriceInXRP(
  token: Token,
  client: Client,
  params: QuoteParams
): Promise<number> {
  const cacheKey = `${token.currency}:${token.issuer}`;

  // Check cache first (5 second TTL)
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < PRICE_CACHE_TTL) {
    return cached.price;
  }

  // 1. Try OnTheDex ticker API first (fastest response)
  try {
    const tickerUrl = `${ONTHEDEX_API}/ticker/XRP/${token.currency}:${token.issuer}`;
    const response = await fetch(tickerUrl, {
      signal: AbortSignal.timeout(3000),
    });

    if (response.ok) {
      const data = await response.json();

      // OnTheDex returns price as how many tokens per XRP
      // We want price of 1 token in XRP, so we invert
      if (data.last && parseFloat(data.last) > 0) {
        const pricePerXRP = parseFloat(data.last);
        const priceInXRP = 1 / pricePerXRP;
        priceCache.set(cacheKey, { price: priceInXRP, timestamp: Date.now() });
        return priceInXRP;
      }
    }
  } catch {
    // OnTheDex unavailable, try fallback
  }

  // 2. Try DexScreener API (has most tokens including BEAR)
  try {
    const dexUrl = `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(token.currency)}%20xrpl`;
    const dexResponse = await fetch(dexUrl, { signal: AbortSignal.timeout(3000) });

    if (dexResponse.ok) {
      const dexData = await dexResponse.json();
      const pairs = dexData.pairs || [];

      // Find matching XRPL pair
      for (const pair of pairs) {
        if (pair.chainId === 'xrpl') {
          const baseToken = pair.baseToken;
          if (baseToken?.symbol?.toUpperCase() === token.currency.toUpperCase()) {
            // Check issuer matches if we have one
            const address = baseToken.address || '';
            if (token.issuer && !address.includes(token.issuer)) {
              continue;
            }

            // priceNative is price in XRP (native currency)
            if (pair.priceNative) {
              const priceInXRP = parseFloat(pair.priceNative);
              priceCache.set(cacheKey, { price: priceInXRP, timestamp: Date.now() });
              return priceInXRP;
            }
          }
        }
      }
    }
  } catch {
    // DexScreener unavailable, try fallback
  }

  // 3. Fallback to XRPL order book
  try {
    const quoteResult = await getQuoteFromOrderBook(client, params);

    // quoteResult gives us output for the input amount
    const isInputXRP = params.inputToken.currency === 'XRP';
    let priceInXRP: number;

    if (isInputXRP) {
      // XRP → Token: we got tokens for XRP, so price = XRP/tokens
      priceInXRP = parseFloat(params.inputAmount) / parseFloat(quoteResult.outputAmount);
    } else {
      // Token → XRP: we got XRP for tokens, so price = XRP/tokens
      priceInXRP = parseFloat(quoteResult.outputAmount) / parseFloat(params.inputAmount);
    }

    // SANITY CHECK: If price is > 10 XRP, try inverse calculation
    if (priceInXRP > 10) {
      const inversePriceInXRP = isInputXRP
        ? parseFloat(quoteResult.outputAmount) / parseFloat(params.inputAmount)
        : parseFloat(params.inputAmount) / parseFloat(quoteResult.outputAmount);

      // If inverse is more reasonable (< 10), use it
      if (inversePriceInXRP < priceInXRP && inversePriceInXRP < 10) {
        priceInXRP = inversePriceInXRP;
      }
    }

    priceCache.set(cacheKey, { price: priceInXRP, timestamp: Date.now() });
    return priceInXRP;
  } catch {
    throw new Error('Unable to get price quote');
  }
}

/**
 * Estimate price impact (simplified calculation)
 */
function estimatePriceImpact(amountXRP: number, isInputXRP: boolean): number {
  // Simple heuristic: larger trades have more impact
  // < 100 XRP: ~0.1%, < 1000 XRP: ~0.5%, < 10000 XRP: ~1%, > 10000: ~2%+
  const xrpAmount = isInputXRP ? amountXRP : amountXRP;
  if (xrpAmount < 100) return 0.1;
  if (xrpAmount < 1000) return 0.3;
  if (xrpAmount < 5000) return 0.7;
  if (xrpAmount < 10000) return 1.2;
  return 2.0 + (xrpAmount - 10000) / 50000;
}

interface QuoteResult {
  outputAmount: string;
  marketRate: number;
}

/**
 * Get quote directly from order book (FAST - single API call)
 */
async function getQuoteFromOrderBook(
  client: Client,
  params: QuoteParams
): Promise<QuoteResult> {
  const { inputToken, outputToken, inputAmount } = params;

  // VALIDATION: Ensure we have issuers for non-XRP tokens
  if (inputToken.currency !== 'XRP' && !inputToken.issuer) {
    throw new Error(`Missing issuer for ${inputToken.currency}`);
  }
  if (outputToken.currency !== 'XRP' && !outputToken.issuer) {
    throw new Error(`Missing issuer for ${outputToken.currency}`);
  }

  try {
    // Build the request
    // CRITICAL: For book_offers, we need offers where we RECEIVE the output and GIVE the input
    // taker_gets = what the OFFER MAKER is selling (what we receive as taker)
    // taker_pays = what the OFFER MAKER wants (what we pay as taker)
    //
    // When buying SPIFFY with XRP:
    //   - We want offers from people SELLING SPIFFY for XRP
    //   - Those offers have: TakerGets = SPIFFY (maker sells), TakerPays = XRP (maker wants)
    //   - Query: taker_gets = SPIFFY, taker_pays = XRP
    //
    // When selling SPIFFY for XRP:
    //   - We want offers from people BUYING SPIFFY with XRP
    //   - Those offers have: TakerGets = XRP (maker sells), TakerPays = SPIFFY (maker wants)
    //   - Query: taker_gets = XRP, taker_pays = SPIFFY

    const takerGets = outputToken.currency === 'XRP'
      ? { currency: 'XRP' }
      : { currency: toXRPLCurrency(outputToken.currency), issuer: outputToken.issuer! };

    const takerPays = inputToken.currency === 'XRP'
      ? { currency: 'XRP' }
      : { currency: toXRPLCurrency(inputToken.currency), issuer: inputToken.issuer! };

    // Single API call to get order book
    // taker_gets = what YOU receive (output token)
    // taker_pays = what YOU pay (input token)
    const bookResult = await client.request({
      command: 'book_offers',
      taker_gets: takerGets,
      taker_pays: takerPays,
      limit: 20, // Get more offers for better pricing
    });

    const offers = bookResult.result.offers || [];

    if (offers.length === 0) {
      // No order book, try AMM
      return getAMMQuote(client, params);
    }

    // =====================================================
    // CRITICAL VALIDATION: Ensure offers match our direction!
    // This prevents the bug where we get wrong-direction offers
    // =====================================================
    const firstOffer = offers[0];
    const offerTakerGetsIsXRP = typeof firstOffer.TakerGets === 'string';
    const offerTakerPaysIsXRP = typeof firstOffer.TakerPays === 'string';
    const expectedOutputIsXRP = outputToken.currency === 'XRP';
    const expectedInputIsXRP = inputToken.currency === 'XRP';

    // Offers should have:
    // - TakerGets = what WE receive = outputToken
    // - TakerPays = what WE pay = inputToken
    const directionCorrect =
      (expectedOutputIsXRP === offerTakerGetsIsXRP) &&
      (expectedInputIsXRP === offerTakerPaysIsXRP);

    if (!directionCorrect) {
      // TRY INVERSE QUERY: Swap taker_gets and taker_pays
      try {
        const inverseResult = await client.request({
          command: 'book_offers',
          taker_gets: takerPays, // SWAP
          taker_pays: takerGets, // SWAP
          limit: 20,
        });

        const inverseOffers = inverseResult.result.offers || [];

        if (inverseOffers.length > 0) {
          // Now we have offers in the wrong direction, but we can use them
          // by inverting the rate calculation
          const invFirst = inverseOffers[0];
          const invTakerGetsIsXRP = typeof invFirst.TakerGets === 'string';

          // Check if inverse matches our direction now
          if (invTakerGetsIsXRP === expectedInputIsXRP) {
            // Rate inversion: our_rate = 1 / their_rate
            const invCalc = calculateOutputFromOffers(inverseOffers, 1);
            if (invCalc.rate > 0) {
              const invertedRate = 1 / invCalc.rate;
              const ourOutput = parseFloat(inputAmount) * invertedRate;

              if (ourOutput > 0 && invertedRate > 1e-10) {
                return {
                  outputAmount: ourOutput.toFixed(6),
                  marketRate: invertedRate,
                };
              }
            }
          }
        }
      } catch {
        // Inverse query failed, continue to AMM fallback
      }

      // Fallback to AMM if inverse didn't work
      return getAMMQuote(client, params);
    }

    // Calculate expected output from order book
    const { output, rate } = calculateOutputFromOffers(
      offers,
      parseFloat(inputAmount)
    );

    // Sanity check: reject absurdly small outputs
    if (output === 0 || rate < 1e-10) {
      return getAMMQuote(client, params);
    }

    // Additional check: if output is less than 1 unit for a reasonable input, something is wrong
    const inputNum = parseFloat(inputAmount);
    if (inputNum >= 1 && output < 0.000001) {
      return getAMMQuote(client, params);
    }

    // EXTRA VALIDATION: Compare with OnTheDex price if available
    // This helps catch wildly incorrect order book rates
    try {
      const nonXrpToken = inputToken.currency === 'XRP' ? outputToken : inputToken;
      const priceUrl = `https://api.onthedex.live/public/v1/ticker/XRP/${nonXrpToken.currency}:${nonXrpToken.issuer}`;
      const priceResp = await fetch(priceUrl);
      if (priceResp.ok) {
        const priceData = await priceResp.json();
        const externalPrice = priceData.last; // XRP per token

        if (externalPrice && externalPrice > 0) {
          // Calculate our implied price
          const isInputXRP = inputToken.currency === 'XRP';
          const ourPrice = isInputXRP
            ? inputNum / output  // XRP spent per token received
            : output / inputNum;  // XRP received per token sold

          const priceDiff = Math.abs(ourPrice - externalPrice) / externalPrice;

          // If our price differs by more than 50x from external, something is wrong
          if (priceDiff > 50) {
            return getAMMQuote(client, params);
          }
        }
      }
    } catch (e) {
      // Ignore price check errors
    }

    return {
      outputAmount: output.toFixed(6),
      marketRate: rate,
    };
  } catch {
    // Fallback to AMM-only pricing
    return getAMMQuote(client, params);
  }
}

/**
 * Get quote from AMM directly (fallback)
 */
async function getAMMQuote(
  client: Client,
  params: QuoteParams
): Promise<QuoteResult> {
  const { inputToken, outputToken, inputAmount } = params;

  try {
    // Get AMM info
    const ammInfo = await client.request({
      command: 'amm_info',
      asset: inputToken.currency === 'XRP'
        ? { currency: 'XRP' }
        : { currency: toXRPLCurrency(inputToken.currency), issuer: inputToken.issuer! },
      asset2: outputToken.currency === 'XRP'
        ? { currency: 'XRP' }
        : { currency: toXRPLCurrency(outputToken.currency), issuer: outputToken.issuer! },
    });

    const amm = ammInfo.result.amm;

    // Calculate output using constant product formula
    // x * y = k
    // (x + dx) * (y - dy) = k
    // dy = y - k / (x + dx)
    // dy = y * dx / (x + dx)

    const pool1 = parseAMMAmount(amm.amount);
    const pool2 = parseAMMAmount(amm.amount2);

    // Determine which pool is input
    const isInputPool1 = matchesPool(inputToken, amm.amount);
    const inputPool = isInputPool1 ? pool1 : pool2;
    const outputPool = isInputPool1 ? pool2 : pool1;

    const dx = parseFloat(inputAmount);
    const dy = (outputPool * dx) / (inputPool + dx);

    // Apply AMM trading fee (typically 0.3%)
    const tradingFee = amm.trading_fee / 100000; // Convert from basis points
    const outputAfterAMMFee = dy * (1 - tradingFee);

    return {
      outputAmount: outputAfterAMMFee.toFixed(6),
      marketRate: outputPool / inputPool,
    };
  } catch {
    // No AMM exists for this pair - this token has NO LIQUIDITY
    throw new Error(`No liquidity found for ${params.inputToken.currency}/${params.outputToken.currency}. This token may not have any active order book or AMM.`);
  }
}

/**
 * Calculate output amount from order book offers
 *
 * CRITICAL: After direction validation, offers are guaranteed to have:
 * - TakerGets = what WE RECEIVE (output token)
 * - TakerPays = what WE PAY (input token)
 */
function calculateOutputFromOffers(
  offers: any[],
  inputAmount: number
): { output: number; rate: number } {
  if (offers.length === 0) {
    return { output: 0, rate: 0 };
  }

  let remainingInput = inputAmount;
  let totalOutput = 0;

  for (let i = 0; i < offers.length && remainingInput > 0; i++) {
    const offer = offers[i];

    // Parse amounts - TakerGets is OUTPUT (what we receive), TakerPays is INPUT (what we pay)
    const outputAvailable = parseOfferAmount(offer.TakerGets);
    const inputRequired = parseOfferAmount(offer.TakerPays);

    // owner_funds limits how much the offer maker can actually deliver (in TakerGets units)
    const ownerFunds = offer.owner_funds ? parseFloat(offer.owner_funds) : outputAvailable;
    const actualOutputAvailable = Math.min(outputAvailable, ownerFunds);

    // Price = how much INPUT per 1 OUTPUT
    const pricePerOutput = inputRequired / outputAvailable;

    // How much input can we use on this offer?
    const maxInputForThisOffer = actualOutputAvailable * pricePerOutput;
    const inputToConsume = Math.min(remainingInput, maxInputForThisOffer);

    // How much output do we get for this input?
    const outputForThisOffer = inputToConsume / pricePerOutput;

    totalOutput += outputForThisOffer;
    remainingInput -= inputToConsume;
  }

  const effectiveRate = inputAmount > 0 ? totalOutput / inputAmount : 0;
  return { output: totalOutput, rate: effectiveRate };
}

/**
 * Parse offer amount (handles both XRP drops and issued currency)
 */
function parseOfferAmount(amount: any): number {
  if (typeof amount === 'string') {
    // XRP in drops
    return parseInt(amount) / 1_000_000;
  }
  return parseFloat(amount.value);
}

/**
 * Parse AMM pool amount
 */
function parseAMMAmount(amount: any): number {
  if (typeof amount === 'string') {
    return parseInt(amount) / 1_000_000;
  }
  return parseFloat(amount.value);
}

/**
 * Check if token matches AMM pool asset
 */
function matchesPool(token: Token, poolAmount: any): boolean {
  if (token.currency === 'XRP') {
    return typeof poolAmount === 'string';
  }
  return (
    typeof poolAmount === 'object' &&
    poolAmount.currency === token.currency &&
    poolAmount.issuer === token.issuer
  );
}

/**
 * Convert XRP to drops
 */
function xrpToDrops(xrp: string): string {
  const drops = Math.floor(parseFloat(xrp) * 1_000_000);
  return drops.toString();
}

function dropsToXrp(drops: string): string {
  return (parseInt(drops, 10) / 1_000_000).toString();
}

/**
 * Swap execution result
 */
export interface SwapResult {
  success: boolean;
  swapTxHash?: string;
  feeTxHash?: string;
  feeTxHashes?: string[];  // All fee transaction hashes (for referral split)
  feeCount?: number;       // Number of fee transactions (1 = no referral, 2 = referral split)
  error?: string;
}

/**
 * Execute a swap with fee collection
 *
 * TWO TRANSACTIONS in ONE USER ACTION:
 * 1. Swap transaction (self-payment through DEX)
 * 2. Fee transaction (XRP to BEAR Treasury)
 *
 * User signs both back-to-back, then both are submitted.
 * Fee is ALWAYS in XRP regardless of trade direction.
 */
export async function executeSwap(
  client: Client,
  quote: SwapQuote,
  senderAddress: string,
  signTransaction: (tx: any) => Promise<any>,
  onStatus?: (status: string) => void
): Promise<SwapResult> {
  const feeAmountXRP = parseFloat(quote.feeAmount);
  const isInputXRP = quote.inputToken.currency === 'XRP';

  try {
    // ===== CHECK FOR MISSING TRUSTLINE =====
    // If buying a token (XRP → Token), check if user has trustline for output token
    const needsTrustline = quote.outputToken.currency !== 'XRP';
    let hasTrustline = false;

    if (needsTrustline) {
      onStatus?.('Checking trustline...');
      try {
        const accountLines = await client.request({
          command: 'account_lines',
          account: senderAddress,
          ledger_index: 'validated',
        });

        // Check if trustline exists for this token
        hasTrustline = accountLines.result.lines.some((line: any) =>
          line.currency === toXRPLCurrency(quote.outputToken.currency) &&
          line.account === quote.outputToken.issuer
        );
      } catch (err) {
        console.error('Failed to check trustlines:', err);
      }
    }

    // ===== CREATE TRUSTLINE IF NEEDED =====
    if (needsTrustline && !hasTrustline) {
      onStatus?.('Creating trustline for token...');

      const trustSetTx: any = {
        TransactionType: 'TrustSet',
        Account: senderAddress,
        LimitAmount: {
          currency: toXRPLCurrency(quote.outputToken.currency),
          issuer: quote.outputToken.issuer!,
          value: '100000000000', // High trust limit
        },
        Flags: 131072, // tfSetNoRipple - disables rippling for regular user accounts
      };

      const preparedTrustSet = await client.autofill(trustSetTx);

      onStatus?.('Please sign the trustline transaction...');
      const signedTrustSet = await signTransaction(preparedTrustSet);

      onStatus?.('Submitting trustline...');
      const trustSetResult = await client.submitAndWait(signedTrustSet.tx_blob);

      // Check trustline success
      let trustSetSuccess = false;
      if (trustSetResult.result.meta && typeof trustSetResult.result.meta !== 'string') {
        const meta = trustSetResult.result.meta as any;
        trustSetSuccess = meta.TransactionResult === 'tesSUCCESS';
      }

      if (!trustSetSuccess) {
        return {
          success: false,
          error: 'Failed to create trustline for token',
        };
      }

      console.log('[Swap] Trustline created successfully');
    }

    onStatus?.('Preparing transactions...');

    // ===== TRANSACTION 1: THE SWAP =====
    // For XRP → Token: reduce SendMax by fee amount (user sends less XRP)
    // For Token → XRP: user gets full swap, fee is separate

    let swapSendMax: string;
    if (isInputXRP) {
      // XRP → Token: Deduct fee from input, so we send (inputAmount - fee) for the swap
      const swapInputXRP = parseFloat(quote.inputAmount) - feeAmountXRP;
      swapSendMax = xrpToDrops(swapInputXRP.toFixed(6));
    } else {
      // Token → XRP: Full token amount for swap
      swapSendMax = quote.inputAmount;
    }

    const swapTx: any = {
      TransactionType: 'Payment',
      Account: senderAddress,
      Destination: senderAddress, // Self-payment for swap
      Amount: quote.outputToken.currency === 'XRP'
        ? xrpToDrops(quote.minimumReceived)
        : {
            currency: toXRPLCurrency(quote.outputToken.currency),
            issuer: quote.outputToken.issuer!,
            value: quote.minimumReceived,
          },
      SendMax: quote.inputToken.currency === 'XRP'
        ? swapSendMax
        : {
            currency: toXRPLCurrency(quote.inputToken.currency),
            issuer: quote.inputToken.issuer!,
            value: swapSendMax,
          },
      Flags: 131072, // tfPartialPayment
    };

    // ===== TRANSACTION 2+3: FEE PAYMENT (SPLIT IF REFERRED) =====
    console.log('[Swap] EXECUTING FEE SPLIT CODE - VERSION 2.0');

    // ===== CHECK IF USER CAN AFFORD FEE =====
    // XRPL Reserve Requirements (Updated Dec 2, 2024 - https://xrpl.org/blog/2024/lower-reserves-are-in-effect)
    // Base Reserve: 1 XRP (was 10 XRP)
    // Owner Reserve: 0.2 XRP per object (was 2 XRP)
    const XRPL_BASE_RESERVE = 1; // 1 XRP minimum reserve (lowered from 10 XRP on Dec 2, 2024)
    const NETWORK_FEE_BUFFER = 0.01; // Buffer for network fees and owner reserves

    // Get current XRP balance
    let currentXrpBalance = 0;
    try {
      const accountInfo = await client.request({
        command: 'account_info',
        account: senderAddress,
        ledger_index: 'validated'
      });
      currentXrpBalance = parseFloat(dropsToXrp((accountInfo.result.account_data as any).Balance));
      console.log(`[Swap] Current XRP balance: ${currentXrpBalance}`);
    } catch (err) {
      console.warn('[Swap] Could not fetch account balance, proceeding with fee anyway');
    }

    // Calculate what user will have after swap
    let xrpAfterSwap = currentXrpBalance;
    if (isInputXRP) {
      // XRP → Token: User spends XRP (the input amount minus what's reserved for fee)
      xrpAfterSwap = currentXrpBalance - parseFloat(quote.inputAmount);
    } else if (quote.outputToken.currency === 'XRP') {
      // Token → XRP: User receives XRP
      xrpAfterSwap = currentXrpBalance + parseFloat(quote.minimumReceived);
    }
    // For Token → Token: XRP balance stays roughly the same (only network fees)

    // Calculate minimum XRP needed to pay fee
    const minXrpNeededForFee = XRPL_BASE_RESERVE + feeAmountXRP + NETWORK_FEE_BUFFER;
    const canAffordFee = xrpAfterSwap >= minXrpNeededForFee;

    console.log(`[Swap] XRP after swap: ${xrpAfterSwap.toFixed(4)}, Need for fee: ${minXrpNeededForFee.toFixed(4)}, Can afford: ${canAffordFee}`);

    // BLOCK swap if user can't afford fee - fee is REQUIRED, never skip it!
    if (!canAffordFee) {
      const shortfall = (minXrpNeededForFee - xrpAfterSwap).toFixed(2);
      console.error(`[Swap] BLOCKING SWAP - Insufficient XRP for fee. Has: ${xrpAfterSwap.toFixed(4)}, Needs: ${minXrpNeededForFee.toFixed(4)} (including ${XRPL_BASE_RESERVE} XRP reserve)`);
      return {
        success: false,
        error: `Insufficient XRP for swap fee. You need ~${shortfall} more XRP above the ${XRPL_BASE_RESERVE} XRP reserve to complete this swap.`,
      };
    }

    // Create fee payment transaction(s)
    const feeTxs: any[] = [];
    let referrerWallet: string | null = null;

    // Check localStorage for referrer wallet address
    console.log('[Swap] Checking for referrer...');
    const storedReferral = localStorage.getItem('bear_market_referral');
    if (storedReferral) {
      try {
        const localData = JSON.parse(storedReferral);
        // Get referrer wallet address (stored as referredBy)
        referrerWallet = localData.referredBy;

        if (referrerWallet) {
          // Validate it's a valid XRPL address
          if (referrerWallet.startsWith('r')) {
            console.log('[Swap] ✓ Found referrer wallet:', referrerWallet);
          } else {
            console.warn('[Swap] Invalid referrer wallet format (must start with "r"), skipping referral payment:', referrerWallet);
            referrerWallet = null;
          }
        } else {
          console.log('[Swap] No referrer found');
        }
      } catch (e) {
        console.log('[Swap] No referrer found (localStorage parse error)');
      }
    } else {
      console.log('[Swap] No referrer found (not referred)');
    }

    // MINIMUM FEE THRESHOLD: 1 drop = 0.000001 XRP
    // XRPL rejects payments of 0 drops, so skip fee transactions if amount is too small
    const MIN_FEE_XRP = 0.000001;

    if (feeAmountXRP < MIN_FEE_XRP) {
      console.log(`[Swap] Fee too small (${feeAmountXRP} XRP), skipping fee transactions`);
    } else if (referrerWallet) {
      // SPLIT FEE: 50% to referrer, 50% to treasury
      const halfFee = feeAmountXRP / 2;

      // Only add fee transactions if each half is at least 1 drop
      if (halfFee >= MIN_FEE_XRP) {
        // Fee to referrer
        feeTxs.push({
          TransactionType: 'Payment',
          Account: senderAddress,
          Destination: referrerWallet,
          Amount: xrpToDrops(halfFee.toFixed(6)),
          Memos: [{
            Memo: {
              MemoType: Buffer.from('REFERRAL_COMMISSION', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from('50% commission for referral', 'utf8').toString('hex').toUpperCase(),
            }
          }],
        });

        // Fee to treasury
        feeTxs.push({
          TransactionType: 'Payment',
          Account: senderAddress,
          Destination: BEAR_TREASURY_WALLET,
          Amount: xrpToDrops(halfFee.toFixed(6)),
          Memos: [{
            Memo: {
              MemoType: Buffer.from('BEAR_SWAP_FEE', 'utf8').toString('hex').toUpperCase(),
              MemoData: Buffer.from('50% treasury fee (referred user)', 'utf8').toString('hex').toUpperCase(),
            }
          }],
        });

        console.log(`[Swap] Splitting fee: ${halfFee} XRP to referrer, ${halfFee} XRP to treasury`);
      } else {
        console.log(`[Swap] Split fee too small (${halfFee} XRP each), skipping fee transactions`);
      }
    } else {
      // NO REFERRER: 100% to treasury
      feeTxs.push({
        TransactionType: 'Payment',
        Account: senderAddress,
        Destination: BEAR_TREASURY_WALLET,
        Amount: xrpToDrops(feeAmountXRP.toFixed(6)),
        Memos: [{
          Memo: {
            MemoType: Buffer.from('BEAR_SWAP_FEE', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(`Fee for swap: ${quote.inputToken.currency} → ${quote.outputToken.currency}`, 'utf8').toString('hex').toUpperCase(),
          }
        }],
      });
    }

    // Autofill all transactions
    onStatus?.('Getting transaction details...');
    const preparedTxs = await Promise.all([
      client.autofill(swapTx),
      ...feeTxs.map(tx => client.autofill(tx)),
    ]);

    const preparedSwap = preparedTxs[0];
    const preparedFees = preparedTxs.slice(1);

    // Ensure fee txs have sequential numbers AFTER swap tx
    preparedFees.forEach((feeTx, index) => {
      feeTx.Sequence = preparedSwap.Sequence! + 1 + index;
    });

    // ===== SIGN ALL TRANSACTIONS =====
    onStatus?.('Please sign the swap transaction...');
    const signedSwap = await signTransaction(preparedSwap);

    // Sign all fee transactions
    const signedFees: any[] = [];
    for (let i = 0; i < preparedFees.length; i++) {
      const feeType = preparedFees.length > 1
        ? (i === 0 ? 'referral commission' : 'treasury fee')
        : 'fee';
      onStatus?.(`Please sign the ${feeType} transaction...`);
      const signedFee = await signTransaction(preparedFees[i]);
      signedFees.push(signedFee);
    }

    // ===== SUBMIT ALL TRANSACTIONS =====
    onStatus?.('Submitting swap...');
    const swapResult = await client.submitAndWait(signedSwap.tx_blob);

    // Check swap success
    let swapSuccess = false;
    if (swapResult.result.meta && typeof swapResult.result.meta !== 'string') {
      const meta = swapResult.result.meta as any;
      swapSuccess = meta.TransactionResult === 'tesSUCCESS';
    }

    if (!swapSuccess) {
      return {
        success: false,
        error: 'Swap transaction failed',
      };
    }

    // Submit all fee transactions
    const feeResults: any[] = [];
    let allFeesSucceeded = true;

    for (let i = 0; i < signedFees.length; i++) {
      const feeType = signedFees.length > 1
        ? (i === 0 ? 'referral commission' : 'treasury fee')
        : 'fee';
      onStatus?.(`Collecting ${feeType}...`);

      try {
        const feeResult = await client.submitAndWait(signedFees[i].tx_blob);
        let feeSuccess = false;
        if (feeResult.result.meta && typeof feeResult.result.meta !== 'string') {
          const meta = feeResult.result.meta as any;
          feeSuccess = meta.TransactionResult === 'tesSUCCESS';
        }

        feeResults.push({
          hash: feeResult.result.hash,
          success: feeSuccess,
        });

        if (!feeSuccess) {
          allFeesSucceeded = false;
        }
      } catch (err) {
        console.error(`Fee transaction ${i} failed:`, err);
        allFeesSucceeded = false;
        feeResults.push({ success: false });
      }
    }

    // Return success - fees are required and already validated
    return {
      success: true,
      swapTxHash: swapResult.result.hash,
      feeTxHash: feeResults[0]?.hash, // First fee tx hash (backward compatibility)
      feeTxHashes: feeResults.map(r => r.hash).filter(Boolean), // All fee tx hashes
      feeCount: feeResults.length, // Number of fee transactions (1 = no referral, 2 = referral split)
      error: allFeesSucceeded ? undefined : 'Fee collection issue (swap succeeded)',
    };

  } catch (error: any) {
    console.error('Swap execution error:', error);
    return {
      success: false,
      error: getErrorMessage(error),
    };
  }
}
