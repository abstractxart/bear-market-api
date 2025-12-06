/**
 * BEAR MARKET - Tokens Leaderboard Page
 *
 * Displays all XRPL tokens with stats similar to FirstLedger.
 * Features: Search, sortable columns, auto-refresh, BEAR pinned at top.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import TokenTable from '../components/TokenTable';
import type { LeaderboardToken } from '../types';
import {
  getLeaderboardTokens,
  sortLeaderboardTokens,
  filterLeaderboardTokens,
} from '../services/tokenLeaderboardService';

const TokensPage: React.FC = () => {
  // State
  const [tokens, setTokens] = useState<LeaderboardToken[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<LeaderboardToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('marketCap');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch tokens
  const fetchTokens = useCallback(async (forceRefresh = false) => {
    try {
      const data = await getLeaderboardTokens(forceRefresh);
      setTokens(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('[TokensPage] Error fetching tokens:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchTokens();
  }, [fetchTokens]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchTokens(true);
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchTokens]);

  // Filter and sort tokens when dependencies change
  useEffect(() => {
    let result = tokens;

    // Apply search filter
    if (searchQuery) {
      result = filterLeaderboardTokens(result, searchQuery);
    }

    // Apply sorting
    result = sortLeaderboardTokens(result, sortBy as keyof LeaderboardToken, sortDirection);

    setFilteredTokens(result);
  }, [tokens, searchQuery, sortBy, sortDirection]);

  // Handle sort column click
  const handleSort = (column: string) => {
    if (column === sortBy) {
      // Toggle direction
      setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
    } else {
      // New column, default to descending
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  // Manual refresh
  const handleRefresh = () => {
    setLoading(true);
    fetchTokens(true);
  };

  return (
    <div className="max-w-[1600px] mx-auto pt-0 md:pt-8 pb-0">
      {/* Header - ULTRA compact on mobile */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="mb-0 md:mb-6 px-1 md:px-4"
      >
        {/* Mobile: Title + Search row */}
        <div className="md:hidden">
          {/* Mobile Title */}
          <h1 className="text-xl font-luckiest text-gradient-bear mb-2 px-1">
            Token Leaderboard
          </h1>
          {/* Search row */}
          <div className="flex items-center gap-1 py-0.5">
            {/* Search - ultra compact */}
            <div className="relative flex-1">
              <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-2 py-1.5 pl-7 pr-7 bg-bear-dark-700 border border-bear-dark-600 rounded text-white text-xs placeholder-gray-500 focus:outline-none focus:border-bear-purple-500"
            />
            <svg
              className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Token count - ultra compact */}
          <div className="flex items-center px-1.5 py-1.5 bg-bear-dark-700 rounded text-xs text-gray-400">
            <span className="font-mono text-bear-gold-400">{filteredTokens.length}</span>
          </div>

          {/* Refresh - icon only */}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-1.5 bg-bear-dark-700 hover:bg-bear-dark-600 rounded text-gray-300 disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          </div>
        </div>

        {/* Desktop: Full header - BEARpark Style */}
        <div className="hidden md:block">
          <div className="flex flex-row items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-4xl font-luckiest text-gradient-bear tracking-tight">
                Token Leaderboard
              </h1>
              <p className="text-bearpark-gold/80 mt-1 font-medium">
                Track XRPL token prices, volume, and market data
              </p>
            </div>

            {/* Last updated & Refresh */}
            <div className="flex items-center gap-4">
              {lastUpdated && (
                <span className="text-sm text-gray-500">
                  Updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="relative flex items-center gap-2 px-4 py-2 rounded-xl text-white font-semibold overflow-hidden group hover:scale-105 transition-transform disabled:opacity-50"
              >
                {/* Tri-gradient border */}
                <span className="absolute inset-0 rounded-xl bg-[conic-gradient(from_0deg,#680cd9,#feb501,#07ae08,#680cd9)] animate-spin-slow"></span>
                <span className="absolute inset-[2px] rounded-xl bg-bear-dark-800 group-hover:bg-bear-dark-700 transition-colors"></span>
                <svg
                  className={`relative z-10 w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="relative z-10">Refresh</span>
              </button>
            </div>
          </div>

          {/* Search & Filters - BEARpark styled */}
          <div className="flex flex-row gap-4">
            <div className="relative flex-1 max-w-md">
              {/* Search with tri-gradient border */}
              <div className="relative">
                <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-bearpark-purple via-bearpark-yellow to-bearpark-green p-[2px]">
                  <span className="block w-full h-full rounded-xl bg-bear-dark-800"></span>
                </span>
                <input
                  type="text"
                  placeholder="Search tokens..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="relative w-full px-4 py-3 pl-10 pr-10 bg-transparent rounded-xl text-white placeholder-gray-500 focus:outline-none z-10"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-bearpark-gold z-10"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors z-10"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div className="relative flex items-center px-4 py-2 rounded-xl text-gray-400 overflow-hidden">
              <span className="absolute inset-0 rounded-xl bg-gradient-to-r from-bearpark-purple via-bearpark-yellow to-bearpark-green p-[2px]">
                <span className="block w-full h-full rounded-xl bg-bear-dark-800"></span>
              </span>
              <span className="relative z-10 font-mono text-bearpark-gold font-bold mr-2">{filteredTokens.length}</span>
              <span className="relative z-10">tokens</span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Token Table - edge-to-edge on mobile */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="md:px-4 -mx-4 md:mx-0"
      >
        <TokenTable
          tokens={filteredTokens}
          sortBy={sortBy}
          sortDirection={sortDirection}
          onSort={handleSort}
          loading={loading}
        />
      </motion.div>

    </div>
  );
};

export default TokensPage;
