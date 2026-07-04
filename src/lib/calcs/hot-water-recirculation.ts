/*
 * Hot water recirculation calculator — pure compute. Extracted verbatim from
 * src/components/HotWaterRecirculationCalculator.tsx (2026-07-04) so the
 * island, the headless band generator, and tests all run the same math.
 */
import { findStateLabor, findStateEnergy } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type RecircType = 'dedicated' | 'crossover' | 'demand' | 'timer' | 'tankless';

export interface HotWaterRecirculationInputs {
  state: string;
  type: RecircType;
}

export const TYPE_OPTIONS: { value: RecircType; label: string }[] = [
  { value: 'dedicated', label: 'Dedicated return loop (best performance, renovation only)' },
  { value: 'crossover', label: 'Crossover undersink (no new line — most common retrofit)' },
  { value: 'demand', label: 'Demand-activated (button or motion — most efficient)' },
  { value: 'timer', label: 'Timer-only continuous loop (cheapest but wasteful)' },
  { value: 'tankless', label: 'Tankless-compatible kit (Navien ComfortFlow, Rinnai)' },
];

const TYPES: Record<RecircType, { pump: CostBand3; install: CostBand3; waterSavedGalYr: number; electricityKwhYr: number; label: string }> = {
  dedicated: { pump: { low: 250, mid: 400, high: 650 },  install: { low: 400, mid: 800, high: 1500 }, waterSavedGalYr: 12000, electricityKwhYr: 250, label: 'Dedicated return loop (best)' },
  crossover: { pump: { low: 180, mid: 275, high: 400 },  install: { low: 150, mid: 300, high: 600 },  waterSavedGalYr: 8000,  electricityKwhYr: 150, label: 'Crossover (no new return line)' },
  demand:    { pump: { low: 300, mid: 450, high: 650 },  install: { low: 200, mid: 400, high: 800 },  waterSavedGalYr: 10000, electricityKwhYr: 80,  label: 'Demand-activated (most efficient)' },
  timer:     { pump: { low: 150, mid: 225, high: 350 },  install: { low: 100, mid: 250, high: 500 },  waterSavedGalYr: 5000,  electricityKwhYr: 400, label: 'Timer-only continuous loop' },
  tankless:  { pump: { low: 400, mid: 600, high: 900 },  install: { low: 300, mid: 600, high: 1200 }, waterSavedGalYr: 9000,  electricityKwhYr: 200, label: 'Tankless-compatible kit' },
};

const WATER_RATE_PER_1000_GAL = 8.50; // US average for water + sewer combined

function scale(b: CostBand3, m: number): CostBand3 { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: CostBand3, b: CostBand3): CostBand3 { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export interface HotWaterRecirculationResult extends CalcComputeOutput {
  pump: CostBand3;
  install: CostBand3;
  waterSavings: number;
  pumpCost: number;
  netSavings: number;
  label: string;
  waterSavedGalYr: number;
}

export function compute(inputs: HotWaterRecirculationInputs, opts?: ComputeOpts): HotWaterRecirculationResult {
  const { state, type } = inputs;
  const laborMult = opts?.laborMult ?? (findStateLabor(state)?.plumber_multiplier ?? 1.0);
  const t = TYPES[type];
  const install = scale(t.install, laborMult);
  const gross = add(t.pump, install);

  const energy = findStateEnergy(state);
  const elec = (energy?.electricity_cents_per_kwh ?? 16) / 100;
  const waterSavings = (t.waterSavedGalYr / 1000) * WATER_RATE_PER_1000_GAL;
  const pumpCost = t.electricityKwhYr * elec;
  const netSavings = waterSavings - pumpCost;

  return {
    pump: t.pump, install, gross, waterSavings, pumpCost, netSavings, label: t.label, waterSavedGalYr: t.waterSavedGalYr,
    // Genuine category split: the pump kit is a clean equipment/materials
    // line; the install band is plumber labor.
    brk: {
      m: [Math.round(t.pump.low), Math.round(t.pump.high)],
      l: [Math.round(install.low), Math.round(install.high)],
    },
    scope: t.label,
    attrs: [['System type', TYPE_OPTIONS.find(o => o.value === type)?.label ?? '']],
  };
}

export const TIER_INPUTS: TierInputs<HotWaterRecirculationInputs> = {
  small:   { state: 'US', type: 'crossover' },
  typical: { state: 'US', type: 'demand' },
  large:   { state: 'US', type: 'dedicated' },
};

export const TIER_LABELS: TierLabels = {
  small: 'under-sink pump',
  typical: 'dedicated-loop pump',
  large: 'new return line',
};

export const COST_MIX: CostMix = { material: 0.50, labor: 0.47, equipment: 0.03 };
