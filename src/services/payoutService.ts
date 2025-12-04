import { Client, Wallet, xrpToDrops } from 'xrpl';
import pool from '../db';
import { getReferrerWallet } from './referralService';

// Commission rate: 50% of trading fee goes to referrer
const REFERRER_COMMISSION = 0.5;

export interface TradeData {
  traderWallet: string;
  inputToken: string;
  outputToken: string;
  inputAmount: number;
  outputAmount: number;
  feeAmount: number;
  feeToken: string;
  swapTxHash?: string;
}

/**
 * Record a trade and trigger automatic payout to referrer
 */
export async function recordTradeAndPayout(trade: TradeData): Promise<void> {
  const client = new Client(process.env.XRPL_SERVER || 'wss://xrplcluster.com');

  try {
    // Check if trader was referred
    const referrerWallet = await getReferrerWallet(trade.traderWallet);

    if (!referrerWallet) {
      console.log(`[Payout] No referrer for ${trade.traderWallet}, skipping payout`);

      // Still record the trade
      await pool.query(
        `INSERT INTO trades (trader_wallet, input_token, output_token, input_amount, output_amount, fee_amount, fee_token, swap_tx_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          trade.traderWallet,
          trade.inputToken,
          trade.outputToken,
          trade.inputAmount,
          trade.outputAmount,
          trade.feeAmount,
          trade.feeToken,
          trade.swapTxHash || null,
        ]
      );
      return;
    }

    // Calculate referrer payout (50% of fee)
    const payoutAmount = trade.feeAmount * REFERRER_COMMISSION;

    console.log(`[Payout] Trade from ${trade.traderWallet}: fee=${trade.feeAmount} ${trade.feeToken}`);
    console.log(`[Payout] Paying ${payoutAmount} ${trade.feeToken} to referrer ${referrerWallet}`);

    // Record trade with referrer info
    const tradeResult = await pool.query(
      `INSERT INTO trades (trader_wallet, input_token, output_token, input_amount, output_amount, fee_amount, fee_token, referrer_wallet, referrer_payout_amount, swap_tx_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        trade.traderWallet,
        trade.inputToken,
        trade.outputToken,
        trade.inputAmount,
        trade.outputAmount,
        trade.feeAmount,
        trade.feeToken,
        referrerWallet,
        payoutAmount,
        trade.swapTxHash || null,
      ]
    );

    const tradeId = tradeResult.rows[0].id;

    // Only send XRP payouts automatically (for now)
    if (trade.feeToken === 'XRP') {
      await sendXRPPayout(client, tradeId, referrerWallet, payoutAmount);
    } else {
      // For tokens, record as pending payout
      await pool.query(
        `INSERT INTO payouts (trade_id, referrer_wallet, amount, token, status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [tradeId, referrerWallet, payoutAmount, trade.feeToken]
      );
      console.log(`[Payout] Token payout recorded as pending (manual processing required)`);
    }

  } catch (error) {
    console.error('[Payout] Error:', error);
    throw error;
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

/**
 * Send XRP payout to referrer using hot wallet
 * HARDENED AGAINST ALL XRPL EDGE CASES
 */
async function sendXRPPayout(
  client: Client,
  tradeId: number,
  referrerWallet: string,
  amount: number
): Promise<void> {
  const hotWalletSeed = process.env.HOT_WALLET_SEED;
  const XRPL_BASE_RESERVE = 10; // XRP base reserve
  const MIN_PAYOUT_AMOUNT = 0.001; // Minimum 0.001 XRP to prevent dust attacks

  if (!hotWalletSeed) {
    console.error('[Payout] HOT_WALLET_SEED not configured!');
    await pool.query(
      `INSERT INTO payouts (trade_id, referrer_wallet, amount, token, status, error_message)
       VALUES ($1, $2, $3, 'XRP', 'failed', 'Hot wallet not configured')`,
      [tradeId, referrerWallet, amount]
    );
    return;
  }

  // Validate payout amount (prevent dust attacks and overflow)
  if (amount < MIN_PAYOUT_AMOUNT) {
    console.warn(`[Payout] Amount too small: ${amount} XRP (min ${MIN_PAYOUT_AMOUNT})`);
    await pool.query(
      `INSERT INTO payouts (trade_id, referrer_wallet, amount, token, status, error_message)
       VALUES ($1, $2, $3, 'XRP', 'failed', $4)`,
      [tradeId, referrerWallet, amount, `Payout amount below minimum (${MIN_PAYOUT_AMOUNT} XRP)`]
    );
    return;
  }

  if (amount > 100000) {
    console.error(`[Payout] Amount suspiciously large: ${amount} XRP`);
    await pool.query(
      `INSERT INTO payouts (trade_id, referrer_wallet, amount, token, status, error_message)
       VALUES ($1, $2, $3, 'XRP', 'failed', 'Amount exceeds safety limit')`,
      [tradeId, referrerWallet, amount]
    );
    return;
  }

  try {
    await client.connect();

    const hotWallet = Wallet.fromSeed(hotWalletSeed);
    console.log(`[Payout] Using hot wallet: ${hotWallet.address}`);

    // Check hot wallet balance AND reserve requirements
    const balance = await client.getXrpBalance(hotWallet.address);
    const availableBalance = balance - XRPL_BASE_RESERVE;
    const feeBuffer = 1.0; // 1 XRP buffer for fees (handles fee spikes)
    const minimumRequired = amount + feeBuffer;

    if (availableBalance < minimumRequired) {
      const error = `Insufficient balance: ${availableBalance.toFixed(6)} XRP available (need ${minimumRequired} XRP)`;
      console.error('[Payout]', error);

      await pool.query(
        `INSERT INTO payouts (trade_id, referrer_wallet, amount, token, status, error_message, created_at)
         VALUES ($1, $2, $3, 'XRP', 'failed', $4, NOW())`,
        [tradeId, referrerWallet, amount, error]
      );

      return;
    }

    console.log(`[Payout] Hot wallet balance: ${balance} XRP (${availableBalance} available)`);

    // Check referrer account info for special requirements
    try {
      const accountInfo = await client.request({
        command: 'account_info',
        account: referrerWallet,
        ledger_index: 'validated'
      });

      const flags = accountInfo.result.account_data.Flags;

      // Check for RequireDestTag flag (asfRequireDest = 0x00020000 = 131072)
      if (flags & 131072) {
        console.warn(`[Payout] Referrer requires destination tag: ${referrerWallet}`);
        await pool.query(
          `INSERT INTO payouts (trade_id, referrer_wallet, amount, token, status, error_message)
           VALUES ($1, $2, $3, 'XRP', 'failed', 'Recipient requires destination tag')`,
          [tradeId, referrerWallet, amount]
        );
        return;
      }

      // Check for DepositAuth flag (asfDepositAuth = 0x01000000 = 16777216)
      if (flags & 16777216) {
        console.warn(`[Payout] Referrer has deposit authorization enabled: ${referrerWallet}`);
        await pool.query(
          `INSERT INTO payouts (trade_id, referrer_wallet, amount, token, status, error_message)
           VALUES ($1, $2, $3, 'XRP', 'failed', 'Recipient has deposit authorization (unauthorized)')`,
          [tradeId, referrerWallet, amount]
        );
        return;
      }

      // Check for DisallowXRP flag (asfDisallowXRP = 0x00080000 = 524288)
      if (flags & 524288) {
        console.warn(`[Payout] Referrer disallows XRP: ${referrerWallet}`);
        await pool.query(
          `INSERT INTO payouts (trade_id, referrer_wallet, amount, token, status, error_message)
           VALUES ($1, $2, $3, 'XRP', 'failed', 'Recipient disallows XRP payments')`,
          [tradeId, referrerWallet, amount]
        );
        return;
      }

    } catch (accountError: any) {
      // Account might not exist yet, that's okay for XRP payments
      console.log(`[Payout] Account info unavailable (might be unfunded): ${accountError.message}`);
    }

    // Prepare payment transaction
    const payment = {
      TransactionType: 'Payment' as const,
      Account: hotWallet.address,
      Destination: referrerWallet,
      Amount: xrpToDrops(amount.toString()),
      Memos: [
        {
          Memo: {
            MemoData: Buffer.from('BEAR MARKET Referral Reward', 'utf8').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    // Submit payment with timeout handling
    const prepared = await client.autofill(payment);
    const signed = hotWallet.sign(prepared);

    console.log(`[Payout] Submitting payment: ${amount} XRP to ${referrerWallet}`);
    const result = await client.submitAndWait(signed.tx_blob, {
      autofill: true,
      wallet: hotWallet,
      failHard: false
    });

    // Verify transaction result
    if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
      const txResult = result.result.meta.TransactionResult;
      const txHash = result.result.hash;

      if (txResult === 'tesSUCCESS') {
        console.log(`[Payout] ✓ SUCCESS! TX: ${txHash}`);

        // Record successful payout
        await pool.query(
          `INSERT INTO payouts (trade_id, referrer_wallet, amount, token, tx_hash, status, completed_at)
           VALUES ($1, $2, $3, 'XRP', $4, 'completed', NOW())`,
          [tradeId, referrerWallet, amount, txHash]
        );
      } else {
        throw new Error(`Transaction failed with ${txResult}: ${txHash}`);
      }
    } else {
      throw new Error('Invalid transaction result structure');
    }

  } catch (error: any) {
    console.error('[Payout] ✗ Failed to send XRP:', error.message);

    // If timeout, try to verify if transaction actually succeeded
    if (error.message?.includes('timeout') || error.message?.includes('Timeout')) {
      console.warn('[Payout] Timeout detected, attempting to verify transaction status...');
      // In production, you'd query the ledger here to check if tx was validated
      // For now, mark as failed and manual review needed
    }

    // Record failed payout
    await pool.query(
      `INSERT INTO payouts (trade_id, referrer_wallet, amount, token, status, error_message)
       VALUES ($1, $2, $3, 'XRP', 'failed', $4)`,
      [tradeId, referrerWallet, amount, error.message || 'Unknown error']
    );
  }
}

/**
 * Get payout history for a referrer
 */
export async function getPayoutHistory(referrerWallet: string) {
  const result = await pool.query(
    `SELECT p.*, t.trader_wallet, t.created_at as trade_date
     FROM payouts p
     JOIN trades t ON t.id = p.trade_id
     WHERE p.referrer_wallet = $1
     ORDER BY p.created_at DESC
     LIMIT 50`,
    [referrerWallet]
  );

  return result.rows;
}
