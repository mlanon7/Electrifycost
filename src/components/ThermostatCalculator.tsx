import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, MODEL_OPTIONS, INSTALL_OPTIONS, CWIRE_OPTIONS, HVAC_OPTIONS,
  type Model, type Install, type Cwire, type HvacType,
} from '@/lib/calcs/smart-thermostat';

export default function ThermostatCalculator() {
  useCalculatorUsed('smart-thermostat');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [model, setModel] = useState<Model>('ecobee_premium');
  const [install, setInstall] = useState<Install>('diy');
  const [cwire, setCwire] = useState<Cwire>('unknown');
  const [hvac, setHvac] = useState<HvacType>('central_ac_furnace');
  const [annualHvacCost, setAnnualHvacCost] = useState(1500);

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
    if (h.install && INSTALL_OPTIONS.some(o => o.value === h.install)) setInstall(h.install as Install);
    if (h.cwire && CWIRE_OPTIONS.some(o => o.value === h.cwire)) setCwire(h.cwire as Cwire);
    if (h.hvac && HVAC_OPTIONS.some(o => o.value === h.hvac)) setHvac(h.hvac as HvacType);
    if (h.cost) {
      const n = parseInt(h.cost, 10);
      if (Number.isFinite(n)) setAnnualHvacCost(Math.min(6000, Math.max(200, n)));
    }
  });
  const hashValues = { state, zip, model, install, cwire, hvac, cost: annualHvacCost };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, model, install, cwire, hvac, annualHvacCost }),
    [state, model, install, cwire, hvac, annualHvacCost],
  );

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('smart-thermostat', () => {
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
          <p className="mt-1 text-[11px] text-ink-600">Optional — auto-detects state</p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Model</label>
          <select className="input mt-1 w-full" value={model} onChange={e => setModel(e.target.value as Model)}>
            {MODEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Install</label>
          <select className="input mt-1 w-full" value={install} onChange={e => setInstall(e.target.value as Install)}>
            {INSTALL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">C-wire present?</label>
          <select className="input mt-1 w-full" value={cwire} onChange={e => setCwire(e.target.value as Cwire)}>
            {CWIRE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">HVAC type</label>
          <select className="input mt-1 w-full" value={hvac} onChange={e => setHvac(e.target.value as HvacType)}>
            {HVAC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Annual HVAC energy cost ($)</label>
          <input
            type="number" min={200} max={6000} step={50} value={annualHvacCost}
            onChange={e => setAnnualHvacCost(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-600">Sum your heating + cooling utility bills for the last 12 months. National average ~$1,500.</p>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-blue-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.net.mid)}</p>
            <p className="text-sm text-ink-600">net after ~${result.rebate} utility rebate · {fmtUSD(result.gross.mid)} gross</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Annual HVAC savings</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.annualSavings)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">{Math.round(result.savingsPct * 100)}% of ${annualHvacCost}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Payback</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">
                {result.paybackYears != null ? `${result.paybackYears} yr` : 'n/a'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3"><span>Hardware</span><span className="tabular-nums">{fmtUSD(result.hw.mid)}</span></li>
              {install === 'pro' && (
                <li className="flex justify-between gap-3"><span>Pro install</span><span className="tabular-nums">{fmtUSD(result.proCost.mid)}</span></li>
              )}
              {cwire === 'no' && (
                <li className="flex justify-between gap-3"><span>Add C-wire (electrician)</span><span className="tabular-nums">{fmtUSD(result.cw.mid)}</span></li>
              )}
              {cwire === 'unknown' && (
                <li className="flex justify-between gap-3"><span>C-wire risk (estimated)</span><span className="tabular-nums">{fmtUSD(result.cw.mid)}</span></li>
              )}
              <li className="flex justify-between gap-3"><span>Utility rebate</span><span className="tabular-nums text-brand-700">−{fmtUSD(result.rebate)}</span></li>
            </ul>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Real-world savings notes</h3>
            <ul className="mt-3 space-y-1 text-sm text-ink-700">
              <li>· Nest&rsquo;s own studies show 10-12% heating savings, 15% cooling savings on average.</li>
              <li>· ENERGY STAR estimates ~8% combined HVAC savings — more conservative.</li>
              <li>· Heat pumps benefit less from aggressive setbacks (recovery cycles can waste efficiency). Use heat-pump-aware mode (Ecobee, Nest) for best results.</li>
              <li>· If you already set your thermostat manually with discipline (away setbacks, night setbacks), the marginal savings drop.</li>
            </ul>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>C-wire context:</strong> Most furnaces installed after ~2000 have a C-wire (common, 24V power). Pre-2000 furnaces and many boiler-only setups don&rsquo;t. Nest can run without one in some configurations (steals power from R-wire); Ecobee includes a Power Extender Kit to bridge the gap. Adding a true C-wire from the air handler is a 30-60 minute electrician visit.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="smart-thermostat"
    />
    </>
  );
}
