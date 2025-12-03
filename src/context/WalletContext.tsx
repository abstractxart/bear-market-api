import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Client, Wallet } from 'xrpl';
import type { WalletState, WalletConnectionType, TokenBalance } from '../types';
import { checkPixelBearNFTs } from '../services/nftService';

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
  connectWithSeed: (seed: string) => Promise<void>;
  connectWithWalletConnect: () => Promise<void>;
  disconnect: () => void;

  // Wallet operations
  refreshBalance: () => Promise<void>;
  refreshFeeTier: () => Promise<void>;
  signTransaction: (tx: any) => Promise<any>;
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
  const [xrplWallet, setXrplWallet] = useState<Wallet | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize XRPL client
  useEffect(() => {
    const client = new Client(XRPL_ENDPOINT);

    client.connect().then(() => {
      console.log('Connected to XRPL:', XRPL_ENDPOINT);
      setXrplClient(client);
    }).catch((err) => {
      console.error('Failed to connect to XRPL:', err);
      setError('Failed to connect to XRPL network');
    });

    return () => {
      client.disconnect();
    };
  }, []);

  // Check for saved wallet on mount
  useEffect(() => {
    const savedAddress = localStorage.getItem('bear_wallet_address');
    const savedType = localStorage.getItem('bear_wallet_type') as WalletConnectionType;

    if (savedAddress && savedType) {
      // For manual wallets, we need to re-enter seed
      // For WalletConnect, we attempt reconnection
      if (savedType === 'walletconnect') {
        // TODO: Attempt WalletConnect session restoration
      }
    }
  }, []);

  // Refresh XRP and token balances
  const refreshBalance = useCallback(async () => {
    if (!xrplClient || !wallet.address) return;

    try {
      // Get XRP balance
      const accountInfo = await xrplClient.request({
        command: 'account_info',
        account: wallet.address,
        ledger_index: 'validated',
      });

      const xrpBalance = accountInfo.result.account_data.Balance;
      const xrpInDrops = BigInt(xrpBalance);
      const xrpFormatted = (Number(xrpInDrops) / 1_000_000).toFixed(6);

      // Get token balances
      const accountLines = await xrplClient.request({
        command: 'account_lines',
        account: wallet.address,
        ledger_index: 'validated',
      });

      const tokenBalances: TokenBalance[] = accountLines.result.lines.map((line: any) => ({
        token: {
          currency: line.currency,
          issuer: line.account,
          name: line.currency,
          symbol: line.currency,
          decimals: 15,
        },
        balance: line.balance,
      }));

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
    if (!xrplClient || !wallet.address) return;

    try {
      const nftResult = await checkPixelBearNFTs(xrplClient, wallet.address);
      setWallet((prev) => ({
        ...prev,
        feeTier: nftResult.tier,
      }));
    } catch (err) {
      console.error('Failed to check NFT tier:', err);
    }
  }, [xrplClient, wallet.address]);

  // Connect with seed phrase (manual import)
  const connectWithSeed = useCallback(async (seed: string) => {
    setIsConnecting(true);
    setError(null);

    try {
      // Validate and create wallet from seed
      const newWallet = Wallet.fromSeed(seed);

      setXrplWallet(newWallet);
      setWallet({
        address: newWallet.address,
        connectionType: 'manual',
        isConnected: true,
        feeTier: 'regular', // Will be updated after NFT check
        balance: { xrp: '0', tokens: [] },
        honeyPoints: 0,
      });

      // Save address (NOT the seed!) for session restoration
      localStorage.setItem('bear_wallet_address', newWallet.address);
      localStorage.setItem('bear_wallet_type', 'manual');

      // Fetch balances and fee tier
      setTimeout(() => {
        refreshBalance();
        refreshFeeTier();
      }, 100);

    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      setError(err.message || 'Invalid seed phrase');
    } finally {
      setIsConnecting(false);
    }
  }, [refreshBalance, refreshFeeTier]);

  // Connect with WalletConnect
  const connectWithWalletConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);

    try {
      // TODO: Implement WalletConnect v2 integration
      // For now, show coming soon message
      setError('WalletConnect integration coming soon!');
    } catch (err: any) {
      console.error('WalletConnect error:', err);
      setError(err.message || 'WalletConnect connection failed');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    setXrplWallet(null);
    setWallet(defaultWalletState);
    localStorage.removeItem('bear_wallet_address');
    localStorage.removeItem('bear_wallet_type');
  }, []);

  // Sign transaction
  const signTransaction = useCallback(async (tx: any) => {
    if (!xrplWallet) {
      throw new Error('No wallet connected');
    }

    // For manual wallets, sign directly
    if (wallet.connectionType === 'manual') {
      return xrplWallet.sign(tx);
    }

    // For WalletConnect, send signing request
    if (wallet.connectionType === 'walletconnect') {
      // TODO: Send signing request via WalletConnect
      throw new Error('WalletConnect signing not yet implemented');
    }

    throw new Error('Unknown wallet type');
  }, [xrplWallet, wallet.connectionType]);

  return (
    <WalletContext.Provider
      value={{
        wallet,
        xrplClient,
        isConnecting,
        error,
        connectWithSeed,
        connectWithWalletConnect,
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
