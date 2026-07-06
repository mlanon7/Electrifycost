import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, ZONE_OPTIONS, BRAND_OPTIONS, SPEC_OPTIONS, CIRCUIT_OPTIONS,
  type Brand, type Zones, type Spec, type Circuit,
} from '@/lib/calcs/mini-split';

export default function MiniSplitCalculator() {
  useCalculatorUsed('mini-split');
  const [state, setState] = useState('MA');
  const [zip, setZip] = useState('');
  const [zones, setZones] = useState<Zones>('2');
  const [brand, setBrand] = useState<Brand>('mitsubishi');
  const [spec, setSpec] = useState<Spec>('hyperheat');
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
    if (h.zones && ZONE_OPTIONS.some(o => o.value === h.zones)) setZones(h.zones as Zones);
    if (h.brand && BRAND_OPTIONS.some(o => o.value === h.brand)) setBrand(h.brand as Brand);
    if (h.spec && SPEC_OPTIONS.some(o => o.value === h.spec)) setSpec(h.spec as Spec);
    if (h.circuit && CIRCUIT_OPTIONS.some(o => o.value === h.circuit)) setNeedsCircuit(h.circuit as Circuit);
  });
  const hashValues = { state, zip, zones, brand, spec, circuit: needsCircuit };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, zones, brand, spec, needsCircuit }),
    [state, zones, brand, spec, needsCircuit],
  );

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  usePublishEstimate('mini-split', () => {
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
          <label htmlFor="minisplit-zip" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input id="minisplit-zip" type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 02134" className="input mt-1 w-full" />
        </div>
        <div>
          <label htmlFor="minisplit-state" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select id="minisplit-state" className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="minisplit-zones" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Number of indoor heads (zones)</label>
          <select id="minisplit-zones" className="input mt-1 w-full" value={zones} onChange={e => setZones(e.target.value as Zones)}>
            {ZONE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="minisplit-brand" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Brand</label>
          <select id="minisplit-brand" className="input mt-1 w-full" value={brand} onChange={e => setBrand(e.target.value as Brand)}>
            {BRAND_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="minisplit-spec" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Cold-climate spec?</label>
          <select id="minisplit-spec" className="input mt-1 w-full" value={spec} onChange={e => setSpec(e.target.value as Spec)}>
            {SPEC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="minisplit-circuit" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Need new 240V circuit?</label>
          <select id="minisplit-circuit" className="input mt-1 w-full" value={needsCircuit} onChange={e => setNeedsCircuit(e.target.value as Circuit)}>
            {CIRCUIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {zones} zone · {brand} {spec === 'hyperheat' ? 'cold-climate' : 'standard'} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3"><span>Equipment + install labor</span><span className="tabular-nums">{fmtUSD(result.equip.mid)}</span></li>
              {needsCircuit === 'yes' && <li className="flex justify-between gap-3"><span>240V circuit + disconnect</span><span className="tabular-nums">{fmtUSD(result.elec.mid)}</span></li>}
              <li className="flex justify-between gap-3"><span>Permit + inspection</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Quote check</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink-700">
              <li>· NEEP listing for cold-climate models (ashp.neep.org).</li>
              <li>· HSPF2 ≥ 9.0 for ENERGY STAR Most Efficient.</li>
              <li>· Manual J load calc per zone, not eye-balled BTU sizing.</li>
              <li>· 12-yr compressor / 10-yr parts warranty registered to your address.</li>
              <li>· Refrigerant: R-454B or R-32 (post-2025).</li>
              <li>· Vacuum-and-charge test report at commissioning.</li>
            </ul>
          </div>
        </div>
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Cold-climate note:</strong> in zones 5+, choose hyper-heat or equivalent (rated to -13°F). NEEP&rsquo;s Cold Climate Heat Pump Specification list is the authoritative reference. Federal 25C credit ended 2025-12-31; state and utility heat-pump rebates remain widely available.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="mini-split"
    />
    </>
  );
}
