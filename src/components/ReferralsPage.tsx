import { useState, useEffect } from 'react';
import { useWallet } from '../context/WalletContext';
import { getUserReferralData, copyReferralLink, getReferralStats, type ReferralData, type ReferralStats } from '../services/referralService';

const ReferralsPage: React.FC = () => {
  const { wallet } = useWallet();
  const [copySuccess, setCopySuccess] = useState(false);
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [stats, setStats] = useState<ReferralStats>({ totalReferrals: 0, totalEarned: '0', pendingPayouts: '0' });
  const [loading, setLoading] = useState(true);

  // Fetch referral data when wallet connects
  useEffect(() => {
    if (wallet.isConnected && wallet.address) {
      setLoading(true);
      Promise.all([
        getUserReferralData(wallet.address),
        getReferralStats(wallet.address)
      ])
        .then(([data, statsData]) => {
          setReferralData(data);
          setStats(statsData);
        })
        .catch(error => {
          console.error('[Referrals] Failed to fetch data:', error);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [wallet.isConnected, wallet.address]);

  if (!wallet.isConnected || !wallet.address) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="glass-card p-12 text-center">
          <div className="text-6xl mb-6">🔗</div>
          <h2 className="text-3xl font-bold text-white mb-4 font-display">Referral Program</h2>
          <p className="text-gray-400 mb-6">
            Connect your wallet to access your unique referral link and start earning rewards!
          </p>
        </div>
      </div>
    );
  }

  if (loading || !referralData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20">
        <div className="glass-card p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-6 border-4 border-bear-purple-500/30 border-t-bear-purple-500 rounded-full animate-spin"></div>
          <p className="text-gray-400">Loading your referral data...</p>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    const success = await copyReferralLink(referralData.referralLink);
    if (success) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-display">
          <span className="text-gradient-bear">Earn</span> with Referrals
        </h1>
        <p className="text-lg text-gray-400 max-w-2xl mx-auto">
          Share your referral link and earn <span className="text-bear-gold-400 font-semibold">50% of trading fees</span> from everyone you refer!
        </p>
      </div>

      {/* Referral Link Card */}
      <div className="glass-card p-8 mb-8">
        <h2 className="text-2xl font-bold text-white mb-2 font-display">Your Referral Link</h2>
        <p className="text-gray-400 mb-6">Share this link with friends to start earning rewards</p>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 bg-bear-dark-800 rounded-2xl p-4 font-mono text-sm break-all">
            <span className="text-bear-gold-400">{referralData.referralLink}</span>
          </div>
          <button
            onClick={handleCopy}
            className="btn-honey flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {copySuccess ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Link
              </>
            )}
          </button>
        </div>

        <div className="mt-6 p-4 bg-bear-dark-700 rounded-xl">
          <div className="text-sm text-gray-400 mb-2">Your Referral Code</div>
          <div className="text-2xl font-bold text-bear-gold-400 font-mono">{referralData.referralCode}</div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Total Referrals */}
        <div className="glass-card p-6 text-center">
          <div className="text-4xl mb-2">👥</div>
          <div className="text-3xl font-bold text-white mb-1">{stats.totalReferrals}</div>
          <div className="text-sm text-gray-400">Total Referrals</div>
        </div>

        {/* Total Earned */}
        <div className="glass-card p-6 text-center">
          <div className="text-4xl mb-2">💰</div>
          <div className="text-3xl font-bold text-bear-gold-400 mb-1">{stats.totalEarned} XRP</div>
          <div className="text-sm text-gray-400">Total Earned</div>
        </div>

        {/* Pending Payouts */}
        <div className="glass-card p-6 text-center">
          <div className="text-4xl mb-2">⏳</div>
          <div className="text-3xl font-bold text-bear-purple-400 mb-1">{stats.pendingPayouts} XRP</div>
          <div className="text-sm text-gray-400">Pending Payouts</div>
        </div>
      </div>

      {/* How it Works */}
      <div className="glass-card p-8">
        <h2 className="text-2xl font-bold text-white mb-6 font-display">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="w-12 h-12 mb-4 rounded-xl bg-bear-purple-500/20 flex items-center justify-center text-2xl">
              1️⃣
            </div>
            <h3 className="font-semibold text-white mb-2">Share Your Link</h3>
            <p className="text-sm text-gray-400">
              Copy your unique referral link and share it with friends
            </p>
          </div>
          <div>
            <div className="w-12 h-12 mb-4 rounded-xl bg-bear-purple-500/20 flex items-center justify-center text-2xl">
              2️⃣
            </div>
            <h3 className="font-semibold text-white mb-2">They Trade</h3>
            <p className="text-sm text-gray-400">
              Your referrals connect and start trading on BEAR MARKET
            </p>
          </div>
          <div>
            <div className="w-12 h-12 mb-4 rounded-xl bg-bear-purple-500/20 flex items-center justify-center text-2xl">
              3️⃣
            </div>
            <h3 className="font-semibold text-white mb-2">You Earn</h3>
            <p className="text-sm text-gray-400">
              Earn 50% of all trading fees from your referrals
            </p>
          </div>
        </div>

        <div className="mt-8 p-6 bg-bear-dark-700 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="text-2xl">💡</div>
            <div>
              <h3 className="font-semibold text-white mb-1">Phase 1: Manual Claims</h3>
              <p className="text-sm text-gray-400">
                Referral rewards will accumulate and can be claimed manually. We're building automatic payouts for Phase 2!
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Referred By (if applicable) */}
      {referralData.referredBy && (
        <div className="glass-card p-6 mt-8 text-center">
          <div className="text-2xl mb-2">🎉</div>
          <p className="text-gray-400">
            You were referred by <span className="text-bear-gold-400 font-mono">{referralData.referredBy}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default ReferralsPage;
