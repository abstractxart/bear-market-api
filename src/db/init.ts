/**
 * Database Initialization Script
 *
 * Run this once after deploying to Railway to create all tables.
 * Usage: node dist/db/init.js
 */

import fs from 'fs';
import path from 'path';
import pool from './index';

async function initializeDatabase() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  BEAR MARKET - Database Initialization                    ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  try {
    // Read schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    console.log('📄 Running schema.sql...\n');

    // Execute schema
    await pool.query(schema);

    console.log('✅ Database initialized successfully!');
    console.log('\nTables created:');
    console.log('  - referrals');
    console.log('  - trades');
    console.log('  - payouts');
    console.log('  - referral_stats (view)');

    // Verify tables exist
    const result = await pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    console.log('\n✅ Verified tables:');
    result.rows.forEach((row: any) => {
      console.log(`  ✓ ${row.tablename}`);
    });

    console.log('\n🎉 Database is ready for use!');

  } catch (error: any) {
    console.error('❌ Error initializing database:');
    console.error(error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase();
}

export default initializeDatabase;
