#!/usr/bin/env node
/*
 * scripts/test-montecarlo.cjs — headless validation of src/lib/montecarlo.js.
 * Run: node scripts/test-montecarlo.cjs
 * Validates the EMERGENT engine: triangular + Gaussian-copula correlation,
 * markup scaling, no pinning (emergent range is tighter than the naive band),
 * right-skew (mode < median < mean), correlation widening, events tail,
 * no NaN, performance, determinism.
 *
 * Ported verbatim from ProjectCostPro. The fixtures are generic cost bands that
 * exercise the engine math (not ElectrifyCost data); they assert the calibration
 * holds. Do not retune montecarlo.js without keeping these green.
 */
const MC = require('../src/lib/montecarlo.js');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? '  -> ' + detail : '')); }
}
const approx = (a, b, tol) => Math.abs(a - b) <= tol;
const money = n => '$' + Math.round(n).toLocaleString();

/* 1. building-block sanity */
(function () {
  ok('normalCDF(0) = 0.5', approx(MC._internals.normalCDF(0), 0.5, 1e-6));
  ok('normalCDF(1.2816) ≈ 0.9', approx(MC._internals.normalCDF(1.2816), 0.9, 2e-3));
  // triangular inverse mean ≈ (a+m+b)/3
  const rng = MC._internals.mulberry32(42), a = 1000, b = 6000, m = a + 0.4 * (b - a);
  let s = 0; const N = 200000;
  for (let i = 0; i < N; i++) s += MC.triInv(rng(), a, b, m);
  ok('triangular sample mean ≈ (a+m+b)/3', approx(s / N, (a + m + b) / 3, (a + m + b) / 3 * 0.01),
     money(s / N) + ' vs ' + money((a + m + b) / 3));
})();

const CALCS = {
  'small (2)':  [{ low: 4000, high: 7000 }, { low: 1200, high: 2400 }],
  'deck (6)':   [{ low: 3800, high: 6200 }, { low: 2300, high: 3900 }, { low: 600, high: 1100 },
                 { low: 450, high: 900 }, { low: 700, high: 1400 }, { low: 300, high: 700 }],
  'large (12)': Array.from({ length: 12 }, (_, i) => ({ low: 300 + i * 120, high: 600 + i * 260 }))
};

/* 2. emergent distribution: tighter than naive band, centered, right-skewed */
Object.keys(CALCS).forEach(function (name) {
  const items = CALCS[name];
  const naive = items.reduce((a, it) => ({ low: a.low + it.low, high: a.high + it.high }), { low: 0, high: 0 });
  const mid = (naive.low + naive.high) / 2;
  const r = MC.simulate(items, { trials: 10000, seed: 7 });           // markup 1:1
  const b = r.base;
  ok(name + ': emergent P10 inside naive low', b.p10 > naive.low, money(b.p10) + ' > ' + money(naive.low));
  ok(name + ': emergent P90 inside naive high', b.p90 < naive.high, money(b.p90) + ' < ' + money(naive.high));
  ok(name + ': emergent band tighter than naive', (b.p90 - b.p10) < (naive.high - naive.low) * 0.95);
  ok(name + ': centered near midpoint', approx(b.p50, mid, mid * 0.08), money(b.p50) + ' vs mid ' + money(mid));
  ok(name + ': right-skewed mode < median < mean', b.mode <= b.p50 + 1 && b.p50 <= b.mean + 1,
     'mode ' + money(b.mode) + ' p50 ' + money(b.p50) + ' mean ' + money(b.mean));
  ok(name + ': no NaN/negatives', isFinite(b.mean) && b.min >= 0 && isFinite(b.mode));
});

/* 3. correlation widens the spread (rho 0.9 vs 0.1) */
(function () {
  const items = CALCS['deck (6)'];
  const lo = MC.simulate(items, { trials: 12000, seed: 3, rho: 0.1 }).base;
  const hi = MC.simulate(items, { trials: 12000, seed: 3, rho: 0.9 }).base;
  ok('higher correlation -> wider band', (hi.p90 - hi.p10) > (lo.p90 - lo.p10) * 1.3,
     'rho.1 ' + money(lo.p90 - lo.p10) + ' vs rho.9 ' + money(hi.p90 - hi.p10));
})();

/* 4. markup scales the total onto the published scale */
(function () {
  const items = CALCS['deck (6)'];
  const plain = MC.simulate(items, { trials: 10000, seed: 5 }).base.p50;
  const marked = MC.simulate(items, { trials: 10000, seed: 5, markup: { low: 1.18, high: 1.30 } }).base.p50;
  ok('markup raises the median ~1.2-1.3x', marked > plain * 1.12 && marked < plain * 1.35,
     money(plain) + ' -> ' + money(marked));
  // noMarkup items are excluded from markup
  const mixed = [{ low: 1000, high: 2000 }, { low: 500, high: 500, noMarkup: true }];
  const rr = MC.simulate(mixed, { trials: 8000, seed: 5, markup: { low: 1.25, high: 1.25 } }).base;
  ok('noMarkup item not marked up', approx(rr.p50, 1500 * 1.25 + 500, 250), money(rr.p50));
})();

/* 5. surprise events add a right tail */
(function () {
  const items = CALCS['deck (6)'];
  const events = [{ label: 'A', p: 0.25, costLow: 300, costHigh: 800 }, { label: 'B', p: 0.30, costLow: 500, costHigh: 3000 }];
  const r = MC.simulate(items, { trials: 10000, seed: 9, events: events });
  ok('events present + shift up', !!r.events && r.events.p50 >= r.base.p50 && r.events.p90 > r.base.p90);
  ok('events hit rate ≈ analytic 47.5%', approx(r.events.pctHitAny, 0.475, 0.03), (100 * r.events.pctHitAny).toFixed(1) + '%');
  ok('events meanAddedWhenHit > 0', r.events.meanAddedWhenHit > 0, money(r.events.meanAddedWhenHit));
})();

/* 6. reference band passthrough (NOT pinned to) */
(function () {
  const items = CALCS['deck (6)'];
  const band = { low: 11000, high: 19000 };
  const r = MC.simulate(items, { trials: 8000, seed: 4, band: band });
  ok('reference band returned unchanged', r.band.low === 11000 && r.band.high === 19000);
  ok('emergent P10 NOT pinned to reference low', Math.abs(r.base.p10 - band.low) > 100);
})();

/* 7. performance + determinism */
(function () {
  const items = Array.from({ length: 8 }, (_, i) => ({ low: 500 + i * 100, high: 1000 + i * 200 }));
  const t0 = Date.now(); MC.simulate(items, { trials: 10000, seed: 1 }); const ms = Date.now() - t0;
  ok('10k trials < 500ms', ms < 500, ms + 'ms');
  const a = MC.simulate(CALCS['deck (6)'], { trials: 5000, seed: 5 }).base.p50;
  const b = MC.simulate(CALCS['deck (6)'], { trials: 5000, seed: 5 }).base.p50;
  ok('deterministic with fixed seed', a === b);
})();

/* 8. BUNDLE (Project Simulator) — combine multiple PROJECT totals.
 * Each project enters the sim as one triangular item on its [low, high] TOTAL
 * band (markup already baked in upstream), correlated by the shared market
 * factor. These assert the page's headline claims hold mathematically. */
(function () {
  // Five representative whole-home electrification project totals (installed bands).
  const BUNDLE = [
    { low: 9000,  high: 22000 },  // heat pump (typical)
    { low: 4000,  high: 8500 },   // heat pump water heater
    { low: 1800,  high: 4500 },   // electrical panel upgrade
    { low: 1500,  high: 4000 },   // EV charger install
    { low: 2000,  high: 4500 }    // induction stove
  ];
  const naive = BUNDLE.reduce((a, it) => ({ low: a.low + it.low, high: a.high + it.high }), { low: 0, high: 0 });

  // (a) combined P50 ≈ Σ(per-item triangular medians) within ~3% over 100k trials.
  // Triangular median (mode-skew 0.40) is NOT the midpoint — derive it per item.
  function triMedian(a, b) { const m = a + 0.40 * (b - a), fc = (m - a) / (b - a);
    return (0.5 < fc) ? a + Math.sqrt(0.5 * (b - a) * (m - a)) : b - Math.sqrt(0.5 * (b - a) * (b - m)); }
  const sumMedians = BUNDLE.reduce((s, it) => s + triMedian(it.low, it.high), 0);
  const big = MC.simulate(BUNDLE, { trials: 100000, seed: 11 }).base;   // markup 1:1, rho 0.5
  ok('bundle: P50 ≈ Σ(item medians) within 3%', approx(big.p50, sumMedians, sumMedians * 0.03),
     money(big.p50) + ' vs ' + money(sumMedians));

  // (b) portfolio effect: combined P10–P90 is TIGHTER than the naive Σlow–Σhigh.
  ok('bundle: emergent band tighter than naive sum', (big.p90 - big.p10) < (naive.high - naive.low) * 0.9,
     money(big.p90 - big.p10) + ' < ' + money((naive.high - naive.low) * 0.9));
  ok('bundle: P10 > Σlow and P90 < Σhigh (no pinning)', big.p10 > naive.low && big.p90 < naive.high,
     money(big.p10) + '/' + money(big.p90) + ' inside ' + money(naive.low) + '-' + money(naive.high));

  // (c) correlation matters: rho 0.5 must give a WIDER combined band than rho 0
  // (independent) — ignoring correlation understates combined risk (GAO).
  const indep = MC.simulate(BUNDLE, { trials: 60000, seed: 11, rho: 0.0 }).base;
  const corr  = MC.simulate(BUNDLE, { trials: 60000, seed: 11, rho: 0.5 }).base;
  ok('bundle: correlation widens vs independent', (corr.p90 - corr.p10) > (indep.p90 - indep.p10) * 1.05,
     'indep ' + money(indep.p90 - indep.p10) + ' vs corr ' + money(corr.p90 - corr.p10));

  // (d) right-skew preserved at the bundle level (mode <= median <= mean).
  ok('bundle: right-skewed (mode <= p50 <= mean)', big.mode <= big.p50 + 1 && big.p50 <= big.mean + 1,
     'mode ' + money(big.mode) + ' p50 ' + money(big.p50) + ' mean ' + money(big.mean));

  // (e) determinism: same seed -> identical percentiles for the bundle.
  const d1 = MC.simulate(BUNDLE, { trials: 8000, seed: 77 }).base;
  const d2 = MC.simulate(BUNDLE, { trials: 8000, seed: 77 }).base;
  ok('bundle: deterministic with fixed seed', d1.p10 === d2.p10 && d1.p50 === d2.p50 && d1.p90 === d2.p90);

  // (f) performance: a 12-project bundle, 10k trials, well under 500ms.
  const big12 = Array.from({ length: 12 }, (_, i) => ({ low: 2000 + i * 800, high: 4000 + i * 1600 }));
  const t0 = Date.now(); MC.simulate(big12, { trials: 10000, seed: 2 }); const ms = Date.now() - t0;
  ok('bundle: 12 projects x 10k trials < 500ms', ms < 500, ms + 'ms');

  // (g) single-project bundle still produces a valid distribution (degenerate-safe).
  const one = MC.simulate([BUNDLE[0]], { trials: 5000, seed: 3 }).base;
  ok('bundle: single project is valid', one.p10 > 0 && one.p90 > one.p10 && isFinite(one.mode));
})();

console.log('\nMONTE CARLO TESTS: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
