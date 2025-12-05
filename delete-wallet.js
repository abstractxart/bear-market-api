const { Pool } = require('pg');

async function deleteWallet() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const wallet = 'rP3RX448CPVWxgJSCSYsAE26rd7QTUpgD8';

    console.log('🗑️  DELETING wallet registration:', wallet);
    console.log('This will allow the wallet to re-register with a referral code\n');

    // Delete from referrals table
    const result = await pool.query(
      'DELETE FROM referrals WHERE wallet_address = $1 RETURNING *',
      [wallet]
    );

    if (result.rows.length > 0) {
      console.log('✅ DELETED from referrals table:');
      console.log('  Wallet:', result.rows[0].wallet_address);
      console.log('  Referral Code:', result.rows[0].referral_code);
      console.log('  Was Referred By:', result.rows[0].referred_by_code || 'NONE');
      console.log('  Created:', result.rows[0].created_at);
      console.log('\n✅ Wallet can now re-register with a referral link!');
    } else {
      console.log('❌ Wallet not found in database');
    }

    await pool.end();
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

deleteWallet();
