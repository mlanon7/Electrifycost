// Post-build content audit: scans dist/ for the on-page SEO issues Ahrefs
// flags, so we can catch them before deploy. Run after `astro build`.
// Reports: meta descriptions too long (>160) / too short (<70), <title> too
// long (>60), and orphan pages (no inbound internal links from other pages).
//
// Usage: node scripts/audit-scan.cjs

const fs = require('fs');
const path = require('path');

const DIST = path.resolve(__dirname, '..', 'dist');
const DESC_MAX = 160, DESC_MIN = 70, TITLE_MAX = 60;

function walk(dir, out = []) {
  for (const n of fs.readdirSync(dir)) {
    const f = path.join(dir, n);
    const s = fs.statSync(f);
    if (s.isDirectory()) walk(f, out);
    else if (n === 'index.html') out.push(f);
  }
  return out;
}
function urlOf(f) {
  let p = '/' + path.relative(DIST, f).replaceAll(path.sep, '/').replace(/index\.html$/, '');
  if (p !== '/' && !p.endsWith('/')) p += '/';
  return p;
}
function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '’').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—');
}
// Collapse variable URL segments so template-driven pages cluster together.
function shape(u) {
  return u
    .replace(/-[a-z]{2}\/$/, '-{ST}/')
    .replace(/\/[a-z-]+-[a-z]{2}\/$/, m => m.replace(/[a-z-]+-[a-z]{2}\//, '{CITY}/'))
    .replace(/\d+(\.\d+)?/g, '{N}');
}

const pages = new Map();
const noSlash = new Set(); // internal links missing trailing slash (3XX risk)
for (const f of walk(DIST)) {
  const html = fs.readFileSync(f, 'utf8');
  const url = urlOf(f);
  const tm = html.match(/<title>([^<]*)<\/title>/i);
  const dm = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
  const links = new Set();
  const re = /href="([^"]+)"/g; let m;
  while ((m = re.exec(html))) {
    const v = m[1];
    if (!v.startsWith('/')) continue;          // external or pure anchor
    const clean = v.split('#')[0].split('?')[0];
    if (clean === '') continue;
    if (!clean.endsWith('/') && !/\.[a-z0-9]+$/i.test(clean)) noSlash.add(clean);
    links.add(clean.endsWith('/') ? clean : clean + '/');
  }
  pages.set(url, { title: tm ? decode(tm[1]) : '', desc: dm ? decode(dm[1]) : '', links });
}
const linkedTo = new Set();
for (const { links } of pages.values()) for (const l of links) linkedTo.add(l);

const longDesc = [], shortDesc = [], longTitle = [], orphans = [];
for (const [url, p] of pages) {
  if (p.desc.length > DESC_MAX) longDesc.push([url, p.desc.length]);
  if (p.desc.length < DESC_MIN) shortDesc.push([url, p.desc.length]);
  if (p.title.length > TITLE_MAX) longTitle.push([url, p.title.length]);
  if (url !== '/' && !linkedTo.has(url)) orphans.push(url);
}

// Cluster long descriptions by template shape.
const clusters = new Map();
for (const [u, n] of longDesc) {
  const k = shape(u);
  if (!clusters.has(k)) clusters.set(k, { count: 0, max: 0, sample: u });
  const c = clusters.get(k); c.count++; c.max = Math.max(c.max, n);
}

console.log('PAGES:', pages.size);
console.log('\n== meta description TOO LONG (>' + DESC_MAX + '):', longDesc.length, '— by template:');
for (const [k, c] of [...clusters].sort((a, b) => b[1].count - a[1].count))
  console.log('  ' + String(c.count).padStart(4) + '  max=' + c.max + '  ' + k);
console.log('\n== meta description TOO SHORT (<' + DESC_MIN + '):', shortDesc.length);
for (const [u, n] of shortDesc.sort((a, b) => a[1] - b[1])) console.log('  ' + n + '  ' + u);
console.log('\n== title TOO LONG (>' + TITLE_MAX + '):', longTitle.length);
for (const [u, n] of longTitle.sort((a, b) => b[1] - a[1])) console.log('  ' + n + '  ' + u);
console.log('\n== ORPHAN pages (no inbound internal links):', orphans.length);
for (const u of orphans.sort()) console.log('  ' + u);
console.log('\n== internal links MISSING trailing slash (3XX redirect risk):', noSlash.size);
for (const u of [...noSlash].sort()) console.log('  ' + u);
console.log('\n== shortest descriptions (watch for too-short, <110):');
for (const [u, p] of [...pages].sort((a, b) => a[1].desc.length - b[1].desc.length).slice(0, 12))
  console.log('  ' + p.desc.length + '  ' + u);
