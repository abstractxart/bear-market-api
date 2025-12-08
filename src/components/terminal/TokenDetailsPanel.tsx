import { motion } from 'framer-motion';
import type { Token } from '../../types';

interface TokenSocialLinks {
  discord?: string;
  twitter?: string;
  telegram?: string;
  website1?: string;
  website2?: string;
  website3?: string;
}

interface TokenDetailsData {
  trustlines: number;
  holders: number;
  rank: number;
  issuerFee: string;
  marketCap: number;
  circulatingSupply: number;
  totalSupply: number;
  socialLinks?: TokenSocialLinks;
}

interface TokenDetailsPanelProps {
  token: Token;
  data: TokenDetailsData;
  isIssuer: boolean;
  onEditClick?: () => void;
}

const formatNumber = (num: number): string => {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(2)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toFixed(0);
};

const formatCurrency = (num: number): string => {
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `$${(num / 1_000).toFixed(1)}K`;
  return `$${num.toFixed(0)}`;
};

export const TokenDetailsPanel: React.FC<TokenDetailsPanelProps> = ({
  token,
  data,
  isIssuer,
  onEditClick,
}) => {
  const socialIcons = {
    discord: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0a12.64 12.64 0 0 0-.617-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.078.078 0 0 0 .084-.028a14.09 14.09 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13.107 13.107 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10.2 10.2 0 0 0 .372-.292a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127a12.299 12.299 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028a19.839 19.839 0 0 0 6.002-3.03a.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418z"/>
      </svg>
    ),
    twitter: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
    telegram: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12a12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472c-.18 1.898-.962 6.502-1.36 8.627c-.168.9-.499 1.201-.82 1.23c-.696.065-1.225-.46-1.9-.902c-1.056-.693-1.653-1.124-2.678-1.8c-1.185-.78-.417-1.21.258-1.91c.177-.184 3.247-2.977 3.307-3.23c.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345c-.48.33-.913.49-1.302.48c-.428-.008-1.252-.241-1.865-.44c-.752-.245-1.349-.374-1.297-.789c.027-.216.325-.437.893-.663c3.498-1.524 5.83-2.529 6.998-3.014c3.332-1.386 4.025-1.627 4.476-1.635z"/>
      </svg>
    ),
    website: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
  };

  return (
    <div className="glass-card p-5">
      {/* Header with Token Info */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-bear-gold to-yellow-600 flex items-center justify-center text-2xl">
            🐻
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">{token.symbol} Details</h3>
            <p className="text-xs text-gray-500 font-mono">{token.name}</p>
          </div>
        </div>

        {isIssuer && (
          <motion.button
            onClick={onEditClick}
            className="px-3 py-1.5 rounded-lg bg-bear-purple-500 hover:bg-bear-purple-600 text-white text-xs font-bold transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            ✏️ Edit Token
          </motion.button>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {/* Trustlines */}
        <div className="bg-bear-dark-800/50 rounded-xl p-3 border border-bear-dark-600">
          <p className="text-2xl font-black text-bear-gold">{formatNumber(data.trustlines)}</p>
          <p className="text-xs text-gray-400 font-medium">Trustlines</p>
        </div>

        {/* Holders */}
        <div className="bg-bear-dark-800/50 rounded-xl p-3 border border-bear-dark-600">
          <p className="text-2xl font-black text-bear-green-400">{formatNumber(data.holders)}</p>
          <p className="text-xs text-gray-400 font-medium">Holders</p>
        </div>

        {/* Rank */}
        <div className="bg-bear-dark-800/50 rounded-xl p-3 border border-bear-dark-600">
          <p className="text-2xl font-black text-bear-purple-400">#{data.rank}</p>
          <p className="text-xs text-gray-400 font-medium">Rank</p>
        </div>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Issuer Fee */}
        <div className="bg-gradient-to-br from-bear-dark-800 to-bear-dark-700 rounded-xl p-3 border border-bear-dark-600">
          <p className="text-xl font-bold text-white">{data.issuerFee}</p>
          <p className="text-xs text-gray-400">Issuer Fee</p>
        </div>

        {/* Market Cap */}
        <div className="bg-gradient-to-br from-bear-dark-800 to-bear-dark-700 rounded-xl p-3 border border-bear-dark-600">
          <p className="text-xl font-bold text-white">{formatCurrency(data.marketCap)}</p>
          <p className="text-xs text-gray-400">Market Cap</p>
        </div>

        {/* Circulating Supply */}
        <div className="bg-gradient-to-br from-bear-dark-800 to-bear-dark-700 rounded-xl p-3 border border-bear-dark-600">
          <p className="text-xl font-bold text-white">{formatNumber(data.circulatingSupply)}</p>
          <p className="text-xs text-gray-400">Circulating Supply</p>
        </div>

        {/* Total Supply */}
        <div className="bg-gradient-to-br from-bear-dark-800 to-bear-dark-700 rounded-xl p-3 border border-bear-dark-600">
          <p className="text-xl font-bold text-white">{formatNumber(data.totalSupply)}</p>
          <p className="text-xs text-gray-400">Total Supply</p>
        </div>
      </div>

      {/* Social Links */}
      {data.socialLinks && Object.values(data.socialLinks).some(link => link) && (
        <div className="pt-4 border-t border-bear-dark-600">
          <p className="text-xs text-gray-500 font-bold mb-3 uppercase tracking-wide">Community</p>
          <div className="flex flex-wrap gap-2">
            {data.socialLinks.discord && (
              <a
                href={data.socialLinks.discord}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-bold transition-colors"
              >
                {socialIcons.discord}
                Discord
              </a>
            )}

            {data.socialLinks.twitter && (
              <a
                href={data.socialLinks.twitter}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black hover:bg-gray-900 text-white text-xs font-bold transition-colors"
              >
                {socialIcons.twitter}
                X
              </a>
            )}

            {data.socialLinks.telegram && (
              <a
                href={data.socialLinks.telegram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0088cc] hover:bg-[#006699] text-white text-xs font-bold transition-colors"
              >
                {socialIcons.telegram}
                Telegram
              </a>
            )}

            {data.socialLinks.website1 && (
              <a
                href={data.socialLinks.website1}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bear-purple-500 hover:bg-bear-purple-600 text-white text-xs font-bold transition-colors"
              >
                {socialIcons.website}
                Website
              </a>
            )}

            {data.socialLinks.website2 && (
              <a
                href={data.socialLinks.website2}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bear-gold hover:bg-yellow-600 text-black text-xs font-bold transition-colors"
              >
                {socialIcons.website}
                Docs
              </a>
            )}

            {data.socialLinks.website3 && (
              <a
                href={data.socialLinks.website3}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bear-green-500 hover:bg-bear-green-600 text-white text-xs font-bold transition-colors"
              >
                {socialIcons.website}
                Link
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
