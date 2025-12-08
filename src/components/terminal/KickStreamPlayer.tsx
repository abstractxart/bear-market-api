import { useState } from 'react';
import { motion } from 'framer-motion';

interface KickStreamPlayerProps {
  streamUrl?: string;
  isIssuer: boolean;
  onEditClick?: () => void;
}

export const KickStreamPlayer: React.FC<KickStreamPlayerProps> = ({
  streamUrl,
  isIssuer,
  onEditClick,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="glass-card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#53fc18] to-[#00d95f] flex items-center justify-center">
            <span className="text-lg">🎮</span>
          </div>
          <h3 className="text-base font-bold text-white">Live Stream</h3>
        </div>

        {isIssuer && (
          <motion.button
            onClick={onEditClick}
            className="px-3 py-1.5 rounded-lg bg-bear-purple-500 hover:bg-bear-purple-600 text-white text-xs font-bold transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {streamUrl ? '✏️ Edit Stream' : '➕ Add Kick Stream'}
          </motion.button>
        )}
      </div>

      {/* Stream Content */}
      {streamUrl ? (
        <div className="relative">
          <div
            className={`bg-bear-dark-800 rounded-xl overflow-hidden border border-bear-dark-600 transition-all duration-300 ${
              isExpanded ? 'aspect-video' : 'h-48'
            }`}
          >
            <iframe
              src={streamUrl}
              className="w-full h-full"
              frameBorder="0"
              scrolling="no"
              allowFullScreen
              allow="autoplay; fullscreen"
            />
          </div>

          {/* Expand/Collapse Button */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="absolute top-2 right-2 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-sm hover:bg-black/80 text-white text-xs font-bold transition-colors"
          >
            {isExpanded ? '🔽 Collapse' : '🔼 Expand'}
          </button>
        </div>
      ) : (
        <div className="bg-gradient-to-br from-bear-dark-800 to-bear-dark-700 rounded-xl border border-bear-dark-600 p-6 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-bear-dark-600 flex items-center justify-center">
              <span className="text-3xl">📹</span>
            </div>
            <p className="text-gray-400 text-sm font-medium">
              Creator hasn't enabled Kick stream yet
            </p>
            {!isIssuer && (
              <p className="text-xs text-gray-500">
                Live streams will appear here when the token creator adds one
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
