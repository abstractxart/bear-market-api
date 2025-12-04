/**
 * XRPL Hot Wallet Generator
 *
 * This script generates a new XRPL wallet for automatic referral payouts.
 *
 * SECURITY WARNING:
 * - Save the seed phrase securely
 * - Never commit it to git
 * - Add it to .env as HOT_WALLET_SEED
 * - Fund the wallet with at least 10-20 XRP
 */

const { Wallet } = require('xrpl');

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║  BEAR MARKET - Hot Wallet Generator                        ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Generate a new wallet
const wallet = Wallet.generate();

console.log('✅ New XRPL Wallet Generated!\n');
console.log('📍 Address:');
console.log(`   ${wallet.address}\n`);
console.log('🔑 Seed (KEEP THIS SECRET):');
console.log(`   ${wallet.seed}\n`);
console.log('⚠️  IMPORTANT NEXT STEPS:');
console.log('   1. Copy the SEED above');
console.log('   2. Add it to .env as HOT_WALLET_SEED=<seed>');
console.log('   3. Fund this wallet with at least 10-20 XRP');
console.log('   4. Use faucet for testnet: https://xrpl.org/xrp-testnet-faucet.html');
console.log('   5. Or send XRP from your main wallet for mainnet\n');
console.log('💡 To check balance later:');
console.log(`   Visit: https://livenet.xrpl.org/accounts/${wallet.address}\n`);
console.log('⚠️  NEVER share your seed with anyone!');
console.log('════════════════════════════════════════════════════════════\n');
