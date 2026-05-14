// Validates every .astro page:
//   - <Layout opens == </Layout> closes (catches truncation)
//   - File ends with </Layout> followed by optional whitespace
//   - No <digit Astro Fragment parse traps in body text
// Wired into npm test so truncations never escape again.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const pagesDir = path.join(root, 'src/pages');

function walk(dir, acc) {
  acc = acc || [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, acc);
    else if (entry.isFile() && entry.name.endsWith('.astro')) acc.push(p);
  }
  return acc;
}

const files = walk(pagesDir);
let errs = 0;

for (const f of files) {
  const raw = fs.readFileSync(f, 'utf8');
  const text = raw.replace(/\x00+/g, '');
  const rel = path.relative(root, f).replace(/\\/g, '/');

  const opens = (text.match(/<Layout[\s>]/g) || []).length;
  const closes = (text.match(/<\/Layout>/g) || []).length;
  if (opens !== closes) {
    console.error('  LAYOUT ' + rel + ' opens=' + opens + ' closes=' + closes);
    errs++;
  }

  if (opens > 0) {
    const trimmed = text.trimEnd();
    if (!trimmed.endsWith('</Layout>')) {
      console.error('  ENDING ' + rel + ' does not end with </Layout> (got "...' + trimmed.slice(-40) + '")');
      errs++;
    }
  }

  const frontEnd = text.indexOf('---', 4);
  const body = frontEnd >= 0 ? text.slice(frontEnd + 3) : text;
  const stripped = body
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\{[\s\S]*?\}/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const trap = stripped.match(/<\d/);
  if (trap) {
    console.error('  FRAGMENT ' + rel + ' literal less-than digit: "' + trap[0] + '". Use named entity instead.');
    errs++;
  }
}

if (errs === 0) {
  console.log('OK: validated ' + files.length + ' .astro pages');
  process.exit(0);
}
console.error('FAILED: ' + errs + ' page issue(s)');
process.exit(1);
