import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, validSizesFor, SIZE_LABELS, TYPE_OPTIONS, EXISTING_OPTIONS, GAS_LINE_OPTIONS, PANEL_OPTIONS,
  type Type, type Size, type Existing, type GasLine, type PanelOk,
} from '@/lib/calcs/tankless-water-heater';

export default function TanklessCalculator() {
  useCalculatorUsed('tankless-water-heater');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [type, setType] = useState<Type>('gas_condensing');
  const [size, setSize] = useState<Size>('180k');
  const [existing, setExisting] = useState<Existing>('gas_tank');
  const [gasLine, setGasLine] = useState<GasLine>('upsize');
  const [panelOk, setPanelOk] = useState<PanelOk>('yes');

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
    let t: Type = 'gas_condensing';
    if (h.type && TYPE_OPTIONS.some(o => o.value === h.type)) {
      t = h.type as Type;
      setType(t);
      // Restoring a type applies its default size first (same as the select's
      // onChange), so the type/size pair can never be inconsistent; a valid
      // h.size then wins below.
      setSize(t.startsWith('gas') ? '180k' : t === 'electric_pos' ? 'electric_18' : 'electric_27');
    }
    if (h.size && validSizesFor(t).includes(h.size as Size)) setSize(h.size as Size);
    if (h.exist && EXISTING_OPTIONS.some(o => o.value === h.exist)) setExisting(h.exist as Existing);
    if (h.gas && GAS_LINE_OPTIONS.some(o => o.value === h.gas)) setGasLine(h.gas as GasLine);
    if (h.panel && PANEL_OPTIONS.some(o => o.value === h.panel)) setPanelOk(h.panel as PanelOk);
  });
  const hashValues = { state, zip, type, size, exist: existing, gas: gasLine, panel: panelOk };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, type, size, existing, gasLine, panelOk }),
    [state, type, size, existing, gasLine, panelOk],
  );

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  const validSizes = validSizesFor(type);

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('tankless-water-heater', () => {
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
          <input
            type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 94103"
            className="input mt-1 w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Tankless type</label>
          <select className="input mt-1 w-full" value={type} onChange={e => { setType(e.target.value as Type); setSize(e.target.value.startsWith('gas') ? '180k' : e.target.value === 'electric_pos' ? 'electric_18' : 'electric_27'); }}>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Size</label>
          <select className="input mt-1 w-full" value={size} onChange={e => setSize(e.target.value as Size)}>
            {validSizes.map(s => <option key={s} value={s}>{SIZE_LABELS[s]}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Existing water heater</label>
          <select className="input mt-1 w-full" value={existing} onChange={e => setExisting(e.target.value as Existing)}>
            {EXISTING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {(type === 'gas_condensing' || type === 'gas_non_condensing') && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Gas line</label>
            <select className="input mt-1 w-full" value={gasLine} onChange={e => setGasLine(e.target.value as GasLine)}>
              {GAS_LINE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}

        {type === 'electric_whole' && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Panel capacity for 100-150A draw?</label>
            <select className="input mt-1 w-full" value={panelOk} onChange={e => setPanelOk(e.target.value as typeof panelOk)}>
              {PANEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-blue-300/60 bg-gradient-to-br from-blue-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Installed cost · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">Annual operating cost</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-blue-800">{fmtUSD(result.operating)}/yr</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">Annual savings vs tank baseline</p>
              <p className={`mt-0.5 text-xl font-semibold tabular-nums ${result.annualSavings >= 0 ? 'text-brand-700' : 'text-rose-700'}`}>
                {result.annualSavings >= 0 ? '+' : ''}{fmtUSD(result.annualSavings)}/yr
              </p>
              <p className="mt-1 text-[11px] text-ink-600">vs comparable tank water heater (negative = costs more)</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3"><span>Equipment</span><span className="tabular-nums">{fmtUSD(result.equipment.mid)}</span></li>
              <li className="flex justify-between gap-3"><span>Install (labor + materials)</span><span className="tabular-nums">{fmtUSD(result.install.mid)}</span></li>
              {result.gasLineCost.mid > 0 && (
                <li className="flex justify-between gap-3"><span>Gas line work</span><span className="tabular-nums">{fmtUSD(result.gasLineCost.mid)}</span></li>
              )}
              {result.panelUpgrade.mid > 0 && (
                <li className="flex justify-between gap-3"><span>Panel upgrade (likely)</span><span className="tabular-nums">{fmtUSD(result.panelUpgrade.mid)}</span></li>
              )}
              {result.tankRemove.mid > 0 && (
                <li className="flex justify-between gap-3"><span>Tank removal + disposal</span><span className="tabular-nums">{fmtUSD(result.tankRemove.mid)}</span></li>
              )}
              <li className="flex justify-between gap-3"><span>Permit + inspection</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
            </ul>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Consider HPWH instead</h3>
            <p className="mt-2 text-sm text-ink-700">
              A heat pump water heater (HPWH) installs for $2,500–$5,500 — comparable to gas tankless — and qualifies for income-tiered DOE Home Energy Rebates ($1,750 max in HEEHRA-open states). Operating cost is the lowest of any category. The catch: needs ~700 cu-ft of free air to breathe and a condensate drain. Best fit for unfinished basements and garages.
            </p>
            <a href="/heat-pump-water-heater-cost-calculator/" className="mt-2 inline-block text-xs font-medium text-brand-700">Open HPWH calculator →</a>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Electric tankless caveat:</strong> whole-home electric tankless (27-36 kW) draws 100-150A continuous on its own. Most existing residential panels (100A or even 200A with normal loads) cannot accommodate this. Real-world: electric whole-home tankless almost always triggers a panel upgrade ($1,500–$5,000) plus a service-entrance upgrade if the utility transformer is undersized. Point-of-use electric (under-sink for one fixture) is the only electric tankless that&rsquo;s typically practical without panel work.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· UEF (Uniform Energy Factor) — 0.95+ for condensing gas, 0.82-0.86 for non-condensing, 0.99 for electric.</li>
            <li>· Flow rate at design temperature rise (GPM @ 70°F rise in cold climates). 5+ GPM = 2-3 simultaneous showers.</li>
            <li>· Vent type — sealed Cat IV PVC for condensing (cheap, long runs OK); Cat III stainless for non-condensing (limited length).</li>
            <li>· Condensate handling for condensing units — drain to plumbing stack or sump, neutralizer cartridge required in some jurisdictions.</li>
            <li>· Water hardness — most tankless require &lt; 7 grains/gallon or a softener; warranties void without descaling annually in hard-water areas.</li>
            <li>· Recirculation pump option if you have long pipe runs and want instant hot water.</li>
            <li>· Warranty (heat exchanger 12-15 yr, parts 5 yr, labor 1 yr typical).</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="tankless-water-heater"
    />
    </>
  );
}
