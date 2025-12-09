/**
 * BEAR Admin Dashboard
 * Comprehensive manual control and analytics for LP token burning
 * SECURE: All transactions signed on backend
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Client } from 'xrpl';

const TREASURY_WALLET = 'rBEARKfWJS1LYdg2g6t99BgbvpWY5pgMB9';
const BLACKHOLE_WALLET = 'rBEARmPLNA8CMu92P4vj95fkyCt1N4jrNm';
const BEAR_ISSUER = 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW';
const BEAR_CURRENCY = '4245415200000000000000000000000000000000'; // "BEAR" in hex format
const API_URL = import.meta.env.VITE_API_URL ||
  (import.meta.env.MODE === 'production'
    ? 'https://bear-market-api-production.up.railway.app/api'
    : 'http://localhost:3001/api');

interface WalletBalances {
  xrp: string;
  lpTokens: {
    balance: string;
    currency: string;
    issuer: string;
  } | null;
  bearTokens: string;
}

interface BlackholeBalances {
  xrp: string;
  lpTokens: {
    balance: string;
    currency: string;
    issuer: string;
  } | null;
}

interface AMMInfo {
  ammAccountId: string;
  amount: string;
  amount2: string;
  lpTokenBalance: string;
  tradingFee: number;
}

interface BurnStats {
  totalDeposits: number;
  totalBurns: number;
  totalXRPConverted: string;
  totalLPTokensBurned: string;
  lastDepositTime: string | null;
  lastBurnTime: string | null;
}

interface RecentBurn {
  id: number;
  action: 'deposit' | 'burn';
  tx_hash: string;
  xrp_amount: string | null;
  lp_token_amount: string;
  timestamp: string;
}

export default function BearDashboard() {
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [blackholeBalances, setBlackholeBalances] = useState<BlackholeBalances | null>(null);
  const [ammInfo, setAmmInfo] = useState<AMMInfo | null>(null);
  const [burnStats, setBurnStats] = useState<BurnStats | null>(null);
  const [recentBurns, setRecentBurns] = useState<RecentBurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch comprehensive data
  const fetchAllData = async () => {
    try {
      const client = new Client('wss://xrplcluster.com');
      await client.connect();

      // Fetch Treasury Wallet Data
      const treasuryInfo = await client.request({
        command: 'account_info',
        account: TREASURY_WALLET,
        ledger_index: 'validated',
      });
      const treasuryXRP = (parseFloat(treasuryInfo.result.account_data.Balance) / 1_000_000).toFixed(6);

      // Fetch Blackhole Wallet Data
      const blackholeInfo = await client.request({
        command: 'account_info',
        account: BLACKHOLE_WALLET,
        ledger_index: 'validated',
      });
      const blackholeXRP = (parseFloat(blackholeInfo.result.account_data.Balance) / 1_000_000).toFixed(6);

      // Fetch AMM Info
      const ammData = await client.request({
        command: 'amm_info',
        asset: {
          currency: BEAR_CURRENCY,
          issuer: BEAR_ISSUER,
        },
        asset2: {
          currency: 'XRP',
        },
      });

      const amm = ammData.result.amm;
      const lpToken = amm?.lp_token;

      // Get Treasury LP tokens and BEAR tokens
      let treasuryLPBalance = null;
      let treasuryBEARBalance = '0';
      if (lpToken) {
        const treasuryLines = await client.request({
          command: 'account_lines',
          account: TREASURY_WALLET,
          ledger_index: 'validated',
        });

        const lpLine = treasuryLines.result.lines.find(
          (line: any) =>
            line.currency === lpToken.currency &&
            line.account === lpToken.issuer
        );

        const bearLine = treasuryLines.result.lines.find(
          (line: any) =>
            line.currency === BEAR_CURRENCY &&
            line.account === BEAR_ISSUER
        );

        if (lpLine) {
          treasuryLPBalance = {
            balance: lpLine.balance,
            currency: lpToken.currency,
            issuer: lpToken.issuer,
          };
        }

        if (bearLine) {
          treasuryBEARBalance = bearLine.balance;
        }
      }

      // Get Blackhole LP tokens
      let blackholeLPBalance = null;
      if (lpToken) {
        const blackholeLines = await client.request({
          command: 'account_lines',
          account: BLACKHOLE_WALLET,
          ledger_index: 'validated',
        });

        const lpLine = blackholeLines.result.lines.find(
          (line: any) =>
            line.currency === lpToken.currency &&
            line.account === lpToken.issuer
        );

        if (lpLine) {
          blackholeLPBalance = {
            balance: lpLine.balance,
            currency: lpToken.currency,
            issuer: lpToken.issuer,
          };
        }
      }

      setBalances({
        xrp: treasuryXRP,
        lpTokens: treasuryLPBalance,
        bearTokens: treasuryBEARBalance,
      });

      setBlackholeBalances({
        xrp: blackholeXRP,
        lpTokens: blackholeLPBalance,
      });

      setAmmInfo({
        ammAccountId: amm.account,
        amount: typeof amm.amount === 'string' ? amm.amount : amm.amount.value,
        amount2: typeof amm.amount2 === 'string' ? amm.amount2 : amm.amount2.value,
        lpTokenBalance: amm.lp_token.value,
        tradingFee: amm.trading_fee,
      });

      await client.disconnect();

      // Fetch burn statistics from API
      try {
        const statsRes = await fetch(`${API_URL}/burn/stats`);
        const statsData = await statsRes.json();
        if (statsData.success) {
          setBurnStats(statsData.data);
        }

        const burnsRes = await fetch(`${API_URL}/burn/recent?limit=20`);
        const burnsData = await burnsRes.json();
        if (burnsData.success) {
          setRecentBurns(burnsData.data);
        }
      } catch (apiErr) {
        console.warn('API stats not available:', apiErr);
      }

      setLastUpdate(new Date());
    } catch (error: any) {
      console.error('Failed to fetch data:', error);
      setTxStatus(`❌ Error: ${error.message}`);
    }
  };

  useEffect(() => {
    fetchAllData();

    if (autoRefresh) {
      const interval = setInterval(fetchAllData, 30000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  // Manual burn LP tokens - backend call
  const handleBurnLP = async () => {
    setLoading(true);
    setTxStatus('🔄 Burning LP tokens...');

    try {
      const res = await fetch(`${API_URL}/admin/burn-lp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (data.success) {
        setTxStatus(`✅ ${data.data.message}`);
        setTimeout(() => fetchAllData(), 2000);
      } else {
        setTxStatus(`❌ ${data.error}`);
      }
    } catch (error: any) {
      setTxStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Manual convert XRP to LP - backend call
  const handleConvertXRP = async () => {
    setLoading(true);
    setTxStatus('🔄 Converting XRP to LP tokens...');

    try {
      const res = await fetch(`${API_URL}/admin/convert-xrp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();

      if (data.success) {
        setTxStatus(`✅ ${data.data.message}`);
        setTimeout(() => fetchAllData(), 2000);
      } else {
        setTxStatus(`❌ ${data.error}`);
      }
    } catch (error: any) {
      setTxStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculate metrics
  const totalLPLocked = blackholeBalances?.lpTokens
    ? parseFloat(blackholeBalances.lpTokens.balance)
    : 0;

  const percentageLocked = ammInfo
    ? ((totalLPLocked / parseFloat(ammInfo.lpTokenBalance)) * 100).toFixed(2)
    : '0.00';

  const timeSinceLastBurn = burnStats?.lastBurnTime
    ? Math.floor((Date.now() - new Date(burnStats.lastBurnTime).getTime()) / 1000 / 60)
    : null;

  const timeSinceLastDeposit = burnStats?.lastDepositTime
    ? Math.floor((Date.now() - new Date(burnStats.lastDepositTime).getTime()) / 1000 / 60)
    : null;

  // Dashboard
  return (
    <div className="min-h-screen pt-24 pb-32 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-5xl font-bold text-white mb-4">
            🐻 <span className="text-gradient-bear">BEAR</span> Admin Dashboard
          </h1>
          <p className="text-gray-400 mb-4">Complete Manual Control & Real-Time Analytics</p>

          {/* Controls */}
          <div className="flex items-center justify-center gap-6 text-sm">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                autoRefresh
                  ? 'bg-bear-green-500/20 text-bear-green-400 border border-bear-green-500/30'
                  : 'bg-bear-dark-800 text-gray-400 border border-bear-dark-600'
              }`}
            >
              {autoRefresh ? '✓ Auto-Refresh (30s)' : '○ Auto-Refresh Off'}
            </button>
            <button
              onClick={fetchAllData}
              className="px-4 py-2 bg-bear-dark-800 text-white rounded-lg hover:bg-bear-dark-700 transition-colors border border-bear-dark-600"
            >
              🔄 Refresh Now
            </button>
            {lastUpdate && (
              <span className="text-gray-500">
                Last update: {lastUpdate.toLocaleTimeString()}
              </span>
            )}
          </div>
        </motion.div>

        {/* CRITICAL STATS */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-orange-500/20 to-red-500/20 rounded-2xl p-6 border border-orange-500/30"
          >
            <div className="text-orange-400 text-sm mb-2 font-semibold">🔥 Total LP Locked Forever</div>
            <div className="text-4xl font-black text-white mb-1">
              {totalLPLocked.toFixed(2)}
            </div>
            <div className="text-xs text-gray-400">{percentageLocked}% of total LP supply</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="bg-gradient-to-br from-blue-500/20 to-bear-purple-500/20 rounded-2xl p-6 border border-blue-500/30"
          >
            <div className="text-blue-400 text-sm mb-2 font-semibold">💎 Total XRP Converted</div>
            <div className="text-4xl font-black text-white mb-1">
              {burnStats ? parseFloat(burnStats.totalXRPConverted).toFixed(2) : '0.00'}
            </div>
            <div className="text-xs text-gray-400">XRP → LP conversions</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-bearpark-gold/20 to-yellow-500/20 rounded-2xl p-6 border border-bearpark-gold/30"
          >
            <div className="text-bearpark-gold text-sm mb-2 font-semibold">📊 Total Burn Events</div>
            <div className="text-4xl font-black text-white mb-1">
              {burnStats ? burnStats.totalBurns : 0}
            </div>
            <div className="text-xs text-gray-400">{burnStats ? burnStats.totalDeposits : 0} deposits total</div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
            className="bg-gradient-to-br from-bear-green-500/20 to-green-500/20 rounded-2xl p-6 border border-bear-green-500/30"
          >
            <div className="text-bear-green-400 text-sm mb-2 font-semibold">⏱️ Last Burn Activity</div>
            <div className="text-4xl font-black text-white mb-1">
              {timeSinceLastBurn !== null ? `${timeSinceLastBurn}m` : 'N/A'}
            </div>
            <div className="text-xs text-gray-400">
              {timeSinceLastDeposit !== null ? `Last deposit: ${timeSinceLastDeposit}m ago` : 'No recent activity'}
            </div>
          </motion.div>
        </div>

        {/* WALLET BALANCES */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Treasury Wallet */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-bear-dark-800/80 to-bear-dark-900/80 rounded-2xl p-8 border border-bear-dark-600"
          >
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span>💰</span> Treasury Wallet
            </h2>

            <div className="space-y-4">
              <div className="bg-black/30 rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-2">XRP Balance</div>
                <div className="text-3xl font-bold text-white">
                  {balances ? balances.xrp : '...'} XRP
                </div>
              </div>

              <div className="bg-black/30 rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-2">LP Token Balance</div>
                <div className="text-3xl font-bold text-white">
                  {balances?.lpTokens ? parseFloat(balances.lpTokens.balance).toFixed(2) : '0.00'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {balances?.lpTokens?.currency}
                </div>
              </div>

              <div className="bg-black/30 rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-2">$BEAR Token Balance</div>
                <div className="text-3xl font-bold text-white">
                  {balances ? parseFloat(balances.bearTokens).toFixed(2) : '0.00'}
                </div>
              </div>

              <div className="text-xs text-gray-500 break-all">
                <a
                  href={`https://xrpscan.com/account/${TREASURY_WALLET}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  {TREASURY_WALLET}
                </a>
              </div>
            </div>
          </motion.div>

          {/* Blackhole Wallet */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl p-8 border border-orange-500/20"
          >
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <span>🔥</span> Blackhole Wallet (Keys Destroyed)
            </h2>

            <div className="space-y-4">
              <div className="bg-black/30 rounded-xl p-4">
                <div className="text-gray-400 text-sm mb-2">XRP Balance</div>
                <div className="text-3xl font-bold text-white">
                  {blackholeBalances ? blackholeBalances.xrp : '...'} XRP
                </div>
              </div>

              <div className="bg-black/30 rounded-xl p-4 border-2 border-orange-500/30">
                <div className="text-orange-400 text-sm mb-2 font-bold">🔒 LP Tokens LOCKED FOREVER</div>
                <div className="text-3xl font-bold text-white">
                  {blackholeBalances?.lpTokens ? parseFloat(blackholeBalances.lpTokens.balance).toFixed(2) : '0.00'}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {blackholeBalances?.lpTokens?.currency}
                </div>
                <div className="text-xs text-orange-400 mt-2 font-semibold">
                  ⚠️ IRRECOVERABLE - Keys permanently destroyed
                </div>
              </div>

              <div className="text-xs text-gray-500 break-all">
                <a
                  href={`https://xrpscan.com/account/${BLACKHOLE_WALLET}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300"
                >
                  {BLACKHOLE_WALLET}
                </a>
              </div>
            </div>
          </motion.div>
        </div>

        {/* AMM POOL STATISTICS */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-6 bg-gradient-to-br from-bear-purple-500/10 to-bearpark-gold/10 rounded-2xl p-8 border border-bear-purple-500/20"
        >
          <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <span>🏊</span> BEAR/XRP AMM Pool Metrics
          </h2>

          {ammInfo && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-black/20 rounded-xl p-4">
                <div className="text-gray-400 text-xs mb-1">BEAR in Pool</div>
                <div className="text-white text-xl font-bold">
                  {(parseFloat(ammInfo.amount) / 1_000_000).toFixed(2)}
                </div>
              </div>

              <div className="bg-black/20 rounded-xl p-4">
                <div className="text-gray-400 text-xs mb-1">XRP in Pool</div>
                <div className="text-white text-xl font-bold">
                  {(parseFloat(ammInfo.amount2) / 1_000_000).toFixed(2)}
                </div>
              </div>

              <div className="bg-black/20 rounded-xl p-4">
                <div className="text-gray-400 text-xs mb-1">Total LP Supply</div>
                <div className="text-white text-xl font-bold">
                  {parseFloat(ammInfo.lpTokenBalance).toFixed(2)}
                </div>
              </div>

              <div className="bg-black/20 rounded-xl p-4">
                <div className="text-gray-400 text-xs mb-1">Trading Fee</div>
                <div className="text-white text-xl font-bold">
                  {(ammInfo.tradingFee / 1000).toFixed(2)}%
                </div>
              </div>

              <div className="col-span-2 md:col-span-4 bg-black/20 rounded-xl p-4">
                <div className="text-gray-400 text-xs mb-2">AMM Account</div>
                <a
                  href={`https://xrpscan.com/account/${ammInfo.ammAccountId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-sm font-mono break-all"
                >
                  {ammInfo.ammAccountId}
                </a>
              </div>
            </div>
          )}
        </motion.div>

        {/* MANUAL BURN ACTIONS */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl p-8 border border-orange-500/20 mb-6"
        >
          <h2 className="text-2xl font-bold text-white mb-6">🎮 Manual Burn Controls</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={handleConvertXRP}
              disabled={loading || !balances || parseFloat(balances.xrp) <= 1.1}
              className="px-6 py-4 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              💎 Convert XRP → LP Tokens
            </button>

            <button
              onClick={handleBurnLP}
              disabled={loading || !balances?.lpTokens}
              className="px-6 py-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              🔥 Burn LP → Blackhole
            </button>
          </div>

          <div className="mt-4 p-4 bg-bear-green-500/10 rounded-lg border border-bear-green-500/30">
            <p className="text-xs text-bear-green-400 text-center font-semibold">
              🔒 Secure: All transactions signed on backend server
            </p>
          </div>
        </motion.div>

        {/* STATUS MESSAGE */}
        {txStatus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bear-dark-800/80 rounded-xl p-6 border border-bear-dark-600 mb-6"
          >
            <div className="text-white font-mono text-sm">{txStatus}</div>
          </motion.div>
        )}

        {/* RECENT BURN HISTORY */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-gradient-to-br from-bear-dark-800/80 to-bear-dark-900/80 rounded-2xl p-8 border border-bear-dark-600 mb-6"
        >
          <h2 className="text-2xl font-bold text-white mb-6">📜 Recent Burn History</h2>

          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {recentBurns.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No burn history yet</div>
            ) : (
              recentBurns.map((burn) => (
                <div
                  key={burn.id}
                  className="bg-black/30 rounded-lg p-4 hover:bg-black/40 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-3 py-1 rounded-lg text-sm font-bold ${
                          burn.action === 'deposit'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-orange-500/20 text-orange-300'
                        }`}
                      >
                        {burn.action === 'deposit' ? '💎 Deposit' : '🔥 Burn'}
                      </span>
                      <span className="text-white font-semibold">
                        {burn.action === 'deposit'
                          ? `${parseFloat(burn.xrp_amount || '0').toFixed(2)} XRP → LP`
                          : `${parseFloat(burn.lp_token_amount).toFixed(2)} LP Burned`}
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
                    {burn.tx_hash}
                  </a>
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* SYSTEM STATUS */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          <div className="bg-bear-dark-800/50 rounded-xl p-4 border border-bear-dark-600">
            <div className="text-gray-400 text-xs mb-2">Auto-Burn Service Status</div>
            <div className="text-bear-green-400 font-bold">
              {burnStats ? '🟢 Active' : '🟡 Unknown'}
            </div>
            <div className="text-xs text-gray-500 mt-1">Runs every 5 minutes</div>
          </div>

          <div className="bg-bear-dark-800/50 rounded-xl p-4 border border-bear-dark-600">
            <div className="text-gray-400 text-xs mb-2">Database Connection</div>
            <div className="text-bear-green-400 font-bold">
              {burnStats ? '🟢 Connected' : '🔴 Disconnected'}
            </div>
            <div className="text-xs text-gray-500 mt-1">PostgreSQL</div>
          </div>

          <div className="bg-bear-dark-800/50 rounded-xl p-4 border border-bear-dark-600">
            <div className="text-gray-400 text-xs mb-2">XRPL Network</div>
            <div className="text-bear-green-400 font-bold">
              🟢 Connected
            </div>
            <div className="text-xs text-gray-500 mt-1">wss://xrplcluster.com</div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
