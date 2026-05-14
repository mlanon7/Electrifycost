import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';

type Tier = 'walkthrough' | 'standard' | 'hers' | 'rater_full';
type Utility = 'yes_free' | 'yes_subsidized' | 'no';

interface CostBand { low: number; mid: number; high: number; }
const scale = (b: CostBand, m: number): CostBand => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

const BASE: Record<Tier, CostBand> = {
  walkthrough:  { low: 100, mid: 200, high: 350 },        // visual + clamp ammeter
  standard:     { low: 250, mid: 425, high: 650 },        // BPI Building Analyst, blower door, IR camera
  hers:         { low: 450, mid: 650, high: 900 },        // RESNET HERS rater
  rater_full:   { low: 600, mid: 900, high: 1400 },       // HERS + duct blaster + combustion safety + report
};

const UTILITY_DISCOUNT: Record<Utility, number> = {
  yes_free: 0,                  // utility-sponsored = free
  yes_subsidized: 0.4,
  no: 1.0,
};

export default function EnergyAuditCalculator() {
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

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const m = lab?.electrician_multiplier ?? 1.0;
    const subsidy = UTILITY_DISCOUNT[utility];
    const base = scale(BASE[tier], m);
    const net: CostBand = { low: base.low * subsidy, mid: base.mid * subsidy, high: base.high * subsidy };
    return { base, net };
  }, [state, tier, utility]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 02134" className="input mt-1 w-full" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Audit tier</label>
          <select className="input mt-1 w-full" value={tier} onChange={e => setTier(e.target.value as Tier)}>
            <option value="walkthrough">Walkthrough (visual only — least useful)</option>
            <option value="standard">Standard BPI (blower door + IR camera + recommendations)</option>
            <option value="hers">HERS Index rating (RESNET certified)</option>
            <option value="rater_full">HERS + Duct Blaster + Combustion Safety (full)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Utility-sponsored?</label>
          <select className="input mt-1 w-full" value={utility} onChange={e => setUtility(e.target.value as Utility)}>
            <option value="yes_free">Yes — fully free (Mass Save, ConEd, similar)</option>
            <option value="yes_subsidized">Yes — partially subsidized (50% typical)</option>
            <option value="no">No — pay full price</option>
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
  );
}
