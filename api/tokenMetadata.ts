/**
 * Token Metadata API
 * Handles token information, social links, and Kick streams for token issuers/CTOs
 */

import { Request, Response } from 'express';

interface TokenMetadata {
  currency: string;
  issuer: string;
  cto_wallet?: string; // Community Take Over wallet
  kick_stream_url?: string;
  discord_url?: string;
  twitter_url?: string;
  telegram_url?: string;
  website1_url?: string;
  website2_url?: string;
  website3_url?: string;
  description?: string;
  logo_url?: string;
  updated_at: Date;
  updated_by: string; // Wallet address that made the update
}

// In-memory store (replace with PostgreSQL in production)
const tokenMetadataStore = new Map<string, TokenMetadata>();

// Hardcoded CTO wallets for known tokens
// Format: 'CURRENCY:ISSUER' -> 'CTO_WALLET_ADDRESS'
const HARDCODED_CTO_WALLETS: Record<string, string> = {
  'BEAR:rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW': 'rKkkYMCvC63HEgxjQHmayKADaxYqnsMUkT',
};

/**
 * Get token metadata
 */
export const getTokenMetadata = async (req: Request, res: Response) => {
  try {
    const { currency, issuer } = req.params;

    if (!currency || !issuer) {
      return res.status(400).json({ error: 'Currency and issuer are required' });
    }

    const key = `${currency}:${issuer}`;
    const metadata = tokenMetadataStore.get(key);

    if (!metadata) {
      // Return default empty metadata
      return res.json({
        currency,
        issuer,
        cto_wallet: null,
        kick_stream_url: null,
        discord_url: null,
        twitter_url: null,
        telegram_url: null,
        website1_url: null,
        website2_url: null,
        website3_url: null,
        description: null,
        logo_url: null,
      });
    }

    return res.json(metadata);
  } catch (error) {
    console.error('[Token Metadata] Get error:', error);
    return res.status(500).json({ error: 'Failed to get token metadata' });
  }
};

/**
 * Update token metadata (issuer/CTO only)
 */
export const updateTokenMetadata = async (req: Request, res: Response) => {
  try {
    const { currency, issuer } = req.params;
    const {
      wallet_address,
      cto_wallet,
      kick_stream_url,
      discord_url,
      twitter_url,
      telegram_url,
      website1_url,
      website2_url,
      website3_url,
      description,
      logo_url,
    } = req.body;

    if (!currency || !issuer || !wallet_address) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const key = `${currency}:${issuer}`;
    const existing = tokenMetadataStore.get(key);

    // Check authorization: wallet must be issuer OR CTO wallet
    // Check hardcoded CTO wallets first, then database, then request body
    const hardcodedCTO = HARDCODED_CTO_WALLETS[key];
    const ctoWalletForToken = hardcodedCTO || existing?.cto_wallet || cto_wallet;
    const isAuthorized = wallet_address === issuer || wallet_address === ctoWalletForToken;

    console.log('[Token Metadata] Authorization check:', {
      wallet_address,
      issuer,
      ctoWalletForToken,
      hardcodedCTO,
      isAuthorized,
    });

    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Unauthorized: Only token issuer or CTO wallet can update metadata'
      });
    }

    // Validate URLs if provided
    const urlFields = {
      kick_stream_url,
      discord_url,
      twitter_url,
      telegram_url,
      website1_url,
      website2_url,
      website3_url,
      logo_url,
    };

    for (const [field, url] of Object.entries(urlFields)) {
      if (url && !isValidUrl(url)) {
        return res.status(400).json({ error: `Invalid URL for ${field}` });
      }
    }

    // Update metadata
    const metadata: TokenMetadata = {
      currency,
      issuer,
      cto_wallet: cto_wallet || existing?.cto_wallet,
      kick_stream_url: kick_stream_url ?? existing?.kick_stream_url,
      discord_url: discord_url ?? existing?.discord_url,
      twitter_url: twitter_url ?? existing?.twitter_url,
      telegram_url: telegram_url ?? existing?.telegram_url,
      website1_url: website1_url ?? existing?.website1_url,
      website2_url: website2_url ?? existing?.website2_url,
      website3_url: website3_url ?? existing?.website3_url,
      description: description ?? existing?.description,
      logo_url: logo_url ?? existing?.logo_url,
      updated_at: new Date(),
      updated_by: wallet_address,
    };

    tokenMetadataStore.set(key, metadata);

    return res.json({
      success: true,
      metadata,
    });
  } catch (error) {
    console.error('[Token Metadata] Update error:', error);
    return res.status(500).json({ error: 'Failed to update token metadata' });
  }
};

/**
 * Set CTO wallet (issuer only)
 */
export const setCTOWallet = async (req: Request, res: Response) => {
  try {
    const { currency, issuer } = req.params;
    const { wallet_address, cto_wallet } = req.body;

    if (!currency || !issuer || !wallet_address || !cto_wallet) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // ONLY the issuer can set the CTO wallet
    if (wallet_address !== issuer) {
      return res.status(403).json({
        error: 'Unauthorized: Only the token issuer can set the CTO wallet'
      });
    }

    // Validate CTO wallet address
    if (!isValidXRPLAddress(cto_wallet)) {
      return res.status(400).json({ error: 'Invalid XRPL address for CTO wallet' });
    }

    const key = `${currency}:${issuer}`;
    const existing = tokenMetadataStore.get(key);

    const metadata: TokenMetadata = {
      ...(existing || { currency, issuer }),
      cto_wallet,
      updated_at: new Date(),
      updated_by: wallet_address,
    };

    tokenMetadataStore.set(key, metadata);

    return res.json({
      success: true,
      cto_wallet,
    });
  } catch (error) {
    console.error('[Token Metadata] Set CTO wallet error:', error);
    return res.status(500).json({ error: 'Failed to set CTO wallet' });
  }
};

// Helper functions
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function isValidXRPLAddress(address: string): boolean {
  // Basic XRPL address validation (starts with 'r' and is 25-35 chars)
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
}
