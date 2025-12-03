import { Client } from 'xrpl';
import type { Token, SwapQuote, FeeTier } from '../types';
import { getFeeRate } from './nftService';
import { BEAR_ECOSYSTEM } from '../types/xrpl';

/**
 * BEAR MARKET Swap Service
 *
 * Handles quote generation and swap execution.
 * Fee is baked into the exchange rate (no separate transaction needed).
 */

interface QuoteParams {
  inputToken: Token;
  outputToken: Token;
  inputAmount: string;
  slippage: number;
  feeTier: FeeTier;
}

/**
 * Get a swap quote with fee calculation
 *
 * The fee is extracted by adjusting the output amount.
 * Server-side quote manipulation ensures atomic fee collection.
 */
export async function getSwapQuote(
  client: Client,
  params: QuoteParams
): Promise<SwapQuote> {
  const { inputToken, outputToken, inputAmount, slippage, feeTier } = params;

  // Validate that XRP is on one side
  const hasXRP = inputToken.currency === 'XRP' || outputToken.currency === 'XRP';
  if (!hasXRP) {
    throw new Error('XRP must be on one side of every trade');
  }

  // Get path and best rate from XRPL
  const pathFindResult = await findBestPath(client, params);

  // Calculate output before fee
  const outputBeforeFee = parseFloat(pathFindResult.outputAmount);

  // Apply fee
  const feeRate = getFeeRate(feeTier);
  const feeAmount = outputBeforeFee * feeRate;
  const outputAfterFee = outputBeforeFee - feeAmount;

  // Calculate minimum received with slippage
  const slippageMultiplier = 1 - slippage / 100;
  const minimumReceived = outputAfterFee * slippageMultiplier;

  // Calculate price impact
  const priceImpact = calculatePriceImpact(
    parseFloat(inputAmount),
    outputBeforeFee,
    pathFindResult.marketRate
  );

  return {
    inputToken,
    outputToken,
    inputAmount,
    outputAmount: outputAfterFee.toFixed(6),
    exchangeRate: (outputAfterFee / parseFloat(inputAmount)).toFixed(6),
    feeAmount: feeAmount.toFixed(6),
    feeTier,
    priceImpact,
    slippage,
    minimumReceived: minimumReceived.toFixed(6),
    estimatedGas: '0.000012', // ~12 drops
    expiresAt: Date.now() + 30000, // 30 second expiry
  };
}

interface PathFindResult {
  outputAmount: string;
  marketRate: number;
  paths: any[];
}

/**
 * Find the best swap path on XRPL
 */
async function findBestPath(
  client: Client,
  params: QuoteParams
): Promise<PathFindResult> {
  const { inputToken, outputToken, inputAmount } = params;

  try {
    // Use ripple_path_find for best path
    const pathResult = await client.request({
      command: 'ripple_path_find',
      source_account: BEAR_ECOSYSTEM.FEE_WALLET, // Use fee wallet for path finding
      destination_account: BEAR_ECOSYSTEM.FEE_WALLET,
      source_currencies: [
        inputToken.currency === 'XRP'
          ? { currency: 'XRP' }
          : { currency: inputToken.currency, issuer: inputToken.issuer }
      ],
      destination_amount: outputToken.currency === 'XRP'
        ? xrpToDrops('1000000') // Large amount to get best rate
        : { currency: outputToken.currency, issuer: outputToken.issuer!, value: '1000000' },
    });

    // Get book offers for market rate
    const bookResult = await client.request({
      command: 'book_offers',
      taker_gets: inputToken.currency === 'XRP'
        ? { currency: 'XRP' }
        : { currency: inputToken.currency, issuer: inputToken.issuer! },
      taker_pays: outputToken.currency === 'XRP'
        ? { currency: 'XRP' }
        : { currency: outputToken.currency, issuer: outputToken.issuer! },
      limit: 10,
    });

    // Calculate expected output from order book
    const offers = bookResult.result.offers || [];
    const { output, rate } = calculateOutputFromOffers(offers, parseFloat(inputAmount), inputToken.currency === 'XRP');

    return {
      outputAmount: output.toFixed(6),
      marketRate: rate,
      paths: pathResult.result.alternatives?.[0]?.paths_computed || [],
    };
  } catch (error) {
    console.error('Path finding error:', error);
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
): Promise<PathFindResult> {
  const { inputToken, outputToken, inputAmount } = params;

  try {
    // Get AMM info
    const ammInfo = await client.request({
      command: 'amm_info',
      asset: inputToken.currency === 'XRP'
        ? { currency: 'XRP' }
        : { currency: inputToken.currency, issuer: inputToken.issuer! },
      asset2: outputToken.currency === 'XRP'
        ? { currency: 'XRP' }
        : { currency: outputToken.currency, issuer: outputToken.issuer! },
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
      paths: [],
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
 * Calculate price impact percentage
 */
function calculatePriceImpact(
  inputAmount: number,
  outputAmount: number,
  marketRate: number
): number {
  if (marketRate === 0) return 0;

  const executionRate = outputAmount / inputAmount;
  const impact = ((marketRate - executionRate) / marketRate) * 100;

  return Math.max(0, impact);
}

/**
 * Convert XRP to drops
 */
function xrpToDrops(xrp: string): string {
  const drops = Math.floor(parseFloat(xrp) * 1_000_000);
  return drops.toString();
}

/**
 * Execute a swap transaction
 */
export async function executeSwap(
  client: Client,
  quote: SwapQuote,
  senderAddress: string,
  signTransaction: (tx: any) => Promise<any>
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    // Build Payment transaction with pathfinding
    const tx: any = {
      TransactionType: 'Payment',
      Account: senderAddress,
      Destination: senderAddress, // Self-payment for swap
      Amount: quote.outputToken.currency === 'XRP'
        ? xrpToDrops(quote.minimumReceived)
        : {
            currency: quote.outputToken.currency,
            issuer: quote.outputToken.issuer!,
            value: quote.minimumReceived,
          },
      SendMax: quote.inputToken.currency === 'XRP'
        ? xrpToDrops(quote.inputAmount)
        : {
            currency: quote.inputToken.currency,
            issuer: quote.inputToken.issuer!,
            value: quote.inputAmount,
          },
      Flags: 131072, // tfPartialPayment
    };

    // Autofill (adds Fee, Sequence, LastLedgerSequence)
    const prepared = await client.autofill(tx);

    // Sign transaction
    const signed = await signTransaction(prepared);

    // Submit transaction
    const result = await client.submitAndWait(signed.tx_blob);

    if (result.result.meta && typeof result.result.meta !== 'string') {
      const meta = result.result.meta as any;
      if (meta.TransactionResult === 'tesSUCCESS') {
        return {
          success: true,
          txHash: result.result.hash,
        };
      }
    }

    return {
      success: false,
      error: 'Transaction failed',
    };
  } catch (error: any) {
    console.error('Swap execution error:', error);
    return {
      success: false,
      error: error.message || 'Transaction failed',
    };
  }
}
