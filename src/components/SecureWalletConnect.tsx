/**
 * BEAR SWAP - Secure Wallet Connect
 *
 * Self-Custodial Wallet Implementation
 *
 * Security Architecture:
 * - AES-256-GCM encryption for seed storage
 * - PBKDF2-SHA256 with 600,000 iterations (OWASP 2023 recommended)
 * - 256-bit cryptographically random salt
 * - Client-side only - keys never transmitted to any server
 * - Secure memory handling with automatic wiping
 *
 * This implementation follows the same security model as industry-standard
 * wallets including MetaMask and First Ledger.
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wallet } from 'xrpl';
import * as bip39 from 'bip39';
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
  | 'save-wallet';     // Create password to save wallet


const SecurityBadge = ({ secure }: { secure: boolean }) => (
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${secure ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
    <div className={`w-2 h-2 rounded-full ${secure ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
    {secure ? 'Secure Context (HTTPS)' : 'Security Warning'}
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
  const [newWallet, setNewWallet] = useState<{ address: string; seed: string; mnemonic: string } | null>(null);
  const [seedAcknowledged, setSeedAcknowledged] = useState(false);
  const [seedCopied, setSeedCopied] = useState(false);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Import method states
  type ImportMethod = 'family-seed' | 'mnemonic' | 'private-key' | 'xaman-numbers';
  const [importMethod, setImportMethod] = useState<ImportMethod>('family-seed');
  const [algorithm, setAlgorithm] = useState<'secp256k1' | 'ed25519'>('secp256k1');
  const [mnemonicWordCount, setMnemonicWordCount] = useState<12 | 16 | 24>(12);
  const [mnemonicWords, setMnemonicWords] = useState<string[]>(Array(12).fill(''));
  const [xamanNumbers, setXamanNumbers] = useState<string[]>(Array(8).fill(''));

  // Update mnemonic words array when word count changes
  useEffect(() => {
    setMnemonicWords(Array(mnemonicWordCount).fill(''));
  }, [mnemonicWordCount]);

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
      setMnemonicWords(Array(12).fill(''));
      setXamanNumbers(Array(8).fill(''));
      setUnlockPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      setPendingSecret(null);
      setPendingAddress(null);
      setShowDeleteConfirmation(false);
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

  // Delete saved wallet - show custom confirmation dialog
  const handleDeleteSavedWallet = () => {
    setShowDeleteConfirmation(true);
  };

  // Confirm deletion of saved wallet
  const confirmDeleteWallet = () => {
    deleteVaultFromStorage();
    setSavedAddress(null);
    setMode('select');
    setShowDeleteConfirmation(false);
    logSecurityEvent('wallet_deleted', 'User deleted saved wallet');
  };

  // Generate new wallet with mnemonic phrase
  const handleCreateWallet = async () => {
    setLoading(true);
    setError(null);
    logSecurityEvent('wallet_create_start', 'Generating new wallet with mnemonic');

    try {
      // Generate a 12-word mnemonic phrase
      const mnemonic = bip39.generateMnemonic(128); // 128 bits = 12 words

      // Create wallet from mnemonic
      const wallet = Wallet.fromMnemonic(mnemonic);

      setNewWallet({
        address: wallet.classicAddress,
        seed: wallet.seed!, // Keep seed for encryption/storage
        mnemonic: mnemonic, // Store mnemonic for display
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

  // Copy mnemonic to clipboard
  const handleCopyMnemonic = async () => {
    if (!newWallet) return;
    try {
      await navigator.clipboard.writeText(newWallet.mnemonic);
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
    if (!newWallet) {
      setError('Wallet data lost. Please start over.');
      setShowSaveConfirmation(false);
      setMode('select');
      return;
    }

    // Close confirmation modal
    setShowSaveConfirmation(false);

    // Clear any existing errors
    setError(null);

    // Use the MNEMONIC as the secret (not the seed) since that's what we're showing the user
    // The mnemonic can be used to recreate the wallet just like a family seed can
    setPendingSecret(newWallet.mnemonic);
    setPendingAddress(newWallet.address);

    setMode('save-wallet');
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
          // Join the array of words with spaces and validate
          const words = mnemonicWords.map(w => w.trim().toLowerCase()).filter(w => w).join(' ');
          if (!words) {
            throw new Error('Please enter your mnemonic phrase');
          }

          // Validate word count
          const wordArray = words.split(' ');
          if (![12, 16, 24].includes(wordArray.length)) {
            throw new Error(`Invalid mnemonic length. Expected 12, 16, or 24 words, got ${wordArray.length}`);
          }

          // Let Wallet.fromMnemonic handle validation directly (same as XAMAN)
          // XRPL uses its own validation, not standard BIP39
          // This allows XRPL-compatible mnemonics that may not be in the standard BIP39 word list

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const opts: any = {};
          if (algorithm === 'ed25519') {
            opts.algorithm = 'ed25519';
          } else {
            opts.algorithm = 'ecdsa-secp256k1';
          }
          // Validate by creating wallet - will throw if invalid
          Wallet.fromMnemonic(words, opts);
          // Return the mnemonic itself as the secret (same as generated wallets)
          // The mnemonic can recreate the wallet just like a family seed can
          return words;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Invalid mnemonic phrase';
          throw new Error(message);
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
      setMnemonicWords(Array(mnemonicWordCount).fill(''));
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

      // ALWAYS initialize with the secret (even if a key exists from previous session)
      // This ensures we're saving the correct wallet, not a stale one
      // KeyManager now handles mnemonics directly
      await keyManager.initializeSessionOnly(pendingSecret);

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
    if (!pendingAddress || !pendingSecret) {
      return;
    }

    setLoading(true);
    setError(null); // Clear any existing errors
    try {
      // Initialize keyManager with the secret (required for Header.handleConnect)
      // KeyManager now handles mnemonics directly
      const keyManager = getKeyManager();
      await keyManager.initializeSessionOnly(pendingSecret);

      logSecurityEvent('skip_save', 'User skipped saving wallet');
      onConnect(pendingAddress);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  // ==================== RENDER FUNCTIONS ====================

  // Main selection screen
  const renderModeSelect = () => (
    <div className="relative space-y-6">
      {/* Floating animated orbs background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-bear-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-bearpark-gold/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-bear-green-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>

      {/* BEAR SWAP Logo Header with Epic Glow */}
      <div className="relative text-center mb-2">
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', duration: 0.8 }}
          className="relative w-24 h-24 mx-auto mb-5"
        >
          {/* Outer glow ring */}
          <div className="absolute inset-[-8px] rounded-3xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow opacity-60 blur-md"></div>
          {/* Animated tri-gradient ring */}
          <div className="absolute inset-0 rounded-2xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></div>
          {/* Dark container with logo */}
          <div className="absolute inset-[3px] rounded-[14px] bg-gradient-to-br from-bear-dark-800 to-bear-dark-900 flex items-center justify-center overflow-hidden shadow-2xl">
            <img
              src="https://file.garden/aTNJV_mJHkBEIhEB/BEARSWAPLOGO3.png"
              alt="BEAR SWAP"
              className="w-full h-full object-cover"
            />
          </div>
        </motion.div>
        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-4xl font-bold text-gradient-bear mb-2 font-luckiest tracking-wide drop-shadow-lg"
        >
          BEAR SWAP
        </motion.h3>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm text-bearpark-gold font-semibold"
        >
          We thrive in the Bear Market
        </motion.p>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex justify-center"
      >
        {securityCheck && <SecurityBadge secure={securityCheck.secure} />}
      </motion.div>

      {/* Saved Wallet - Glowing emerald card */}
      {savedAddress && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="relative group"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-bear-green-500/40 to-emerald-500/40 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <motion.button
            onClick={() => setMode('unlock')}
            className="relative w-full p-5 rounded-2xl text-left overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              boxShadow: '0 8px 0 #047857, 0 12px 40px rgba(16, 185, 129, 0.5)',
            }}
            whileHover={{
              boxShadow: '0 6px 0 #047857, 0 10px 30px rgba(16, 185, 129, 0.5)',
              y: 2,
            }}
            whileTap={{
              boxShadow: '0 2px 0 #047857, 0 4px 15px rgba(16, 185, 129, 0.5)',
              y: 6,
            }}
          >
            {/* Animated shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-white text-xl font-luckiest">Unlock Saved Wallet</h4>
                <p className="text-sm text-green-100 font-mono bg-black/20 rounded px-2 py-0.5 inline-block mt-1">{savedAddress.slice(0, 8)}...{savedAddress.slice(-4)}</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </motion.button>
          <div className="text-center mt-3">
            <button
              onClick={handleDeleteSavedWallet}
              className="text-xs text-gray-500 hover:text-red-400 transition-colors"
            >
              Remove saved wallet
            </button>
          </div>
        </motion.div>
      )}

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {showDeleteConfirmation && (
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
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 30 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="relative w-full max-w-sm rounded-3xl overflow-hidden"
            >
              {/* Gradient border */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-gradient-x"></div>
              <div className="relative m-[2px] rounded-[22px] bg-gradient-to-b from-bear-dark-800 to-bear-dark-900 p-6">
                {/* Warning Icon */}
                <div className="flex justify-center mb-4">
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', duration: 0.6, delay: 0.1 }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-red-500/20 to-orange-500/20 flex items-center justify-center border-2 border-red-500/30"
                  >
                    <svg className="w-10 h-10 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </motion.div>
                </div>

                {/* Title */}
                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-xl font-bold text-white text-center mb-2"
                >
                  Remove Saved Wallet?
                </motion.h3>

                {/* Description */}
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-gray-400 text-center text-sm mb-6"
                >
                  This will remove the encrypted wallet from your browser. You will need to re-import it using your seed phrase or family seed.
                </motion.p>

                {/* Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="flex gap-3"
                >
                  <button
                    onClick={() => setShowDeleteConfirmation(false)}
                    className="flex-1 py-3 px-4 rounded-xl bg-bear-dark-700 hover:bg-bear-dark-600 text-white font-semibold transition-all"
                  >
                    Cancel
                  </button>
                  <motion.button
                    onClick={confirmDeleteWallet}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-semibold transition-all shadow-lg shadow-red-500/25"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    Remove Wallet
                  </motion.button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {/* CREATE NEW WALLET - Epic Purple Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.7 }}
          className="relative group"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-bear-purple-500/40 to-purple-500/40 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <motion.button
            onClick={handleCreateWallet}
            disabled={loading}
            className="relative w-full p-5 rounded-2xl text-left overflow-hidden disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
              boxShadow: '0 8px 0 #5B21B6, 0 12px 40px rgba(139, 92, 246, 0.5)',
            }}
            whileHover={{
              boxShadow: '0 6px 0 #5B21B6, 0 10px 30px rgba(139, 92, 246, 0.5)',
              y: 2,
            }}
            whileTap={{
              boxShadow: '0 2px 0 #5B21B6, 0 4px 15px rgba(139, 92, 246, 0.5)',
              y: 6,
            }}
          >
            {/* Animated shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            {/* Sparkle particles */}
            <div className="absolute top-2 right-4 w-2 h-2 bg-white rounded-full animate-ping opacity-75"></div>
            <div className="absolute bottom-3 right-8 w-1.5 h-1.5 bg-purple-200 rounded-full animate-ping opacity-75" style={{ animationDelay: '0.5s' }}></div>
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-white text-xl font-luckiest">Create New Wallet</h4>
                <p className="text-sm text-purple-200">New to XRP? Start here!</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </motion.button>
        </motion.div>

        {/* Fancy Divider */}
        <motion.div
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 0.8 }}
          className="relative py-4"
        >
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-px bg-gradient-to-r from-transparent via-bear-dark-500 to-transparent"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-6 py-1 bg-bear-dark-900 text-xs text-gray-500 uppercase tracking-widest font-bold rounded-full border border-bear-dark-700">
              Already have a wallet?
            </span>
          </div>
        </motion.div>

        {/* Import Secret Key - Epic Gold Card */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 }}
          className="relative group"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-bearpark-gold/40 to-amber-500/40 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <motion.button
            onClick={() => setMode('secret')}
            className="relative w-full p-5 rounded-2xl text-left overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #FDB723 0%, #F59E0B 100%)',
              boxShadow: '0 8px 0 #B45309, 0 12px 40px rgba(253, 183, 35, 0.5)',
            }}
            whileHover={{
              boxShadow: '0 6px 0 #B45309, 0 10px 30px rgba(253, 183, 35, 0.5)',
              y: 2,
            }}
            whileTap={{
              boxShadow: '0 2px 0 #B45309, 0 4px 15px rgba(253, 183, 35, 0.5)',
              y: 6,
            }}
          >
            {/* Animated shine effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-black/20 backdrop-blur-sm flex items-center justify-center border border-black/20">
                <svg className="w-8 h-8 text-bear-dark-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-bold text-bear-dark-900 text-xl font-luckiest">Import Wallet</h4>
                <p className="text-sm text-bear-dark-700">Family seed, mnemonic, or XAMAN</p>
              </div>
              <div className="w-10 h-10 rounded-full bg-black/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-bear-dark-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          </motion.button>
        </motion.div>
      </div>

      {/* Footer with glow */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="text-center pt-2"
      >
        <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r from-bear-dark-800/80 to-bear-dark-700/80 backdrop-blur-sm border border-bear-dark-600 shadow-lg">
          <div className="relative">
            <div className="absolute inset-0 bg-bear-green-500 rounded-full blur-sm animate-pulse"></div>
            <div className="relative w-2.5 h-2.5 rounded-full bg-bear-green-400"></div>
          </div>
          <p className="text-xs text-gray-300 font-medium">
            Non-custodial • Your keys, your crypto
          </p>
        </div>
      </motion.div>
    </div>
  );

  // Unlock saved wallet screen
  const renderUnlockWallet = () => (
    <div className="space-y-5">
      <button onClick={() => setMode('select')} className="flex items-center gap-2 text-gray-400 hover:text-bearpark-gold transition-colors text-sm font-medium">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="text-center mb-4">
        {/* Logo with green ring */}
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-bear-green-500 to-emerald-500 animate-pulse"></div>
          <div className="absolute inset-[2px] rounded-[14px] bg-bear-dark-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-bear-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
        <h3 className="text-2xl font-bold text-white font-luckiest">Unlock Wallet</h3>
        <p className="text-sm text-bear-green-400 font-mono mt-2 px-3 py-1.5 bg-bear-green-500/10 rounded-lg inline-block border border-bear-green-500/20">
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
              className="w-full px-4 py-3.5 bg-bear-dark-800 border-2 border-bear-dark-600 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-bear-green-500 pr-12 transition-colors"
              autoComplete="current-password"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {showPassword ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 text-sm text-red-300 mt-4 flex items-center gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {/* GLASS UNLOCK BUTTON WITH SICK SPINNING TRI-GRADIENT BORDER */}
        <motion.button
          type="submit"
          disabled={loading || !unlockPassword}
          className="relative w-full mt-5 py-4 rounded-full font-bold text-lg text-white overflow-hidden group transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          whileHover={!loading && unlockPassword ? { scale: 1.02 } : {}}
          whileTap={!loading && unlockPassword ? { scale: 0.98 } : {}}
        >
          {/* Spinning tri-gradient border - PRIMO AS FUCK */}
          <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></span>
          {/* Glass inner - backdrop blur with semi-transparent bg */}
          <span className="absolute inset-[2px] rounded-full bg-bear-dark-800/80 backdrop-blur-xl group-hover:bg-bear-dark-700/80 transition-colors"></span>
          {/* Content */}
          <span className="relative z-10 flex items-center justify-center gap-2">
            {loading ? (
              <>
                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Unlocking...
              </>
            ) : 'Unlock Wallet'}
          </span>
        </motion.button>
      </form>

      <p className="text-xs text-gray-500 text-center pt-2">
        Forgot password? <button onClick={() => setMode('secret')} className="text-bearpark-gold hover:text-yellow-400 font-medium transition-colors">Re-import your wallet</button>
      </p>
    </div>
  );

  // Save wallet with password screen - EPIC VERSION
  const renderSaveWallet = () => (
    <div className="relative space-y-5">
      {/* Floating animated orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-bear-purple-500/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-bear-green-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>

      {/* Header with Epic Lock Icon */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative text-center mb-2"
      >
        <div className="relative w-24 h-24 mx-auto mb-5">
          {/* Outer glow */}
          <div className="absolute inset-[-8px] rounded-3xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow opacity-60 blur-md"></div>
          {/* Animated gradient ring */}
          <div className="absolute inset-0 rounded-2xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></div>
          <div className="absolute inset-[3px] rounded-[14px] bg-gradient-to-b from-bear-dark-800 to-bear-dark-900 flex items-center justify-center shadow-2xl">
            <svg className="w-12 h-12 text-bear-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>
        <h3 className="text-3xl font-bold text-white font-luckiest drop-shadow-lg">Secure Your Wallet</h3>
        <p className="text-sm text-gray-400 mt-2">Create a password to stay logged in</p>
        {pendingAddress && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-4"
          >
            <span className="text-sm text-bear-green-400 font-mono px-4 py-2 bg-bear-green-500/10 rounded-xl inline-block border-2 border-bear-green-500/30 shadow-lg shadow-bear-green-500/10">
              {pendingAddress.slice(0, 10)}...{pendingAddress.slice(-6)}
            </span>
          </motion.div>
        )}
      </motion.div>

      {/* Security Info Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="p-4 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl border-2 border-blue-500/30 shadow-lg"
      >
        <div className="flex items-start gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0 border border-blue-500/30">
            <span className="text-xl">🔐</span>
          </div>
          <p className="text-sm text-blue-200">
            Password encrypts your wallet <span className="text-white font-bold">locally</span>. Never leaves your device.
          </p>
        </div>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0 border border-orange-500/30">
            <span className="text-xl">⚠️</span>
          </div>
          <p className="text-sm text-orange-200">
            <span className="font-luckiest text-bearpark-gold">BEAR SWAP</span> can't recover lost passwords. Use your <strong className="text-white">12 words</strong> to restore.
          </p>
        </div>
      </motion.div>

      <form onSubmit={(e) => { e.preventDefault(); handleSaveWallet(); }}>
        <div className="space-y-4">
          {/* Password Input - Fancy Style */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wide">
              Create password (12+ characters)
            </label>
            <div className="relative group">
              <div className={`absolute inset-0 rounded-xl blur-md transition-opacity duration-300 ${newPassword.length >= 12 ? 'bg-bear-green-500/30 opacity-100' : 'opacity-0'}`}></div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••••••"
                className={`relative w-full px-5 py-4 bg-black/40 border-2 rounded-xl text-white font-mono text-base focus:outline-none pr-14 transition-all ${
                  newPassword.length >= 12
                    ? 'border-bear-green-500/50 focus:border-bear-green-400'
                    : 'border-bear-dark-600 focus:border-bear-purple-500'
                }`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors p-1"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {showPassword ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  )}
                </svg>
              </button>
            </div>
            {/* Password strength indicator */}
            {newPassword.length > 0 && (
              <div className="flex items-center gap-3 mt-3">
                <div className="flex-1 h-2 bg-bear-dark-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((newPassword.length / 12) * 100, 100)}%` }}
                    className={`h-full rounded-full transition-all ${
                      newPassword.length >= 12 ? 'bg-gradient-to-r from-bear-green-500 to-emerald-400' :
                      newPassword.length >= 8 ? 'bg-gradient-to-r from-yellow-500 to-orange-400' :
                      'bg-gradient-to-r from-red-500 to-orange-500'
                    }`}
                  ></motion.div>
                </div>
                <span className={`text-sm font-bold ${newPassword.length >= 12 ? 'text-bear-green-400' : 'text-yellow-400'}`}>
                  {newPassword.length}/12
                </span>
              </div>
            )}
          </motion.div>

          {/* Confirm Password */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <label className="block text-sm font-bold text-gray-300 mb-2 uppercase tracking-wide">
              Confirm password
            </label>
            <div className="relative group">
              <div className={`absolute inset-0 rounded-xl blur-md transition-opacity duration-300 ${confirmPassword.length > 0 && newPassword === confirmPassword ? 'bg-bear-green-500/30 opacity-100' : 'opacity-0'}`}></div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                placeholder="••••••••••••"
                className={`relative w-full px-5 py-4 bg-black/40 border-2 rounded-xl text-white font-mono text-base focus:outline-none transition-all ${
                  confirmPassword.length > 0 && newPassword === confirmPassword
                    ? 'border-bear-green-500/50 focus:border-bear-green-400'
                    : confirmPassword.length > 0 && newPassword !== confirmPassword
                      ? 'border-red-500/50 focus:border-red-400'
                      : 'border-bear-dark-600 focus:border-bear-purple-500'
                }`}
                autoComplete="new-password"
              />
            </div>
            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-400 mt-2 flex items-center gap-2 font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Passwords don't match
              </motion.p>
            )}
            {confirmPassword.length > 0 && newPassword === confirmPassword && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-bear-green-400 mt-2 flex items-center gap-2 font-bold"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
                Passwords match!
              </motion.p>
            )}
          </motion.div>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gradient-to-r from-red-500/20 to-red-600/20 rounded-xl border-2 border-red-500/40 text-sm text-red-300 mt-4 flex items-center gap-3 shadow-lg"
          >
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            {error}
          </motion.div>
        )}

        {/* GLASS SAVE BUTTON WITH SICK SPINNING TRI-GRADIENT BORDER */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative group mt-5"
        >
          <motion.button
            type="submit"
            disabled={loading || newPassword.length < 12 || newPassword !== confirmPassword}
            className="relative w-full py-5 rounded-full font-black text-xl text-white overflow-hidden group transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={!(loading || newPassword.length < 12 || newPassword !== confirmPassword) ? { scale: 1.02 } : {}}
            whileTap={!(loading || newPassword.length < 12 || newPassword !== confirmPassword) ? { scale: 0.98 } : {}}
          >
            {/* Spinning tri-gradient border - PRIMO AS FUCK */}
            <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></span>
            {/* Glass inner - backdrop blur with semi-transparent bg */}
            <span className="absolute inset-[2px] rounded-full bg-bear-dark-800/80 backdrop-blur-xl group-hover:bg-bear-dark-700/80 transition-colors"></span>
            {/* Content */}
            <span className="relative z-10 flex items-center justify-center gap-3">
              {loading ? (
                <>
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Encrypting...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Save & Continue
                </>
              )}
            </span>
          </motion.button>
        </motion.div>
      </form>

      {/* Fancy Divider */}
      <motion.div
        initial={{ opacity: 0, scaleX: 0 }}
        animate={{ opacity: 1, scaleX: 1 }}
        transition={{ delay: 0.5 }}
        className="relative py-4"
      >
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-px bg-gradient-to-r from-transparent via-bear-dark-500 to-transparent"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="px-6 py-1 bg-bear-dark-900 text-xs text-gray-500 uppercase tracking-widest font-bold rounded-full border border-bear-dark-700">
            Or
          </span>
        </div>
      </motion.div>

      {/* Skip Button Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="p-5 bg-gradient-to-br from-red-500/10 to-orange-500/10 rounded-2xl border-2 border-red-500/30 shadow-lg"
      >
        <div className="flex items-start gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0 border border-red-500/30">
            <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-base text-red-300 font-bold mb-1">Skip Password (Not Recommended)</p>
            <p className="text-sm text-gray-400">
              Enter your <span className="text-red-400 font-bold">12 words</span> every time you connect.
            </p>
          </div>
        </div>

        <motion.button
          onClick={handleSkipSave}
          type="button"
          className="w-full py-4 rounded-xl font-bold text-lg text-white relative overflow-hidden group"
          style={{
            background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
            boxShadow: '0 6px 0 #991B1B, 0 10px 25px rgba(239, 68, 68, 0.4)',
          }}
          whileHover={{
            boxShadow: '0 4px 0 #991B1B, 0 8px 20px rgba(239, 68, 68, 0.4)',
            y: 2,
          }}
          whileTap={{
            boxShadow: '0 2px 0 #991B1B, 0 4px 10px rgba(239, 68, 68, 0.4)',
            y: 4,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
          <span className="relative">Skip - I'll Enter My 12 Words Each Time</span>
        </motion.button>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="text-xs text-gray-500 text-center pt-2"
      >
        Your password encrypts your wallet locally. <span className="font-luckiest text-bearpark-gold">BEAR SWAP</span> cannot recover it.
      </motion.p>
    </div>
  );

  // INSTANT WALLET screen - Epic modernized with mnemonic display
  const renderInstantWallet = () => {
    const mnemonicWords = newWallet?.mnemonic.split(' ') || [];

    return (
      <div className="relative space-y-5">
        {/* Floating celebration particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-bear-green-500/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-bear-purple-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
          <div className="absolute top-1/4 right-0 w-2 h-2 bg-bearpark-gold rounded-full animate-ping"></div>
          <div className="absolute top-1/3 left-4 w-1.5 h-1.5 bg-bear-green-400 rounded-full animate-ping" style={{ animationDelay: '0.3s' }}></div>
          <div className="absolute bottom-1/4 right-8 w-1 h-1 bg-bear-purple-400 rounded-full animate-ping" style={{ animationDelay: '0.6s' }}></div>
        </div>

        {/* Confirmation Modal - Epic Version */}
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
                className="absolute inset-0 bg-black/90 backdrop-blur-md"
                onClick={() => setShowSaveConfirmation(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 30 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 30 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="relative w-full max-w-sm rounded-3xl overflow-hidden"
              >
                {/* Animated gradient border */}
                <div className="absolute inset-0 rounded-3xl bg-[conic-gradient(from_0deg,#f97316,#ef4444,#f97316)] animate-spin-slow"></div>
                {/* Outer glow */}
                <div className="absolute inset-[-4px] rounded-3xl bg-gradient-to-br from-orange-500/50 to-red-500/50 blur-xl"></div>
                <div className="relative m-[3px] rounded-[21px] bg-gradient-to-b from-bear-dark-900 via-bear-dark-900 to-black p-7">
                  <div className="text-center">
                    {/* Warning icon with glow */}
                    <div className="relative w-20 h-20 mx-auto mb-5">
                      <div className="absolute inset-[-6px] rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 opacity-50 blur-lg animate-pulse"></div>
                      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500"></div>
                      <div className="absolute inset-[3px] rounded-[13px] bg-gradient-to-b from-bear-dark-800 to-bear-dark-900 flex items-center justify-center">
                        <svg className="w-10 h-10 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-3 font-luckiest">Are You Sure?</h3>
                    <p className="text-sm text-gray-300 mb-6">
                      Did you <span className="text-orange-400 font-bold">really save your recovery phrase</span>?
                      <br />
                      <span className="text-gray-500 text-xs mt-3 block">
                        Without it, you will lose access to your funds forever. There is NO recovery option.
                      </span>
                    </p>

                    <div className="space-y-3">
                      <motion.button
                        onClick={handleConfirmedProceed}
                        className="w-full py-4 rounded-xl font-bold text-white text-lg"
                        style={{
                          background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
                          boxShadow: '0 6px 0 #047857, 0 10px 30px rgba(16, 185, 129, 0.5)',
                        }}
                        whileHover={{
                          boxShadow: '0 4px 0 #047857, 0 8px 25px rgba(16, 185, 129, 0.5)',
                          y: 2,
                        }}
                        whileTap={{
                          boxShadow: '0 2px 0 #047857, 0 4px 15px rgba(16, 185, 129, 0.5)',
                          y: 4,
                        }}
                      >
                        Yes, I Saved My Phrase
                      </motion.button>
                      <button
                        onClick={() => setShowSaveConfirmation(false)}
                        className="w-full py-3.5 bg-bear-dark-700 hover:bg-bear-dark-600 border-2 border-bear-dark-500 rounded-xl font-bold text-gray-300 transition-all hover:text-white"
                      >
                        Go Back & Save It
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header with Epic Success Animation */}
        <div className="relative text-center">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', duration: 0.8 }}
            className="relative w-24 h-24 mx-auto mb-5"
          >
            {/* Outer celebration glow */}
            <div className="absolute inset-[-10px] rounded-3xl bg-gradient-to-br from-bear-green-500/50 to-emerald-500/50 blur-xl animate-pulse"></div>
            {/* Animated gradient ring */}
            <div className="absolute inset-0 rounded-2xl bg-[conic-gradient(from_0deg,#10B981,#34D399,#10B981)] animate-spin-slow"></div>
            <div className="absolute inset-[3px] rounded-[14px] bg-gradient-to-b from-bear-dark-800 to-bear-dark-900 flex items-center justify-center overflow-hidden shadow-2xl">
              <img
                src="https://file.garden/aTNJV_mJHkBEIhEB/BEARSWAPLOGO3.png"
                alt="BEAR SWAP"
                className="w-full h-full object-cover"
              />
            </div>
            {/* Success checkmark badge */}
            <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-bear-green-500 rounded-full flex items-center justify-center border-4 border-bear-dark-900 shadow-lg">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </motion.div>
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-gradient-bear font-luckiest drop-shadow-lg"
          >
            Wallet Created!
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-sm text-gray-400 mt-2"
          >
            Save your recovery phrase, then secure with a password
          </motion.p>
        </div>

        {/* Wallet Address - Glowing Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative group"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-bear-green-500/30 to-emerald-500/30 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative p-5 bg-gradient-to-b from-bear-dark-800 to-bear-dark-900 rounded-2xl border-2 border-bear-green-500/40 shadow-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="absolute inset-0 bg-bear-green-500 rounded-full blur-sm animate-pulse"></div>
                <div className="relative w-3 h-3 rounded-full bg-bear-green-400"></div>
              </div>
              <span className="text-xs text-bear-green-400 font-bold uppercase tracking-widest">Your Wallet Address</span>
            </div>
            <div className="font-mono text-sm text-white break-all bg-black/40 p-4 rounded-xl border border-bear-dark-600">{newWallet?.address}</div>
          </div>
        </motion.div>

        {/* XRPL Activation Info - Important! */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="relative"
        >
          <div className="p-4 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-2xl border border-blue-500/30">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0 border border-blue-500/30">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold text-blue-400 mb-1">XRPL Activation Required</h4>
                <p className="text-xs text-gray-300 leading-relaxed">
                  This wallet needs <span className="text-white font-bold">1 XRP</span> to activate on the XRP Ledger.
                  Each trustline (token you want to hold) requires an additional <span className="text-white font-bold">0.2 XRP</span> reserve.
                </p>
                <p className="text-[10px] text-gray-500 mt-2 italic">
                  This is a standard XRPL network requirement for ALL wallets, not a BEAR fee.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Mnemonic Phrase Display - Epic Security Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="relative"
        >
          {/* Glow effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl blur-xl"></div>
          <div className="relative p-5 bg-gradient-to-b from-bear-dark-800 to-bear-dark-900 rounded-2xl border-2 border-orange-500/50 shadow-xl">
            {/* Header with copy button */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
                  <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <span className="text-sm text-orange-400 font-bold uppercase tracking-widest">Recovery Phrase</span>
              </div>
              <motion.button
                onClick={handleCopyMnemonic}
                className="px-4 py-2 rounded-xl font-bold text-sm text-white"
                style={{
                  background: seedCopied ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
                  boxShadow: seedCopied ? '0 4px 0 #047857' : '0 4px 0 #5B21B6',
                }}
                whileHover={{ y: 1 }}
                whileTap={{ y: 3 }}
              >
                {seedCopied ? '✓ Copied!' : 'Copy All'}
              </motion.button>
            </div>

            {/* Mnemonic Words Grid - Fancy Pills */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {mnemonicWords.map((word, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + index * 0.05 }}
                  className="flex items-center gap-2 bg-black/40 rounded-xl px-3 py-2.5 border border-bear-dark-600 hover:border-orange-500/50 transition-colors group"
                >
                  <span className="text-xs text-orange-400/70 font-mono font-bold w-5">{index + 1}.</span>
                  <span className="text-sm text-white font-semibold group-hover:text-orange-200 transition-colors">{word}</span>
                </motion.div>
              ))}
            </div>

            {/* Warning box */}
            <div className="flex items-start gap-3 p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-xl border border-orange-500/30">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-xs text-orange-200 leading-relaxed">
                <strong className="text-orange-400">Write these 12 words down</strong> in order and store them safely. This is the <span className="text-white font-bold">ONLY</span> way to recover your wallet!
              </p>
            </div>
          </div>
        </motion.div>

        {/* Enhanced Glowing Checkbox Area */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className={`relative p-5 rounded-2xl transition-all duration-500 ${
            seedAcknowledged
              ? 'bg-gradient-to-br from-bear-green-500/10 to-emerald-500/10 border-2 border-bear-green-500/50 shadow-lg shadow-bear-green-500/20'
              : 'bg-gradient-to-br from-orange-500/10 to-red-500/10 border-2 border-orange-500/50 shadow-lg shadow-orange-500/20'
          }`}
        >
          {/* READ CAREFULLY Banner */}
          {!seedAcknowledged && (
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-black uppercase tracking-widest rounded-full shadow-lg animate-bounce">
              READ CAREFULLY
            </div>
          )}

          <label className="flex items-start gap-4 cursor-pointer mt-1">
            <div className={`relative w-7 h-7 flex-shrink-0 rounded-lg border-2 transition-all duration-300 ${
              seedAcknowledged
                ? 'border-bear-green-500 bg-bear-green-500 shadow-lg shadow-bear-green-500/50'
                : 'border-orange-500 bg-bear-dark-800'
            }`}>
              {seedAcknowledged && (
                <svg className="w-full h-full text-white p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              )}
              <input
                type="checkbox"
                checked={seedAcknowledged}
                onChange={(e) => {
                  setSeedAcknowledged(e.target.checked);
                  setError(null);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
            <span className="text-sm text-gray-200 leading-relaxed">
              I understand this is a <span className="text-white font-bold">self-custody wallet</span>.
              If I lose my recovery phrase, I will <span className="text-red-400 font-bold">permanently lose access</span> to my funds.
              <span className="text-bearpark-gold font-semibold"> <span className="font-luckiest">BEAR SWAP</span> cannot recover lost phrases.</span>
            </span>
          </label>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 bg-gradient-to-r from-red-500/20 to-red-600/20 rounded-xl border-2 border-red-500/40 text-sm text-red-300 flex items-center gap-3 shadow-lg shadow-red-500/10"
          >
            <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            {error}
          </motion.div>
        )}

        {/* GLASS INSTANT WALLET BUTTON WITH SICK SPINNING TRI-GRADIENT BORDER */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="relative group"
        >
          <motion.button
            onClick={handleInstantConnect}
            disabled={loading || !seedAcknowledged}
            className="relative w-full py-5 rounded-full font-black text-xl text-white overflow-hidden group transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={!loading && seedAcknowledged ? { scale: 1.02 } : {}}
            whileTap={!loading && seedAcknowledged ? { scale: 0.98 } : {}}
          >
            {/* Spinning tri-gradient border - PRIMO AS FUCK */}
            <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></span>
            {/* Glass inner - backdrop blur with semi-transparent bg */}
            <span className="absolute inset-[2px] rounded-full bg-bear-dark-800/80 backdrop-blur-xl group-hover:bg-bear-dark-700/80 transition-colors"></span>
            {/* Content */}
            <span className="relative z-10 flex items-center justify-center gap-3">
              {loading ? (
                <>
                  <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Setting up...
                </>
              ) : (
                <>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  I've Saved My Phrase
                </>
              )}
            </span>
          </motion.button>
        </motion.div>

        <button
          onClick={() => {
            setNewWallet(null);
            setMode('select');
          }}
          className="w-full text-center text-sm text-gray-500 hover:text-bearpark-gold transition-colors py-2 font-medium"
        >
          Start over
        </button>
      </div>
    );
  };

  // Secret key input screen
  const renderSecretInput = () => {
    const canSubmit = () => {
      switch (importMethod) {
        case 'family-seed':
        case 'private-key':
          return secret.trim().length > 0;
        case 'mnemonic':
          return mnemonicWords.filter(w => w.trim().length > 0).length === mnemonicWordCount;
        case 'xaman-numbers':
          return xamanNumbers.filter(n => /^\d{6}$/.test(n.trim())).length === 8;
        default:
          return false;
      }
    };

    return (
      <div className="space-y-5">
        <button onClick={() => setMode('select')} className="flex items-center gap-2 text-gray-400 hover:text-bearpark-gold transition-colors text-sm font-medium">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="text-center mb-4">
          {/* Logo with gold ring */}
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-bearpark-gold to-yellow-600 animate-pulse"></div>
            <div className="absolute inset-[2px] rounded-[14px] bg-bear-dark-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-bearpark-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
          </div>
          <h3 className="text-2xl font-bold text-white font-luckiest">Import Wallet</h3>
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
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    data-gramm="false"
                    data-gramm_editor="false"
                    data-enable-grammarly="false"
                    data-lpignore="true"
                    data-form-type="other"
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
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-gray-300">
                    Enter your mnemonic phrase
                  </label>
                  {/* Word count toggle */}
                  <div className="flex gap-2">
                    {([12, 16, 24] as const).map((count) => (
                      <button
                        key={count}
                        onClick={() => setMnemonicWordCount(count)}
                        className={`px-3 py-1 rounded-lg text-sm font-bold transition-all ${
                          mnemonicWordCount === count
                            ? 'bg-purple-500 text-white'
                            : 'bg-bear-dark-600 text-gray-400 hover:bg-bear-dark-500'
                        }`}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Individual word inputs in grid */}
                <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto pr-2">
                  {mnemonicWords.map((word, index) => {
                    const isComplete = word.trim().length > 0;
                    const currentIndex = mnemonicWords.findIndex(w => !w.trim());
                    const isActive = currentIndex === -1 ? index === mnemonicWords.length - 1 : index === currentIndex;

                    return (
                      <div key={index} className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-600">
                          {index + 1}.
                        </div>
                        <input
                          type="text"
                          value={word}
                          onChange={(e) => {
                            const value = e.target.value.toLowerCase().replace(/[^a-z]/g, '');
                            const newWords = [...mnemonicWords];
                            newWords[index] = value;
                            setMnemonicWords(newWords);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              // Move to next input
                              const nextIndex = index + 1;
                              if (nextIndex < mnemonicWords.length) {
                                const nextInput = document.querySelector(`input[data-word-index="${nextIndex}"]`) as HTMLInputElement;
                                nextInput?.focus();
                              }
                            } else if (e.key === 'Backspace' && !word && index > 0) {
                              e.preventDefault();
                              // Move to previous input
                              const prevInput = document.querySelector(`input[data-word-index="${index - 1}"]`) as HTMLInputElement;
                              prevInput?.focus();
                            }
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const pastedText = e.clipboardData.getData('text');
                            const words = pastedText.toLowerCase().trim().split(/\s+/).filter(w => w);

                            if (words.length > 0) {
                              const newWords = [...mnemonicWords];
                              words.forEach((w, i) => {
                                if (index + i < mnemonicWords.length) {
                                  newWords[index + i] = w;
                                }
                              });
                              setMnemonicWords(newWords);
                            }
                          }}
                          placeholder={`word ${index + 1}`}
                          autoFocus={index === 0}
                          data-word-index={index}
                          className={`w-full pl-10 pr-3 py-2.5 rounded-lg font-mono text-sm transition-all ${
                            isComplete
                              ? 'bg-green-500/10 border-2 border-green-500/30 text-green-400'
                              : isActive
                                ? 'bg-purple-500/10 border-2 border-purple-500 text-white'
                                : 'bg-black/40 border-2 border-gray-700 text-gray-400'
                          } focus:outline-none focus:border-purple-500`}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-gramm="false"
                          data-gramm_editor="false"
                          data-enable-grammarly="false"
                          data-lpignore="true"
                          data-form-type="other"
                        />
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Enter each word separately or paste all {mnemonicWordCount} words at once
                </p>
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
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck={false}
                              data-gramm="false"
                              data-gramm_editor="false"
                              data-enable-grammarly="false"
                              data-lpignore="true"
                              data-form-type="other"
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
            <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 text-sm text-red-300 flex items-center gap-2 mt-4">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}

          {/* GLASS BUTTON WITH SICK SPINNING TRI-GRADIENT BORDER */}
          <motion.button
            type="submit"
            disabled={loading || !canSubmit()}
            className="relative w-full mt-5 py-4 rounded-full font-bold text-lg text-white overflow-hidden group transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            whileHover={!(loading || !canSubmit()) ? { scale: 1.02 } : {}}
            whileTap={!(loading || !canSubmit()) ? { scale: 0.98 } : {}}
          >
            {/* Spinning tri-gradient border - PRIMO AS FUCK */}
            <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></span>
            {/* Glass inner - backdrop blur with semi-transparent bg */}
            <span className="absolute inset-[2px] rounded-full bg-bear-dark-800/80 backdrop-blur-xl group-hover:bg-bear-dark-700/80 transition-colors"></span>
            {/* Content */}
            <span className="relative z-10 flex items-center justify-center gap-2">
              {loading ? (
                <>
                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Validating...
                </>
              ) : 'Continue'}
            </span>
          </motion.button>
        </form>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop - NO click to close for security */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/90 backdrop-blur-md" />

          {/* Modal with tri-gradient border */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-md rounded-2xl max-h-[90vh] overflow-hidden"
          >
            {/* Animated tri-gradient border */}
            <div className="absolute inset-0 rounded-2xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow opacity-80"></div>

            {/* Inner content container */}
            <div className="relative m-[2px] rounded-[14px] bg-gradient-to-b from-bear-dark-900 via-bear-dark-900 to-black p-6 overflow-y-auto max-h-[calc(90vh-4px)]">
              {/* Close button with tri-gradient ring on hover */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-lg transition-all group"
              >
                <span className="absolute inset-0 rounded-lg bg-bear-dark-700 group-hover:bg-bear-dark-600 transition-colors"></span>
                <span className="relative z-10">✕</span>
              </button>

              {mode === 'select' && renderModeSelect()}
              {mode === 'unlock' && renderUnlockWallet()}
              {mode === 'instant-wallet' && renderInstantWallet()}
              {mode === 'secret' && renderSecretInput()}
              {mode === 'save-wallet' && renderSaveWallet()}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
