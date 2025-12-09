/**
 * BEAR Admin Dashboard
 * Manual control for LP token burning
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Client, Wallet } from 'xrpl';

const TREASURY_WALLET = 'rBEARKfWJS1LYdg2g6t99BgbvpWY5pgMB9';
const BLACKHOLE_WALLET = 'rBEARmPLNA8CMu92P4vj95fkyCt1N4jrNm';
const BEAR_AMM_ACCOUNT = 'rwE86ARLXfyKYCVmFpk511ddYfs5Fh6Vcp';

interface WalletBalances {
  xrp: string;
  lpTokens: {
    balance: string;
    currency: string;
    issuer: string;
  } | null;
}

export default function BearDashboard() {
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<string>('');
  const [walletSecret, setWalletSecret] = useState('');
  const [showSecretInput, setShowSecretInput] = useState(false);

  // Fetch wallet balances
  const fetchBalances = async () => {
    try {
      const client = new Client('wss://xrplcluster.com');
      await client.connect();

      // Get XRP balance
      const accountInfo = await client.request({
        command: 'account_info',
        account: TREASURY_WALLET,
        ledger_index: 'validated',
      });

      const xrpBalance = (parseFloat(accountInfo.result.account_data.Balance) / 1_000_000).toFixed(6);

      // Get AMM LP token info
      const ammInfo = await client.request({
        command: 'amm_info',
        asset: {
          currency: 'BEAR',
          issuer: 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW',
        },
        asset2: {
          currency: 'XRP',
        },
      });

      const lpToken = ammInfo.result.amm?.lp_token;

      // Get LP token balance
      let lpBalance = null;
      if (lpToken) {
        const accountLines = await client.request({
          command: 'account_lines',
          account: TREASURY_WALLET,
          ledger_index: 'validated',
        });

        const lpLine = accountLines.result.lines.find(
          (line: any) =>
            line.currency === lpToken.currency &&
            line.account === lpToken.issuer
        );

        if (lpLine) {
          lpBalance = {
            balance: lpLine.balance,
            currency: lpToken.currency,
            issuer: lpToken.issuer,
          };
        }
      }

      setBalances({
        xrp: xrpBalance,
        lpTokens: lpBalance,
      });

      await client.disconnect();
    } catch (error: any) {
      console.error('Failed to fetch balances:', error);
      setTxStatus(`Error: ${error.message}`);
    }
  };

  useEffect(() => {
    fetchBalances();
  }, []);

  // Manual burn LP tokens
  const handleBurnLP = async () => {
    if (!walletSecret) {
      setTxStatus('❌ Please enter wallet secret first');
      setShowSecretInput(true);
      return;
    }

    if (!balances?.lpTokens) {
      setTxStatus('❌ No LP tokens to burn');
      return;
    }

    setLoading(true);
    setTxStatus('🔄 Burning LP tokens...');

    try {
      const client = new Client('wss://xrplcluster.com');
      await client.connect();

      const wallet = Wallet.fromSeed(walletSecret);

      // Create payment to blackhole
      const paymentTx: any = {
        TransactionType: 'Payment',
        Account: wallet.address,
        Destination: BLACKHOLE_WALLET,
        Amount: {
          currency: balances.lpTokens.currency,
          issuer: balances.lpTokens.issuer,
          value: balances.lpTokens.balance,
        },
        Memos: [
          {
            Memo: {
              MemoData: Buffer.from('BEAR LP Token Manual Burn - Admin Dashboard', 'utf8').toString('hex').toUpperCase(),
              MemoType: Buffer.from('BEARSwap/ManualBurn', 'utf8').toString('hex').toUpperCase(),
            },
          },
        ],
      };

      const prepared = await client.autofill(paymentTx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta === 'object') {
        const meta = result.result.meta as any;

        if (meta.TransactionResult === 'tesSUCCESS') {
          setTxStatus(`✅ Successfully burned ${parseFloat(balances.lpTokens.balance).toFixed(2)} LP tokens!`);
          setTimeout(() => fetchBalances(), 2000);
        } else {
          setTxStatus(`❌ Transaction failed: ${meta.TransactionResult}`);
        }
      }

      await client.disconnect();
    } catch (error: any) {
      console.error('Burn failed:', error);
      setTxStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Manual convert XRP to LP
  const handleConvertXRP = async () => {
    if (!walletSecret) {
      setTxStatus('❌ Please enter wallet secret first');
      setShowSecretInput(true);
      return;
    }

    if (!balances || parseFloat(balances.xrp) <= 1.1) {
      setTxStatus('❌ Insufficient XRP balance (need > 1.1 XRP)');
      return;
    }

    setLoading(true);
    setTxStatus('🔄 Converting XRP to LP tokens...');

    try {
      const client = new Client('wss://xrplcluster.com');
      await client.connect();

      const wallet = Wallet.fromSeed(walletSecret);
      const depositAmount = (parseFloat(balances.xrp) - 1.1).toFixed(6);

      // Create AMM deposit
      const ammDepositTx: any = {
        TransactionType: 'AMMDeposit',
        Account: wallet.address,
        Asset: {
          currency: 'BEAR',
          issuer: 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW',
        },
        Asset2: {
          currency: 'XRP',
        },
        Amount: (parseFloat(depositAmount) * 1_000_000).toString(),
        Flags: 0x00080000, // tfSingleAsset
      };

      const prepared = await client.autofill(ammDepositTx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta === 'object') {
        const meta = result.result.meta as any;

        if (meta.TransactionResult === 'tesSUCCESS') {
          setTxStatus(`✅ Successfully converted ${depositAmount} XRP to LP tokens!`);
          setTimeout(() => fetchBalances(), 2000);
        } else {
          setTxStatus(`❌ Transaction failed: ${meta.TransactionResult}`);
        }
      }

      await client.disconnect();
    } catch (error: any) {
      console.error('Convert failed:', error);
      setTxStatus(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 pb-32 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-white mb-4">
            🐻 <span className="text-gradient-bear">BEAR</span> Admin Dashboard
          </h1>
          <p className="text-gray-400">Manual control for LP token burning</p>
        </motion.div>

        {/* Wallet Secret Input */}
        {showSecretInput && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-bear-dark-800/80 rounded-2xl p-6 border border-bear-dark-600"
          >
            <h3 className="text-white font-bold mb-4">🔐 Enter Treasury Wallet Secret</h3>
            <input
              type="password"
              placeholder="Enter seed (s...)"
              value={walletSecret}
              onChange={(e) => setWalletSecret(e.target.value)}
              className="w-full px-4 py-3 bg-bear-dark-900 border border-bear-dark-600 rounded-lg text-white focus:outline-none focus:border-bearpark-gold"
            />
            <button
              onClick={() => setShowSecretInput(false)}
              className="mt-3 px-4 py-2 bg-bear-green-500 text-white rounded-lg hover:bg-bear-green-600 transition-colors"
            >
              Save & Continue
            </button>
          </motion.div>
        )}

        {/* Balances */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-gradient-to-br from-bear-dark-800/80 to-bear-dark-900/80 rounded-2xl p-8 border border-bear-dark-600 mb-6"
        >
          <h2 className="text-2xl font-bold text-white mb-6">💰 Treasury Wallet Balances</h2>

          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div className="bg-black/30 rounded-xl p-6">
              <div className="text-gray-400 text-sm mb-2">XRP Balance</div>
              <div className="text-4xl font-bold text-white">
                {balances ? balances.xrp : '...'} XRP
              </div>
            </div>

            <div className="bg-black/30 rounded-xl p-6">
              <div className="text-gray-400 text-sm mb-2">LP Token Balance</div>
              <div className="text-4xl font-bold text-white">
                {balances?.lpTokens ? parseFloat(balances.lpTokens.balance).toFixed(2) : '0.00'}
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-500">
            <div>Treasury: {TREASURY_WALLET}</div>
            <div>Blackhole: {BLACKHOLE_WALLET}</div>
          </div>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-gradient-to-br from-orange-500/10 to-red-500/10 rounded-2xl p-8 border border-orange-500/20 mb-6"
        >
          <h2 className="text-2xl font-bold text-white mb-6">🔥 Manual Burn Actions</h2>

          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={handleConvertXRP}
              disabled={loading || !balances || parseFloat(balances.xrp) <= 1.1}
              className="px-6 py-4 bg-blue-500 text-white rounded-xl font-bold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              💎 Convert XRP → LP
            </button>

            <button
              onClick={handleBurnLP}
              disabled={loading || !balances?.lpTokens}
              className="px-6 py-4 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              🔥 Burn LP → Blackhole
            </button>
          </div>

          {!walletSecret && (
            <button
              onClick={() => setShowSecretInput(true)}
              className="mt-4 w-full px-6 py-3 bg-bearpark-gold/20 text-bearpark-gold rounded-xl font-semibold hover:bg-bearpark-gold/30 transition-colors"
            >
              🔐 Enter Wallet Secret to Enable Actions
            </button>
          )}
        </motion.div>

        {/* Status */}
        {txStatus && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-bear-dark-800/80 rounded-xl p-6 border border-bear-dark-600"
          >
            <div className="text-white font-mono text-sm">{txStatus}</div>
          </motion.div>
        )}

        {/* Refresh */}
        <div className="text-center mt-6">
          <button
            onClick={fetchBalances}
            className="px-4 py-2 bg-bear-dark-800 text-white rounded-lg hover:bg-bear-dark-700 transition-colors text-sm"
          >
            🔄 Refresh Balances
          </button>
        </div>
      </div>
    </div>
  );
}
