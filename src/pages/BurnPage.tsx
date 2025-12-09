/**
 * BEAR Burn Page
 * Dedicated page showing LP token auto-burn transparency
 */

import { motion } from 'framer-motion';
import { BurnTracker } from '../components/BurnTracker';

export default function BurnPage() {
  return (
    <div className="min-h-screen pt-24 pb-32 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
            <span className="text-gradient-bear">$BEAR</span> LP Token Auto-Burn
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            100% Transparent Fee Burning - Watch swap fees automatically convert to BEAR/XRP LP tokens and get permanently locked in a blackholed wallet.
          </p>
        </motion.div>

        {/* How It Works - Detailed */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <div className="bg-gradient-to-br from-bear-dark-800/80 to-bear-dark-900/80 backdrop-blur rounded-2xl p-8 border border-bear-dark-600">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-3">
              <span className="text-3xl">⚙️</span>
              How the Auto-Burn System Works
            </h2>

            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bear-green-500/20 flex items-center justify-center">
                  <span className="text-3xl">💰</span>
                </div>
                <h3 className="text-bear-green-400 font-bold mb-2">Step 1: Fees Collected</h3>
                <p className="text-sm text-gray-400">
                  0.5-0.7% swap fees collected in XRP go to treasury wallet
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <span className="text-3xl">💎</span>
                </div>
                <h3 className="text-blue-400 font-bold mb-2">Step 2: Auto-Convert</h3>
                <p className="text-sm text-gray-400">
                  XRP automatically converted to BEAR/XRP LP tokens via single-sided deposit
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <span className="text-3xl">🔥</span>
                </div>
                <h3 className="text-orange-400 font-bold mb-2">Step 3: Instant Burn</h3>
                <p className="text-sm text-gray-400">
                  LP tokens instantly sent to blackholed wallet (keys destroyed forever)
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-bearpark-gold/20 flex items-center justify-center">
                  <span className="text-3xl">📊</span>
                </div>
                <h3 className="text-bearpark-gold font-bold mb-2">Step 4: 100% Transparent</h3>
                <p className="text-sm text-gray-400">
                  Every transaction logged and visible on-chain for full transparency
                </p>
              </div>
            </div>

            <div className="mt-8 p-4 bg-bear-green-500/10 rounded-xl border border-bear-green-500/30">
              <p className="text-bear-green-400 text-center font-semibold">
                ⏱️ Runs automatically every 5 minutes • Zero manual intervention • Fully trustless
              </p>
            </div>
          </div>
        </motion.div>

        {/* Live Burn Tracker */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <BurnTracker />
        </motion.div>

        {/* Why This Matters */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12"
        >
          <div className="bg-gradient-to-br from-bearpark-gold/10 to-bear-purple-500/10 rounded-2xl p-8 border border-bearpark-gold/30">
            <h2 className="text-2xl font-bold text-white mb-6">🌟 Why This Matters</h2>

            <div className="grid md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-bear-green-400 font-bold mb-2 flex items-center gap-2">
                  <span>💹</span> Deflationary Tokenomics
                </h3>
                <p className="text-sm text-gray-300">
                  Every swap permanently removes $BEAR from circulation by locking LP tokens, increasing scarcity over time.
                </p>
              </div>

              <div>
                <h3 className="text-bearpark-gold font-bold mb-2 flex items-center gap-2">
                  <span>🔒</span> Trustless & Verifiable
                </h3>
                <p className="text-sm text-gray-300">
                  No team wallets, no multisigs, no trust required. Everything happens on-chain and can be verified by anyone.
                </p>
              </div>

              <div>
                <h3 className="text-bear-purple-400 font-bold mb-2 flex items-center gap-2">
                  <span>🎯</span> Benefits ALL Holders
                </h3>
                <p className="text-sm text-gray-300">
                  As LP tokens are permanently locked, the value of remaining $BEAR increases for all holders.
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
