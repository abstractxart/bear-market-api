import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Client } from 'xrpl';
import type { WalletState, TokenBalance } from '../types';
import { checkPixelBearNFTs } from '../services/nftService';
import { getKeyManager } from '../security/SecureKeyManager';
import { normalizeCurrency } from '../utils/currency';
import { getStoredReferralCode, registerReferral } from '../services/referralService';

// XRPL Client Configuration
const XRPL_MAINNET = 'wss://xrplcluster.com';
const XRPL_TESTNET = 'wss://s.altnet.rippletest.net:51233';

// Use mainnet in production, testnet for development
const XRPL_ENDPOINT = import.meta.env.PROD ? XRPL_MAINNET : XRPL_TESTNET;

interface WalletContextType {
  wallet: WalletState;
  xrplClient: Client | null;
  isConnecting: boolean;
  error: string | null;

  // Connection methods
  connectWithSecret: (secret: string) => Promise<void>;
  // REMOVED: connectWithAddress - Security vulnerability (wallet impersonation)
  disconnect: () => void;

  // Wallet operations
  refreshBalance: () => Promise<void>;
  refreshFeeTier: () => Promise<void>;
  signTransaction: (tx: any) => Promise<{ tx_blob: string; hash: string }>;
}

const defaultWalletState: WalletState = {
  address: null,
  connectionType: 'none',
  isConnected: false,
  feeTier: 'regular',
  balance: {
    xrp: '0',
    tokens: [],
  },
  honeyPoints: 0,
};

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<WalletState>(defaultWalletState);
  const [xrplClient, setXrplClient] = useState<Client | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize XRPL client
  useEffect(() => {
    console.log(`[XRPL Client] Connecting to: ${XRPL_ENDPOINT}`);
    console.log(`[XRPL Client] Environment: ${import.meta.env.PROD ? 'PRODUCTION' : 'DEVELOPMENT'}`);

    const client = new Client(XRPL_ENDPOINT);

    client.connect().then(() => {
      console.log(`[XRPL Client] Connected successfully to ${XRPL_ENDPOINT}`);
      setXrplClient(client);
    }).catch((err) => {
      console.error('Failed to connect to XRPL:', err);
      setError('Failed to connect to XRPL network');
    });

    return () => {
      client.disconnect();
    };
  }, []);

  // Refresh XRP and token balances
  const refreshBalance = useCallback(async () => {
    if (!xrplClient || !wallet.address) return;

    try {
      // Get XRP balance and server state for reserve calculation
      const [accountInfo, serverState] = await Promise.all([
        xrplClient.request({
          command: 'account_info',
          account: wallet.address,
          ledger_index: 'validated',
        }),
        xrplClient.request({
          command: 'server_state',
        }),
      ]);

      const xrpBalance = accountInfo.result.account_data.Balance;
      const ownerCount = accountInfo.result.account_data.OwnerCount || 0;

      // Get reserve requirements from server state (in drops)
      // As of Dec 2024: base = 1 XRP, owner = 0.2 XRP per object
      const validatedLedger = serverState.result.state.validated_ledger;
      const baseReserveDrops = validatedLedger?.reserve_base || 1_000_000; // 1 XRP default (Dec 2024)
      const ownerReserveDrops = validatedLedger?.reserve_inc || 200_000; // 0.2 XRP default (Dec 2024)

      // Calculate total reserved and spendable XRP
      const totalDrops = BigInt(xrpBalance);
      const reservedDrops = BigInt(baseReserveDrops) + BigInt(ownerReserveDrops) * BigInt(ownerCount);
      const spendableDrops = totalDrops > reservedDrops ? totalDrops - reservedDrops : BigInt(0);

      // Show SPENDABLE balance only (not locked reserves)
      const xrpFormatted = (Number(spendableDrops) / 1_000_000).toFixed(6);

      // Get token balances
      const accountLines = await xrplClient.request({
        command: 'account_lines',
        account: wallet.address,
        ledger_index: 'validated',
      });

      const tokenBalances: TokenBalance[] = accountLines.result.lines.map((line: any) => {
        // Normalize currency code (convert hex to human-readable for currencies like RLUSD)
        const currency = normalizeCurrency(line.currency);
        return {
          token: {
            currency,
            issuer: line.account,
            name: currency,
            symbol: currency,
            decimals: 15,
          },
          balance: line.balance,
        };
      });

      setWallet((prev) => ({
        ...prev,
        balance: {
          xrp: xrpFormatted,
          tokens: tokenBalances,
        },
      }));
    } catch (err) {
      console.error('Failed to refresh balance:', err);
    }
  }, [xrplClient, wallet.address]);

  // Check NFT holdings for fee tier
  const refreshFeeTier = useCallback(async () => {
    if (!xrplClient || !wallet.address) {
      console.warn('Fee tier check skipped: client or address not ready');
      return;
    }

    try {
      const nftResult = await checkPixelBearNFTs(xrplClient, wallet.address);
      console.log(`Fee tier detected: ${nftResult.tier}`);
      setWallet((prev) => ({
        ...prev,
        feeTier: nftResult.tier,
      }));
    } catch (err) {
      console.error('Failed to check NFT tier:', err);
    }
  }, [xrplClient, wallet.address]);

  // Connect with secret key (uses SecureKeyManager)
  const connectWithSecret = useCallback(async (secret: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      // WAIT for XRPL client to be ready
      if (!xrplClient) {
        throw new Error('XRPL client not ready. Please wait a moment and try again.');
      }

      const keyManager = getKeyManager();
      const { address } = await keyManager.initializeSessionOnly(secret);

      setWallet({
        address: address,
        connectionType: 'manual',
        isConnected: true,
        feeTier: 'regular', // Will be updated by NFT check below
        balance: { xrp: '0', tokens: [] },
        honeyPoints: 0,
      });

      // Immediately trigger fee tier check (don't rely on useEffect timing)
      if (xrplClient && address) {
        try {
          const nftResult = await checkPixelBearNFTs(xrplClient, address);
          setWallet((prev) => ({
            ...prev,
            feeTier: nftResult.tier,
          }));
        } catch (err) {
          console.error('Failed to check NFT tier during connection:', err);
        }
      }

      // Register referral if there's a stored referral code
      const storedRefCode = getStoredReferralCode();
      if (storedRefCode) {
        registerReferral(address, storedRefCode)
          .then(result => {
            if (result) {
              console.log(`[Wallet] Registered referral from code: ${storedRefCode}`);
            }
          })
          .catch(error => {
            console.error(`[Wallet] Failed to register referral:`, error);
          });
      }

    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      setError(err.message || 'Invalid secret key');
    } finally {
      setIsConnecting(false);
    }
  }, [xrplClient]);

  // REMOVED: connectWithAddress() - CRITICAL SECURITY VULNERABILITY
  // This function allowed wallet impersonation attacks by accepting any address
  // without proof of ownership. Users must now connect with:
  // 1. connectWithSecret() - Requires actual wallet control
  // 2. External wallet providers (future) - Xumm, Crossmark, etc.
  //
  // David Schwartz approved this removal.

  // Auto-refresh balance when wallet address changes
  useEffect(() => {
    if (wallet.address && xrplClient) {
      refreshBalance();
      refreshFeeTier();
    }
  }, [wallet.address, xrplClient, refreshBalance, refreshFeeTier]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    // Destroy key material securely
    const keyManager = getKeyManager();
    keyManager.destroy();

    // Clear wallet state
    setWallet(defaultWalletState);
  }, []);

  // Sign transaction using SecureKeyManager
  const signTransaction = useCallback(async (tx: any): Promise<{ tx_blob: string; hash: string }> => {
    const keyManager = getKeyManager();

    if (!keyManager.hasKey()) {
      throw new Error('No wallet connected');
    }

    if (keyManager.isLocked()) {
      throw new Error('Wallet is locked');
    }

    // Sign using the secure key manager
    return await keyManager.signTransaction(tx);
  }, []);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        xrplClient,
        isConnecting,
        error,
        connectWithSecret,
        // connectWithAddress REMOVED - security vulnerability
        disconnect,
        refreshBalance,
        refreshFeeTier,
        signTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
