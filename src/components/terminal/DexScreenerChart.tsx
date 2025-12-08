import type { Token } from '../../types';

interface DexScreenerChartProps {
  token: Token;
}

export const DexScreenerChart: React.FC<DexScreenerChartProps> = ({ token }) => {
  // Convert currency code to hex (XRPL standard format)
  // If currency is NOT 40 chars (not already hex), convert ASCII to hex
  const currencyHex = token.currency.length !== 40
    ? token.currency.split('').map(c => c.charCodeAt(0).toString(16)).join('').padEnd(40, '0')
    : token.currency;

  // Build DexScreener embed URL - Format: currencyHex.issuerLowercase_xrp
  // Add quote=XRP to default to XRP pricing instead of USD
  const embedUrl = `https://dexscreener.com/xrpl/${currencyHex}.${token.issuer.toLowerCase()}_xrp?embed=1&theme=dark&trades=0&info=0&quote=XRP`;

  // Debug logging
  console.log('[DexScreener] Chart URL:', {
    currency: token.currency,
    currencyHex,
    issuer: token.issuer,
    embedUrl,
  });

  return (
    <div className="glass-card h-full flex flex-col overflow-hidden">
      <iframe
        src={embedUrl}
        className="w-full h-full border-0"
        title="DexScreener Chart"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        style={{ minHeight: '400px' }}
        onLoad={() => console.log('[DexScreener] iframe loaded')}
        onError={(e) => console.error('[DexScreener] iframe error:', e)}
      />
    </div>
  );
};
