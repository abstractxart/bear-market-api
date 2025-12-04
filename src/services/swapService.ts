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

  // 1. Try OnTheDex ticker API first (INSTANT!)
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
  } catch (error) {
    console.warn('OnTheDex ticker failed:', error);
  }

  // 2. Try DexScreener API (has most tokens including BEAR)
  try {
    const dexResponse = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(token.currency)}%20xrpl`,
      { signal: AbortSignal.timeout(3000) }
    );

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
            if (token.issuer && !address.includes(token.issuer)) continue;

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
  } catch (error) {
    console.warn('DexScreener price fetch failed:', error);
  }

  // 3. Fallback to XRPL order book
  try {
    const quoteResult = await getQuoteFromOrderBook(client, params);
    // quoteResult gives us output for the input amount
    // priceInXRP = how much XRP for 1 token = inputAmount / outputAmount (for XRP→Token)
    // But we need to handle both directions
    const isInputXRP = params.inputToken.currency === 'XRP';
    let priceInXRP: number;

    if (isInputXRP) {
      // XRP → Token: we got tokens for XRP, so price = XRP/tokens
      priceInXRP = parseFloat(params.inputAmount) / parseFloat(quoteResult.outputAmount);
    } else {
      // Token → XRP: we got XRP for tokens, so price = XRP/tokens
      priceInXRP = parseFloat(quoteResult.outputAmount) / parseFloat(params.inputAmount);
    }

    priceCache.set(cacheKey, { price: priceInXRP, timestamp: Date.now() });
    return priceInXRP;
  } catch (error) {
    console.error('Order book fallback failed:', error);
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

  try {
    // Single API call to get order book
    const bookResult = await client.request({
      command: 'book_offers',
      taker_gets: inputToken.currency === 'XRP'
        ? { currency: 'XRP' }
        : { currency: toXRPLCurrency(inputToken.currency), issuer: inputToken.issuer! },
      taker_pays: outputToken.currency === 'XRP'
        ? { currency: 'XRP' }
        : { currency: toXRPLCurrency(outputToken.currency), issuer: outputToken.issuer! },
      limit: 20, // Get more offers for better pricing
    });

    const offers = bookResult.result.offers || [];

    if (offers.length === 0) {
      // No order book, try AMM
      return getAMMQuote(client, params);
    }

    // Calculate expected output from order book
    const { output, rate } = calculateOutputFromOffers(
      offers,
      parseFloat(inputAmount),
      inputToken.currency === 'XRP'
    );

    if (output === 0) {
      // Order book empty or insufficient, try AMM
      return getAMMQuote(client, params);
    }

    return {
      outputAmount: output.toFixed(6),
      marketRate: rate,
    };
  } catch (error) {
    console.error('Order book error:', error);
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
  } catch (error) {
    console.error('AMM quote error:', error);
    throw new Error('Unable to get quote. Please try again.');
  }
}

/**
 * Calculate output amount from order book offers
 */
function calculateOutputFromOffers(
  offers: any[],
  inputAmount: number,
  inputIsXRP: boolean
): { output: number; rate: number } {
  if (offers.length === 0) {
    return { output: 0, rate: 0 };
  }

  let remainingInput = inputAmount;
  let totalOutput = 0;

  for (const offer of offers) {
    if (remainingInput <= 0) break;

    const takerGets = parseOfferAmount(offer.TakerGets);
    const takerPays = parseOfferAmount(offer.TakerPays);
    const ownerFunds = parseFloat(offer.owner_funds || takerGets.toString());

    // Rate for this offer
    const rate = takerPays / takerGets;

    // How much of this offer can we consume?
    const availableInput = inputIsXRP ? takerPays : takerGets;

    const consumable = Math.min(remainingInput, availableInput, ownerFunds * rate);
    const outputForThis = consumable / rate;

    totalOutput += outputForThis;
    remainingInput -= consumable;
  }

  // Calculate effective rate
  const effectiveRate = totalOutput / inputAmount;

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

/**
 * Swap execution result
 */
export interface SwapResult {
  success: boolean;
  swapTxHash?: string;
  feeTxHash?: string;
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

    // ===== TRANSACTION 2: FEE PAYMENT =====
    // Always send XRP fee to BEAR Treasury
    const feeTx: any = {
      TransactionType: 'Payment',
      Account: senderAddress,
      Destination: BEAR_TREASURY_WALLET,
      Amount: xrpToDrops(feeAmountXRP.toFixed(6)), // Fee in drops
      // Add memo so it's clear what this is for
      Memos: [{
        Memo: {
          MemoType: Buffer.from('BEAR_SWAP_FEE', 'utf8').toString('hex').toUpperCase(),
          MemoData: Buffer.from(`Fee for swap: ${quote.inputToken.currency} → ${quote.outputToken.currency}`, 'utf8').toString('hex').toUpperCase(),
        }
      }],
    };

    // Autofill both transactions (adds Sequence, Fee, LastLedgerSequence)
    onStatus?.('Getting transaction details...');
    const [preparedSwap, preparedFee] = await Promise.all([
      client.autofill(swapTx),
      client.autofill(feeTx),
    ]);

    // Ensure fee tx has sequence AFTER swap tx
    preparedFee.Sequence = preparedSwap.Sequence! + 1;

    // ===== SIGN BOTH TRANSACTIONS =====
    onStatus?.('Please sign the swap transaction...');
    const signedSwap = await signTransaction(preparedSwap);

    onStatus?.('Please sign the fee transaction...');
    const signedFee = await signTransaction(preparedFee);

    // ===== SUBMIT BOTH TRANSACTIONS =====
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

    // Submit fee transaction
    onStatus?.('Collecting fee...');
    const feeResult = await client.submitAndWait(signedFee.tx_blob);

    let feeSuccess = false;
    if (feeResult.result.meta && typeof feeResult.result.meta !== 'string') {
      const meta = feeResult.result.meta as any;
      feeSuccess = meta.TransactionResult === 'tesSUCCESS';
    }

    // Even if fee fails, swap succeeded
    return {
      success: true,
      swapTxHash: swapResult.result.hash,
      feeTxHash: feeSuccess ? feeResult.result.hash : undefined,
      error: feeSuccess ? undefined : 'Fee collection failed (swap still succeeded)',
    };

  } catch (error: any) {
    console.error('Swap execution error:', error);
    return {
      success: false,
      error: error.message || 'Transaction failed',
    };
  }
}
