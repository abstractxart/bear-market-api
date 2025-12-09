/**
 * API Routes for BEAR SWAP Backend
 */

import express from 'express';
import { getTokenMetadata, updateTokenMetadata, setCTOWallet } from './tokenMetadata';
import { initiateKickOAuth, handleKickCallback, verifyKickChannel } from './kickOAuth';
import { getRecentBurnTransactions, getBurnStatistics } from './burnRoutes';
import { manualConvertXRP, manualBurnLP } from './adminRoutes';
import { verifyWalletAuth, verifyWalletSignature, getAuthChallenge } from './authMiddleware';

const router = express.Router();

// Token Metadata Routes
router.get('/token/:currency/:issuer/metadata', getTokenMetadata);
router.post('/token/:currency/:issuer/metadata', updateTokenMetadata);
router.post('/token/:currency/:issuer/cto', setCTOWallet);

// Kick OAuth Routes
router.post('/kick/oauth/initiate', initiateKickOAuth);
router.get('/kick/callback', handleKickCallback);
router.post('/kick/verify', verifyKickChannel);

// Burn Statistics Routes (Public - for transparency)
router.get('/burn/recent', getRecentBurnTransactions);
router.get('/burn/stats', getBurnStatistics);

// Authentication Routes
router.get('/auth/challenge', getAuthChallenge);
router.post('/auth/verify-wallet', verifyWalletSignature);

// Admin Routes (WALLET-PROTECTED)
router.post('/admin/convert-xrp', verifyWalletAuth, manualConvertXRP);
router.post('/admin/burn-lp', verifyWalletAuth, manualBurnLP);

export default router;
