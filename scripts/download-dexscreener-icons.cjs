/**
 * BEAR MARKET - Download DexScreener Icons Locally
 *
 * Downloads all known token icons from DexScreener CDN
 * and saves them locally for fast, reliable loading.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ICONS_DIR = path.join(__dirname, '..', 'public', 'tokens');

// All DexScreener icon URLs we've collected
const DEXSCREENER_ICONS = {
  'BEAR': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/bear.rbearguasyu7tuw53rufqzfdwmjhpjeqfw.png',
  'MAG': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/mag.rxmagwmmnftvt3ul26q2iwk287sxyhov.png',
  'XPM': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/xpm.rxpmxbeefhgxx3z3cmfqwzgi3vt19lhvcr.png',
  'ARMY': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/army.rgg3wq4kfsggjghrppau5nxva18q6gcsnz.png',
  'FUZZY': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/fuzzy.rhcat4hrdi1j4fh1lk5qcutsvccwxnpvjh.png',
  'DROP': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/drop.rszenfjoddiczqfk2f9u9vwtxqefb2hnsj6.png',
  'CSC': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/csc.rcscmantz8me9eolrshyhkw8ppwwmgkwr.png',
  'PHNIX': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/phnix.png',
  'SLT': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/slt.png',
  'SIGMA': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/sigma.png',
  'CULT': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/cult.png',
  'JELLY': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/jelly.png',
  'GOAT': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/goat.png',
  'OLX': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/olx.png',
  'CO2': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/co2.png',
  'MALLARD': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/mallard.png',
  '666': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/666.png',
  '589': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/589.png',
  'DONNIE': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/donnie.png',
  'SEAL': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/seal.png',
  'CBIRD': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/cbird.png',
  'FLIPPY': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/flippy.png',
  'BERT': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/bert.png',
  'PIGEONS': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/pigeons.png',
  'ATM': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/atm.png',
  'Horizon': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/horizon.png',
  'Opulence': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/opulence.png',
  'bull': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/bull.png',
  'scrap': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/scrap.png',
  'XDawgs': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/xdawgs.png',
  'COBALT': 'https://dd.dexscreener.com/ds-data/tokens/xrpl/cobalt.png',
};

// Alternative: Use the CMS image URLs (these definitely work)
const CMS_ICONS = {
  'BEAR': 'https://cdn.dexscreener.com/cms/images/aa9f8178c7bd1e8b6ec7d36c26ade56149f751a3227ff9df763030034739bbe5',
  'MAG': 'https://cdn.dexscreener.com/cms/images/23a66da0d3b631ebec758f5cfd0c85a6ca98dbb9cf2b7340be9bd0069b8c1a3c',
  'XPM': 'https://cdn.dexscreener.com/cms/images/52e1af2085e486325ba71f8290551f469a08a24afd9f35b7a91201c0de525506',
  'ARMY': 'https://cdn.dexscreener.com/cms/images/ed1f6d19db7e44c91785ffa0d1082ffb3e0a0da0c93027d307ccb246e17cdb92',
  'FUZZY': 'https://cdn.dexscreener.com/cms/images/3cf16daefe237f160d943e53324a200b90fbe982ea43300c872c5f5bca60941c',
  'DROP': 'https://cdn.dexscreener.com/cms/images/237caaf20769c4f611c3c242dc33da0c665c22fd2240c44f989f04a8514d5811',
  'CSC': 'https://cdn.dexscreener.com/cms/images/7961c5de7298f3436610f8c496dd142561251933133b6382178ff71482ba1de9',
  'PHNIX': 'https://cdn.dexscreener.com/cms/images/45ac1f4fde3c704c57789ac0399336cbb1b9afc6724b3ffd76b2a6b344ef0089',
  'SLT': 'https://cdn.dexscreener.com/cms/images/2447af16f7dbc28426615c32424277fecf0f5e5968198f441acaa46c1d8f8bbe',
  'SIGMA': 'https://cdn.dexscreener.com/cms/images/0d842ca17f4b5ab92f237abf8c2aa47b6fed14b5e420645d3473f4a1bedbb652',
  'CULT': 'https://cdn.dexscreener.com/cms/images/c64a0f792ff19f8468f898280fa67ed85cbde57e15d374dad6188cb39355cacc',
  'JELLY': 'https://cdn.dexscreener.com/cms/images/a635c021e7a0ada3163e5e12b052b6e637ad3bb7013b1c2b13a7206c8d3ed892',
  'GOAT': 'https://cdn.dexscreener.com/cms/images/86db2add041f94699931d7d0a845da3c7f154f5ef8e55027c475c0beaa459731',
  'OLX': 'https://cdn.dexscreener.com/cms/images/4bd3efc5218579a57c9d213e09df10ee3b2f89cf47af1510ffa1db17bf8604b8',
  'CO2': 'https://cdn.dexscreener.com/cms/images/c9f7be92f53c521cc090912c47e5d749f2c3f721a2f9b5e0ae5cc15c1dce41e5',
  'MALLARD': 'https://cdn.dexscreener.com/cms/images/f6b5ef097295e1b083d6d2832022615980d1d90d681a95b45f7b5de2c49b64f1',
  '666': 'https://cdn.dexscreener.com/cms/images/44fe722a5aea5847e8ed441246d8d0a604654f60a22da3e4ec82264fd7e287cf',
  '589': 'https://cdn.dexscreener.com/cms/images/4a0969cf5787f495af665a95dfbfaf80c29c46ed93514b642e892d37a7291e46',
  'DONNIE': 'https://cdn.dexscreener.com/cms/images/80fdacbe116bd052b11327e926aab415197a33609b0c648854e1d98713197ef3',
  'SEAL': 'https://cdn.dexscreener.com/cms/images/69878be5f14ae0e0cbaaa45178d3190ae38b97d51ab2882b60ba8ef2349dd2f9',
  'CBIRD': 'https://cdn.dexscreener.com/cms/images/c63349105d407605fd2908c1bbc34af4dea74b68e50fdda51ee2b65c78d34212',
  'FLIPPY': 'https://cdn.dexscreener.com/cms/images/c7dfd777f4c7ba098acbaa9bb63816a6b86c6aa8ac1321bfdd3fab4b891f28e3',
  'BERT': 'https://cdn.dexscreener.com/cms/images/d85a51a786ac61c7668ae38c256eab88a77dc87b3af7acd1c82e3145a45df1b3',
  'PIGEONS': 'https://cdn.dexscreener.com/cms/images/5fa79ec7f125929e17daa181f8c297898712d973679cfc3227edcb299c36259c',
  'ATM': 'https://cdn.dexscreener.com/cms/images/b912ada213e37a79135c3ee3c8ca21818b5c4dce5db5f8909fd4654fcc850caf',
  'Horizon': 'https://cdn.dexscreener.com/cms/images/f911fea0b87e05aa260aab697dfd7e8e12f6816297d048e9afa3512b6ca74d0e',
  'Opulence': 'https://cdn.dexscreener.com/cms/images/2e378aded56e20773293e584bc61c915c8e8c8972545d568b14aed250af28c87',
  'bull': 'https://cdn.dexscreener.com/cms/images/364494165161887247a37fafc7691d300191ad605b9408faf5aeefea82c75a00',
  'scrap': 'https://cdn.dexscreener.com/cms/images/26837eb3fc7c1d2f7f060adad69e1aa50b3c2ffcba72b760ac6d9b97359450b9',
  'XDawgs': 'https://cdn.dexscreener.com/cms/images/795c5d8e76b2e0df8c48740e1f37a6104695dfbca8a99eeef4aa83b0c2fc28b6',
  'COBALT': 'https://cdn.dexscreener.com/cms/images/394986e68744d2f78f1a83dccb13a8e91adace7e51ec700c93ec44ec52327177',
};

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : require('http');

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
      },
      timeout: 10000,
    };

    protocol.get(url, options, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
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

async function main() {
  console.log('Downloading DexScreener icons locally...\n');

  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }

  let success = 0;
  let failed = 0;

  for (const [symbol, url] of Object.entries(CMS_ICONS)) {
    const destPath = path.join(ICONS_DIR, `${symbol.toLowerCase()}.png`);

    // Skip if already exists
    if (fs.existsSync(destPath)) {
      console.log(`✓ ${symbol} - already exists`);
      success++;
      continue;
    }

    console.log(`Downloading ${symbol}...`);
    try {
      await downloadFile(url, destPath);
      console.log(`✓ ${symbol} - downloaded!`);
      success++;
    } catch (err) {
      console.log(`✗ ${symbol} - failed: ${err.message}`);
      failed++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log(`\nDone! ${success} downloaded, ${failed} failed.`);
}

main().catch(console.error);
