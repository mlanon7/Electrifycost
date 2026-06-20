// IndexNow submission — instantly notify Bing (and Yandex, Seznam, etc.)
// about new or changed URLs. Bing Webmaster Tools' top recommendation for
// this site; Bing + DuckDuckGo are ~half of current search referrers and
// Bing indexes new domains faster than Google.
//
// Ownership is proven by the public key file at the site root:
//   https://electrifycost.com/f26b605a0e104a478e1c474408dac0b5.txt
// (IndexNow keys are NOT secret — they are designed to be hosted publicly.)
//
// Usage:
//   node scripts/indexnow-submit.cjs                 # submit ALL sitemap URLs (dist/sitemap.xml)
//   node scripts/indexnow-submit.cjs <url> [url...]  # submit only the given URLs (use after shipping new pages)
//   node scripts/indexnow-submit.cjs --dry-run       # print what would be sent, don't POST
//
// Submit only NEW/CHANGED URLs on routine deploys — re-submitting the whole
// site every time can trip IndexNow's spam throttle (HTTP 429). A one-time
// full-sitemap submission at setup is fine and recommended.

const fs = require('fs');
const path = require('path');

const KEY = 'f26b605a0e104a478e1c474408dac0b5';
const HOST = 'electrifycost.com';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_PER_REQUEST = 10000; // IndexNow hard limit

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const urlArgs = args.filter(a => !a.startsWith('--'));

function sitemapUrls() {
  const p = path.resolve(__dirname, '..', 'dist', 'sitemap.xml');
  if (!fs.existsSync(p)) {
    console.error('dist/sitemap.xml not found — run `npm run build` first, or pass URLs explicitly.');
    process.exit(1);
  }
  const xml = fs.readFileSync(p, 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim());
}

(async () => {
  let urls = urlArgs.length ? urlArgs : sitemapUrls();
  // All URLs must be on HOST (IndexNow rejects cross-host with 422).
  const offHost = urls.filter(u => { try { return new URL(u).host !== HOST; } catch { return true; } });
  if (offHost.length) {
    console.error(`Refusing: ${offHost.length} URL(s) are not on ${HOST}, e.g. ${offHost[0]}`);
    process.exit(1);
  }
  if (urls.length > MAX_PER_REQUEST) urls = urls.slice(0, MAX_PER_REQUEST);

  console.log(`IndexNow → ${ENDPOINT}`);
  console.log(`  host=${HOST}  key=${KEY.slice(0, 8)}…  urls=${urls.length}`);
  if (dryRun) { urls.slice(0, 10).forEach(u => console.log('  ' + u)); if (urls.length > 10) console.log(`  …and ${urls.length - 10} more`); return; }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls }),
  });
  const text = await res.text().catch(() => '');
  console.log(`Response: HTTP ${res.status} ${res.statusText}${text ? ' — ' + text : ''}`);
  // 200 OK / 202 Accepted are success. 403 = key not verified; 422 = host/key mismatch; 429 = throttled.
  process.exit(res.status === 200 || res.status === 202 ? 0 : 1);
})();
