// Custom sitemap generator. Runs after `astro build` and walks dist/ for
// index.html files to emit dist/sitemap.xml. Replaces @astrojs/sitemap which
// was crashing against Astro 4.16.19. Trade-off: no automatic priority/changefreq
// per route; we hardcode sensible defaults below.
//
// Usage: `node scripts/build-sitemap.cjs` (called from package.json build).

const fs = require('fs');
const path = require('path');

const SITE = 'https://electrifycost.com';
const DIST = path.resolve(__dirname, '..', 'dist');
const TODAY = new Date().toISOString().slice(0, 10);

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else if (name === 'index.html') out.push(full);
    else if (name === '404.html') continue;
  }
  return out;
}

function priorityFor(urlPath) {
  if (urlPath === '/') return '1.0';
  if (/^\/[a-z0-9-]+-cost-calculator\/$/.test(urlPath)) return '0.9';
  if (/-cost-[a-z]{2}\/$/.test(urlPath)) return '0.7';
  if (/^\/guides\//.test(urlPath)) return '0.7';
  if (/-vs-/.test(urlPath)) return '0.7';
  return '0.6';
}

function changefreqFor(urlPath) {
  if (urlPath === '/' || /-cost-calculator\/$/.test(urlPath)) return 'weekly';
  return 'monthly';
}

function main() {
  if (!fs.existsSync(DIST)) {
    console.error(`[sitemap] dist/ not found. Run astro build first.`);
    process.exit(1);
  }
  const files = walk(DIST);
  const urls = files.map(f => {
    const rel = path.relative(DIST, f).replaceAll(path.sep, '/');
    let urlPath = '/' + rel.replace(/index\.html$/, '');
    if (urlPath !== '/' && !urlPath.endsWith('/')) urlPath += '/';
    return urlPath;
  }).filter(u => !u.startsWith('/_'));

  urls.sort();
  const entries = urls.map(u => `  <url>
    <loc>${SITE}${u}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${changefreqFor(u)}</changefreq>
    <priority>${priorityFor(u)}</priority>
  </url>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">
${entries}
</urlset>
`;
  fs.writeFileSync(path.join(DIST, 'sitemap.xml'), xml);
  console.log(`[sitemap] wrote ${urls.length} URLs to dist/sitemap.xml`);
}
main();
