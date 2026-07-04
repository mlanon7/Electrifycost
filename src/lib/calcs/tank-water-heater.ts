/*
 * Tank water heater calculator — pure compute. Extracted verbatim from
 * src/components/TankWaterHeaterCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor, findStateEnergy } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Fuel = 'natural_gas' | 'electric' | 'propane';
export type Tier = 'standard' | 'powervent' | 'condensing';
export type Size = 40 | 50 | 80;

export interface TankWaterHeaterInputs {
  state: string;
  fuel: Fuel;
  tier: Tier;
  size: Size;
}

export const FUEL_OPTIONS: { value: Fuel; label: string }[] = [
  { value: 'natural_gas', label: 'Natural gas (most common)' },
  { value: 'electric', label: 'Electric resistance' },
  { value: 'propane', label: 'Propane (rural)' },
];

export const TIER_OPTIONS: { value: Tier; label: string; gasOnly?: boolean }[] = [
  { value: 'standard', label: 'Standard atmospheric vent (gas/LP) or resistance (electric)' },
  { value: 'powervent', label: 'Power-vent (gas/LP only)', gasOnly: true },
  { value: 'condensing', label: 'Condensing 95%+ (gas/LP only)', gasOnly: true },
];

export const SIZE_OPTIONS: { value: Size; label: string }[] = [
  { value: 40, label: '40 gal (1-3 people)' },
  { value: 50, label: '50 gal (3-5 people, most common)' },
  { value: 80, label: '80 gal (large family or solar self-consumption)' },
];

// From tank-water-heater-cost-ranges.csv. 2026 mid-quote dollars.
const CFG: Record<Fuel, Record<Tier, { equipment: Record<Size, CostBand3>; install: CostBand3; uef: number; annualKwh: number; annualTherms: number; label: string }>> = {
  natural_gas: {
    standard: {
      equipment: {
        40: { low: 600, mid: 850, high: 1200 },
        50: { low: 700, mid: 1000, high: 1400 },
        80: { low: 1100, mid: 1500, high: 2000 },
      },
      install: { low: 500, mid: 800, high: 1300 },
      uef: 0.62, annualKwh: 0, annualTherms: 220, label: 'Atmospheric-vent 0.62 UEF',
    },
    powervent: {
      equipment: {
        40: { low: 900, mid: 1300, high: 1700 },
        50: { low: 1100, mid: 1500, high: 2000 },
        80: { low: 1500, mid: 2100, high: 2700 },
      },
      install: { low: 700, mid: 1100, high: 1600 },
      uef: 0.68, annualKwh: 0, annualTherms: 200, label: 'Power-vent 0.68 UEF',
    },
    condensing: {
      equipment: {
        40: { low: 1400, mid: 1900, high: 2500 },
        50: { low: 1700, mid: 2200, high: 2900 },
        80: { low: 2200, mid: 2800, high: 3700 },
      },
      install: { low: 800, mid: 1200, high: 1800 },
      uef: 0.86, annualKwh: 0, annualTherms: 158, label: 'Condensing 0.86 UEF',
    },
  },
  electric: {
    standard: {
      equipment: {
        40: { low: 400, mid: 650, high: 950 },
        50: { low: 500, mid: 750, high: 1100 },
        80: { low: 750, mid: 1100, high: 1500 },
      },
      install: { low: 400, mid: 700, high: 1100 },
      uef: 0.91, annualKwh: 4880, annualTherms: 0, label: 'Resistance 0.91 UEF',
    },
    powervent: {
      equipment: {
        40: { low: 400, mid: 650, high: 950 },
        50: { low: 500, mid: 750, high: 1100 },
        80: { low: 750, mid: 1100, high: 1500 },
      },
      install: { low: 400, mid: 700, high: 1100 },
      uef: 0.91, annualKwh: 4880, annualTherms: 0, label: 'Resistance (no power-vent variant)',
    },
    condensing: {
      equipment: {
        40: { low: 400, mid: 650, high: 950 },
        50: { low: 500, mid: 750, high: 1100 },
        80: { low: 750, mid: 1100, high: 1500 },
      },
      install: { low: 400, mid: 700, high: 1100 },
      uef: 0.91, annualKwh: 4880, annualTherms: 0, label: 'Resistance (no condensing variant)',
    },
  },
  propane: {
    standard: {
      equipment: {
        40: { low: 650, mid: 900, high: 1300 },
        50: { low: 800, mid: 1100, high: 1500 },
        80: { low: 1200, mid: 1700, high: 2300 },
      },
      install: { low: 500, mid: 800, high: 1300 },
      uef: 0.62, annualKwh: 0, annualTherms: 220, label: 'Atmospheric LP 0.62 UEF',
    },
    powervent: {
      equipment: {
        40: { low: 1000, mid: 1400, high: 1800 },
        50: { low: 1200, mid: 1600, high: 2100 },
        80: { low: 1600, mid: 2200, high: 2900 },
      },
      install: { low: 700, mid: 1100, high: 1600 },
      uef: 0.68, annualKwh: 0, annualTherms: 200, label: 'LP power-vent 0.68 UEF',
    },
    condensing: {
      equipment: {
        40: { low: 1500, mid: 2000, high: 2700 },
        50: { low: 1800, mid: 2400, high: 3100 },
        80: { low: 2300, mid: 3000, high: 3900 },
      },
      install: { low: 800, mid: 1200, high: 1800 },
      uef: 0.86, annualKwh: 0, annualTherms: 158, label: 'LP condensing 0.86 UEF',
    },
  },
};

// HPWH baseline (for head-to-head)
const HPWH_BASELINE = { low: 2300, mid: 3100, high: 4200, annualKwh: 1380 };
// Tankless gas baseline
export const TANKLESS_GAS_BASELINE = { low: 2800, mid: 4300, high: 6500, annualTherms: 180 };

function scale(b: CostBand3, m: number): CostBand3 { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: CostBand3, b: CostBand3): CostBand3 { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export interface TankWaterHeaterResult extends CalcComputeOutput {
  equipment: CostBand3;
  install: CostBand3;
  permit: CostBand3;
  annualEnergyCost: number;
  hpwhGross: CostBand3;
  hpwhAnnualCost: number;
  hpwhSavingsPerYear: number;
  label: string;
  uef: number;
}

export function compute(inputs: TankWaterHeaterInputs, opts?: ComputeOpts): TankWaterHeaterResult {
  const { state, fuel, tier, size } = inputs;
  const laborMult = opts?.laborMult ?? (findStateLabor(state)?.plumber_multiplier ?? 1.0);
  const cfg = CFG[fuel][tier];
  const equipment = cfg.equipment[size];
  const install = scale(cfg.install, laborMult);
  const permit: CostBand3 = { low: 75, mid: 150, high: 300 };
  const gross = add(add(equipment, install), permit);

  const energy = findStateEnergy(state);
  const elec = (energy?.electricity_cents_per_kwh ?? 16) / 100;
  const gas = energy?.natural_gas_dollars_per_therm ?? 1.45;
  const propane = energy?.propane_dollars_per_gallon ?? 2.85;

  const annualEnergyCost =
    fuel === 'natural_gas' ? cfg.annualTherms * gas
    : fuel === 'propane'    ? (cfg.annualTherms * 100000 / 91500) * propane // 91500 BTU/gal
    : cfg.annualKwh * elec;

  // Comparison vs HPWH (electric homes) or vs HPWH-from-gas (gas homes)
  const hpwhAnnualCost = HPWH_BASELINE.annualKwh * elec;
  const hpwhInstallMult = 1.0;
  const hpwhGross: CostBand3 = scale({ low: HPWH_BASELINE.low, mid: HPWH_BASELINE.mid, high: HPWH_BASELINE.high }, hpwhInstallMult);
  const hpwhSavingsPerYear = annualEnergyCost - hpwhAnnualCost;

  return {
    equipment, install, permit, gross, annualEnergyCost, hpwhGross, hpwhAnnualCost, hpwhSavingsPerYear, label: cfg.label, uef: cfg.uef,
    // Genuine category split: the tank is a clean equipment/materials line,
    // the install band is plumber labor, and permit & inspection is its own line.
    brk: {
      m: [Math.round(equipment.low), Math.round(equipment.high)],
      l: [Math.round(install.low), Math.round(install.high)],
      p: [Math.round(permit.low), Math.round(permit.high)],
    },
    scope: `${cfg.label} · ${size}-gal tank`,
    attrs: [
      ['Fuel', FUEL_OPTIONS.find(o => o.value === fuel)?.label ?? ''],
      ['Tank size', SIZE_OPTIONS.find(o => o.value === size)?.label ?? ''],
    ],
  };
}

export const TIER_INPUTS: TierInputs<TankWaterHeaterInputs> = {
  small:   { state: 'US', fuel: 'electric', tier: 'standard', size: 50 },
  typical: { state: 'US', fuel: 'natural_gas', tier: 'standard', size: 50 },
  large:   { state: 'US', fuel: 'natural_gas', tier: 'condensing', size: 50 },
};

export const TIER_LABELS: TierLabels = {
  small: 'electric swap',
  typical: 'standard 50-gal',
  large: 'premium / relocation',
};

export const COST_MIX: CostMix = { material: 0.55, labor: 0.42, equipment: 0.03 };
