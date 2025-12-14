/**
 * Auto-Burn Service
 * Automatically burns LP tokens by sending them to blackhole wallet
 */

import { Client, Wallet } from 'xrpl';
import cron from 'node-cron';
import { getXRPBalance, getLPTokenBalance, depositXRPToAMM, disconnect } from './ammDepositService';
import { logBurnTransaction } from './db';

// Treasury wallet that receives XRP fees
const TREASURY_WALLET = 'rBEARKfWJS1LYdg2g6t99BgbvpWY5pgMB9';

// Blackhole wallet (permanently locked)
const BLACKHOLE_WALLET = 'rBEARmPLNA8CMu92P4vj95fkyCt1N4jrNm';

// Minimum XRP threshold before converting to LP tokens
const XRP_THRESHOLD = parseFloat(process.env.XRP_BURN_THRESHOLD || '1');

// XRPL Client
let client: Client | null = null;

/**
 * Initialize XRPL client
 */
async function getClient(): Promise<Client> {
  if (!client || !client.isConnected()) {
    client = new Client('wss://xrplcluster.com');
    await client.connect();
  }
  return client;
}

/**
 * Send LP tokens to blackhole wallet
 */
async function sendLPTokensToBlackhole(
  walletSecret: string,
  lpTokenAmount: string,
  lpTokenCurrency: string,
  lpTokenIssuer: string
): Promise<string> {
  const xrplClient = await getClient();
  const wallet = Wallet.fromSeed(walletSecret);

  console.log(`🔥 Burning ${lpTokenAmount} LP tokens to blackhole...`);

  // Create Payment transaction to send LP tokens
  const paymentTx: any = {
    TransactionType: 'Payment',
    Account: wallet.address,
    Destination: BLACKHOLE_WALLET,
    Amount: {
      currency: lpTokenCurrency,
      issuer: lpTokenIssuer,
      value: lpTokenAmount,
    },
    Memos: [
      {
        Memo: {
          MemoData: Buffer.from('BEAR LP Token Burn - Fee Transparency', 'utf8').toString('hex').toUpperCase(),
          MemoType: Buffer.from('BEARSwap/Burn', 'utf8').toString('hex').toUpperCase(),
        },
      },
    ],
  };

  // Autofill
  const prepared = await xrplClient.autofill(paymentTx);

  // Sign
  const signed = wallet.sign(prepared);
  console.log(`✍️ Burn transaction signed: ${signed.hash}`);

  // Submit and wait
  const result = await xrplClient.submitAndWait(signed.tx_blob);

  if (result.result.meta && typeof result.result.meta === 'object') {
    const meta = result.result.meta as any;

    if (meta.TransactionResult !== 'tesSUCCESS') {
      throw new Error(`Burn failed: ${meta.TransactionResult}`);
    }

    console.log(`✅ LP tokens burned successfully!`);
    console.log(`🔗 TX: https://xrpscan.com/tx/${signed.hash}`);

    return signed.hash;
  }

  throw new Error('Burn transaction metadata not found');
}

/**
 * Main auto-burn loop
 * 1. Check treasury XRP balance
 * 2. If above threshold, deposit to AMM
 * 3. Check treasury LP token balance
 * 4. If LP tokens exist, send to blackhole
 */
export async function runAutoBurnCycle(): Promise<void> {
  const treasurySecret = process.env.TREASURY_WALLET_SECRET;

  if (!treasurySecret) {
    console.error('❌ TREASURY_WALLET_SECRET not set in environment variables');
    return;
  }

  console.log('\n🔄 Starting auto-burn cycle...');
  console.log(`⏰ ${new Date().toISOString()}`);

  try {
    // Step 1: Check XRP balance
    console.log('\n📊 Step 1: Checking treasury XRP balance...');
    const xrpBalance = await getXRPBalance(TREASURY_WALLET);
    console.log(`💰 Treasury XRP: ${xrpBalance} XRP`);

    // Step 2: Convert XRP to LP if above threshold
    if (parseFloat(xrpBalance) >= XRP_THRESHOLD) {
      console.log(`\n💎 Step 2: Converting XRP to BEAR/XRP LP tokens...`);
      console.log(`🎯 Threshold met: ${xrpBalance} XRP >= ${XRP_THRESHOLD} XRP`);

      // Leave 1 XRP for reserves and fees
      const depositAmount = (parseFloat(xrpBalance) - 1.1).toFixed(6);

      if (parseFloat(depositAmount) > 0) {
        const depositResult = await depositXRPToAMM(treasurySecret, depositAmount);

        // Log to database
        await logBurnTransaction({
          action: 'deposit',
          txHash: depositResult.txHash,
          xrpAmount: depositAmount,
          lpTokenAmount: depositResult.lpTokensReceived,
          lpTokenCurrency: depositResult.lpTokenCurrency,
          lpTokenIssuer: depositResult.lpTokenIssuer,
        });

        console.log(`✅ Deposited ${depositAmount} XRP → ${depositResult.lpTokensReceived} LP tokens`);
      } else {
        console.log(`⚠️ Insufficient XRP after reserves: ${depositAmount} XRP`);
      }
    } else {
      console.log(`⏸️ Below threshold: ${xrpBalance} XRP < ${XRP_THRESHOLD} XRP`);
    }

    // Step 3: Check LP token balance
    console.log(`\n📊 Step 3: Checking treasury LP token balance...`);
    const lpBalance = await getLPTokenBalance(TREASURY_WALLET);

    if (lpBalance && parseFloat(lpBalance.balance) > 0) {
      console.log(`🎫 LP Tokens found: ${lpBalance.balance}`);

      // Step 4: Burn LP tokens
      console.log(`\n🔥 Step 4: Burning LP tokens to blackhole...`);
      const burnTxHash = await sendLPTokensToBlackhole(
        treasurySecret,
        lpBalance.balance,
        lpBalance.currency,
        lpBalance.issuer
      );

      // Log to database
      await logBurnTransaction({
        action: 'burn',
        txHash: burnTxHash,
        xrpAmount: null,
        lpTokenAmount: lpBalance.balance,
        lpTokenCurrency: lpBalance.currency,
        lpTokenIssuer: lpBalance.issuer,
      });

      console.log(`✅ Burned ${lpBalance.balance} LP tokens to ${BLACKHOLE_WALLET}`);
    } else {
      console.log(`⏸️ No LP tokens to burn`);
    }

    console.log('\n✅ Auto-burn cycle completed successfully\n');
  } catch (error: any) {
    console.error('\n❌ Auto-burn cycle failed:', error.message);
    console.error(error);
  }
}

/**
 * Start auto-burn service with cron schedule
 */
export async function startAutoBurnService(): Promise<void> {
  // Get schedule from env or default to every 5 minutes
  const schedule = process.env.BURN_CRON_SCHEDULE || '*/5 * * * *';

  console.log('🚀 Starting BEAR LP Token Auto-Burn Service');
  console.log(`📅 Schedule: ${schedule} (every 5 minutes by default)`);
  console.log(`💰 Treasury: ${TREASURY_WALLET}`);
  console.log(`🔥 Blackhole: ${BLACKHOLE_WALLET}`);
  console.log(`🎯 XRP Threshold: ${XRP_THRESHOLD} XRP`);

  // Run immediately on startup
  console.log('\n🏁 Running initial burn cycle...');
  await runAutoBurnCycle();

  // Schedule recurring runs
  cron.schedule(schedule, async () => {
    await runAutoBurnCycle();
  });

  console.log('\n✅ Auto-burn service is running!\n');
}

/**
 * Cleanup on shutdown
 */
export async function stopAutoBurnService(): Promise<void> {
  await disconnect();
}
