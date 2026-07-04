import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findClimate } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, SCOPE_OPTIONS, TIGHT_OPTIONS, DUCT_OPTIONS,
  type Scope, type Tightness, type IncludeDucts,
} from '@/lib/calcs/air-sealing';

export default function AirSealingCalculator() {
  useCalculatorUsed('air-sealing');
  const [state, setState] = useState('MA');
  const [zip, setZip] = useState('');
  const [sqft, setSqft] = useState(2000);
  const [scope, setScope] = useState<Scope>('pro_targeted');
  const [tight, setTight] = useState<Tightness>('average');
  const [includeDucts, setIncludeDucts] = useState<IncludeDucts>('no');

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
    if (h.scope && SCOPE_OPTIONS.some(o => o.value === h.scope)) setScope(h.scope as Scope);
    if (h.tight && TIGHT_OPTIONS.some(o => o.value === h.tight)) setTight(h.tight as Tightness);
    if (h.ducts && DUCT_OPTIONS.some(o => o.value === h.ducts)) setIncludeDucts(h.ducts as IncludeDucts);
  });
  const hashValues = { state, zip, sqft, scope, tight, ducts: includeDucts };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, sqft, scope, tight, includeDucts }),
    [state, sqft, scope, tight, includeDucts],
  );

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  const climate = findClimate(state)?.iecc_zone ?? '4A';

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('air-sealing', () => {
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
          <label className="label" htmlFor="sqft">Home size (sqft)</label>
          <input id="sqft" className="input" type="number" min={500} max={6000} step={50} value={sqft} onChange={e => setSqft(Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className="label" htmlFor="scope">Scope</label>
          <select id="scope" className="input" value={scope} onChange={e => setScope(e.target.value as Scope)}>
            {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="tight">Current envelope tightness</label>
          <select id="tight" className="input" value={tight} onChange={e => setTight(e.target.value as Tightness)}>
            {TIGHT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="ducts">Include duct sealing?</label>
          <select id="ducts" className="input" value={includeDucts} onChange={e => setIncludeDucts(e.target.value as IncludeDucts)} disabled={scope === 'ducts_only'}>
            {DUCT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {sqft} sqft · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">HVAC savings</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.annualSavings)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">{Math.round(result.savingsPct * 100)}% of HVAC bill</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Simple payback</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{result.paybackYears != null ? `${result.paybackYears} yr` : 'n/a'}</p>
              <p className="mt-1 text-[11px] text-ink-600">Climate zone: {climate}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Envelope sealing</span><span className="tabular-nums">{fmtUSD(result.sealing.mid)}</span></li>
              {includeDucts === 'yes' && scope !== 'ducts_only' && (
                <li className="flex justify-between"><span>Duct sealing</span><span className="tabular-nums">{fmtUSD(result.ducts.mid)}</span></li>
              )}
              <li className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><span>Total (mid)</span><span className="tabular-nums">{fmtUSD(result.gross.mid)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Why air-seal first</h3>
            <p className="mt-2 text-sm text-ink-700">
              Air leakage is invisible until measured. A leaky home (ACH50 ≥ 10) loses 30-50% more conditioned air than a sealed one (ACH50 ≤ 5). Sealing before insulation, heat pump, or window upgrades makes every downstream project work better — and often smaller.
            </p>
            <p className="mt-2 text-[11px] text-ink-600">
              Pair with a blower-door test (~$200-400 standalone) to measure pre/post.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Rebate note:</strong> air sealing qualifies for the DOE HOMES rebate (modeled-savings track) where state programs are open — up to $4,000 (moderate income) or $8,000 (low income) for projects with 35%+ modeled energy savings. Often layered with insulation. The federal 25C credit ended Dec 31 2025.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Pre- and post-blower-door numbers (ACH50 or CFM50). Without this, the contractor can&rsquo;t verify what was achieved.</li>
            <li>· BPI (Building Performance Institute) or RESNET certification — required for HOMES rebate eligibility.</li>
            <li>· Specific areas addressed: attic plane, rim joists, recessed lights, plumbing penetrations, top plates, knee walls, basement-to-living-space transitions.</li>
            <li>· Combustion safety test (CO, draft, depressurization). If you have any combustion appliance and air-seal too tight, you can backdraft. Critical safety check.</li>
            <li>· Target ACH50 in writing. Mid-range goal: 3-5 ACH50 for retrofits; new construction targets 1-3.</li>
            <li>· Materials: low-VOC sealants, dense-pack cellulose for stuffed cavities, intumescent caulk at electrical penetrations.</li>
            <li>· Recessed light treatment — IC-rated cans or fixture replacement, not blanket-cover.</li>
            <li>· Photo documentation of inaccessible areas.</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="air-sealing"
    />
    </>
  );
}
