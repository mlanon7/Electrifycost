#!/usr/bin/env node
/*
 * test-sim-state.cjs — unit tests for the Project Simulator's pure state codec
 * (src/lib/sim-codec.ts): URL round-trips, legacy token expansion, and
 * fail-closed handling of unknown scenarios/custom blobs.
 *
 * Ported 1:1 from ProjectCostPro's scripts/test-sim-state.js (32 assertions).
 * The codec is dependency-free TypeScript; esbuild (already in node_modules as
 * an Astro dependency) transpiles it to CJS so the SAME source the site ships
 * is what runs here — no mirror.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'sim-codec.ts'), 'utf8');
const { code } = esbuild.transformSync(src, { loader: 'ts', format: 'cjs' });
const mod = { exports: {} };
new Function('exports', 'module', 'require', code)(mod.exports, mod, require);
const C = mod.exports;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; }
  else { fail++; console.error('  FAIL: ' + name); }
}
function eq(a, b, name) { ok(JSON.stringify(a) === JSON.stringify(b), name + ' (got ' + JSON.stringify(a) + ')'); }

const ctx = {
  hasProject: s => s === 'deck' || s === 'roofing' || s === 'hvac',
  tierNames: () => ['small', 'typical', 'large'],
  savedSnap: s => s === 'roofing' ? {
    low: 9000, high: 15000, sub: '2,000 sq ft roof', qs: 'sq=2000&mode=installed',
    attrs: [['Material', 'Architectural shingles ($4-$6/sf)']],
    brk: { m: [4000, 6000], l: [4500, 8000] }, loc: 'National average'
  } : null
};

// 1. base64url round-trip incl. unicode
ok(C.b64uDec(C.b64uEnc('396 sq ft · Cedar — $16,800')) === '396 sq ft · Cedar — $16,800', 'b64u unicode round-trip');
ok(!/[+/=]/.test(C.b64uEnc('a?b?c?????')), 'b64u output is URL-safe');

// 2. preset + custom encode/decode round-trip
const plan = [
  { slug: 'deck', kind: 'preset', tier: 'large' },
  {
    slug: 'deck', kind: 'custom',
    band: { low: 16762, high: 28812 },
    spec: 'Cedar · 396 sq ft deck - 3.0 ft above grade - 58 lf railing',
    qs: 'len=18&wid=22&mat=cedar&mode=installed',
    locLabel: 'San Francisco metro',
    brk: { m: [6000, 10000], l: [8000, 14000], k: [1500, 2500] }
  }
];
const decoded = C.decodeParam(C.encodeInstances(plan), ctx);
eq(decoded.notices, [], 'round-trip: no notices');
ok(decoded.instances.length === 2, 'round-trip: 2 instances');
eq(decoded.instances[0], { slug: 'deck', kind: 'preset', tier: 'large' }, 'round-trip preset');
const c1 = decoded.instances[1];
ok(c1.kind === 'custom' && c1.band.low === 16762 && c1.band.high === 28812, 'round-trip custom band');
ok(c1.spec === plan[1].spec, 'round-trip custom spec');
ok(c1.qs === plan[1].qs, 'round-trip custom qs');
ok(c1.locLabel === 'San Francisco metro', 'round-trip custom locLabel');
eq(c1.brk, plan[1].brk, 'round-trip custom brk');

// 3. legacy qty token expands to N instances
const leg = C.decodeParam('deck:typical:3,hvac:small:1', ctx);
ok(leg.instances.length === 4, 'legacy qty expansion (3+1)');
ok(leg.instances[0].tier === 'typical' && leg.instances[2].tier === 'typical' && leg.instances[3].tier === 'small', 'legacy tiers kept');

// 4. legacy saved token WITH a local snapshot -> custom instance
const sv = C.decodeParam('roofing:saved:1', ctx);
ok(sv.instances.length === 1 && sv.instances[0].kind === 'custom' && sv.instances[0].band.low === 9000, 'legacy saved uses snapshot');
ok(sv.instances[0].spec.indexOf('Architectural shingles') === 0 && sv.instances[0].spec.indexOf('2,000 sq ft roof') !== -1, 'legacy saved composes spec');
eq(sv.notices, [], 'legacy saved with snapshot: no notice');

// 5. legacy saved WITHOUT snapshot -> visible notice + typical (never large)
const sv2 = C.decodeParam('deck:saved:2', ctx);
ok(sv2.instances.length === 2 && sv2.instances.every(i => i.kind === 'preset' && i.tier === 'typical'), 'saved w/o snapshot fails closed to typical');
ok(sv2.notices.length === 1, 'saved w/o snapshot raises a notice');

// 6. unknown tier -> notice + typical
const ut = C.decodeParam('deck:mega', ctx);
ok(ut.instances.length === 1 && ut.instances[0].tier === 'typical', 'unknown tier fails closed to typical');
ok(ut.notices.length === 1, 'unknown tier raises a notice');

// 7. unknown slug -> skipped + notice
const us = C.decodeParam('gazebo:typical,deck:typical', ctx);
ok(us.instances.length === 1 && us.instances[0].slug === 'deck', 'unknown slug skipped');
ok(us.notices.length === 1, 'unknown slug raises a notice');

// 8. malformed custom payload -> notice + typical fallback
const mf = C.decodeParam('deck:c:!!!notbase64!!!', ctx);
ok(mf.instances.length === 1 && mf.instances[0].kind === 'preset' && mf.instances[0].tier === 'typical', 'malformed custom falls back to typical');
ok(mf.notices.length === 1, 'malformed custom raises a notice');

// 9. absurd custom band -> rejected -> typical + notice
const ab = C.decodeParam('deck:c:' + C.b64uEnc(JSON.stringify({ l: 100, h: 999999999 })), ctx);
ok(ab.instances[0].kind === 'preset' && ab.notices.length === 1, 'absurd band fails closed');

// 10. sanitizeQs blocks breakout, passes real query strings
ok(C.sanitizeQs('len=20&wid=14&mat=composite_premium&mode=installed') === 'len=20&wid=14&mat=composite_premium&mode=installed', 'sanitizeQs passes real qs');
ok(C.sanitizeQs('a=1"><script>alert(1)</script>') === '', 'sanitizeQs rejects markup');
ok(C.sanitizeQs('a=1&b=%20c+d.e-f_g*h~i') !== '', 'sanitizeQs allows URLSearchParams charset');

// 11. cleanBrk validation
eq(C.cleanBrk({ m: [1, 2], junk: [3], l: ['x', 'y'] }), { m: [1, 2] }, 'cleanBrk keeps only valid pairs');
ok(C.cleanBrk({ z: [1, 2] }) === null, 'cleanBrk null when nothing valid');
ok(C.cleanBrk(null) === null, 'cleanBrk null input');

// 12. composeSpec: select values first (parens stripped), then scope sentence
ok(C.composeSpec({ attrs: [['Material', 'Cedar ($8-$12/sf)']], sub: '280 sq ft deck - 5 steps' }) === 'Cedar · 280 sq ft deck - 5 steps', 'composeSpec merges attrs + sub');
ok(C.composeSpec({}) === '', 'composeSpec empty snapshot');

console.log(fail === 0
  ? 'test-sim-state: OK — ' + pass + ' assertions passed'
  : 'test-sim-state: FAILED — ' + fail + ' of ' + (pass + fail) + ' assertions failed');
process.exit(fail === 0 ? 0 : 1);
