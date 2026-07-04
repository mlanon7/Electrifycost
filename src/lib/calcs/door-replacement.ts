/*
 * Door replacement calculator — pure compute. Extracted verbatim from
 * src/components/DoorReplacementCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type DoorType = 'front_steel' | 'front_fiberglass_mid' | 'front_fiberglass_premium' | 'front_wood' | 'sliding_vinyl' | 'sliding_fiberglass' | 'sliding_wood' | 'french' | 'garage_steel_single' | 'garage_steel_double' | 'garage_premium';

export interface DoorReplacementInputs {
  state: string;
  door: DoorType;
}

const DOORS: Record<DoorType, { equipment: CostBand3; install: CostBand3; label: string }> = {
  front_steel:              { equipment: { low: 200, mid: 400, high: 650 },   install: { low: 300, mid: 500, high: 800 },   label: 'Front — steel basic' },
  front_fiberglass_mid:     { equipment: { low: 500, mid: 850, high: 1300 },  install: { low: 300, mid: 600, high: 1000 },  label: 'Front — fiberglass mid (most popular)' },
  front_fiberglass_premium: { equipment: { low: 1100, mid: 1700, high: 2400 }, install: { low: 400, mid: 700, high: 1200 },  label: 'Front — fiberglass premium' },
  front_wood:               { equipment: { low: 1500, mid: 2400, high: 3800 }, install: { low: 500, mid: 900, high: 1500 },  label: 'Front — solid wood' },
  sliding_vinyl:            { equipment: { low: 800, mid: 1200, high: 1800 }, install: { low: 400, mid: 700, high: 1100 },  label: 'Sliding patio — vinyl basic' },
  sliding_fiberglass:       { equipment: { low: 2000, mid: 3200, high: 4800 }, install: { low: 600, mid: 1100, high: 1800 }, label: 'Sliding patio — fiberglass premium' },
  sliding_wood:             { equipment: { low: 3500, mid: 5500, high: 8500 }, install: { low: 800, mid: 1400, high: 2200 }, label: 'Sliding patio — wood premium' },
  french:                   { equipment: { low: 1800, mid: 2800, high: 4500 }, install: { low: 700, mid: 1300, high: 2200 }, label: 'French double door' },
  garage_steel_single:      { equipment: { low: 500, mid: 850, high: 1300 },  install: { low: 300, mid: 500, high: 900 },   label: 'Garage — steel single 8x7' },
  garage_steel_double:      { equipment: { low: 900, mid: 1500, high: 2400 }, install: { low: 400, mid: 700, high: 1200 },  label: 'Garage — steel double 16x7' },
  garage_premium:           { equipment: { low: 2500, mid: 4500, high: 8500 }, install: { low: 500, mid: 1000, high: 1800 }, label: 'Garage — premium double (carriage/wood/glass)' },
};

// Door-type select choices, grouped exactly as the component's <optgroup> UI renders them.
export const DOOR_GROUPS: { label: string; options: { value: DoorType; label: string }[] }[] = [
  {
    label: 'Front entry',
    options: [
      { value: 'front_steel', label: 'Steel basic' },
      { value: 'front_fiberglass_mid', label: 'Fiberglass mid (most popular)' },
      { value: 'front_fiberglass_premium', label: 'Fiberglass premium' },
      { value: 'front_wood', label: 'Solid wood' },
    ],
  },
  {
    label: 'Patio',
    options: [
      { value: 'sliding_vinyl', label: 'Sliding vinyl basic' },
      { value: 'sliding_fiberglass', label: 'Sliding fiberglass premium' },
      { value: 'sliding_wood', label: 'Sliding wood premium' },
      { value: 'french', label: 'French double door' },
    ],
  },
  {
    label: 'Garage',
    options: [
      { value: 'garage_steel_single', label: 'Steel single 8×7' },
      { value: 'garage_steel_double', label: 'Steel double 16×7' },
      { value: 'garage_premium', label: 'Premium (carriage / wood / glass)' },
    ],
  },
];

function scale(b: CostBand3, m: number): CostBand3 { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: CostBand3, b: CostBand3): CostBand3 { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export interface DoorReplacementResult extends CalcComputeOutput {
  equipment: CostBand3;
  install: CostBand3;
  label: string;
}

export function compute(inputs: DoorReplacementInputs, opts?: ComputeOpts): DoorReplacementResult {
  const { state, door } = inputs;
  const laborMult = opts?.laborMult
    ?? (findStateLabor(state)?.electrician_multiplier ?? 1.0);
  const d = DOORS[door];
  const install = scale(d.install, laborMult);
  const gross = add(d.equipment, install);
  return {
    equipment: d.equipment, install, gross, label: d.label,
    // The DOORS table genuinely prices the door unit (m) and installation labor (l) separately.
    brk: {
      m: [Math.round(d.equipment.low), Math.round(d.equipment.high)],
      l: [Math.round(install.low), Math.round(install.high)],
    },
    scope: d.label.replace(/\s*\(.*\)$/, ''),
    attrs: [['Door type', d.label]],
  };
}

export const TIER_INPUTS: TierInputs<DoorReplacementInputs> = {
  small:   { state: 'US', door: 'front_steel' },
  typical: { state: 'US', door: 'front_fiberglass_premium' },
  large:   { state: 'US', door: 'sliding_wood' },
};

export const TIER_LABELS: TierLabels = {
  small: 'one door',
  typical: 'entry + storm',
  large: 'multiple / custom',
};

export const COST_MIX: CostMix = { material: 0.60, labor: 0.37, equipment: 0.03 };
