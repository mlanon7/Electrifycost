/*
 * Hot tub heat pump calculator — pure compute. Extracted verbatim from
 * src/components/HotTubHeatPumpCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor, findStateEnergy } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Heater = 'hp_small' | 'hp_med' | 'hp_large' | 'electric' | 'gas';

export interface HotTubHeatPumpInputs {
  state: string;
  heater: Heater;
}

export const HEATER_OPTIONS: { value: Heater; label: string }[] = [
  { value: 'hp_small', label: 'Heat pump 300 gal tub' },
  { value: 'hp_med', label: 'Heat pump 450 gal tub (most common)' },
  { value: 'hp_large', label: 'Heat pump 600+ gal / swim spa' },
  { value: 'electric', label: 'Electric resistance (built-in baseline)' },
  { value: 'gas', label: 'Gas heater (NG/propane built-in)' },
];

const HEATERS: Record<Heater, { equipment: CostBand3; install: CostBand3; annualKwh: number; annualTherms: number; label: string }> = {
  hp_small:  { equipment: { low: 1800, mid: 2400, high: 3200 }, install: { low: 400, mid: 800, high: 1500 }, annualKwh: 1100, annualTherms: 0, label: 'Heat pump 300 gal' },
  hp_med:    { equipment: { low: 2200, mid: 2800, high: 3800 }, install: { low: 500, mid: 900, high: 1700 }, annualKwh: 1500, annualTherms: 0, label: 'Heat pump 450 gal' },
  hp_large:  { equipment: { low: 2800, mid: 3500, high: 4800 }, install: { low: 600, mid: 1100, high: 2000 }, annualKwh: 1900, annualTherms: 0, label: 'Heat pump 600+ gal' },
  electric:  { equipment: { low: 400, mid: 600, high: 900 }, install: { low: 200, mid: 400, high: 800 }, annualKwh: 3800, annualTherms: 0, label: 'Electric resistance (built-in, baseline)' },
  gas:       { equipment: { low: 1500, mid: 2200, high: 3200 }, install: { low: 800, mid: 1500, high: 2800 }, annualKwh: 200, annualTherms: 250, label: 'Gas heater (built-in)' },
};

function scale(b: CostBand3, m: number): CostBand3 { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: CostBand3, b: CostBand3): CostBand3 { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export interface HotTubHeatPumpResult extends CalcComputeOutput {
  equipment: CostBand3;
  install: CostBand3;
  annualOp: number;
  savings: number;
  label: string;
}

export function compute(inputs: HotTubHeatPumpInputs, opts?: ComputeOpts): HotTubHeatPumpResult {
  const { state, heater } = inputs;
  const laborMult = opts?.laborMult ?? (findStateLabor(state)?.electrician_multiplier ?? 1.0);
  const h = HEATERS[heater];
  const install = scale(h.install, laborMult);
  const gross = add(h.equipment, install);

  const energy = findStateEnergy(state);
  const elec = (energy?.electricity_cents_per_kwh ?? 16) / 100;
  const gas = energy?.natural_gas_dollars_per_therm ?? 1.45;
  const annualOp = h.annualKwh * elec + h.annualTherms * gas;

  // Compare to electric resistance baseline
  const baselineKwh = 3800;
  const baselineOp = baselineKwh * elec;
  const savings = Math.max(0, baselineOp - annualOp);

  return {
    equipment: h.equipment, install, gross, annualOp, savings, label: h.label,
    // Genuine category split: the heater unit is a clean equipment/materials
    // line; the install band is electrician labor.
    brk: {
      m: [Math.round(h.equipment.low), Math.round(h.equipment.high)],
      l: [Math.round(install.low), Math.round(install.high)],
    },
    scope: h.label,
    attrs: [['Heater type', HEATER_OPTIONS.find(o => o.value === heater)?.label ?? '']],
  };
}

export const TIER_INPUTS: TierInputs<HotTubHeatPumpInputs> = {
  small:   { state: 'US', heater: 'hp_small' },
  typical: { state: 'US', heater: 'hp_med' },
  large:   { state: 'US', heater: 'hp_large' },
};

export const TIER_LABELS: TierLabels = {
  small: 'plug-in',
  typical: 'hardwired',
  large: '+ circuit / pad',
};

export const COST_MIX: CostMix = { material: 0.70, labor: 0.27, equipment: 0.03 };
