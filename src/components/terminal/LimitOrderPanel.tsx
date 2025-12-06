import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Client } from 'xrpl';
import { useWallet } from '../../context/WalletContext';
import type { Token } from '../../types';
import { toXRPLCurrency } from '../../utils/currency';

interface LimitOrderPanelProps {
  token: Token;
  initialPrice?: string;
}

type OrderSide = 'buy' | 'sell';
type TimeInForce = 'gtc' | 'ioc' | 'fok';

export const LimitOrderPanel: React.FC<LimitOrderPanelProps> = ({ token, initialPrice }) => {
  const { wallet, signTransaction } = useWallet();

  const [side, setSide] = useState<OrderSide>('buy');
  const [price, setPrice] = useState(initialPrice || '');
  const [amount, setAmount] = useState('');
  const [timeInForce, setTimeInForce] = useState<TimeInForce>('gtc');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showOrders, setShowOrders] = useState(false);

  // Update price when initialPrice changes (from order book click)
  useEffect(() => {
    if (initialPrice) {
      setPrice(initialPrice);
    }
  }, [initialPrice]);

  // Calculate total
  const total = price && amount ? (parseFloat(price) * parseFloat(amount)).toFixed(6) : '0';

  // Get XRP balance
  const xrpBalance = wallet.isConnected ? parseFloat(wallet.balance.xrp) : 0;

  // Get token balance
  const tokenBalance = wallet.isConnected && wallet.balance.tokens
    ? wallet.balance.tokens.find(t =>
        t.token.currency === token.currency && t.token.issuer === token.issuer
      )?.balance || '0'
    : '0';

  const handleSubmit = async () => {
    if (!wallet.isConnected) {
      setError('Please connect your wallet');
      return;
    }

    if (!price || !amount || parseFloat(price) <= 0 || parseFloat(amount) <= 0) {
      setError('Please enter valid price and amount');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const client = new Client('wss://xrplcluster.com');
      await client.connect();

      // Build OfferCreate transaction
      // For BUY: We pay XRP, we get token
      // For SELL: We pay token, we get XRP
      const priceNum = parseFloat(price);
      const amountNum = parseFloat(amount);
      const xrpAmount = priceNum * amountNum;

      let offerTx: any = {
        TransactionType: 'OfferCreate',
        Account: wallet.address,
      };

      if (side === 'buy') {
        // We want to get tokens, paying XRP
        offerTx.TakerGets = {
          currency: toXRPLCurrency(token.currency),
          issuer: token.issuer,
          value: amount,
        };
        offerTx.TakerPays = String(Math.floor(xrpAmount * 1e6)); // XRP in drops
      } else {
        // We want to get XRP, paying tokens
        offerTx.TakerGets = String(Math.floor(xrpAmount * 1e6)); // XRP in drops
        offerTx.TakerPays = {
          currency: toXRPLCurrency(token.currency),
          issuer: token.issuer,
          value: amount,
        };
      }

      // Add flags based on time in force
      if (timeInForce === 'ioc') {
        offerTx.Flags = 0x00020000; // tfImmediateOrCancel
      } else if (timeInForce === 'fok') {
        offerTx.Flags = 0x00010000; // tfFillOrKill
      }

      // Autofill and sign
      const prepared = await client.autofill(offerTx);
      const signed = await signTransaction(prepared);

      // Submit
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta !== 'string') {
        const meta = result.result.meta as any;
        if (meta.TransactionResult === 'tesSUCCESS') {
          setSuccess(`Order placed successfully!`);
          setPrice('');
          setAmount('');
        } else {
          throw new Error(meta.TransactionResult);
        }
      }

      await client.disconnect();
    } catch (err: any) {
      console.error('[LimitOrder] Error:', err);
      setError(err.message || 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMaxClick = () => {
    if (side === 'buy' && price) {
      // Max buy: Use available XRP (reserve 2 for fees)
      const availableXrp = Math.max(0, xrpBalance - 2);
      const maxAmount = availableXrp / parseFloat(price);
      setAmount(maxAmount.toFixed(2));
    } else if (side === 'sell') {
      // Max sell: Use all token balance
      setAmount(tokenBalance);
    }
  };

  return (
    <div className="h-full flex flex-col rounded-xl bg-bear-dark-800 border border-bear-dark-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-bear-dark-700">
        <h3 className="text-sm font-bold text-white">Limit Order</h3>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setShowOrders(!showOrders)}
          className="text-[10px] text-bearpark-gold hover:underline"
        >
          {showOrders ? 'New Order' : 'My Orders'}
        </motion.button>
      </div>

      <AnimatePresence mode="wait">
        {showOrders ? (
          <motion.div
            key="orders"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 p-3"
          >
            <div className="text-center text-gray-500 text-sm py-8">
              <p>No open orders</p>
              <p className="text-xs mt-1">Your limit orders will appear here</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex-1 flex flex-col p-3 gap-3"
          >
            {/* Buy/Sell Toggle */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-bear-dark-900 rounded-lg">
              <button
                onClick={() => setSide('buy')}
                className={`py-2 text-sm font-bold rounded-md transition-all ${
                  side === 'buy'
                    ? 'bg-bear-green-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => setSide('sell')}
                className={`py-2 text-sm font-bold rounded-md transition-all ${
                  side === 'sell'
                    ? 'bg-red-500 text-white'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                SELL
              </button>
            </div>

            {/* Price Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-gray-500 uppercase">Price</label>
                <span className="text-[10px] text-gray-500">XRP</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-bear-dark-900 border border-bear-dark-600 rounded-lg text-white font-mono text-sm focus:border-bear-purple-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-gray-500 uppercase">Amount</label>
                <button
                  onClick={handleMaxClick}
                  className="text-[10px] text-bearpark-gold hover:underline"
                >
                  MAX
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 bg-bear-dark-900 border border-bear-dark-600 rounded-lg text-white font-mono text-sm focus:border-bear-purple-500 focus:outline-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
                  {token.symbol}
                </span>
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-gray-500">
                <span>Balance:</span>
                <span className="font-mono">
                  {side === 'buy'
                    ? `${xrpBalance.toFixed(2)} XRP`
                    : `${parseFloat(tokenBalance).toFixed(2)} ${token.symbol}`
                  }
                </span>
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between py-2 border-t border-bear-dark-600">
              <span className="text-xs text-gray-400">Total</span>
              <span className="text-sm font-mono text-white font-bold">
                {total} XRP
              </span>
            </div>

            {/* Time in Force */}
            <div>
              <label className="text-[10px] text-gray-500 uppercase mb-1 block">Time in Force</label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { value: 'gtc' as TimeInForce, label: 'GTC' },
                  { value: 'ioc' as TimeInForce, label: 'IOC' },
                  { value: 'fok' as TimeInForce, label: 'FOK' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTimeInForce(option.value)}
                    className={`py-1.5 text-[10px] font-semibold rounded transition-all ${
                      timeInForce === option.value
                        ? 'bg-bear-purple-500 text-white'
                        : 'bg-bear-dark-900 text-gray-400 hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-[9px] text-gray-600 mt-1">
                {timeInForce === 'gtc' && 'Good til Cancel - stays open until filled or canceled'}
                {timeInForce === 'ioc' && 'Immediate or Cancel - fills immediately or cancels'}
                {timeInForce === 'fok' && 'Fill or Kill - fills completely or cancels entirely'}
              </p>
            </div>

            {/* Error/Success Messages */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-red-400 text-xs"
                >
                  {error}
                </motion.p>
              )}
              {success && (
                <motion.p
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-bear-green-400 text-xs"
                >
                  {success}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={isSubmitting || !wallet.isConnected}
              className={`w-full py-3 rounded-xl font-bold text-sm transition-all ${
                !wallet.isConnected
                  ? 'bg-bear-dark-600 text-gray-400 cursor-not-allowed'
                  : side === 'buy'
                    ? 'bg-bear-green-500 hover:bg-bear-green-600 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
              } ${isSubmitting ? 'opacity-50 cursor-wait' : ''}`}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Placing Order...
                </span>
              ) : !wallet.isConnected ? (
                'Connect Wallet'
              ) : (
                `${side === 'buy' ? 'Buy' : 'Sell'} ${token.symbol}`
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
