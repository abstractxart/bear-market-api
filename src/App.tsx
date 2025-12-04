import React, { useState } from 'react';
import { WalletProvider } from './context/WalletContext';
import Header from './components/Header';
import SwapCard from './components/SwapCard';
import BearAttackMode from './components/BearAttackMode';

const App: React.FC = () => {
  const [bearAttackEnabled, setBearAttackEnabled] = useState(false);

  return (
    <WalletProvider>
      <div className="min-h-screen">
        {/* Header */}
        <Header />

        {/* Main content */}
        <main className="pt-24 pb-32 px-4">
          <div className="max-w-7xl mx-auto">
            {/* Hero section */}
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-display mb-4">
                <span className="text-gradient-bear">Trade with the</span>
                <br />
                <span className="text-white">Lowest Fees on XRPL</span>
              </h1>
              <p className="text-lg text-gray-400 max-w-xl mx-auto">
                Swap XRP tokens with fees as low as <span className="text-bear-gold-400 font-semibold">0.321%</span>.
                All fees support the BEAR ecosystem.
              </p>
            </div>

            {/* Swap card */}
            <div className="flex justify-center">
              <SwapCard />
            </div>

            {/* Fee tiers info */}
            <div className="max-w-2xl mx-auto mt-16">
              <h2 className="text-2xl font-bold text-white text-center mb-8 font-display">
                Fee Tiers
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Regular tier */}
                <div className="glass-card p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-bear-dark-600 flex items-center justify-center">
                    <span className="text-2xl">👤</span>
                  </div>
                  <h3 className="font-semibold text-white mb-1">Regular</h3>
                  <div className="text-2xl font-bold text-gray-300 mb-2">0.589%</div>
                  <p className="text-sm text-gray-500">Default rate for all users</p>
                </div>

                {/* Pixel Bear tier */}
                <div className="glass-card p-6 text-center border-bear-purple-500/30">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-bear-purple-500/20 flex items-center justify-center">
                    <span className="text-2xl">🐻</span>
                  </div>
                  <h3 className="font-semibold text-bear-purple-400 mb-1">Pixel Bear</h3>
                  <div className="text-2xl font-bold text-bear-purple-300 mb-2">0.485%</div>
                  <p className="text-sm text-gray-500">Hold any Pixel Bear NFT</p>
                </div>

                {/* Ultra Rare tier */}
                <div className="glass-card p-6 text-center border-bear-gold-500/30 glow-gold">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-bear-gold-500/20 flex items-center justify-center">
                    <span className="text-2xl">👑</span>
                  </div>
                  <h3 className="font-semibold text-bear-gold-400 mb-1">Ultra Rare</h3>
                  <div className="text-2xl font-bold text-bear-gold-300 mb-2">0.321%</div>
                  <p className="text-sm text-gray-500">Hold an Ultra Rare Pixel Bear</p>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="max-w-3xl mx-auto mt-20">
              <h2 className="text-2xl font-bold text-white text-center mb-8 font-display">
                How It Works
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-bear-purple-500/20 flex items-center justify-center text-2xl">
                    1️⃣
                  </div>
                  <h3 className="font-semibold text-white mb-2">Connect Wallet</h3>
                  <p className="text-sm text-gray-400">
                    Import your seed or connect with WalletConnect
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-bear-purple-500/20 flex items-center justify-center text-2xl">
                    2️⃣
                  </div>
                  <h3 className="font-semibold text-white mb-2">Swap Tokens</h3>
                  <p className="text-sm text-gray-400">
                    Trade any XRP pair with the lowest fees
                  </p>
                </div>
                <div className="text-center">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-bear-purple-500/20 flex items-center justify-center text-2xl">
                    3️⃣
                  </div>
                  <h3 className="font-semibold text-white mb-2">Earn Honey</h3>
                  <p className="text-sm text-gray-400">
                    Every trade earns Honey Points for rewards
                  </p>
                </div>
              </div>
            </div>

            {/* BEARpark integration callout */}
            <div className="max-w-2xl mx-auto mt-20 glass-card p-8 text-center">
              <div className="flex justify-center gap-4 mb-4">
                <span className="text-4xl">🐻</span>
                <span className="text-4xl">🍯</span>
                <span className="text-4xl">🎮</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2 font-display">
                Part of the BEARpark Ecosystem
              </h2>
              <p className="text-gray-400 mb-4">
                BEAR MARKET is integrated with BEARpark. Your trades, your points, your rewards—all connected.
              </p>
              <a
                href="https://bearpark.xyz"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-honey inline-flex items-center gap-2"
              >
                Visit BEARpark
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </main>

        {/* Bear Attack Mode */}
        <BearAttackMode
          isEnabled={bearAttackEnabled}
          onToggle={() => setBearAttackEnabled(!bearAttackEnabled)}
        />
      </div>
    </WalletProvider>
  );
};

export default App;
