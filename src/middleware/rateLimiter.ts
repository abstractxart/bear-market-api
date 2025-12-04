/**
 * Rate Limiting Middleware
 *
 * Prevents:
 * - Spam attacks
 * - Wallet drainage via rapid API calls
 * - DOS attacks
 */

import { Request, Response, NextFunction } from 'express';
import pool from '../db';

interface RateLimitConfig {
  windowMs: number;  // Time window in milliseconds
  maxRequests: number;  // Max requests per window
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  '/api/referrals/trades/record': {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 10  // Max 10 trades per minute per wallet
  },
  '/api/referrals/register': {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 5  // Max 5 registrations per minute per IP
  },
  'default': {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 100  // Max 100 requests per minute per IP
  }
};

/**
 * Get identifier for rate limiting
 * For trade recording: use wallet address
 * For other endpoints: use IP address
 */
function getIdentifier(req: Request, endpoint: string): string {
  if (endpoint === '/api/referrals/trades/record') {
    return req.body?.traderWallet || req.ip || 'unknown';
  }
  return req.ip || 'unknown';
}

/**
 * Rate limiting middleware
 */
export async function rateLimiter(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const endpoint = req.path;
  const identifier = getIdentifier(req, endpoint);

  // Get rate limit config for this endpoint
  const config = RATE_LIMITS[endpoint] || RATE_LIMITS['default'];

  try {
    // Check current rate limit status
    const result = await pool.query(
      `SELECT request_count, window_start
       FROM rate_limits
       WHERE identifier = $1 AND endpoint = $2`,
      [identifier, endpoint]
    );

    const now = new Date();
    const windowStart = result.rows[0]?.window_start
      ? new Date(result.rows[0].window_start)
      : now;

    const windowAge = now.getTime() - windowStart.getTime();
    const requestCount = result.rows[0]?.request_count || 0;

    // If window expired, reset
    if (windowAge > config.windowMs) {
      await pool.query(
        `INSERT INTO rate_limits (identifier, endpoint, request_count, window_start)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (identifier, endpoint)
         DO UPDATE SET request_count = 1, window_start = $3`,
        [identifier, endpoint, now]
      );

      console.log(`[RateLimit] ${identifier} ${endpoint}: 1/${config.maxRequests}`);
      next();
      return;
    }

    // If within window and under limit, increment
    if (requestCount < config.maxRequests) {
      await pool.query(
        `INSERT INTO rate_limits (identifier, endpoint, request_count, window_start)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (identifier, endpoint)
         DO UPDATE SET request_count = rate_limits.request_count + 1`,
        [identifier, endpoint, requestCount + 1, windowStart]
      );

      console.log(`[RateLimit] ${identifier} ${endpoint}: ${requestCount + 1}/${config.maxRequests}`);
      next();
      return;
    }

    // Rate limit exceeded
    const retryAfter = Math.ceil((config.windowMs - windowAge) / 1000);
    console.warn(`[RateLimit] BLOCKED ${identifier} ${endpoint}: ${requestCount}/${config.maxRequests}`);

    res.status(429).json({
      error: 'Too many requests',
      message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
      retryAfter
    });

  } catch (error: any) {
    console.error('[RateLimit] Error:', error);
    // On error, allow request through (fail open to prevent blocking legitimate traffic)
    next();
  }
}

/**
 * Cleanup old rate limit entries (run periodically)
 */
export async function cleanupRateLimits(): Promise<void> {
  try {
    const oldestWindow = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago

    const result = await pool.query(
      `DELETE FROM rate_limits WHERE window_start < $1`,
      [oldestWindow]
    );

    console.log(`[RateLimit] Cleaned up ${result.rowCount} old entries`);
  } catch (error: any) {
    console.error('[RateLimit] Cleanup error:', error);
  }
}

// Run cleanup every hour
setInterval(cleanupRateLimits, 60 * 60 * 1000);
