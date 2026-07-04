import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findClimate } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, recommendedTonnage, TONNAGE_OPTIONS, EFFICIENCY_OPTIONS, DUCT_OPTIONS, FURNACE_OPTIONS,
  type Tier, type Tonnage, type DuctState, type FurnaceBundle,
} from '@/lib/calcs/ac-replacement';

export default function AcCalculator() {
  useCalculatorUsed('ac-replacement');
  const [state, setState] = useState('TX');
  const [zip, setZip] = useState('');
  const [sqft, setSqft] = useState(1800);
  const [tonnage, setTonnage] = useState<Tonnage>('3');
  const [tier, setTier] = useState<Tier>('two_stage');
  const [ducts, setDucts] = useState<DuctState>('keep');
  const [furnaceBundle, setFurnaceBundle] = useState<FurnaceBundle>('no');

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
    if (h.ton && TONNAGE_OPTIONS.some(o => o.value === h.ton)) setTonnage(h.ton as Tonnage);
    if (h.tier && EFFICIENCY_OPTIONS.some(o => o.value === h.tier)) setTier(h.tier as Tier);
    if (h.ducts && DUCT_OPTIONS.some(o => o.value === h.ducts)) setDucts(h.ducts as DuctState);
    if (h.furn && FURNACE_OPTIONS.some(o => o.value === h.furn)) setFurnaceBundle(h.furn as FurnaceBundle);
  });
  const hashValues = { state, zip, sqft, ton: tonnage, tier, ducts, furn: furnaceBundle };
  useHashStateSync(hashValues);

  const recommendedTon: Tonnage = useMemo(() => recommendedTonnage(sqft), [sqft]);

  const result = useMemo(
    () => compute({ state, sqft, tonnage, tier, ducts, furnaceBundle }),
    [state, sqft, tonnage, tier, ducts, furnaceBundle],
  );

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  usePublishEstimate('ac-replacement', () => {
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

  const tonMisfit = tonnage !== recommendedTon;
  const climate = findClimate(state)?.iecc_zone ?? "4A";

  return (
    <>
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input
            type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 30303"
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-600">Optional — auto-detects state</p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Home size (sqft)</label>
          <input
            type="number" min={500} max={6000} step={50} value={sqft}
            onChange={e => setSqft(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">
            System size · recommended: <span className="text-brand-700">{recommendedTon} ton</span>
          </label>
          <select className="input mt-1 w-full" value={tonnage} onChange={e => setTonnage(e.target.value as Tonnage)}>
            {TONNAGE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {tonMisfit && (
            <p className="mt-1 text-[11px] text-amber-700">
              Selected size differs from recommended for {sqft} sqft. Get a Manual J load calc before buying — oversized AC short-cycles and dehumidifies poorly.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Efficiency tier</label>
          <select className="input mt-1 w-full" value={tier} onChange={e => setTier(e.target.value as Tier)}>
            {EFFICIENCY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Ductwork</label>
          <select className="input mt-1 w-full" value={ducts} onChange={e => setDucts(e.target.value as DuctState)}>
            {DUCT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Bundle furnace?</label>
          <select className="input mt-1 w-full" value={furnaceBundle} onChange={e => setFurnaceBundle(e.target.value as FurnaceBundle)}>
            {FURNACE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-rose-300/60 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Estimated installed cost · {tonnage} ton {tier === 'single' ? 'single-stage' : tier === 'two_stage' ? 'two-stage' : 'variable-speed'} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)} installed</p>
          </div>

          <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Consider a heat pump instead</p>
            <p className="mt-1 text-sm text-ink-700">
              A central air-source heat pump <em>does</em> cooling and heating with the same equipment. Estimated equivalent install: <span className="font-semibold tabular-nums">{fmtUSD(result.hpAltMid)}</span>. Federal 25C credit ended 2025-12-31, but state and utility heat-pump rebates are widely available.
            </p>
            <a href="/heat-pump-cost-calculator/" className="mt-2 inline-block text-xs font-medium text-brand-700">Open heat pump calculator →</a>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3"><span>Equipment (condenser + coil)</span><span className="tabular-nums">{fmtUSD(result.equip.mid)}</span></li>
              <li className="flex justify-between gap-3"><span>Labor (install + commission)</span><span className="tabular-nums">{fmtUSD(result.labor.mid)}</span></li>
              <li className="flex justify-between gap-3"><span>Refrigerant transition (A2L tooling)</span><span className="tabular-nums">{fmtUSD(result.refrigerant.mid)}</span></li>
              <li className="flex justify-between gap-3"><span>Ductwork</span><span className="tabular-nums">{fmtUSD(result.duct.mid)}</span></li>
              {furnaceBundle === 'yes' && (
                <li className="flex justify-between gap-3"><span>Furnace bundled</span><span className="tabular-nums">{fmtUSD(result.furnace.mid)}</span></li>
              )}
              <li className="flex justify-between gap-3"><span>Permit + disposal</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
            </ul>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Operating cost</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Climate zone</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{climate}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">SEER2 selected</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{result.seer}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Annual cooling kWh</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{result.annualKwh.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Annual cost</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{fmtUSD(result.annualCost)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Savings vs SEER 13 baseline</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-brand-700">{fmtUSD(result.annualSavings)}/yr</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>2026 regulatory note:</strong> Federal SEER2 minimums (14.3 north / 15.2 south) apply to new units placed in service after 2023-01-01. The 2025 EPA refrigerant rule phases R-410A out of new units; expect R-32 (Daikin) or R-454B (Carrier, Trane, Lennox, Goodman) in the equipment quoted. There is no federal 25C credit for air conditioning — heat pumps were eligible through 2025-12-31, AC alone was not.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Manual J load calculation (not a rule-of-thumb tonnage guess).</li>
            <li>· AHRI-matched system certificate (outdoor condenser + indoor coil pair).</li>
            <li>· SEER2, EER2, and HSPF2 numbers in writing — not SEER alone.</li>
            <li>· Refrigerant: R-32 or R-454B specifically (post-2025 units).</li>
            <li>· Line-set: new copper run vs flush-and-reuse of existing.</li>
            <li>· Equipment warranty (10-yr parts is standard) + labor warranty (1-10 yr varies by installer).</li>
            <li>· Commissioning report (charge weight, superheat/subcool, static pressure, airflow per ton).</li>
            <li>· Permit pulled (not "we don't need one — the city won't notice"). Improper installs void warranties.</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="ac-replacement"
    />
    </>
  );
}
