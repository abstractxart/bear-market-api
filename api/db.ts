/**
 * Database Module
 * PostgreSQL connection and burn transaction logging
 */

import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

/**
 * Log a burn transaction (deposit or burn action)
 */
export async function logBurnTransaction(data: {
  action: 'deposit' | 'burn';
  txHash: string;
  xrpAmount: string | null;
  lpTokenAmount: string;
  lpTokenCurrency: string;
  lpTokenIssuer: string;
}): Promise<void> {
  const query = `
    INSERT INTO burn_transactions (
      action,
      tx_hash,
      xrp_amount,
      lp_token_amount,
      lp_token_currency,
      lp_token_issuer,
      timestamp
    ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
  `;

  await pool.query(query, [
    data.action,
    data.txHash,
    data.xrpAmount,
    data.lpTokenAmount,
    data.lpTokenCurrency,
    data.lpTokenIssuer,
  ]);

  console.log(`📝 Logged ${data.action} transaction: ${data.txHash}`);
}

/**
 * Get recent burn transactions
 */
export async function getRecentBurns(limit: number = 50): Promise<any[]> {
  const query = `
    SELECT
      id,
      action,
      tx_hash,
      xrp_amount,
      lp_token_amount,
      lp_token_currency,
      lp_token_issuer,
      timestamp
    FROM burn_transactions
    ORDER BY timestamp DESC
    LIMIT $1
  `;

  const result = await pool.query(query, [limit]);
  return result.rows;
}

/**
 * Get burn statistics
 */
export async function getBurnStats(): Promise<{
  totalDeposits: number;
  totalBurns: number;
  totalXRPConverted: string;
  totalLPTokensBurned: string;
  lastDepositTime: Date | null;
  lastBurnTime: Date | null;
}> {
  const query = `
    SELECT
      COUNT(*) FILTER (WHERE action = 'deposit') as total_deposits,
      COUNT(*) FILTER (WHERE action = 'burn') as total_burns,
      COALESCE(SUM(CAST(xrp_amount AS DECIMAL)), 0) as total_xrp,
      COALESCE(SUM(CAST(lp_token_amount AS DECIMAL)) FILTER (WHERE action = 'burn'), 0) as total_lp_burned,
      MAX(timestamp) FILTER (WHERE action = 'deposit') as last_deposit,
      MAX(timestamp) FILTER (WHERE action = 'burn') as last_burn
    FROM burn_transactions
  `;

  const result = await pool.query(query);
  const row = result.rows[0];

  return {
    totalDeposits: parseInt(row.total_deposits) || 0,
    totalBurns: parseInt(row.total_burns) || 0,
    totalXRPConverted: row.total_xrp?.toString() || '0',
    totalLPTokensBurned: row.total_lp_burned?.toString() || '0',
    lastDepositTime: row.last_deposit,
    lastBurnTime: row.last_burn,
  };
}

export default pool;
