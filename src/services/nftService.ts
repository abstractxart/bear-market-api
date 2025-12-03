import { Client } from 'xrpl';
import type { FeeTier, PixelBearNFT } from '../types';
import type { AccountNFT } from '../types/xrpl';
import { BEAR_ECOSYSTEM } from '../types/xrpl';

interface NFTCheckResult {
  tier: FeeTier;
  nfts: PixelBearNFT[];
  hasUltraRare: boolean;
}

/**
 * Check if an address holds Pixel Bear NFTs and determine fee tier
 *
 * Fee Tiers:
 * - Regular: 0.589% (no Pixel Bear)
 * - Pixel Bear: 0.485% (holds any Pixel Bear)
 * - Ultra Rare: 0.321% (holds Ultra Rare Pixel Bear)
 */
export async function checkPixelBearNFTs(
  client: Client,
  address: string
): Promise<NFTCheckResult> {
  try {
    // Fetch account NFTs
    const response = await client.request({
      command: 'account_nfts',
      account: address,
      ledger_index: 'validated',
    });

    const accountNfts = response.result.account_nfts as AccountNFT[];

    // Filter for Pixel Bear NFTs
    const pixelBears: PixelBearNFT[] = accountNfts
      .filter((nft) => nft.Issuer === BEAR_ECOSYSTEM.PIXEL_BEAR_ISSUER)
      .map((nft) => ({
        tokenId: nft.NFTokenID,
        taxon: nft.NFTokenTaxon,
        isUltraRare: BEAR_ECOSYSTEM.ULTRA_RARE_TAXONS.includes(nft.NFTokenTaxon),
        imageUrl: nft.URI ? hexToString(nft.URI) : undefined,
      }));

    // Determine tier
    if (pixelBears.length === 0) {
      return {
        tier: 'regular',
        nfts: [],
        hasUltraRare: false,
      };
    }

    const hasUltraRare = pixelBears.some((nft) => nft.isUltraRare);

    return {
      tier: hasUltraRare ? 'ultra_rare' : 'pixel_bear',
      nfts: pixelBears,
      hasUltraRare,
    };
  } catch (error: any) {
    // Account might not exist or have no NFTs
    if (error.data?.error === 'actNotFound') {
      return {
        tier: 'regular',
        nfts: [],
        hasUltraRare: false,
      };
    }
    throw error;
  }
}

/**
 * Convert hex string to UTF-8 string (for NFT URI)
 */
function hexToString(hex: string): string {
  try {
    const bytes = new Uint8Array(
      hex.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );
    return new TextDecoder().decode(bytes);
  } catch {
    return '';
  }
}

/**
 * Get the display name for a fee tier
 */
export function getFeeTierName(tier: FeeTier): string {
  switch (tier) {
    case 'ultra_rare':
      return 'Ultra Rare';
    case 'pixel_bear':
      return 'Pixel Bear';
    default:
      return 'Regular';
  }
}

/**
 * Get the fee rate for a tier
 */
export function getFeeRate(tier: FeeTier): number {
  switch (tier) {
    case 'ultra_rare':
      return 0.00321; // 0.321%
    case 'pixel_bear':
      return 0.00485; // 0.485%
    default:
      return 0.00589; // 0.589%
  }
}

/**
 * Format fee as percentage string
 */
export function formatFeePercent(tier: FeeTier): string {
  switch (tier) {
    case 'ultra_rare':
      return '0.321%';
    case 'pixel_bear':
      return '0.485%';
    default:
      return '0.589%';
  }
}
