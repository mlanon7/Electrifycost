// Compress hero PNGs to AVIF + WebP using imagemagick.
// Originals kept as PNG fallback. Run during build.

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', 'public', 'assets', 'topic-images');

if (!fs.existsSync(DIR)) {
  console.error('topic-images dir not found:', DIR);
  process.exit(1);
}

function run(args) {
  const r = spawnSync('convert', args, { stdio: 'pipe', encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || 'convert failed');
  }
}

const png = fs.readdirSync(DIR).filter(f => f.endsWith('-hero-photo.png'));
let totalIn = 0, totalOut = 0, made = 0;

for (const fname of png) {
  const src = path.join(DIR, fname);
  const base = fname.replace(/\.png$/, '');
  const avif = path.join(DIR, base + '.avif');
  const webp = path.join(DIR, base + '.webp');
  const srcStat = fs.statSync(src);
  totalIn += srcStat.size;

  const needsAvif = !fs.existsSync(avif) || fs.statSync(avif).mtimeMs < srcStat.mtimeMs;
  const needsWebp = !fs.existsSync(webp) || fs.statSync(webp).mtimeMs < srcStat.mtimeMs;

  try {
    if (needsAvif) {
      // Resize-on-shrink: `1440x1440>` only shrinks if larger
      run([src, '-resize', '1440x1440>', '-quality', '55', avif]);
      made++;
    }
    if (needsWebp) {
      run([src, '-resize', '1440x1440>', '-quality', '75', webp]);
      made++;
    }
    totalOut += fs.statSync(avif).size + fs.statSync(webp).size;
    console.log(`  ${base}: PNG ${(srcStat.size/1024).toFixed(0)}K  AVIF ${(fs.statSync(avif).size/1024).toFixed(0)}K  WebP ${(fs.statSync(webp).size/1024).toFixed(0)}K`);
  } catch (e) {
    console.error(`  ${fname}: convert failed:`, e.message.split('\n')[0]);
  }
}

console.log(`\n[compress] processed ${png.length} hero PNGs, ${made} new derivatives.`);
console.log(`[compress] original PNGs ${(totalIn / 1024 / 1024).toFixed(1)} MB`);
console.log(`[compress] AVIF+WebP    ${(totalOut / 1024 / 1024).toFixed(1)} MB`);
