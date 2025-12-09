import { useState, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import { SecureWalletConnect } from './SecureWalletConnect';
import { WalletDashboard } from './WalletDashboard';
import { getKeyManager } from '../security/SecureKeyManager';

// Navigation items
const NAV_ITEMS = [
  { label: 'Tokens', path: '/tokens' },
  { label: 'Swap', path: '/' },
  { label: 'Referrals', path: '/referrals' },
  { label: 'Docs', href: 'https://docs.bearpark.xyz', external: true },
  { label: 'BEARpark', href: 'https://bearpark.xyz', external: true },
];

const Header: React.FC = () => {
  const { wallet, connectWithSecret } = useWallet();
  const location = useLocation();
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [showWalletDashboard, setShowWalletDashboard] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [walletButtonRect, setWalletButtonRect] = useState<DOMRect | null>(null);
  const walletButtonRef = useRef<HTMLButtonElement>(null);
  const mobileWalletButtonRef = useRef<HTMLButtonElement>(null);

  // Handle wallet dashboard open with SPLOINK origin
  const handleOpenWalletDashboard = (buttonRef: React.RefObject<HTMLButtonElement | null>) => {
    if (buttonRef.current) {
      setWalletButtonRect(buttonRef.current.getBoundingClientRect());
    }
    setShowWalletDashboard(true);
  };

  // Format address for display
  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Handle successful wallet connection
  const handleConnect = async () => {
    try {
      const keyManager = getKeyManager();
      const secret = await keyManager.getSecretForSigning();
      await connectWithSecret(secret);
      setShowWalletConnect(false);
    } catch (error) {
      console.error('[Header] Failed to connect wallet:', error);
    }
  };

  // Check if nav item is active
  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 bg-bear-dark-900/80 backdrop-blur-xl border-b border-bear-dark-700">
        <div className="max-w-7xl mx-auto px-2 md:px-4 h-12 md:h-16 flex items-center justify-between">
          {/* Logo - BEARpark Style with Tri-Gradient Ring */}
          <Link to="/" className="flex items-center gap-2.5">
            <motion.div
              whileHover={{ scale: 1.05, rotate: -2 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2.5"
            >
              {/* Logo - clean squircle with tri-gradient ring */}
              <div className="relative w-9 h-9 md:w-10 md:h-10 flex-shrink-0 rounded-xl overflow-hidden">
                {/* Static tri-gradient border */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#680cd9] via-[#feb501] to-[#07ae08]"></div>
                {/* Dark container matching swap panel */}
                <div className="absolute inset-[2px] rounded-[10px] bg-bear-dark-800 flex items-center justify-center overflow-hidden">
                  <img
                    src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/BEARSWAPLOGO3.png"
                    alt="BEAR SWAP"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="text-xl text-gradient-bear tracking-wide leading-tight font-luckiest">
                  BEAR SWAP
                </h1>
                <p className="text-[10px] text-bearpark-gold -mt-0.5 font-semibold tracking-wide">
                  We thrive in the Bear Market
                </p>
              </div>
            </motion.div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_ITEMS.map((item) =>
              item.external ? (
                <a
                  key={item.label}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nav-link-hover text-gray-400 hover:text-bearpark-gold transition-colors flex items-center gap-1"
                >
                  {item.label}
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : (
                <Link
                  key={item.label}
                  to={item.path!}
                  className={`nav-link-hover transition-colors font-semibold ${
                    isActive(item.path!)
                      ? 'text-bearpark-gold'
                      : 'text-gray-400 hover:text-bearpark-gold'
                  }`}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>

          {/* Right side: Wallet + Mobile Menu */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Wallet section - Desktop */}
            <div className="hidden sm:flex items-center gap-3">
              {wallet.isConnected ? (
                <button
                  ref={walletButtonRef}
                  onClick={() => handleOpenWalletDashboard(walletButtonRef)}
                  className="relative flex items-center gap-2 px-4 py-2 text-sm font-bold text-white rounded-full overflow-hidden group transition-all hover:scale-105 active:scale-95"
                >
                  {/* Tri-gradient border */}
                  <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></span>
                  <span className="absolute inset-[2px] rounded-full bg-bear-dark-800 group-hover:bg-bear-dark-700 transition-colors"></span>
                  <span className="relative z-10 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-bear-green-500"></span>
                    <span className="font-mono">{formatAddress(wallet.address!)}</span>
                    <span className="text-gray-400 font-mono">{parseFloat(wallet.balance.xrp).toFixed(2)} XRP</span>
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setShowWalletConnect(true)}
                  className="relative px-6 py-3 text-lg font-black text-white rounded-full overflow-hidden group transition-all hover:scale-105 active:scale-95 animate-pulse-glow"
                >
                  {/* Tri-gradient border */}
                  <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></span>
                  <span className="absolute inset-[2px] rounded-full bg-bear-green-500/20 group-hover:bg-bear-green-500/30 transition-colors"></span>
                  <span className="relative z-10">Create/Connect Wallet</span>
                </button>
              )}
            </div>

            {/* Wallet section - Mobile */}
            <div className="sm:hidden">
              {wallet.isConnected ? (
                <button
                  ref={mobileWalletButtonRef}
                  onClick={() => handleOpenWalletDashboard(mobileWalletButtonRef)}
                  className="relative flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-white rounded-full overflow-hidden group"
                >
                  <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></span>
                  <span className="absolute inset-[2px] rounded-full bg-bear-dark-800"></span>
                  <span className="relative z-10 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-bear-green-500"></span>
                    <span className="font-mono">{wallet.address!.slice(0, 4)}...{wallet.address!.slice(-3)}</span>
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => setShowWalletConnect(true)}
                  className="relative px-4 py-2 text-sm font-black text-white rounded-full overflow-hidden group transition-all hover:scale-105 active:scale-95 animate-pulse-glow"
                >
                  <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></span>
                  <span className="absolute inset-[2px] rounded-full bg-bear-green-500/20 group-hover:bg-bear-green-500/30 transition-colors"></span>
                  <span className="relative z-10">Create/Connect Wallet</span>
                </button>
              )}
            </div>

            {/* Mobile Hamburger Menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg bg-bear-dark-700 hover:bg-bear-dark-600 transition-colors"
              aria-label="Toggle menu"
            >
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />

            {/* Slide-out Menu */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="fixed right-0 top-0 h-full w-72 bg-bear-dark-900 border-l border-bear-dark-700 z-50 md:hidden"
            >
              {/* Menu Header */}
              <div className="flex items-center justify-between p-4 border-b border-bear-dark-700">
                <span className="text-lg font-bold text-white">Menu</span>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 rounded-lg hover:bg-bear-dark-700 transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Nav Items */}
              <nav className="p-4 space-y-2">
                {NAV_ITEMS.map((item) =>
                  item.external ? (
                    <a
                      key={item.label}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between px-4 py-3 rounded-lg text-gray-300 hover:bg-bear-dark-700 hover:text-white transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      {item.label}
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ) : (
                    <Link
                      key={item.label}
                      to={item.path!}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`block px-4 py-3 rounded-lg transition-colors ${
                        isActive(item.path!)
                          ? 'bg-bear-purple-500/20 text-white font-medium'
                          : 'text-gray-300 hover:bg-bear-dark-700 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                )}
              </nav>

              {/* Mobile Wallet Section */}
              {wallet.isConnected && (
                <div className="p-4 border-t border-bear-dark-700">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-2 h-2 rounded-full bg-bear-green-500"></div>
                    <span className="font-mono text-sm text-white">
                      {formatAddress(wallet.address!)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Balance</span>
                    <span className="text-white font-mono">
                      {parseFloat(wallet.balance.xrp).toFixed(2)} XRP
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleOpenWalletDashboard(mobileWalletButtonRef);
                    }}
                    className="relative w-full mt-4 px-4 py-2.5 rounded-xl text-white text-sm font-semibold overflow-hidden group"
                  >
                    <span className="absolute inset-0 rounded-xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></span>
                    <span className="absolute inset-[2px] rounded-xl bg-bear-dark-800 group-hover:bg-bear-dark-700 transition-colors"></span>
                    <span className="relative z-10">View Wallet</span>
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
        originRect={walletButtonRect}
      />
    </>
  );
};

export default Header;
