import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, SCOPE_OPTIONS, MATERIAL_OPTIONS, STORIES_OPTIONS, ACCESS_OPTIONS, AEROSEAL_OPTIONS,
  type Scope, type Material, type Stories, type Access, type Aeroseal,
} from '@/lib/calcs/ductwork';

export default function DuctworkCalculator() {
  useCalculatorUsed('ductwork');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [sqft, setSqft] = useState(1800);
  const [scope, setScope] = useState<Scope>('full_replace');
  const [material, setMaterial] = useState<Material>('flex');
  const [stories, setStories] = useState<Stories>('2');
  const [access, setAccess] = useState<Access>('normal');
  const [aeroseal, setAeroseal] = useState<Aeroseal>('no');

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
    if (h.sqft) {
      const n = parseInt(h.sqft, 10);
      if (Number.isFinite(n)) setSqft(Math.min(6000, Math.max(500, n)));
    }
    if (h.scope && SCOPE_OPTIONS.some(o => o.value === h.scope)) setScope(h.scope as Scope);
    if (h.mat && MATERIAL_OPTIONS.some(o => o.value === h.mat)) setMaterial(h.mat as Material);
    if (h.stories && STORIES_OPTIONS.some(o => o.value === h.stories)) setStories(h.stories as Stories);
    if (h.access && ACCESS_OPTIONS.some(o => o.value === h.access)) setAccess(h.access as Access);
    if (h.aero === '1' || h.aero === '0') setAeroseal(h.aero === '1' ? 'yes' : 'no');
  });
  const hashValues = { state, zip, sqft, scope, mat: material, stories, access, aero: aeroseal === 'yes' ? '1' : '0' };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, sqft, scope, material, stories, access, aeroseal }),
    [state, sqft, scope, material, stories, access, aeroseal],
  );

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('ductwork', () => {
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
          <label htmlFor="ductwork-zip" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input id="ductwork-zip" type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 94103" className="input mt-1 w-full" />
        </div>
        <div>
          <label htmlFor="ductwork-state" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select id="ductwork-state" className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ductwork-sqft" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Home size (sqft)</label>
          <input id="ductwork-sqft" type="number" min={500} max={6000} step={50} value={sqft}
            onChange={e => setSqft(Number(e.target.value) || 0)} className="input mt-1 w-full" />
        </div>
        <div>
          <label htmlFor="ductwork-scope" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Scope of work</label>
          <select id="ductwork-scope" className="input mt-1 w-full" value={scope} onChange={e => setScope(e.target.value as Scope)}>
            {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ductwork-material" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Duct material</label>
          <select id="ductwork-material" className="input mt-1 w-full" value={material} onChange={e => setMaterial(e.target.value as Material)}>
            {MATERIAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ductwork-stories" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Stories</label>
          <select id="ductwork-stories" className="input mt-1 w-full" value={stories} onChange={e => setStories(e.target.value as Stories)}>
            {STORIES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ductwork-access" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Access difficulty</label>
          <select id="ductwork-access" className="input mt-1 w-full" value={access} onChange={e => setAccess(e.target.value as Access)}>
            {ACCESS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="ductwork-aeroseal" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Add Aeroseal injection?</label>
          <select id="ductwork-aeroseal" className="input mt-1 w-full" value={aeroseal} onChange={e => setAeroseal(e.target.value as Aeroseal)}>
            {AEROSEAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-white to-amber-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Installed cost · {sqft} sqft · {scope.replace('_', ' ')} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Why it matters</h3>
            <p className="mt-2 text-sm text-ink-700">
              Per DOE / LBNL studies, typical residential ductwork leaks 25–40% of conditioned air into attics or crawl spaces. Sealing + insulating cuts heating/cooling bills 10–20% on its own. Properly sized and sealed ducts can mean a smaller heat pump (saving $1,500–$3,000 on equipment) and avoid panel upgrades.
            </p>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Quote check</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink-700">
              <li>· Manual D duct design (not "we&rsquo;ll match what was there").</li>
              <li>· Static pressure target ≤0.5 inWC at design airflow.</li>
              <li>· R-8 insulation on ducts in unconditioned space.</li>
              <li>· Mastic + mesh sealing at every joint (not foil tape alone).</li>
              <li>· Pre/post blower-door + duct-blaster verification, not just visual.</li>
              <li>· Aeroseal Pre/Post report if used.</li>
            </ul>
          </div>
        </div>
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Heat pump pairing:</strong> if you&rsquo;re getting a heat pump quote that includes "we&rsquo;ll need to rework your ducts," this calculator gives an independent check on that line item. Heat pumps move 30–50% more CFM than gas furnaces, so undersized return ducts and trunk lines are a common problem in retrofits.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="ductwork"
    />
    </>
  );
}
