import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, MATERIAL_OPTIONS, GLAZING_OPTIONS, INSTALL_OPTIONS,
  type Material, type Glazing, type Install,
} from '@/lib/calcs/window-replacement';

export default function WindowCalculator() {
  useCalculatorUsed('window-replacement');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [count, setCount] = useState(12);
  const [material, setMaterial] = useState<Material>('vinyl');
  const [glazing, setGlazing] = useState<Glazing>('double_lowE');
  const [install, setInstall] = useState<Install>('retrofit');

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
    if (h.count) {
      const n = parseInt(h.count, 10);
      if (Number.isFinite(n)) setCount(Math.min(60, Math.max(1, n)));
    }
    if (h.mat && MATERIAL_OPTIONS.some(o => o.value === h.mat)) setMaterial(h.mat as Material);
    if (h.glz && GLAZING_OPTIONS.some(o => o.value === h.glz)) setGlazing(h.glz as Glazing);
    if (h.inst && INSTALL_OPTIONS.some(o => o.value === h.inst)) setInstall(h.inst as Install);
  });
  const hashValues = { state, zip, count, mat: material, glz: glazing, inst: install };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, count, material, glazing, install }),
    [state, count, material, glazing, install],
  );

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('window-replacement', () => {
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
          <label htmlFor="window-zip" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input id="window-zip" type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 94103" className="input mt-1 w-full" />
        </div>
        <div>
          <label htmlFor="window-state" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select id="window-state" className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="window-count" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Number of windows</label>
          <input id="window-count" type="number" min={1} max={60} step={1} value={count}
            onChange={e => setCount(Number(e.target.value) || 0)} className="input mt-1 w-full" />
          <p className="mt-1 text-[11px] text-ink-600">Typical 1,800 sqft home: 12-18 windows</p>
        </div>
        <div>
          <label htmlFor="window-material" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Frame material</label>
          <select id="window-material" className="input mt-1 w-full" value={material} onChange={e => setMaterial(e.target.value as Material)}>
            {MATERIAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="window-glazing" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Glazing</label>
          <select id="window-glazing" className="input mt-1 w-full" value={glazing} onChange={e => setGlazing(e.target.value as Glazing)}>
            {GLAZING_OPTIONS.filter(o => o.value !== 'storm_addon' || material === 'vinyl')
              .map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="window-install" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Install type</label>
          <select id="window-install" className="input mt-1 w-full" value={install} onChange={e => setInstall(e.target.value as Install)}>
            {INSTALL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-blue-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {count} windows · {material.replace('_', ' ')} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Per window</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.perWindow.mid)}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Annual HVAC savings (est.)</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-700">{fmtUSD(result.annualSavings)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">vs single-pane (ENERGY STAR estimate)</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Reality check:</strong> windows have the worst payback of any envelope upgrade — typically 20–40 years on energy savings alone. The right reasons to replace windows are: (1) rot or air leak you can&rsquo;t fix otherwise, (2) noise reduction, (3) aesthetics / curb appeal, (4) you&rsquo;re doing a major remodel anyway. If your only goal is energy savings, insulation and air-sealing are 5–10× better $/return.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· NFRC label on every unit (U-factor, SHGC, VT, AL).</li>
            <li>· U-factor ≤ 0.30 for ENERGY STAR (≤ 0.25 in cold climates).</li>
            <li>· Argon or krypton gas fill, not air.</li>
            <li>· Warm-edge spacer (not aluminum) between panes.</li>
            <li>· Manufacturer warranty: 20-yr glass seal, lifetime frame (transferable a plus).</li>
            <li>· Install warranty: 1-5 yr workmanship from installer.</li>
            <li>· Flashing detail: house wrap and pan flashing under sill, sealed.</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="window-replacement"
    />
    </>
  );
}
