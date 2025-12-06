import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { WalletProvider } from './context/WalletContext';
import Header from './components/Header';
import SwapCard from './components/SwapCard';
import BearAttackMode from './components/BearAttackMode';
import ReferralsPage from './components/ReferralsPage';
import TokensPage from './pages/TokensPage';
import TokenTerminal from './pages/TokenTerminal';
import { getReferralCodeFromURL, storeReferralCode } from './services/referralService';

const App: React.FC = () => {
  const [bearAttackEnabled, setBearAttackEnabled] = useState(false);

  // Capture referral code from URL on app load
  useEffect(() => {
    const refCode = getReferralCodeFromURL();
    if (refCode) {
      storeReferralCode(refCode);
      console.log(`[App] Referral code detected: ${refCode}`);
    }
  }, []);

  return (
    <WalletProvider>
      <Router>
        <div className="min-h-screen">
          {/* Header */}
          <Header />

          {/* Main content - tight on mobile */}
          <main className="pt-12 md:pt-24 pb-32 px-0 md:px-4">
            <Routes>
              {/* Home/Swap page */}
              <Route path="/" element={
                <div className="max-w-7xl mx-auto">
                  {/* Hero section */}
                  <div className="text-center mb-12 px-4">
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display mb-6">
                      <span className="text-white">The</span>{' '}
                      <span className="text-gradient-bear">Lowest Fees</span>{' '}
                      <span className="text-white">on XRPL.</span>
                      <br />
                      <span className="text-bear-green-400">Highest Referral Payouts.</span>
                      <br />
                      <span className="text-bearpark-gold font-luckiest">Period.</span>
                    </h1>
                    <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
                      <span className="text-bear-gold-400 font-bold">0.5% swap fees</span> — competitors charge 0.8–1%+.
                      <br className="hidden md:block" />
                      <span className="text-bear-purple-400 font-semibold">50% to $BEAR LP</span>. <span className="text-bear-green-400 font-semibold">50% to referrers — <span className="text-white font-black">paid instantly</span></span>. <span className="text-white font-bold">Zero team cuts.</span>
                    </p>
                  </div>

                  {/* Swap card */}
                  <div className="flex justify-center">
                    <SwapCard />
                  </div>

                  {/* Fee tiers info */}
                  <div className="max-w-2xl mx-auto mt-16 px-4">
                    <h2 className="text-2xl font-bold text-white text-center mb-8 font-display">
                      Fee Tiers
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                              backgroundImage: 'url(https://file.garden/aTNJV_mJHkBEIhEB/sadbear.png)',
                            }}
                          ></div>
                          {/* Dark overlay */}
                          <div className="absolute inset-0 bg-black/70"></div>
                        </div>
                        {/* Content - centered */}
                        <div className="relative z-10 p-6 h-full flex flex-col items-center justify-center text-center">
                          <h3 className="font-bold text-gray-300 mb-1 text-lg drop-shadow-lg">Regular</h3>
                          <div className="text-3xl font-black text-white mb-2 drop-shadow-lg">0.8%</div>
                          <p className="text-sm text-gray-400 drop-shadow">Default rate for all users</p>
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
                            <source src="https://file.garden/aTNJV_mJHkBEIhEB/BEARRAVE_1.mp4" type="video/mp4" />
                          </video>
                          {/* Dark overlay */}
                          <div className="absolute inset-0 bg-black/60"></div>
                        </div>
                        {/* Content - centered */}
                        <div className="relative z-10 p-6 h-full flex flex-col items-center justify-center text-center">
                          <h3 className="font-bold text-bear-purple-300 mb-1 text-lg drop-shadow-lg">Pixel BEAR</h3>
                          <div className="text-3xl font-black text-white mb-2 drop-shadow-lg">0.65%</div>
                          <p className="text-sm text-gray-200 drop-shadow">Hold any Pixel Bear NFT</p>
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
                              backgroundImage: 'url(https://file.garden/aTNJV_mJHkBEIhEB/62df7ec93488-4783-9b3e-1a15f863ba209df8e0211795-4489-b1e3-d16d060d0ee003c57f5491c6-4b80-af35-9e20a8ea316b.webp)',
                            }}
                          ></div>
                          {/* Dark overlay */}
                          <div className="absolute inset-0 bg-black/50"></div>
                        </div>
                        {/* Content - centered */}
                        <div className="relative z-10 p-6 h-full flex flex-col items-center justify-center text-center">
                          <h3 className="font-bold text-bear-gold-300 mb-1 text-lg drop-shadow-lg">Ultra Rare BEAR</h3>
                          <div className="text-3xl font-black text-white mb-2 drop-shadow-lg">0.5%</div>
                          <p className="text-sm text-gray-200 drop-shadow">Hold an Ultra Rare BEAR</p>
                        </div>
                      </a>
                    </div>
                  </div>

                  {/* Why BEAR SWAP - Fee Comparison */}
                  <div className="max-w-4xl mx-auto mt-20 px-4">
                    <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-4 font-display">
                      Why <span className="text-gradient-bear font-luckiest">BEAR SWAP</span>?
                    </h2>
                    <p className="text-gray-400 text-center mb-8 max-w-2xl mx-auto">
                      Low fees for everyone. <span className="text-bear-purple-400 font-semibold">Even lower with BEAR NFTs.</span> <span className="text-bear-green-400 font-semibold">Highest referral payouts on XRPL — <span className="text-white font-bold">paid the moment a swap occurs</span>.</span>
                    </p>

                    {/* Single Clean Comparison Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                      {/* First Ledger */}
                      <div className="bg-bear-dark-800/50 backdrop-blur border border-red-500/30 rounded-2xl p-5">
                        <h4 className="text-white font-semibold mb-3">First Ledger</h4>
                        <div className="text-3xl font-black text-red-400 mb-1">1.0%</div>
                        <div className="text-xs text-gray-500 mb-3">Swap Fee</div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Referrer cut</span>
                            <span className="text-gray-300">20%</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">To community</span>
                            <span className="text-red-400 font-semibold">0%</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-bear-dark-600">
                          <p className="text-red-400 text-[10px] font-medium">70% goes to team/unknown</p>
                        </div>
                      </div>

                      {/* Xaman */}
                      <div className="bg-bear-dark-800/50 backdrop-blur border border-yellow-500/30 rounded-2xl p-5">
                        <h4 className="text-white font-semibold mb-3">Xaman</h4>
                        <div className="text-3xl font-black text-yellow-400 mb-1">0.8%</div>
                        <div className="text-xs text-gray-500 mb-3">+ 0.09 XRP min</div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Referrer cut</span>
                            <span className="text-gray-500">None</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">To community</span>
                            <span className="text-yellow-400 font-semibold">0%</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-bear-dark-600">
                          <p className="text-yellow-400/70 text-[10px] font-medium">100% to XRPL Labs</p>
                        </div>
                      </div>

                      {/* Joey Wallet */}
                      <div className="bg-bear-dark-800/50 backdrop-blur border border-orange-500/30 rounded-2xl p-5">
                        <h4 className="text-white font-semibold mb-3">Joey Wallet</h4>
                        <div className="text-3xl font-black text-orange-400 mb-1">0.8%</div>
                        <div className="text-xs text-gray-500 mb-3">Swap Fee</div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">Referrer cut</span>
                            <span className="text-gray-500">None</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-400">To community</span>
                            <span className="text-orange-400 font-semibold">0%</span>
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-bear-dark-600">
                          <p className="text-orange-400/70 text-[10px] font-medium">100% to Joey team</p>
                        </div>
                      </div>

                      {/* BEAR SWAP - Highlighted */}
                      <div className="relative rounded-2xl overflow-hidden sm:row-span-1">
                        <div className="absolute inset-0 bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></div>
                        <div className="relative m-[2px] rounded-2xl bg-gradient-to-br from-bear-dark-900 to-bear-dark-800 p-5 h-full">
                          <h4 className="text-white font-bold font-luckiest mb-3">BEAR SWAP</h4>
                          <div className="flex items-baseline gap-1 mb-1">
                            <span className="text-3xl font-black text-bear-green-400">0.5</span>
                            <span className="text-lg font-bold text-gray-400">-</span>
                            <span className="text-3xl font-black text-bear-green-400">0.8%</span>
                          </div>
                          <div className="text-xs text-bearpark-gold mb-3">$BEAR NFT holders get lower fees</div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Referrer cut</span>
                              <span className="text-bear-green-400 font-bold">50%</span>
                            </div>
                            <div className="flex justify-between text-xs items-start">
                              <span className="text-gray-400">To $BEAR LP<br /><span className="text-gray-500">(blackholed <a href="https://bithomp.com/en/account/rBEARmPLNA8CMu92P4vj95fkyCt1N4jrNm" target="_blank" rel="noopener noreferrer" className="text-bear-purple-400 hover:text-bear-purple-300 underline">here</a>)</span></span>
                              <span className="text-bearpark-gold font-bold">50%</span>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-bear-dark-600">
                            <p className="text-bear-green-400 text-[10px] font-bold">No team cuts. Instant payouts.</p>
                            <p className="text-red-400 text-[9px] mt-1 font-semibold">LP deposits = locked forever = $BEAR deflationary</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Key Value Props */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      {/* Referral Program */}
                      <div className="relative rounded-2xl overflow-hidden">
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#680cd9] via-[#feb501] to-[#07ae08]"></div>
                        <div className="relative m-[2px] rounded-2xl bg-bear-dark-800 p-6 h-full">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-bear-green-500/20 flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-bear-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-lg mb-2">50% Referrer Payouts — Paid Instantly</h3>
                              <p className="text-gray-400 text-sm mb-3">
                                Refer friends and earn <span className="text-bear-green-400 font-bold">half of every swap fee</span> they pay — <span className="text-white font-black">paid immediately when the swap occurs</span>.
                                That's <span className="text-white font-bold">2x better</span> than First Ledger's 20% referral cut!
                              </p>
                              <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-bear-green-500/10 rounded-lg border border-bear-green-500/30">
                                <svg className="w-4 h-4 text-bear-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                <p className="text-xs text-bear-green-300 font-semibold">No waiting. No delays. Instant on-chain payouts.</p>
                              </div>
                              <a
                                href="/referrals"
                                className="text-bearpark-gold hover:text-bearpark-gold/80 text-sm font-semibold inline-flex items-center gap-1"
                              >
                                Start Earning
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Liquidity Pool */}
                      <div className="relative rounded-2xl overflow-hidden">
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#680cd9] via-[#feb501] to-[#07ae08]"></div>
                        <div className="relative m-[2px] rounded-2xl bg-bear-dark-800 p-6 h-full">
                          <div className="flex items-start gap-4">
                            <div className="w-12 h-12 rounded-xl bg-bearpark-gold/20 flex items-center justify-center flex-shrink-0">
                              <svg className="w-6 h-6 text-bearpark-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                              </svg>
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-lg mb-2">No Team Wallets. No "TBA".</h3>
                              <p className="text-gray-400 text-sm mb-3">
                                50% goes to referrers (if used), the other 50% goes directly into the
                                <span className="text-bearpark-gold font-bold"> $BEAR liquidity pool</span> as a single-sided deposit.
                              </p>
                              <div className="p-3 bg-bearpark-gold/10 rounded-lg border border-bearpark-gold/30">
                                <p className="text-xs text-bearpark-gold font-bold">
                                  💡 No referrer? <span className="text-white">100% of fees → $BEAR LP!</span>
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Bottom CTA */}
                    <div className="text-center">
                      <p className="text-gray-500 text-sm">
                        Same base fees as Xaman & Joey. <span className="text-bear-green-400 font-semibold">Cheaper with any BEAR NFT.</span> <span className="text-bearpark-gold font-bold">100% transparent.</span>
                      </p>
                    </div>
                  </div>
                </div>
              } />

              {/* Referrals page */}
              <Route path="/referrals" element={<ReferralsPage />} />

              {/* Tokens leaderboard page */}
              <Route path="/tokens" element={<TokensPage />} />

              {/* Token Terminal - Trading Interface */}
              <Route path="/tokens/:currency/:issuer?" element={<TokenTerminal />} />
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
