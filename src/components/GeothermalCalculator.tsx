import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, TONNAGE_OPTIONS, LOOP_OPTIONS, DUCT_OPTIONS, YEAR_OPTIONS,
  type Loop, type Tonnage, type Existing,
} from '@/lib/calcs/geothermal';

export default function GeothermalCalculator() {
  useCalculatorUsed('geothermal');
  const [state, setState] = useState('NY');
  const [zip, setZip] = useState('');
  const [tonnage, setTonnage] = useState<Tonnage>('3');
  const [loop, setLoop] = useState<Loop>('vertical');
  const [existingDucts, setExistingDucts] = useState<Existing>('yes');
  const [installYear, setInstallYear] = useState(2026);

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
    if (h.tons && TONNAGE_OPTIONS.some(o => o.value === h.tons)) setTonnage(h.tons as Tonnage);
    if (h.loop && LOOP_OPTIONS.some(o => o.value === h.loop)) setLoop(h.loop as Loop);
    if (h.ducts && DUCT_OPTIONS.some(o => o.value === h.ducts)) setExistingDucts(h.ducts as Existing);
    if (h.yr) {
      const n = parseInt(h.yr, 10);
      if (YEAR_OPTIONS.some(o => o.value === n)) setInstallYear(n);
    }
  });
  const hashValues = { state, zip, tons: tonnage, loop, ducts: existingDucts, yr: installYear };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, tonnage, loop, existingDucts, installYear }),
    [state, tonnage, loop, existingDucts, installYear],
  );

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  usePublishEstimate('geothermal', () => {
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
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 14850" className="input mt-1 w-full" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">System size (tons)</label>
          <select className="input mt-1 w-full" value={tonnage} onChange={e => setTonnage(e.target.value as Tonnage)}>
            {TONNAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Ground loop type</label>
          <select className="input mt-1 w-full" value={loop} onChange={e => setLoop(e.target.value as Loop)}>
            {LOOP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Existing ductwork?</label>
          <select className="input mt-1 w-full" value={existingDucts} onChange={e => setExistingDucts(e.target.value as Existing)}>
            {DUCT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Install year</label>
          <select className="input mt-1 w-full" value={installYear} onChange={e => setInstallYear(Number(e.target.value))}>
            {YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-ink-600">25D credit terminated by OBBBA for property placed in service after 2025-12-31.</p>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {tonnage} ton · {loop} loop · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)} gross</p>
          </div>
          <div className="mt-4 rounded-lg border border-brand-200 bg-white/70 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Net after federal 25D credit ({Math.round(result.fedRate * 100)}%)</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.net.mid)}</p>
            <p className="mt-1 text-[11px] text-ink-600">Range {fmtUSDRange(result.net.low, result.net.high)} · {result.fedRate === 0 ? '25D expired after 2025-12-31 — only state programs apply' : 'historical 30% credit'}</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3"><span>System install ({loop} loop, fully loaded)</span><span className="tabular-nums">{fmtUSD(result.loopCost.mid)}</span></li>
              {existingDucts === 'yes' && <li className="flex justify-between gap-3"><span>Duct reuse credit</span><span className="tabular-nums text-brand-700">{fmtUSD(result.ductBonus.mid)}</span></li>}
              <li className="flex justify-between gap-3"><span>Permit + design engineering</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
              <li className="mt-2 border-t border-ink-100 pt-2 text-[11px] text-ink-600">Industry consolidates indoor unit + loop into a single per-ton installed figure: $3,500–$5,500/ton typical (HomeGuide 2026), up to $11,700/ton premium.</li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Why geothermal</h3>
            <p className="mt-2 text-sm text-ink-700">
              Geothermal uses the constant 50–55°F earth temperature as its heat source/sink. COP of 4.0–5.5 (vs 2.5–3.5 for air-source), so 50%+ lower operating cost. Equipment lifespan 25+ years (vs 15 for air-source). The federal 25D credit (30%) was terminated by OBBBA after 2025-12-31. The trade-off is upfront cost and yard disruption.
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Loop-type guidance:</strong> Vertical bore is the most common (suits small/normal yards, $20-30/ft drilling). Horizontal needs ~1 acre and trenching but is much cheaper. Pond requires a pond ≥8 ft deep year-round. Open-loop discharges well water — restricted in many jurisdictions and risks fouling.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="geothermal"
    />
    </>
  );
}
