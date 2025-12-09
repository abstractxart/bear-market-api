import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { WalletProvider } from './context/WalletContext';
import Header from './components/Header';
import SwapCard from './components/SwapCard';
import { BurnTracker } from './components/BurnTracker';
import BearAttackMode from './components/BearAttackMode';
import ReferralsPage from './components/ReferralsPage';
import BurnPage from './pages/BurnPage';
import TokensPage from './pages/TokensPage';
import TokenTerminal from './pages/TokenTerminal';
import { MnemonicChecksumHelper } from './components/MnemonicChecksumHelper';
import { LocalStorageRecovery } from './components/LocalStorageRecovery';
import { getReferralCodeFromURL, storeReferralCode } from './services/referralService';
import { preloadLeaderboardTokens } from './services/tokenLeaderboardService';

// Scroll to top on route change
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Scroll window to top
    window.scrollTo(0, 0);
    // Also scroll any scrollable containers
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [pathname]);

  return null;
};

const App: React.FC = () => {
  const [bearAttackEnabled, setBearAttackEnabled] = useState(false);

  // BLAZING FAST: Preload tokens on app start so they're ready INSTANTLY
  useEffect(() => {
    // Preload leaderboard tokens in background
    preloadLeaderboardTokens();

    // Capture referral code from URL
    const refCode = getReferralCodeFromURL();
    if (refCode) {
      storeReferralCode(refCode);
      console.log(`[App] Referral code detected: ${refCode}`);
    }
  }, []);

  return (
    <WalletProvider>
      <Router>
        <ScrollToTop />
        <div className="min-h-screen relative">
          {/* Animated Background Orbs */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            {/* Large purple orb - top left */}
            <div className="absolute -top-20 -left-20 w-[500px] h-[500px] bg-bear-purple-500/30 rounded-full blur-[120px] animate-pulse"></div>
            {/* Gold orb - bottom right */}
            <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] bg-bearpark-gold/25 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
            {/* Green orb - center right */}
            <div className="absolute top-1/3 -right-10 w-80 h-80 bg-bear-green-500/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '1s' }}></div>
            {/* Purple orb - bottom left */}
            <div className="absolute bottom-1/4 -left-10 w-80 h-80 bg-bear-purple-600/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '3s' }}></div>
            {/* Extra center glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-bearpark-gold/10 rounded-full blur-[150px]"></div>
          </div>

          {/* Header */}
          <Header />

          {/* Main content - tight on mobile */}
          <main className="pt-12 md:pt-24 pb-32 px-0 md:px-4">
            <Routes>
              {/* Home/Swap page */}
              <Route path="/" element={
                <div className="max-w-7xl mx-auto relative z-10">
                  {/* Hero section */}
                  <div className="relative text-center mb-12 px-4">
                    {/* Subtle glow behind hero text */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-[500px] h-[400px] bg-bearpark-gold/5 rounded-full blur-[120px]"></div>
                    </div>

                    {/* BEAR SWAP Logo with tri-gradient spinning border */}
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="relative w-28 h-28 mx-auto mb-8"
                    >
                      <div className="absolute inset-0 rounded-2xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></div>
                      <div className="absolute inset-[3px] rounded-2xl bg-bear-dark-800 flex items-center justify-center overflow-hidden">
                        <img
                          src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/BEARSWAPLOGO3.png"
                          alt="BEAR SWAP"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </motion.div>

                    {/* Concise headline */}
                    <motion.h1
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
                      className="relative text-4xl md:text-5xl lg:text-6xl font-bold font-display mb-6"
                    >
                      <span className="text-white">The</span>{' '}
                      <span className="text-gradient-bear">Lowest Fees</span>{' '}
                      <span className="text-white">on XRPL.</span>
                      <br />
                      <span className="text-bear-green-400">Highest Referral Payouts</span>.{' '}
                      <span className="text-bearpark-gold font-luckiest">Period</span>.
                    </motion.h1>

                    {/* Clean value props */}
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4, duration: 0.5 }}
                      className="relative max-w-2xl mx-auto space-y-4 text-center"
                    >
                      {/* Concise bullet points */}
                      <p className="text-lg text-gray-400">
                        <span className="text-bearpark-gold font-bold">0.5%-0.7%</span> •
                        <span className="text-bear-green-400 font-semibold"> 50% instant payouts</span> •
                        <span className="text-bear-purple-400 font-semibold"> 50% to blackholed LP (100% if no referrer)</span>
                      </p>

                      {/* Tagline */}
                      <p className="text-white font-bold text-lg border-t border-bear-dark-600 pt-4 max-w-md mx-auto">
                        Zero team cuts. Ever.
                      </p>
                    </motion.div>
                  </div>

                  {/* Swap card */}
                  <div className="flex justify-center">
                    <SwapCard />
                  </div>

                  {/* Fee tiers info - with background effects */}
                  <div id="lower-fees" className="relative max-w-2xl mx-auto mt-16 px-4">
                    {/* Background orb for fee tiers */}
                    <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-80 h-80 bg-bear-purple-500/5 rounded-full blur-[80px] pointer-events-none"></div>

                    <motion.h2
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5 }}
                      className="relative text-2xl font-bold text-white text-center mb-8 font-display"
                    >
                      Want Lower Fees?
                    </motion.h2>
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                      className="relative grid grid-cols-1 md:grid-cols-3 gap-4"
                    >
                      {/* Regular tier - with sad bear background + STATIC border */}
                      <div className="relative rounded-xl overflow-hidden">
                        {/* Static gradient border */}
                        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#680cd9] via-[#feb501] to-[#07ae08]"></div>
                        {/* Inner card */}
                        <div className="absolute inset-[3px] rounded-xl overflow-hidden">
                          {/* Sad bear background image */}
                          <div
                            className="absolute inset-0 bg-cover bg-center scale-110"
                            style={{
                              backgroundImage: 'url(https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/sadbear.png)',
                            }}
                          ></div>
                          {/* Dark overlay */}
                          <div className="absolute inset-0 bg-black/80"></div>
                        </div>
                        {/* Content - centered */}
                        <div className="relative z-10 p-6 h-full flex flex-col items-center justify-center text-center">
                          <h3 className="font-bold text-gray-200 mb-1 text-lg drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">Regular</h3>
                          <div className="text-3xl font-black text-white mb-2 drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">0.7%</div>
                          <p className="text-sm text-gray-300 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">Default rate for all users</p>
                        </div>
                      </div>

                      {/* Pixel Bear tier - with video background + tri-gradient border */}
                      <a
                        href="https://xrp.cafe/collection/bear-pixel-collection"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative rounded-xl overflow-hidden block cursor-pointer hover:scale-[1.02] transition-transform"
                      >
                        {/* Spinning tri-gradient border */}
                        <div className="absolute inset-0 rounded-xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></div>
                        {/* Inner card */}
                        <div className="absolute inset-[3px] rounded-xl overflow-hidden">
                          {/* Video background */}
                          <video
                            autoPlay
                            loop
                            muted
                            playsInline
                            className="absolute inset-0 w-full h-full object-cover"
                          >
                            <source src="https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/BEARRAVE_1.mp4" type="video/mp4" />
                          </video>
                          {/* Dark overlay */}
                          <div className="absolute inset-0 bg-black/75"></div>
                        </div>
                        {/* Content - centered */}
                        <div className="relative z-10 p-6 h-full flex flex-col items-center justify-center text-center">
                          <h3 className="font-bold text-bear-purple-200 mb-1 text-lg drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">Pixel BEAR</h3>
                          <div className="text-3xl font-black text-white mb-2 drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">0.6%</div>
                          <p className="text-sm text-gray-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">Hold any Pixel Bear NFT</p>
                        </div>
                      </a>

                      {/* Ultra Rare tier - with animated image background + tri-gradient border */}
                      <a
                        href="https://xrp.cafe/collection/bearxrpl"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative rounded-xl overflow-hidden glow-gold block cursor-pointer hover:scale-[1.02] transition-transform"
                      >
                        {/* Spinning tri-gradient border */}
                        <div className="absolute inset-0 rounded-xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></div>
                        {/* Inner card */}
                        <div className="absolute inset-[3px] rounded-xl overflow-hidden">
                          {/* Animated image background */}
                          <div
                            className="absolute inset-0 w-[150%] h-full bg-cover bg-center animate-pan-slow"
                            style={{
                              backgroundImage: 'url(https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/62df7ec93488-4783-9b3e-1a15f863ba209df8e0211795-4489-b1e3-d16d060d0ee003c57f5491c6-4b80-af35-9e20a8ea316b.webp)',
                            }}
                          ></div>
                          {/* Dark overlay */}
                          <div className="absolute inset-0 bg-black/70"></div>
                        </div>
                        {/* Content - centered */}
                        <div className="relative z-10 p-6 h-full flex flex-col items-center justify-center text-center">
                          <h3 className="font-bold text-bear-gold-200 mb-1 text-lg drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">Ultra Rare BEAR</h3>
                          <div className="text-3xl font-black text-white mb-2 drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)]">0.5%</div>
                          <p className="text-sm text-gray-100 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">Hold an Ultra Rare BEAR</p>
                        </div>
                      </a>
                    </motion.div>
                  </div>

                  {/* Why BEAR SWAP - Fee Comparison - with BEAR SWAP energy */}
                  <div className="relative max-w-4xl mx-auto mt-20 px-4">
                    {/* Dramatic background orbs */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                      <div className="absolute top-0 left-1/4 w-48 h-48 bg-bear-purple-500/10 rounded-full blur-[80px]"></div>
                      <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-bearpark-gold/10 rounded-full blur-[80px]"></div>
                    </div>

                    <motion.h2
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5 }}
                      className="relative text-2xl md:text-3xl font-bold text-white text-center mb-4 font-display"
                    >
                      Why <span className="text-gradient-bear font-luckiest">BEAR SWAP</span>?
                    </motion.h2>
                    <motion.p
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 0.1 }}
                      className="relative text-gray-400 text-center mb-8 max-w-2xl mx-auto"
                    >
                      Low fees for everyone. <span className="text-bear-purple-400 font-semibold">Even lower with BEAR NFTs.</span> <span className="text-bear-green-400 font-semibold">Highest referral payouts on XRPL — <span className="text-white font-bold">paid the moment a swap occurs</span>.</span>
                    </motion.p>

                    {/* Single Clean Comparison Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      {/* First Ledger */}
                      <div className="relative bg-bear-dark-800/50 backdrop-blur border border-red-500/30 rounded-2xl p-5 overflow-hidden">
                        {/* Background logo with blur */}
                        <div
                          className="absolute inset-0 opacity-10 blur-sm"
                          style={{
                            backgroundImage: 'url(https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/FL.jpg)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                          }}
                        ></div>
                        <h4 className="text-white font-semibold mb-3 relative z-10">First Ledger</h4>
                        <div className="text-3xl font-black text-red-400 mb-1 relative z-10">1.0%</div>
                        <div className="text-xs text-gray-500 mb-3 relative z-10">Swap Fee</div>
                        <div className="space-y-2 text-sm relative z-10">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Referrer cut</span>
                            <span className="text-gray-300">20%</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">To community</span>
                            <span className="text-red-400 font-semibold">0%</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-bear-dark-600 relative z-10">
                          <p className="text-red-400 text-[10px] font-medium">70% goes to team/unknown</p>
                        </div>
                      </div>

                      {/* Xaman */}
                      <div className="relative bg-bear-dark-800/50 backdrop-blur border border-yellow-500/30 rounded-2xl p-5 overflow-hidden">
                        {/* Background logo with blur */}
                        <div
                          className="absolute inset-0 opacity-10 blur-sm"
                          style={{
                            backgroundImage: 'url(https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/XAMAN%20LOGO.png)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                          }}
                        ></div>
                        <h4 className="text-white font-semibold mb-3 relative z-10">Xaman</h4>
                        <div className="text-3xl font-black text-yellow-400 mb-1 relative z-10">0.8%</div>
                        <div className="text-xs text-gray-500 mb-3 relative z-10">+ 0.09 XRP min</div>
                        <div className="space-y-2 text-sm relative z-10">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Referrer cut</span>
                            <span className="text-gray-500">None</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">To community</span>
                            <span className="text-yellow-400 font-semibold">0%</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-bear-dark-600 relative z-10">
                          <p className="text-yellow-400/70 text-[10px] font-medium">100% to XRPL Labs</p>
                        </div>
                      </div>

                      {/* Joey Wallet */}
                      <div className="relative bg-bear-dark-800/50 backdrop-blur border border-orange-500/30 rounded-2xl p-5 overflow-hidden">
                        {/* Background logo with blur */}
                        <div
                          className="absolute inset-0 opacity-10 blur-sm"
                          style={{
                            backgroundImage: 'url(https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/JOEY.png)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                          }}
                        ></div>
                        <h4 className="text-white font-semibold mb-3 relative z-10">Joey Wallet</h4>
                        <div className="text-3xl font-black text-orange-400 mb-1 relative z-10">0.8%</div>
                        <div className="text-xs text-gray-500 mb-3 relative z-10">Swap Fee</div>
                        <div className="space-y-2 text-sm relative z-10">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Referrer cut</span>
                            <span className="text-gray-500">None</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">To community</span>
                            <span className="text-orange-400 font-semibold">0%</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-bear-dark-600 relative z-10">
                          <p className="text-orange-400/70 text-[10px] font-medium">100% to Joey team</p>
                        </div>
                      </div>

                      {/* BEAR SWAP - Highlighted */}
                      <div className="relative rounded-2xl overflow-hidden sm:row-span-1">
                        <div className="absolute inset-0 bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></div>
                        <div className="relative m-[2px] rounded-2xl bg-gradient-to-br from-bear-dark-900 to-bear-dark-800 p-5 h-full overflow-hidden">
                          {/* Background logo with blur */}
                          <div
                            className="absolute inset-0 opacity-10 blur-sm"
                            style={{
                              backgroundImage: 'url(https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/BEARSWAPLOGO3.png)',
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              backgroundRepeat: 'no-repeat'
                            }}
                          ></div>
                          <h4 className="text-white font-bold font-luckiest mb-3 relative z-10">BEAR SWAP</h4>
                          <div className="flex items-baseline gap-1 mb-1 relative z-10">
                            <span className="text-3xl font-black text-bear-green-400">0.5</span>
                            <span className="text-lg font-bold text-gray-400">-</span>
                            <span className="text-3xl font-black text-bear-green-400">0.7%</span>
                          </div>
                          <div className="text-xs text-bearpark-gold mb-3 relative z-10">$BEAR NFT holders get lower fees</div>
                          <div className="space-y-2 text-sm relative z-10">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Referrer cut</span>
                              <span className="text-bear-green-400 font-bold">50%</span>
                            </div>
                            <div className="flex justify-between text-xs items-start">
                              <span className="text-gray-400">To $BEAR LP<br /><span className="text-gray-500">(blackholed <a href="https://bithomp.com/en/account/rBEARmPLNA8CMu92P4vj95fkyCt1N4jrNm" target="_blank" rel="noopener noreferrer" className="text-bear-purple-400 hover:text-bear-purple-300 underline">here</a>)</span></span>
                              <span className="text-bearpark-gold font-bold">50%</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-bear-dark-600 space-y-1 relative z-10">
                            <p className="text-bear-green-400 text-[10px] font-bold">No team cuts. Instant payouts.</p>
                            <p className="text-bearpark-gold text-[10px] font-bold">No referrer? 100% → $BEAR LP!</p>
                            <p className="text-red-400 text-[9px] mt-1 font-semibold">LP deposits = locked forever = $BEAR deflationary</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Key Value Props - with BEAR SWAP hover effects */}
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8"
                    >
                      {/* Referral Program - with hover-activated spinning border */}
                      <motion.div
                        className="relative rounded-2xl overflow-hidden group cursor-pointer"
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        {/* Spinning gradient border on hover */}
                        <div className="absolute inset-0 z-0 rounded-2xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] opacity-0 group-hover:opacity-100 group-hover:animate-spin-slow transition-opacity duration-300"></div>
                        {/* Static gradient border when not hovering */}
                        <div className="absolute inset-0 z-0 rounded-2xl bg-gradient-to-r from-[#680cd9] via-[#feb501] to-[#07ae08] group-hover:opacity-0 transition-opacity duration-300"></div>
                        <div
                          className="relative z-10 m-[2px] rounded-2xl p-6 h-full transition-colors overflow-hidden"
                          style={{
                            backgroundImage: 'url(https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/BEAR%20CASH.gif)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                          }}
                        >
                          {/* Black opacity overlay */}
                          <div className="absolute inset-0 bg-black/80 -z-10"></div>
                          <div className="flex items-start gap-4 relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-bear-green-500/20 group-hover:bg-bear-green-500/30 flex items-center justify-center flex-shrink-0 transition-colors">
                              <svg className="w-6 h-6 text-bear-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-lg mb-2">Highest Referral Earnings on XRPL 💰</h3>
                              <p className="text-gray-400 text-sm mb-3">
                                Earn <span className="text-bear-green-400 font-bold">50% of EVERY swap fee</span> your referrals pay — <span className="text-white font-black">paid instantly, on-chain, the moment they swap</span>.
                              </p>

                              {/* Comparison Box */}
                              <div className="mb-3 p-3 bg-bearpark-gold/10 rounded-lg border border-bearpark-gold/30">
                                <p className="text-xs text-white font-bold mb-2">💵 Example: Friend swaps $10,000 in tokens</p>
                                <div className="space-y-1.5">
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-400">First Ledger (1.0% fee)</span>
                                    <span className="text-xs text-gray-300">You earn: <span className="text-red-400 font-bold">$20</span> (20% cut)</span>
                                  </div>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-400">Xaman / Joey (0.8% fee)</span>
                                    <span className="text-xs text-gray-300">You earn: <span className="text-red-400 font-bold">$0</span> (no referrals)</span>
                                  </div>
                                  <div className="pt-1 border-t border-bearpark-gold/30">
                                    <div className="flex justify-between items-center">
                                      <span className="text-xs text-bearpark-gold font-bold">BEAR SWAP (0.7% fee)</span>
                                      <span className="text-xs text-bear-green-400 font-bold">You earn: $35 (50% cut)</span>
                                    </div>
                                  </div>
                                </div>
                                <p className="text-xs text-bear-green-400 font-bold mt-2">
                                  ↑ That's <span className="text-white">75% MORE</span> than First Ledger! ↑
                                </p>
                              </div>

                              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-bear-green-500/10 rounded-lg border border-bear-green-500/30">
                                <svg className="w-4 h-4 text-bear-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <p className="text-xs text-bear-green-300 font-semibold">No waiting. No delays. Instant XRP payouts on every swap.</p>
                              </div>
                              <a
                                href="/referrals"
                                className="text-bearpark-gold hover:text-bearpark-gold/80 text-sm font-semibold inline-flex items-center gap-1"
                              >
                                Start Earning →
                              </a>
                            </div>
                          </div>
                        </div>
                      </motion.div>

                      {/* Liquidity Pool - with hover-activated spinning border */}
                      <motion.div
                        className="relative rounded-2xl overflow-hidden group cursor-pointer"
                        whileHover={{ scale: 1.02 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                      >
                        {/* Spinning gradient border on hover */}
                        <div className="absolute inset-0 z-0 rounded-2xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] opacity-0 group-hover:opacity-100 group-hover:animate-spin-slow transition-opacity duration-300"></div>
                        {/* Static gradient border when not hovering */}
                        <div className="absolute inset-0 z-0 rounded-2xl bg-gradient-to-r from-[#680cd9] via-[#feb501] to-[#07ae08] group-hover:opacity-0 transition-opacity duration-300"></div>
                        <div
                          className="relative z-10 m-[2px] rounded-2xl p-6 h-full transition-colors overflow-hidden"
                          style={{
                            backgroundImage: 'url(https://pub-58cecf0785cc4738a3496a79699fdf1e.r2.dev/images/BEAR%20BURN.gif)',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat'
                          }}
                        >
                          {/* Black opacity overlay */}
                          <div className="absolute inset-0 bg-black/80 -z-10"></div>
                          <div className="flex items-start gap-4 relative z-10">
                            <div className="w-12 h-12 rounded-xl bg-bearpark-gold/20 group-hover:bg-bearpark-gold/30 flex items-center justify-center flex-shrink-0 transition-colors">
                              <svg className="w-6 h-6 text-bearpark-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-lg mb-2 drop-shadow-[0_4px_12px_rgba(0,0,0,0.9)]">Every Swap Burns $BEAR</h3>
                              <p className="text-gray-300 text-sm mb-3 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                                50% of fees go to referrers (if used), the other 50% gets deposited into the
                                <span className="text-bearpark-gold font-bold"> $BEAR liquidity pool</span> — permanently locked in a blackholed wallet.
                              </p>
                              <div className="p-3 bg-bearpark-gold/10 rounded-lg border border-bearpark-gold/30 space-y-2">
                                <p className="text-xs text-bearpark-gold font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                                  🔥 LP is <a href="https://bithomp.com/en/account/rBEARmPLNA8CMu92P4vj95fkyCt1N4jrNm" target="_blank" rel="noopener noreferrer" className="underline hover:text-bearpark-gold/80">BLACKHOLED</a> — keys destroyed forever
                                </p>
                                <p className="text-xs text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                                  Each swap permanently removes $BEAR from circulation → increasing scarcity → deflationary tokenomics
                                </p>
                                <p className="text-xs text-bear-green-400 font-bold drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]">
                                  No referrer? 100% of fees → Blackholed LP = More burn!
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>

                    {/* Bottom CTA */}
                    <div className="text-center">
                      <p className="text-gray-500 text-sm">
                        Lower fees than Xaman & Joey. <span className="text-bear-green-400 font-semibold">Even cheaper with BEAR NFTs.</span> <span className="text-bearpark-gold font-bold">100% transparent.</span>
                      </p>
                    </div>
                  </div>
                </div>
              } />

              {/* Referrals page */}
              <Route path="/referrals" element={<ReferralsPage />} />

              {/* Burn page */}
              <Route path="/burn" element={<BurnPage />} />

              {/* Tokens leaderboard page */}
              <Route path="/tokens" element={<TokensPage />} />

              {/* Token Terminal - Trading Interface */}
              <Route path="/tokens/:currency/:issuer?" element={<TokenTerminal />} />

              {/* Checksum Helper - Wallet Recovery Tool */}
              <Route path="/checksum-helper" element={<MnemonicChecksumHelper />} />
              <Route path="/recover-wallet" element={<LocalStorageRecovery />} />
            </Routes>
          </main>

          {/* Bear Attack Mode */}
          <BearAttackMode
            isEnabled={bearAttackEnabled}
            onToggle={() => setBearAttackEnabled(!bearAttackEnabled)}
          />

                  </div>
      </Router>
    </WalletProvider>
  );
};

export default App;
