/**
 * Token Metadata Service
 * Frontend service for managing token metadata via backend API
 */

export interface TokenMetadata {
  currency: string;
  issuer: string;
  cto_wallet?: string;
  kick_stream_url?: string;
  discord_url?: string;
  twitter_url?: string;
  telegram_url?: string;
  website1_url?: string;
  website2_url?: string;
  website3_url?: string;
  description?: string;
  logo_url?: string;
}

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Get token metadata
 */
export async function getTokenMetadata(currency: string, issuer: string): Promise<TokenMetadata> {
  try {
    const response = await fetch(`${API_BASE_URL}/token/${currency}/${issuer}/metadata`);

    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Token Metadata] Failed to get metadata:', error);
    // Return empty metadata on error
    return {
      currency,
      issuer,
      cto_wallet: undefined,
      kick_stream_url: undefined,
      discord_url: undefined,
      twitter_url: undefined,
      telegram_url: undefined,
      website1_url: undefined,
      website2_url: undefined,
      website3_url: undefined,
      description: undefined,
      logo_url: undefined,
    };
  }
}

/**
 * Update token metadata (issuer/CTO only)
 */
export async function updateTokenMetadata(
  currency: string,
  issuer: string,
  walletAddress: string,
  updates: Partial<TokenMetadata>
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/token/${currency}/${issuer}/metadata`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet_address: walletAddress,
        ...updates,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to update metadata');
    }

    await response.json();
    return { success: true };
  } catch (error) {
    console.error('[Token Metadata] Failed to update metadata:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update metadata',
    };
  }
}

/**
 * Set CTO wallet (issuer only)
 */
export async function setCTOWallet(
  currency: string,
  issuer: string,
  walletAddress: string,
  ctoWallet: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/token/${currency}/${issuer}/cto`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet_address: walletAddress,
        cto_wallet: ctoWallet,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to set CTO wallet');
    }

    return { success: true };
  } catch (error) {
    console.error('[Token Metadata] Failed to set CTO wallet:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set CTO wallet',
    };
  }
}
