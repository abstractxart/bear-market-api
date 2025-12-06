import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import type { Token, SwapQuote } from '../types';
import { XRP_TOKEN } from '../types';
import { getSwapQuote, executeSwap, BEAR_TREASURY_WALLET } from '../services/swapService';
import { formatFeePercent, getFeeRate } from '../services/nftService';
import { findTokenBalance } from '../utils/currency';
import TokenSelector, { TokenIcon } from './TokenSelector';
import SlippageSlider from './SlippageSlider';
import { SecureWalletConnect } from './SecureWalletConnect';
import { getKeyManager } from '../security/SecureKeyManager';

// Shorten address for display
const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

interface SwapCardProps {
  presetOutputToken?: Token;
}

const SwapCard: React.FC<SwapCardProps> = ({ presetOutputToken }) => {
  const { wallet, xrplClient, signTransaction, refreshBalance, connectWithSecret } = useWallet();

  // Swap state
  const [inputToken, setInputToken] = useState<Token>(XRP_TOKEN);
  const [outputToken, setOutputToken] = useState<Token | null>(presetOutputToken || null);
  const [inputAmount, setInputAmount] = useState('');
  const [outputAmount, setOutputAmount] = useState('');
  const [editingField, setEditingField] = useState<'input' | 'output'>('input');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [slippage, setSlippage] = useState(0.5);

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapStatus, setSwapStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showTokenSelector, setShowTokenSelector] = useState<'input' | 'output' | null>(null);
  const [showWalletConnect, setShowWalletConnect] = useState(false);
  const [swapSuccess, setSwapSuccess] = useState<{
    swapHash?: string;
    feeHash?: string;
    feeHashes?: string[];
    feeCount?: number;
  } | null>(null);

  // Update output token when preset changes (for terminal mode)
  useEffect(() => {
    if (presetOutputToken) {
      setOutputToken(presetOutputToken);
    }
  }, [presetOutputToken]);

  // Handle wallet connection
  const handleWalletConnect = async () => {
    try {
      const keyManager = getKeyManager();
      const secret = await keyManager.getSecretForSigning();
      await connectWithSecret(secret);
      setShowWalletConnect(false);
    } catch (error) {
      console.error('[SwapCard] Failed to connect wallet:', error);
    }
  };

  // Debounced quote fetching - supports both input and output editing
  useEffect(() => {
    const hasAmount = editingField === 'input'
      ? (inputAmount && parseFloat(inputAmount) > 0)
      : (outputAmount && parseFloat(outputAmount) > 0);

    if (!hasAmount || !outputToken || !xrplClient) {
      setQuote(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (editingField === 'input') {
          // User is editing input - get quote normally
          const newQuote = await getSwapQuote(xrplClient, {
            inputToken,
            outputToken,
            inputAmount,
            slippage,
            feeTier: wallet.feeTier,
          });
          setQuote(newQuote);
          // Update output amount to match quote
          setOutputAmount(newQuote.outputAmount);
        } else {
          // User is editing output - need to calculate reverse
          // First, get a reference quote for 1 unit to get the exchange rate
          const refQuote = await getSwapQuote(xrplClient, {
            inputToken,
            outputToken,
            inputAmount: '1',
            slippage,
            feeTier: wallet.feeTier,
          });

          // Calculate required input based on desired output
          const rate = parseFloat(refQuote.exchangeRate);
          if (rate > 0) {
            const desiredOutput = parseFloat(outputAmount);
            // Account for fees - we need slightly more input
            const feeMultiplier = 1 + getFeeRate(wallet.feeTier);
            const estimatedInput = (desiredOutput / rate) * feeMultiplier;
            const roundedInput = estimatedInput.toFixed(6);

            // Now get actual quote with this input
            const newQuote = await getSwapQuote(xrplClient, {
              inputToken,
              outputToken,
              inputAmount: roundedInput,
              slippage,
              feeTier: wallet.feeTier,
            });
            setQuote(newQuote);
            // Update input amount to show calculated value
            setInputAmount(roundedInput);
          }
        }
      } catch (err: any) {
        setError(err.message);
        setQuote(null);
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [inputAmount, outputAmount, editingField, inputToken, outputToken, slippage, wallet.feeTier, xrplClient]);

  // Swap tokens positions (XRP stays on one side - this is always valid after our enforcement)
  const handleFlipTokens = () => {
    if (outputToken) {
      // Safety: If somehow neither is XRP (should never happen), reset to XRP
      if (inputToken.currency !== 'XRP' && outputToken.currency !== 'XRP') {
        setInputToken(XRP_TOKEN);
        setOutputToken(null);
        setInputAmount('');
        setOutputAmount('');
        setEditingField('input');
        setQuote(null);
        return;
      }
      setInputToken(outputToken);
      setOutputToken(inputToken);
      // Swap the amounts too
      setInputAmount(outputAmount);
      setOutputAmount(inputAmount);
      setEditingField('input');
      setQuote(null);
    }
  };

  // Execute swap
  const handleSwap = async () => {
    if (!quote || !xrplClient || !wallet.address) return;

    setIsSwapping(true);
    setSwapStatus('');
    setError(null);
    setSwapSuccess(null);

    try {
      const result = await executeSwap(
        xrplClient,
        quote,
        wallet.address,
        signTransaction,
        (status) => setSwapStatus(status) // Status callback
      );

      if (result.success) {
        // Success! Show results and clear form
        setSwapSuccess({
          swapHash: result.swapTxHash,
          feeHash: result.feeTxHash,
          feeHashes: result.feeTxHashes || [],
          feeCount: result.feeCount || 1,
        });
        setInputAmount('');
        setOutputAmount('');
        setEditingField('input');
        setQuote(null);
        await refreshBalance();

        // NOTE: With Option A (fee splitting at swap time), we don't need to
        // call api.recordTrade() because referral fees are paid directly during
        // the swap execution (50% to referrer, 50% to treasury).
        // The backend trade recording is only needed for Option B (hot wallet payouts).

        // Auto-clear success message after 10 seconds
        setTimeout(() => setSwapSuccess(null), 10000);
      } else {
        setError(result.error || 'Swap failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSwapping(false);
      setSwapStatus('');
    }
  };

  // Set max amount
  const handleMaxClick = () => {
    if (inputToken.currency === 'XRP') {
      // Reserve 2 XRP for fees and reserve
      const max = Math.max(0, parseFloat(wallet.balance.xrp) - 2);
      setInputAmount(max.toFixed(6));
    } else {
      // Use findTokenBalance to handle hex-encoded currency codes (e.g., RLUSD)
      const tokenBalance = findTokenBalance(
        wallet.balance.tokens,
        inputToken.currency,
        inputToken.issuer
      );
      if (tokenBalance) {
        setInputAmount(tokenBalance.balance);
      }
    }
  };

  // Token selection handlers - XRP MUST be on one side of every trade!
  const handleSelectInputToken = (token: Token) => {
    setInputToken(token);
    setShowTokenSelector(null);

    // ENFORCE: XRP must be on one side of every trade
    // If user selects non-XRP as input, force output to XRP
    if (token.currency !== 'XRP') {
      setOutputToken(XRP_TOKEN);
    }
    // If same as output, set output to XRP
    else if (outputToken && token.currency === outputToken.currency && token.issuer === outputToken.issuer) {
      setOutputToken(null); // Let user pick again
    }
  };

  const handleSelectOutputToken = (token: Token) => {
    // ENFORCE: XRP must be on one side of every trade
    // If user selects non-XRP as output, force input to XRP
    if (token.currency !== 'XRP') {
      setInputToken(XRP_TOKEN);
    }

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
          {/* Fee tier badge - rounded pill, purple */}
          <span className="px-3 py-1 rounded-full text-sm font-bold bg-bear-purple-500 text-white">
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
      <div className="bg-bear-dark-800 rounded-3xl p-4 mb-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">You pay</span>
          <button
            onClick={handleMaxClick}
            className="text-xs font-black px-3 py-1 rounded-full"
            style={{ background: 'var(--color-bearpark-gold)', color: '#000' }}
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
                setEditingField('input');
              }
            }}
            onFocus={() => setEditingField('input')}
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
                // Use findTokenBalance to handle hex-encoded currency codes (e.g., RLUSD)
                const tb = findTokenBalance(wallet.balance.tokens, inputToken.currency, inputToken.issuer);
                return tb ? parseFloat(tb.balance).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0';
              })()
          } {inputToken.symbol}
        </div>
      </div>

      {/* Swap direction button */}
      <div className="flex justify-center -my-2 relative z-10">
        <button
          onClick={handleFlipTokens}
          className="p-3 rounded-2xl transition-all hover:scale-110 border-2"
          style={{
            background: 'var(--color-bearpark-gold)',
            borderColor: 'rgba(0,0,0,0.2)',
            boxShadow: '0 4px 0 #9b7a0d'
          }}
        >
          <svg className="w-5 h-5" style={{ color: '#000' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        </button>
      </div>

      {/* Output token */}
      <div className="bg-bear-dark-800 rounded-3xl p-4 mt-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-gray-400">You receive</span>
          {quote && (
            <span className="text-xs text-bear-green-400">
              -{formatFeePercent(wallet.feeTier)} fee
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            {isLoading && editingField === 'input' ? (
              <div className="h-9 flex items-center">
                <div className="animate-pulse bg-bear-dark-600 h-8 w-32 rounded"></div>
              </div>
            ) : (
              <input
                type="text"
                value={outputAmount}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9.]/g, '');
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setOutputAmount(val);
                    setEditingField('output');
                  }
                }}
                onFocus={() => setEditingField('output')}
                placeholder="0.00"
                className="token-input flex-1 w-full"
                disabled={!outputToken}
              />
            )}
            {isLoading && editingField === 'output' && (
              <div className="absolute right-0 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-bear-purple-500/30 border-t-bear-purple-500 rounded-full animate-spin" />
              </div>
            )}
          </div>
          <button
            onClick={() => setShowTokenSelector('output')}
            className="flex items-center gap-2 px-4 py-2 rounded-full transition-all font-black text-sm"
            style={{
              background: outputToken ? 'var(--color-bear-dark-600)' : 'var(--color-bearpark-gold)',
              color: outputToken ? 'white' : '#000'
            }}
          >
            {outputToken ? (
              <>
                <TokenIcon token={outputToken} size={24} />
                <span className="font-semibold">{outputToken.symbol}</span>
              </>
            ) : (
              <span>Select token</span>
            )}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {outputToken && (
          <div className="text-sm text-gray-500 mt-2">
            Balance: {outputToken.currency === 'XRP'
              ? parseFloat(wallet.balance.xrp).toLocaleString(undefined, { maximumFractionDigits: 4 })
              : (() => {
                  const tb = findTokenBalance(wallet.balance.tokens, outputToken.currency, outputToken.issuer);
                  return tb ? parseFloat(tb.balance).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0';
                })()
            } {outputToken.symbol}
          </div>
        )}
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
            <div className="flex justify-between text-gray-400 text-xs">
              <span>Fee goes to</span>
              <a
                href={`https://xrpscan.com/account/${BEAR_TREASURY_WALLET}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-bear-purple-400 hover:text-bear-purple-300 underline"
              >
                BEAR Treasury ({shortenAddress(BEAR_TREASURY_WALLET)})
              </a>
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

      {/* Swap status */}
      {isSwapping && swapStatus && (
        <div className="mt-4 p-3 bg-bear-purple-500/10 border border-bear-purple-500/30 rounded-xl text-bear-purple-400 text-sm flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-bear-purple-400/30 border-t-bear-purple-400 rounded-full animate-spin" />
          {swapStatus}
        </div>
      )}

      {/* Success message */}
      {swapSuccess && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-sm"
        >
          <div className="flex items-center gap-2 text-green-400 font-semibold mb-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Swap Successful!
          </div>
          {swapSuccess.swapHash && (
            <div className="text-gray-400 text-xs mb-1">
              Swap TX:{' '}
              <a
                href={`https://xrpscan.com/tx/${swapSuccess.swapHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-bear-purple-400 hover:underline"
              >
                {swapSuccess.swapHash.slice(0, 8)}...{swapSuccess.swapHash.slice(-8)}
              </a>
            </div>
          )}
          {/* Fee Transaction Display */}
          {swapSuccess.feeCount === 2 && swapSuccess.feeHashes && swapSuccess.feeHashes.length === 2 ? (
            // Referral Split: Show both fee transactions
            <>
              <div className="text-gray-400 text-xs mb-1">
                Fee TX #1:{' '}
                <a
                  href={`https://xrpscan.com/tx/${swapSuccess.feeHashes[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bear-purple-400 hover:underline"
                >
                  {swapSuccess.feeHashes[0].slice(0, 8)}...{swapSuccess.feeHashes[0].slice(-8)}
                </a>
                {' → '}
                <span className="text-yellow-400">Referral Reward</span>
              </div>
              <div className="text-gray-400 text-xs">
                Fee TX #2:{' '}
                <a
                  href={`https://xrpscan.com/tx/${swapSuccess.feeHashes[1]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-bear-purple-400 hover:underline"
                >
                  {swapSuccess.feeHashes[1].slice(0, 8)}...{swapSuccess.feeHashes[1].slice(-8)}
                </a>
                {' → '}
                <a
                  href={`https://xrpscan.com/account/${BEAR_TREASURY_WALLET}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:underline"
                >
                  BEAR Treasury
                </a>
              </div>
            </>
          ) : swapSuccess.feeHash ? (
            // No Referral: Show single fee transaction
            <div className="text-gray-400 text-xs">
              Fee TX:{' '}
              <a
                href={`https://xrpscan.com/tx/${swapSuccess.feeHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-bear-purple-400 hover:underline"
              >
                {swapSuccess.feeHash.slice(0, 8)}...{swapSuccess.feeHash.slice(-8)}
              </a>
              {' → '}
              <a
                href={`https://xrpscan.com/account/${BEAR_TREASURY_WALLET}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-green-400 hover:underline"
              >
                BEAR Treasury
              </a>
            </div>
          ) : null}
        </motion.div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Swap button */}
      {!wallet.isConnected ? (
        /* Connect Wallet - Purple 3D clicky button */
        <motion.button
          onClick={() => setShowWalletConnect(true)}
          className="w-full mt-6 py-4 rounded-xl font-bold text-lg text-white transition-all"
          style={{
            background: '#8B5CF6',
            boxShadow: '0 6px 0 #6D28D9, 0 8px 15px rgba(139, 92, 246, 0.4)',
            transform: 'translateY(0)',
          }}
          whileHover={{
            boxShadow: '0 4px 0 #6D28D9, 0 6px 10px rgba(139, 92, 246, 0.4)',
            transform: 'translateY(2px)',
          }}
          whileTap={{
            boxShadow: '0 2px 0 #6D28D9, 0 3px 5px rgba(139, 92, 246, 0.4)',
            transform: 'translateY(4px)',
          }}
        >
          Connect Wallet
        </motion.button>
      ) : (
        /* Swap button - normal state */
        <motion.button
          onClick={handleSwap}
          disabled={!quote || isSwapping}
          className={`w-full mt-6 py-4 rounded-xl font-bold text-lg transition-all ${
            quote
              ? 'btn-primary'
              : 'bg-bear-dark-600 text-gray-500 cursor-not-allowed'
          }`}
          whileTap={{ scale: 0.98 }}
        >
          {isSwapping
            ? 'Swapping...'
            : !outputToken
              ? 'Select a token'
              : (!inputAmount && !outputAmount)
                ? 'Enter an amount'
                : quote
                  ? 'Swap'
                  : 'Loading...'}
        </motion.button>
      )}

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

      {/* Wallet connect modal */}
      <SecureWalletConnect
        isOpen={showWalletConnect}
        onClose={() => setShowWalletConnect(false)}
        onConnect={handleWalletConnect}
      />
    </motion.div>
  );
};

export default SwapCard;
