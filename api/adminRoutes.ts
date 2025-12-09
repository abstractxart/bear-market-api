/**
 * Admin API Routes
 * Open access endpoints for manual burn control
 * SECURITY: Wallet secret stays on server, never exposed to client
 */

import { Request, Response } from 'express';
import { Client, Wallet } from 'xrpl';
import { logBurnTransaction } from './db';

const TREASURY_WALLET = 'rBEARKfWJS1LYdg2g6t99BgbvpWY5pgMB9';
const BLACKHOLE_WALLET = 'rBEARmPLNA8CMu92P4vj95fkyCt1N4jrNm';
const BEAR_ISSUER = 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW';
const BEAR_CURRENCY = '4245415200000000000000000000000000000000'; // "BEAR" in hex format
const TREASURY_WALLET_SECRET = process.env.TREASURY_WALLET_SECRET;

/**
 * POST /api/admin/convert-xrp
 * Manually convert XRP to LP tokens
 */
export async function manualConvertXRP(req: Request, res: Response) {
  if (!TREASURY_WALLET_SECRET) {
    return res.status(500).json({
      success: false,
      error: 'Treasury wallet secret not configured',
    });
  }

  try {
    const client = new Client('wss://xrplcluster.com');
    await client.connect();

    // Get current XRP balance
    const accountInfo = await client.request({
      command: 'account_info',
      account: TREASURY_WALLET,
      ledger_index: 'validated',
    });

    const xrpBalance = parseFloat(accountInfo.result.account_data.Balance) / 1_000_000;

    if (xrpBalance <= 1.1) {
      await client.disconnect();
      return res.status(400).json({
        success: false,
        error: 'Insufficient XRP balance (need > 1.1 XRP)',
        balance: xrpBalance,
      });
    }

    const wallet = Wallet.fromSeed(TREASURY_WALLET_SECRET);
    const depositAmount = (xrpBalance - 1.1).toFixed(6);

    // Create AMM deposit transaction
    const ammDepositTx: any = {
      TransactionType: 'AMMDeposit',
      Account: wallet.address,
      Asset: {
        currency: BEAR_CURRENCY,
        issuer: BEAR_ISSUER,
      },
      Asset2: {
        currency: 'XRP',
      },
      Amount: (parseFloat(depositAmount) * 1_000_000).toString(),
      Flags: 0x00080000, // tfSingleAsset
    };

    const prepared = await client.autofill(ammDepositTx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (result.result.meta && typeof result.result.meta === 'object') {
      const meta = result.result.meta as any;

      if (meta.TransactionResult === 'tesSUCCESS') {
        // Extract LP tokens received from metadata
        const nodes = meta.AffectedNodes || [];
        let lpTokensReceived = '0';
        let lpCurrency = '';
        let lpIssuer = '';

        for (const node of nodes) {
          const modified = node.ModifiedNode || node.CreatedNode;
          if (modified?.LedgerEntryType === 'RippleState') {
            const finalFields = modified.FinalFields || modified.NewFields;
            if (finalFields?.HighLimit?.issuer && finalFields.Balance) {
              lpTokensReceived = finalFields.Balance.value || finalFields.Balance;
              lpCurrency = finalFields.Balance.currency || finalFields.LimitAmount?.currency;
              lpIssuer = finalFields.HighLimit.issuer;
              break;
            }
          }
        }

        // Log to database
        await logBurnTransaction({
          action: 'deposit',
          txHash: signed.hash,
          xrpAmount: depositAmount,
          lpTokenAmount: lpTokensReceived,
          lpTokenCurrency: lpCurrency,
          lpTokenIssuer: lpIssuer,
        });

        await client.disconnect();

        return res.json({
          success: true,
          data: {
            txHash: signed.hash,
            xrpAmount: depositAmount,
            lpTokensReceived,
            message: `Successfully converted ${depositAmount} XRP to LP tokens`,
          },
        });
      } else {
        await client.disconnect();
        return res.status(400).json({
          success: false,
          error: `Transaction failed: ${meta.TransactionResult}`,
        });
      }
    }

    await client.disconnect();
    return res.status(500).json({
      success: false,
      error: 'Unknown transaction result',
    });
  } catch (error: any) {
    console.error('[Manual Convert XRP Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to convert XRP',
    });
  }
}

/**
 * POST /api/admin/burn-lp
 * Manually burn LP tokens to blackhole
 */
export async function manualBurnLP(req: Request, res: Response) {
  if (!TREASURY_WALLET_SECRET) {
    return res.status(500).json({
      success: false,
      error: 'Treasury wallet secret not configured',
    });
  }

  try {
    const client = new Client('wss://xrplcluster.com');
    await client.connect();

    // Get LP token info
    const ammInfo = await client.request({
      command: 'amm_info',
      asset: {
        currency: BEAR_CURRENCY,
        issuer: BEAR_ISSUER,
      },
      asset2: {
        currency: 'XRP',
      },
    });

    const lpToken = ammInfo.result.amm?.lp_token;

    if (!lpToken) {
      await client.disconnect();
      return res.status(400).json({
        success: false,
        error: 'LP token not found',
      });
    }

    // Get LP token balance
    const accountLines = await client.request({
      command: 'account_lines',
      account: TREASURY_WALLET,
      ledger_index: 'validated',
    });

    const lpLine = accountLines.result.lines.find(
      (line: any) =>
        line.currency === lpToken.currency &&
        line.account === lpToken.issuer
    );

    if (!lpLine || parseFloat(lpLine.balance) <= 0) {
      await client.disconnect();
      return res.status(400).json({
        success: false,
        error: 'No LP tokens to burn',
        balance: lpLine?.balance || '0',
      });
    }

    const wallet = Wallet.fromSeed(TREASURY_WALLET_SECRET);

    // Create payment to blackhole
    const paymentTx: any = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: BLACKHOLE_WALLET,
      Amount: {
        currency: lpToken.currency,
        issuer: lpToken.issuer,
        value: lpLine.balance,
      },
      Memos: [
        {
          Memo: {
            MemoData: Buffer.from('BEAR LP Token Manual Burn - Admin Dashboard', 'utf8').toString('hex').toUpperCase(),
            MemoType: Buffer.from('BEARSwap/ManualBurn', 'utf8').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const prepared = await client.autofill(paymentTx);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    if (result.result.meta && typeof result.result.meta === 'object') {
      const meta = result.result.meta as any;

      if (meta.TransactionResult === 'tesSUCCESS') {
        // Log to database
        await logBurnTransaction({
          action: 'burn',
          txHash: signed.hash,
          xrpAmount: null,
          lpTokenAmount: lpLine.balance,
          lpTokenCurrency: lpToken.currency,
          lpTokenIssuer: lpToken.issuer,
        });

        await client.disconnect();

        return res.json({
          success: true,
          data: {
            txHash: signed.hash,
            lpTokenAmount: lpLine.balance,
            message: `Successfully burned ${parseFloat(lpLine.balance).toFixed(2)} LP tokens`,
          },
        });
      } else {
        await client.disconnect();
        return res.status(400).json({
          success: false,
          error: `Transaction failed: ${meta.TransactionResult}`,
        });
      }
    }

    await client.disconnect();
    return res.status(500).json({
      success: false,
      error: 'Unknown transaction result',
    });
  } catch (error: any) {
    console.error('[Manual Burn LP Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to burn LP tokens',
    });
  }
}

