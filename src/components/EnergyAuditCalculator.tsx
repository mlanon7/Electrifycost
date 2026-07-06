import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, TIER_OPTIONS, UTILITY_OPTIONS,
  type Tier, type Utility,
} from '@/lib/calcs/home-energy-audit';

export default function EnergyAuditCalculator() {
  useCalculatorUsed('home-energy-audit');
  const [state, setState] = useState('MA');
  const [zip, setZip] = useState('');
  const [tier, setTier] = useState<Tier>('standard');
  const [utility, setUtility] = useState<Utility>('yes_subsidized');

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
    if (h.tier && TIER_OPTIONS.some(o => o.value === h.tier)) setTier(h.tier as Tier);
    if (h.utility && UTILITY_OPTIONS.some(o => o.value === h.utility)) setUtility(h.utility as Utility);
  });
  const hashValues = { state, zip, tier, utility };
  useHashStateSync(hashValues);

  const result = useMemo(() => compute({ state, tier, utility }), [state, tier, utility]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('home-energy-audit', () => {
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
          <label htmlFor="audit-zip" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input id="audit-zip" type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 02134" className="input mt-1 w-full" />
        </div>
        <div>
          <label htmlFor="audit-state" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select id="audit-state" className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="audit-tier" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Audit tier</label>
          <select id="audit-tier" className="input mt-1 w-full" value={tier} onChange={e => setTier(e.target.value as Tier)}>
            {TIER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="audit-utility" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Utility-sponsored?</label>
          <select id="audit-utility" className="input mt-1 w-full" value={utility} onChange={e => setUtility(e.target.value as Utility)}>
            {UTILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Audit cost · {tier} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{utility === 'yes_free' ? 'FREE' : fmtUSD(result.net.mid)}</p>
            {utility !== 'yes_free' && <p className="text-sm text-ink-600">range {fmtUSDRange(result.net.low, result.net.high)} after subsidy</p>}
            {utility === 'no' && <p className="text-sm text-ink-600">market price {fmtUSDRange(result.base.low, result.base.high)}</p>}
          </div>
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Why get an audit</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Pre/post blower-door diagnostics let you measure air-sealing work, not just visually confirm it.</li>
            <li>· Required by DOE HOMES rebate program for measured-savings tier (up to $8,000 for low-income).</li>
            <li>· IR camera identifies insulation voids, thermal bridges, and air leaks invisible to the eye.</li>
            <li>· Combustion safety check on gas appliances catches CO and back-drafting risks.</li>
            <li>· HERS Index rating sticks with the home — required by some loan/refi products and ENERGY STAR home certification.</li>
          </ul>
        </div>

        <div className="mt-5 rounded-md border border-brand-200 bg-brand-50 p-3 text-xs text-brand-900">
          <strong>Check your utility first.</strong> Mass Save (MA), ConEd / NYSEG (NY), Energy Trust of Oregon, PG&amp;E / SCE / SDG&amp;E (CA), Xcel (CO/MN), ComEd (IL), and many others offer fully free or heavily subsidized energy audits. Don&rsquo;t pay $500+ before checking.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.base.low, high: result.base.high }}
      slug="home-energy-audit"
    />
    </>
  );
}
