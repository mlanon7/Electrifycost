/*
 * Pool heat pump calculator — pure compute. Extracted verbatim from
 * src/components/PoolHpCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor, stateEnergy } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Size = '85k' | '110k' | '125k' | '140k';
export type PoolGallons = '10k' | '15k' | '20k' | '30k' | '40k';
export type Climate = 'warm' | 'mild' | 'cool';
export type Circuit = 'yes' | 'no';

export interface PoolHeatPumpInputs {
  state: string;
  size: Size;
  climate: Climate;
  needsCircuit: Circuit;
}

export const SIZE_OPTIONS: { value: Size; label: string }[] = [
  { value: '85k', label: '85,000 BTU/hr (small pools, warm climate)' },
  { value: '110k', label: '110,000 BTU/hr (typical)' },
  { value: '125k', label: '125,000 BTU/hr (larger pools)' },
  { value: '140k', label: '140,000 BTU/hr (premium / spas)' },
];

// Pool gallons is context for the sizing guidance only — it does not enter the cost math.
export const GALLONS_OPTIONS: { value: PoolGallons; label: string }[] = [
  { value: '10k', label: '10,000 gal (small)' },
  { value: '15k', label: '15,000 gal' },
  { value: '20k', label: '20,000 gal (typical)' },
  { value: '30k', label: '30,000 gal (large)' },
  { value: '40k', label: '40,000 gal (very large)' },
];

export const CLIMATE_OPTIONS: { value: Climate; label: string }[] = [
  { value: 'warm', label: 'Warm (FL, TX coast, Gulf Coast)' },
  { value: 'mild', label: 'Mild (CA, NC, AZ)' },
  { value: 'cool', label: 'Cool (Northeast, Mid-Atlantic, Mountain — usable May-Oct only)' },
];

export const CIRCUIT_OPTIONS: { value: Circuit; label: string }[] = [
  { value: 'yes', label: 'Yes (most installs)' },
  { value: 'no', label: 'No (existing pool circuit usable)' },
];

const scale = (b: CostBand3, m: number): CostBand3 => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// 2026 equipment + install. Sources: Pentair UltraTemp, Hayward HeatPro, Raypak Crosswind, AquaCal HeatWave.
const EQUIPMENT: Record<Size, CostBand3> = {
  '85k':   { low: 2500, mid: 3200, high: 4000 },   // 85k BTU/hr — small pools
  '110k':  { low: 3000, mid: 3800, high: 4700 },   // 110k BTU/hr — mid pools
  '125k':  { low: 3500, mid: 4300, high: 5200 },   // 125k BTU/hr — large pools, cool climates
  '140k':  { low: 4000, mid: 4900, high: 6000 },   // 140k BTU/hr — premium / spas
};

const INSTALL: CostBand3 = { low: 800, mid: 1400, high: 2200 };  // pad + electrical + plumbing tie-in
const ELECTRICAL: CostBand3 = { low: 600, mid: 1100, high: 1800 }; // 240V/50A circuit from panel

// Operating cost approximate: 0.5-1.5 kWh per °F-day of heating, depending on pool size and ambient
// Simplified: assume 60-150 hours/month at rated kW input (~4-7 kW for 85-140k BTU/hr units; COP ~4-6)
function annualOpKwh(size: Size, climate: Climate): number {
  const baseKwh: Record<Size, number> = { '85k': 600, '110k': 800, '125k': 1000, '140k': 1200 };
  const climateMult: Record<Climate, number> = { warm: 0.7, mild: 1.0, cool: 1.5 };
  return baseKwh[size] * climateMult[climate];
}

export interface PoolHeatPumpResult extends CalcComputeOutput {
  equipment: CostBand3;
  install: CostBand3;
  electrical: CostBand3;
  annualKwh: number;
  annualOpCost: number;
}

export function compute(inputs: PoolHeatPumpInputs, opts?: ComputeOpts): PoolHeatPumpResult {
  const { state, size, climate, needsCircuit } = inputs;
  const lab = findStateLabor(state);
  const elecMult = opts?.laborMult ?? (lab?.electrician_multiplier ?? 1.0);
  const plumbMult = opts?.laborMult ?? (lab?.plumber_multiplier ?? 1.0);
  const equipment = EQUIPMENT[size];
  const install = scale(INSTALL, plumbMult);
  const electrical = needsCircuit === 'yes' ? scale(ELECTRICAL, elecMult) : { low: 0, mid: 0, high: 0 };
  const gross: CostBand3 = {
    low: equipment.low + install.low + electrical.low,
    mid: equipment.mid + install.mid + electrical.mid,
    high: equipment.high + install.high + electrical.high,
  };
  const annualKwh = annualOpKwh(size, climate);
  const eRow = stateEnergy.find(e => e.state === state);
  const rate = eRow ? eRow.electricity_cents_per_kwh / 100 : 0.16;
  const annualOpCost = annualKwh * rate;

  return {
    equipment, install, electrical, gross, annualKwh, annualOpCost,
    // The heat pump unit is a clean equipment/materials line (m); the pad +
    // plumbing tie-in and the 240V circuit are mixed whole-job installed lines
    // the calc cannot decompose → k (other), mirroring brkFromItemized's
    // "everything else" fold.
    brk: {
      m: [Math.round(equipment.low), Math.round(equipment.high)],
      k: [Math.round(install.low + electrical.low), Math.round(install.high + electrical.high)],
    },
    scope: `${SIZE_OPTIONS.find(o => o.value === size)?.label.replace(/\s*\(.*\)$/, '') ?? size} pool heat pump`,
    attrs: [
      ['Heat pump size', SIZE_OPTIONS.find(o => o.value === size)?.label ?? ''],
      ['Climate', CLIMATE_OPTIONS.find(o => o.value === climate)?.label ?? ''],
    ],
  };
}

export const TIER_INPUTS: TierInputs<PoolHeatPumpInputs> = {
  small:   { state: 'US', size: '85k', climate: 'warm', needsCircuit: 'no' },
  typical: { state: 'US', size: '110k', climate: 'warm', needsCircuit: 'yes' },
  large:   { state: 'US', size: '140k', climate: 'cool', needsCircuit: 'yes' },
};

export const TIER_LABELS: TierLabels = {
  small: 'small pool',
  typical: 'average pool',
  large: 'large pool + plumbing',
};

export const COST_MIX: CostMix = { material: 0.70, labor: 0.27, equipment: 0.03 };
