/**
 * BEAR MARKET - Secure Wallet Connect
 *
 * Security Model (same as MetaMask, First Ledger):
 * - Password encrypts seed locally in browser using AES-256-GCM
 * - PBKDF2 with 600,000 iterations for key derivation
 * - Password NEVER leaves your device
 * - BEAR MARKET cannot see, recover, or reset your password
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet } from 'xrpl';
import {
  getKeyManager,
  hasSavedVault,
  getSavedAddress,
  saveVaultToStorage,
  loadVaultFromStorage,
  deleteVaultFromStorage,
} from '../security/SecureKeyManager';
import {
  checkEnvironmentIntegrity,
  logSecurityEvent,
  isSecureContext,
} from '../security/SecurityPolicy';
import { loginWithSocial } from '../services/web3AuthService';

interface SecureWalletConnectProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (address: string) => void;
}

type ConnectionMode =
  | 'select'
  | 'unlock'           // Unlock saved wallet with password
  | 'instant-wallet'   // Single-screen wallet creation
  | 'secret'           // Import with secret key
  | 'save-wallet'      // Create password to save wallet
  | 'social-loading';

// Icons
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const SecurityBadge = ({ secure }: { secure: boolean }) => (
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${secure ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
    <div className={`w-2 h-2 rounded-full ${secure ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
    {secure ? 'Secure Context (HTTPS)' : 'Security Warning'}
  </div>
);

// Security warning component - shown when saving wallet
const SecurityDisclosure = () => (
  <div className="p-3 bg-blue-500/10 rounded-xl border border-blue-500/20 text-xs text-blue-200 space-y-2">
    <div className="flex items-start gap-2">
      <span className="text-blue-400 mt-0.5">🔐</span>
      <p>
        <strong className="text-blue-300">How this works:</strong> Your password encrypts your wallet
        locally in your browser using AES-256-GCM encryption. It never leaves your device.
      </p>
    </div>
    <div className="flex items-start gap-2">
      <span className="text-blue-400 mt-0.5">⚠️</span>
      <p>
        <strong className="text-blue-300">Important:</strong> BEAR MARKET cannot see, recover, or reset
        your password. If you forget it, you'll need to re-import your wallet using your seed phrase.
      </p>
    </div>
  </div>
);

export const SecureWalletConnect = ({
  isOpen,
  onClose,
  onConnect,
}: SecureWalletConnectProps) => {
  const [mode, setMode] = useState<ConnectionMode>('select');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [securityCheck, setSecurityCheck] = useState<{ secure: boolean; warnings: string[] } | null>(null);

  // Vault states
  const [savedAddress, setSavedAddress] = useState<string | null>(null);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pendingSecret, setPendingSecret] = useState<string | null>(null);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);

  // Instant wallet creation states
  const [newWallet, setNewWallet] = useState<{ address: string; seed: string } | null>(null);
  const [seedAcknowledged, setSeedAcknowledged] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  // Import method states
  type ImportMethod = 'family-seed' | 'mnemonic' | 'private-key' | 'xaman-numbers';
  const [importMethod, setImportMethod] = useState<ImportMethod>('family-seed');
  const [algorithm, setAlgorithm] = useState<'secp256k1' | 'ed25519'>('secp256k1');
  const [mnemonicWords, setMnemonicWords] = useState('');
  const [xamanNumbers, setXamanNumbers] = useState<string[]>(Array(8).fill(''));

  // Web3Auth initialization disabled until VITE_WEB3AUTH_CLIENT_ID is configured
  // If you want to enable social login, set the client ID in .env.local
  // useEffect(() => {
  //   initWeb3Auth().catch(console.error);
  // }, []);

  // Check for saved vault on mount
  useEffect(() => {
    if (hasSavedVault()) {
      const addr = getSavedAddress();
      setSavedAddress(addr);
    }
  }, []);

  // Check security environment on mount
  useEffect(() => {
    const check = checkEnvironmentIntegrity();
    setSecurityCheck(check);
    if (!check.secure) {
      logSecurityEvent('security_warning', check.warnings.join(', '));
    }
  }, []);

  // Clear sensitive data on close
  useEffect(() => {
    if (!isOpen) {
      setSecret('');
      setError(null);
      setMode('select');
      setShowSecret(false);
      setNewWallet(null);
      setSeedAcknowledged(false);
      setSeedCopied(false);
      setShowSaveConfirmation(false);
      setImportMethod('family-seed');
      setAlgorithm('secp256k1');
      setMnemonicWords('');
      setXamanNumbers(Array(8).fill(''));
      setUnlockPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setPendingSecret(null);
      setPendingAddress(null);
    }
  }, [isOpen]);

  // Handle secret input
  const handleSecretChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSecret(e.target.value);
    setError(null);
  }, []);

  // Handle paste for secret
  const handleSecretPaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
    e.stopPropagation();
    const pastedText = e.clipboardData.getData('text').trim();
    setSecret(pastedText);
    setError(null);
    e.preventDefault();
    logSecurityEvent('secret_pasted', 'User pasted secret key');
  }, []);

  // Unlock saved wallet with password
  const handleUnlockWallet = async () => {
    if (!unlockPassword) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError(null);
    logSecurityEvent('unlock_attempt', 'Attempting to unlock saved wallet');

    try {
      const vault = loadVaultFromStorage();
      if (!vault) {
        throw new Error('No saved wallet found');
      }

      const keyManager = getKeyManager();
      const { address } = await keyManager.initializeFromVault(vault, unlockPassword);

      setUnlockPassword('');
      logSecurityEvent('unlock_success', `Unlocked: ${address.slice(0, 8)}...`);

      onConnect(address);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unlock wallet';
      if (message === 'Invalid password') {
        setError('Incorrect password. Please try again.');
      } else {
        setError(message);
      }
      logSecurityEvent('unlock_error', message);
    } finally {
      setLoading(false);
    }
  };

  // Delete saved wallet
  const handleDeleteSavedWallet = () => {
    if (confirm('Are you sure you want to remove the saved wallet? You will need to re-import it.')) {
      deleteVaultFromStorage();
      setSavedAddress(null);
      setMode('select');
      logSecurityEvent('wallet_deleted', 'User deleted saved wallet');
    }
  };

  // Generate new wallet
  const handleCreateWallet = async () => {
    setLoading(true);
    setError(null);
    logSecurityEvent('wallet_create_start', 'Generating new wallet');

    try {
      const wallet = Wallet.generate();
      setNewWallet({
        address: wallet.classicAddress,
        seed: wallet.seed!,
      });
      setMode('instant-wallet');
      logSecurityEvent('wallet_created', `New wallet: ${wallet.classicAddress.slice(0, 8)}...`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create wallet';
      setError(message);
      logSecurityEvent('wallet_create_error', message);
    } finally {
      setLoading(false);
    }
  };

  // Copy seed to clipboard
  const handleCopySeed = async () => {
    if (!newWallet) return;
    try {
      await navigator.clipboard.writeText(newWallet.seed);
      setSeedCopied(true);
      setTimeout(() => setSeedCopied(false), 3000);
    } catch {
      setError('Failed to copy. Please copy manually.');
    }
  };

  // Complete instant wallet - shows confirmation first
  const handleInstantConnect = async () => {
    if (!newWallet) return;

    if (!seedAcknowledged) {
      setError('Please confirm you saved your secret key');
      return;
    }

    // Show confirmation modal before proceeding
    setShowSaveConfirmation(true);
  };

  // Actually proceed after confirmation
  const handleConfirmedProceed = () => {
    if (!newWallet) return;

    setShowSaveConfirmation(false);

    // Go to save wallet step
    setPendingSecret(newWallet.seed);
    setPendingAddress(newWallet.address);
    setMode('save-wallet');
  };

  // Connect with social login
  const handleSocialLogin = async () => {
    setMode('social-loading');
    setLoading(true);
    setError(null);
    logSecurityEvent('social_login_attempt', 'Attempting social login');

    try {
      const { address, privateKey } = await loginWithSocial();
      // Go to save wallet step
      setPendingSecret(privateKey);
      setPendingAddress(address);
      setMode('save-wallet');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Social login failed';
      setError(message);
      setMode('select');
      logSecurityEvent('social_login_error', message);
    } finally {
      setLoading(false);
    }
  };

  // Get the secret key based on import method
  const getSecretFromImportMethod = async (): Promise<string> => {
    switch (importMethod) {
      case 'family-seed':
        return secret.trim();

      case 'private-key':
        return secret.trim();

      case 'mnemonic':
        try {
          const words = mnemonicWords.trim();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const opts: any = {};
          if (algorithm === 'ed25519') {
            opts.algorithm = 'ed25519';
          } else {
            opts.algorithm = 'ecdsa-secp256k1';
          }
          const wallet = Wallet.fromMnemonic(words, opts);
          return wallet.seed!;
        } catch {
          throw new Error('Invalid mnemonic phrase');
        }

      case 'xaman-numbers':
        const filledRows = xamanNumbers.filter(n => n.trim());
        if (filledRows.length !== 8) {
          throw new Error('Please enter all 8 rows of your Secret Numbers');
        }

        try {
          for (let i = 0; i < 8; i++) {
            const row = xamanNumbers[i].trim();
            if (!/^\d{6}$/.test(row)) {
              throw new Error(`Row ${String.fromCharCode(65 + i)} must be exactly 6 digits`);
            }
          }

          const entropyBytes = new Uint8Array(16);
          for (let i = 0; i < 8; i++) {
            const row = xamanNumbers[i].trim();
            const value = parseInt(row.slice(0, 5), 10);
            entropyBytes[i * 2] = Math.floor(value / 256);
            entropyBytes[i * 2 + 1] = value % 256;
          }

          const { encodeSeed } = await import('xrpl');
          const algoType = algorithm === 'ed25519' ? 'ed25519' : 'secp256k1';
          const familySeed = encodeSeed(entropyBytes, algoType);

          return familySeed;
        } catch (err) {
          if (err instanceof Error) throw err;
          throw new Error('Invalid Secret Numbers format');
        }

      default:
        throw new Error('Please select an import method');
    }
  };

  // Connect with secret key - goes to save wallet step
  const handleSessionConnect = async () => {
    setLoading(true);
    setError(null);
    logSecurityEvent('session_connect_attempt', `Attempting ${importMethod} import`);

    try {
      const secretKey = await getSecretFromImportMethod();

      if (!secretKey) {
        setError('Please enter your credentials');
        setLoading(false);
        return;
      }

      // Validate the secret by deriving the address
      const keyManager = getKeyManager();
      const { address } = await keyManager.initializeSessionOnly(secretKey);

      // Clear input fields
      setSecret('');
      setMnemonicWords('');
      setXamanNumbers(Array(8).fill(''));

      // Go to save wallet step
      setPendingSecret(secretKey);
      setPendingAddress(address);
      setMode('save-wallet');

      logSecurityEvent('session_connect_validated', `Validated: ${address.slice(0, 8)}...`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setError(message);
      logSecurityEvent('session_connect_error', message);
    } finally {
      setLoading(false);
    }
  };

  // Save wallet with password
  const handleSaveWallet = async () => {
    if (!pendingSecret || !pendingAddress) {
      setError('No wallet to save');
      return;
    }

    if (newPassword.length < 12) {
      setError('Password must be at least 12 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const keyManager = getKeyManager();

      // Initialize the key manager if not already done
      if (!keyManager.hasKey()) {
        await keyManager.initializeSessionOnly(pendingSecret);
      }

      // Create encrypted vault
      const vault = await keyManager.createVault(newPassword);

      // Save to localStorage
      saveVaultToStorage(vault, pendingAddress);
      setSavedAddress(pendingAddress);

      // Clear sensitive data
      setNewPassword('');
      setConfirmPassword('');
      setPendingSecret(null);

      logSecurityEvent('wallet_saved', `Saved wallet: ${pendingAddress.slice(0, 8)}...`);

      onConnect(pendingAddress);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save wallet';
      setError(message);
      logSecurityEvent('wallet_save_error', message);
    } finally {
      setLoading(false);
    }
  };

  // Skip saving and connect directly (session only)
  const handleSkipSave = async () => {
    if (!pendingAddress) return;

    logSecurityEvent('skip_save', 'User skipped saving wallet');
    onConnect(pendingAddress);
    onClose();
  };

  // ==================== RENDER FUNCTIONS ====================

  // Main selection screen
  const renderModeSelect = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">🐻</div>
        <h3 className="text-2xl font-bold text-white mb-2">BEAR MARKET</h3>
        <p className="text-sm text-gray-400">Get Started</p>
      </div>

      <div className="flex justify-center">
        {securityCheck && <SecurityBadge secure={securityCheck.secure} />}
      </div>

      {/* Saved Wallet - Show if exists */}
      {savedAddress && (
        <div className="mt-4">
          <button
            onClick={() => setMode('unlock')}
            className="w-full p-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 rounded-xl text-left transition-all group shadow-lg shadow-green-500/25"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl">
                🔓
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-white text-lg">Unlock Saved Wallet</h4>
                <p className="text-sm text-green-200 font-mono">{savedAddress.slice(0, 8)}...{savedAddress.slice(-4)}</p>
              </div>
              <div className="text-white/70 group-hover:text-white transition-colors text-xl">→</div>
            </div>
          </button>
          <div className="text-center mt-2">
            <button
              onClick={handleDeleteSavedWallet}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Remove saved wallet
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3 mt-6">
        {/* CREATE NEW WALLET */}
        <button
          onClick={handleCreateWallet}
          disabled={loading}
          className="w-full p-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 rounded-xl text-left transition-all group shadow-lg shadow-purple-500/25"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl">
              ✨
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-white text-lg">Create New Wallet</h4>
              <p className="text-sm text-purple-200">New to XRP? Start here!</p>
            </div>
            <div className="text-white/70 group-hover:text-white transition-colors text-xl">→</div>
          </div>
        </button>

        <div className="text-xs text-gray-500 uppercase tracking-wider text-center my-4">
          Already have a wallet?
        </div>

        {/* Social Login */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleSocialLogin}
            disabled={loading}
            className="p-3 bg-white hover:bg-gray-100 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <GoogleIcon />
            <span className="font-medium text-gray-900 text-sm">Google</span>
          </button>
          <button
            onClick={handleSocialLogin}
            disabled={loading}
            className="p-3 bg-black hover:bg-gray-900 border border-gray-700 rounded-xl transition-all flex items-center justify-center gap-2"
          >
            <XIcon />
            <span className="font-medium text-white text-sm">X</span>
          </button>
        </div>

        {/* Import Secret Key */}
        <button
          onClick={() => setMode('secret')}
          className="w-full p-3 bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-xl text-center transition-all text-sm text-gray-300 hover:text-white"
        >
          🔑 Import with Secret Key
        </button>
      </div>

      <div className="text-center pt-4">
        <p className="text-xs text-gray-600">
          Non-custodial • Your keys, your crypto 🐻
        </p>
      </div>
    </div>
  );

  // Unlock saved wallet screen
  const renderUnlockWallet = () => (
    <div className="space-y-4">
      <button onClick={() => setMode('select')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
        ← Back
      </button>

      <div className="text-center mb-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center text-3xl">
          🔐
        </div>
        <h3 className="text-xl font-bold text-white">Unlock Wallet</h3>
        <p className="text-sm text-gray-400 font-mono mt-1">
          {savedAddress?.slice(0, 10)}...{savedAddress?.slice(-6)}
        </p>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); handleUnlockWallet(); }}>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Enter your password
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={unlockPassword}
              onChange={(e) => {
                setUnlockPassword(e.target.value);
                setError(null);
              }}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 bg-black/60 border-2 border-gray-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-green-500 pr-12"
              autoComplete="current-password"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-lg"
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 text-sm text-red-300 mt-4">
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !unlockPassword}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-all mt-4"
        >
          {loading ? 'Unlocking...' : 'Unlock Wallet'}
        </button>
      </form>

      <p className="text-xs text-gray-500 text-center">
        Forgot password? <button onClick={() => setMode('secret')} className="text-purple-400 hover:text-purple-300">Re-import your wallet</button>
      </p>
    </div>
  );

  // Save wallet with password screen
  const renderSaveWallet = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center text-3xl">
          🔒
        </div>
        <h3 className="text-xl font-bold text-white">Secure Your Wallet</h3>
        <p className="text-sm text-gray-400 mt-1">Create a password to stay logged in</p>
        {pendingAddress && (
          <p className="text-xs text-green-400 font-mono mt-2">
            {pendingAddress.slice(0, 10)}...{pendingAddress.slice(-6)}
          </p>
        )}
      </div>

      <SecurityDisclosure />

      <form onSubmit={(e) => { e.preventDefault(); handleSaveWallet(); }}>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Create password (12+ characters)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••••••"
                className="w-full px-4 py-3 bg-black/60 border-2 border-gray-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500 pr-12"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-lg"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {newPassword.length > 0 && newPassword.length < 12 && (
              <p className="text-xs text-yellow-400 mt-1">Password too short ({newPassword.length}/12)</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Confirm password
            </label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                setError(null);
              }}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 bg-black/60 border-2 border-gray-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500"
              autoComplete="new-password"
            />
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
            )}
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 text-sm text-red-300 mt-4">
            ⚠️ {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || newPassword.length < 12 || newPassword !== confirmPassword}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-all mt-4"
        >
          {loading ? 'Saving...' : 'Save & Continue'}
        </button>
      </form>

      <button
        onClick={handleSkipSave}
        className="w-full text-center text-sm text-gray-500 hover:text-gray-300 transition-colors py-2"
      >
        Skip (won't remember me)
      </button>

      <p className="text-xs text-gray-600 text-center">
        Your password encrypts your wallet locally. We cannot recover it.
      </p>
    </div>
  );

  // INSTANT WALLET screen
  const renderInstantWallet = () => (
    <div className="space-y-4">
      {/* Confirmation Modal */}
      <AnimatePresence>
        {showSaveConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setShowSaveConfirmation(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-gradient-to-b from-gray-900 to-black border-2 border-orange-500/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl shadow-orange-500/20"
            >
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/20 flex items-center justify-center text-4xl animate-pulse">
                  ⚠️
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Are You Sure?</h3>
                <p className="text-sm text-gray-300 mb-6">
                  Did you <span className="text-orange-400 font-bold">really save your secret key</span>?
                  <br />
                  <span className="text-gray-400 text-xs mt-2 block">
                    Without it, you will lose access to your funds forever. There is NO recovery option.
                  </span>
                </p>

                <div className="space-y-3">
                  <button
                    onClick={handleConfirmedProceed}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 rounded-xl font-bold text-white transition-all"
                  >
                    Yes, I Saved My Key
                  </button>
                  <button
                    onClick={() => setShowSaveConfirmation(false)}
                    className="w-full py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-xl font-medium text-gray-300 transition-all"
                  >
                    ← Go Back & Save It
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-4xl shadow-lg shadow-green-500/30"
        >
          🎉
        </motion.div>
        <h3 className="text-2xl font-bold text-white">Wallet Created!</h3>
        <p className="text-sm text-gray-400 mt-1">Save your key below, then create a password</p>
      </div>

      <div className="p-3 bg-green-500/10 rounded-xl border border-green-500/20">
        <div className="text-xs text-green-400 mb-1">Your Wallet Address</div>
        <div className="font-mono text-sm text-white break-all">{newWallet?.address}</div>
      </div>

      <div className="p-4 bg-black/60 rounded-xl border-2 border-orange-500/40">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-orange-400 font-bold uppercase tracking-wide">Secret Key (BACKUP!)</span>
          <button
            onClick={handleCopySeed}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all ${seedCopied ? 'bg-green-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {seedCopied ? '✓ Copied!' : 'Copy'}
          </button>
        </div>
        <div className="font-mono text-base text-white break-all select-all bg-gray-900/60 p-3 rounded-lg border border-gray-700">
          {newWallet?.seed}
        </div>
        <p className="text-xs text-orange-300/80 mt-2">
          ⚠️ Write this down and store it safely. It's the ONLY way to recover your wallet!
        </p>
      </div>

      {/* Enhanced Glowing Checkbox Area */}
      <div className={`relative p-4 rounded-xl transition-all duration-300 ${
        seedAcknowledged
          ? 'bg-green-500/10 border-2 border-green-500/50'
          : 'bg-orange-500/10 border-2 border-orange-500/50 shadow-lg shadow-orange-500/20 animate-pulse-slow'
      }`}>
        {/* READ CAREFULLY Banner */}
        {!seedAcknowledged && (
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-orange-500 text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-lg">
            ⚠️ READ CAREFULLY ⚠️
          </div>
        )}

        <label className="flex items-start gap-3 cursor-pointer mt-2">
          <input
            type="checkbox"
            checked={seedAcknowledged}
            onChange={(e) => {
              setSeedAcknowledged(e.target.checked);
              setError(null);
            }}
            className={`mt-1 w-6 h-6 rounded border-2 bg-black/50 focus:ring-offset-0 flex-shrink-0 transition-all ${
              seedAcknowledged
                ? 'border-green-500 text-green-500 focus:ring-green-500'
                : 'border-orange-500 text-orange-500 focus:ring-orange-500'
            }`}
          />
          <span className="text-sm text-gray-200 leading-relaxed">
            I understand this is a <span className="text-white font-bold">self-custody wallet</span>.
            If I lose my secret key, I will <span className="text-red-400 font-bold">permanently lose access</span> to my funds.
            <span className="text-orange-400 font-semibold"> BEAR MARKET cannot recover lost keys.</span>
          </span>
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      <button
        onClick={handleInstantConnect}
        disabled={loading || !seedAcknowledged}
        className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-bold text-white text-lg transition-all shadow-lg shadow-green-500/30"
      >
        {loading ? 'Setting up...' : "I've Saved My Key →"}
      </button>

      <button
        onClick={() => {
          setNewWallet(null);
          setMode('select');
        }}
        className="w-full text-center text-sm text-gray-500 hover:text-gray-300 transition-colors"
      >
        ← Start over
      </button>
    </div>
  );

  // Social loading screen
  const renderSocialLoading = () => (
    <div className="py-12 text-center">
      <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-purple-500/20 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
      <h3 className="text-xl font-bold text-white mb-2">Connecting...</h3>
      <p className="text-sm text-gray-400">Complete the login in the popup window</p>

      {error && (
        <div className="mt-4 p-3 bg-red-500/20 rounded-xl border border-red-500/30 text-sm text-red-300">
          {error}
        </div>
      )}

      <button onClick={() => setMode('select')} className="mt-6 text-sm text-gray-400 hover:text-white transition-colors">
        ← Back to options
      </button>
    </div>
  );

  // Secret key input screen
  const renderSecretInput = () => {
    const canSubmit = () => {
      switch (importMethod) {
        case 'family-seed':
        case 'private-key':
          return secret.trim().length > 0;
        case 'mnemonic':
          return mnemonicWords.trim().split(/\s+/).length >= 12;
        case 'xaman-numbers':
          return xamanNumbers.filter(n => /^\d{6}$/.test(n.trim())).length === 8;
        default:
          return false;
      }
    };

    return (
      <div className="space-y-4">
        <button onClick={() => setMode('select')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm">
          ← Back
        </button>

        <div className="text-center mb-2">
          <h3 className="text-xl font-bold text-white mb-1">Import Wallet</h3>
          <p className="text-sm text-gray-400">Choose your import method</p>
        </div>

        {!isSecureContext() && (
          <div className="p-2 bg-yellow-500/20 rounded-lg border border-yellow-500/30 text-xs text-yellow-300">
            ⚠️ Use HTTPS for maximum security
          </div>
        )}

        {/* Import Method Selection */}
        <div className="space-y-2">
          {[
            { id: 'family-seed', label: 'Family Seed', desc: 'Starts with "s"' },
            { id: 'mnemonic', label: 'Mnemonic Phrase', desc: '12 or 24 words' },
            { id: 'xaman-numbers', label: 'Secret Numbers', desc: '8 rows × 6 digits (XAMAN)' },
            { id: 'private-key', label: 'Private Key', desc: 'Hex format' },
          ].map((method) => (
            <label
              key={method.id}
              className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                importMethod === method.id
                  ? 'bg-purple-500/20 border-2 border-purple-500'
                  : 'bg-black/30 border-2 border-transparent hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="importMethod"
                checked={importMethod === method.id}
                onChange={() => setImportMethod(method.id as ImportMethod)}
                className="w-4 h-4 text-purple-500 bg-black border-gray-600 focus:ring-purple-500"
              />
              <div>
                <span className="text-sm font-medium text-white">{method.label}</span>
                <span className="text-xs text-gray-500 ml-2">({method.desc})</span>
              </div>
            </label>
          ))}
        </div>

        {/* Import wallet form - wrapped to prevent console exposure */}
        <form onSubmit={(e) => { e.preventDefault(); handleSessionConnect(); }}>
          {/* Dynamic input based on selected method */}
          <div className="space-y-3">
            {/* Family Seed or Private Key input */}
            {(importMethod === 'family-seed' || importMethod === 'private-key') && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {importMethod === 'family-seed' ? 'Enter your family seed' : 'Enter your private key'}
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={secret}
                    onChange={handleSecretChange}
                    onPaste={handleSecretPaste}
                    placeholder={importMethod === 'family-seed' ? 'sXXXXXXXXXXXXXXXXXXXXXXXXXXXX' : '00112233...'}
                    className="w-full px-4 py-3 bg-black/60 border-2 border-gray-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500 pr-12"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-lg"
                  >
                    {showSecret ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
            )}

            {/* Mnemonic Phrase input */}
            {importMethod === 'mnemonic' && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Enter your mnemonic phrase words
                </label>
                <textarea
                  value={mnemonicWords}
                  onChange={(e) => setMnemonicWords(e.target.value)}
                  placeholder="word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
                  rows={3}
                  className="w-full px-4 py-3 bg-black/60 border-2 border-gray-700 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500 resize-none"
                  autoComplete="off"
                />
                <p className="text-xs text-gray-500 mt-1">Enter 12 or 24 words separated by spaces</p>
              </div>
            )}

            {/* XAMAN Secret Numbers input */}
            {importMethod === 'xaman-numbers' && (() => {
              const activeRow = xamanNumbers.findIndex(n => n.length < 6);
              const currentRow = activeRow === -1 ? 7 : activeRow;

              return (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Enter your Secret Numbers (8 rows of 6 digits)
                  </label>
                  <div className="space-y-2">
                    {xamanNumbers.map((num, i) => {
                      const isComplete = num.length === 6;
                      const isActive = i === currentRow;
                      const isLocked = i < currentRow && isComplete;
                      const isFuture = i > currentRow;

                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className={`text-sm font-bold w-6 text-right ${
                            isActive ? 'text-purple-400' : isComplete ? 'text-green-400' : 'text-gray-600'
                          }`}>
                            {String.fromCharCode(65 + i)}:
                          </span>
                          <div className="flex-1 relative">
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              maxLength={6}
                              value={isLocked ? '••••••' : num}
                              onChange={(e) => {
                                if (isLocked || isFuture) return;
                                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                                const newNums = [...xamanNumbers];
                                newNums[i] = value;
                                setXamanNumbers(newNums);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Backspace' && num.length === 0 && i > 0) {
                                  e.preventDefault();
                                  const newNums = [...xamanNumbers];
                                  newNums[i - 1] = newNums[i - 1].slice(0, -1);
                                  setXamanNumbers(newNums);
                                }
                              }}
                              placeholder={isActive ? '000000' : ''}
                              disabled={isLocked || isFuture}
                              autoFocus={isActive && i === 0}
                              className={`w-full px-4 py-2.5 rounded-xl font-mono text-lg tracking-widest text-center transition-all ${
                                isLocked
                                  ? 'bg-green-500/10 border-2 border-green-500/30 text-green-400 cursor-not-allowed'
                                  : isActive
                                    ? 'bg-black/60 border-2 border-purple-500 text-white focus:outline-none'
                                    : isFuture
                                      ? 'bg-gray-800/30 border-2 border-gray-700/50 text-gray-600 cursor-not-allowed'
                                      : 'bg-black/60 border-2 border-gray-700 text-white'
                              }`}
                              autoComplete="off"
                            />
                            {isLocked && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newNums = [...xamanNumbers];
                                  for (let j = i; j < 8; j++) {
                                    newNums[j] = '';
                                  }
                                  setXamanNumbers(newNums);
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-red-400 transition-colors"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                          {isComplete && (
                            <span className="text-green-400 text-sm">✓</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-gray-500">Found in XAMAN Settings → Security → Secret Numbers</p>
                    <p className="text-xs text-gray-400">
                      {xamanNumbers.filter(n => n.length === 6).length}/8 entered
                    </p>
                  </div>
                </div>
              );
            })()}

            {/* Algorithm selection for mnemonic and Secret Numbers */}
            {(importMethod === 'mnemonic' || importMethod === 'xaman-numbers') && (
              <div className="flex gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="algorithm"
                    checked={algorithm === 'secp256k1'}
                    onChange={() => setAlgorithm('secp256k1')}
                    className="w-3 h-3 text-blue-500 bg-black border-gray-600"
                  />
                  <span className="text-xs text-gray-300">ecdsa-secp256k1</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="algorithm"
                    checked={algorithm === 'ed25519'}
                    onChange={() => setAlgorithm('ed25519')}
                    className="w-3 h-3 text-blue-500 bg-black border-gray-600"
                  />
                  <span className="text-xs text-gray-300">ed25519</span>
                </label>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 text-sm text-red-300">⚠️ {error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !canSubmit()}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-all"
          >
            {loading ? 'Validating...' : 'Continue'}
          </button>
        </form>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-md bg-gradient-to-b from-gray-900 via-gray-900 to-black border border-purple-500/30 rounded-2xl p-6 shadow-2xl shadow-purple-500/10 max-h-[90vh] overflow-y-auto"
          >
            <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all">
              ✕
            </button>

            {mode === 'select' && renderModeSelect()}
            {mode === 'unlock' && renderUnlockWallet()}
            {mode === 'instant-wallet' && renderInstantWallet()}
            {mode === 'social-loading' && renderSocialLoading()}
            {mode === 'secret' && renderSecretInput()}
            {mode === 'save-wallet' && renderSaveWallet()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
