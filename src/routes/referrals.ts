import { Router } from 'express';
import {
  registerReferral,
  getReferralData,
  getReferralStats,
  generateReferralCode,
} from '../services/referralService';
import { recordTradeAndPayout, getPayoutHistory } from '../services/payoutService';

const router = Router();

/**
 * POST /api/referrals/register
 * Register a new referral relationship
 */
router.post('/register', async (req, res) => {
  try {
    const { walletAddress, referrerCode } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress is required' });
    }

    const result = await registerReferral(walletAddress, referrerCode || null);

    res.json({
      success: true,
      data: {
        walletAddress: result.walletAddress,
        referralCode: result.referralCode,
        referralLink: `${process.env.FRONTEND_URL_PROD}?ref=${result.referralCode}`,
        referredBy: result.referredByCode,
        createdAt: result.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[API] Register error:', error);
    res.status(500).json({ error: error.message || 'Failed to register referral' });
  }
});

/**
 * GET /api/referrals/:wallet
 * Get referral data for a wallet
 */
router.get('/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;

    const data = await getReferralData(wallet);

    if (!data) {
      // Auto-register if not found
      const code = generateReferralCode(wallet);
      return res.json({
        success: true,
        data: {
          walletAddress: wallet,
          referralCode: code,
          referralLink: `${process.env.FRONTEND_URL_PROD}?ref=${code}`,
          referredBy: null,
          createdAt: new Date(),
        },
      });
    }

    res.json({
      success: true,
      data: {
        walletAddress: data.walletAddress,
        referralCode: data.referralCode,
        referralLink: `${process.env.FRONTEND_URL_PROD}?ref=${data.referralCode}`,
        referredBy: data.referredByCode,
        createdAt: data.createdAt,
      },
    });
  } catch (error: any) {
    console.error('[API] Get referral error:', error);
    res.status(500).json({ error: error.message || 'Failed to get referral data' });
  }
});

/**
 * GET /api/referrals/:wallet/stats
 * Get referral stats (earnings, referrals count, etc.)
 */
router.get('/:wallet/stats', async (req, res) => {
  try {
    const { wallet } = req.params;

    const stats = await getReferralStats(wallet);

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('[API] Get stats error:', error);
    res.status(500).json({ error: error.message || 'Failed to get stats' });
  }
});

/**
 * GET /api/referrals/:wallet/payouts
 * Get payout history for a referrer
 */
router.get('/:wallet/payouts', async (req, res) => {
  try {
    const { wallet } = req.params;

    const payouts = await getPayoutHistory(wallet);

    res.json({
      success: true,
      data: payouts,
    });
  } catch (error: any) {
    console.error('[API] Get payouts error:', error);
    res.status(500).json({ error: error.message || 'Failed to get payout history' });
  }
});

/**
 * POST /api/referrals/trades/record
 * Record a trade and trigger automatic payout
 */
router.post('/trades/record', async (req, res) => {
  try {
    const tradeData = req.body;

    // Validate required fields
    const required = ['traderWallet', 'inputToken', 'outputToken', 'inputAmount', 'outputAmount', 'feeAmount', 'feeToken'];
    for (const field of required) {
      if (!tradeData[field]) {
        return res.status(400).json({ error: `${field} is required` });
      }
    }

    // Record trade and trigger payout (async, don't wait)
    recordTradeAndPayout(tradeData).catch(error => {
      console.error('[API] Payout error (async):', error);
    });

    // Return immediately
    res.json({
      success: true,
      message: 'Trade recorded, payout processing',
    });
  } catch (error: any) {
    console.error('[API] Record trade error:', error);
    res.status(500).json({ error: error.message || 'Failed to record trade' });
  }
});

export default router;
