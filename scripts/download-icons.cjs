/**
 * BEAR MARKET - Token Icon Downloader
 *
 * Downloads token icons from multiple sources and saves them locally.
 * Run with: node scripts/download-icons.js
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Output directory
const ICONS_DIR = path.join(__dirname, '..', 'public', 'tokens');

// Token list with multiple icon sources to try
const TOKENS = [
  {
    symbol: 'BEAR',
    currency: 'BEAR',
    issuer: 'rBEARGUAsyu7tUw53rufQzFdWmJHpJEqFW',
  },
  {
    symbol: 'RLUSD',
    currency: 'RLUSD',
    issuer: 'rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De',
  },
  {
    symbol: 'SOLO',
    currency: 'SOLO',
    issuer: 'rsoLo2S1kiGeCcn6hCUXVrCpGMWLrRrLZz',
  },
  {
    symbol: 'CORE',
    currency: 'CORE',
    issuer: 'rcoreNywaoz2ZCQ8Lg2EbSLnGuRBmun6D',
  },
  {
    symbol: 'XRPH',
    currency: 'XRPH',
    issuer: 'rNmKNMsHnpLmLXKL3bvwnqsr6MwxfPGvJf',
  },
  {
    symbol: 'FUZZY',
    currency: 'FUZZY',
    issuer: 'rhCAT4hRdi1J4fh1LK5qcUTsVcGWxNpVjh',
  },
  {
    symbol: 'ARMY',
    currency: 'ARMY',
    issuer: 'rGG3wQ4kfSgJgHRpWPAu5NxVA18q6gcSnZ',
  },
  {
    symbol: 'DROP',
    currency: 'DROP',
    issuer: 'rszenFJoDdicWqfK2F9U9VWTxqEfB2HNJ6',
  },
  {
    symbol: 'VGB',
    currency: 'VGB',
    issuer: 'rhcyBrowwApgNonehVqrg6JgzqaM1DLRv8',
  },
  {
    symbol: 'MAG',
    currency: 'MAG',
    issuer: 'rXmagwMmnFtVet3uL26Q2iwk287SxYHov',
  },
  {
    symbol: 'XPM',
    currency: 'XPM',
    issuer: 'rXPMxBeefHGxx3Z3CMFqwzGi3Vt19LHvCR',
  },
  {
    symbol: 'XMEME',
    currency: 'XMEME',
    issuer: 'rMeMEz93gAbQfs5LB9bR9XFXBC9u6NEVYt',
  },
  {
    symbol: 'EUROP',
    currency: 'EUROP',
    issuer: 'rMkEJxjXRV7SvDaGP3tX4MQ3pWyvnfLLjg',
  },
  {
    symbol: 'USDC',
    currency: 'USDC',
    issuer: 'rGm7uYknXfn7RhNzEuvwu4p98f3hkRzWhE',
  },
  {
    symbol: 'CSC',
    currency: 'CSC',
    issuer: 'rCSCManTZ8ME9EoLrSHHYKW8PPwWMgkwr',
  },
  {
    symbol: 'HOUND',
    currency: 'HOUND',
    issuer: 'rHoUnDjefFj5GRvqccm1MmxwRpRfgMdq1e',
  },
];

// Icon sources to try (in order)
function getIconUrls(currency, issuer) {
  return [
    `https://s1.xrplmeta.org/token/${currency}:${issuer}/icon`,
    `https://cdn.xrplmeta.org/icon/${currency}:${issuer}`,
    `https://cdn.bithomp.com/token/${currency}.${issuer}.png`,
    `https://raw.githubusercontent.com/AnyNodes/XRPL-Tokens/main/icons/${currency}_${issuer}.png`,
  ];
}

// Download a file from URL
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'BEAR-MARKET-Icon-Downloader/1.0'
      }
    }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      // Check content type
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('image')) {
        reject(new Error(`Not an image: ${contentType}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        resolve(destPath);
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {}); // Delete partial file
        reject(err);
      });
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Download icon for a token (try multiple sources)
async function downloadTokenIcon(token) {
  const urls = getIconUrls(token.currency, token.issuer);
  const destPath = path.join(ICONS_DIR, `${token.symbol.toLowerCase()}.png`);

  // Check if already exists
  if (fs.existsSync(destPath)) {
    console.log(`✓ ${token.symbol} - already exists`);
    return true;
  }

  for (const url of urls) {
    try {
      await downloadFile(url, destPath);
      console.log(`✓ ${token.symbol} - downloaded from ${new URL(url).hostname}`);
      return true;
    } catch (err) {
      // Try next URL
    }
  }

  console.log(`✗ ${token.symbol} - FAILED (no source worked)`);
  return false;
}

// Main
async function main() {
  console.log('BEAR MARKET - Token Icon Downloader\n');

  // Create output directory
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  console.log(`Downloading to: ${ICONS_DIR}\n`);

  let success = 0;
  let failed = 0;

  for (const token of TOKENS) {
    const result = await downloadTokenIcon(token);
    if (result) success++;
    else failed++;
  }

  console.log(`\nDone! ${success} downloaded, ${failed} failed.`);

  // Generate manifest
  const manifest = TOKENS.map(t => ({
    symbol: t.symbol,
    currency: t.currency,
    issuer: t.issuer,
    localPath: `/tokens/${t.symbol.toLowerCase()}.png`,
    hasIcon: fs.existsSync(path.join(ICONS_DIR, `${t.symbol.toLowerCase()}.png`))
  }));

  fs.writeFileSync(
    path.join(ICONS_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log('Generated manifest.json');
}

main().catch(console.error);
