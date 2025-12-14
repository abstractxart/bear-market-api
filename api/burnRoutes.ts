/**
 * Burn Statistics API Routes
 * Public endpoints to show transparency in fee burning
 */

import { Request, Response } from 'express';
import { Client } from 'xrpl';
import { getRecentBurns, getBurnStats } from './db';

const TREASURY_WALLET = 'rBEARKfWJS1LYdg2g6t99BgbvpWY5pgMB9';
const BLACKHOLE_WALLET = 'rBEARmPLNA8CMu92P4vj95fkyCt1N4jrNm';
const BEAR_ISSUER = 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW';
const BEAR_CURRENCY = '4245415200000000000000000000000000000000';

/**
 * GET /api/burn/status
 * Get real-time burn service status
 */
export async function getBurnServiceStatus(req: Request, res: Response) {
  try {
    const client = new Client('wss://xrplcluster.com');
    await client.connect();

    // Get treasury XRP balance
    let treasuryXRP = '0';
    let treasuryLP = '0';
    let lpCurrency = '';
    let lpIssuer = '';

    try {
      const accountInfo = await client.request({
        command: 'account_info',
        account: TREASURY_WALLET,
        ledger_index: 'validated',
      });
      treasuryXRP = (parseFloat(accountInfo.result.account_data.Balance) / 1_000_000).toFixed(6);
    } catch (e) {
      console.error('Failed to get treasury XRP balance:', e);
    }

    // Get AMM LP token info
    try {
      const ammInfo = await client.request({
        command: 'amm_info',
        asset: { currency: BEAR_CURRENCY, issuer: BEAR_ISSUER },
        asset2: { currency: 'XRP' },
      });

      const lpToken = ammInfo.result.amm?.lp_token;
      if (lpToken) {
        lpCurrency = lpToken.currency;
        lpIssuer = lpToken.issuer;

        // Get treasury LP balance
        const accountLines = await client.request({
          command: 'account_lines',
          account: TREASURY_WALLET,
          ledger_index: 'validated',
        });

        const lpLine = accountLines.result.lines.find(
          (line: any) => line.currency === lpCurrency && line.account === lpIssuer
        );
        if (lpLine) {
          treasuryLP = lpLine.balance;
        }
      }
    } catch (e) {
      console.error('Failed to get LP token info:', e);
    }

    await client.disconnect();

    // Get last burn from database
    const stats = await getBurnStats();

    const isServiceEnabled = !!process.env.TREASURY_WALLET_SECRET;
    const xrpThreshold = parseFloat(process.env.XRP_BURN_THRESHOLD || '1');
    const needsConversion = parseFloat(treasuryXRP) >= xrpThreshold;
    const needsBurn = parseFloat(treasuryLP) > 0;

    res.json({
      success: true,
      data: {
        serviceEnabled: isServiceEnabled,
        serviceStatus: isServiceEnabled ? 'RUNNING' : 'DISABLED - TREASURY_WALLET_SECRET not set',
        cronSchedule: process.env.BURN_CRON_SCHEDULE || '*/5 * * * *',
        xrpThreshold,
        treasury: {
          address: TREASURY_WALLET,
          xrpBalance: treasuryXRP,
          lpBalance: treasuryLP,
          needsConversion,
          needsBurn,
        },
        blackhole: BLACKHOLE_WALLET,
        lastActivity: {
          lastDepositTime: stats.lastDepositTime,
          lastBurnTime: stats.lastBurnTime,
          totalDeposits: stats.totalDeposits,
          totalBurns: stats.totalBurns,
        },
      },
    });
  } catch (error: any) {
    console.error('[Burn Service Status Error]:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get burn service status',
      message: error.message,
    });
  }
}

/**
 * GET /api/burn/recent
 * Get recent burn transactions
 */
export async function getRecentBurnTransactions(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const burns = await getRecentBurns(limit);

    res.json({
      success: true,
      data: burns,
    });
  } catch (error: any) {
    console.error('[Get Recent Burns Error]:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch recent burns',
    });
  }
}

/**
 * GET /api/burn/stats
 * Get burn statistics
 */
export async function getBurnStatistics(req: Request, res: Response) {
  try {
    const stats = await getBurnStats();

    res.json({
      success: true,
      data: {
        totalDeposits: stats.totalDeposits,
        totalBurns: stats.totalBurns,
        totalXRPConverted: stats.totalXRPConverted,
        totalLPTokensBurned: stats.totalLPTokensBurned,
        lastDepositTime: stats.lastDepositTime,
        lastBurnTime: stats.lastBurnTime,
        treasuryWallet: 'rBEARKfWJS1LYdg2g6t99BgbvpWY5pgMB9',
        blackholeWallet: 'rBEARmPLNA8CMu92P4vj95fkyCt1N4jrNm',
      },
    });
  } catch (error: any) {
    console.error('[Get Burn Stats Error]:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch burn statistics',
    });
  }
}
