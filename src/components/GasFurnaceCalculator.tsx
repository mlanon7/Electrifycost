import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor, findStateEnergy, findClimate } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type Tier = 'basic_80' | 'mid_95' | 'premium_97' | 'condensing_98';
type Size = 'small' | 'medium' | 'large';
type Difficulty = 'easy' | 'average' | 'hard';

interface Band { low: number; mid: number; high: number; }

// Per CSV: gas-furnace-cost-ranges.csv
// Equipment + labor + permit costs sourced from Modernize 2024 and DOE 2024 furnace rule data.
const TIERS: Record<Tier, { afue: number; equipment: Record<Size, Band>; labor: Band; label: string }> = {
  basic_80: {
    afue: 80, label: '80% AFUE single-stage',
    equipment: {
      small:  { low: 1500, mid: 2100, high: 2700 },
      medium: { low: 1800, mid: 2400, high: 3000 },
      large:  { low: 2400, mid: 3000, high: 3800 },
    },
    labor: { low: 1500, mid: 2200, high: 3000 },
  },
  mid_95: {
    afue: 95, label: '95% AFUE single-stage (most common)',
    equipment: {
      small:  { low: 2100, mid: 2800, high: 3600 },
      medium: { low: 2500, mid: 3300, high: 4200 },
      large:  { low: 3200, mid: 4200, high: 5400 },
    },
    labor: { low: 1700, mid: 2500, high: 3500 },
  },
  premium_97: {
    afue: 97, label: '97% AFUE two-stage variable',
    equipment: {
      small:  { low: 3200, mid: 4200, high: 5400 },
      medium: { low: 3800, mid: 5000, high: 6500 },
      large:  { low: 4500, mid: 6000, high: 7800 },
    },
    labor: { low: 1900, mid: 2800, high: 3800 },
  },
  condensing_98: {
    afue: 98, label: '98% AFUE modulating top-tier',
    equipment: {
      small:  { low: 4400, mid: 5800, high: 7500 },
      medium: { low: 5000, mid: 6500, high: 8500 },
      large:  { low: 5800, mid: 7500, high: 9800 },
    },
    labor: { low: 2200, mid: 3200, high: 4500 },
  },
};

const DIFFICULTY_MULT: Record<Difficulty, number> = { easy: 0.9, average: 1.0, hard: 1.25 };

function scale(b: Band, m: number): Band {
  return { low: b.low * m, mid: b.mid * m, high: b.high * m };
}
function add(a: Band, b: Band): Band {
  return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high };
}

// Compare against heat pump replacement (rough industry mid for same home size)
const HEAT_PUMP_COMPARE: Record<Size, Band> = {
  small:  { low: 7000,  mid: 11000, high: 15000 },
  medium: { low: 9000,  mid: 13500, high: 19000 },
  large:  { low: 12000, mid: 17000, high: 24000 },
};

export default function GasFurnaceCalculator() {
  useCalculatorUsed('gas-furnace');
  const [state, setState] = useState('OH');
  const [zip, setZip] = useState('');
  const [tier, setTier] = useState<Tier>('mid_95');
  const [size, setSize] = useState<Size>('medium');
  const [difficulty, setDifficulty] = useState<Difficulty>('average');
  const [annualHeatingCost, setAnnualHeatingCost] = useState(1400);

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const stateLab = findStateLabor(state);
    const laborMult = stateLab?.hvac_multiplier ?? 1.0;
    const t = TIERS[tier];

    const equipment = t.equipment[size];
    const labor = scale(t.labor, laborMult * DIFFICULTY_MULT[difficulty]);
    const permit: Band = { low: 150, mid: 300, high: 650 };
    const gross = add(add(equipment, labor), permit);

    // Operating cost savings vs older 80% AFUE furnace baseline
    const baselineAFUE = 80;
    const newAFUE = t.afue;
    const annualSavings = annualHeatingCost > 0
      ? Math.round(annualHeatingCost * (1 - baselineAFUE / newAFUE))
      : 0;

    // Heat pump alternative
    const hp = HEAT_PUMP_COMPARE[size];
    const hpDelta = hp.mid - gross.mid;

    return { equipment, labor, permit, gross, annualSavings, hp, hpDelta, afue: newAFUE };
  }, [state, tier, size, difficulty, annualHeatingCost]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  const climate = findClimate(state)?.iecc_zone ?? '4A';
  const elec = findStateEnergy(state);

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

        <div className="md:col-span-2">
          <label className="label" htmlFor="tier">Efficiency tier</label>
          <select id="tier" className="input" value={tier} onChange={e => setTier(e.target.value as Tier)}>
            <option value="basic_80">80% AFUE single-stage (southern US only)</option>
            <option value="mid_95">95% AFUE single-stage (northern US minimum, most common)</option>
            <option value="premium_97">97% AFUE two-stage / variable</option>
            <option value="condensing_98">98% AFUE modulating top-tier</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="size">Home size</label>
          <select id="size" className="input" value={size} onChange={e => setSize(e.target.value as Size)}>
            <option value="small">Small (≤1500 sqft) — 60-80k BTU</option>
            <option value="medium">Medium (1500-2500 sqft) — 80-100k BTU</option>
            <option value="large">Large (2500+ sqft) — 100-140k BTU</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="difficulty">Install difficulty</label>
          <select id="difficulty" className="input" value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>
            <option value="easy">Easy (same-spot swap, no venting changes)</option>
            <option value="average">Average (some duct/venting work)</option>
            <option value="hard">Hard (relocate, new venting, basement-to-attic conversion)</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="annualHeat">Current annual heating cost ($)</label>
          <input id="annualHeat" className="input" type="number" min={0} max={6000} step={50} value={annualHeatingCost} onChange={e => setAnnualHeatingCost(Number(e.target.value) || 0)} />
          <p className="mt-1 text-[10px] text-ink-600">If unsure, average US gas-heated home spends $700–$1,800/yr (EIA, 2024).</p>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-white to-amber-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Installed cost · {TIERS[tier].label} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">Operating savings vs 80% AFUE</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-amber-800">{fmtUSD(result.annualSavings)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">New: {result.afue}% AFUE</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">Heat pump alternative</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-amber-800">{fmtUSD(result.hp.mid)}</p>
              <p className="mt-1 text-[11px] text-ink-600">{result.hpDelta >= 0 ? `+${fmtUSD(result.hpDelta)} more` : `${fmtUSD(Math.abs(result.hpDelta))} less`}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Equipment ({result.afue}% AFUE)</span><span className="tabular-nums">{fmtUSD(result.equipment.mid)}</span></li>
              <li className="flex justify-between"><span>Labor (state-adjusted)</span><span className="tabular-nums">{fmtUSD(result.labor.mid)}</span></li>
              <li className="flex justify-between"><span>Permit &amp; inspection</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
              <li className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><span>Total (mid)</span><span className="tabular-nums">{fmtUSD(result.gross.mid)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Should you go heat pump instead?</h3>
            <p className="mt-2 text-sm text-ink-700">
              In climate zone {climate}, a heat pump installed today replaces both heating <em>and</em> cooling. A modern cold-climate heat pump cuts heating energy use ~60% vs an 80% gas furnace — savings stack with whatever state rebate program your utility runs.
            </p>
            {elec && (
              <p className="mt-2 text-[11px] text-ink-600">
                Your state: gas ${elec.natural_gas_dollars_per_therm.toFixed(2)}/therm, electricity {elec.electricity_cents_per_kwh.toFixed(1)}¢/kWh. <a href="/heat-pump-cost-calculator/" className="text-brand-700 font-medium">Run the heat-pump calculator →</a>
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Federal note:</strong> the 25C credit (which once covered high-efficiency furnaces) expired 2025-12-31. There is no federal incentive on a gas furnace replacement in 2026. Some utilities still rebate 95%+ AFUE upgrades; the federal heat-pump incentive landscape is fragmented post-OBBBA but state programs remain robust.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Manual J load calc (ACCA standard) — not "match the old one." Most furnaces are oversized.</li>
            <li>· AFUE rating in writing. Northern US requires 95%+ AFUE since the 2024 DOE rule.</li>
            <li>· Venting — condensing units need PVC vent, not the old metal flue.</li>
            <li>· Combustion-air strategy: outdoor sealed combustion preferred over indoor draft.</li>
            <li>· Permit pulled. Skipping the permit voids many warranties and complicates resale.</li>
            <li>· Old-equipment haul-away and refrigerant recovery included if AC is bundled.</li>
            <li>· Warranty: 10 years parts + 1+ year labor minimum. Premium tiers offer 12-year heat exchanger.</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="gas-furnace"
    />
    </>
  );
}
