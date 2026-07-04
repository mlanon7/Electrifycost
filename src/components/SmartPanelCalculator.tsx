import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import { compute, PRODUCT_OPTIONS, type Product } from '@/lib/calcs/smart-panel';

export default function SmartPanelCalculator() {
  useCalculatorUsed('smart-panel');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [product, setProduct] = useState<Product>('span_drive');
  const [avoidsUpgrade, setAvoidsUpgrade] = useState(true);

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  // Hydrate from URL hash on mount + serialize back (share-link persistence).
  // Restored values are validated so a crafted link can't render absurd totals.
  useHashStateInit(h => {
    if (h.state && ALL_STATES.some(s => s.code === h.state)) setState(h.state);
    if (h.zip) setZip(h.zip.replace(/\D/g, '').slice(0, 5));
    if (h.product && PRODUCT_OPTIONS.some(o => o.value === h.product)) setProduct(h.product as Product);
    if (h.avoid === '1' || h.avoid === '0') setAvoidsUpgrade(h.avoid === '1');
  });
  const hashValues = { state, zip, product, avoid: avoidsUpgrade ? '1' : '0' };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, product, avoidsUpgrade }),
    [state, product, avoidsUpgrade],
  );

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  usePublishEstimate('smart-panel', () => {
    if (!(result.gross.high > 0)) return null;
    return {
      v: 2,
      low: Math.round(result.gross.low),
      high: Math.round(result.gross.high),
      sub: result.scope,
      qs: serializeHashState(hashValues),
      attrs: result.attrs,
      brk: result.brk,
      loc: stateName,
      mode: 'installed',
      ts: Date.now(),
      int: true,
    };
  });

  return (
    <>
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="label" htmlFor="state">State</label>
          <select id="state" className="input" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="zip">ZIP</label>
          <input id="zip" className="input" inputMode="numeric" pattern="\d*" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/[^0-9]/g, ''))} />
          <p className="mt-1 text-[10px] text-ink-600">{zip.length === 5 ? <span className="text-brand-700">State auto-set from ZIP</span> : 'Optional — auto-sets state'}</p>
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="product">Smart panel product</label>
          <select id="product" className="input" value={product} onChange={e => setProduct(e.target.value as Product)}>
            {PRODUCT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={avoidsUpgrade} onChange={e => setAvoidsUpgrade(e.target.checked)} />
            Smart features will let me avoid a 100A→200A service upgrade ($1,500–$5,500)
          </label>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {result.label} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Premium over traditional</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.premium)}</p>
              <p className="mt-1 text-[11px] text-ink-600">Traditional 200A: {fmtUSD(result.traditional.mid)}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Net after avoided upgrade</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-700">{result.netPremium > 0 ? fmtUSD(result.netPremium) : fmtUSD(0)}</p>
              <p className="mt-1 text-[11px] text-ink-600">{result.netPremium < 0 ? 'Smart panel is cheaper after avoided upgrade' : 'Smart panel still costs more'}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">When smart panel wins</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink-700">
              <li>· You have a 100A or 125A service and want to add a heat pump + EV charger without upgrading.</li>
              <li>· You have solar + battery and want time-of-use load shifting.</li>
              <li>· You want app visibility into circuit-level consumption.</li>
              <li>· You're considering future backup-battery integration.</li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">When traditional wins</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink-700">
              <li>· You already have 200A+ service and aren't adding major loads.</li>
              <li>· You don't need circuit-level monitoring or app control.</li>
              <li>· You're not planning solar/battery integration.</li>
              <li>· Budget is the dominant constraint — traditional is $3,000–$4,000 cheaper.</li>
            </ul>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Federal note:</strong> the 25C federal credit (with historical caps on qualifying electrical panel/service upgrades) expired Dec 31 2025 (OBBBA). Do not assume smart-panel hardware itself receives a separate federal credit — verify against current IRS guidance before claiming. HEEHRA (DOE Home Energy Rebates) covers up to $4,000 toward electrical panel work for income-qualified households where state programs are open. Some utility programs (PG&E, ConEd, Mass Save) offer $200–$1,500 rebates on smart-panel installs.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="smart-panel"
    />
    </>
  );
}
