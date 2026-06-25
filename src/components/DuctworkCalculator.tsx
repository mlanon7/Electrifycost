import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type Scope = 'seal_insulate' | 'partial_replace' | 'full_replace' | 'new_install';
type Material = 'flex' | 'sheet_metal' | 'fiber_board';
type Stories = '1' | '2' | '3';
type Access = 'easy' | 'normal' | 'hard';

interface CostBand { low: number; mid: number; high: number; }
const scale = (b: CostBand, m: number): CostBand => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// Per-sqft pricing 2026. Sources: ACCA contractor surveys, Aeroseal proprietary network data,
// Home Advisor / Modernize 2024-2025 ductwork pricing reports, Energy Vanguard estimates.
const COST_PER_SQFT: Record<Scope, Record<Material, CostBand>> = {
  seal_insulate: {
    flex:        { low: 0.80, mid: 1.30, high: 2.00 },
    sheet_metal: { low: 0.80, mid: 1.30, high: 2.00 },
    fiber_board: { low: 0.80, mid: 1.30, high: 2.00 },
  },
  partial_replace: {
    flex:        { low: 1.80, mid: 2.80, high: 4.20 },
    sheet_metal: { low: 2.50, mid: 3.80, high: 5.50 },
    fiber_board: { low: 2.00, mid: 3.00, high: 4.50 },
  },
  full_replace: {
    flex:        { low: 3.50, mid: 5.50, high: 8.00 },
    sheet_metal: { low: 5.00, mid: 7.50, high: 11.00 },
    fiber_board: { low: 3.80, mid: 6.00, high: 9.00 },
  },
  new_install: {
    flex:        { low: 4.50, mid: 6.50, high: 9.00 },
    sheet_metal: { low: 6.00, mid: 9.00, high: 13.00 },
    fiber_board: { low: 5.00, mid: 7.00, high: 10.00 },
  },
};

const STORY_MULT: Record<Stories, number> = { '1': 1.0, '2': 1.15, '3': 1.35 };
const ACCESS_MULT: Record<Access, number> = { easy: 0.95, normal: 1.0, hard: 1.25 };

const AEROSEAL: CostBand = { low: 1500, mid: 2200, high: 3200 };  // Aeroseal injection sealing addon

export default function DuctworkCalculator() {
  useCalculatorUsed('ductwork');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [sqft, setSqft] = useState(1800);
  const [scope, setScope] = useState<Scope>('full_replace');
  const [material, setMaterial] = useState<Material>('flex');
  const [stories, setStories] = useState<Stories>('2');
  const [access, setAccess] = useState<Access>('normal');
  const [aeroseal, setAeroseal] = useState<'yes' | 'no'>('no');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const hvacMult = lab?.hvac_multiplier ?? 1.0;
    const base = COST_PER_SQFT[scope][material];
    const sm = STORY_MULT[stories];
    const am = ACCESS_MULT[access];
    const total: CostBand = scale(base, sqft * hvacMult * sm * am);
    const aeroCost = aeroseal === 'yes' ? scale(AEROSEAL, hvacMult) : { low: 0, mid: 0, high: 0 };
    const gross: CostBand = { low: total.low + aeroCost.low, mid: total.mid + aeroCost.mid, high: total.high + aeroCost.high };
    return { total, aeroCost, gross };
  }, [state, sqft, scope, material, stories, access, aeroseal]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <>
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 94103" className="input mt-1 w-full" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Home size (sqft)</label>
          <input type="number" min={500} max={6000} step={50} value={sqft}
            onChange={e => setSqft(Number(e.target.value) || 0)} className="input mt-1 w-full" />
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Scope of work</label>
          <select className="input mt-1 w-full" value={scope} onChange={e => setScope(e.target.value as Scope)}>
            <option value="seal_insulate">Seal + insulate existing (cheapest)</option>
            <option value="partial_replace">Partial replace (failing sections)</option>
            <option value="full_replace">Full replace (existing duct chases reused)</option>
            <option value="new_install">New install (no existing ducts)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Duct material</label>
          <select className="input mt-1 w-full" value={material} onChange={e => setMaterial(e.target.value as Material)}>
            <option value="flex">Insulated flex (cheapest, most common)</option>
            <option value="sheet_metal">Sheet metal (premium, longest life)</option>
            <option value="fiber_board">Fiberglass duct board (insulated rigid)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Stories</label>
          <select className="input mt-1 w-full" value={stories} onChange={e => setStories(e.target.value as Stories)}>
            <option value="1">1 story</option>
            <option value="2">2 stories</option>
            <option value="3">3+ stories</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Access difficulty</label>
          <select className="input mt-1 w-full" value={access} onChange={e => setAccess(e.target.value as Access)}>
            <option value="easy">Easy (unfinished basement / open attic)</option>
            <option value="normal">Normal (typical crawl space / partial attic)</option>
            <option value="hard">Hard (finished ceilings / tight crawl / chase work)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Add Aeroseal injection?</label>
          <select className="input mt-1 w-full" value={aeroseal} onChange={e => setAeroseal(e.target.value as 'yes' | 'no')}>
            <option value="no">No</option>
            <option value="yes">Yes (+$1,500–$3,200 — seals leaks from inside)</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-white to-amber-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Installed cost · {sqft} sqft · {scope.replace('_', ' ')} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Why it matters</h3>
            <p className="mt-2 text-sm text-ink-700">
              Per DOE / LBNL studies, typical residential ductwork leaks 25–40% of conditioned air into attics or crawl spaces. Sealing + insulating cuts heating/cooling bills 10–20% on its own. Properly sized and sealed ducts can mean a smaller heat pump (saving $1,500–$3,000 on equipment) and avoid panel upgrades.
            </p>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Quote check</h3>
            <ul className="mt-2 space-y-1 text-sm text-ink-700">
              <li>· Manual D duct design (not "we&rsquo;ll match what was there").</li>
              <li>· Static pressure target ≤0.5 inWC at design airflow.</li>
              <li>· R-8 insulation on ducts in unconditioned space.</li>
              <li>· Mastic + mesh sealing at every joint (not foil tape alone).</li>
              <li>· Pre/post blower-door + duct-blaster verification, not just visual.</li>
              <li>· Aeroseal Pre/Post report if used.</li>
            </ul>
          </div>
        </div>
        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Heat pump pairing:</strong> if you&rsquo;re getting a heat pump quote that includes "we&rsquo;ll need to rework your ducts," this calculator gives an independent check on that line item. Heat pumps move 30–50% more CFM than gas furnaces, so undersized return ducts and trunk lines are a common problem in retrofits.
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="ductwork"
    />
    </>
  );
}
