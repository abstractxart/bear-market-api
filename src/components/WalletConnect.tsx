import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../context/WalletContext';

interface WalletConnectProps {
  isOpen: boolean;
  onClose: () => void;
}

type ConnectionMethod = 'seed' | 'walletconnect' | null;

const WalletConnect: React.FC<WalletConnectProps> = ({ isOpen, onClose }) => {
  const { connectWithSeed, connectWithWalletConnect, isConnecting, error } = useWallet();

  const [method, setMethod] = useState<ConnectionMethod>(null);
  const [seed, setSeed] = useState('');
  const [seedError, setSeedError] = useState<string | null>(null);
  const [showSeed, setShowSeed] = useState(false);

  const handleSeedConnect = async () => {
    if (!seed.trim()) {
      setSeedError('Please enter your seed phrase');
      return;
    }

    // Basic validation
    if (!seed.startsWith('s') || seed.length < 29) {
      setSeedError('Invalid seed format. Seeds start with "s" and are at least 29 characters.');
      return;
    }

    setSeedError(null);
    await connectWithSeed(seed.trim());

    if (!error) {
      setSeed('');
      onClose();
    }
  };

  const handleWalletConnectClick = async () => {
    await connectWithWalletConnect();
  };

  const handleBack = () => {
    setMethod(null);
    setSeed('');
    setSeedError(null);
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass-card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {method && (
              <button
                onClick={handleBack}
                className="p-2 -ml-2 rounded-lg hover:bg-bear-dark-600 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h3 className="text-xl font-bold text-white font-display">
              {method === 'seed' ? 'Import Wallet' : 'Connect Wallet'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-bear-dark-600 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <AnimatePresence mode="wait">
          {!method ? (
            /* Connection method selection */
            <motion.div
              key="methods"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-3"
            >
              {/* WalletConnect option */}
              <button
                onClick={handleWalletConnectClick}
                className="w-full flex items-center gap-4 p-4 bg-bear-dark-700 hover:bg-bear-dark-600 rounded-xl transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4.91 7.52c3.47-3.4 9.1-3.4 12.56 0l.42.41a.43.43 0 010 .62l-1.43 1.4a.22.22 0 01-.31 0l-.57-.56a6.37 6.37 0 00-8.77 0l-.61.6a.22.22 0 01-.31 0L4.45 8.6a.43.43 0 010-.62l.46-.46zm15.53 2.89l1.27 1.25a.43.43 0 010 .62l-5.75 5.64a.45.45 0 01-.63 0l-4.08-4a.11.11 0 00-.16 0l-4.08 4a.45.45 0 01-.63 0l-5.75-5.64a.43.43 0 010-.62l1.27-1.25a.45.45 0 01.63 0l4.08 4a.11.11 0 00.16 0l4.08-4a.45.45 0 01.63 0l4.08 4a.11.11 0 00.16 0l4.08-4a.45.45 0 01.63 0z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white group-hover:text-bear-purple-400 transition-colors">
                    WalletConnect
                  </div>
                  <div className="text-sm text-gray-400">
                    Connect with Xaman, XUMM, or other wallets
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-500 group-hover:text-bear-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Manual seed import */}
              <button
                onClick={() => setMethod('seed')}
                className="w-full flex items-center gap-4 p-4 bg-bear-dark-700 hover:bg-bear-dark-600 rounded-xl transition-colors group"
              >
                <div className="w-12 h-12 rounded-xl bg-bear-purple-500/20 flex items-center justify-center">
                  <svg className="w-6 h-6 text-bear-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                </div>
                <div className="flex-1 text-left">
                  <div className="font-semibold text-white group-hover:text-bear-purple-400 transition-colors">
                    Import with Seed
                  </div>
                  <div className="text-sm text-gray-400">
                    Enter your secret seed phrase
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-500 group-hover:text-bear-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Info text */}
              <p className="text-center text-sm text-gray-500 mt-4">
                Your keys, your crypto. We never store your seed phrase.
              </p>
            </motion.div>
          ) : method === 'seed' ? (
            /* Seed import form */
            <motion.div
              key="seed"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm text-gray-400 mb-2">
                  Secret Seed (Family Seed)
                </label>
                <div className="relative">
                  <input
                    type={showSeed ? 'text' : 'password'}
                    value={seed}
                    onChange={(e) => setSeed(e.target.value)}
                    placeholder="sXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                    className="input-field pr-12 font-mono"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowSeed(!showSeed)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-bear-dark-600"
                  >
                    {showSeed ? (
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {(seedError || error) && (
                  <p className="text-red-400 text-sm mt-2">{seedError || error}</p>
                )}
              </div>

              {/* Warning */}
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <div className="text-sm text-yellow-200">
                    <p className="font-semibold mb-1">Security Warning</p>
                    <p className="text-yellow-300/80">
                      Only import your seed on devices you trust. Never share your seed with anyone.
                      Your seed is stored encrypted locally and never leaves your device.
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit button */}
              <button
                onClick={handleSeedConnect}
                disabled={isConnecting || !seed.trim()}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Connecting...
                  </span>
                ) : (
                  'Connect Wallet'
                )}
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default WalletConnect;
