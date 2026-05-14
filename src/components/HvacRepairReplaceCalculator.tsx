import { useMemo, useState } from 'react';
import { fmtUSD } from '@/lib/format';

type Equipment = 'furnace' | 'central_ac' | 'boiler' | 'heat_pump';
type Refrigerant = 'r22' | 'r410a' | 'r32_r454b' | 'n/a';

interface Recommendation {
  verdict: 'repair' | 'replace' | 'replace_with_heat_pump' | 'replace_soon';
  confidence: 'high' | 'medium' | 'low';
  primary: string;
  details: string[];
}

const REPLACE_TYPICAL: Record<Equipment, { low: number; mid: number; high: number; label: string }> = {
  furnace:    { low: 4500, mid: 6500, high: 11000, label: '95% AFUE gas furnace' },
  central_ac: { low: 5500, mid: 8500, high: 14000, label: 'central AC (SEER2 15-17)' },
  boiler:     { low: 6000, mid: 9500, high: 16000, label: 'condensing gas boiler' },
  heat_pump:  { low: 8000, mid: 13500, high: 22000, label: 'cold-climate heat pump' },
};

// Heat pump alternative for any equipment type — air-source ducted
const HEAT_PUMP_ALT = { low: 8000, mid: 13500, high: 22000 };

function rankRecommendation(eq: Equipment, age: number, repairCost: number, refrigerant: Refrigerant, recentRepairCount: number, energyBillTrend: 'flat' | 'rising'): Recommendation {
  const typical = REPLACE_TYPICAL[eq];
  const repairPctOfReplace = repairCost / typical.mid;
  const isLifespanEnd = (eq === 'furnace' && age >= 15) ||
    (eq === 'central_ac' && age >= 15) ||
    (eq === 'heat_pump' && age >= 15) ||
    (eq === 'boiler' && age >= 25);

  // R-22 AC = automatic replace regardless of repair cost
  if (eq === 'central_ac' && refrigerant === 'r22') {
    return {
      verdict: 'replace_with_heat_pump',
      confidence: 'high',
      primary: 'Replace — R-22 refrigerant production banned 2020',
      details: [
        'R-22 (Freon) production ended January 2020. Recovered/recycled R-22 sells for $100-200+ per pound.',
        'A typical refill costs $400-800 just for refrigerant.',
        'Your AC predates current efficiency standards — replacement will cut cooling kWh 30-40%.',
        'A heat pump replaces both the AC and your separate furnace at the same cost as a new AC.',
      ],
    };
  }

  // End-of-life equipment
  if (isLifespanEnd && repairPctOfReplace > 0.10) {
    return {
      verdict: 'replace_with_heat_pump',
      confidence: 'high',
      primary: 'Replace — equipment at end of life',
      details: [
        `Your ${eq.replace('_', ' ')} is ${age} years old. Industry service life is ${eq === 'boiler' ? '25-30' : '15-20'} years.`,
        `Repair cost (${fmtUSD(repairCost)}) is ${Math.round(repairPctOfReplace * 100)}% of replacement.`,
        'Even a successful repair leaves you with end-of-life equipment that may fail again within 1-3 years.',
        'A heat pump replaces heating + cooling at the same total cost as separate furnace + AC.',
      ],
    };
  }

  // 50% rule violation
  if (age >= 10 && repairPctOfReplace > 0.50) {
    return {
      verdict: 'replace',
      confidence: 'high',
      primary: 'Replace — 50% rule violated',
      details: [
        `Repair cost (${fmtUSD(repairCost)}) is ${Math.round(repairPctOfReplace * 100)}% of replacement cost.`,
        `The 50% rule: if a repair on equipment 10+ years old exceeds 50% of replacement, replace it.`,
        'Beyond the math, mid-life equipment fails more after a major repair, not less.',
        'New equipment includes a fresh 10-year warranty.',
      ],
    };
  }

  // Multiple recent repairs
  if (recentRepairCount >= 3) {
    return {
      verdict: 'replace_soon',
      confidence: 'medium',
      primary: 'Replace soon — repair pattern signals failure',
      details: [
        `${recentRepairCount} repairs in the past 24 months indicate the equipment is past its prime.`,
        'Each repair fixes a symptom; the underlying decline continues.',
        'Plan replacement for next off-season (spring or fall) to avoid emergency-replacement premiums.',
        'Continued small repairs will eventually total more than replacement plus utility savings.',
      ],
    };
  }

  // Rising energy bills with older equipment
  if (energyBillTrend === 'rising' && age >= 10) {
    return {
      verdict: 'replace',
      confidence: 'medium',
      primary: 'Replace — efficiency decline likely',
      details: [
        `Equipment loses 1-3% efficiency per year after year 10.`,
        'Rising bills with stable usage indicate the equipment is working harder for the same output.',
        'Modern equipment is 15-40% more efficient than 10-year-old equipment.',
        'The fuel/electricity savings often cover the financing payment on replacement.',
      ],
    };
  }

  // Young equipment, cheap repair
  if (age <= 8 && repairPctOfReplace < 0.30) {
    return {
      verdict: 'repair',
      confidence: 'high',
      primary: 'Repair — equipment is young and repair is affordable',
      details: [
        `Equipment under 8 years old typically has 7-12 years of useful life left.`,
        `Repair cost (${fmtUSD(repairCost)}) is a small fraction of replacement.`,
        'Check warranty status before paying — major components (compressor, heat exchanger) often have 10-year manufacturer coverage.',
        'A single repair on young equipment does not signal a pattern.',
      ],
    };
  }

  // Mid-life, expensive repair, no other factors
  if (age >= 8 && age < 15 && repairPctOfReplace > 0.30) {
    return {
      verdict: 'replace',
      confidence: 'medium',
      primary: 'Replace — mid-life with expensive repair',
      details: [
        `Mid-life equipment with a ${Math.round(repairPctOfReplace * 100)}%-of-replacement repair is a gamble.`,
        'A second major repair within 3 years is likely.',
        'Replacement gives you a fresh 10-year warranty and modern efficiency.',
        'Heat-pump upgrade is worth pricing — replaces heat + AC at similar total cost.',
      ],
    };
  }

  // Default: repair, but watch
  return {
    verdict: 'repair',
    confidence: 'medium',
    primary: 'Repair — but start planning for replacement',
    details: [
      'No single factor strongly favors replacement right now.',
      `Equipment age (${age} yr) and repair cost (${fmtUSD(repairCost)}) both within reasonable ranges.`,
      'Start budgeting and researching replacement so you can act in the next off-season.',
      'If another major repair appears within 18 months, replace.',
    ],
  };
}

export default function HvacRepairReplaceCalculator() {
  const [equipment, setEquipment] = useState<Equipment>('furnace');
  const [age, setAge] = useState(12);
  const [repairCost, setRepairCost] = useState(1200);
  const [refrigerant, setRefrigerant] = useState<Refrigerant>('r410a');
  const [recentRepairs, setRecentRepairs] = useState(1);
  const [billsTrend, setBillsTrend] = useState<'flat' | 'rising'>('flat');

  const rec = useMemo(() => rankRecommendation(equipment, age, repairCost, refrigerant, recentRepairs, billsTrend), [equipment, age, repairCost, refrigerant, recentRepairs, billsTrend]);
  const typical = REPLACE_TYPICAL[equipment];

  const verdictColor =
    rec.verdict === 'repair' ? 'border-brand-300 bg-brand-50 text-brand-900' :
    rec.verdict === 'replace_soon' ? 'border-amber-300 bg-amber-50 text-amber-900' :
    rec.verdict === 'replace_with_heat_pump' ? 'border-blue-300 bg-blue-50 text-blue-900' :
    'border-rose-300 bg-rose-50 text-rose-900';

  const verdictLabel =
    rec.verdict === 'repair' ? 'Repair it' :
    rec.verdict === 'replace_soon' ? 'Repair now, plan replacement' :
    rec.verdict === 'replace_with_heat_pump' ? 'Replace — consider heat pump' :
    'Replace';

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="label" htmlFor="eq">Equipment type</label>
          <select id="eq" className="input" value={equipment} onChange={e => setEquipment(e.target.value as Equipment)}>
            <option value="furnace">Gas furnace</option>
            <option value="central_ac">Central AC</option>
            <option value="boiler">Boiler (hydronic)</option>
            <option value="heat_pump">Heat pump</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="age">Equipment age (years)</label>
          <input id="age" className="input" type="number" min={0} max={50} value={age} onChange={e => setAge(Number(e.target.value) || 0)} />
        </div>

        <div>
          <label className="label" htmlFor="repair">Quoted repair cost ($)</label>
          <input id="repair" className="input" type="number" min={0} max={20000} step={50} value={repairCost} onChange={e => setRepairCost(Number(e.target.value) || 0)} />
          <p className="mt-1 text-[10px] text-ink-500">Include parts + labor.</p>
        </div>

        {equipment === 'central_ac' && (
          <div>
            <label className="label" htmlFor="refrig">Refrigerant type</label>
            <select id="refrig" className="input" value={refrigerant} onChange={e => setRefrigerant(e.target.value as Refrigerant)}>
              <option value="r410a">R-410A (current)</option>
              <option value="r22">R-22 / Freon (banned 2020)</option>
              <option value="r32_r454b">R-32 or R-454B (newest 2025+)</option>
            </select>
          </div>
        )}

        <div>
          <label className="label" htmlFor="recent">Repairs in past 24 months</label>
          <select id="recent" className="input" value={recentRepairs} onChange={e => setRecentRepairs(Number(e.target.value))}>
            <option value={0}>None</option>
            <option value={1}>1 repair</option>
            <option value={2}>2 repairs</option>
            <option value={3}>3+ repairs</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="trend">Energy bills trend</label>
          <select id="trend" className="input" value={billsTrend} onChange={e => setBillsTrend(e.target.value as 'flat' | 'rising')}>
            <option value="flat">Stable / consistent with usage</option>
            <option value="rising">Rising faster than rate increases</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className={`relative overflow-hidden rounded-xl border-2 p-5 shadow-card ${verdictColor}`}>
          <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Recommendation · Confidence: {rec.confidence}</p>
          <p className="mt-1 text-3xl font-semibold">{verdictLabel}</p>
          <p className="mt-2 text-base font-medium">{rec.primary}</p>
          <ul className="mt-4 space-y-2 text-sm">
            {rec.details.map(d => <li className="flex gap-2"><span aria-hidden="true">·</span><span>{d}</span></li>)}
          </ul>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">If you replace</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Like-for-like ({typical.label})</span><span className="tabular-nums">{fmtUSD(typical.mid)}</span></li>
              <li className="flex justify-between"><span>Heat-pump replacement (heat + AC)</span><span className="tabular-nums">{fmtUSD(HEAT_PUMP_ALT.mid)}</span></li>
              <li className="text-[11px] text-ink-500 mt-2">Heat pump replaces both heating and AC simultaneously. State rebates can subtract $1,000–$10,000.</li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">The 50% rule</h3>
            <p className="mt-2 text-sm text-ink-700">
              Standard HVAC industry guidance: if a repair on equipment 10+ years old exceeds 50% of replacement cost, replace it. Energy Star and ASHRAE both reference this rule of thumb in their consumer guidance.
            </p>
            <p className="mt-2 text-[11px] text-ink-500">
              Your case: repair {fmtUSD(repairCost)} / replacement {fmtUSD(typical.mid)} = {Math.round((repairCost / typical.mid) * 100)}%
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Why heat pump alternative comes up:</strong> if you’re replacing a furnace or AC at end of life, a heat pump replaces both at once. Same install crew, same ductwork, same install timeline. State rebates ($1,000–$10,000) help close the gap; the federal 25C credit ended 2025-12-31 but heat-pump-specific state programs remain robust.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Decision checklist</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Get a second opinion if the repair exceeds $500. HVAC techs vary wildly in diagnostic accuracy.</li>
            <li>· Ask for the part name and number — confirms the actual problem and lets you check warranty status.</li>
            <li>· Check manufacturer warranty before paying out of pocket. Major components (compressor, heat exchanger) often have 10-year coverage.</li>
            <li>· If replacing, run a Manual J load calc — never "match the old size."</li>
            <li>· Get 3 quotes for replacement. Same equipment varies 30%+ in installed price.</li>
            <li>· Off-season pricing (April-May, September-October) is 10-20% cheaper than peak season.</li>
            <li>· Check state heat-pump rebate amounts before committing to like-for-like replacement.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
