import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, SIZE_OPTIONS, GALLONS_OPTIONS, CLIMATE_OPTIONS, CIRCUIT_OPTIONS,
  type Size, type PoolGallons, type Climate, type Circuit,
} from '@/lib/calcs/pool-heat-pump';

export default function PoolHpCalculator() {
  useCalculatorUsed('pool-heat-pump');
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');
  const [size, setSize] = useState<Size>('110k');
  const [gallons, setGallons] = useState<PoolGallons>('20k');
  const [climate, setClimate] = useState<Climate>('warm');
  const [needsCircuit, setNeedsCircuit] = useState<Circuit>('yes');

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
    if (h.size && SIZE_OPTIONS.some(o => o.value === h.size)) setSize(h.size as Size);
    if (h.gal && GALLONS_OPTIONS.some(o => o.value === h.gal)) setGallons(h.gal as PoolGallons);
    if (h.climate && CLIMATE_OPTIONS.some(o => o.value === h.climate)) setClimate(h.climate as Climate);
    if (h.circuit && CIRCUIT_OPTIONS.some(o => o.value === h.circuit)) setNeedsCircuit(h.circuit as Circuit);
  });
  const hashValues = { state, zip, size, gal: gallons, climate, circuit: needsCircuit };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, size, climate, needsCircuit }),
    [state, size, climate, needsCircuit],
  );

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('pool-heat-pump', () => {
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
            placeholder="e.g., 33101" className="input mt-1 w-full" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Pool gallons</label>
          <select className="input mt-1 w-full" value={gallons} onChange={e => setGallons(e.target.value as PoolGallons)}>
            {GALLONS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Heat pump size</label>
          <select className="input mt-1 w-full" value={size} onChange={e => setSize(e.target.value as Size)}>
            {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Climate</label>
          <select className="input mt-1 w-full" value={climate} onChange={e => setClimate(e.target.value as Climate)}>
            {CLIMATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Need new 240V/50A circuit?</label>
          <select className="input mt-1 w-full" value={needsCircuit} onChange={e => setNeedsCircuit(e.target.value as Circuit)}>
            {CIRCUIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {size.replace('k', ',000')} BTU/hr · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Annual op cost</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.annualOpCost)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">~{result.annualKwh.toLocaleString()} kWh</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">vs gas heater</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-700">~50-70% less</p>
              <p className="mt-1 text-[11px] text-ink-600">COP 4-6 vs 80% AFUE gas</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Climate reality:</strong> Pool heat pumps work down to ~50°F ambient. Below that, capacity drops sharply and you need a solar cover or gas heater. In warm states (FL, TX coast, AZ, HI, S. CA), a heat pump alone is fine year-round. In mild climates, expect May-October pool season. In cool climates, you&rsquo;re looking at June-September; consider gas heater as backup or solar pool cover.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Sizing math</h3>
          <p className="mt-2 text-sm text-ink-700">
            BTU/hr needed ≈ pool surface area × desired temp rise × 12. A 20,000-gal pool with 400 sqft surface, raising 10°F: ~48,000 BTU/hr (continuous) — but you want recovery time, so 110,000 BTU/hr unit. Most warm-climate residential pools land at 85,000-110,000 BTU/hr; cool climates and spas push to 125,000-140,000 BTU/hr.
          </p>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="pool-heat-pump"
    />
    </>
  );
}
