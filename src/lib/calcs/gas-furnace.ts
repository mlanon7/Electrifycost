/*
 * Gas furnace calculator — pure compute. Extracted verbatim from
 * src/components/GasFurnaceCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Tier = 'basic_80' | 'mid_95' | 'premium_97' | 'condensing_98';
export type Size = 'small' | 'medium' | 'large';
export type Difficulty = 'easy' | 'average' | 'hard';

export interface GasFurnaceInputs {
  state: string;
  tier: Tier;
  size: Size;
  difficulty: Difficulty;
  annualHeatingCost: number;
}

export const TIER_OPTIONS: { value: Tier; label: string }[] = [
  { value: 'basic_80', label: '80% AFUE single-stage (southern US only)' },
  { value: 'mid_95', label: '95% AFUE single-stage (northern US minimum, most common)' },
  { value: 'premium_97', label: '97% AFUE two-stage / variable' },
  { value: 'condensing_98', label: '98% AFUE modulating top-tier' },
];

export const SIZE_OPTIONS: { value: Size; label: string }[] = [
  { value: 'small', label: 'Small (≤1500 sqft) — 60-80k BTU' },
  { value: 'medium', label: 'Medium (1500-2500 sqft) — 80-100k BTU' },
  { value: 'large', label: 'Large (2500+ sqft) — 100-140k BTU' },
];

export const DIFFICULTY_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Easy (same-spot swap, no venting changes)' },
  { value: 'average', label: 'Average (some duct/venting work)' },
  { value: 'hard', label: 'Hard (relocate, new venting, basement-to-attic conversion)' },
];

// Per CSV: gas-furnace-cost-ranges.csv
// Equipment + labor + permit costs sourced from Modernize 2024 and DOE 2024 furnace rule data.
export const TIERS: Record<Tier, { afue: number; equipment: Record<Size, CostBand3>; labor: CostBand3; label: string }> = {
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

function scale(b: CostBand3, m: number): CostBand3 {
  return { low: b.low * m, mid: b.mid * m, high: b.high * m };
}
function add(a: CostBand3, b: CostBand3): CostBand3 {
  return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high };
}

// Compare against heat pump replacement (rough industry mid for same home size)
const HEAT_PUMP_COMPARE: Record<Size, CostBand3> = {
  small:  { low: 7000,  mid: 11000, high: 15000 },
  medium: { low: 9000,  mid: 13500, high: 19000 },
  large:  { low: 12000, mid: 17000, high: 24000 },
};

export interface GasFurnaceResult extends CalcComputeOutput {
  equipment: CostBand3;
  labor: CostBand3;
  permit: CostBand3;
  annualSavings: number;
  hp: CostBand3;
  hpDelta: number;
  afue: number;
}

export function compute(inputs: GasFurnaceInputs, opts?: ComputeOpts): GasFurnaceResult {
  const { state, tier, size, difficulty, annualHeatingCost } = inputs;
  const laborMult = opts?.laborMult
    ?? (findStateLabor(state)?.hvac_multiplier ?? 1.0);
  const t = TIERS[tier];

  const equipment = t.equipment[size];
  const labor = scale(t.labor, laborMult * DIFFICULTY_MULT[difficulty]);
  const permit: CostBand3 = { low: 150, mid: 300, high: 650 };
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

  return {
    equipment, labor, permit, gross, annualSavings, hp, hpDelta, afue: newAFUE,
    brk: {   // honest equipment / labor / permit line items (Equipment → m per snapshot contract)
      m: [Math.round(equipment.low), Math.round(equipment.high)],
      l: [Math.round(labor.low), Math.round(labor.high)],
      p: [Math.round(permit.low), Math.round(permit.high)],
    },
    scope: `${t.label.replace(/\s*\(.*\)$/, '')} · ${(SIZE_OPTIONS.find(o => o.value === size)?.label ?? size).replace(/\s*\(.*$/, '')} home`,
    attrs: [
      ['Efficiency tier', TIER_OPTIONS.find(o => o.value === tier)?.label ?? ''],
      ['Home size', SIZE_OPTIONS.find(o => o.value === size)?.label ?? ''],
    ],
  };
}

export const TIER_INPUTS: TierInputs<GasFurnaceInputs> = {
  small:   { state: 'US', tier: 'basic_80', size: 'medium', difficulty: 'easy', annualHeatingCost: 1400 },
  typical: { state: 'US', tier: 'mid_95', size: 'medium', difficulty: 'average', annualHeatingCost: 1400 },
  large:   { state: 'US', tier: 'condensing_98', size: 'medium', difficulty: 'average', annualHeatingCost: 1400 },
};

export const TIER_LABELS: TierLabels = {
  small: '80% AFUE swap',
  typical: '96% AFUE',
  large: 'modulating + ductwork',
};

export const COST_MIX: CostMix = { material: 0.55, labor: 0.42, equipment: 0.03 };
