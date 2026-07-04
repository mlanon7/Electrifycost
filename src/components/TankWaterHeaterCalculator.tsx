import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, TANKLESS_GAS_BASELINE,
  FUEL_OPTIONS, TIER_OPTIONS, SIZE_OPTIONS,
  type Fuel, type Tier, type Size,
} from '@/lib/calcs/tank-water-heater';

export default function TankWaterHeaterCalculator({ initialState }: { initialState?: string } = {}) {
  useCalculatorUsed('tank-water-heater');
  const [state, setState] = useState(initialState ?? 'OH');
  const [zip, setZip] = useState('');
  const [fuel, setFuel] = useState<Fuel>('natural_gas');
  const [tier, setTier] = useState<Tier>('standard');
  const [size, setSize] = useState<Size>(50);

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  // Hydrate from URL hash on mount + serialize back (share-link persistence).
  // Restored values are validated so a crafted link can't render absurd totals.
  // A hash-restored state deliberately wins over the page's initialState prop.
  useHashStateInit(h => {
    if (h.state && ALL_STATES.some(s => s.code === h.state)) setState(h.state);
    if (h.zip) setZip(h.zip.replace(/\D/g, '').slice(0, 5));
    if (h.fuel && FUEL_OPTIONS.some(o => o.value === h.fuel)) setFuel(h.fuel as Fuel);
    if (h.tier && TIER_OPTIONS.some(o => o.value === h.tier)) setTier(h.tier as Tier);
    if (h.size) {
      const n = parseInt(h.size, 10);
      if (SIZE_OPTIONS.some(o => o.value === n)) setSize(n as Size);
    }
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
  usePublishEstimate('tank-water-heater', () => {
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

        <div>
          <label className="label" htmlFor="fuel">Fuel</label>
          <select id="fuel" className="input" value={fuel} onChange={e => setFuel(e.target.value as Fuel)}>
            {FUEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tier">Efficiency tier</label>
          <select id="tier" className="input" value={tier} onChange={e => setTier(e.target.value as Tier)}>
            {TIER_OPTIONS.map(o => <option key={o.value} value={o.value} disabled={o.gasOnly && fuel === 'electric'}>{o.label}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="size">Tank size</label>
          <select id="size" className="input" value={size} onChange={e => setSize(Number(e.target.value) as Size)}>
            {SIZE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-blue-300/60 bg-gradient-to-br from-blue-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Installed cost · {result.label} {size}-gal · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">Annual operating cost</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-blue-800">{fmtUSD(result.annualEnergyCost)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">UEF {result.uef.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">HPWH alternative</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-blue-800">{fmtUSD(result.hpwhGross.mid)}</p>
              <p className="mt-1 text-[11px] text-ink-600">Saves {fmtUSD(Math.max(0, result.hpwhSavingsPerYear))}/yr op</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Equipment ({size} gal)</span><span className="tabular-nums">{fmtUSD(result.equipment.mid)}</span></li>
              <li className="flex justify-between"><span>Install + venting</span><span className="tabular-nums">{fmtUSD(result.install.mid)}</span></li>
              <li className="flex justify-between"><span>Permit &amp; inspection</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
              <li className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><span>Total (mid)</span><span className="tabular-nums">{fmtUSD(result.gross.mid)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Three-way comparison</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Standard tank (this calc)</span><span className="tabular-nums">{fmtUSD(result.gross.mid)}</span></li>
              <li className="flex justify-between"><span>HPWH (50-gal hybrid)</span><span className="tabular-nums">{fmtUSD(result.hpwhGross.mid)}</span></li>
              <li className="flex justify-between"><span>Tankless gas</span><span className="tabular-nums">{fmtUSD(TANKLESS_GAS_BASELINE.mid)}</span></li>
            </ul>
            <p className="mt-2 text-[11px] text-ink-600">HPWH typically saves $300-500/yr in operating cost vs gas tank; HEEHRA rebate up to $1,750 for income-qualified buyers.</p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Federal note:</strong> the 25C credit for high-efficiency gas water heaters expired 2025-12-31 (OBBBA). HEEHRA is electric-only — tank gas/propane water heaters do not qualify. Some gas utilities still offer $50-300 rebates on condensing tank installs. HPWH qualifies for HEEHRA up to $1,750.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· UEF (Uniform Energy Factor) in writing — replaces older EF rating.</li>
            <li>· Expansion tank included (required by most codes since 2012).</li>
            <li>· T&P (temperature/pressure) valve and drip pan included.</li>
            <li>· Sediment trap on gas line, dielectric unions on water lines.</li>
            <li>· Old unit haul-away included.</li>
            <li>· Combustion-air check (CO test) at startup for atmospheric-vent gas.</li>
            <li>· 6+ year tank warranty (premium tier offers 12 years).</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="tank-water-heater"
    />
    </>
  );
}
