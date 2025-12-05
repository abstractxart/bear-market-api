import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import referralRoutes from './routes/referrals';
import adminRoutes from './routes/admin';
import proxyRoutes from './routes/proxy';
import { rateLimiter } from './middleware/rateLimiter';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json({ limit: '10kb' })); // Limit request size to prevent DOS
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'http://localhost:5174', // Vite dev server alternate port
    'https://trade.bearpark.xyz',
    process.env.FRONTEND_URL_PROD || 'https://bear-market-gjqg3nove-bear-xrpls-projects.vercel.app',
  ],
  credentials: true,
}));

// Rate limiting (CRITICAL for security)
app.use(rateLimiter);

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/referrals', referralRoutes);
app.use('/api/proxy', proxyRoutes);
app.use('/admin', adminRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server] Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║   BEAR MARKET API Server                   ║
║   Environment: ${process.env.NODE_ENV || 'development'}              ║
║   Port: ${PORT}                               ║
╚════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received, shutting down gracefully');
  process.exit(0);
});
