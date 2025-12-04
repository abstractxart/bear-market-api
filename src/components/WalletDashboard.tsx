/**
 * BEAR MARKET - Wallet Dashboard
 *
 * Full wallet view similar to Magnetic X showing:
 * - Token balances with prices
 * - LP positions
 * - NFT collection
 * - Transaction history
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWallet } from '../context/WalletContext';
import { getTokenIconUrls } from '../services/tokenService';

interface WalletDashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'tokens' | 'lps' | 'nfts' | 'history';

interface NFTMetadata {
  name?: string;
  description?: string;
  image?: string;
  attributes?: Array<{ trait_type: string; value: string }>;
}

interface NFTData {
  id: string;
  name: string;
  image: string;
  issuer: string;
  taxon: number;
  uri?: string;
  metadata?: NFTMetadata;
}

interface NFTCollection {
  issuer: string;
  name: string;
  image: string;
  nfts: NFTData[];
  taxon?: number;
}

interface TxHistory {
  type: 'sent' | 'received' | 'swap';
  to?: string;
  from?: string;
  amount: string;
  currency: string;
  timestamp: string;
  hash: string;
}

export const WalletDashboard = ({ isOpen, onClose }: WalletDashboardProps) => {
  const { wallet, xrplClient, disconnect } = useWallet();
  const [activeTab, setActiveTab] = useState<TabType>('tokens');
  const [nfts, setNfts] = useState<NFTData[]>([]);
  const [collections, setCollections] = useState<NFTCollection[]>([]);
  const [expandedCollection, setExpandedCollection] = useState<string | null>(null);
  const [selectedNFT, setSelectedNFT] = useState<NFTData | null>(null);
  const [history, setHistory] = useState<TxHistory[]>([]);
  const [loadingNfts, setLoadingNfts] = useState(false);
  const [nftLoadProgress, setNftLoadProgress] = useState<string>('');
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  // Known collection names on XRPL - use issuer:taxon format for specific collections
  const KNOWN_COLLECTIONS: Record<string, string> = {
    // BEAR collections - different taxons = different collections!
    'rBEARbo4Prn33894evmvYcAf9yAQjp4VJF:0': 'Ultra Rare BEARS',  // Taxon 0 = Ultra Rare
    'rBEARbo4Prn33894evmvYcAf9yAQjp4VJF:1': 'Pixel BEARS',       // Taxon 1 = Pixel Bears
    'rBEARbo4Prn33894evmvYcAf9yAQjp4VJF:2': 'Pixel BEARS',       // Taxon 2 = Pixel Bears
    // Other known collections
    'rPdvC6ccq8hCdPKSPJkPmyZ4Mi1oG2FFkT': 'xPunks',
    'rJzaNhosn5sgL3H5MxkFGpN6PEoAffPnhL': 'Bored Apes XRP',
    'rDzn8G4bH6bKrj4K2Wy2n2pKQViuxFQnxx': 'XRP Punks',
    'rDCgaaSBAWYfsxUYhCk1n26Na7x8PQGmkP': 'XRPL Apes',
    'rfx2R4sCFrXmfYKrX8r3C1bKP1cLJLiJXa': 'onXRP Collectibles',
  };

  // Extract collection name from NFT metadata
  const extractCollectionNameFromMetadata = (nftList: NFTData[]): string | null => {
    for (const nft of nftList) {
      if (!nft.metadata) continue;

      // Check for explicit collection field (common in NFT standards)
      const meta = nft.metadata as any;
      if (meta.collection) {
        if (typeof meta.collection === 'string') return meta.collection;
        if (meta.collection.name) return meta.collection.name;
      }
      if (meta.collection_name) return meta.collection_name;
      if (meta.collectionName) return meta.collectionName;

      // Try to extract from NFT name pattern like "CollectionName #123" or "CollectionName 123"
      if (nft.name) {
        // Match patterns like "Something #123" or "Something 123" or "Something_123"
        const match = nft.name.match(/^(.+?)[\s_]*[#]?\d+$/);
        if (match && match[1]) {
          const extracted = match[1].trim();
          // Only use if it's a reasonable collection name (not just a hash)
          if (extracted.length > 2 && extracted.length < 50 && !/^[a-f0-9]+$/i.test(extracted)) {
            return extracted;
          }
        }
      }
    }
    return null;
  };

  // Convert hex to string
  const hexToString = (hex: string): string => {
    try {
      let str = '';
      for (let i = 0; i < hex.length; i += 2) {
        const byte = parseInt(hex.substr(i, 2), 16);
        if (byte !== 0) str += String.fromCharCode(byte);
      }
      return str;
    } catch {
      return '';
    }
  };

  // IPFS gateways - try faster ones first
  const IPFS_GATEWAYS = [
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://dweb.link/ipfs/',
    'https://ipfs.io/ipfs/',
  ];

  // Convert IPFS to HTTP gateway - uses first gateway by default
  const ipfsToHttp = (url: string, gatewayIndex = 0): string => {
    if (!url) return '';
    const gateway = IPFS_GATEWAYS[gatewayIndex] || IPFS_GATEWAYS[0];
    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', gateway);
    }
    if (url.startsWith('Qm') || url.startsWith('baf')) {
      return `${gateway}${url}`;
    }
    return url;
  };

  // Fetch NFT metadata from URI - tries multiple gateways
  const fetchNFTMetadata = async (uri: string): Promise<NFTMetadata | null> => {
    // Try each gateway until one works
    for (let gatewayIdx = 0; gatewayIdx < IPFS_GATEWAYS.length; gatewayIdx++) {
      try {
        const httpUri = ipfsToHttp(uri, gatewayIdx);
        if (!httpUri.startsWith('http')) return null;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // 8 second timeout

        const response = await fetch(httpUri, { signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) continue; // Try next gateway

        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const json = await response.json();
          // Convert image URL to use same gateway that worked
          if (json.image) {
            json.image = ipfsToHttp(json.image, gatewayIdx);
          }
          return json;
        } else if (contentType?.includes('image')) {
          // URI points directly to image
          return { image: httpUri };
        }

        // Try parsing as JSON anyway
        const text = await response.text();
        try {
          const json = JSON.parse(text);
          if (json.image) {
            json.image = ipfsToHttp(json.image, gatewayIdx);
          }
          return json;
        } catch {
          // Maybe it's a direct image URL
          return { image: httpUri };
        }
      } catch {
        // Try next gateway
        continue;
      }
    }
    return null;
  };

  // Fetch collection info from XRP.cafe API
  const fetchCollectionFromXrpCafe = async (issuer: string, taxon?: number): Promise<{ name: string; image?: string } | null> => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      // XRP.cafe collections API
      const response = await fetch(
        `https://api.xrp.cafe/api/collections/${issuer}${taxon !== undefined ? `?taxon=${taxon}` : ''}`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (!response.ok) return null;

      const data = await response.json();
      if (data?.name) {
        return {
          name: data.name,
          image: data.image || data.cover_image || data.thumbnail,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  // localStorage key for collection name cache - version 3 with metadata extraction
  const COLLECTION_CACHE_KEY = 'bear_market_collection_names_v3';

  // Clear old caches on first load (one-time migration)
  useEffect(() => {
    // Remove old cache versions that had wrong names
    localStorage.removeItem('bear_market_collection_names');
    localStorage.removeItem('bear_market_collection_names_v2');
  }, []);

  // Load cached collection names from localStorage
  const loadCollectionCache = (): Record<string, { name: string; image?: string }> => {
    try {
      const cached = localStorage.getItem(COLLECTION_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (err) {
      console.warn('Failed to load collection cache:', err);
    }
    return {};
  };

  // Save collection name to localStorage cache
  const saveToCollectionCache = (issuer: string, data: { name: string; image?: string }) => {
    try {
      const cache = loadCollectionCache();
      cache[issuer] = data;
      localStorage.setItem(COLLECTION_CACHE_KEY, JSON.stringify(cache));
    } catch (err) {
      console.warn('Failed to save to collection cache:', err);
    }
  };

  // Get cached collection name (returns null if not cached)
  const getCachedCollectionName = (issuer: string): { name: string; image?: string } | null => {
    const cache = loadCollectionCache();
    return cache[issuer] || null;
  };

  // Format address for display
  const formatAddress = (address: string): string => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Copy address to clipboard
  const handleCopyAddress = async () => {
    if (wallet.address) {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Fetch NFTs with metadata and group by collection
  useEffect(() => {
    const fetchNFTs = async () => {
      if (!xrplClient || !wallet.address || activeTab !== 'nfts') return;

      setLoadingNfts(true);
      try {
        // Fetch ALL NFTs with pagination - no limits!
        const allRawNfts: any[] = [];
        let marker: string | undefined = undefined;
        let pageCount = 0;
        const MAX_PAGES = 1000; // Safety limit (1000 pages * 400 = 400,000 NFTs max)

        do {
          setNftLoadProgress(`Fetching NFTs... (${allRawNfts.length} found)`);

          const request: any = {
            command: 'account_nfts',
            account: wallet.address,
            limit: 400, // Max per request
          };

          if (marker) {
            request.marker = marker;
          }

          const response = await xrplClient.request(request);
          const result = response.result as any;
          const pageNfts = result.account_nfts || [];
          allRawNfts.push(...pageNfts);

          // Get next page marker
          marker = result.marker as string | undefined;
          pageCount++;

        } while (marker && pageCount < MAX_PAGES);

        console.log(`Total NFTs fetched: ${allRawNfts.length} across ${pageCount} pages`);
        setNftLoadProgress(`Processing ${allRawNfts.length} NFTs...`);

        const rawNfts = allRawNfts;

        // First pass: Create NFT objects with basic info
        const nftDataPromises = rawNfts.map(async (nft: any) => {
          const uri = nft.URI ? hexToString(nft.URI) : '';
          let image = '';
          let name = `#${nft.NFTokenID.slice(-8).toUpperCase()}`;
          let metadata: NFTMetadata | undefined;

          // Try to fetch metadata if URI exists
          if (uri) {
            const httpUri = ipfsToHttp(uri);

            // If URI looks like an image, use it directly
            if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(httpUri)) {
              image = httpUri;
            } else {
              // Try to fetch as JSON metadata
              const meta = await fetchNFTMetadata(uri);
              if (meta) {
                metadata = meta;
                if (meta.image) {
                  image = ipfsToHttp(meta.image);
                }
                if (meta.name) {
                  name = meta.name;
                }
              }
            }
          }

          return {
            id: nft.NFTokenID,
            name,
            image,
            issuer: nft.Issuer,
            taxon: nft.NFTokenTaxon,
            uri,
            metadata,
          } as NFTData;
        });

        const nftData = await Promise.all(nftDataPromises);
        setNfts(nftData);

        // Group by issuer + taxon (like XRP.cafe does!)
        // This properly separates collections like "Pixel Bears" vs "Ultra Rare Bears"
        const collectionMap = new Map<string, NFTData[]>();
        nftData.forEach(nft => {
          // Use issuer:taxon as the unique collection key
          const collectionKey = `${nft.issuer}:${nft.taxon}`;
          const existing = collectionMap.get(collectionKey) || [];
          existing.push(nft);
          collectionMap.set(collectionKey, existing);
        });

        // Create collection objects with cached/XRP.cafe names
        setNftLoadProgress(`Loading ${collectionMap.size} collection names...`);

        const collectionPromises = Array.from(collectionMap.entries()).map(async ([collectionKey, nftList]) => {
          // Parse the key back to issuer and taxon
          const [issuer, taxonStr] = collectionKey.split(':');
          const taxon = parseInt(taxonStr, 10);

          // Get first NFT with an image as collection cover
          const coverNft = nftList.find(n => n.image) || nftList[0];

          let collectionName = '';
          let collectionImage = coverNft?.image || '';

          // Cache key is issuer:taxon for proper separation
          const cacheKey = collectionKey;

          // 1. First check localStorage cache (using issuer:taxon key)
          const cachedInfo = getCachedCollectionName(cacheKey);
          if (cachedInfo?.name) {
            collectionName = cachedInfo.name;
            if (cachedInfo.image) {
              collectionImage = ipfsToHttp(cachedInfo.image);
            }
            console.log(`Using cached name for ${cacheKey}: ${collectionName}`);
          }

          // 2. Check KNOWN_COLLECTIONS hardcoded list (try both key formats)
          if (!collectionName) {
            collectionName = KNOWN_COLLECTIONS[cacheKey] || KNOWN_COLLECTIONS[issuer];
            if (collectionName) {
              // Save to cache for consistency
              saveToCollectionCache(cacheKey, { name: collectionName, image: collectionImage });
            }
          }

          // 3. Try XRP.cafe API if still no name (pass taxon for proper collection!)
          if (!collectionName) {
            try {
              const xrpCafeInfo = await fetchCollectionFromXrpCafe(issuer, taxon);
              if (xrpCafeInfo?.name) {
                collectionName = xrpCafeInfo.name;
                if (xrpCafeInfo.image) {
                  collectionImage = ipfsToHttp(xrpCafeInfo.image);
                }
                // Save to localStorage cache using issuer:taxon key!
                saveToCollectionCache(cacheKey, { name: collectionName, image: xrpCafeInfo.image });
                console.log(`Cached new collection from XRP.cafe: ${cacheKey} -> ${collectionName}`);
              }
            } catch {
              // Ignore errors, try metadata extraction next
            }
          }

          // 4. Try to extract collection name from NFT metadata
          if (!collectionName) {
            const extractedName = extractCollectionNameFromMetadata(nftList);
            if (extractedName) {
              collectionName = extractedName;
              // Save to cache so we don't have to extract again
              saveToCollectionCache(cacheKey, { name: collectionName, image: collectionImage });
              console.log(`Extracted collection name from metadata: ${cacheKey} -> ${collectionName}`);
            }
          }

          // 5. Fallback to issuer address + taxon
          if (!collectionName) {
            collectionName = `Collection ${issuer.slice(0, 6)}...${issuer.slice(-4)} #${taxon}`;
          }

          return {
            issuer,
            name: collectionName,
            image: collectionImage,
            nfts: nftList,
            taxon, // Use the parsed taxon
          } as NFTCollection;
        });

        const collectionList = await Promise.all(collectionPromises);

        // Sort by collection size (most NFTs first)
        collectionList.sort((a, b) => b.nfts.length - a.nfts.length);
        setCollections(collectionList);
        setNftLoadProgress('');

      } catch (err) {
        console.error('Failed to fetch NFTs:', err);
      } finally {
        setLoadingNfts(false);
      }
    };

    fetchNFTs();
  }, [xrplClient, wallet.address, activeTab]);

  // Fetch transaction history
  useEffect(() => {
    const fetchHistory = async () => {
      if (!xrplClient || !wallet.address || activeTab !== 'history') return;

      setLoadingHistory(true);
      try {
        const response = await xrplClient.request({
          command: 'account_tx',
          account: wallet.address,
          limit: 20,
          ledger_index_min: -1,
          ledger_index_max: -1,
        });

        const txData: TxHistory[] = response.result.transactions
          .filter((tx: any) => tx.tx.TransactionType === 'Payment')
          .map((tx: any) => {
            const isSent = tx.tx.Account === wallet.address;
            const amount = typeof tx.tx.Amount === 'string'
              ? (Number(tx.tx.Amount) / 1_000_000).toFixed(2) + ' XRP'
              : `${tx.tx.Amount.value} ${tx.tx.Amount.currency}`;

            return {
              type: isSent ? 'sent' : 'received',
              to: isSent ? tx.tx.Destination : undefined,
              from: !isSent ? tx.tx.Account : undefined,
              amount,
              currency: typeof tx.tx.Amount === 'string' ? 'XRP' : tx.tx.Amount.currency,
              timestamp: tx.tx.date ? new Date((tx.tx.date + 946684800) * 1000).toLocaleString() : 'Unknown',
              hash: tx.tx.hash,
            };
          });

        setHistory(txData);
      } catch (err) {
        console.error('Failed to fetch history:', err);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchHistory();
  }, [xrplClient, wallet.address, activeTab]);

  // Get LP tokens from balances
  const lpTokens = wallet.balance.tokens.filter(t =>
    t.token.currency.startsWith('LP') || t.token.currency.includes('_')
  );

  // Get regular tokens (not LP)
  const regularTokens = wallet.balance.tokens.filter(t =>
    !t.token.currency.startsWith('LP') && !t.token.currency.includes('_')
  );

  // Format currency code for display (browser-compatible)
  const formatCurrency = (currency: string): string => {
    if (currency.length === 40 && /^[0-9A-Fa-f]+$/.test(currency)) {
      // Hex currency - decode it (browser-compatible)
      try {
        let decoded = '';
        for (let i = 0; i < currency.length; i += 2) {
          const byte = parseInt(currency.substr(i, 2), 16);
          if (byte !== 0) { // Skip null bytes
            decoded += String.fromCharCode(byte);
          }
        }
        return decoded.trim() || currency.slice(0, 8);
      } catch {
        return currency.slice(0, 8);
      }
    }
    return currency;
  };

  // Token Icon component with fallback - tries multiple sources
  const TokenIconSmall = ({ currency, issuer, size = 40 }: { currency: string; issuer?: string; size?: number }) => {
    const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
    const [allFailed, setAllFailed] = useState(false);

    // Get list of URLs to try
    const iconUrls = useMemo(() => {
      return getTokenIconUrls(currency, issuer);
    }, [currency, issuer]);

    const currentUrl = iconUrls[currentUrlIndex];

    // Reset when token changes
    useEffect(() => {
      setCurrentUrlIndex(0);
      setAllFailed(false);
    }, [currency, issuer]);

    // Handle image load error - try next URL
    const handleError = () => {
      if (currentUrlIndex < iconUrls.length - 1) {
        setCurrentUrlIndex(prev => prev + 1);
      } else {
        setAllFailed(true);
      }
    };

    // Generate a color from the currency code for fallback
    const generateColor = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
      }
      const hue = hash % 360;
      return `hsl(${hue}, 60%, 50%)`;
    };

    if (allFailed || !currentUrl) {
      return (
        <div
          className="rounded-full flex items-center justify-center text-white font-bold"
          style={{
            width: size,
            height: size,
            backgroundColor: generateColor(currency),
            fontSize: size * 0.35,
          }}
        >
          {formatCurrency(currency).slice(0, 2)}
        </div>
      );
    }

    return (
      <img
        src={currentUrl}
        alt={formatCurrency(currency)}
        className="rounded-full object-cover bg-gray-700"
        style={{ width: size, height: size }}
        onError={handleError}
      />
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-end p-4 pt-20"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Dashboard Panel */}
        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 20, scale: 0.95 }}
          transition={{ type: 'spring', duration: 0.4 }}
          className="relative w-full max-w-sm bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col"
        >
          {/* Header */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold text-white">Wallet</h2>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Address bar */}
            <div className="flex items-center gap-2 p-2 bg-gray-800 rounded-xl">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-sm">
                🐻
              </div>
              <span className="flex-1 font-mono text-sm text-white">
                {wallet.address ? formatAddress(wallet.address) : '---'}
              </span>
              <button
                onClick={handleCopyAddress}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                title="Copy address"
              >
                {copied ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
              <a
                href={`https://bithomp.com/explorer/${wallet.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
                title="View on explorer"
              >
                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <button
                onClick={() => {
                  disconnect();
                  onClose();
                }}
                className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors"
                title="Disconnect"
              >
                <svg className="w-4 h-4 text-gray-400 hover:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>

            {/* View Wallet Button */}
            <a
              href={`https://bithomp.com/explorer/${wallet.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full mt-3 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 rounded-xl text-center font-semibold text-white transition-all"
            >
              View Wallet
            </a>

            {/* Receive / Send Buttons */}
            <div className="grid grid-cols-2 gap-3 mt-3">
              <button className="flex items-center justify-center gap-2 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
                Receive
              </button>
              <button className="flex items-center justify-center gap-2 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-white font-medium transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
                Send
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-800">
            {(['tokens', 'lps', 'nfts', 'history'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? 'text-white border-b-2 border-purple-500'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'lps' && ' LPs'}
                {tab === 'nfts' && ' NFTs'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Tokens Tab */}
            {activeTab === 'tokens' && (
              <div className="p-2">
                {/* XRP Balance */}
                <div className="flex items-center gap-3 p-3 hover:bg-gray-800/50 rounded-xl transition-colors">
                  <TokenIconSmall currency="XRP" size={40} />
                  <div className="flex-1">
                    <div className="font-semibold text-white">XRP</div>
                    <div className="text-xs text-gray-500">XRP Ledger</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-white">{parseFloat(wallet.balance.xrp).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    <div className="text-xs text-gray-500">XRP</div>
                  </div>
                </div>

                {/* Token Balances */}
                {regularTokens.map((token, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 hover:bg-gray-800/50 rounded-xl transition-colors">
                    <TokenIconSmall currency={token.token.currency} issuer={token.token.issuer} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white">{formatCurrency(token.token.currency)}</div>
                      <div className="text-xs text-gray-500 truncate">
                        {token.token.issuer?.slice(0, 8)}...
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-white">
                        {parseFloat(token.balance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </div>
                    </div>
                  </div>
                ))}

                {regularTokens.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No tokens found
                  </div>
                )}
              </div>
            )}

            {/* LPs Tab */}
            {activeTab === 'lps' && (
              <div className="p-2">
                {lpTokens.map((token, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 hover:bg-gray-800/50 rounded-xl transition-colors">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center border border-green-500/30">
                      <span className="text-lg">🌊</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white truncate">{formatCurrency(token.token.currency)}</div>
                      <div className="text-xs text-green-400">LP Position</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-white">
                        {parseFloat(token.balance).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      </div>
                    </div>
                  </div>
                ))}

                {lpTokens.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No LP positions found
                  </div>
                )}
              </div>
            )}

            {/* NFTs Tab - Epic Collection Gallery */}
            {activeTab === 'nfts' && (
              <div className="p-3">
                {loadingNfts ? (
                  <div className="text-center py-12">
                    <div className="relative w-16 h-16 mx-auto">
                      <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full" />
                      <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 rounded-full animate-spin" />
                      <div className="absolute inset-2 border-4 border-transparent border-t-pink-500 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }} />
                    </div>
                    <p className="text-gray-400 mt-4 font-medium">Loading your NFTs...</p>
                    {nftLoadProgress ? (
                      <p className="text-purple-400 text-sm mt-1 font-mono">{nftLoadProgress}</p>
                    ) : (
                      <p className="text-gray-600 text-sm mt-1">Fetching metadata from IPFS</p>
                    )}
                  </div>
                ) : collections.length > 0 ? (
                  <div className="space-y-3">
                    {/* Collection View */}
                    {!expandedCollection ? (
                      // Collection Grid
                      <div className="space-y-2">
                        <div className="flex items-center justify-between px-1 mb-3">
                          <span className="text-sm font-medium text-gray-400">{collections.length} Collection{collections.length !== 1 ? 's' : ''}</span>
                          <span className="text-sm text-purple-400">{nfts.length} NFTs</span>
                        </div>
                        {collections.map((collection) => {
                          // Unique key is issuer:taxon
                          const collectionKey = `${collection.issuer}:${collection.taxon}`;
                          return (
                          <motion.button
                            key={collectionKey}
                            onClick={() => setExpandedCollection(collectionKey)}
                            className="w-full group"
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                          >
                            <div className="relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl overflow-hidden border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10">
                              <div className="flex items-center gap-3 p-3">
                                {/* Collection Cover - Stack effect */}
                                <div className="relative">
                                  <div className="absolute -right-1 -bottom-1 w-14 h-14 rounded-lg bg-gray-700/50 transform rotate-6" />
                                  <div className="absolute -right-0.5 -bottom-0.5 w-14 h-14 rounded-lg bg-gray-700/70 transform rotate-3" />
                                  <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-gray-600/50">
                                    {collection.image ? (
                                      <img
                                        src={collection.image}
                                        alt={collection.name}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          (e.target as HTMLImageElement).style.display = 'none';
                                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                                        }}
                                      />
                                    ) : null}
                                    <div className={`absolute inset-0 flex items-center justify-center text-2xl ${collection.image ? 'hidden' : ''}`}>
                                      🖼️
                                    </div>
                                  </div>
                                </div>

                                {/* Collection Info */}
                                <div className="flex-1 text-left min-w-0">
                                  <div className="font-semibold text-white truncate group-hover:text-purple-300 transition-colors">
                                    {collection.name}
                                  </div>
                                  <div className="text-xs text-gray-500 truncate font-mono mt-0.5">
                                    {collection.issuer.slice(0, 8)}...{collection.issuer.slice(-6)}
                                  </div>
                                </div>

                                {/* NFT Count Badge */}
                                <div className="flex items-center gap-2">
                                  <div className="px-3 py-1.5 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full border border-purple-500/30">
                                    <span className="text-sm font-bold text-purple-300">{collection.nfts.length}</span>
                                    <span className="text-xs text-purple-400 ml-1">NFT{collection.nfts.length !== 1 ? 's' : ''}</span>
                                  </div>
                                  <svg className="w-5 h-5 text-gray-500 group-hover:text-purple-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                </div>
                              </div>

                              {/* Preview strip of NFTs */}
                              {collection.nfts.length > 1 && (
                                <div className="px-3 pb-3 pt-0">
                                  <div className="flex gap-1.5 overflow-hidden">
                                    {collection.nfts.slice(0, 5).map((nft, idx) => (
                                      <div
                                        key={nft.id}
                                        className="w-10 h-10 rounded-md overflow-hidden bg-gray-700/50 flex-shrink-0 border border-gray-600/30"
                                        style={{ opacity: 1 - (idx * 0.15) }}
                                      >
                                        {nft.image ? (
                                          <img src={nft.image} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                          <div className="w-full h-full flex items-center justify-center text-sm">🖼️</div>
                                        )}
                                      </div>
                                    ))}
                                    {collection.nfts.length > 5 && (
                                      <div className="w-10 h-10 rounded-md bg-gray-700/50 flex items-center justify-center flex-shrink-0 border border-gray-600/30">
                                        <span className="text-xs text-gray-400">+{collection.nfts.length - 5}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.button>
                        );
                        })}
                      </div>
                    ) : (
                      // Expanded Collection View
                      <div>
                        {/* Back Button & Header */}
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="mb-4"
                        >
                          <button
                            onClick={() => setExpandedCollection(null)}
                            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors mb-3"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="font-medium">Back to Collections</span>
                          </button>

                          {(() => {
                            // Find by issuer:taxon key
                            const col = collections.find(c => `${c.issuer}:${c.taxon}` === expandedCollection);
                            if (!col) return null;
                            return (
                              <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-700">
                                  {col.image ? (
                                    <img src={col.image} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xl">🖼️</div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <h3 className="font-bold text-white">{col.name}</h3>
                                  <p className="text-xs text-gray-400">{col.nfts.length} NFT{col.nfts.length !== 1 ? 's' : ''}</p>
                                </div>
                                <a
                                  href={`https://bithomp.com/explorer/${col.issuer}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                  title="View issuer"
                                >
                                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </div>
                            );
                          })()}
                        </motion.div>

                        {/* NFT Grid */}
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="grid grid-cols-2 gap-3"
                        >
                          {collections.find(c => `${c.issuer}:${c.taxon}` === expandedCollection)?.nfts.map((nft, idx) => (
                            <motion.button
                              key={nft.id}
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: idx * 0.05 }}
                              onClick={() => setSelectedNFT(nft)}
                              className="group bg-gray-800/50 rounded-xl overflow-hidden border border-gray-700/50 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10"
                            >
                              <div className="aspect-square bg-gradient-to-br from-gray-700/50 to-gray-800/50 relative overflow-hidden">
                                {nft.image ? (
                                  <img
                                    src={nft.image}
                                    alt={nft.name}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <span className="text-4xl">🖼️</span>
                                  </div>
                                )}
                                {/* Hover overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                                  <span className="text-xs text-white/80 font-medium">View Details</span>
                                </div>
                              </div>
                              <div className="p-2.5">
                                <div className="text-sm font-medium text-white truncate group-hover:text-purple-300 transition-colors">{nft.name}</div>
                                <div className="text-xs text-gray-500 truncate font-mono mt-0.5">#{nft.id.slice(-8)}</div>
                              </div>
                            </motion.button>
                          ))}
                        </motion.div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500/10 to-pink-500/10 flex items-center justify-center">
                      <span className="text-4xl">🖼️</span>
                    </div>
                    <p className="text-gray-400 font-medium">No NFTs Found</p>
                    <p className="text-gray-600 text-sm mt-1">Your collection is empty</p>
                    <a
                      href="https://onxrp.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-4 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm font-medium transition-colors"
                    >
                      Explore NFT Marketplaces →
                    </a>
                  </div>
                )}

                {/* NFT Detail Modal */}
                <AnimatePresence>
                  {selectedNFT && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                      onClick={() => setSelectedNFT(null)}
                    >
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-md"
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-sm bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl overflow-hidden border border-gray-700 shadow-2xl"
                      >
                        {/* NFT Image */}
                        <div className="aspect-square bg-gray-900 relative">
                          {selectedNFT.image ? (
                            <img
                              src={selectedNFT.image}
                              alt={selectedNFT.name}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-6xl">🖼️</span>
                            </div>
                          )}
                          {/* Close button */}
                          <button
                            onClick={() => setSelectedNFT(null)}
                            className="absolute top-3 right-3 w-8 h-8 bg-black/50 hover:bg-black/70 rounded-full flex items-center justify-center transition-colors"
                          >
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>

                        {/* NFT Info */}
                        <div className="p-4">
                          <h3 className="text-lg font-bold text-white">{selectedNFT.name}</h3>
                          {selectedNFT.metadata?.description && (
                            <p className="text-sm text-gray-400 mt-2 line-clamp-3">{selectedNFT.metadata.description}</p>
                          )}

                          {/* Attributes */}
                          {selectedNFT.metadata?.attributes && selectedNFT.metadata.attributes.length > 0 && (
                            <div className="mt-4">
                              <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Attributes</h4>
                              <div className="grid grid-cols-2 gap-2">
                                {selectedNFT.metadata.attributes.slice(0, 6).map((attr, i) => (
                                  <div key={i} className="bg-gray-800/50 rounded-lg p-2 border border-gray-700/50">
                                    <div className="text-xs text-purple-400 truncate">{attr.trait_type}</div>
                                    <div className="text-sm text-white truncate font-medium">{attr.value}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Token ID */}
                          <div className="mt-4 pt-4 border-t border-gray-700">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-gray-500">Token ID</span>
                              <span className="text-xs text-gray-400 font-mono truncate ml-2">{selectedNFT.id.slice(0, 12)}...{selectedNFT.id.slice(-8)}</span>
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-500">Issuer</span>
                              <a
                                href={`https://bithomp.com/explorer/${selectedNFT.issuer}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-purple-400 hover:text-purple-300 font-mono"
                              >
                                {selectedNFT.issuer.slice(0, 8)}...{selectedNFT.issuer.slice(-6)}
                              </a>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-2 mt-4">
                            <a
                              href={`https://bithomp.com/nft/${selectedNFT.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl text-center text-sm transition-all"
                            >
                              View on Bithomp
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
              <div className="p-2">
                {loadingHistory ? (
                  <div className="text-center py-8">
                    <div className="w-8 h-8 mx-auto border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <p className="text-gray-500 mt-2">Loading history...</p>
                  </div>
                ) : history.length > 0 ? (
                  <div className="space-y-1">
                    {history.map((tx, i) => (
                      <a
                        key={i}
                        href={`https://bithomp.com/explorer/${tx.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 hover:bg-gray-800/50 rounded-xl transition-colors"
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          tx.type === 'sent' ? 'bg-red-500/20' : 'bg-green-500/20'
                        }`}>
                          {tx.type === 'sent' ? (
                            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-gray-400">
                            {tx.type === 'sent' ? 'Sent' : 'Received'}
                          </div>
                          <div className="text-xs text-gray-500 truncate">
                            {tx.type === 'sent' ? `To ${tx.to?.slice(0, 8)}...` : `From ${tx.from?.slice(0, 8)}...`}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`text-sm font-mono ${tx.type === 'sent' ? 'text-red-400' : 'text-green-400'}`}>
                            {tx.type === 'sent' ? '-' : '+'}{tx.amount}
                          </div>
                          <div className="text-xs text-gray-500">{tx.timestamp.split(',')[1]?.trim() || tx.timestamp}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No transaction history
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WalletDashboard;
