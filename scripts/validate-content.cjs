// Content-accuracy regression guard.
// Scans published copy (src/pages, src/components) for banned strings: stale
// incentive figures and mislabeled federal credits that prior audits corrected,
// plus a few high-signal AI-slop tells from STYLEGUIDE.md.
//
// Keep the list HIGH-SIGNAL: every pattern must have effectively zero legitimate
// use in this site's copy, so the gate never forces an awkward false-positive
// reword. Added after the 2026-06-25 Codex audit, which found these exact classes
// of stale copy lingering in guide/comparison pages after the data was corrected.
//
// Part of the npm test chain. Fail fast on any match.

const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');

// { re, why } — why is printed so a future contributor knows the correct value.
const BANNED = [
  { re: /Mass Save\s+(up to\s+)?\$10,000/i,
    why: 'Stale Mass Save cap. The whole-home cap dropped to $8,500 effective 2026-01-01 (see rebate-programs.csv MA_MASS_HP).' },
  { re: /30D residential clean energy/i,
    why: 'Wrong credit code. Residential solar/battery/geothermal is the 25D credit; 30D is the new clean-vehicle credit.' },
  { re: /Credit ends 2026-09-30/i,
    why: 'Wrong sunset date. 30D/25E ended for vehicles acquired after 2025-09-30, not 2026-09-30.' },
  { re: /\bultimate guide\b/i,
    why: 'AI-slop superlative (STYLEGUIDE blacklist). State the specific scope instead.' },
  { re: /\b(let's |lets )?dive into\b/i,
    why: 'AI-slop filler (STYLEGUIDE blacklist). Delete the preamble and state the thing.' },
];

const TARGET_DIRS = ['src/pages', 'src/components'];

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.fuse_hidden')) continue; // stray FUSE temp files, not real source
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith('.astro')) out.push(p);
  }
  return out;
}

let errs = 0;
let scanned = 0;
for (const dir of TARGET_DIRS) {
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) continue;
  for (const file of walk(abs)) {
    scanned++;
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      for (const { re, why } of BANNED) {
        if (re.test(line)) {
          console.error('  BANNED ' + path.relative(root, file) + ':' + (i + 1) + '  ' + why);
          console.error('         ' + line.trim().slice(0, 160));
          errs++;
        }
      }
    });
  }
}

if (errs === 0) {
  console.log('OK: scanned ' + scanned + ' .astro files, no banned content strings');
  process.exit(0);
}
console.error('FAILED: ' + errs + ' banned content string(s)');
process.exit(1);
