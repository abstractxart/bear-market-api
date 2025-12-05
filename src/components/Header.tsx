import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import { getFeeTierName } from '../services/nftService';
import { SecureWalletConnect } from './SecureWalletConnect';
import { WalletDashboard } from './WalletDashboard';

const Header: React.FC = () => {
  const { wallet } = useWallet();
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [showWalletDashboard, setShowWalletDashboard] = useState(false);

  // Format address for display
  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Handle successful wallet connection
  const handleConnect = () => {
    setShowWalletConnect(false);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-bear-dark-900/80 backdrop-blur-xl border-b border-bear-dark-700">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3">
            <motion.div whileHover={{ scale: 1.02 }} className="flex items-center gap-3">
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
            </motion.div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/" className="text-gray-300 hover:text-white transition-colors font-medium">
              Swap
            </Link>
            <Link to="/referrals" className="text-gray-400 hover:text-white transition-colors">
              Referrals
            </Link>
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
                <button
                  onClick={() => setShowWalletDashboard(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-bear-dark-700 hover:bg-bear-dark-600 rounded-xl border border-bear-dark-500 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-bear-green-500"></div>
                  <span className="font-mono text-sm text-white">
                    {formatAddress(wallet.address!)}
                  </span>
                  <span className="text-gray-400 text-sm font-mono">
                    {parseFloat(wallet.balance.xrp).toFixed(2)} XRP
                  </span>
                </button>
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

      {/* Full Wallet Dashboard */}
      <WalletDashboard
        isOpen={showWalletDashboard}
        onClose={() => setShowWalletDashboard(false)}
      />
    </>
  );
};

export default Header;
