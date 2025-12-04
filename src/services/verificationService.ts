/**
 * XRPL Transaction Verification Service
 *
 * CRITICAL SECURITY COMPONENT
 * Verifies all trade claims against XRPL ledger to prevent:
 * - Fake transaction submissions
 * - Amount manipulation
 * - Replay attacks
 * - Old transaction reuse
 */

import { Client, Payment, OfferCreate } from 'xrpl';

const XRPL_SERVER = process.env.XRPL_SERVER || 'wss://s.altnet.rippletest.net:51233';
const MAX_TRANSACTION_AGE_MS = 5 * 60 * 1000; // 5 minutes

export interface VerifiedTrade {
  isValid: boolean;
  traderWallet: string;
  feeAmount: number;
  feeToken: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  txHash: string;
  ledgerIndex: number;
  error?: string;
}

/**
 * Convert Ripple epoch time to Unix timestamp
 */
function rippleTimeToUnixTime(rippleTime: number): number {
  return (rippleTime + 946684800) * 1000;
}

/**
 * Verify XRPL transaction and extract trade details
 */
export async function verifyXRPLTransaction(
  txHash: string,
  claimedTraderWallet: string
): Promise<VerifiedTrade> {
  const client = new Client(XRPL_SERVER);

  try {
    await client.connect();
    console.log(`[Verification] Checking transaction: ${txHash}`);

    // 1. Fetch transaction from ledger
    let txResponse;
    try {
      txResponse = await client.request({
        command: 'tx',
        transaction: txHash,
        binary: false
      });
    } catch (error: any) {
      return {
        isValid: false,
        traderWallet: claimedTraderWallet,
        feeAmount: 0,
        feeToken: 'XRP',
        inputToken: '',
        outputToken: '',
        inputAmount: 0,
        outputAmount: 0,
        txHash,
        ledgerIndex: 0,
        error: `Transaction not found on ledger: ${error.message}`
      };
    }

    const tx = txResponse.result;

    // 2. Verify transaction succeeded
    if (!tx.meta || typeof tx.meta !== 'object') {
      return {
        isValid: false,
        traderWallet: claimedTraderWallet,
        feeAmount: 0,
        feeToken: 'XRP',
        inputToken: '',
        outputToken: '',
        inputAmount: 0,
        outputAmount: 0,
        txHash,
        ledgerIndex: 0,
        error: 'Invalid transaction metadata'
      };
    }

    const meta = tx.meta as any;
    if (meta.TransactionResult !== 'tesSUCCESS') {
      return {
        isValid: false,
        traderWallet: claimedTraderWallet,
        feeAmount: 0,
        feeToken: 'XRP',
        inputToken: '',
        outputToken: '',
        inputAmount: 0,
        outputAmount: 0,
        txHash,
        ledgerIndex: 0,
        error: `Transaction failed: ${meta.TransactionResult}`
      };
    }

    // 3. Verify transaction is from claimed wallet
    if (tx.Account !== claimedTraderWallet) {
      return {
        isValid: false,
        traderWallet: claimedTraderWallet,
        feeAmount: 0,
        feeToken: 'XRP',
        inputToken: '',
        outputToken: '',
        inputAmount: 0,
        outputAmount: 0,
        txHash,
        ledgerIndex: 0,
        error: `Wallet mismatch: tx from ${tx.Account}, claimed ${claimedTraderWallet}`
      };
    }

    // 4. Verify transaction is recent (prevent old transaction replay)
    const txTimestamp = rippleTimeToUnixTime(tx.date);
    const age = Date.now() - txTimestamp;

    if (age > MAX_TRANSACTION_AGE_MS) {
      return {
        isValid: false,
        traderWallet: claimedTraderWallet,
        feeAmount: 0,
        feeToken: 'XRP',
        inputToken: '',
        outputToken: '',
        inputAmount: 0,
        outputAmount: 0,
        txHash,
        ledgerIndex: 0,
        error: `Transaction too old: ${Math.floor(age / 1000)}s (max ${MAX_TRANSACTION_AGE_MS / 1000}s)`
      };
    }

    // 5. Verify transaction is fully validated (not from a fork)
    if (!tx.validated) {
      return {
        isValid: false,
        traderWallet: claimedTraderWallet,
        feeAmount: 0,
        feeToken: 'XRP',
        inputToken: '',
        outputToken: '',
        inputAmount: 0,
        outputAmount: 0,
        txHash,
        ledgerIndex: 0,
        error: 'Transaction not fully validated on ledger'
      };
    }

    // 6. Extract fee from transaction (this is the ACTUAL fee paid, not claimed)
    const feeInDrops = typeof tx.Fee === 'string' ? parseInt(tx.Fee) : tx.Fee;
    const actualFee = feeInDrops / 1000000; // Convert drops to XRP

    // 7. Parse transaction type and extract trade details
    let inputToken = '';
    let outputToken = '';
    let inputAmount = 0;
    let outputAmount = 0;

    if (tx.TransactionType === 'Payment') {
      const payment = tx as Payment;

      // Handle XRP amounts
      if (typeof payment.Amount === 'string') {
        outputAmount = parseInt(payment.Amount) / 1000000;
        outputToken = 'XRP';
      } else {
        outputAmount = parseFloat(payment.Amount.value);
        outputToken = payment.Amount.currency;
      }

      // For payments, we consider SendMax as input if present
      if (payment.SendMax) {
        if (typeof payment.SendMax === 'string') {
          inputAmount = parseInt(payment.SendMax) / 1000000;
          inputToken = 'XRP';
        } else {
          inputAmount = parseFloat(payment.SendMax.value);
          inputToken = payment.SendMax.currency;
        }
      } else {
        // If no SendMax, input = output for simple payments
        inputAmount = outputAmount;
        inputToken = outputToken;
      }

    } else if (tx.TransactionType === 'OfferCreate') {
      const offer = tx as OfferCreate;

      // TakerGets = what taker receives (seller gives)
      if (typeof offer.TakerGets === 'string') {
        outputAmount = parseInt(offer.TakerGets) / 1000000;
        outputToken = 'XRP';
      } else {
        outputAmount = parseFloat(offer.TakerGets.value);
        outputToken = offer.TakerGets.currency;
      }

      // TakerPays = what taker pays (seller receives)
      if (typeof offer.TakerPays === 'string') {
        inputAmount = parseInt(offer.TakerPays) / 1000000;
        inputToken = 'XRP';
      } else {
        inputAmount = parseFloat(offer.TakerPays.value);
        inputToken = offer.TakerPays.currency;
      }

    } else {
      return {
        isValid: false,
        traderWallet: claimedTraderWallet,
        feeAmount: 0,
        feeToken: 'XRP',
        inputToken: '',
        outputToken: '',
        inputAmount: 0,
        outputAmount: 0,
        txHash,
        ledgerIndex: 0,
        error: `Invalid transaction type: ${tx.TransactionType} (must be Payment or OfferCreate)`
      };
    }

    // 8. Return verified trade data
    console.log(`[Verification] ✓ Transaction verified: ${txHash}`);
    console.log(`[Verification]   Wallet: ${tx.Account}`);
    console.log(`[Verification]   Fee: ${actualFee} XRP`);
    console.log(`[Verification]   Trade: ${inputAmount} ${inputToken} → ${outputAmount} ${outputToken}`);

    return {
      isValid: true,
      traderWallet: tx.Account,
      feeAmount: actualFee,
      feeToken: 'XRP',
      inputToken,
      outputToken,
      inputAmount,
      outputAmount,
      txHash,
      ledgerIndex: tx.ledger_index || 0
    };

  } catch (error: any) {
    console.error('[Verification] Error:', error);
    return {
      isValid: false,
      traderWallet: claimedTraderWallet,
      feeAmount: 0,
      feeToken: 'XRP',
      inputToken: '',
      outputToken: '',
      inputAmount: 0,
      outputAmount: 0,
      txHash,
      ledgerIndex: 0,
      error: error.message || 'Unknown verification error'
    };
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

/**
 * Validate XRPL wallet address format
 */
export function isValidXRPLAddress(address: string): boolean {
  // XRPL addresses start with 'r' and are 25-35 characters (base58)
  const addressRegex = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
  return addressRegex.test(address);
}

/**
 * Validate amount is positive and reasonable
 */
export function isValidAmount(amount: number): boolean {
  return (
    typeof amount === 'number' &&
    !isNaN(amount) &&
    isFinite(amount) &&
    amount > 0 &&
    amount < 1000000 // Max 1M units to prevent overflow
  );
}
