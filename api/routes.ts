/**
 * API Routes for BEAR SWAP Backend
 */

import express from 'express';
import { getTokenMetadata, updateTokenMetadata, setCTOWallet } from './tokenMetadata';
import { initiateKickOAuth, handleKickCallback, verifyKickChannel } from './kickOAuth';
import { getRecentBurnTransactions, getBurnStatistics } from './burnRoutes';
import { manualConvertXRP, manualBurnLP } from './adminRoutes';

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

// Admin Routes (NO PASSWORD - OPEN ACCESS)
router.post('/admin/convert-xrp', manualConvertXRP);
router.post('/admin/burn-lp', manualBurnLP);

export default router;
