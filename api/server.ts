/**
 * BEAR SWAP Backend Server
 * Express + PostgreSQL for token metadata management
 * + Auto-burn service for LP token transparency
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import routes from './routes';
import { startAutoBurnService, stopAutoBurnService } from './burnService';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware - Allow any localhost port for development
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);

    // Allow any localhost port
    if (origin.startsWith('http://localhost:')) {
      return callback(null, true);
    }

    // In production, check against FRONTEND_URL
    if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api', routes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[Server Error]:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, async () => {
  console.log(`🐻 BEAR SWAP Backend running on port ${PORT}`);
  console.log(`📡 API: http://localhost:${PORT}/api`);
  console.log(`💚 Health: http://localhost:${PORT}/health`);

  // Start auto-burn service
  if (process.env.TREASURY_WALLET_SECRET) {
    console.log('\n🔥 Initializing Auto-Burn Service...');
    await startAutoBurnService();
  } else {
    console.log('\n⚠️ Auto-Burn Service disabled: TREASURY_WALLET_SECRET not set');
  }
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await stopAutoBurnService();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  await stopAutoBurnService();
  process.exit(0);
});

export default app;
