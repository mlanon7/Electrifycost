/*
 * mc-chart.ts — shared rendering helpers for the Monte Carlo simulation UI.
 * Used by both the per-calculator sim (MonteCarloSim.tsx) and the combined
 * Project Simulator (ProjectSimulator.tsx). Pure functions; the SVG draw is a
 * faithful port of ProjectCostPro's montecarlo-ui / scenario-sim chart.
 */

export interface McBand { low: number; high: number }
export interface McItem { low: number; high: number }
export interface McEvent {
  label: string; p: number; costLow: number; costHigh: number;
  source?: string; sourced?: boolean; confidence?: string; show_probability?: boolean;
}
export interface McDist {
  p10: number; p25: number; p50: number; p75: number; p90: number;
  mean: number; mode: number; min: number; max: number;
  hist: { min: number; max: number; binWidth: number; counts: number[]; edges: number[] };
  pctHitAny?: number; meanAddedWhenHit?: number; meanAdded?: number;
}
export interface McResult { n: number; band: McBand; base: McDist; events: McDist | null }

export function niceRound(n: number): number {
  const s = n < 2000 ? 25 : n < 10000 ? 50 : n < 100000 ? 100 : 250;
  return Math.round(n / s) * s;
}
export function money(n: number): string { return '$' + niceRound(n).toLocaleString('en-US'); }

// 1-2-1 smoother — matches montecarlo.js so the drawn curve lines up with the peak.
export function smooth(a: number[]): number[] {
  const o = new Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const l = i > 0 ? a[i - 1] : a[i], r = i < a.length - 1 ? a[i + 1] : a[i];
    o[i] = (l + 2 * a[i] + r) / 4;
  }
  return o;
}

export function domainFor(band: McBand, includeSurprises: boolean) {
  const w = band.high - band.low;
  return { min: band.low, max: includeSurprises ? band.high + 0.55 * w : band.high };
}

interface ChartOpts { W?: number; H?: number; ariaLabel?: string }

/** Build the inline SVG density chart (returns an SVG markup string). */
export function buildChart(dist: McDist, band: McBand, dom: { min: number; max: number }, opts: ChartOpts = {}): string {
  const W = opts.W ?? 640, H = opts.H ?? 250, mL = 14, mR = 14, mT = 18, mB = 48;
  const pW = W - mL - mR, pH = H - mT - mB, baseY = mT + pH;
  const h = dist.hist, counts = smooth(smooth(h.counts)), n = counts.length, bw = (h.max - h.min) / n;
  const centers = counts.map((_: number, i: number) => h.min + (i + 0.5) * bw);
  const xmin = dom.min, xmax = dom.max, span = (xmax - xmin) || 1, ymax = Math.max.apply(null, counts) || 1;
  const X = (v: number) => { const x = mL + (v - xmin) / span * pW; return x < mL ? mL : (x > W - mR ? W - mR : x); };
  const Y = (c: number) => mT + pH - (c / ymax) * pH;
  const curveAt = (x: number): number => {
    if (x <= centers[0]) return counts[0];
    if (x >= centers[n - 1]) return counts[n - 1];
    for (let k = 1; k < n; k++) if (centers[k] >= x) { const t = (x - centers[k - 1]) / (centers[k] - centers[k - 1]); return counts[k - 1] + (counts[k] - counts[k - 1]) * t; }
    return counts[n - 1];
  };
  let area = 'M ' + X(centers[0]).toFixed(1) + ' ' + baseY.toFixed(1), line = '', i;
  for (i = 0; i < n; i++) { area += ' L ' + X(centers[i]).toFixed(1) + ' ' + Y(counts[i]).toFixed(1); line += (i ? ' L ' : 'M ') + X(centers[i]).toFixed(1) + ' ' + Y(counts[i]).toFixed(1); }
  area += ' L ' + X(centers[n - 1]).toFixed(1) + ' ' + baseY.toFixed(1) + ' Z';
  const p10 = dist.p10, p90 = dist.p90, mode = dist.mode;
  let zone = 'M ' + X(p10).toFixed(1) + ' ' + baseY.toFixed(1) + ' L ' + X(p10).toFixed(1) + ' ' + Y(curveAt(p10)).toFixed(1);
  for (i = 0; i < n; i++) if (centers[i] > p10 && centers[i] < p90) zone += ' L ' + X(centers[i]).toFixed(1) + ' ' + Y(counts[i]).toFixed(1);
  zone += ' L ' + X(p90).toFixed(1) + ' ' + Y(curveAt(p90)).toFixed(1) + ' L ' + X(p90).toFixed(1) + ' ' + baseY.toFixed(1) + ' Z';
  const ref = (v: number) => { const x = X(v).toFixed(1); return '<line x1="' + x + '" y1="' + mT + '" x2="' + x + '" y2="' + baseY + '" class="mc-ref"/>'; };
  const vmark = (v: number, cap: string, cls: string) => {
    const x = X(v).toFixed(1);
    return '<line x1="' + x + '" y1="' + (mT + 4) + '" x2="' + x + '" y2="' + baseY + '" class="' + cls + '"/>'
      + '<text x="' + x + '" y="' + (baseY + 17) + '" class="mc-xval">' + money(v) + '</text>'
      + '<text x="' + x + '" y="' + (baseY + 32) + '" class="mc-xcap">' + cap + '</text>';
  };
  return '<svg class="mc-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + (opts.ariaLabel ?? 'Cost probability distribution') + '">'
    + ref(band.low) + ref(band.high)
    + '<path d="' + area + '" class="mc-area"/><path d="' + zone + '" class="mc-zone"/><path d="' + line + '" class="mc-line"/>'
    + '<line x1="' + mL + '" y1="' + baseY + '" x2="' + (W - mR) + '" y2="' + baseY + '" class="mc-axis"/>'
    + vmark(p10, '10% under', 'mc-vline') + vmark(mode, 'most likely', 'mc-vline-mid') + vmark(p90, '90% under', 'mc-vline')
    + '</svg>';
}
