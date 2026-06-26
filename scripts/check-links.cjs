// External-link checker for citation health.
//
// Extracts every external http(s) URL from src/**, src/data/*.json, and data/csv/*.csv,
// fetches each (following redirects, with a browser UA), and reports DEAD links (404/410).
// Government / vendor sites that rate-limit or block crawlers (403/429/503/000) are listed
// separately as "blocked/transient" and do NOT fail the run — verify those by hand.
//
// Usage:
//   node scripts/check-links.cjs            # check, exit 1 if any 404/410 found
//   node scripts/check-links.cjs --json     # machine-readable output
//   node scripts/check-links.cjs --all      # also print blocked/transient + ok counts
//
// This is intentionally NOT in `npm test` (network-dependent, slow, and gov sites flap).
// Run it before a release or on a schedule.

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

const CONCURRENCY = 12;
const TIMEOUT_MS = 12000;
const UA = 'Mozilla/5.0 (compatible; ElectrifyCostLinkCheck/1.0)';

// Own domain + infra/JSON-LD contexts that never need citation-checking.
const SKIP = [
  /electrifycost\.com/, /schema\.org/, /w3\.org/, /fonts\.googleapis/,
  /googletagmanager/, /google-analytics/, /\bexample\.com/,
];

// Bot-hostile sites that return 403 / timeout / misleading 404 to automated checkers
// but are live for real users (verified by hand 2026-06-25). Reported as "blocked",
// never "dead", so they don't fail the gate. Re-verify in a real browser if removing.
const KNOWN_BLOCKED = new Set([
  'https://www.mass.gov/orgs/department-of-energy-resources',
  'https://www.grundfos.com/us/products/find-product/comfort-system-pm-pumps',
  'https://www.mieleusa.com/c/heat-pump-tumble-dryers-1452.htm',
]);

function walk(dir, exts, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, exts, out);
    else if (exts.some(x => e.name.endsWith(x))) out.push(p);
  }
  return out;
}

// Collect URL -> Set(files that reference it).
const refs = new Map();
const files = [
  ...walk(path.join(root, 'src'), ['.astro', '.ts', '.tsx', '.js']),
  ...(fs.existsSync(path.join(root, 'src/data')) ? walk(path.join(root, 'src/data'), ['.json']) : []),
  ...walk(path.join(root, 'data/csv'), ['.csv']),
];
const URL_RE = /https?:\/\/[^\s"'<>)\],]+/g;
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = URL_RE.exec(text)) !== null) {
    let url = m[0].replace(/[.;]+$/, '');
    if (SKIP.some(re => re.test(url))) continue;
    if (!refs.has(url)) refs.set(url, new Set());
    refs.get(url).add(path.relative(root, f));
  }
}

const urls = [...refs.keys()].sort();

async function check(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    let res = await fetch(url, { method: 'GET', redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } });
    return res.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(t);
  }
}

(async () => {
  const json = process.argv.includes('--json');
  const all = process.argv.includes('--all');
  const results = [];
  let i = 0;
  async function worker() {
    while (i < urls.length) {
      const url = urls[i++];
      const status = await check(url);
      results.push({ url, status, files: [...refs.get(url)] });
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const ok = results.filter(r => r.status >= 200 && r.status < 400);
  const dead = results.filter(r => (r.status === 404 || r.status === 410) && !KNOWN_BLOCKED.has(r.url));
  const blocked = results.filter(r => !ok.includes(r) && !dead.includes(r));

  if (json) {
    console.log(JSON.stringify({ total: urls.length, ok: ok.length, blocked: blocked.length, dead }, null, 2));
  } else {
    console.log(`Checked ${urls.length} external URLs: ${ok.length} ok, ${blocked.length} blocked/transient, ${dead.length} DEAD`);
    if (dead.length) {
      console.log('\nDEAD (404/410):');
      for (const d of dead.sort((a, b) => a.url.localeCompare(b.url))) {
        console.log(`  ${d.url}\n    in: ${d.files.join(', ')}`);
      }
    }
    if (all && blocked.length) {
      console.log('\nblocked/transient (verify by hand):');
      for (const b of blocked.sort((a, b) => a.url.localeCompare(b.url))) console.log(`  ${b.status || 'ERR'}  ${b.url}`);
    }
  }
  process.exit(dead.length ? 1 : 0);
})();
