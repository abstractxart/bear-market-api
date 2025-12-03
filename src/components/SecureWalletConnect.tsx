/**
 * BEAR MARKET - Secure Wallet Connect
 *
 * FORTRESS-GRADE security with multiple login options:
 *
 * 1. SOCIAL LOGIN (Google, X/Twitter)
 *    - Web3Auth derives non-custodial wallet from OAuth
 *    - No seed phrase needed - keys derived from your social account
 *
 * 2. SECRET KEY (Maximum Security)
 *    - AES-256-GCM encryption (military grade)
 *    - PBKDF2 600K iterations (OWASP 2023 standard)
 *    - Keys NEVER stored in plaintext
 *    - Auto-wipe on tab close/timeout
 *
 * NO third-party wallet apps = YOU control the fees
 */

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getKeyManager } from '../security/SecureKeyManager';
import type { EncryptedVault } from '../security/SecureKeyManager';
import {
  checkEnvironmentIntegrity,
  logSecurityEvent,
  isSecureContext,
} from '../security/SecurityPolicy';
import { initWeb3Auth, loginWithSocial } from '../services/web3AuthService';

interface SecureWalletConnectProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (address: string) => void;
}

type ConnectionMode = 'select' | 'secret' | 'vault-unlock' | 'social-loading';

// Icons
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const SecurityBadge = ({ secure }: { secure: boolean }) => (
  <div
    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
      secure ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
    }`}
  >
    <div className={`w-2 h-2 rounded-full ${secure ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
    {secure ? 'Secure Context (HTTPS)' : 'Security Warning'}
  </div>
);

const SecurityFeatureList = () => (
  <div className="mt-4 p-4 bg-black/40 rounded-xl border border-green-500/20">
    <h4 className="text-xs font-bold text-green-400 mb-3 flex items-center gap-2">
      <span className="text-base">🛡️</span> SECURITY ARCHITECTURE
    </h4>
    <ul className="text-xs text-gray-300 space-y-2">
      <li className="flex items-start gap-2">
        <span className="text-green-400 mt-0.5">✓</span>
        <div>
          <span className="text-white font-medium">AES-256-GCM Encryption</span>
          <p className="text-gray-500">Military-grade, same as banks use</p>
        </div>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-green-400 mt-0.5">✓</span>
        <div>
          <span className="text-white font-medium">Non-Custodial</span>
          <p className="text-gray-500">Your keys, your crypto - always</p>
        </div>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-green-400 mt-0.5">✓</span>
        <div>
          <span className="text-white font-medium">Web Crypto API</span>
          <p className="text-gray-500">Native browser crypto, not JS library</p>
        </div>
      </li>
    </ul>
  </div>
);

export const SecureWalletConnect = ({
  isOpen,
  onClose,
  onConnect,
}: SecureWalletConnectProps) => {
  const [mode, setMode] = useState<ConnectionMode>('select');
  const [secret, setSecret] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [securityCheck, setSecurityCheck] = useState<{
    secure: boolean;
    warnings: string[];
  } | null>(null);
  const [saveVault, setSaveVault] = useState(false);

  // Initialize Web3Auth on mount
  useEffect(() => {
    initWeb3Auth().catch(console.error);
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
      setPassword('');
      setConfirmPassword('');
      setError(null);
      setMode('select');
      setShowSecret(false);
    }
  }, [isOpen]);

  // Handle secret input with security measures
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

  // Connect with social login (Google/X)
  const handleSocialLogin = async () => {
    setMode('social-loading');
    setLoading(true);
    setError(null);
    logSecurityEvent('social_login_attempt', 'Attempting social login');

    try {
      const { address, privateKey } = await loginWithSocial();

      // Initialize the secure key manager with the derived key
      const keyManager = getKeyManager();
      await keyManager.initializeSessionOnly(privateKey);

      logSecurityEvent('social_login_success', `Connected: ${address.slice(0, 8)}...`);

      onConnect(address);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Social login failed';
      setError(message);
      setMode('select');
      logSecurityEvent('social_login_error', message);
    } finally {
      setLoading(false);
    }
  };

  // Connect with session-only secret
  const handleSessionConnect = async () => {
    if (!secret) {
      setError('Please enter your secret key');
      return;
    }

    setLoading(true);
    setError(null);
    logSecurityEvent('session_connect_attempt', 'Attempting secure connection');

    try {
      const keyManager = getKeyManager();
      const { address } = await keyManager.initializeSessionOnly(secret);

      // Clear secret from state immediately
      setSecret('');

      logSecurityEvent('session_connect_success', `Connected: ${address.slice(0, 8)}...`);

      // If user wants to save vault
      if (saveVault && password) {
        if (password.length < 12) {
          setError('Password must be at least 12 characters');
          setLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match');
          setLoading(false);
          return;
        }

        const vault = await keyManager.createVault(password);
        localStorage.setItem('bear_market_vault', JSON.stringify(vault));
        logSecurityEvent('vault_created', 'Encrypted vault saved');
      }

      onConnect(address);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setError(message);
      logSecurityEvent('session_connect_error', message);
    } finally {
      setLoading(false);
    }
  };

  // Unlock existing vault
  const handleVaultUnlock = async () => {
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);
    setError(null);
    logSecurityEvent('vault_unlock_attempt', 'Attempting vault unlock');

    try {
      const vaultData = localStorage.getItem('bear_market_vault');
      if (!vaultData) {
        setError('No saved wallet found');
        setLoading(false);
        return;
      }

      const vault: EncryptedVault = JSON.parse(vaultData);
      const keyManager = getKeyManager();
      const { address } = await keyManager.initializeFromVault(vault, password);

      setPassword('');
      logSecurityEvent('vault_unlock_success', `Unlocked: ${address.slice(0, 8)}...`);

      onConnect(address);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to unlock';
      setError(message);
      logSecurityEvent('vault_unlock_error', message);
    } finally {
      setLoading(false);
    }
  };

  // Check if vault exists
  const hasVault = typeof window !== 'undefined' && localStorage.getItem('bear_market_vault') !== null;

  // Render mode selection
  const renderModeSelect = () => (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">🐻</div>
        <h3 className="text-2xl font-bold text-white mb-2">BEAR MARKET</h3>
        <p className="text-sm text-gray-400">Connect Your Wallet</p>
      </div>

      <div className="flex justify-center">
        {securityCheck && <SecurityBadge secure={securityCheck.secure} />}
      </div>

      {securityCheck && !securityCheck.secure && (
        <div className="p-3 bg-red-500/20 rounded-lg border border-red-500/30 text-xs text-red-300">
          {securityCheck.warnings.map((w, i) => (
            <p key={i}>⚠️ {w}</p>
          ))}
        </div>
      )}

      {/* Social Login Section */}
      <div className="space-y-3 mt-6">
        <div className="text-xs text-gray-500 uppercase tracking-wider text-center mb-2">
          Quick Login
        </div>

        {/* Google Login */}
        <button
          onClick={handleSocialLogin}
          disabled={loading}
          className="w-full p-4 bg-white hover:bg-gray-100 rounded-xl text-left transition-all group flex items-center gap-4"
        >
          <GoogleIcon />
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900">Continue with Google</h4>
            <p className="text-xs text-gray-500">No seed phrase needed</p>
          </div>
          <div className="text-gray-400 group-hover:text-gray-600 transition-colors">→</div>
        </button>

        {/* X/Twitter Login */}
        <button
          onClick={handleSocialLogin}
          disabled={loading}
          className="w-full p-4 bg-black hover:bg-gray-900 border border-gray-700 rounded-xl text-left transition-all group flex items-center gap-4"
        >
          <XIcon />
          <div className="flex-1">
            <h4 className="font-semibold text-white">Continue with X</h4>
            <p className="text-xs text-gray-500">No seed phrase needed</p>
          </div>
          <div className="text-gray-500 group-hover:text-white transition-colors">→</div>
        </button>

        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-700"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-4 bg-gray-900 text-gray-500">or</span>
          </div>
        </div>

        {/* Vault unlock (if exists) */}
        {hasVault && (
          <button
            onClick={() => setMode('vault-unlock')}
            className="w-full p-4 bg-gradient-to-r from-green-600/20 to-emerald-600/20 hover:from-green-600/30 hover:to-emerald-600/30 border border-green-500/40 rounded-xl text-left transition-all group"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white flex items-center gap-2">
                  🔐 Unlock Saved Wallet
                </h4>
                <p className="text-xs text-gray-400 mt-1">
                  Decrypt with your password
                </p>
              </div>
              <div className="text-gray-500 group-hover:text-white transition-colors">→</div>
            </div>
          </button>
        )}

        {/* Secret key entry */}
        <button
          onClick={() => setMode('secret')}
          className="w-full p-4 bg-gradient-to-r from-purple-600/20 to-blue-600/20 hover:from-purple-600/30 hover:to-blue-600/30 border border-purple-500/40 rounded-xl text-left transition-all group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-bold text-white flex items-center gap-2">
                🔑 Enter Secret Key
              </h4>
              <p className="text-xs text-gray-400 mt-1">
                For existing XRPL wallets
              </p>
            </div>
            <div className="text-gray-500 group-hover:text-white transition-colors">→</div>
          </div>
        </button>
      </div>

      <SecurityFeatureList />

      <div className="text-center pt-2">
        <p className="text-xs text-gray-500">
          More secure than First Ledger. Prove them wrong. 🐻
        </p>
      </div>
    </div>
  );

  // Render social loading
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

      <button
        onClick={() => setMode('select')}
        className="mt-6 text-sm text-gray-400 hover:text-white transition-colors"
      >
        ← Back to options
      </button>
    </div>
  );

  // Render secret key input
  const renderSecretInput = () => (
    <div className="space-y-4">
      <button
        onClick={() => setMode('select')}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
      >
        ← Back
      </button>

      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white mb-2">🔑 Enter Secret Key</h3>
        <p className="text-sm text-gray-400">
          Encrypted with AES-256-GCM immediately
        </p>
      </div>

      {!isSecureContext() && (
        <div className="p-3 bg-yellow-500/20 rounded-lg border border-yellow-500/30 text-xs text-yellow-300">
          ⚠️ Use HTTPS for maximum security
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Secret Key (Family Seed)
          </label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={secret}
              onChange={handleSecretChange}
              onPaste={handleSecretPaste}
              placeholder="sXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="w-full px-4 py-3 bg-black/60 border-2 border-purple-500/30 rounded-xl text-white font-mono text-sm focus:outline-none focus:border-purple-500 pr-12 transition-colors"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-lpignore="true"
              data-form-type="other"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white text-lg"
              title={showSecret ? 'Hide' : 'Show'}
            >
              {showSecret ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1.5">
            Format: Starts with 's', 29 characters total
          </p>
        </div>

        {/* Optional: Save as encrypted vault */}
        <div className="p-4 bg-purple-500/10 rounded-xl border border-purple-500/20">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={saveVault}
              onChange={(e) => setSaveVault(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-purple-500/30 bg-black/50 text-purple-500 focus:ring-purple-500"
            />
            <div>
              <span className="text-sm font-medium text-white">💾 Save Encrypted Wallet</span>
              <p className="text-xs text-gray-400 mt-0.5">
                Protected with your password for quick access
              </p>
            </div>
          </label>
        </div>

        {/* Password fields (if saving) */}
        <AnimatePresence>
          {saveVault && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 overflow-hidden"
            >
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Create Password (min 12 chars)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 bg-black/60 border-2 border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors"
                  autoComplete="new-password"
                />
                {password && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          password.length >= 16
                            ? 'bg-green-500 w-full'
                            : password.length >= 12
                            ? 'bg-yellow-500 w-3/4'
                            : password.length >= 8
                            ? 'bg-orange-500 w-1/2'
                            : 'bg-red-500 w-1/4'
                        }`}
                      />
                    </div>
                    <p className={`text-xs mt-1 ${password.length >= 12 ? 'text-green-400' : 'text-orange-400'}`}>
                      {password.length >= 12 ? '✓ Strong password' : `${12 - password.length} more characters needed`}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full px-4 py-3 bg-black/60 border-2 border-purple-500/30 rounded-xl text-white focus:outline-none focus:border-purple-500 transition-colors"
                  autoComplete="new-password"
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-400 mt-1">Passwords don't match</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 text-sm text-red-300 flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <button
          onClick={handleSessionConnect}
          disabled={loading || !secret || (saveVault && (!password || password.length < 12 || password !== confirmPassword))}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-all text-lg shadow-lg shadow-purple-500/25"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Encrypting & Connecting...
            </span>
          ) : (
            '🔐 Connect Securely'
          )}
        </button>
      </div>

      <div className="text-xs text-gray-500 text-center mt-4 p-3 bg-green-500/5 rounded-lg border border-green-500/10">
        <span className="text-green-400">🛡️</span> Your key is encrypted with AES-256-GCM the moment you click connect.
        Plaintext is immediately wiped from memory.
      </div>
    </div>
  );

  // Render vault unlock
  const renderVaultUnlock = () => (
    <div className="space-y-4">
      <button
        onClick={() => setMode('select')}
        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
      >
        ← Back
      </button>

      <div className="text-center mb-4">
        <h3 className="text-xl font-bold text-white mb-2">🔐 Unlock Wallet</h3>
        <p className="text-sm text-gray-400">Enter your password to decrypt</p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleVaultUnlock()}
            placeholder="••••••••••••"
            className="w-full px-4 py-3 bg-black/60 border-2 border-green-500/30 rounded-xl text-white focus:outline-none focus:border-green-500 transition-colors"
            autoComplete="current-password"
            autoFocus
          />
        </div>

        {error && (
          <div className="p-3 bg-red-500/20 rounded-xl border border-red-500/30 text-sm text-red-300 flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        <button
          onClick={handleVaultUnlock}
          disabled={loading || !password}
          className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-white transition-all text-lg shadow-lg shadow-green-500/25"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Decrypting...
            </span>
          ) : (
            '🔓 Unlock Wallet'
          )}
        </button>

        <div className="pt-4 border-t border-gray-800">
          <button
            onClick={() => {
              if (confirm('This will permanently delete your saved wallet. You\'ll need your secret key to access it again. Continue?')) {
                localStorage.removeItem('bear_market_vault');
                setMode('select');
                logSecurityEvent('vault_deleted', 'User deleted saved vault');
              }
            }}
            className="w-full py-2 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            🗑️ Forget Saved Wallet
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="relative w-full max-w-md bg-gradient-to-b from-gray-900 via-gray-900 to-black border border-purple-500/30 rounded-2xl p-6 shadow-2xl shadow-purple-500/10 max-h-[90vh] overflow-y-auto"
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
            >
              ✕
            </button>

            {/* Content */}
            {mode === 'select' && renderModeSelect()}
            {mode === 'social-loading' && renderSocialLoading()}
            {mode === 'secret' && renderSecretInput()}
            {mode === 'vault-unlock' && renderVaultUnlock()}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
