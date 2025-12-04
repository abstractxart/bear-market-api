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
 */
async function sendXRPPayout(
  client: Client,
  tradeId: number,
  referrerWallet: string,
  amount: number
): Promise<void> {
  const hotWalletSeed = process.env.HOT_WALLET_SEED;

  if (!hotWalletSeed) {
    console.error('[Payout] HOT_WALLET_SEED not configured!');
    await pool.query(
      `INSERT INTO payouts (trade_id, referrer_wallet, amount, token, status, error_message)
       VALUES ($1, $2, $3, 'XRP', 'failed', 'Hot wallet not configured')`,
      [tradeId, referrerWallet, amount]
    );
    return;
  }

  try {
    await client.connect();

    const hotWallet = Wallet.fromSeed(hotWalletSeed);
    console.log(`[Payout] Using hot wallet: ${hotWallet.address}`);

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

    // Submit payment
    const prepared = await client.autofill(payment);
    const signed = hotWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
      const txResult = result.result.meta.TransactionResult;

      if (txResult === 'tesSUCCESS') {
        const txHash = result.result.hash;
        console.log(`[Payout] SUCCESS! TX: ${txHash}`);

        // Record successful payout
        await pool.query(
          `INSERT INTO payouts (trade_id, referrer_wallet, amount, token, tx_hash, status, completed_at)
           VALUES ($1, $2, $3, 'XRP', $4, 'completed', NOW())`,
          [tradeId, referrerWallet, amount, txHash]
        );
      } else {
        throw new Error(`Transaction failed: ${txResult}`);
      }
    } else {
      throw new Error('Invalid transaction result');
    }

  } catch (error: any) {
    console.error('[Payout] Failed to send XRP:', error);

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
