import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import { compute, PUMP_OPTIONS, RISK_OPTIONS, type Pump, type FloodRisk } from '@/lib/calcs/sump-pump';

export default function SumpPumpCalculator() {
  useCalculatorUsed('sump-pump');
  const [state, setState] = useState('IL');
  const [zip, setZip] = useState('');
  const [pump, setPump] = useState<Pump>('combo');
  const [floodRisk, setFloodRisk] = useState<FloodRisk>('medium');

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
    if (h.pump && PUMP_OPTIONS.some(o => o.value === h.pump)) setPump(h.pump as Pump);
    if (h.risk && RISK_OPTIONS.some(o => o.value === h.risk)) setFloodRisk(h.risk as FloodRisk);
  });
  const hashValues = { state, zip, pump, risk: floodRisk };
  useHashStateSync(hashValues);

  const result = useMemo(() => compute({ state, pump, floodRisk }), [state, pump, floodRisk]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('sump-pump', () => {
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
          <label className="label" htmlFor="pump">Sump pump configuration</label>
          <select id="pump" className="input" value={pump} onChange={e => setPump(e.target.value as Pump)}>
            {PUMP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="risk">Basement flood risk</label>
          <select id="risk" className="input" value={floodRisk} onChange={e => setFloodRisk(e.target.value as FloodRisk)}>
            {RISK_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-blue-300/60 bg-gradient-to-br from-blue-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Installed cost · {result.label} · {stateName}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <p className="mt-3 text-sm text-blue-800">{result.recommendation}</p>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Backup matters more than capacity:</strong> the most common sump-pump failure isn't horsepower — it's power loss during the same storm that caused the flooding. A 1/3 HP primary + DC battery backup outperforms a 1 HP primary alone during outages. Test the backup quarterly; battery replacement every 4-5 years.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="sump-pump"
    />
    </>
  );
}
