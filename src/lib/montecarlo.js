/*
 * src/lib/montecarlo.js  —  pure probabilistic cost engine (NO DOM).
 *
 * The math is ported verbatim from ProjectCostPro (shared/montecarlo.js); only
 * the module wrapper differs (ESM named exports here, UMD there) so it imports
 * cleanly as a Vite/React island AND is require()-able by the Node test gate.
 * The calibration constants are load-bearing — do not retune without re-running
 * scripts/test-montecarlo.cjs (the acceptance gate encodes the whole design).
 *
 * Turns a calculator's line items (each with a low/high installed cost) into a
 * distribution of likely total cost, plus optional "real-world surprise" events.
 *
 * Method:
 *   - Each line item is drawn from a TRIANGULAR distribution (low, mode, high) —
 *     the AACE 41R-08 range-estimating shape — mode skewed slightly high.
 *   - Items are CORRELATED via a one-factor Gaussian copula (rho ~ 0.5).
 *   - Markup is sampled between a low/high markup band and applied to the
 *     markup-eligible base. ElectrifyCost's engine has no separate markup band,
 *     so the per-calc sim passes markup = {low: 1, high: 1}.
 *   - Percentiles, the most-likely value (the MODE/peak) and the spread all EMERGE
 *     from the simulation — NOT the published band relabeled.
 *   - Optional surprise events add a right tail.
 *
 * API:
 *   simulate(items, opts) -> result (runs all trials at once; used by tests)
 *   streamer(items, opts) -> { batch(n) -> cumulative result, band, total, hasEvents }
 *     (run trials in batches so the UI can animate the curve building up)
 */
'use strict';

function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function gaussian(rng) {
  var u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function normalCDF(x) {
  var t = 1 / (1 + 0.2316419 * Math.abs(x));
  var d = 0.3989422804 * Math.exp(-x * x / 2);
  var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - p : p;
}
function triInv(u, a, b, m) {
  if (!(b > a)) return a;
  var fc = (m - a) / (b - a);
  if (u < fc) return a + Math.sqrt(u * (b - a) * (m - a));
  return b - Math.sqrt((1 - u) * (b - a) * (b - m));
}
function sampleGamma(shape, rng) {
  if (shape < 1) shape = 1;
  var d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
  for (;;) {
    var x, v;
    do { x = gaussian(rng); v = 1 + c * x; } while (v <= 0);
    v = v * v * v; var u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}
function sampleBeta(a, b, rng) { var ga = sampleGamma(a, rng), gb = sampleGamma(b, rng); return ga / (ga + gb); }
function samplePert(low, high, mode, lambda, rng) {
  if (!(high > low)) return low;
  if (mode <= low) mode = low + (high - low) * 1e-6;
  if (mode >= high) mode = high - (high - low) * 1e-6;
  var a = 1 + lambda * (mode - low) / (high - low);
  var b = 1 + lambda * (high - mode) / (high - low);
  return low + sampleBeta(a, b, rng) * (high - low);
}

function percentile(sorted, p) { var n = sorted.length; if (!n) return 0; var i = Math.floor(p * n); if (i < 0) i = 0; if (i > n - 1) i = n - 1; return sorted[i]; }
function mean(arr) { var s = 0; for (var i = 0; i < arr.length; i++) s += arr[i]; return s / arr.length; }
function histogram(samples, nbins) {
  nbins = nbins || 36;
  var min = Infinity, max = -Infinity, i;
  for (i = 0; i < samples.length; i++) { if (samples[i] < min) min = samples[i]; if (samples[i] > max) max = samples[i]; }
  if (!(max > min)) max = min + 1;
  var w = (max - min) / nbins, counts = new Array(nbins);
  for (i = 0; i < nbins; i++) counts[i] = 0;
  for (i = 0; i < samples.length; i++) { var b = Math.floor((samples[i] - min) / w); if (b < 0) b = 0; if (b >= nbins) b = nbins - 1; counts[b]++; }
  var edges = new Array(nbins + 1);
  for (i = 0; i <= nbins; i++) edges[i] = min + i * w;
  return { min: min, max: max, binWidth: w, counts: counts, edges: edges };
}
// 1-2-1 smoother (applied twice) — stabilises the peak so it matches the
// visual crest of the drawn curve instead of jittering with histogram noise.
function smooth121(a) {
  var o = new Array(a.length);
  for (var j = 0; j < a.length; j++) { var l = j > 0 ? a[j - 1] : a[j], r = j < a.length - 1 ? a[j + 1] : a[j]; o[j] = (l + 2 * a[j] + r) / 4; }
  return o;
}
function peakMode(h) {
  var s = smooth121(smooth121(h.counts)), bi = 0;
  for (var i = 1; i < s.length; i++) if (s[i] > s[bi]) bi = i;
  return h.min + (bi + 0.5) * h.binWidth;
}
function summarize(samples, nbins) {
  var sorted = samples.slice().sort(function (x, y) { return x - y; });
  var h = histogram(samples, nbins);
  return {
    p10: percentile(sorted, 0.10), p25: percentile(sorted, 0.25), p50: percentile(sorted, 0.50),
    p75: percentile(sorted, 0.75), p90: percentile(sorted, 0.90), mean: mean(samples), mode: peakMode(h),
    min: sorted[0], max: sorted[sorted.length - 1], hist: h
  };
}

/* ---------- shared per-trial setup ---------- */
function prep(items, opts) {
  opts = opts || {};
  var skew = opts.modeSkew != null ? opts.modeSkew : 0.40;
  var rho = opts.rho != null ? opts.rho : 0.5;
  var markup = opts.markup || { low: 1, high: 1 };
  var events = opts.events || [];
  var nbins = opts.nbins || 36;
  var sr = Math.sqrt(rho), si = Math.sqrt(1 - rho);
  var live = [], sumLow = 0, sumHigh = 0;
  for (var i = 0; i < items.length; i++) {
    var lo = +items[i].low || 0, hi = +items[i].high || 0;
    sumLow += lo; sumHigh += hi;
    live.push({ low: lo, high: hi, mode: lo + skew * (hi - lo), nm: !!items[i].noMarkup });
  }
  var refLow = (opts.band && opts.band.low != null) ? +opts.band.low : sumLow;
  var refHigh = (opts.band && opts.band.high != null) ? +opts.band.high : sumHigh;
  function trial(rng) {
    var z0 = gaussian(rng), mBase = 0, fixed = 0;
    for (var k = 0; k < live.length; k++) {
      var it = live[k], v;
      if (it.high > it.low) { var zi = sr * z0 + si * gaussian(rng); v = triInv(normalCDF(zi), it.low, it.high, it.mode); }
      else v = it.low;
      if (it.nm) fixed += v; else mBase += v;
    }
    var mu = markup.low + rng() * (markup.high - markup.low);
    var base = mBase * mu + fixed, add = 0, hit = false;
    for (var e = 0; e < events.length; e++) {
      var ev = events[e];
      if (rng() < ev.p) { hit = true; var cl = +ev.costLow || 0, ch = +ev.costHigh || 0; add += (ch > cl) ? samplePert(cl, ch, cl + 0.40 * (ch - cl), 4, rng) : cl; }
    }
    return { base: base, add: add, hit: hit };
  }
  return { trial: trial, band: { low: refLow, high: refHigh }, hasEvents: events.length > 0, nbins: nbins, live: live.length };
}

function accumulate(p, base, withE, info) {
  var out = { n: base.length, band: p.band, base: summarize(base, p.nbins), events: null };
  if (p.hasEvents) {
    out.events = summarize(withE, p.nbins);
    out.events.pctHitAny = info.hit / base.length;
    out.events.meanAddedWhenHit = info.hit ? info.added / info.hit : 0;
    out.events.meanAdded = info.added / base.length;
  }
  return out;
}

function simulate(items, opts) {
  opts = opts || {};
  var p = prep(items, opts), trials = opts.trials || 10000, rng = mulberry32(opts.seed || 123456789);
  if (!p.live || !(p.band.high > p.band.low)) {
    var pt = p.band.low; return { trials: trials, band: p.band, base: summarize([pt, pt], p.nbins), events: null };
  }
  var base = [], withE = [], info = { hit: 0, added: 0 };
  for (var t = 0; t < trials; t++) { var r = p.trial(rng); base.push(r.base); if (p.hasEvents) { withE.push(r.base + r.add); if (r.hit) { info.hit++; info.added += r.add; } } }
  var out = accumulate(p, base, withE, info); out.trials = trials; return out;
}

function streamer(items, opts) {
  opts = opts || {};
  var p = prep(items, opts), rng = mulberry32(opts.seed || 123456789);
  var base = [], withE = [], info = { hit: 0, added: 0 };
  return {
    band: p.band, hasEvents: p.hasEvents, total: opts.trials || 10000,
    degenerate: !(p.live && p.band.high > p.band.low),
    batch: function (n) {
      for (var k = 0; k < n; k++) { var r = p.trial(rng); base.push(r.base); if (p.hasEvents) { withE.push(r.base + r.add); if (r.hit) { info.hit++; info.added += r.add; } } }
      return accumulate(p, base, withE, info);
    }
  };
}

var _internals = { mulberry32: mulberry32, gaussian: gaussian, normalCDF: normalCDF };

var MonteCarlo = {
  simulate: simulate, streamer: streamer, samplePert: samplePert, triInv: triInv,
  percentile: percentile, histogram: histogram, _internals: _internals
};

export { simulate, streamer, samplePert, triInv, percentile, histogram, _internals };
export default MonteCarlo;
