/*
 * Wood / pellet stove calculator — pure compute. Extracted verbatim from
 * src/components/WoodStoveCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Stove = 'wood_small' | 'wood_medium' | 'wood_large_catalytic' | 'pellet_small' | 'pellet_medium' | 'pellet_large' | 'pellet_insert' | 'masonry';

export interface WoodPelletStoveInputs {
  state: string;
  stove: Stove;
}

// Stove select choices grouped exactly as the calculator's <optgroup> UI renders them.
export const STOVE_GROUPS: { label: string; options: { value: Stove; label: string }[] }[] = [
  {
    label: 'Wood',
    options: [
      { value: 'wood_small', label: 'Small wood stove (1500 sqft)' },
      { value: 'wood_medium', label: 'Medium wood stove (2000 sqft)' },
      { value: 'wood_large_catalytic', label: 'Large catalytic wood stove (2500+ sqft)' },
    ],
  },
  {
    label: 'Pellet',
    options: [
      { value: 'pellet_small', label: 'Small pellet stove (1500 sqft)' },
      { value: 'pellet_medium', label: 'Medium pellet stove (2000 sqft)' },
      { value: 'pellet_large', label: 'Large pellet stove (2500+ sqft)' },
      { value: 'pellet_insert', label: 'Pellet insert (fireplace retrofit)' },
    ],
  },
  {
    label: 'Premium',
    options: [
      { value: 'masonry', label: 'Russian / masonry heater' },
    ],
  },
];

// Flat view of the grouped choices — for hash-restore validation + attrs labels.
export const STOVE_OPTIONS: { value: Stove; label: string }[] = STOVE_GROUPS.flatMap(g => g.options);

const STOVES: Record<Stove, { equipment: CostBand3; install: CostBand3; fuel: CostBand3; label: string }> = {
  wood_small:           { equipment: { low: 1400, mid: 2200, high: 3200 }, install: { low: 1500, mid: 2500, high: 4500 }, fuel: { low: 400, mid: 600, high: 900 }, label: 'Small wood stove (1500 sqft)' },
  wood_medium:          { equipment: { low: 1800, mid: 2800, high: 4000 }, install: { low: 1600, mid: 2700, high: 4800 }, fuel: { low: 500, mid: 800, high: 1200 }, label: 'Medium wood stove (2000 sqft)' },
  wood_large_catalytic: { equipment: { low: 2800, mid: 4200, high: 6000 }, install: { low: 1800, mid: 3000, high: 5200 }, fuel: { low: 700, mid: 1100, high: 1600 }, label: 'Large catalytic wood stove' },
  pellet_small:         { equipment: { low: 1800, mid: 2600, high: 3800 }, install: { low: 1200, mid: 2000, high: 3500 }, fuel: { low: 500, mid: 750, high: 1100 }, label: 'Small pellet stove (1500 sqft)' },
  pellet_medium:        { equipment: { low: 2200, mid: 3200, high: 4500 }, install: { low: 1300, mid: 2200, high: 3800 }, fuel: { low: 650, mid: 1000, high: 1500 }, label: 'Medium pellet stove (2000 sqft)' },
  pellet_large:         { equipment: { low: 2800, mid: 4000, high: 5500 }, install: { low: 1400, mid: 2400, high: 4200 }, fuel: { low: 800, mid: 1200, high: 1800 }, label: 'Large pellet stove' },
  pellet_insert:        { equipment: { low: 2500, mid: 3500, high: 5000 }, install: { low: 1500, mid: 2500, high: 4000 }, fuel: { low: 600, mid: 900, high: 1300 }, label: 'Pellet insert (fireplace retrofit)' },
  masonry:              { equipment: { low: 8000, mid: 15000, high: 28000 }, install: { low: 5000, mid: 10000, high: 18000 }, fuel: { low: 400, mid: 600, high: 900 }, label: 'Russian/masonry heater (premium)' },
};

function scale(b: CostBand3, m: number): CostBand3 { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: CostBand3, b: CostBand3): CostBand3 { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export interface WoodPelletStoveResult extends CalcComputeOutput {
  equipment: CostBand3;
  install: CostBand3;
  fuel: CostBand3;
  label: string;
}

export function compute(inputs: WoodPelletStoveInputs, opts?: ComputeOpts): WoodPelletStoveResult {
  const { state, stove } = inputs;
  const laborMult = opts?.laborMult
    ?? (findStateLabor(state)?.hvac_multiplier ?? 1.0);
  const s = STOVES[stove];
  const install = scale(s.install, laborMult);
  const gross = add(s.equipment, install);

  // Genuine partial split: the stove itself is a clean equipment line (m); the
  // install line bundles Class A chimney / flue materials + labor the calc
  // cannot decompose → k (other), mirroring generator.ts's fold.
  const brk: CalcComputeOutput['brk'] = {};
  if (s.equipment.high > 0) brk.m = [Math.round(s.equipment.low), Math.round(s.equipment.high)];
  if (install.high > 0) brk.k = [Math.round(install.low), Math.round(install.high)];

  return {
    equipment: s.equipment, install, gross, fuel: s.fuel, label: s.label,
    brk,
    scope: (STOVE_OPTIONS.find(o => o.value === stove)?.label ?? stove).replace(/\s*\(.*\)$/, ''),
    attrs: [['Stove type', STOVE_OPTIONS.find(o => o.value === stove)?.label ?? '']],
  };
}

export const TIER_INPUTS: TierInputs<WoodPelletStoveInputs> = {
  small:   { state: 'US', stove: 'pellet_small' },
  typical: { state: 'US', stove: 'wood_medium' },
  large:   { state: 'US', stove: 'wood_large_catalytic' },
};

export const TIER_LABELS: TierLabels = {
  small: 'pellet stove',
  typical: 'wood stove + flue',
  large: 'large catalytic wood stove',
};

export const COST_MIX: CostMix = { material: 0.60, labor: 0.37, equipment: 0.03 };
