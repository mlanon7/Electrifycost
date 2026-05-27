// Final pass: for any hero photo still over 85 KB after pass 2, resize from
// 1200×675 → 1100×619 and re-encode at quality 70. Hero photos render at
// most ~700px wide on real screens — resizing is invisible.

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.resolve(__dirname, '..', 'public/assets/topic-images');
const TARGET = 85 * 1024;

async function encodeAt(buf, ext, q, resize) {
  let pipe = sharp(buf);
  if (resize) pipe = pipe.resize({ width: 1100, height: 619, fit: 'inside', withoutEnlargement: true });
  if (ext === 'jpg' || ext === 'jpeg') return await pipe.jpeg({ quality: q, progressive: true, mozjpeg: true }).toBuffer();
  if (ext === 'webp') return await pipe.webp({ quality: q }).toBuffer();
  if (ext === 'avif') return await pipe.avif({ quality: q }).toBuffer();
  return null;
}

(async () => {
  const files = fs.readdirSync(DIR).filter(f => /\.(jpg|jpeg|webp|avif)$/i.test(f));
  let reduced = 0;
  for (const f of files) {
    const src = path.join(DIR, f);
    const sz = fs.statSync(src).size;
    if (sz <= TARGET) continue;
    const ext = path.extname(f).slice(1).toLowerCase();
    const buf = fs.readFileSync(src);
    try {
      // Try resize + quality 70 first
      let out = await encodeAt(buf, ext, 70, true);
      if (out && out.length > TARGET) {
        // Still too big — try quality 60 with resize
        const alt = await encodeAt(buf, ext, 60, true);
        if (alt && alt.length < out.length) out = alt;
      }
      if (out && out.length < sz) {
        fs.writeFileSync(src, out);
        console.log('  ' + sz.toString().padStart(7) + ' → ' + out.length.toString().padStart(7) + '  ' + f);
        reduced++;
      }
    } catch (e) {
      console.error('  ERROR ' + f + ' — ' + e.message);
    }
  }
  console.log('\nResize+recompress pass done. Reduced ' + reduced + ' files.');
  const stillOver = fs.readdirSync(DIR).filter(f => /\.(jpg|jpeg|webp|avif)$/i.test(f) && fs.statSync(path.join(DIR, f)).size > TARGET);
  console.log('Files still over ' + Math.round(TARGET/1024) + ' KB: ' + stillOver.length);
  for (const f of stillOver) console.log('  ' + fs.statSync(path.join(DIR, f)).size + '  ' + f);
})();
