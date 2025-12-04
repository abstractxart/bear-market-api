const https = require('https');
const http = require('http');

// Test fetching NFT metadata for Pixel Bears
const testUrls = [
  // Cloudflare IPFS
  'https://cloudflare-ipfs.com/ipfs/QmTest',
  // Pinata
  'https://gateway.pinata.cloud/ipfs/QmTest',
  // IPFS.io
  'https://ipfs.io/ipfs/QmTest',
];

// Test the Pixel Bear issuer's NFT format
// First, let's see what format the URIs are in by checking a known NFT

async function fetchWithTimeout(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data: data.substring(0, 500) }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

// Test IPFS gateways
async function testGateways() {
  const gateways = [
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/',
    'https://dweb.link/ipfs/',
    'https://ipfs.io/ipfs/',
    'https://nftstorage.link/ipfs/',
    'https://w3s.link/ipfs/',
  ];
  
  // Known working IPFS hash for testing
  const testHash = 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG';
  
  console.log('Testing IPFS gateways...\n');
  
  for (const gateway of gateways) {
    try {
      const result = await fetchWithTimeout(gateway + testHash, 8000);
      console.log(`✅ ${gateway}`);
      console.log(`   Status: ${result.status}`);
    } catch (err) {
      console.log(`❌ ${gateway}`);
      console.log(`   Error: ${err.message}`);
    }
  }
}

testGateways().catch(console.error);
