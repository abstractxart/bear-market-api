import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Token } from '../../types';
import type { TokenMetadata } from '../../services/tokenMetadataService';
import { updateTokenMetadata } from '../../services/tokenMetadataService';

interface TokenAdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: Token;
  walletAddress: string;
  currentMetadata: TokenMetadata;
  onSuccess: () => void;
}

export const TokenAdminModal: React.FC<TokenAdminModalProps> = ({
  isOpen,
  onClose,
  token,
  walletAddress,
  currentMetadata,
  onSuccess,
}) => {
  const [kickStreamUrl, setKickStreamUrl] = useState('');
  const [discordUrl, setDiscordUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [telegramUrl, setTelegramUrl] = useState('');
  const [website1Url, setWebsite1Url] = useState('');
  const [website2Url, setWebsite2Url] = useState('');
  const [website3Url, setWebsite3Url] = useState('');
  const [description, setDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isConnectingKick, setIsConnectingKick] = useState(false);

  // Load current metadata
  useEffect(() => {
    if (isOpen && currentMetadata) {
      setKickStreamUrl(currentMetadata.kick_stream_url || '');
      setDiscordUrl(currentMetadata.discord_url || '');
      setTwitterUrl(currentMetadata.twitter_url || '');
      setTelegramUrl(currentMetadata.telegram_url || '');
      setWebsite1Url(currentMetadata.website1_url || '');
      setWebsite2Url(currentMetadata.website2_url || '');
      setWebsite3Url(currentMetadata.website3_url || '');
      setDescription(currentMetadata.description || '');
      setLogoUrl(currentMetadata.logo_url || '');
    }
  }, [isOpen, currentMetadata]);

  const handleConnectKick = async () => {
    if (!token.issuer) return;

    setIsConnectingKick(true);
    setError(null);

    try {
      const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

      // Step 1: Initiate OAuth flow
      const response = await fetch(`${API_BASE_URL}/kick/oauth/initiate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: walletAddress,
          currency: token.currency,
          issuer: token.issuer,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to initiate Kick OAuth');
      }

      const data = await response.json();

      // Step 2: Open OAuth URL in popup window
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;

      const popup = window.open(
        data.auth_url,
        'KickOAuth',
        `width=${width},height=${height},left=${left},top=${top},popup=1`
      );

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }

      console.log('[Kick OAuth] Popup opened, waiting for message...');

      // Step 3: Listen for callback message from popup
      const handleMessage = (event: MessageEvent) => {
        console.log('[Kick OAuth] Message from:', event.origin, 'Type:', event.data?.type, 'Data:', event.data);

        // Only accept messages from backend (port 3001)
        if (event.origin !== 'http://localhost:3001') {
          return;
        }

        if (event.data?.type === 'kick_oauth_success') {
          console.log('[Kick OAuth] SUCCESS! Channel:', event.data.kick_channel);

          // OAuth successful, set the stream URL
          const kickUsername = event.data.kick_channel;
          setKickStreamUrl(`https://player.kick.com/${kickUsername}`);
          setIsConnectingKick(false);

          window.removeEventListener('message', handleMessage);

          // Close popup if still open
          if (popup && !popup.closed) {
            popup.close();
          }
        } else if (event.data?.type === 'kick_oauth_error') {
          console.log('[Kick OAuth] ERROR:', event.data.error);

          setError(event.data.error || 'Failed to connect Kick channel');
          setIsConnectingKick(false);
          window.removeEventListener('message', handleMessage);

          // Close popup if still open
          if (popup && !popup.closed) {
            popup.close();
          }
        }
      };

      window.addEventListener('message', handleMessage);

      // Timeout after 5 minutes
      const timeout = setTimeout(() => {
        console.log('[Kick OAuth] Timeout reached');
        if (popup && !popup.closed) {
          popup.close();
        }
        setIsConnectingKick(false);
        window.removeEventListener('message', handleMessage);
      }, 5 * 60 * 1000);

      // Poll popup to detect manual close
      const pollInterval = setInterval(() => {
        if (popup.closed) {
          console.log('[Kick OAuth] Popup was closed manually');
          clearInterval(pollInterval);
          clearTimeout(timeout);
          setIsConnectingKick(false);
          window.removeEventListener('message', handleMessage);
        }
      }, 500);

    } catch (err) {
      console.error('[Kick OAuth] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect Kick channel');
      setIsConnectingKick(false);
    }
  };

  const handleSave = async () => {
    if (!token.issuer) return;

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    const result = await updateTokenMetadata(
      token.currency,
      token.issuer,
      walletAddress,
      {
        kick_stream_url: kickStreamUrl || undefined,
        discord_url: discordUrl || undefined,
        twitter_url: twitterUrl || undefined,
        telegram_url: telegramUrl || undefined,
        website1_url: website1Url || undefined,
        website2_url: website2Url || undefined,
        website3_url: website3Url || undefined,
        description: description || undefined,
        logo_url: logoUrl || undefined,
      }
    );

    setIsSaving(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } else {
      setError(result.error || 'Failed to save changes');
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
          transition={{ type: 'spring', duration: 0.5 }}
          className="relative w-full max-w-2xl rounded-2xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Tri-gradient border */}
          <div className="absolute inset-0 rounded-2xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow opacity-80"></div>

          {/* Inner content */}
          <div className="relative m-[2px] rounded-[14px] bg-bear-dark-900 p-6 overflow-y-auto max-h-[calc(90vh-4px)] custom-scrollbar">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-bear-purple-500 to-bear-purple-700 flex items-center justify-center">
                  <span className="text-2xl">⚙️</span>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Edit Token</h2>
                  <p className="text-sm text-gray-400">{token.symbol} Settings</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white rounded-lg bg-bear-dark-800 hover:bg-bear-dark-700 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <div className="space-y-5">
              {/* Kick Stream */}
              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  🎮 Kick Stream
                </label>
                {kickStreamUrl ? (
                  <div className="bg-bear-dark-800 border border-bear-dark-600 rounded-xl p-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-[#53fc18] to-[#00d95f] flex items-center justify-center">
                        <span className="text-xl">✓</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-bold">Kick Channel Connected</p>
                        <p className="text-xs text-gray-400 truncate">{kickStreamUrl}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-bear-dark-800/50 border border-bear-dark-700 rounded-xl p-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-bear-dark-700 flex items-center justify-center">
                        <span className="text-xl text-gray-500">🎮</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-gray-400 font-bold">No Kick Stream Connected</p>
                        <p className="text-xs text-gray-500">Click button below to verify your channel</p>
                      </div>
                    </div>
                  </div>
                )}
                <motion.button
                  type="button"
                  onClick={handleConnectKick}
                  disabled={isConnectingKick}
                  className="w-full px-6 py-4 rounded-xl bg-gradient-to-r from-[#53fc18] to-[#00d95f] hover:from-[#00d95f] hover:to-[#53fc18] text-white font-bold transition-all shadow-lg shadow-[#53fc18]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  whileHover={!isConnectingKick ? { scale: 1.02 } : {}}
                  whileTap={!isConnectingKick ? { scale: 0.98 } : {}}
                >
                  {isConnectingKick ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Connecting to Kick...
                    </span>
                  ) : kickStreamUrl ? '🔄 Change Kick Channel' : '➕ Connect Kick Channel'}
                </motion.button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Authenticate with your Kick account to display your live stream
                </p>
              </div>

              {/* Social Links */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-white mb-2">
                    💬 Discord
                  </label>
                  <input
                    type="url"
                    value={discordUrl}
                    onChange={(e) => setDiscordUrl(e.target.value)}
                    placeholder="https://discord.gg/..."
                    className="w-full px-4 py-3 rounded-xl bg-bear-dark-800 border border-bear-dark-600 text-white placeholder-gray-500 focus:border-bear-purple-500 focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-white mb-2">
                    𝕏 Twitter/X
                  </label>
                  <input
                    type="url"
                    value={twitterUrl}
                    onChange={(e) => setTwitterUrl(e.target.value)}
                    placeholder="https://x.com/..."
                    className="w-full px-4 py-3 rounded-xl bg-bear-dark-800 border border-bear-dark-600 text-white placeholder-gray-500 focus:border-bear-purple-500 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  ✈️ Telegram
                </label>
                <input
                  type="url"
                  value={telegramUrl}
                  onChange={(e) => setTelegramUrl(e.target.value)}
                  placeholder="https://t.me/..."
                  className="w-full px-4 py-3 rounded-xl bg-bear-dark-800 border border-bear-dark-600 text-white placeholder-gray-500 focus:border-bear-purple-500 focus:outline-none transition-colors"
                />
              </div>

              {/* Websites */}
              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  🌐 Website 1
                </label>
                <input
                  type="url"
                  value={website1Url}
                  onChange={(e) => setWebsite1Url(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded-xl bg-bear-dark-800 border border-bear-dark-600 text-white placeholder-gray-500 focus:border-bear-gold focus:outline-none transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-white mb-2">
                    📚 Website 2 (Docs)
                  </label>
                  <input
                    type="url"
                    value={website2Url}
                    onChange={(e) => setWebsite2Url(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-3 rounded-xl bg-bear-dark-800 border border-bear-dark-600 text-white placeholder-gray-500 focus:border-bear-gold focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-white mb-2">
                    🔗 Website 3
                  </label>
                  <input
                    type="url"
                    value={website3Url}
                    onChange={(e) => setWebsite3Url(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-4 py-3 rounded-xl bg-bear-dark-800 border border-bear-dark-600 text-white placeholder-gray-500 focus:border-bear-gold focus:outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Changes saved successfully!
              </div>
            )}

            {/* Save Button */}
            <motion.button
              onClick={handleSave}
              disabled={isSaving}
              className="relative w-full mt-6 py-4 rounded-full font-bold text-lg text-white overflow-hidden group transition-all disabled:opacity-50"
              whileHover={!isSaving ? { scale: 1.02 } : {}}
              whileTap={!isSaving ? { scale: 0.98 } : {}}
            >
              {/* Spinning tri-gradient border */}
              <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></span>
              {/* Glass inner */}
              <span className="absolute inset-[2px] rounded-full bg-bear-dark-800/80 backdrop-blur-xl group-hover:bg-bear-dark-700/80 transition-colors"></span>
              {/* Content */}
              <span className="relative z-10 flex items-center justify-center gap-2">
                {isSaving ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : 'Save Changes'}
              </span>
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
