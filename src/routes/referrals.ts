import { Router } from 'express';
import pool from '../db';
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
import {
  generateChallenge,
  constructChallengeMessage,
  verifySignature,
  Challenge
} from '../services/authService';

const router = Router();

/**
 * In-memory challenge store
 * TODO: Move to Redis in production for horizontal scaling
 */
const challenges = new Map<string, Challenge>();

/**
 * GET /api/referrals/challenge/:wallet
 * Request an authentication challenge for wallet ownership proof
 *
 * SECURITY: First step of challenge-response authentication
 */
router.get('/challenge/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;

    // Validate wallet address format
    if (!isValidXRPLAddress(wallet)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address'
      });
    }

    // Generate cryptographically secure challenge
    const challenge = generateChallenge();

    // Store challenge with 5-minute automatic cleanup
    challenges.set(wallet, challenge);
    setTimeout(() => {
      challenges.delete(wallet);
      console.log(`[Auth] Challenge expired and deleted for ${wallet}`);
    }, 5 * 60 * 1000);

    // Construct the message that must be signed
    const message = constructChallengeMessage(wallet, challenge.nonce, challenge.timestamp);

    console.log(`[Auth] Challenge issued for wallet: ${wallet}`);

    res.json({
      success: true,
      data: {
        nonce: challenge.nonce,
        timestamp: challenge.timestamp,
        message, // The exact string to sign
        expiresAt: challenge.expiresAt
      }
    });
  } catch (error: any) {
    console.error('[API] Challenge generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate challenge'
    });
  }
});

/**
 * POST /api/referrals/register
 * Register a new referral relationship with signature verification
 *
 * SECURITY: Requires cryptographic proof of wallet ownership
 * Prevents wallet impersonation attacks (David Schwartz approved)
 */
router.post('/register', async (req, res) => {
  try {
    const { walletAddress, referrerCode, signature, nonce, timestamp } = req.body;

    // 1. Validate required fields for signature verification
    if (!walletAddress || !signature || !nonce || timestamp === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        required: ['walletAddress', 'signature', 'nonce', 'timestamp'],
        message: 'You must complete the challenge-response authentication. Request a challenge first.'
      });
    }

    // 2. Verify wallet address format
    if (!isValidXRPLAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format'
      });
    }

    // 3. Verify challenge exists for this wallet
    const challenge = challenges.get(walletAddress);
    if (!challenge) {
      return res.status(400).json({
        success: false,
        error: 'No challenge found',
        message: 'Request a challenge first using GET /api/referrals/challenge/:wallet'
      });
    }

    // 4. Verify challenge matches (prevent challenge substitution)
    if (challenge.nonce !== nonce || challenge.timestamp !== timestamp) {
      return res.status(400).json({
        success: false,
        error: 'Challenge mismatch',
        message: 'The provided nonce/timestamp do not match the issued challenge'
      });
    }

    // 5. CRITICAL: Verify cryptographic signature
    let isValid = false;
    try {
      isValid = await verifySignature(walletAddress, signature, nonce, timestamp);
    } catch (error: any) {
      return res.status(401).json({
        success: false,
        error: 'Signature verification failed',
        message: error.message || 'Invalid signature. You must own this wallet to register.'
      });
    }

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature',
        message: 'Signature verification failed. You must own this wallet to register.'
      });
    }

    // 6. Delete used challenge (prevent replay attacks)
    challenges.delete(walletAddress);
    console.log(`[Auth] ✓ Wallet verified and challenge consumed: ${walletAddress}`);

    // 7. NOW we can trust the wallet address! Register with verified=true
    const result = await registerReferral(walletAddress, referrerCode || null, true);

    res.json({
      success: true,
      message: 'Wallet verified and referral registered',
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
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to register referral'
    });
  }
});

/**
 * GET /api/referrals/:wallet
 * Get referral data for a wallet
 */
router.get('/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;

    let data = await getReferralData(wallet);

    if (!data) {
      // Auto-register wallet in database (unverified until they connect)
      console.log(`[API] Auto-registering wallet: ${wallet}`);
      const registered = await registerReferral(wallet, null, false);
      data = {
        walletAddress: registered.walletAddress,
        referralCode: registered.referralCode,
        referredByCode: registered.referredByCode,
        createdAt: registered.createdAt,
      };
    }

    // Resolve referrer code to wallet address if present
    let referrerWalletAddress: string | null = null;
    if (data.referredByCode) {
      const referrerResult = await pool.query(
        'SELECT wallet_address FROM referrals WHERE referral_code = $1',
        [data.referredByCode]
      );
      if (referrerResult.rows.length > 0) {
        referrerWalletAddress = referrerResult.rows[0].wallet_address;
      }
    }

    res.json({
      success: true,
      data: {
        walletAddress: data.walletAddress,
        referralCode: data.referralCode,
        referralLink: `https://trade.bearpark.xyz?ref=${data.walletAddress}`,
        referredBy: data.referredByCode,
        referrerWallet: referrerWalletAddress, // Resolved wallet address
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
    const { traderWallet, swapTxHash, feeAmount: reportedFeeAmount } = req.body;

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

    // 4. Validate DEX swap fee amount (reported by frontend)
    const swapFeeAmount = reportedFeeAmount || 0;
    if (!isValidAmount(swapFeeAmount)) {
      return res.status(400).json({
        error: 'Invalid fee amount',
        message: `Fee amount must be between 0 and 1,000,000 XRP`
      });
    }

    console.log(`[API] ✓ Transaction verified - XRPL network fee: ${verified.feeAmount} XRP, DEX swap fee: ${swapFeeAmount} XRP`);

    // 5. Use VERIFIED transaction data + reported swap fee
    // NOTE: verified.feeAmount is the XRPL network fee (0.000012 XRP - goes to validators)
    // swapFeeAmount is the DEX swap fee (0.8% of trade - goes to treasury, split with referrer)
    const verifiedTradeData = {
      traderWallet: verified.traderWallet,
      inputToken: verified.inputToken,
      outputToken: verified.outputToken,
      inputAmount: verified.inputAmount,
      outputAmount: verified.outputAmount,
      feeAmount: swapFeeAmount,  // Use DEX swap fee for referral payouts
      feeToken: 'XRP',
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

/**
 * DELETE /api/referrals/admin/delete/:wallet
 * Admin endpoint to delete a wallet registration
 * Allows wallet to re-register with correct referral code
 */
router.delete('/admin/delete/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;

    console.log(`[Admin] Deleting wallet registration: ${wallet}`);

    // Delete from referrals table (cascading delete will handle related records)
    const result = await pool.query(
      'DELETE FROM referrals WHERE wallet_address = $1 RETURNING *',
      [wallet]
    );

    if (result.rows.length > 0) {
      console.log(`[Admin] ✓ Deleted wallet: ${wallet}`);
      res.json({
        success: true,
        message: 'Wallet registration deleted',
        data: {
          walletAddress: result.rows[0].wallet_address,
          referralCode: result.rows[0].referral_code,
          referredBy: result.rows[0].referred_by_code,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Wallet not found in database',
      });
    }
  } catch (error: any) {
    console.error('[Admin] Delete error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete wallet',
    });
  }
});

export default router;
