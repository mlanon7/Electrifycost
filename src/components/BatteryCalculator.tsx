import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, USECASE_OPTIONS, CHEMISTRY_OPTIONS, PAIRED_OPTIONS, PANEL_OPTIONS, YEAR_OPTIONS,
  type UseCase, type Chemistry, type PairedSolar, type Panel,
} from '@/lib/calcs/home-battery';

export default function BatteryCalculator() {
  useCalculatorUsed('home-battery');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [kwh, setKwh] = useState(13.5);   // Powerwall-3 default
  const [useCase, setUseCase] = useState<UseCase>('self_consumption');
  const [chemistry, setChemistry] = useState<Chemistry>('lfp');
  const [paired, setPaired] = useState<PairedSolar>('yes');
  const [panel, setPanel] = useState<Panel>('200A');
  const [installYear, setInstallYear] = useState(2026);

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
    if (h.kwh) {
      const n = parseFloat(h.kwh);
      if (Number.isFinite(n)) setKwh(Math.min(40, Math.max(5, n)));
    }
    if (h.use && USECASE_OPTIONS.some(o => o.value === h.use)) setUseCase(h.use as UseCase);
    if (h.chem && CHEMISTRY_OPTIONS.some(o => o.value === h.chem)) setChemistry(h.chem as Chemistry);
    if (h.paired && PAIRED_OPTIONS.some(o => o.value === h.paired)) setPaired(h.paired as PairedSolar);
    if (h.panel && PANEL_OPTIONS.some(o => o.value === h.panel)) setPanel(h.panel as Panel);
    if (h.yr) {
      const n = parseInt(h.yr, 10);
      if (YEAR_OPTIONS.some(o => o.value === n)) setInstallYear(n);
    }
  });
  const hashValues = { state, zip, kwh, use: useCase, chem: chemistry, paired, panel, yr: installYear };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, kwh, useCase, chemistry, paired, panel, installYear }),
    [state, kwh, useCase, chemistry, paired, panel, installYear],
  );

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  usePublishEstimate('home-battery', () => {
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
            placeholder="e.g., 02134"
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

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">
            Usable capacity: <span className="font-bold tabular-nums text-ink-900">{kwh} kWh</span>
          </label>
          <input
            type="range" min={5} max={40} step={0.5} value={kwh}
            onChange={e => setKwh(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-ink-600">
            <span>5 kWh (small)</span><span>13.5 kWh (Powerwall)</span><span>40 kWh (large)</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Use case</label>
          <select className="input mt-1 w-full" value={useCase} onChange={e => setUseCase(e.target.value as UseCase)}>
            {USECASE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Cell chemistry</label>
          <select className="input mt-1 w-full" value={chemistry} onChange={e => setChemistry(e.target.value as Chemistry)}>
            {CHEMISTRY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Paired with new solar?</label>
          <select className="input mt-1 w-full" value={paired} onChange={e => setPaired(e.target.value as PairedSolar)}>
            {PAIRED_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Main panel</label>
          <select className="input mt-1 w-full" value={panel} onChange={e => setPanel(e.target.value as Panel)}>
            {PANEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Install year</label>
          <select className="input mt-1 w-full" value={installYear} onChange={e => setInstallYear(Number(e.target.value))}>
            {YEAR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <p className="mt-1 text-[11px] text-ink-600">25D Residential Clean Energy Credit terminated by OBBBA for property placed in service after 2025-12-31.</p>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-blue-300/60 bg-gradient-to-br from-blue-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Estimated installed cost · {kwh} kWh · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)} gross</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">Net after incentives (mid)</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-blue-800">{fmtUSD(result.net.mid)}</p>
              <p className="mt-1 text-[11px] text-ink-600">Range {fmtUSDRange(result.net.low, result.net.high)}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">
                {result.paybackYears != null && result.paybackYears <= 25 ? 'Payback' : 'Annual benefit'}
              </p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-blue-800">
                {result.paybackYears != null && result.paybackYears <= 25
                  ? `${result.paybackYears} yr`
                  : `${fmtUSD(result.annualSavings)}/yr`}
              </p>
              <p className="mt-1 text-[11px] text-ink-600">
                TOU + resilience savings
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Incentive stack</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-ink-700">Federal 25D ({Math.round(result.fedRate * 100)}%, ≥3 kWh)</span>
                <span className="font-medium tabular-nums text-brand-700">
                  −{fmtUSD(result.federalCredit.mid)}
                </span>
              </li>
              {result.stateRebate && (
                <li className="flex justify-between gap-3">
                  <span className="text-ink-700">{result.stateRebate.name}</span>
                  <span className="font-medium tabular-nums text-brand-700">
                    {result.stateAmt.mid > 0 ? `−${fmtUSD(result.stateAmt.mid)}` : 'see note'}
                  </span>
                </li>
              )}
              {result.stateRebate?.note && (
                <li className="text-[11px] text-ink-600 leading-relaxed">{result.stateRebate.note}</li>
              )}
            </ul>
            <p className="mt-3 text-[11px] text-ink-600">
              Federal 25D credit (30% standalone battery ≥3 kWh) was terminated by OBBBA for property placed in service after 2025-12-31. State programs vary; verify income tier and capacity caps with the program administrator.
            </p>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Benefits estimate</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Annual TOU savings</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{fmtUSD(result.tou)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Resilience value</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{fmtUSD(result.resilience)}/yr</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Useful cycles</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">~6,000 (LFP) / ~3,500 (NMC)</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Warranty (typical)</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">10 yr / 70% capacity</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-ink-600">
              Resilience value is a conservative annualized figure; actual avoided-outage cost can be much higher during sustained outages or for medical-baseline households.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Note:</strong> Payback math for batteries is best-case in TOU-aggressive states (CA, MA, NY, HI). In flat-rate utility territory the financial case usually depends on outage avoidance, not arbitrage. The resilience value here is a placeholder — quantify your own based on outage frequency and what you'd lose.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Usable capacity (not nameplate) and end-of-warranty capacity retention (typically 70-80%).</li>
            <li>· Round-trip efficiency (modern systems 89-92%).</li>
            <li>· Cycle warranty (10,000 cycles for LFP, 6,000-7,000 for NMC).</li>
            <li>· Backup loads and transfer time (whole-home transfer: ms to seconds; partial: instant via dedicated subpanel).</li>
            <li>· Whether the inverter is integrated (Powerwall 3, Franklin) or separate (Enphase requires separate IQ8 microinverters or System Controller).</li>
            <li>· Monitoring, software updates, and grid-services enrollment (Tesla VPP, Sunrun Connected Solutions, etc.).</li>
            <li>· Permit and interconnection lead time — typical 4–10 weeks in 2026.</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="home-battery"
    />
    </>
  );
}
