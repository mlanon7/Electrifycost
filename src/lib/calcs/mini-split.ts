/*
 * Mini-split calculator — pure compute. Extracted verbatim from
 * src/components/MiniSplitCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Brand = 'mitsubishi' | 'daikin' | 'fujitsu' | 'lg' | 'pioneer';
export type Zones = '1' | '2' | '3' | '4' | '5';
export type Spec = 'standard' | 'hyperheat';
export type Circuit = 'yes' | 'no';

export interface MiniSplitInputs {
  state: string;
  zones: Zones;
  brand: Brand;
  spec: Spec;
  needsCircuit: Circuit;
}

export const ZONE_OPTIONS: { value: Zones; label: string }[] = [
  { value: '1', label: '1 zone (single room or open floor)' },
  { value: '2', label: '2 zones' },
  { value: '3', label: '3 zones' },
  { value: '4', label: '4 zones' },
  { value: '5', label: '5 zones (max for most outdoor units)' },
];

export const BRAND_OPTIONS: { value: Brand; label: string }[] = [
  { value: 'mitsubishi', label: 'Mitsubishi (Hyper-Heat — premium)' },
  { value: 'daikin', label: 'Daikin (Aurora — premium)' },
  { value: 'fujitsu', label: 'Fujitsu (Halcyon — value/mid)' },
  { value: 'lg', label: 'LG (mid)' },
  { value: 'pioneer', label: 'Pioneer (budget / DIY-adjacent)' },
];

export const SPEC_OPTIONS: { value: Spec; label: string }[] = [
  { value: 'hyperheat', label: 'Yes — cold-climate (rated to -13°F or lower)' },
  { value: 'standard', label: 'No — standard (drops capacity below 17°F)' },
];

export const CIRCUIT_OPTIONS: { value: Circuit; label: string }[] = [
  { value: 'yes', label: 'Yes (standard for new install)' },
  { value: 'no', label: 'No (existing circuit available)' },
];

const add = (a: CostBand3, b: CostBand3): CostBand3 => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand3, m: number): CostBand3 => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// 2026 installed cost per indoor head (zone), all-in including outdoor unit allocation,
// line-set, condensate pump, electrical. Sources: NEEP cold-climate database, Energy Vanguard
// 2024 mini-split survey, Mitsubishi/Daikin/Fujitsu MSRP plus typical contractor markup.
const PER_HEAD: Record<Brand, Record<Spec, CostBand3>> = {
  mitsubishi: {
    standard:  { low: 3800, mid: 4800, high: 6000 },
    hyperheat: { low: 4500, mid: 5500, high: 7000 },   // Hyper-Heat H2i (cold-climate)
  },
  daikin: {
    standard:  { low: 3500, mid: 4400, high: 5500 },
    hyperheat: { low: 4200, mid: 5100, high: 6500 },   // Aurora
  },
  fujitsu: {
    standard:  { low: 3300, mid: 4200, high: 5200 },
    hyperheat: { low: 4000, mid: 4900, high: 6200 },   // Halcyon XLTH
  },
  lg: {
    standard:  { low: 3000, mid: 3900, high: 4800 },
    hyperheat: { low: 3700, mid: 4600, high: 5800 },
  },
  pioneer: {                                            // Budget brand — DIY-adjacent
    standard:  { low: 2000, mid: 2800, high: 3700 },
    hyperheat: { low: 2700, mid: 3500, high: 4600 },
  },
};

// Multi-zone economies: each additional head shares an outdoor unit so marginal cost drops.
const MULTI_ZONE_DISCOUNT: Record<Zones, number> = {
  '1': 1.0,
  '2': 0.92,
  '3': 0.88,
  '4': 0.85,
  '5': 0.83,
};

const ELECTRICAL_ADDER: CostBand3 = { low: 400, mid: 800, high: 1500 };  // 240V circuit + disconnect
const PERMIT: CostBand3 = { low: 200, mid: 400, high: 700 };

export interface MiniSplitResult extends CalcComputeOutput {
  equip: CostBand3;
  elec: CostBand3;
  permit: CostBand3;
}

export function compute(inputs: MiniSplitInputs, opts?: ComputeOpts): MiniSplitResult {
  const { state, zones, brand, spec, needsCircuit } = inputs;
  const hvacMult = opts?.laborMult ?? (findStateLabor(state)?.hvac_multiplier ?? 1.0);
  const perHead = PER_HEAD[brand][spec];
  const numZones = parseInt(zones, 10);
  const discount = MULTI_ZONE_DISCOUNT[zones];
  const equipPerHeadAdj: CostBand3 = scale(perHead, discount);
  const equip: CostBand3 = scale(equipPerHeadAdj, numZones * hvacMult);
  const elec = needsCircuit === 'yes' ? scale(ELECTRICAL_ADDER, hvacMult) : { low: 0, mid: 0, high: 0 };
  const permit = scale(PERMIT, hvacMult);
  const gross = add(add(equip, elec), permit);

  return {
    equip, elec, permit, gross,
    brk: {},   // per-head pricing bundles equipment + install labor — no honest category split
    scope: `${numZones} zone${numZones === 1 ? '' : 's'} · ${spec === 'hyperheat' ? 'cold-climate' : 'standard'} spec`,
    attrs: [['Brand', BRAND_OPTIONS.find(o => o.value === brand)?.label ?? '']],
  };
}

export const TIER_INPUTS: TierInputs<MiniSplitInputs> = {
  small:   { state: 'US', zones: '1', brand: 'mitsubishi', spec: 'hyperheat', needsCircuit: 'yes' },
  typical: { state: 'US', zones: '3', brand: 'mitsubishi', spec: 'hyperheat', needsCircuit: 'yes' },
  large:   { state: 'US', zones: '4', brand: 'mitsubishi', spec: 'hyperheat', needsCircuit: 'yes' },
};

export const TIER_LABELS: TierLabels = {
  small: 'single zone',
  typical: 'three zone',
  large: 'whole-home multi-zone',
};

export const COST_MIX: CostMix = { material: 0.55, labor: 0.42, equipment: 0.03 };
