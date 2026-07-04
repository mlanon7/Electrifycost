import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findClimate } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, FUEL_OPTIONS, TIER_OPTIONS, SIZE_OPTIONS,
  type Fuel, type Tier, type Size,
} from '@/lib/calcs/boiler';

export default function BoilerCalculator() {
  useCalculatorUsed('boiler');
  const [state, setState] = useState('MA');
  const [zip, setZip] = useState('');
  const [fuel, setFuel] = useState<Fuel>('natural_gas');
  const [tier, setTier] = useState<Tier>('condensing');
  const [size, setSize] = useState<Size>('medium');

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
    if (h.fuel && FUEL_OPTIONS.some(o => o.value === h.fuel)) setFuel(h.fuel as Fuel);
    if (h.tier && TIER_OPTIONS.some(o => o.value === h.tier)) setTier(h.tier as Tier);
    if (h.size && SIZE_OPTIONS.some(o => o.value === h.size)) setSize(h.size as Size);
  });
  const hashValues = { state, zip, fuel, tier, size };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, fuel, tier, size }),
    [state, fuel, tier, size],
  );

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('boiler', () => {
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

  const climate = findClimate(state)?.iecc_zone ?? '5A';

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

        <div>
          <label className="label" htmlFor="fuel">Fuel</label>
          <select id="fuel" className="input" value={fuel} onChange={e => setFuel(e.target.value as Fuel)}>
            {FUEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tier">Efficiency tier</label>
          <select id="tier" className="input" value={tier} onChange={e => setTier(e.target.value as Tier)}>
            {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="size">Home size</label>
          <select id="size" className="input" value={size} onChange={e => setSize(e.target.value as Size)}>
            {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-rose-300/60 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Installed cost · {result.label} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-rose-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-rose-700">Hydronic heat-pump alternative</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-rose-800">{fmtUSD(result.hp.mid)}</p>
              <p className="mt-1 text-[11px] text-ink-600">Air-to-water heat pump for hydronic distribution</p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-rose-700">AFUE</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-rose-800">{result.afue}%</p>
              <p className="mt-1 text-[11px] text-ink-600">Climate zone: {climate}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Equipment</span><span className="tabular-nums">{fmtUSD(result.equipment.mid)}</span></li>
              <li className="flex justify-between"><span>Labor (state-adjusted)</span><span className="tabular-nums">{fmtUSD(result.labor.mid)}</span></li>
              <li className="flex justify-between"><span>Permit &amp; inspection</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
              <li className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><span>Total (mid)</span><span className="tabular-nums">{fmtUSD(result.gross.mid)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Hydronic + heat pump?</h3>
            <p className="mt-2 text-sm text-ink-700">
              Air-to-water heat pumps (SpacePak, Chiltrix, Arctic Heat Pumps, Mitsubishi Ecodan) connect to your existing radiator/baseboard distribution. Capital cost is higher than a boiler — $14k–$30k installed — but operating cost is 50–65% lower, and you eliminate the carbon-monoxide and combustion risks of fuel-burning equipment.
            </p>
            <p className="mt-2 text-[11px] text-ink-600">
              Hydronic heat pumps typically work best with low-temperature distribution (in-floor or wall panel). Older high-temperature cast-iron baseboard may need supplemental backup.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Federal note:</strong> the 25C credit for boilers expired 2025-12-31 (OBBBA). HEEHRA / DOE Home Energy Rebates are electric-only — no federal subsidy on gas/oil/propane boilers in 2026. State and utility programs vary; check Mass Save (MA), NYSERDA Clean Heat (NY), Energy Trust of Oregon, and your local gas utility for any remaining rebates.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Heat-loss calculation in writing (Slant/Fin, Hydronics Institute IBR, or ACCA Manual J for hydronic).</li>
            <li>· AFUE and net rating both stated. Older nameplates list "input BTU" — what matters is net delivered.</li>
            <li>· Outdoor reset control included (cuts fuel ~10–15% by lowering supply temp on milder days).</li>
            <li>· Combustion analyzer printout from startup (CO, O2, stack temp). Without it, the install isn't tuned.</li>
            <li>· Expansion tank, low-water cutoff, and pressure relief valve replaced — they're consumables.</li>
            <li>· Indirect water heater integration if the old boiler did DHW too.</li>
            <li>· Asbestos abatement quote if existing pipe insulation is suspicious (pre-1980 homes).</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="boiler"
    />
    </>
  );
}
