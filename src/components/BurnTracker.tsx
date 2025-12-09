/**
 * Burn Tracker Component
 * Displays real-time LP token burning for fee transparency
 */

import React, { useEffect, useState } from 'react';

interface BurnTransaction {
  id: number;
  action: 'deposit' | 'burn';
  tx_hash: string;
  xrp_amount: string | null;
  lp_token_amount: string;
  lp_token_currency: string;
  lp_token_issuer: string;
  timestamp: string;
}

interface BurnStats {
  totalDeposits: number;
  totalBurns: number;
  totalXRPConverted: string;
  totalLPTokensBurned: string;
  lastDepositTime: string | null;
  lastBurnTime: string | null;
  treasuryWallet: string;
  blackholeWallet: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function BurnTracker() {
  const [stats, setStats] = useState<BurnStats | null>(null);
  const [recentBurns, setRecentBurns] = useState<BurnTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBurnData = async () => {
    try {
      // Fetch stats
      const statsRes = await fetch(`${API_URL}/burn/stats`);
      const statsData = await statsRes.json();

      if (statsData.success) {
        setStats(statsData.data);
      }

      // Fetch recent burns
      const burnsRes = await fetch(`${API_URL}/burn/recent?limit=10`);
      const burnsData = await burnsRes.json();

      if (burnsData.success) {
        setRecentBurns(burnsData.data);
      }

      setLoading(false);
    } catch (err: any) {
      console.error('Failed to fetch burn data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBurnData();

    // Refresh every 30 seconds
    const interval = setInterval(fetchBurnData, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl p-6 border border-orange-500/20">
        <div className="text-center text-gray-400">Loading burn data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl p-6 border border-orange-500/20">
        <div className="text-center text-red-400">Error loading burn data</div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl p-6 border border-orange-500/20">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="text-3xl">🔥</div>
        <div>
          <h2 className="text-2xl font-bold text-white">LP Token Auto-Burn</h2>
          <p className="text-sm text-gray-400">100% Transparent Fee Burning</p>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-black/20 rounded-xl p-4">
            <div className="text-gray-400 text-xs mb-1">Total XRP Converted</div>
            <div className="text-white text-xl font-bold">
              {parseFloat(stats.totalXRPConverted).toFixed(2)} XRP
            </div>
          </div>

          <div className="bg-black/20 rounded-xl p-4">
            <div className="text-gray-400 text-xs mb-1">Total LP Burned</div>
            <div className="text-white text-xl font-bold">
              {parseFloat(stats.totalLPTokensBurned).toFixed(2)}
            </div>
          </div>

          <div className="bg-black/20 rounded-xl p-4">
            <div className="text-gray-400 text-xs mb-1">Deposits</div>
            <div className="text-white text-xl font-bold">{stats.totalDeposits}</div>
          </div>

          <div className="bg-black/20 rounded-xl p-4">
            <div className="text-gray-400 text-xs mb-1">Burns</div>
            <div className="text-white text-xl font-bold">{stats.totalBurns}</div>
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="bg-black/20 rounded-xl p-4 mb-6">
        <h3 className="text-white font-semibold mb-2">How It Works:</h3>
        <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
          <li>Swap fees collected in XRP go to treasury wallet</li>
          <li>XRP automatically converted to BEAR/XRP LP tokens</li>
          <li>LP tokens instantly sent to blackholed wallet (permanently locked)</li>
          <li>Process runs every 5 minutes - fully automated</li>
        </ol>
      </div>

      {/* Recent Transactions */}
      <div>
        <h3 className="text-white font-semibold mb-3">Recent Burns</h3>
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {recentBurns.length === 0 ? (
            <div className="text-center text-gray-400 py-4">No burns yet</div>
          ) : (
            recentBurns.map((burn) => (
              <div
                key={burn.id}
                className="bg-black/30 rounded-lg p-3 hover:bg-black/40 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                      burn.action === 'deposit'
                        ? 'bg-blue-500/20 text-blue-300'
                        : 'bg-orange-500/20 text-orange-300'
                    }`}>
                      {burn.action === 'deposit' ? '💎 Deposit' : '🔥 Burn'}
                    </span>
                    <span className="text-white font-medium">
                      {burn.action === 'deposit'
                        ? `${parseFloat(burn.xrp_amount || '0').toFixed(2)} XRP → LP`
                        : `${parseFloat(burn.lp_token_amount).toFixed(2)} LP Burned`
                      }
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(burn.timestamp).toLocaleString()}
                  </span>
                </div>
                <a
                  href={`https://xrpscan.com/tx/${burn.tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 font-mono"
                >
                  {burn.tx_hash.substring(0, 16)}...
                </a>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Wallet Links */}
      {stats && (
        <div className="mt-6 pt-4 border-t border-gray-700">
          <div className="text-xs text-gray-400 space-y-1">
            <div className="flex items-center gap-2">
              <span>Treasury:</span>
              <a
                href={`https://xrpscan.com/account/${stats.treasuryWallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-mono"
              >
                {stats.treasuryWallet}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span>Blackhole:</span>
              <a
                href={`https://xrpscan.com/account/${stats.blackholeWallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 font-mono"
              >
                {stats.blackholeWallet}
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
