/**
 * BEAR MARKET - Fetch Token Icons
 * Downloads real token icons from XRPL Meta CDN
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'tokens');

// Tokens with their XRPL Meta icon URLs
const TOKENS = [
  { symbol: 'bear', currency: 'BEAR', issuer: 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW' },
  { symbol: 'rlusd', currency: 'RLUSD', issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De' },
  { symbol: 'solo', currency: 'SOLO', issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz' },
  { symbol: 'core', currency: 'CORE', issuer: 'rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D' },
  { symbol: 'xrph', currency: 'XRPH', issuer: 'rNmKNMsHnpLmLXKL3bvwnqsr6MwxfPGvJf' },
  { symbol: 'hound', currency: 'HOUND', issuer: 'rHoUnDjefFj5GRvqccm1MmxwRpRfgMdq1e' },
  { symbol: 'mag', currency: 'MAG', issuer: 'rXmagwMmnFtVet3uL26Q2iwk287SxYHov' },
  { symbol: 'xpm', currency: 'XPM', issuer: 'rXPMxBeefHGxx3Z3CMFqwzGi3Vt19LHvCR' },
  { symbol: 'csc', currency: 'CSC', issuer: 'rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr' },
  { symbol: 'usdc', currency: 'USDC', issuer: 'rGm7uYknXfn7RhNzEuvwu4p98f3hkRzWhE' },
  { symbol: 'xmeme', currency: 'XMEME', issuer: 'rMeMEz93gAbQfs5LB9bR9XFXBC9u6NEVYt' },
];

// CDN sources to try
const CDN_SOURCES = [
  (c, i) => `https://cdn.xrplmeta.org/icon/${c}:${i}`,
  (c, i) => `https://s1.xrplmeta.org/token/${c}:${i}/icon`,
  (c, i) => `https://cdn.bithomp.com/token/${c}.${i}.png`,
];

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    console.log(`  Trying: ${url}`);

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/*,*/*',
        'Referer': 'https://xrplmeta.org/',
      },
      timeout: 15000,
    };

    https.get(url, options, (response) => {
      // Follow redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        console.log(`  Redirect to: ${response.headers.location}`);
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('image')) {
        reject(new Error(`Not an image: ${contentType}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        // Check file size
        const stats = fs.statSync(destPath);
        if (stats.size < 100) {
          fs.unlinkSync(destPath);
          reject(new Error('File too small'));
          return;
        }
        resolve(destPath);
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', reject).on('timeout', () => reject(new Error('Timeout')));
  });
}

async function downloadToken(token) {
  const destPath = path.join(ICONS_DIR, `${token.symbol}.png`);

  for (const getUrl of CDN_SOURCES) {
    const url = getUrl(token.currency, token.issuer);
    try {
      await downloadFile(url, destPath);
      console.log(`✓ ${token.symbol.toUpperCase()} - downloaded!`);
      return true;
    } catch (err) {
      // Try next source
    }
  }

  console.log(`✗ ${token.symbol.toUpperCase()} - all sources failed`);
  return false;
}

async function main() {
  console.log('Fetching token icons from XRPL CDNs...\n');

  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  let success = 0;
  for (const token of TOKENS) {
    console.log(`\n${token.symbol.toUpperCase()}:`);
    if (await downloadToken(token)) success++;
  }

  console.log(`\n\nDone! ${success}/${TOKENS.length} icons downloaded.`);
}

main().catch(console.error);
