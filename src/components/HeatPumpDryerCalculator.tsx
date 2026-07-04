import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, MODEL_OPTIONS, CURRENT_OPTIONS, LOADS_OPTIONS,
  type Model, type Current, type Loads,
} from '@/lib/calcs/heat-pump-dryer';

export default function HeatPumpDryerCalculator() {
  useCalculatorUsed('heat-pump-dryer');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [model, setModel] = useState<Model>('ventless_fullsize');
  const [current, setCurrent] = useState<Current>('electric_vented');
  const [loads, setLoads] = useState<Loads>('average');

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
    if (h.model && MODEL_OPTIONS.some(o => o.value === h.model)) setModel(h.model as Model);
    if (h.cur && CURRENT_OPTIONS.some(o => o.value === h.cur)) setCurrent(h.cur as Current);
    if (h.loads && LOADS_OPTIONS.some(o => o.value === h.loads)) setLoads(h.loads as Loads);
  });
  const hashValues = { state, zip, model, cur: current, loads };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, model, current, loads }),
    [state, model, current, loads],
  );

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('heat-pump-dryer', () => {
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
          <label className="label" htmlFor="model">Heat-pump dryer model</label>
          <select id="model" className="input" value={model} onChange={e => setModel(e.target.value as Model)}>
            {MODEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="current">Current dryer</label>
          <select id="current" className="input" value={current} onChange={e => setCurrent(e.target.value as Current)}>
            {CURRENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="loads">Loads per week</label>
          <select id="loads" className="input" value={loads} onChange={e => setLoads(e.target.value as Loads)}>
            {LOADS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-blue-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {result.label} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Annual savings vs current</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.annualSavings)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">Old: {fmtUSD(result.oldAnnualCost)} → New: {fmtUSD(result.newAnnualCost)}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Simple payback</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{result.paybackYears != null ? `${result.paybackYears} yr` : 'n/a'}</p>
              <p className="mt-1 text-[11px] text-ink-600">{result.loadsPerYear} loads/yr</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Equipment</span><span className="tabular-nums">{fmtUSD(result.equipment.mid)}</span></li>
              <li className="flex justify-between"><span>Install (delivery + setup)</span><span className="tabular-nums">{fmtUSD(result.install.mid)}</span></li>
              <li className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><span>Total (mid)</span><span className="tabular-nums">{fmtUSD(result.gross.mid)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Why ventless wins</h3>
            <p className="mt-2 text-sm text-ink-700">
              Vented dryers exhaust hot air outside — a hole in your envelope that costs heating dollars. Ventless heat-pump dryers recover the heat into condensate, no exterior vent needed. Especially valuable for apartments, condos, and interior-laundry installs where venting is impractical or impossible.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Rebate note:</strong> heat-pump clothes dryers qualify for the DOE HEEHRA / Home Energy Rebates program where state programs are open — up to $840 for income-qualified households (low or moderate AMI). The federal 25C credit ended Dec 31 2025 and never covered dryers. Some utilities (Mass Save, Energy Trust of Oregon, ConEd) offer $100–$500 rebates on ENERGY STAR heat-pump dryers.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Buying checklist</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· ENERGY STAR Most Efficient certified — best of the best for energy use per load.</li>
            <li>· 120V vs 240V — most full-size models work on a 120V outlet; check before ordering.</li>
            <li>· Drum capacity in cubic feet — match to your typical load size.</li>
            <li>· Condensate drain vs reservoir — drain is preferred but reservoir works in laundry rooms without plumbing.</li>
            <li>· Cycle time — heat pump dryers take 60–90 min vs 40–50 min for vented (acceptable tradeoff for most).</li>
            <li>· Brand network — Miele and Bosch have premium service networks; LG and Samsung have widest parts availability.</li>
            <li>· Stackability if floor space is tight — confirm depth and weight ratings.</li>
            <li>· 5+ year warranty on the compressor — the heat-pump-specific component.</li>
          </ul>
        </div>
      </div>
      </div>
      <MonteCarloSim
        band={result ? { low: result.gross.low, high: result.gross.high } : null}
        items={[
          { low: result.equipment.low, high: result.equipment.high },
          { low: result.install.low, high: result.install.high },
        ].filter(it => it.high > 0)}
        slug="heat-pump-dryer"
      />
    </>
  );
}
