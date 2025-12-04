/**
 * Fund Hot Wallet on Testnet
 *
 * This script requests 1000 XRP from the XRPL testnet faucet
 */

const { Client, Wallet } = require('xrpl');
require('dotenv').config();

async function fundWallet() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  BEAR MARKET - Fund Testnet Wallet                        ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  const client = new Client('wss://s.altnet.rippletest.net:51233');

  try {
    console.log('🔌 Connecting to XRPL Testnet...');
    await client.connect();

    const seed = process.env.HOT_WALLET_SEED;
    if (!seed) {
      throw new Error('HOT_WALLET_SEED not found in .env');
    }

    const wallet = Wallet.fromSeed(seed);
    console.log(`📍 Wallet Address: ${wallet.address}\n`);

    console.log('💰 Requesting 1000 XRP from testnet faucet...');
    const fundResult = await client.fundWallet(wallet);

    console.log('✅ Success!');
    console.log(`   Balance: ${fundResult.balance} XRP`);
    console.log(`   Wallet: ${fundResult.wallet.address}\n`);

    console.log('✅ Hot wallet is funded and ready for payouts!');
    console.log('\n💡 Check balance anytime at:');
    console.log(`   https://testnet.xrpl.org/accounts/${wallet.address}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n⚠️  If faucet fails, try:');
    console.log('   1. Visit https://xrpl.org/xrp-testnet-faucet.html');
    console.log(`   2. Enter address: rH9RHCHJsHYp44kod9NXLjNvWo9ossT77E`);
    console.log('   3. Click "Get Testnet XRP"');
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

fundWallet();
