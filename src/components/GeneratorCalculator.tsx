import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, validSizingsFor, SIZE_BTU_HOURS, TYPE_OPTIONS, FUEL_OPTIONS, TRANSFER_OPTIONS,
  type Type, type Fuel, type Transfer, type Sizing,
} from '@/lib/calcs/generator';

export default function GeneratorCalculator() {
  useCalculatorUsed('generator');
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');
  const [type, setType] = useState<Type>('standby_air');
  const [sizing, setSizing] = useState<Sizing>('18kw');
  const [fuel, setFuel] = useState<Fuel>('natural_gas');
  const [transfer, setTransfer] = useState<Transfer>('ats_whole');
  const [annualHours, setAnnualHours] = useState(24);

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
    let t: Type = 'standby_air';
    if (h.type && TYPE_OPTIONS.some(o => o.value === h.type)) { t = h.type as Type; setType(t); }
    if (h.size && validSizingsFor(t).includes(h.size as Sizing)) setSizing(h.size as Sizing);
    if (h.fuel && FUEL_OPTIONS.some(o => o.value === h.fuel)) setFuel(h.fuel as Fuel);
    if (h.xfer && TRANSFER_OPTIONS.some(o => o.value === h.xfer)) setTransfer(h.xfer as Transfer);
    if (h.hrs) {
      const n = parseInt(h.hrs, 10);
      if (Number.isFinite(n)) setAnnualHours(Math.min(2000, Math.max(0, n)));
    }
  });
  const hashValues = { state, zip, type, size: sizing, fuel, xfer: transfer, hrs: annualHours };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, type, sizing, fuel, transfer, annualHours }),
    [state, type, sizing, fuel, transfer, annualHours],
  );

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('generator', () => {
    if (!result.equipmentValid || !(result.gross.high > 0)) return null;
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

  const validSizings = validSizingsFor(type);

  return (
    <>
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label htmlFor="gen-zip" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input
            id="gen-zip"
            type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 33101"
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-600">Optional — auto-detects state</p>
        </div>

        <div>
          <label htmlFor="gen-state" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select id="gen-state" className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="gen-type" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Generator type</label>
          <select id="gen-type" className="input mt-1 w-full" value={type} onChange={e => { setType(e.target.value as Type); setSizing('10kw'); }}>
            {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="gen-sizing" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Sizing (kW)</label>
          <select id="gen-sizing" className="input mt-1 w-full" value={sizing} onChange={e => setSizing(e.target.value as Sizing)}>
            {validSizings.map(s => <option key={s} value={s}>{s.replace('kw', ' kW')} ({SIZE_BTU_HOURS[s].toLocaleString()} W)</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="gen-fuel" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Fuel</label>
          <select id="gen-fuel" className="input mt-1 w-full" value={fuel} onChange={e => setFuel(e.target.value as Fuel)}>
            {FUEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="gen-transfer" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Transfer mechanism</label>
          <select id="gen-transfer" className="input mt-1 w-full" value={transfer} onChange={e => setTransfer(e.target.value as Transfer)}>
            {TRANSFER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="gen-hours" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Expected annual runtime (hours)</label>
          <input
            id="gen-hours"
            type="number" min={0} max={2000} step={5} value={annualHours}
            onChange={e => setAnnualHours(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-600">Avg U.S. household experiences ~8 outage-hours/year; hurricane regions average 40-120 hours.</p>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        {!result.equipmentValid ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            That size isn&rsquo;t available in this generator class. Try a different size or type.
          </div>
        ) : (
          <>
            <div className="net-card relative overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-white to-amber-50 p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Installed cost · {sizing.replace('kw', ' kW')} · {stateName}
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
                <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)} installed</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">Annual operating</p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-amber-800">{fmtUSD(result.annualOperating)}/yr</p>
                  <p className="mt-1 text-[11px] text-ink-600">~{annualHours} hours runtime + service</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">Fuel rate</p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-amber-800">{fmtUSD(result.fuelPerHour)}/hr</p>
                  <p className="mt-1 text-[11px] text-ink-600">at 50% load, current fuel prices</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
                <ul className="mt-3 space-y-1.5 text-sm">
                  <li className="flex justify-between gap-3"><span>Generator equipment</span><span className="tabular-nums">{fmtUSD(result.equipment.mid)}</span></li>
                  <li className="flex justify-between gap-3"><span>Transfer mechanism</span><span className="tabular-nums">{fmtUSD(result.transferCost.mid)}</span></li>
                  <li className="flex justify-between gap-3"><span>Install labor + materials</span><span className="tabular-nums">{fmtUSD(result.installCost.mid)}</span></li>
                  {result.gasLine.mid > 0 && (
                    <li className="flex justify-between gap-3"><span>Natural gas line extension</span><span className="tabular-nums">{fmtUSD(result.gasLine.mid)}</span></li>
                  )}
                  {result.propTank.mid > 0 && (
                    <li className="flex justify-between gap-3"><span>Propane tank install</span><span className="tabular-nums">{fmtUSD(result.propTank.mid)}</span></li>
                  )}
                  <li className="flex justify-between gap-3"><span>Permit + inspection</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
                </ul>
              </div>

              <div className="card p-4">
                <h3 className="text-sm font-semibold text-ink-900">Consider battery storage instead</h3>
                <p className="mt-2 text-sm text-ink-700">
                  A 13.5 kWh battery (Powerwall, Franklin) installs for $13,000–$19,000 — comparable to a 22 kW standby generator with whole-home ATS. The federal 25D credit (30%, including standalone batteries ≥3 kWh) was terminated by OBBBA for property placed in service after 2025-12-31, so it does not reduce 2026-forward battery installs; check state storage programs (CA SGIP, NY-Sun Storage, CT, MD). Battery is silent, doesn&rsquo;t require fuel, runs from solar if you have it. Generator wins on sustained multi-day outages and unlimited capacity.
                </p>
                <a href="/home-battery-cost-calculator/" className="mt-2 inline-block text-xs font-medium text-brand-700">Open battery calculator →</a>
              </div>
            </div>

            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>Code compliance:</strong> permanent generator installs are governed by NEC 702 (Optional Standby Systems). Interlock kits must be UL-listed and breaker-specific. Backfeeding without an interlock or ATS is illegal in all 50 states and can kill utility lineworkers during outage repair. Always pull a permit.
            </div>

            <div className="mt-5 card p-4">
              <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
              <ul className="mt-2 space-y-1 text-sm text-ink-700">
                <li>· Permit pulled and inspected — non-negotiable.</li>
                <li>· Pad: poured concrete or pre-cast composite (Versa-Lift). Cheap installs use a gravel pad which fails NEC clearance requirements in many jurisdictions.</li>
                <li>· Fuel line sizing — natural gas needs adequate line pressure; many residential lines undersized for 22+ kW units.</li>
                <li>· Battery for control circuit — without it, the unit won&rsquo;t start in winter.</li>
                <li>· ATS rating matches your service entrance (200A standard).</li>
                <li>· Bi-annual exercise schedule (most units self-test weekly).</li>
                <li>· Service contract: $200-450/year for standby units; check what&rsquo;s included (oil + filter, valve adjustment, battery, transfer switch test).</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="generator"
    />
    </>
  );
}
