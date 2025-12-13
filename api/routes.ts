/**
 * API Routes for BEAR SWAP Backend
 */

import express, { Request, Response } from 'express';
import { getTokenMetadata, updateTokenMetadata, setCTOWallet } from './tokenMetadata';
import { initiateKickOAuth, handleKickCallback, verifyKickChannel } from './kickOAuth';
import { getRecentBurnTransactions, getBurnStatistics } from './burnRoutes';
import { manualConvertXRP, manualBurnLP } from './adminRoutes';
import { verifyWalletAuth, verifyWalletSignature, getAuthChallenge } from './authMiddleware';

const router = express.Router();

// ==================== PROXY ROUTE ====================

// Allowed external API domains for proxy requests (SECURITY: whitelist approach)
const ALLOWED_PROXY_DOMAINS = [
  'api.onthedex.live',
  's1.xrplmeta.org',
  'api.xrpscan.com',
  'data.xrplf.org',
  'api.xrpl.to',
];

/**
 * GET /api/proxy
 * CORS proxy for whitelisted external APIs
 *
 * SECURITY:
 * - Only allows requests to whitelisted domains
 * - Rate limited by infrastructure
 * - Prevents SSRF attacks
 */
router.get('/proxy', async (req: Request, res: Response) => {
  try {
    const targetUrl = req.query.url as string;

    if (!targetUrl) {
      return res.status(400).json({ error: 'Missing url parameter' });
    }

    // Parse and validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // SECURITY: Only allow HTTPS
    if (parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only HTTPS URLs allowed' });
    }

    // SECURITY: Whitelist check - prevent SSRF attacks
    if (!ALLOWED_PROXY_DOMAINS.includes(parsedUrl.hostname)) {
      console.warn(`[Proxy] Blocked request to non-whitelisted domain: ${parsedUrl.hostname}`);
      return res.status(403).json({
        error: 'Domain not allowed',
        allowed: ALLOWED_PROXY_DOMAINS,
      });
    }

    // Fetch from external API
    const response = await fetch(targetUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BearSwap-Backend/1.0',
      },
    });

    const contentType = response.headers.get('content-type');
    const data = await response.text();

    // Forward the response
    res.status(response.status);
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    }
    res.send(data);

  } catch (error: any) {
    console.error('[Proxy] Error:', error.message);
    res.status(500).json({ error: 'Proxy request failed', message: error.message });
  }
});

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
