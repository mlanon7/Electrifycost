/*
 * Smart thermostat calculator — pure compute. Extracted verbatim from
 * src/components/ThermostatCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Model = 'basic' | 'nest_e' | 'ecobee_premium' | 'nest_learning' | 'honeywell_t9';
export type Install = 'diy' | 'pro';
export type Cwire = 'yes' | 'no' | 'unknown';
export type HvacType = 'central_ac_furnace' | 'heat_pump' | 'boiler';

export interface SmartThermostatInputs {
  state: string;
  model: Model;
  install: Install;
  cwire: Cwire;
  hvac: HvacType;
  annualHvacCost: number;
}

export const MODEL_OPTIONS: { value: Model; label: string }[] = [
  { value: 'basic', label: 'Basic Wi-Fi (Sensi, Honeywell RTH)' },
  { value: 'nest_e', label: 'Nest E (mid)' },
  { value: 'honeywell_t9', label: 'Honeywell T9 (multi-sensor)' },
  { value: 'ecobee_premium', label: 'Ecobee Premium (multi-sensor + voice)' },
  { value: 'nest_learning', label: 'Nest Learning (4th gen)' },
];

export const INSTALL_OPTIONS: { value: Install; label: string }[] = [
  { value: 'diy', label: 'DIY (free, ~30 min)' },
  { value: 'pro', label: 'Pro install ($150–$400)' },
];

export const CWIRE_OPTIONS: { value: Cwire; label: string }[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'unknown', label: 'Unknown (most homes have one)' },
  { value: 'no', label: 'No (needs electrician to add)' },
];

export const HVAC_OPTIONS: { value: HvacType; label: string }[] = [
  { value: 'central_ac_furnace', label: 'Central AC + forced-air furnace' },
  { value: 'heat_pump', label: 'Heat pump (use heat-pump-aware mode)' },
  { value: 'boiler', label: 'Hot-water boiler / radiator' },
];

// Hardware MSRPs 2026
const HARDWARE: Record<Model, CostBand3> = {
  basic:           { low: 60,  mid: 90,  high: 130 },   // Sensi, Honeywell RTH9580
  nest_e:          { low: 130, mid: 170, high: 200 },
  ecobee_premium:  { low: 230, mid: 250, high: 280 },
  nest_learning:   { low: 230, mid: 250, high: 280 },
  honeywell_t9:    { low: 180, mid: 220, high: 250 },
};

const PRO_INSTALL: CostBand3 = { low: 150, mid: 250, high: 400 };
const CWIRE_ADDER: CostBand3 = { low: 100, mid: 200, high: 350 };   // electrician adds C-wire if missing

// Annual HVAC savings: Nest's own studies put it 10-12% heating + 15% cooling, ENERGY STAR claims ~8%.
// We model 10% combined to be conservative.
const HVAC_SAVINGS_PCT: Record<HvacType, number> = {
  central_ac_furnace: 0.10,
  heat_pump: 0.08,        // heat pumps with proper smart-thermostat behavior; less if naive recovery cycles
  boiler: 0.12,           // hot-water boilers respond well to setback
};

// Typical utility rebate (snapshot — varies wildly by utility, often $50–$125)
function utilityRebate(state: string): number {
  // Strong programs in MA, CA, NY, CT, NJ, MN, CO
  const strong = ['MA', 'CA', 'NY', 'CT', 'NJ', 'MN', 'CO', 'IL'];
  if (strong.includes(state)) return 100;
  return 0;
}

export interface SmartThermostatResult extends CalcComputeOutput {
  hw: CostBand3;
  proCost: CostBand3;
  cw: CostBand3;
  rebate: number;
  net: CostBand3;
  savingsPct: number;
  annualSavings: number;
  paybackYears: number | null;
}

export function compute(inputs: SmartThermostatInputs, opts?: ComputeOpts): SmartThermostatResult {
  const { state, model, install, cwire, hvac, annualHvacCost } = inputs;
  const elecMult = opts?.laborMult ?? (findStateLabor(state)?.electrician_multiplier ?? 1.0);
  const hw = HARDWARE[model];
  const proCost: CostBand3 = install === 'pro'
    ? { low: PRO_INSTALL.low * elecMult, mid: PRO_INSTALL.mid * elecMult, high: PRO_INSTALL.high * elecMult }
    : { low: 0, mid: 0, high: 0 };
  const cw: CostBand3 = cwire === 'no'
    ? { low: CWIRE_ADDER.low * elecMult, mid: CWIRE_ADDER.mid * elecMult, high: CWIRE_ADDER.high * elecMult }
    : cwire === 'unknown'
    ? { low: 0, mid: CWIRE_ADDER.mid * 0.4 * elecMult, high: CWIRE_ADDER.high * 0.7 * elecMult }
    : { low: 0, mid: 0, high: 0 };

  const gross: CostBand3 = {
    low: hw.low + proCost.low + cw.low,
    mid: hw.mid + proCost.mid + cw.mid,
    high: hw.high + proCost.high + cw.high,
  };

  const rebate = utilityRebate(state);
  const net: CostBand3 = {
    low: Math.max(0, gross.low - rebate),
    mid: Math.max(0, gross.mid - rebate),
    high: Math.max(0, gross.high - rebate),
  };

  const savingsPct = HVAC_SAVINGS_PCT[hvac];
  const annualSavings = annualHvacCost * savingsPct;
  const paybackYears = annualSavings > 0 ? Math.round((net.mid / annualSavings) * 10) / 10 : null;

  // Genuine category split: hardware is a clean materials line; pro install +
  // C-wire work are electrician labor. Labor omitted when the config has none.
  const brk: CalcComputeOutput['brk'] = { m: [Math.round(hw.low), Math.round(hw.high)] };
  if (proCost.high + cw.high > 0) {
    brk.l = [Math.round(proCost.low + cw.low), Math.round(proCost.high + cw.high)];
  }

  return {
    hw, proCost, cw, gross, rebate, net, savingsPct, annualSavings, paybackYears,
    brk,
    scope: `${MODEL_OPTIONS.find(o => o.value === model)?.label.replace(/\s*\(.*\)$/, '') ?? model} · ${INSTALL_OPTIONS.find(o => o.value === install)?.label.replace(/\s*\(.*\)$/, '') ?? install}`,
    attrs: [
      ['Model', MODEL_OPTIONS.find(o => o.value === model)?.label ?? ''],
      ['Install', INSTALL_OPTIONS.find(o => o.value === install)?.label ?? ''],
    ],
  };
}

export const TIER_INPUTS: TierInputs<SmartThermostatInputs> = {
  small:   { state: 'US', model: 'nest_e', install: 'diy', cwire: 'unknown', hvac: 'central_ac_furnace', annualHvacCost: 1500 },
  typical: { state: 'US', model: 'ecobee_premium', install: 'pro', cwire: 'unknown', hvac: 'central_ac_furnace', annualHvacCost: 1500 },
  large:   { state: 'US', model: 'ecobee_premium', install: 'pro', cwire: 'no', hvac: 'central_ac_furnace', annualHvacCost: 1500 },
};

export const TIER_LABELS: TierLabels = {
  small: 'DIY-grade',
  typical: 'pro-installed',
  large: 'multi-zone',
};

export const COST_MIX: CostMix = { material: 0.72, labor: 0.26, equipment: 0.02 };
