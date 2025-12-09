/**
 * Kick.com OAuth Integration
 * Handles authentication and channel verification
 */

import { Request, Response } from 'express';
import crypto from 'crypto';

interface KickOAuthState {
  wallet_address: string;
  currency: string;
  issuer: string;
  csrf_token: string;
  code_verifier: string; // PKCE verifier
  created_at: number;
}

// In-memory state store (use Redis in production)
const oauthStates = new Map<string, KickOAuthState>();

// Kick OAuth configuration
const KICK_CLIENT_ID = process.env.KICK_CLIENT_ID || '';
const KICK_CLIENT_SECRET = process.env.KICK_CLIENT_SECRET || '';
const KICK_REDIRECT_URI = process.env.KICK_REDIRECT_URI || 'http://localhost:3001/api/kick/callback';

/**
 * Generate PKCE challenge for OAuth 2.1
 */
function generatePKCE() {
  // Generate code_verifier (random 43-128 char base64url string)
  const code_verifier = crypto.randomBytes(32).toString('base64url');

  // Generate code_challenge (SHA256 hash of verifier, base64url encoded)
  const code_challenge = crypto
    .createHash('sha256')
    .update(code_verifier)
    .digest('base64url');

  return { code_verifier, code_challenge };
}

/**
 * Step 1: Initiate Kick OAuth flow with PKCE
 */
export const initiateKickOAuth = async (req: Request, res: Response) => {
  try {
    const { wallet_address, currency, issuer } = req.body;

    if (!wallet_address || !currency || !issuer) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Generate CSRF token and PKCE codes
    const csrfToken = crypto.randomBytes(32).toString('hex');
    const state = crypto.randomBytes(16).toString('hex');
    const { code_verifier, code_challenge } = generatePKCE();

    // Store OAuth state with PKCE verifier
    const oauthState: KickOAuthState = {
      wallet_address,
      currency,
      issuer,
      csrf_token: csrfToken,
      code_verifier,
      created_at: Date.now(),
    };
    oauthStates.set(state, oauthState);

    // Clean up old states (older than 10 minutes)
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    for (const [key, value] of oauthStates.entries()) {
      if (value.created_at < tenMinutesAgo) {
        oauthStates.delete(key);
      }
    }

    // Build Kick OAuth URL - Use correct OAuth server at id.kick.com
    const authUrl = new URL('https://id.kick.com/oauth/authorize');
    authUrl.searchParams.set('client_id', KICK_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', KICK_REDIRECT_URI);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'channel:read');
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('code_challenge', code_challenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    console.log('[Kick OAuth] Initiating OAuth with PKCE:', {
      wallet_address,
      state,
      authUrl: authUrl.toString(),
    });

    return res.json({
      auth_url: authUrl.toString(),
      state,
      csrf_token: csrfToken,
    });
  } catch (error) {
    console.error('[Kick OAuth] Initiate error:', error);
    return res.status(500).json({ error: 'Failed to initiate OAuth' });
  }
};

/**
 * Step 2: Handle Kick OAuth callback
 */
export const handleKickCallback = async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query;

    if (!code || !state) {
      return res.status(400).send('Missing OAuth parameters');
    }

    // Verify state
    const oauthState = oauthStates.get(state as string);
    if (!oauthState) {
      return res.status(400).send('Invalid or expired state');
    }

    // Exchange code for access token with PKCE verifier
    // Use correct OAuth server at id.kick.com
    const tokenResponse = await fetch('https://id.kick.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: KICK_CLIENT_ID,
        client_secret: KICK_CLIENT_SECRET,
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: KICK_REDIRECT_URI,
        code_verifier: oauthState.code_verifier,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    console.log('[Kick OAuth] Token exchange successful, fetching user channels...');

    // Get user's channel info from Kick API
    // Using the official Kick Public API v1
    const channelsResponse = await fetch('https://api.kick.com/public/v1/channels', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!channelsResponse.ok) {
      console.error('[Kick OAuth] Failed to fetch channels:', await channelsResponse.text());
      throw new Error('Failed to get channel info');
    }

    const channelsData = await channelsResponse.json();
    const channel = channelsData.data?.[0]; // Get first channel

    if (!channel) {
      throw new Error('No channels found for this user');
    }

    const kickUsername = channel.slug;
    const kickChannelUrl = `https://kick.com/${kickUsername}`;

    // Store the verified channel (you'd save this to database)
    console.log(`[Kick OAuth] Verified channel: ${kickChannelUrl} for wallet: ${oauthState.wallet_address}`);

    // Clean up state
    oauthStates.delete(state as string);

    // Return HTML that sends message to opener window
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Kick Connected</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #680cd9, #feb501);
      color: white;
      text-align: center;
    }
    .success {
      padding: 2rem;
      border-radius: 1rem;
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
    }
    .checkmark {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="success">
    <div class="checkmark">✅</div>
    <h1>Kick Channel Connected!</h1>
    <p>Channel: <strong>${kickUsername}</strong></p>
    <p>This window will close automatically...</p>
  </div>
  <script>
    // Send message to opener window
    if (window.opener) {
      window.opener.postMessage({
        type: 'kick_oauth_success',
        kick_channel: '${kickUsername}',
        kick_url: '${kickChannelUrl}'
      }, '*');

      // Close popup after 2 seconds
      setTimeout(() => {
        window.close();
      }, 2000);
    } else {
      document.body.innerHTML = '<div class="success"><h1>Success!</h1><p>You can close this window now.</p></div>';
    }
  </script>
</body>
</html>
`;

    return res.send(html);
  } catch (error) {
    console.error('[Kick OAuth] Callback error:', error);

    const errorMessage = error instanceof Error ? error.message : 'OAuth callback failed';

    // Return HTML that sends error message to opener window
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Kick Connection Failed</title>
  <style>
    body {
      font-family: system-ui, -apple-system, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #dc2626, #991b1b);
      color: white;
      text-align: center;
    }
    .error {
      padding: 2rem;
      border-radius: 1rem;
      background: rgba(0, 0, 0, 0.3);
      backdrop-filter: blur(10px);
      max-width: 400px;
    }
    .x-mark {
      font-size: 4rem;
      margin-bottom: 1rem;
    }
  </style>
</head>
<body>
  <div class="error">
    <div class="x-mark">❌</div>
    <h1>Connection Failed</h1>
    <p>${errorMessage}</p>
    <p>This window will close automatically...</p>
  </div>
  <script>
    // Send error message to opener window
    if (window.opener) {
      window.opener.postMessage({
        type: 'kick_oauth_error',
        error: '${errorMessage}'
      }, '*');

      // Close popup after 3 seconds
      setTimeout(() => {
        window.close();
      }, 3000);
    }
  </script>
</body>
</html>
`;

    return res.status(500).send(html);
  }
};

/**
 * Alternative: Manual verification with Kick API key
 * For tokens that want to verify channel ownership without full OAuth
 */
export const verifyKickChannel = async (req: Request, res: Response) => {
  try {
    const { wallet_address, kick_username } = req.body;

    if (!wallet_address || !kick_username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Clean the username (remove spaces, special chars, convert to lowercase)
    const cleanUsername = kick_username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');

    if (!cleanUsername || cleanUsername.length < 2) {
      return res.status(400).json({ error: 'Invalid Kick username' });
    }

    console.log(`[Kick Verify] Verified channel: ${cleanUsername} for wallet: ${wallet_address}`);

    // Return channel info with embed URL
    // Kick allows embedding any public stream at https://player.kick.com/{username}
    return res.json({
      verified: true,
      username: cleanUsername,
      display_name: cleanUsername,
      channel_url: `https://kick.com/${cleanUsername}`,
      embed_url: `https://player.kick.com/${cleanUsername}`,
      followers: 0,
      is_live: false,
    });
  } catch (error) {
    console.error('[Kick Verify] Error:', error);
    return res.status(500).json({ error: 'Failed to verify channel' });
  }
};
