import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import { getFeeTierName } from '../services/nftService';
import { SecureWalletConnect } from './SecureWalletConnect';

const Header: React.FC = () => {
  const { wallet, disconnect, connectWithAddress } = useWallet();
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Format address for display
  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Handle successful wallet connection
  const handleConnect = (address: string) => {
    connectWithAddress(address);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-bear-dark-900/80 backdrop-blur-xl border-b border-bear-dark-700">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <motion.a
            href="/"
            className="flex items-center gap-3"
            whileHover={{ scale: 1.02 }}
          >
            {/* Bear icon */}
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-bear-purple-500 to-bear-green-500 flex items-center justify-center">
              <span className="text-2xl">🐻</span>
            </div>
            <div>
              <h1 className="text-xl font-bold font-display text-gradient-bear">
                BEAR MARKET
              </h1>
              <p className="text-xs text-gray-500 -mt-0.5">
                We thrive in the Bear Market
              </p>
            </div>
          </motion.a>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <a href="#swap" className="text-gray-300 hover:text-white transition-colors font-medium">
              Swap
            </a>
            <a href="#leaderboard" className="text-gray-400 hover:text-white transition-colors">
              Leaderboard
            </a>
            <a href="https://bearpark.xyz" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-white transition-colors">
              BEARpark
            </a>
          </nav>

          {/* Wallet section */}
          <div className="flex items-center gap-3">
            {wallet.isConnected ? (
              <>
                {/* Honey Points */}
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-bear-gold-500/10 rounded-lg border border-bear-gold-500/20">
                  <span className="text-lg">🍯</span>
                  <span className="text-bear-gold-400 font-semibold font-mono">
                    {wallet.honeyPoints.toLocaleString()}
                  </span>
                </div>

                {/* Fee tier badge */}
                <div className={`hidden sm:block fee-badge-${wallet.feeTier === 'ultra_rare' ? 'ultra' : wallet.feeTier === 'pixel_bear' ? 'pixel' : 'regular'}`}>
                  {getFeeTierName(wallet.feeTier)}
                </div>

                {/* Wallet button */}
                <div className="relative">
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    className="flex items-center gap-2 px-4 py-2 bg-bear-dark-700 hover:bg-bear-dark-600 rounded-xl border border-bear-dark-500 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-bear-green-500"></div>
                    <span className="font-mono text-sm text-white">
                      {formatAddress(wallet.address!)}
                    </span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown */}
                  {showDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute right-0 mt-2 w-64 glass-card p-2 z-50"
                    >
                      <div className="p-3 border-b border-bear-dark-500">
                        <div className="text-xs text-gray-400 mb-1">Balance</div>
                        <div className="text-xl font-bold text-white font-mono">
                          {parseFloat(wallet.balance.xrp).toFixed(2)} XRP
                        </div>
                      </div>
                      <div className="p-2">
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(wallet.address!);
                            // TODO: Show toast
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bear-dark-600 text-gray-300 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy Address
                        </button>
                        <a
                          href={`https://bithomp.com/explorer/${wallet.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-bear-dark-600 text-gray-300 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          View on Explorer
                        </a>
                        <button
                          onClick={() => {
                            disconnect();
                            setShowDropdown(false);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          Disconnect
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => setShowWalletConnect(true)}
                className="btn-primary"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Secure Wallet connect modal */}
      <SecureWalletConnect
        isOpen={showWalletConnect}
        onClose={() => setShowWalletConnect(false)}
        onConnect={handleConnect}
      />

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </>
  );
};

export default Header;
