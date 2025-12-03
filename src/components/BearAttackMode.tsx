import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import type { BearAttackPreset } from '../types';
import { XRP_TOKEN } from '../types';
import { getSwapQuote, executeSwap } from '../services/swapService';

interface BearAttackModeProps {
  isEnabled: boolean;
  onToggle: () => void;
}

// Default Bear Attack presets
const DEFAULT_PRESETS: BearAttackPreset[] = [
  {
    id: '1',
    token: {
      currency: 'BEAR',
      issuer: 'rBEARTokenIssuerAddressHere',
      name: 'BEAR Token',
      symbol: 'BEAR',
      decimals: 15,
    },
    amount: '100',
    slippage: 1.0,
    enabled: true,
  },
  {
    id: '2',
    token: {
      currency: 'SOLO',
      issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz',
      name: 'Sologenic',
      symbol: 'SOLO',
      decimals: 15,
    },
    amount: '50',
    slippage: 1.0,
    enabled: false,
  },
];

const BearAttackMode: React.FC<BearAttackModeProps> = ({ isEnabled, onToggle }) => {
  const { wallet, xrplClient, signTransaction, refreshBalance } = useWallet();
  const [presets, setPresets] = useState<BearAttackPreset[]>(DEFAULT_PRESETS);
  const [isAttacking, setIsAttacking] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Execute instant swap for a preset
  const handleAttack = async (preset: BearAttackPreset) => {
    if (!xrplClient || !wallet.address || isAttacking) return;

    setIsAttacking(preset.id);

    try {
      // Get fresh quote
      const quote = await getSwapQuote(xrplClient, {
        inputToken: XRP_TOKEN,
        outputToken: preset.token,
        inputAmount: preset.amount,
        slippage: preset.slippage,
        feeTier: wallet.feeTier,
      });

      // Execute swap immediately
      const result = await executeSwap(
        xrplClient,
        quote,
        wallet.address,
        signTransaction
      );

      if (result.success) {
        await refreshBalance();
        // TODO: Play success sound/animation
        console.log('Bear Attack successful!', result.txHash);
      } else {
        console.error('Bear Attack failed:', result.error);
      }
    } catch (error) {
      console.error('Bear Attack error:', error);
    } finally {
      setIsAttacking(null);
    }
  };

  if (!wallet.isConnected) return null;

  return (
    <div className="fixed bottom-6 right-6 z-30">
      <AnimatePresence>
        {isEnabled && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="mb-4 glass-card p-4 w-72"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-white flex items-center gap-2">
                <span className="text-xl">🐻</span>
                Bear Attack Mode
              </h3>
              <button
                onClick={() => setShowConfig(!showConfig)}
                className="p-1.5 rounded-lg hover:bg-bear-dark-600 transition-colors"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>

            {/* Quick attack buttons */}
            <div className="space-y-2">
              {presets
                .filter((p) => p.enabled)
                .map((preset) => (
                  <motion.button
                    key={preset.id}
                    onClick={() => handleAttack(preset)}
                    disabled={isAttacking !== null}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                      isAttacking === preset.id
                        ? 'bg-bear-green-500/20 border border-bear-green-500/50'
                        : 'bg-bear-dark-600 hover:bg-bear-dark-500 border border-transparent'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-bear-dark-700 flex items-center justify-center">
                        <span className="text-sm font-bold text-bear-purple-400">
                          {preset.token.symbol.charAt(0)}
                        </span>
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-white text-sm">
                          Buy {preset.token.symbol}
                        </div>
                        <div className="text-xs text-gray-400">
                          {preset.amount} XRP
                        </div>
                      </div>
                    </div>
                    {isAttacking === preset.id ? (
                      <svg className="animate-spin w-5 h-5 text-bear-green-500" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5 text-bear-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                  </motion.button>
                ))}
            </div>

            {/* Config panel */}
            <AnimatePresence>
              {showConfig && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 pt-4 border-t border-bear-dark-500"
                >
                  <p className="text-xs text-gray-400 mb-3">
                    Configure your one-tap trading presets
                  </p>
                  {presets.map((preset, index) => (
                    <div key={preset.id} className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={preset.enabled}
                        onChange={(e) => {
                          const newPresets = [...presets];
                          newPresets[index].enabled = e.target.checked;
                          setPresets(newPresets);
                        }}
                        className="w-4 h-4 rounded bg-bear-dark-600 border-bear-dark-500 text-bear-purple-500 focus:ring-bear-purple-500"
                      />
                      <span className="text-sm text-white flex-1">{preset.token.symbol}</span>
                      <input
                        type="text"
                        value={preset.amount}
                        onChange={(e) => {
                          const newPresets = [...presets];
                          newPresets[index].amount = e.target.value;
                          setPresets(newPresets);
                        }}
                        className="w-20 bg-bear-dark-700 border border-bear-dark-500 rounded px-2 py-1 text-sm text-white text-right"
                      />
                      <span className="text-xs text-gray-400">XRP</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main toggle button */}
      <motion.button
        onClick={onToggle}
        className={`w-16 h-16 rounded-2xl shadow-2xl flex items-center justify-center transition-all ${
          isEnabled
            ? 'btn-bear-attack glow-green'
            : 'bg-bear-dark-700 hover:bg-bear-dark-600 border border-bear-dark-500'
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <span className="text-3xl">🐻</span>
      </motion.button>
    </div>
  );
};

export default BearAttackMode;
