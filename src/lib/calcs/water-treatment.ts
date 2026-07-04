/*
 * Water treatment calculator — pure compute. Extracted verbatim from
 * src/components/WaterTreatmentCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type System = 'softener_basic' | 'softener_premium' | 'salt_free' | 'whole_house_carbon' | 'softener_carbon_combo' | 'ro_undersink' | 'ro_whole_house' | 'iron_filter';
export type Hardness = 'soft' | 'moderate' | 'hard' | 'very_hard';

export interface WaterTreatmentInputs {
  state: string;
  system: System;
  hardness: Hardness;
}

export const SYSTEM_OPTIONS: { value: System; label: string }[] = [
  { value: 'softener_basic', label: 'Basic salt softener' },
  { value: 'softener_premium', label: 'Premium softener (Kinetico/Culligan)' },
  { value: 'salt_free', label: 'Salt-free conditioner' },
  { value: 'whole_house_carbon', label: 'Whole-house carbon (chlorine + taste)' },
  { value: 'softener_carbon_combo', label: 'Combo softener + carbon (most common)' },
  { value: 'ro_undersink', label: 'RO undersink (drinking water only)' },
  { value: 'ro_whole_house', label: 'Whole-house RO' },
  { value: 'iron_filter', label: 'Iron + sulfur filter (well water)' },
];

export const HARDNESS_OPTIONS: { value: Hardness; label: string }[] = [
  { value: 'soft', label: 'Soft (<3 gpg / <50 ppm)' },
  { value: 'moderate', label: 'Moderate (3-7 gpg)' },
  { value: 'hard', label: 'Hard (7-15 gpg, typical Midwest)' },
  { value: 'very_hard', label: 'Very hard (15+ gpg, Southwest/Florida)' },
];

const SYS: Record<System, { equipment: CostBand3; install: CostBand3; saltLbYr: number; kwhYr: number; label: string }> = {
  softener_basic:        { equipment: { low: 400, mid: 650, high: 900 },   install: { low: 400, mid: 700, high: 1100 }, saltLbYr: 250, kwhYr: 40, label: 'Basic salt softener (Whirlpool, Morton)' },
  softener_premium:      { equipment: { low: 1500, mid: 2500, high: 3800 }, install: { low: 800, mid: 1400, high: 2200 }, saltLbYr: 200, kwhYr: 30, label: 'Premium softener (Kinetico, Culligan)' },
  salt_free:             { equipment: { low: 800, mid: 1400, high: 2200 }, install: { low: 300, mid: 600, high: 1100 }, saltLbYr: 0,   kwhYr: 0,  label: 'Salt-free conditioner (TAC/template)' },
  whole_house_carbon:    { equipment: { low: 500, mid: 900, high: 1500 },  install: { low: 300, mid: 600, high: 1100 }, saltLbYr: 0,   kwhYr: 0,  label: 'Whole-house carbon (chlorine + taste)' },
  softener_carbon_combo: { equipment: { low: 1200, mid: 2000, high: 3000 }, install: { low: 600, mid: 1100, high: 1800 }, saltLbYr: 250, kwhYr: 40, label: 'Combo softener + carbon (Pentair, Aquasana)' },
  ro_undersink:          { equipment: { low: 200, mid: 450, high: 800 },  install: { low: 150, mid: 350, high: 650 }, saltLbYr: 0,   kwhYr: 0,  label: 'Reverse osmosis (undersink kitchen)' },
  ro_whole_house:        { equipment: { low: 3500, mid: 5500, high: 8500 }, install: { low: 1500, mid: 2500, high: 4000 }, saltLbYr: 0,   kwhYr: 200, label: 'Whole-house RO + storage tank' },
  iron_filter:           { equipment: { low: 900, mid: 1500, high: 2500 }, install: { low: 500, mid: 900, high: 1500 }, saltLbYr: 0,   kwhYr: 30, label: 'Iron + sulfur filter (well water)' },
};

const SALT_PRICE_PER_LB = 0.18;
const ELEC_RATE = 0.16;

function scale(b: CostBand3, m: number): CostBand3 { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: CostBand3, b: CostBand3): CostBand3 { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export interface WaterTreatmentResult extends CalcComputeOutput {
  equipment: CostBand3;
  install: CostBand3;
  annualSaltCost: number;
  annualElec: number;
  annualOp: number;
  label: string;
}

export function compute(inputs: WaterTreatmentInputs, opts?: ComputeOpts): WaterTreatmentResult {
  const { state, system, hardness } = inputs;
  const laborMult = opts?.laborMult ?? (findStateLabor(state)?.plumber_multiplier ?? 1.0);
  const s = SYS[system];
  const install = scale(s.install, laborMult);
  const gross = add(s.equipment, install);

  // Adjust salt use by hardness (very hard doubles salt; soft halves)
  const hardnessMult = hardness === 'soft' ? 0.5 : hardness === 'moderate' ? 0.8 : hardness === 'hard' ? 1.0 : 1.5;
  const annualSaltCost = s.saltLbYr * hardnessMult * SALT_PRICE_PER_LB;
  const annualElec = s.kwhYr * ELEC_RATE;
  const annualOp = annualSaltCost + annualElec;

  return {
    equipment: s.equipment, install, gross, annualSaltCost, annualElec, annualOp, label: s.label,
    // Genuine category split: treatment hardware is a clean equipment/materials
    // line; the install band is plumber labor.
    brk: {
      m: [Math.round(s.equipment.low), Math.round(s.equipment.high)],
      l: [Math.round(install.low), Math.round(install.high)],
    },
    scope: s.label.replace(/\s*\(.*\)$/, ''),
    attrs: [
      ['System', SYSTEM_OPTIONS.find(o => o.value === system)?.label ?? ''],
      ['Water hardness', HARDNESS_OPTIONS.find(o => o.value === hardness)?.label ?? ''],
    ],
  };
}

export const TIER_INPUTS: TierInputs<WaterTreatmentInputs> = {
  small:   { state: 'US', system: 'softener_basic', hardness: 'hard' },
  typical: { state: 'US', system: 'softener_carbon_combo', hardness: 'hard' },
  large:   { state: 'US', system: 'ro_whole_house', hardness: 'hard' },
};

export const TIER_LABELS: TierLabels = {
  small: 'softener only',
  typical: 'softener + filtration',
  large: 'whole-home + RO',
};

export const COST_MIX: CostMix = { material: 0.55, labor: 0.42, equipment: 0.03 };
