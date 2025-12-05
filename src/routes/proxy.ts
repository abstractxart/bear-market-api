/**
 * CORS Proxy for token APIs
 *
 * Frontend can't call external APIs due to CORS restrictions.
 * This proxy forwards requests server-side where CORS doesn't apply.
 */

import express from 'express';

const router = express.Router();

// Whitelist of allowed API domains
const ALLOWED_APIS = [
  'api.xrpl.to',
  'api.dexscreener.com',
  'api.firstledger.net',
  'api.sologenic.org',
  's1.xrplmeta.org',
  'api.xpmarket.com',
  'api.xrpscan.com',
  'api.onthedex.live',
];

/**
 * GET /api/proxy?url=<encoded-url>
 * Proxies requests to allowed external APIs
 */
router.get('/', async (req, res) => {
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
      return res.status(400).json({ error: 'Invalid URL' });
    }

    // Check if domain is whitelisted
    const isAllowed = ALLOWED_APIS.some(domain =>
      parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`)
    );

    if (!isAllowed) {
      return res.status(403).json({ error: 'Domain not whitelisted' });
    }

    // Fetch from target API
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'BEAR-MARKET/1.0',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `API returned ${response.status}`
      });
    }

    const data = await response.json();
    res.json(data);

  } catch (error: any) {
    console.error('[Proxy] Error:', error);
    res.status(500).json({ error: error.message || 'Proxy error' });
  }
});

export default router;
