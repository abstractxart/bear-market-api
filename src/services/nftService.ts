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
    console.log(`[NFT Check] Checking wallet: ${address}`);

    // Fetch ALL account NFTs (with pagination support - up to 10,000 NFTs)
    let accountNfts: AccountNFT[] = [];
    let marker: any = undefined;
    let pageCount = 0;
    const MAX_PAGES = 25; // 25 pages × 400 NFTs = 10,000 max

    do {
      pageCount++;

      const response = await client.request({
        command: 'account_nfts',
        account: address,
        ledger_index: 'validated',
        limit: 400, // Max per request (XRPL limit)
        marker: marker,
      });

      accountNfts.push(...(response.result.account_nfts as AccountNFT[]));
      marker = response.result.marker;

      if (marker) {
        console.log(`[NFT Check] Page ${pageCount}: Fetching more NFTs... (got ${accountNfts.length} so far)`);
      }

      // Safety: prevent infinite loops
      if (pageCount >= MAX_PAGES) {
        console.warn(`[NFT Check] Reached max pages (${MAX_PAGES}), stopping pagination`);
        break;
      }
    } while (marker);

    console.log(`[NFT Check] Total NFTs found: ${accountNfts.length} (${pageCount} pages)`);

    // Log all unique issuers found
    const uniqueIssuers = [...new Set(accountNfts.map(nft => nft.Issuer))];
    console.log(`[NFT Check] Unique issuers:`, uniqueIssuers);
    console.log(`[NFT Check] Looking for Pixel BEAR issuer: ${BEAR_ECOSYSTEM.PIXEL_BEAR_ISSUER}`);

    // Filter for Pixel Bear NFTs
    const pixelBears: PixelBearNFT[] = accountNfts
      .filter((nft) => nft.Issuer === BEAR_ECOSYSTEM.PIXEL_BEAR_ISSUER)
      .map((nft) => ({
        tokenId: nft.NFTokenID,
        taxon: nft.NFTokenTaxon,
        isUltraRare: BEAR_ECOSYSTEM.ULTRA_RARE_TAXONS.includes(nft.NFTokenTaxon),
        imageUrl: nft.URI ? hexToString(nft.URI) : undefined,
      }));

    console.log(`[NFT Check] Pixel BEARs found: ${pixelBears.length}`);
    if (pixelBears.length > 0) {
      console.log(`[NFT Check] Taxons:`, pixelBears.map(pb => pb.taxon));
    }

    // Determine tier
    if (pixelBears.length === 0) {
      console.log(`[NFT Check] No Pixel BEARs found → tier: regular`);
      return {
        tier: 'regular',
        nfts: [],
        hasUltraRare: false,
      };
    }

    const hasUltraRare = pixelBears.some((nft) => nft.isUltraRare);
    const tier = hasUltraRare ? 'ultra_rare' : 'pixel_bear';
    console.log(`[NFT Check] Has Ultra Rare: ${hasUltraRare} → tier: ${tier}`);

    return {
      tier,
      nfts: pixelBears,
      hasUltraRare,
    };
  } catch (error: any) {
    console.error(`[NFT Check] Error:`, error);
    // Account might not exist or have no NFTs
    if (error.data?.error === 'actNotFound') {
      console.log(`[NFT Check] Account not found → tier: regular`);
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
