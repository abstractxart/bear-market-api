/**
 * Wallet-Based Authentication Middleware
 * Verifies XRPL wallet signatures for admin access
 */

import { Request, Response, NextFunction } from 'express';
import { verify as verifySignature, deriveAddress } from 'ripple-keypairs';
import jwt from 'jsonwebtoken';

// Admin wallet whitelist (configurable via env)
const ADMIN_WALLETS = (process.env.ADMIN_WALLETS || 'rBEARKfWJS1LYdg2g6t99BgbvpWY5pgMB9').split(',').map(w => w.trim());
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';
const AUTH_MESSAGE = 'BEAR Admin Dashboard Authentication';

export interface AuthRequest extends Request {
  walletAddress?: string;
}

/**
 * Verify wallet signature and check admin whitelist
 */
export function verifyWalletAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No authentication token provided',
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET) as { walletAddress: string };

    // Check if wallet is in admin whitelist
    if (!ADMIN_WALLETS.includes(decoded.walletAddress)) {
      return res.status(403).json({
        success: false,
        error: 'Wallet not authorized for admin access',
      });
    }

    req.walletAddress = decoded.walletAddress;
    next();
  } catch (error: any) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired authentication token',
    });
  }
}

/**
 * POST /api/auth/verify-wallet
 * Verify wallet signature and issue JWT token
 */
export async function verifyWalletSignature(req: Request, res: Response) {
  try {
    const { walletAddress, signature, publicKey } = req.body;

    if (!walletAddress || !signature || !publicKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: walletAddress, signature, publicKey',
      });
    }

    // Check if wallet is in admin whitelist
    if (!ADMIN_WALLETS.includes(walletAddress)) {
      return res.status(403).json({
        success: false,
        error: 'Wallet not authorized for admin access',
      });
    }

    // Verify the signature
    const messageHex = Buffer.from(AUTH_MESSAGE, 'utf8').toString('hex').toUpperCase();

    try {
      const isValid = verifySignature(messageHex, signature, publicKey);

      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid signature',
        });
      }
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: 'Signature verification failed',
      });
    }

    // Issue JWT token (expires in 24 hours)
    const token = jwt.sign(
      { walletAddress },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      success: true,
      data: {
        token,
        walletAddress,
        expiresIn: '24h',
      },
    });
  } catch (error: any) {
    console.error('[Wallet Auth Error]:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to verify wallet signature',
    });
  }
}

/**
 * GET /api/auth/challenge
 * Get the authentication challenge message
 */
export function getAuthChallenge(req: Request, res: Response) {
  return res.json({
    success: true,
    data: {
      message: AUTH_MESSAGE,
    },
  });
}
