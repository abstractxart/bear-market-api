/**
 * Burn Statistics API Routes
 * Public endpoints to show transparency in fee burning
 */

import { Request, Response } from 'express';
import { getRecentBurns, getBurnStats } from './db';

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
