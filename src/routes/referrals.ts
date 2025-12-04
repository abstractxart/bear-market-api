import { Router } from 'express';
import {
  registerReferral,
  getReferralData,
  getReferralStats,
  generateReferralCode,
} from '../services/referralService';
import { recordTradeAndPayout, getPayoutHistory } from '../services/payoutService';
import {
  verifyXRPLTransaction,
  isValidXRPLAddress,
  isValidAmount
} from '../services/verificationService';

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
 *
 * 🛡️ SECURITY HARDENED - Verifies ALL data against XRPL ledger
 */
router.post('/trades/record', async (req, res) => {
  try {
    const { traderWallet, swapTxHash } = req.body;

    // 1. CRITICAL: Require transaction hash (not optional anymore!)
    if (!swapTxHash || typeof swapTxHash !== 'string') {
      return res.status(400).json({
        error: 'swapTxHash is required',
        message: 'Transaction hash must be provided for verification'
      });
    }

    // 2. Validate wallet address format
    if (!traderWallet || !isValidXRPLAddress(traderWallet)) {
      return res.status(400).json({
        error: 'Invalid wallet address',
        message: 'traderWallet must be a valid XRPL address (starts with "r")'
      });
    }

    console.log(`[API] Trade record request: ${traderWallet} - ${swapTxHash}`);

    // 3. VERIFY TRANSACTION ON XRPL LEDGER (prevents fake trades!)
    const verified = await verifyXRPLTransaction(swapTxHash, traderWallet);

    if (!verified.isValid) {
      console.warn(`[API] Transaction verification failed: ${verified.error}`);
      return res.status(400).json({
        error: 'Transaction verification failed',
        message: verified.error,
        details: {
          txHash: swapTxHash,
          wallet: traderWallet
        }
      });
    }

    // 4. Validate amounts from VERIFIED data
    if (!isValidAmount(verified.feeAmount)) {
      return res.status(400).json({
        error: 'Invalid fee amount',
        message: `Fee amount must be between 0 and 1,000,000 XRP`
      });
    }

    // 5. Use VERIFIED data (not client-reported!)
    const verifiedTradeData = {
      traderWallet: verified.traderWallet,
      inputToken: verified.inputToken,
      outputToken: verified.outputToken,
      inputAmount: verified.inputAmount,
      outputAmount: verified.outputAmount,
      feeAmount: verified.feeAmount,  // ← CRITICAL: Use on-chain fee, not client claim!
      feeToken: verified.feeToken,
      swapTxHash: verified.txHash
    };

    console.log(`[API] ✓ Transaction verified - Fee: ${verified.feeAmount} XRP`);

    // 6. Record trade and trigger payout (async, don't wait)
    recordTradeAndPayout(verifiedTradeData).catch(error => {
      console.error('[API] Payout error (async):', error);
    });

    // Return immediately with success
    res.json({
      success: true,
      message: 'Trade verified and recorded, payout processing',
      data: {
        txHash: verified.txHash,
        feeAmount: verified.feeAmount,
        ledgerIndex: verified.ledgerIndex
      }
    });
  } catch (error: any) {
    console.error('[API] Record trade error:', error);
    res.status(500).json({
      error: error.message || 'Failed to record trade',
      message: 'Internal server error'
    });
  }
});

export default router;
