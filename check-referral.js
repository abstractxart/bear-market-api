const { Pool } = require('pg');

async function checkReferral() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const wallet = 'rP3RX448CPVWxgJSCSYsAE26rd7QTUpgD8';

    console.log('Checking wallet:', wallet);
    console.log('Expected referrer code: RKKKYMMUKT\n');

    // Check referrals table
    const result = await pool.query(
      'SELECT * FROM referrals WHERE wallet_address = $1',
      [wallet]
    );

    if (result.rows.length > 0) {
      console.log('✅ WALLET FOUND IN REFERRALS TABLE:');
      console.log('  Wallet:', result.rows[0].wallet_address);
      console.log('  Referral Code:', result.rows[0].referral_code);
      console.log('  Referred By:', result.rows[0].referred_by || 'NONE');
      console.log('  Created:', result.rows[0].created_at);
    } else {
      console.log('❌ WALLET NOT REGISTERED');
      console.log('This means the wallet never connected with the referral link!');
    }

    // Check trades
    console.log('\nChecking for trades...');
    const trades = await pool.query(
      'SELECT id, input_token, output_token, swap_tx_hash, created_at FROM trades WHERE wallet_address = $1 ORDER BY created_at DESC LIMIT 3',
      [wallet]
    );

    if (trades.rows.length > 0) {
      console.log(`\n✅ FOUND ${trades.rows.length} TRADE(S):`);
      trades.rows.forEach((trade, i) => {
        console.log(`  Trade ${i+1}:`, trade.input_token, '→', trade.output_token);
        console.log('    TX:', trade.swap_tx_hash);
        console.log('    Time:', trade.created_at);
      });
    } else {
      console.log('❌ NO TRADES FOUND');
    }

    await pool.end();
  } catch (error) {
    console.error('ERROR:', error.message);
    process.exit(1);
  }
}

checkReferral();
