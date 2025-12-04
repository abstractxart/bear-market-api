import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import type { Token, SwapQuote } from '../types';
import { XRP_TOKEN } from '../types';
import { getSwapQuote, executeSwap } from '../services/swapService';
import { formatFeePercent } from '../services/nftService';
import TokenSelector, { TokenIcon } from './TokenSelector';
import SlippageSlider from './SlippageSlider';

const SwapCard: React.FC = () => {
  const { wallet, xrplClient, signTransaction, refreshBalance } = useWallet();

  // Swap state
  const [inputToken, setInputToken] = useState<Token>(XRP_TOKEN);
  const [outputToken, setOutputToken] = useState<Token | null>(null);
  const [inputAmount, setInputAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [slippage, setSlippage] = useState(0.5);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState<'input' | 'output' | null>(null);

  // Debounced quote fetching
  useEffect(() => {
    if (!inputAmount || !outputToken || !xrplClient || parseFloat(inputAmount) <= 0) {
      setQuote(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const newQuote = await getSwapQuote(xrplClient, {
          inputToken,
          outputToken,
          inputAmount,
          slippage,
          feeTier: wallet.feeTier,
        });
        setQuote(newQuote);
      } catch (err: any) {
        setError(err.message);
        setQuote(null);
      } finally {
        setIsLoading(false);
      }
    }, 150); // FAST: 150ms debounce (OnTheDex API is quick!)

    return () => clearTimeout(timer);
  }, [inputAmount, inputToken, outputToken, slippage, wallet.feeTier, xrplClient]);

  // Swap tokens positions
  const handleFlipTokens = () => {
    if (outputToken) {
      setInputToken(outputToken);
      setOutputToken(inputToken);
      setInputAmount('');
      setQuote(null);
    }
  };

  // Execute swap
  const handleSwap = async () => {
    if (!quote || !xrplClient || !wallet.address) return;

    setIsSwapping(true);
    setError(null);

    try {
      const result = await executeSwap(
        xrplClient,
        quote,
        wallet.address,
        signTransaction
      );

      if (result.success) {
        // Success! Clear form and refresh balance
        setInputAmount('');
        setQuote(null);
        await refreshBalance();
        // TODO: Show success toast with tx hash
      } else {
        setError(result.error || 'Swap failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSwapping(false);
    }
  };

  // Set max amount
  const handleMaxClick = () => {
    if (inputToken.currency === 'XRP') {
      // Reserve 2 XRP for fees and reserve
      const max = Math.max(0, parseFloat(wallet.balance.xrp) - 2);
      setInputAmount(max.toFixed(6));
    } else {
      const tokenBalance = wallet.balance.tokens.find(
        (t) => t.token.currency === inputToken.currency && t.token.issuer === inputToken.issuer
      );
      if (tokenBalance) {
        setInputAmount(tokenBalance.balance);
      }
    }
  };

  // Token selection handlers
  const handleSelectInputToken = (token: Token) => {
    setInputToken(token);
    setShowTokenSelector(null);
    // If same as output, swap them
    if (outputToken && token.currency === outputToken.currency && token.issuer === outputToken.issuer) {
      setOutputToken(XRP_TOKEN);
    }
  };

  const handleSelectOutputToken = (token: Token) => {
    setOutputToken(token);
    setShowTokenSelector(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6 w-full max-w-md mx-auto"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white font-display">Swap</h2>
        <div className="flex items-center gap-2">
          {/* Fee tier badge */}
          <span className={`fee-badge-${wallet.feeTier === 'ultra_rare' ? 'ultra' : wallet.feeTier === 'pixel_bear' ? 'pixel' : 'regular'}`}>
            {formatFeePercent(wallet.feeTier)} fee
          </span>
          {/* Settings button */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-2 rounded-lg bg-bear-dark-600 hover:bg-bear-dark-500 transition-colors"
          >
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Settings dropdown */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <SlippageSlider value={slippage} onChange={setSlippage} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input token */}
      <div className="bg-bear-dark-800 rounded-xl p-4 mb-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">You pay</span>
          <button
            onClick={handleMaxClick}
            className="text-xs text-bear-purple-400 hover:text-bear-purple-300 font-medium"
          >
            MAX
          </button>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={inputAmount}
            onChange={(e) => {
              const val = e.target.value.replace(/[^0-9.]/g, '');
              if (val === '' || /^\d*\.?\d*$/.test(val)) {
                setInputAmount(val);
              }
            }}
            placeholder="0.00"
            className="token-input flex-1"
          />
          <button
            onClick={() => setShowTokenSelector('input')}
            className="flex items-center gap-2 bg-bear-dark-600 hover:bg-bear-dark-500 px-3 py-2 rounded-xl transition-colors"
          >
            <TokenIcon token={inputToken} size={24} />
            <span className="font-semibold">{inputToken.symbol}</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <div className="text-sm text-gray-500 mt-2">
          Balance: {inputToken.currency === 'XRP'
            ? parseFloat(wallet.balance.xrp).toLocaleString(undefined, { maximumFractionDigits: 4 })
            : (() => {
                const tb = wallet.balance.tokens.find(t => t.token.currency === inputToken.currency && t.token.issuer === inputToken.issuer);
                return tb ? parseFloat(tb.balance).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0';
              })()
          } {inputToken.symbol}
        </div>
      </div>

      {/* Swap direction button */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          onClick={handleFlipTokens}
          className="bg-bear-dark-700 hover:bg-bear-dark-600 border border-bear-dark-500 p-2 rounded-xl transition-all hover:scale-110"
        >
          <svg className="w-5 h-5 text-bear-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* Output token */}
      <div className="bg-bear-dark-800 rounded-xl p-4 mt-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">You receive</span>
          {quote && (
            <span className="text-xs text-bear-green-400">
              -{formatFeePercent(wallet.feeTier)} fee
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1">
            {isLoading ? (
              <div className="h-9 flex items-center">
                <div className="animate-pulse bg-bear-dark-600 h-8 w-32 rounded"></div>
              </div>
            ) : (
              <span className="token-input text-gray-300">
                {quote ? quote.outputAmount : '0.00'}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowTokenSelector('output')}
            className="flex items-center gap-2 bg-bear-dark-600 hover:bg-bear-dark-500 px-3 py-2 rounded-xl transition-colors"
          >
            {outputToken ? (
              <>
                <TokenIcon token={outputToken} size={24} />
                <span className="font-semibold">{outputToken.symbol}</span>
              </>
            ) : (
              <span className="text-bear-purple-400">Select token</span>
            )}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Quote details */}
      <AnimatePresence>
        {quote && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 p-4 bg-bear-dark-800/50 rounded-xl space-y-2 text-sm"
          >
            <div className="flex justify-between text-gray-400">
              <span>Rate</span>
              <span className="text-white">
                1 {inputToken.symbol} = {quote.exchangeRate} {outputToken?.symbol}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Fee ({formatFeePercent(wallet.feeTier)})</span>
              <span className="text-white">{quote.feeAmount} XRP</span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>Minimum received</span>
              <span className="text-white">{quote.minimumReceived} {outputToken?.symbol}</span>
            </div>
            {quote.priceImpact > 1 && (
              <div className="flex justify-between text-yellow-400">
                <span>Price impact</span>
                <span>{quote.priceImpact.toFixed(2)}%</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Swap button */}
      <motion.button
        onClick={handleSwap}
        disabled={!quote || isSwapping || !wallet.isConnected}
        className={`w-full mt-6 py-4 rounded-xl font-bold text-lg transition-all ${
          quote && wallet.isConnected
            ? 'btn-primary'
            : 'bg-bear-dark-600 text-gray-500 cursor-not-allowed'
        }`}
        whileTap={{ scale: 0.98 }}
      >
        {!wallet.isConnected
          ? 'Connect Wallet'
          : isSwapping
            ? 'Swapping...'
            : !outputToken
              ? 'Select a token'
              : !inputAmount
                ? 'Enter an amount'
                : quote
                  ? 'Swap'
                  : 'Loading...'}
      </motion.button>

      {/* Token selector modal */}
      <AnimatePresence>
        {showTokenSelector && (
          <TokenSelector
            onSelect={showTokenSelector === 'input' ? handleSelectInputToken : handleSelectOutputToken}
            onClose={() => setShowTokenSelector(null)}
            excludeToken={showTokenSelector === 'input' ? outputToken : inputToken}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SwapCard;
