import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface KickVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (kickUsername: string, embedUrl: string) => void;
  walletAddress: string;
  currency: string;
  issuer: string;
}

interface KickChannelInfo {
  verified: boolean;
  username: string;
  display_name: string;
  channel_url: string;
  embed_url: string;
  followers: number;
  is_live: boolean;
}

export const KickVerificationModal: React.FC<KickVerificationModalProps> = ({
  isOpen,
  onClose,
  onVerified,
  walletAddress,
  currency,
  issuer,
}) => {
  const [kickUsername, setKickUsername] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [channelInfo, setChannelInfo] = useState<KickChannelInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

  const handleVerifyChannel = async () => {
    if (!kickUsername.trim()) {
      setError('Please enter your Kick username');
      return;
    }

    setIsVerifying(true);
    setError(null);
    setChannelInfo(null);

    try {
      const response = await fetch(`${API_BASE_URL}/kick/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          kick_username: kickUsername.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Channel not found');
      }

      const data: KickChannelInfo = await response.json();
      setChannelInfo(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify channel');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleConfirm = () => {
    if (!channelInfo) return;
    onVerified(channelInfo.username, channelInfo.embed_url);
    onClose();
  };

  const handleOAuthLogin = async () => {
    try {
      // Initiate Kick OAuth flow
      const response = await fetch(`${API_BASE_URL}/kick/oauth/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wallet_address: walletAddress,
          currency,
          issuer,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate OAuth');
      }

      const data = await response.json();

      // Redirect to Kick OAuth
      window.location.href = data.auth_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start OAuth');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="relative w-full max-w-md rounded-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tri-gradient border */}
          <div className="absolute inset-0 rounded-2xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow opacity-80"></div>

          {/* Inner content */}
          <div className="relative m-[2px] rounded-[14px] bg-bear-dark-900 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#53fc18] to-[#00d95f] flex items-center justify-center">
                  <span className="text-2xl">🎮</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Verify Kick Channel</h2>
                  <p className="text-sm text-gray-400">Prove you own this channel</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white rounded-lg bg-bear-dark-800 hover:bg-bear-dark-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* OAuth Button (Recommended) */}
            <div className="mb-6">
              <div className="p-4 bg-gradient-to-br from-[#53fc18]/10 to-[#00d95f]/10 rounded-xl border border-[#53fc18]/30 mb-4">
                <p className="text-sm text-gray-300 mb-3">
                  <strong className="text-[#53fc18]">Recommended:</strong> Sign in with your Kick account for instant verification
                </p>

                <motion.button
                  onClick={handleOAuthLogin}
                  className="relative w-full py-3 rounded-full font-bold text-white overflow-hidden group"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="absolute inset-0 rounded-full bg-gradient-to-r from-[#53fc18] to-[#00d95f]"></span>
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    🎮 Sign in with Kick
                  </span>
                </motion.button>
              </div>

              {/* Divider */}
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-px bg-bear-dark-600"></div>
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-bear-dark-900 text-xs text-gray-500 uppercase tracking-wide">
                    Or verify manually
                  </span>
                </div>
              </div>
            </div>

            {/* Manual Verification */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  Kick Username
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={kickUsername}
                    onChange={(e) => setKickUsername(e.target.value)}
                    placeholder="yourname"
                    className="flex-1 px-4 py-3 rounded-xl bg-bear-dark-800 border border-bear-dark-600 text-white placeholder-gray-500 focus:border-[#53fc18] focus:outline-none transition-colors"
                    onKeyPress={(e) => e.key === 'Enter' && handleVerifyChannel()}
                  />
                  <motion.button
                    onClick={handleVerifyChannel}
                    disabled={isVerifying || !kickUsername.trim()}
                    className="px-6 py-3 rounded-xl bg-bear-purple-500 hover:bg-bear-purple-600 text-white font-bold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isVerifying ? '...' : 'Verify'}
                  </motion.button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Enter your Kick username (e.g., "bearswap" from kick.com/bearswap)
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              {/* Channel Info */}
              {channelInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl bg-gradient-to-br from-[#53fc18]/10 to-[#00d95f]/10 border border-[#53fc18]/30"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-white">{channelInfo.display_name}</h3>
                        {channelInfo.is_live && (
                          <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-xs font-bold">
                            🔴 LIVE
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-400">@{channelInfo.username}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {channelInfo.followers.toLocaleString()} followers
                      </p>
                    </div>
                    <svg className="w-8 h-8 text-[#53fc18]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>

                  <a
                    href={channelInfo.channel_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#53fc18] hover:text-[#00d95f] transition-colors flex items-center gap-1"
                  >
                    Visit Channel
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>

                  <motion.button
                    onClick={handleConfirm}
                    className="relative w-full mt-4 py-3 rounded-full font-bold text-white overflow-hidden"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></span>
                    <span className="absolute inset-[2px] rounded-full bg-bear-dark-800/80 backdrop-blur-xl"></span>
                    <span className="relative z-10">✓ Confirm & Add Channel</span>
                  </motion.button>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
