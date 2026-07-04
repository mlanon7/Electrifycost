import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import { compute, SYSTEM_OPTIONS, HARDNESS_OPTIONS, type System, type Hardness } from '@/lib/calcs/water-treatment';

export default function WaterTreatmentCalculator() {
  useCalculatorUsed('water-treatment');
  const [state, setState] = useState('TX');
  const [zip, setZip] = useState('');
  const [system, setSystem] = useState<System>('softener_carbon_combo');
  const [hardness, setHardness] = useState<Hardness>('hard');

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
    if (h.sys && SYSTEM_OPTIONS.some(o => o.value === h.sys)) setSystem(h.sys as System);
    if (h.hard && HARDNESS_OPTIONS.some(o => o.value === h.hard)) setHardness(h.hard as Hardness);
  });
  const hashValues = { state, zip, sys: system, hard: hardness };
  useHashStateSync(hashValues);

  const result = useMemo(() => compute({ state, system, hardness }), [state, system, hardness]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('water-treatment', () => {
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
          <select id="state" className="input" value={state} onChange={e => setState(e.target.value)}>{ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}</select>
        </div>
        <div>
          <label className="label" htmlFor="zip">ZIP</label>
          <input id="zip" className="input" inputMode="numeric" pattern="\d*" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/[^0-9]/g, ''))} />
          <p className="mt-1 text-[10px] text-ink-600">{zip.length === 5 ? <span className="text-brand-700">State auto-set from ZIP</span> : 'Optional — auto-sets state'}</p>
        </div>
        <div>
          <label className="label" htmlFor="system">System type</label>
          <select id="system" className="input" value={system} onChange={e => setSystem(e.target.value as System)}>
            {SYSTEM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="hardness">Water hardness</label>
          <select id="hardness" className="input" value={hardness} onChange={e => setHardness(e.target.value as Hardness)}>
            {HARDNESS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-blue-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">Installed cost · {result.label} · {stateName}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Annual operating cost</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.annualOp)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">Salt: {fmtUSD(result.annualSaltCost)} · Electric: {fmtUSD(result.annualElec)}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">HPWH compatibility</p>
              <p className="mt-0.5 text-sm font-medium text-brand-800">{system.includes('softener') ? '✓ Recommended before HPWH' : 'Optional'}</p>
              <p className="mt-1 text-[11px] text-ink-600">Hard water shortens HPWH coil life ~30%</p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Why softener pairs with HPWH:</strong> heat pump water heaters circulate water through small-diameter copper or stainless coils that scale faster than tank elements. Installing a softener before a HPWH retrofit often pays back through extended equipment life. Same logic for tankless gas — manufacturers void warranties if hardness exceeds 7-10 gpg without treatment.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="water-treatment"
    />
    </>
  );
}
