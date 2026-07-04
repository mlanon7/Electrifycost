/*
 * Boiler calculator — pure compute. Extracted verbatim from
 * src/components/BoilerCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Fuel = 'natural_gas' | 'propane' | 'heating_oil' | 'electric';
export type Tier = 'standard' | 'condensing' | 'modulating';
export type Size = 'small' | 'medium' | 'large';

export interface BoilerInputs {
  state: string;
  fuel: Fuel;
  tier: Tier;
  size: Size;
}

export const FUEL_OPTIONS: { value: Fuel; label: string }[] = [
  { value: 'natural_gas', label: 'Natural gas (most common)' },
  { value: 'heating_oil', label: 'Heating oil (NE / rural)' },
  { value: 'propane', label: 'Propane (rural)' },
  { value: 'electric', label: 'Electric resistance (rare)' },
];

export const TIER_OPTIONS: { value: Tier; label: string }[] = [
  { value: 'standard', label: 'Standard (cast-iron / older tech)' },
  { value: 'condensing', label: 'Condensing 95%+ AFUE' },
  { value: 'modulating', label: 'Modulating premium' },
];

export const SIZE_OPTIONS: { value: Size; label: string }[] = [
  { value: 'small', label: 'Small (≤1500 sqft) — 80-100k BTU' },
  { value: 'medium', label: 'Medium (1500-2500 sqft) — 100-140k BTU' },
  { value: 'large', label: 'Large (2500+ sqft) — 140-180k BTU' },
];

// Per CSV: boiler-cost-ranges.csv (Modernize 2024 + DOE 2024)
const BOILER: Record<Fuel, Record<Tier, { equipment: Record<Size, CostBand3>; labor: CostBand3; afue: number; label: string }>> = {
  natural_gas: {
    standard: {
      afue: 85, label: 'Cast-iron 85% AFUE',
      equipment: {
        small:  { low: 2200, mid: 3100, high: 4000 },
        medium: { low: 2500, mid: 3500, high: 4500 },
        large:  { low: 3200, mid: 4500, high: 5800 },
      },
      labor: { low: 2500, mid: 3500, high: 4500 },
    },
    condensing: {
      afue: 95, label: 'Condensing 95% AFUE',
      equipment: {
        small:  { low: 4000, mid: 5400, high: 7000 },
        medium: { low: 4500, mid: 6000, high: 8000 },
        large:  { low: 5400, mid: 7200, high: 9500 },
      },
      labor: { low: 3500, mid: 5000, high: 6500 },
    },
    modulating: {
      afue: 96, label: 'Modulating 96% AFUE (premium)',
      equipment: {
        small:  { low: 5500, mid: 7800, high: 10000 },
        medium: { low: 6000, mid: 8500, high: 11000 },
        large:  { low: 6800, mid: 9500, high: 12500 },
      },
      labor: { low: 4000, mid: 5500, high: 7500 },
    },
  },
  propane: {
    standard: {
      afue: 85, label: 'Propane 85% AFUE',
      equipment: {
        small:  { low: 2500, mid: 3500, high: 4500 },
        medium: { low: 2800, mid: 4000, high: 5200 },
        large:  { low: 3500, mid: 5000, high: 6500 },
      },
      labor: { low: 2700, mid: 3800, high: 5000 },
    },
    condensing: {
      afue: 95, label: 'Propane condensing 95% AFUE',
      equipment: {
        small:  { low: 4300, mid: 5800, high: 7500 },
        medium: { low: 4800, mid: 6500, high: 8500 },
        large:  { low: 5800, mid: 7800, high: 10000 },
      },
      labor: { low: 3500, mid: 5000, high: 6500 },
    },
    modulating: {
      afue: 96, label: 'Propane modulating premium',
      equipment: {
        small:  { low: 5800, mid: 8000, high: 10500 },
        medium: { low: 6500, mid: 9000, high: 11500 },
        large:  { low: 7200, mid: 10000, high: 13000 },
      },
      labor: { low: 4000, mid: 5500, high: 7500 },
    },
  },
  heating_oil: {
    standard: {
      afue: 85, label: 'Oil 85% AFUE',
      equipment: {
        small:  { low: 4000, mid: 5500, high: 7000 },
        medium: { low: 4500, mid: 6000, high: 7800 },
        large:  { low: 5500, mid: 7200, high: 9500 },
      },
      labor: { low: 3500, mid: 5000, high: 6500 },
    },
    condensing: {
      afue: 87, label: 'Premium oil 87% AFUE',
      equipment: {
        small:  { low: 5200, mid: 6800, high: 8800 },
        medium: { low: 5800, mid: 7500, high: 9800 },
        large:  { low: 6500, mid: 8500, high: 11000 },
      },
      labor: { low: 4000, mid: 5500, high: 7500 },
    },
    modulating: {
      afue: 87, label: 'Premium oil 87% AFUE (same as condensing)',
      equipment: {
        small:  { low: 5200, mid: 6800, high: 8800 },
        medium: { low: 5800, mid: 7500, high: 9800 },
        large:  { low: 6500, mid: 8500, high: 11000 },
      },
      labor: { low: 4000, mid: 5500, high: 7500 },
    },
  },
  electric: {
    standard: {
      afue: 100, label: 'Electric resistance',
      equipment: {
        small:  { low: 1800, mid: 2700, high: 3800 },
        medium: { low: 2200, mid: 3200, high: 4500 },
        large:  { low: 2800, mid: 4000, high: 5800 },
      },
      labor: { low: 1800, mid: 2800, high: 4000 },
    },
    condensing: {
      afue: 100, label: 'Electric resistance (same)',
      equipment: {
        small:  { low: 1800, mid: 2700, high: 3800 },
        medium: { low: 2200, mid: 3200, high: 4500 },
        large:  { low: 2800, mid: 4000, high: 5800 },
      },
      labor: { low: 1800, mid: 2800, high: 4000 },
    },
    modulating: {
      afue: 100, label: 'Electric resistance (same)',
      equipment: {
        small:  { low: 1800, mid: 2700, high: 3800 },
        medium: { low: 2200, mid: 3200, high: 4500 },
        large:  { low: 2800, mid: 4000, high: 5800 },
      },
      labor: { low: 1800, mid: 2800, high: 4000 },
    },
  },
};

function scale(b: CostBand3, m: number): CostBand3 {
  return { low: b.low * m, mid: b.mid * m, high: b.high * m };
}
function add(a: CostBand3, b: CostBand3): CostBand3 {
  return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high };
}

// Hydronic-compatible heat pump (air-to-water) replacement
const HEAT_PUMP_HYDRONIC: Record<Size, CostBand3> = {
  small:  { low: 14000, mid: 19000, high: 25000 },
  medium: { low: 17000, mid: 23000, high: 30000 },
  large:  { low: 22000, mid: 28000, high: 38000 },
};

export interface BoilerResult extends CalcComputeOutput {
  equipment: CostBand3;
  labor: CostBand3;
  permit: CostBand3;
  afue: number;
  label: string;
  hp: CostBand3;
}

export function compute(inputs: BoilerInputs, opts?: ComputeOpts): BoilerResult {
  const { state, fuel, tier, size } = inputs;
  const laborMult = opts?.laborMult ?? (findStateLabor(state)?.hvac_multiplier ?? 1.0);
  const cfg = BOILER[fuel][tier];
  const equipment = cfg.equipment[size];
  const labor = scale(cfg.labor, laborMult);
  const permit: CostBand3 = { low: 200, mid: 400, high: 800 };
  const gross = add(add(equipment, labor), permit);

  const hp = HEAT_PUMP_HYDRONIC[size];
  return {
    equipment, labor, permit, gross, afue: cfg.afue, label: cfg.label, hp,
    brk: {
      m: [Math.round(equipment.low), Math.round(equipment.high)],
      l: [Math.round(labor.low), Math.round(labor.high)],
      p: [Math.round(permit.low), Math.round(permit.high)],
    },
    scope: `${cfg.label} · ${SIZE_OPTIONS.find(o => o.value === size)?.label.replace(/\s*—.*$/, '') ?? size}`,
    attrs: [
      ['Fuel', FUEL_OPTIONS.find(o => o.value === fuel)?.label ?? ''],
      ['Efficiency tier', TIER_OPTIONS.find(o => o.value === tier)?.label ?? ''],
    ],
  };
}

export const TIER_INPUTS: TierInputs<BoilerInputs> = {
  small:   { state: 'US', fuel: 'natural_gas', tier: 'standard', size: 'small' },
  typical: { state: 'US', fuel: 'natural_gas', tier: 'condensing', size: 'medium' },
  large:   { state: 'US', fuel: 'natural_gas', tier: 'modulating', size: 'large' },
};

export const TIER_LABELS: TierLabels = {
  small: 'cast-iron swap',
  typical: 'condensing',
  large: 'combi + near-boiler piping',
};

export const COST_MIX: CostMix = { material: 0.50, labor: 0.46, equipment: 0.04 };
