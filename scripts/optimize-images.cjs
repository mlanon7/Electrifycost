// One-off / maintenance utility: shrink oversized hero images.
//
// The site serves AVIF first via <picture>, then WebP, with a PNG as the
// <img src> fallback (and the PNG doubles as the og:image). Several hero
// assets were committed at full generator resolution (~1672x941), which:
//   - bloats the deploy (PNGs were 1.6-2.6 MB each), and
//   - trips Ahrefs' "image file size too large" audit (threshold 100 KB) on
//     both the PNG src and the larger WebP files.
//
// Fix: downsize PNG + WebP to the 1200px display width.
//   - PNG  -> palette-quantized, ~300-400 KB. Only used as og:image now
//     (PNG is the safe format for social scrapers); the visible <img src> is
//     switched to WebP in the page templates.
//   - WebP -> quality 78, lands well under 100 KB. Becomes the <img src>.
//   - AVIF is left untouched: it's the primary image for ~98% of browsers,
//     already ~25-45 KB, and we keep it crisp for retina.
//
// Usage: node scripts/optimize-images.cjs           (process in place)
//        node scripts/optimize-images.cjs --dry-run (report only)

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..', 'public');
const MAX_WIDTH = 1200;
const PNG_THRESHOLD = 100 * 1024; // only re-encode PNGs over 100 KB
const DRY = process.argv.includes('--dry-run');

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, out);
    else out.push([full, stat.size]);
  }
  return out;
}

async function reencode(file, origSize) {
  const isPng = /\.png$/i.test(file);
  // Read into a buffer first: on Windows, sharp keeps the input file handle
  // open, which blocks writeFileSync to the same path.
  const input = fs.readFileSync(file);
  const pipeline = sharp(input).resize({ width: MAX_WIDTH, withoutEnlargement: true });
  const buf = isPng
    ? await pipeline.png({ palette: true, quality: 85, effort: 10, compressionLevel: 9 }).toBuffer()
    : await pipeline.webp({ quality: 78, effort: 6 }).toBuffer();
  // Never write a larger file than we started with.
  if (buf.length >= origSize) return null;
  if (!DRY) fs.writeFileSync(file, buf);
  return buf.length;
}

async function main() {
  const all = walk(ROOT);
  let before = 0, after = 0, touched = 0;
  for (const [f, size] of all) {
    const isPng = /\.png$/i.test(f);
    const isWebp = /\.webp$/i.test(f);
    if (isPng && size <= PNG_THRESHOLD) continue;   // small PNGs (icons) left alone
    if (!isPng && !isWebp) continue;                // skip avif + everything else
    const out = await reencode(f, size);
    if (out == null) continue;
    before += size; after += out; touched++;
    const rel = path.relative(ROOT, f).replaceAll(path.sep, '/');
    console.log(`${(size / 1024 | 0)}KB -> ${(out / 1024 | 0)}KB  ${rel}`);
  }
  console.log(`\n${touched} files re-encoded  ${(before / 1048576).toFixed(1)}MB -> ${(after / 1048576).toFixed(1)}MB${DRY ? '  (dry-run)' : ''}`);
}
main();
