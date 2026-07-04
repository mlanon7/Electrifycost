/*
 * Heat-pump dryer calculator — pure compute. Extracted verbatim from
 * src/components/HeatPumpDryerCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateEnergy } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Model = 'ventless_compact' | 'ventless_fullsize' | 'ventless_premium' | 'hybrid_vented' | 'combo';
export type Current = 'electric_vented' | 'gas_vented' | 'none';
export type Loads = 'light' | 'average' | 'heavy';

export interface HeatPumpDryerInputs {
  state: string;
  model: Model;
  current: Current;
  loads: Loads;
}

export const MODEL_OPTIONS: { value: Model; label: string }[] = [
  { value: 'ventless_compact', label: 'Compact ventless (4 cu ft)' },
  { value: 'ventless_fullsize', label: 'Full-size ventless (7.5 cu ft, most common)' },
  { value: 'ventless_premium', label: 'Premium ventless (Miele, Bosch 800)' },
  { value: 'hybrid_vented', label: 'Hybrid vented heat pump (Whirlpool)' },
  { value: 'combo', label: 'Washer-dryer combo (LG WashCombo)' },
];

export const CURRENT_OPTIONS: { value: Current; label: string }[] = [
  { value: 'electric_vented', label: 'Electric resistance (vented)' },
  { value: 'gas_vented', label: 'Gas (vented)' },
  { value: 'none', label: 'None / line-dry / coin laundry' },
];

export const LOADS_OPTIONS: { value: Loads; label: string }[] = [
  { value: 'light', label: 'Light (~3 loads/wk — 1-2 person household)' },
  { value: 'average', label: 'Average (~5 loads/wk — typical family)' },
  { value: 'heavy', label: 'Heavy (~8 loads/wk — large family, sports, kids)' },
];

const MODELS: Record<Model, { equipment: CostBand3; install: CostBand3; kwhPerLoad: number; label: string }> = {
  ventless_compact:  { equipment: { low: 900, mid: 1300, high: 1700 }, install: { low: 0, mid: 150, high: 400 }, kwhPerLoad: 1.0, label: 'Compact ventless (4.0 cu ft)' },
  ventless_fullsize: { equipment: { low: 1400, mid: 1900, high: 2700 }, install: { low: 0, mid: 150, high: 400 }, kwhPerLoad: 1.2, label: 'Full-size ventless (7.5 cu ft)' },
  ventless_premium:  { equipment: { low: 2200, mid: 2800, high: 3600 }, install: { low: 0, mid: 200, high: 500 }, kwhPerLoad: 1.1, label: 'Premium ventless (Miele/Bosch 800)' },
  hybrid_vented:     { equipment: { low: 1100, mid: 1500, high: 2100 }, install: { low: 200, mid: 400, high: 800 }, kwhPerLoad: 1.3, label: 'Hybrid vented heat pump' },
  combo:             { equipment: { low: 1800, mid: 2400, high: 3200 }, install: { low: 0, mid: 200, high: 500 }, kwhPerLoad: 0.9, label: 'Washer-dryer combo (LG/GE)' },
};

const LOADS_PER_WEEK: Record<Loads, number> = { light: 3, average: 5, heavy: 8 };

const CURRENT_PER_LOAD: Record<Current, { kwh: number; therms: number; cost: (e: number, g: number) => number; label: string }> = {
  electric_vented: { kwh: 3.3, therms: 0, cost: (e, g) => 3.3 * e, label: 'Electric resistance vented' },
  gas_vented:      { kwh: 0.15, therms: 0.22, cost: (e, g) => 0.15 * e + 0.22 * g, label: 'Gas vented' },
  none:            { kwh: 0, therms: 0, cost: () => 0, label: 'No current dryer (line-dry / coin laundry)' },
};

function scale(b: CostBand3, m: number): CostBand3 {
  return { low: b.low * m, mid: b.mid * m, high: b.high * m };
}
function add(a: CostBand3, b: CostBand3): CostBand3 {
  return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high };
}

export interface HeatPumpDryerResult extends CalcComputeOutput {
  equipment: CostBand3;
  install: CostBand3;
  newAnnualKwh: number;
  newAnnualCost: number;
  oldAnnualCost: number;
  annualSavings: number;
  paybackYears: number | null;
  loadsPerYear: number;
  label: string;
}

export function compute(inputs: HeatPumpDryerInputs, opts?: ComputeOpts): HeatPumpDryerResult {
  const { state, model, current, loads } = inputs;
  // Appliance pricing is national — no state labor component in the original
  // math (COST_MIX is 85% material). opts.laborMult is accepted for contract
  // parity but intentionally unused; only energy prices vary by state.
  void opts;
  const energy = findStateEnergy(state);
  const elec = (energy?.electricity_cents_per_kwh ?? 16) / 100;
  const gas = energy?.natural_gas_dollars_per_therm ?? 1.45;

  const m = MODELS[model];
  const gross = add(m.equipment, m.install);

  const loadsPerYear = LOADS_PER_WEEK[loads] * 52;
  const newAnnualKwh = m.kwhPerLoad * loadsPerYear;
  const newAnnualCost = newAnnualKwh * elec;

  const c = CURRENT_PER_LOAD[current];
  const oldAnnualCost = c.cost(elec, gas) * loadsPerYear;
  const annualSavings = Math.max(0, oldAnnualCost - newAnnualCost);
  const paybackYears = annualSavings > 0 ? Math.round((gross.mid / annualSavings) * 10) / 10 : null;

  // Genuine two-way split: the unit itself (m) vs delivery + setup labor (l).
  const brk: CalcComputeOutput['brk'] = {};
  if (m.equipment.high > 0) brk.m = [Math.round(m.equipment.low), Math.round(m.equipment.high)];
  if (m.install.high > 0) brk.l = [Math.round(m.install.low), Math.round(m.install.high)];

  return {
    gross, equipment: m.equipment, install: m.install, newAnnualKwh, newAnnualCost, oldAnnualCost, annualSavings, paybackYears, loadsPerYear, label: m.label,
    brk,
    scope: m.label,
    attrs: [['Current dryer', c.label]],
  };
}

export const TIER_INPUTS: TierInputs<HeatPumpDryerInputs> = {
  small:   { state: 'US', model: 'ventless_compact', current: 'electric_vented', loads: 'average' },
  typical: { state: 'US', model: 'ventless_fullsize', current: 'electric_vented', loads: 'average' },
  large:   { state: 'US', model: 'ventless_premium', current: 'electric_vented', loads: 'average' },
};

export const TIER_LABELS: TierLabels = {
  small: 'compact ventless',
  typical: 'full-size ventless',
  large: 'premium ventless',
};

export const COST_MIX: CostMix = { material: 0.85, labor: 0.13, equipment: 0.02 };
