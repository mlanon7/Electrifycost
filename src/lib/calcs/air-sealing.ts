/*
 * Air-sealing calculator — pure compute. Extracted verbatim from
 * src/components/AirSealingCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor, findClimate } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Scope = 'diy' | 'pro_targeted' | 'deep' | 'ducts_only';
export type Tightness = 'leaky' | 'average' | 'tight';
export type IncludeDucts = 'yes' | 'no';

export interface AirSealingInputs {
  state: string;
  sqft: number;
  scope: Scope;
  tight: Tightness;
  includeDucts: IncludeDucts;
}

export const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: 'diy', label: 'DIY (caulk + weatherstrip basics)' },
  { value: 'pro_targeted', label: 'Professional targeted (recommended)' },
  { value: 'deep', label: 'Deep sealing + blower-door verify' },
  { value: 'ducts_only', label: 'Duct sealing only (aerosolized / mastic)' },
];

export const TIGHT_OPTIONS: { value: Tightness; label: string }[] = [
  { value: 'leaky', label: 'Leaky (drafty, pre-1980 home, no recent work)' },
  { value: 'average', label: 'Average (typical 1980-2010 construction)' },
  { value: 'tight', label: 'Tight (newer, recent sealing done)' },
];

export const DUCT_OPTIONS: { value: IncludeDucts; label: string }[] = [
  { value: 'no', label: 'No (envelope only)' },
  { value: 'yes', label: 'Yes (add duct sealing)' },
];

// Per CSV: air-sealing-cost-ranges.csv (BPI 2024 + Aeroseal)
function getSealingBand(scope: Scope, sqft: number): CostBand3 {
  if (scope === 'diy') return { low: 80, mid: 150, high: 300 };
  if (scope === 'ducts_only') return { low: 1200, mid: 1800, high: 2800 };
  if (scope === 'pro_targeted') {
    if (sqft < 1800) return { low: 500, mid: 800, high: 1300 };
    if (sqft < 3000) return { low: 800, mid: 1300, high: 2000 };
    return { low: 1300, mid: 2000, high: 3200 };
  }
  if (scope === 'deep') {
    if (sqft < 3000) return { low: 2000, mid: 3000, high: 4500 };
    return { low: 2800, mid: 4200, high: 6500 };
  }
  return { low: 0, mid: 0, high: 0 };
}

const DUCT_SEALING: CostBand3 = { low: 1200, mid: 1800, high: 2800 };

// HVAC savings % by scope
function hvacSavingsPct(scope: Scope, tight: Tightness): number {
  if (scope === 'diy') return 0.03;
  if (scope === 'ducts_only') return 0.10;
  if (scope === 'pro_targeted') return tight === 'leaky' ? 0.12 : tight === 'average' ? 0.08 : 0.04;
  if (scope === 'deep') return tight === 'leaky' ? 0.20 : tight === 'average' ? 0.14 : 0.07;
  return 0;
}

// Typical annual HVAC cost per sqft (rough from EIA RECS)
function annualHvacCostPerSqft(state: string): number {
  const zone = findClimate(state)?.iecc_zone ?? '4A';
  const head = zone[0];
  return head === '5' || head === '6' || head === '7' || head === '8' ? 1.20
    : head === '4' ? 1.00
    : head === '3' ? 0.85
    : 0.70;
}

function add(a: CostBand3, b: CostBand3): CostBand3 { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }
function scale(b: CostBand3, m: number): CostBand3 { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }

export interface AirSealingResult extends CalcComputeOutput {
  sealing: CostBand3;
  ducts: CostBand3;
  savingsPct: number;
  annualHvacCost: number;
  annualSavings: number;
  paybackYears: number | null;
}

export function compute(inputs: AirSealingInputs, opts?: ComputeOpts): AirSealingResult {
  const { state, sqft, scope, tight, includeDucts } = inputs;
  const laborMult = opts?.laborMult
    ?? (findStateLabor(state)?.electrician_multiplier ?? 1.0);
  const sealing = scale(getSealingBand(scope, sqft), laborMult);
  const ducts = includeDucts === 'yes' && scope !== 'ducts_only' ? scale(DUCT_SEALING, laborMult) : { low: 0, mid: 0, high: 0 };
  const gross = add(sealing, ducts);

  const savingsPct = hvacSavingsPct(scope, tight) + (includeDucts === 'yes' && scope !== 'ducts_only' ? 0.08 : 0);
  const annualHvacCost = annualHvacCostPerSqft(state) * sqft;
  const annualSavings = annualHvacCost * savingsPct;
  const paybackYears = annualSavings > 0 ? Math.round((gross.mid / annualSavings) * 10) / 10 : null;

  const attrs: [string, string][] = [
    ['Envelope tightness', TIGHT_OPTIONS.find(o => o.value === tight)?.label.replace(/\s*\(.*\)$/, '') ?? ''],
  ];
  if (includeDucts === 'yes' && scope !== 'ducts_only') attrs.push(['Duct sealing', 'Included']);

  return {
    gross, sealing, ducts, savingsPct, annualHvacCost, annualSavings, paybackYears,
    brk: {},   // flat whole-job band pricing — no honest materials/labor split
    scope: `${SCOPE_OPTIONS.find(o => o.value === scope)?.label.replace(/\s*\(.*\)$/, '') ?? scope} · ${sqft.toLocaleString('en-US')} sqft`,
    attrs,
  };
}

export const TIER_INPUTS: TierInputs<AirSealingInputs> = {
  small:   { state: 'US', sqft: 1200, scope: 'pro_targeted', tight: 'average', includeDucts: 'no' },
  typical: { state: 'US', sqft: 2000, scope: 'pro_targeted', tight: 'average', includeDucts: 'no' },
  large:   { state: 'US', sqft: 2400, scope: 'pro_targeted', tight: 'average', includeDucts: 'yes' },
};

export const TIER_LABELS: TierLabels = {
  small: 'targeted',
  typical: 'blower-door + seal',
  large: '+ duct sealing',
};

export const COST_MIX: CostMix = { material: 0.20, labor: 0.75, equipment: 0.05 };
