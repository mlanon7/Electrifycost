/*
 * Off-grid solar calculator — pure compute. Extracted verbatim from
 * src/components/OffGridSolarCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Profile = 'cabin_basic' | 'cabin_full' | 'homestead_modest' | 'homestead_full' | 'backup';

export interface OffGridSolarInputs {
  state: string;
  profile: Profile;
}

export const PROFILE_OPTIONS: { value: Profile; label: string }[] = [
  { value: 'cabin_basic', label: 'Weekend cabin (5 kWh/day basic)' },
  { value: 'cabin_full', label: 'Full-time cabin (15 kWh/day small home)' },
  { value: 'homestead_modest', label: 'Modest homestead (25 kWh/day, gas heat)' },
  { value: 'homestead_full', label: 'Full-electric homestead (40 kWh/day)' },
  { value: 'backup', label: 'Grid-tied with whole-home backup capability' },
];

const PROFILES: Record<Profile, { dailyKwh: number; pvKw: number; batteryKwh: number; pv: CostBand3; battery: CostBand3; inverter: CostBand3; install: CostBand3; label: string }> = {
  cabin_basic:      { dailyKwh: 5, pvKw: 1.5, batteryKwh: 10, pv: { low: 3000, mid: 4500, high: 6000 }, battery: { low: 5000, mid: 7000, high: 10000 }, inverter: { low: 800, mid: 1200, high: 1800 }, install: { low: 2000, mid: 3500, high: 6000 }, label: 'Weekend cabin (basic loads)' },
  cabin_full:       { dailyKwh: 15, pvKw: 4, batteryKwh: 20, pv: { low: 7500, mid: 11000, high: 15000 }, battery: { low: 10000, mid: 15000, high: 22000 }, inverter: { low: 1500, mid: 2200, high: 3200 }, install: { low: 4000, mid: 7000, high: 11000 }, label: 'Full-time cabin (small home)' },
  homestead_modest: { dailyKwh: 25, pvKw: 7, batteryKwh: 30, pv: { low: 13500, mid: 19500, high: 27000 }, battery: { low: 15000, mid: 22000, high: 32000 }, inverter: { low: 2500, mid: 3500, high: 5000 }, install: { low: 6000, mid: 11000, high: 18000 }, label: 'Modest homestead (gas heat + cooking)' },
  homestead_full:   { dailyKwh: 40, pvKw: 12, batteryKwh: 60, pv: { low: 23000, mid: 33500, high: 46000 }, battery: { low: 30000, mid: 45000, high: 65000 }, inverter: { low: 4000, mid: 6000, high: 8500 }, install: { low: 9000, mid: 16000, high: 28000 }, label: 'Full-electric homestead' },
  backup:           { dailyKwh: 0, pvKw: 10, batteryKwh: 40, pv: { low: 18000, mid: 26000, high: 36000 }, battery: { low: 20000, mid: 30000, high: 42000 }, inverter: { low: 3000, mid: 4500, high: 6500 }, install: { low: 7000, mid: 13000, high: 22000 }, label: 'Grid-tied whole-home backup' },
};

function add(a: CostBand3, b: CostBand3): CostBand3 { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export interface OffGridSolarResult extends CalcComputeOutput {
  dailyKwh: number;
  pvKw: number;
  batteryKwh: number;
  pv: CostBand3;
  battery: CostBand3;
  inverter: CostBand3;
  install: CostBand3;
  label: string;
}

export function compute(inputs: OffGridSolarInputs, opts?: ComputeOpts): OffGridSolarResult {
  // Pricing is national per-profile kit pricing — the component never applied
  // a state-labor lookup (`state` affects the displayed location only), so
  // opts.laborMult is accepted for contract parity but unused.
  void opts;
  const p = PROFILES[inputs.profile];
  const gross = add(add(add(p.pv, p.battery), p.inverter), p.install);
  return {
    ...p,
    gross,
    // Genuine category split: PV array + battery + inverter are hardware
    // lines (m); the install line is labor (l).
    brk: {
      m: [Math.round(p.pv.low + p.battery.low + p.inverter.low), Math.round(p.pv.high + p.battery.high + p.inverter.high)],
      l: [Math.round(p.install.low), Math.round(p.install.high)],
    },
    scope: `${p.label.replace(/\s*\(.*\)$/, '')} · ${p.pvKw} kW PV + ${p.batteryKwh} kWh battery`,
    attrs: [['Use profile', PROFILE_OPTIONS.find(o => o.value === inputs.profile)?.label ?? '']],
  };
}

export const TIER_INPUTS: TierInputs<OffGridSolarInputs> = {
  small:   { state: 'US', profile: 'cabin_basic' },
  typical: { state: 'US', profile: 'cabin_full' },
  large:   { state: 'US', profile: 'homestead_modest' },
};

export const TIER_LABELS: TierLabels = {
  small: 'cabin',
  typical: 'full off-grid',
  large: 'large off-grid',
};

export const COST_MIX: CostMix = { material: 0.74, labor: 0.24, equipment: 0.02 };
