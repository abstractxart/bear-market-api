import { useState, useRef } from 'react';
import { motion, useMotionValue } from 'framer-motion';

interface FloatingKickStreamProps {
  streamUrl?: string;
  onClose: () => void;
}

export const FloatingKickStream: React.FC<FloatingKickStreamProps> = ({
  streamUrl,
  onClose,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const constraintsRef = useRef(null);

  // Motion values for dragging
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  if (!streamUrl) return null;

  return (
    <>
      {/* Constraints container - viewport boundaries */}
      <div
        ref={constraintsRef}
        className="md:hidden fixed inset-0 pointer-events-none"
        style={{ zIndex: 9999 }}
      />

      {/* Floating Player */}
      <motion.div
        drag
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={constraintsRef}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
        style={{
          x,
          y,
          zIndex: 10000,
          touchAction: 'none',
        }}
        initial={{
          x: window.innerWidth - 200,
          y: window.innerHeight - 130,
          width: 180,
          height: 101
        }}
        animate={{
          width: 180,
          height: 101,
        }}
        className={`
          md:hidden fixed pointer-events-auto
          rounded-xl overflow-hidden
          shadow-2xl shadow-black/50
          border-2 border-bear-purple-500/50
          ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
        `}
      >
        {/* Stream iframe */}
        <div className="relative w-full h-full bg-black">
          <iframe
            src={streamUrl}
            className="w-full h-full"
            frameBorder="0"
            scrolling="no"
            allowFullScreen
            allow="autoplay; fullscreen"
            style={{ pointerEvents: isDragging ? 'none' : 'auto' }}
          />

          {/* Controls overlay */}
          <div className="absolute top-0 right-0 p-1 bg-gradient-to-b from-black/80 to-transparent">
            {/* Close button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-6 h-6 rounded-full bg-red-500/90 hover:bg-red-400 flex items-center justify-center text-white text-xs font-bold transition-colors touch-manipulation"
              style={{ pointerEvents: 'auto' }}
            >
              ✕
            </button>
          </div>

          {/* Kick branding */}
          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm">
            <span className="text-[#53fc18] text-[8px] font-bold">KICK</span>
          </div>
        </div>
      </motion.div>
    </>
  );
};
