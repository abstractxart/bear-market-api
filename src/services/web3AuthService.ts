/**
 * BEAR MARKET - Web3Auth Service
 *
 * Enables social login (Google, X/Twitter) for wallet creation
 * Uses Web3Auth to derive non-custodial wallets from OAuth tokens
 *
 * NOTE: Web3Auth requires configuration at https://dashboard.web3auth.io
 * Set VITE_WEB3AUTH_CLIENT_ID in your .env file
 */

import { Wallet } from 'xrpl';

// Web3Auth Client ID - Get yours at https://dashboard.web3auth.io
const WEB3AUTH_CLIENT_ID = import.meta.env.VITE_WEB3AUTH_CLIENT_ID || '';

let web3authInstance: any = null;
let isInitialized = false;

/**
 * Initialize Web3Auth (lazy load to avoid build issues)
 */
export const initWeb3Auth = async (): Promise<any> => {
  if (web3authInstance && isInitialized) {
    return web3authInstance;
  }

  // Check if client ID is configured
  if (!WEB3AUTH_CLIENT_ID) {
    console.warn('Web3Auth: No client ID configured. Social login disabled.');
    return null;
  }

  try {
    // Dynamic import to avoid build issues
    const { Web3Auth } = await import('@web3auth/modal');
    const { WEB3AUTH_NETWORK } = await import('@web3auth/base');

    web3authInstance = new Web3Auth({
      clientId: WEB3AUTH_CLIENT_ID,
      web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
    });

    // Initialize the modal
    if (web3authInstance.initModal) {
      await web3authInstance.initModal();
    } else if (web3authInstance.init) {
      await web3authInstance.init();
    }

    isInitialized = true;
    return web3authInstance;
  } catch (error) {
    console.error('Web3Auth initialization failed:', error);
    return null;
  }
};

/**
 * Login with social provider and get XRPL wallet
 */
export const loginWithSocial = async (): Promise<{ address: string; privateKey: string }> => {
  const auth = await initWeb3Auth();

  if (!auth) {
    throw new Error('Social login not available. Please use secret key login.');
  }

  // Connect - this opens the Web3Auth modal
  const web3authProvider = await auth.connect();

  if (!web3authProvider) {
    throw new Error('Failed to connect with Web3Auth');
  }

  // Get the private key from Web3Auth
  const privateKeyHex = await web3authProvider.request({
    method: 'eth_private_key',
  }) as string;

  if (!privateKeyHex) {
    throw new Error('Failed to get private key from Web3Auth');
  }

  // Convert the hex private key to XRPL wallet
  const privateKeyBytes = hexToBytes(privateKeyHex.replace('0x', ''));

  // Create XRPL wallet from the derived key
  const wallet = Wallet.fromEntropy(privateKeyBytes);

  return {
    address: wallet.classicAddress,
    privateKey: wallet.seed!,
  };
};

/**
 * Get user info from Web3Auth session
 */
export const getUserInfo = async (): Promise<{
  email?: string;
  name?: string;
  profileImage?: string;
} | null> => {
  if (!web3authInstance || !web3authInstance.connected) {
    return null;
  }

  try {
    const user = await web3authInstance.getUserInfo();
    return {
      email: user.email,
      name: user.name,
      profileImage: user.profileImage,
    };
  } catch {
    return null;
  }
};

/**
 * Check if already logged in
 */
export const isLoggedIn = (): boolean => {
  return web3authInstance?.connected ?? false;
};

/**
 * Logout from Web3Auth
 */
export const logout = async (): Promise<void> => {
  if (web3authInstance && web3authInstance.connected) {
    await web3authInstance.logout();
  }
};

/**
 * Convert hex string to bytes
 */
const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
};
