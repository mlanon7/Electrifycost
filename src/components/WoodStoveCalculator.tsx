import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import { compute, STOVE_GROUPS, STOVE_OPTIONS, type Stove } from '@/lib/calcs/wood-pellet-stove';

export default function WoodStoveCalculator() {
  useCalculatorUsed('wood-pellet-stove');
  const [state, setState] = useState('VT');
  const [zip, setZip] = useState('');
  const [stove, setStove] = useState<Stove>('wood_medium');

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
    if (h.stove && STOVE_OPTIONS.some(o => o.value === h.stove)) setStove(h.stove as Stove);
  });
  const hashValues = { state, zip, stove };
  useHashStateSync(hashValues);

  const result = useMemo(() => compute({ state, stove }), [state, stove]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('wood-pellet-stove', () => {
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
        <div className="md:col-span-2">
          <label className="label" htmlFor="stove">Stove type</label>
          <select id="stove" className="input" value={stove} onChange={e => setStove(e.target.value as Stove)}>
            {STOVE_GROUPS.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-white to-rose-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Installed cost · {result.label} · {stateName}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 rounded-lg border border-amber-200 bg-white/70 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">Annual fuel cost</p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-amber-800">{fmtUSDRange(result.fuel.low, result.fuel.high)}/yr</p>
            <p className="mt-1 text-[11px] text-ink-600">Wood: 3-5 cords/yr at $200–$400/cord · Pellets: 3-5 tons/yr at $250–$350/ton</p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>EPA + permit note:</strong> only EPA 2020-certified stoves can be installed in most jurisdictions. Stovepipe (Class A chimney) must meet UL 103 HT and clear from combustibles per manufacturer specs. Hearth pad with proper R-value required underneath. Most areas need a building permit and final inspection. The 25C credit for biomass stoves (was up to $2,000) expired Dec 31 2025 — only state programs remain.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="wood-pellet-stove"
    />
    </>
  );
}
