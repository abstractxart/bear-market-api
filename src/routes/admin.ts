import { Router } from 'express';
import initializeDatabase from '../db/init';
import pool from '../db';

const router = Router();

/**
 * GET /admin/init-db
 * Initialize database schema (one-time setup)
 *
 * SECURITY: This should be protected in production!
 * For now, it's open for initial setup.
 */
router.get('/init-db', async (req, res) => {
  try {
    console.log('[Admin] Database initialization requested');

    // Run the database initialization
    await initializeDatabase();

    res.json({
      success: true,
      message: 'Database initialized successfully!',
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Admin] Database initialization failed:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * GET /admin/health
 * Check database connection and table status
 */
router.get('/health', async (req, res) => {
  try {
    // Check database connection
    const result = await pool.query('SELECT NOW()');

    // Get table list
    const tables = await pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    res.json({
      success: true,
      database: 'connected',
      serverTime: result.rows[0].now,
      tables: tables.rows.map((r: any) => r.tablename),
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('[Admin] Health check failed:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
