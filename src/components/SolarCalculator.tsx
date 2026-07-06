import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, PRODUCTION_KWH_PER_KW,
  ROOF_OPTIONS, COMPLEXITY_OPTIONS, INVERTER_OPTIONS, MOUNT_OPTIONS, BATTERY_OPTIONS, INSTALL_YEAR_OPTIONS,
  type RoofType, type Complexity, type Inverter, type Mount, type BatterySize,
} from '@/lib/calcs/solar';

export default function SolarCalculator() {
  useCalculatorUsed('solar');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [kw, setKw] = useState(7);                     // system DC size
  const [roof, setRoof] = useState<RoofType>('comp_shingle');
  const [complexity, setComplexity] = useState<Complexity>('standard');
  const [inverter, setInverter] = useState<Inverter>('string');
  const [mount, setMount] = useState<Mount>('rooftop');
  const [battery, setBattery] = useState<BatterySize>('none');
  const [annualKwh, setAnnualKwh] = useState(10500);   // U.S. avg residential = 10,500 kWh/year (EIA 2024)
  const [installYear, setInstallYear] = useState(2026);

  // ZIP → state auto-sync
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
    if (h.kw) {
      const n = parseFloat(h.kw);
      if (Number.isFinite(n)) setKw(Math.min(15, Math.max(3, n)));
    }
    if (h.roof && ROOF_OPTIONS.some(o => o.value === h.roof)) setRoof(h.roof as RoofType);
    if (h.cx && COMPLEXITY_OPTIONS.some(o => o.value === h.cx)) setComplexity(h.cx as Complexity);
    if (h.inv && INVERTER_OPTIONS.some(o => o.value === h.inv)) setInverter(h.inv as Inverter);
    if (h.mnt && MOUNT_OPTIONS.some(o => o.value === h.mnt)) setMount(h.mnt as Mount);
    if (h.batt && BATTERY_OPTIONS.some(o => o.value === h.batt)) setBattery(h.batt as BatterySize);
    if (h.kwh) {
      const n = parseInt(h.kwh, 10);
      if (Number.isFinite(n)) setAnnualKwh(Math.min(50000, Math.max(1000, n)));
    }
    if (h.yr) {
      const n = parseInt(h.yr, 10);
      if (INSTALL_YEAR_OPTIONS.some(o => o.value === n)) setInstallYear(n);
    }
  });
  const hashValues = { state, zip, kw, roof, cx: complexity, inv: inverter, mnt: mount, batt: battery, kwh: annualKwh, yr: installYear };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, kw, roof, complexity, inverter, mount, battery, annualKwh, installYear }),
    [state, kw, roof, complexity, inverter, mount, battery, annualKwh, installYear],
  );

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('solar', () => {
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

  const yieldKwhPerKw = PRODUCTION_KWH_PER_KW[state] ?? 1350;

  return (
    <>
    <div className="card overflow-hidden">
      {/* Inputs */}
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label htmlFor="solar-zip" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input
            id="solar-zip"
            type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 90210"
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-600">Optional — auto-detects state</p>
        </div>

        <div>
          <label htmlFor="solar-state" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select id="solar-state" className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="solar-kw" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">
            System size: <span className="font-bold tabular-nums text-ink-900">{kw} kW DC</span>
          </label>
          <input
            id="solar-kw"
            type="range" min={3} max={15} step={0.5} value={kw}
            onChange={e => setKw(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-ink-600">
            <span>3 kW (small)</span><span>7 kW (typical)</span><span>15 kW (large)</span>
          </div>
        </div>

        <div>
          <label htmlFor="solar-roof" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Roof type</label>
          <select id="solar-roof" className="input mt-1 w-full" value={roof} onChange={e => setRoof(e.target.value as RoofType)}>
            {ROOF_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="solar-complexity" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Site complexity</label>
          <select id="solar-complexity" className="input mt-1 w-full" value={complexity} onChange={e => setComplexity(e.target.value as Complexity)}>
            {COMPLEXITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="solar-inverter" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Inverter</label>
          <select id="solar-inverter" className="input mt-1 w-full" value={inverter} onChange={e => setInverter(e.target.value as Inverter)}>
            {INVERTER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="solar-mount" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Mount type</label>
          <select id="solar-mount" className="input mt-1 w-full" value={mount} onChange={e => setMount(e.target.value as Mount)}>
            {MOUNT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="solar-battery" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Battery storage</label>
          <select id="solar-battery" className="input mt-1 w-full" value={battery} onChange={e => setBattery(e.target.value as BatterySize)}>
            {BATTERY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="solar-annual-kwh" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Annual electricity use (kWh)</label>
          <input
            id="solar-annual-kwh"
            type="number" min={1000} max={50000} step={100} value={annualKwh}
            onChange={e => setAnnualKwh(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-600">U.S. average = ~10,500 kWh/year (EIA)</p>
        </div>

        <div>
          <label htmlFor="solar-install-year" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Install year</label>
          <select id="solar-install-year" className="input mt-1 w-full" value={installYear} onChange={e => setInstallYear(Number(e.target.value))}>
            {INSTALL_YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-ink-600">25D Residential Clean Energy Credit terminated by OBBBA for property placed in service after 2025-12-31.</p>
        </div>
      </div>

      {/* Results */}
      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Estimated installed cost · {kw} kW · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)} gross</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Net after incentives (mid)</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.net.mid)}</p>
              <p className="mt-1 text-[11px] text-ink-600">
                Range {fmtUSDRange(result.net.low, result.net.high)}
              </p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Payback (years)</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">
                {result.paybackYears != null ? `${result.paybackYears} yr` : 'n/a'}
              </p>
              <p className="mt-1 text-[11px] text-ink-600">
                Saves ~{fmtUSD(result.annualValue)}/yr at current rates
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {/* Incentive breakdown */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Incentive stack</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-ink-700">Federal 25D ({Math.round(result.fedRate * 100)}%)</span>
                <span className="font-medium tabular-nums text-brand-700">
                  −{fmtUSD(result.federalCredit.mid)}
                </span>
              </li>
              {result.stateRebateName && (
                <li className="flex justify-between gap-3">
                  <span className="text-ink-700">{result.stateRebateName}</span>
                  <span className="font-medium tabular-nums text-brand-700">
                    {result.stateAmt.mid > 0 ? `−${fmtUSD(result.stateAmt.mid)}` : 'tariff/SREC'}
                  </span>
                </li>
              )}
              {result.stateNote && (
                <li className="text-[11px] text-ink-600 leading-relaxed">{result.stateNote}</li>
              )}
            </ul>
            <p className="mt-3 text-[11px] text-ink-600">
              25D credit is non-refundable but carries forward. SRECs and production tariffs (MA SMART, NJ SuSI, IL Shines) are paid over 10-15 years, not upfront.
            </p>
          </div>

          {/* Production estimate */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Production &amp; offset</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Annual production</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{result.annualProduction.toLocaleString()} kWh</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">% of your usage</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{result.offsetPct}%</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Specific yield</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{yieldKwhPerKw} kWh/kW/yr</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">25-yr savings</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{fmtUSD(result.lifetimeSavings)}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-ink-600">
              Production uses NREL PVWatts-style state averages. Real output depends on roof orientation, tilt, and shade. Rate escalation (typically 2-4%/yr) is not modeled — actual savings usually beat this estimate.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Note:</strong> This is a planning-range estimate, not a contractor quote. Roof condition, shade analysis, interconnection costs, and your utility's net-metering successor tariff all affect the actual number. Get 3 written quotes and compare $/W after all credits.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Per-Watt installed cost <em>gross</em> (before any state/utility rebate). Compare to $2.50-$3.30/W national median. The federal 25D credit is 0% for 2026 installs, so per-watt should be compared on gross cost.</li>
            <li>· Production guarantee in kWh (annual) tied to performance, not a vague "estimate."</li>
            <li>· Inverter warranty (string: 10 yr standard, micro: 25 yr) and panel performance warranty (typically 25-yr 84-86% retained capacity).</li>
            <li>· Roof penetration warranty separate from solar warranty.</li>
            <li>· Whether the bid includes critter guard, monitoring, and main-service-panel work if needed.</li>
            <li>· Net-metering tariff your install will be enrolled under (some states have moved to export-rate successor tariffs — e.g., CA NEM 3.0).</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="solar"
    />
    </>
  );
}
