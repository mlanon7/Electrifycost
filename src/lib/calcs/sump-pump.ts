/*
 * Sump pump calculator — pure compute. Extracted verbatim from
 * src/components/SumpPumpCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Pump = 'basic' | 'heavy' | 'battery_only' | 'combo' | 'water_powered' | 'smart' | 'generator_circuit';
export type FloodRisk = 'low' | 'medium' | 'high';

export interface SumpPumpInputs {
  state: string;
  pump: Pump;
  floodRisk: FloodRisk;
}

export const PUMP_OPTIONS: { value: Pump; label: string }[] = [
  { value: 'basic', label: 'Basic primary 1/3 HP only' },
  { value: 'heavy', label: 'Heavy-duty 1/2 HP only' },
  { value: 'battery_only', label: 'Battery backup (add to existing)' },
  { value: 'combo', label: 'Combo primary + battery backup (most popular)' },
  { value: 'water_powered', label: 'Water-powered backup (no battery)' },
  { value: 'smart', label: 'Smart WiFi combo with monitoring' },
  { value: 'generator_circuit', label: 'Primary on generator critical-loads circuit' },
];

export const RISK_OPTIONS: { value: FloodRisk; label: string }[] = [
  { value: 'low', label: 'Low (rarely floods, no finished space)' },
  { value: 'medium', label: 'Medium (occasional water, finished basement)' },
  { value: 'high', label: 'High (regular flooding, valuable contents)' },
];

const PUMPS: Record<Pump, { equipment: CostBand3; install: CostBand3; gpm: number; label: string }> = {
  basic:             { equipment: { low: 180, mid: 260, high: 380 },  install: { low: 250, mid: 400, high: 650 },   gpm: 40, label: 'Basic primary 1/3 HP' },
  heavy:             { equipment: { low: 280, mid: 420, high: 650 },  install: { low: 300, mid: 500, high: 800 },   gpm: 60, label: 'Heavy-duty 1/2 HP' },
  battery_only:      { equipment: { low: 250, mid: 400, high: 650 },  install: { low: 200, mid: 400, high: 700 },   gpm: 25, label: 'Battery backup only (standalone DC)' },
  combo:             { equipment: { low: 500, mid: 800, high: 1300 }, install: { low: 400, mid: 700, high: 1200 },  gpm: 55, label: 'Combo primary + battery backup' },
  water_powered:     { equipment: { low: 180, mid: 300, high: 500 },  install: { low: 250, mid: 500, high: 900 },   gpm: 35, label: 'Water-powered backup' },
  smart:             { equipment: { low: 800, mid: 1200, high: 1800 }, install: { low: 500, mid: 900, high: 1500 },  gpm: 55, label: 'Smart WiFi combo' },
  generator_circuit: { equipment: { low: 180, mid: 260, high: 380 },  install: { low: 1500, mid: 2500, high: 4000 }, gpm: 40, label: 'Primary on generator circuit' },
};

function scale(b: CostBand3, m: number): CostBand3 { return { low: b.low * m, mid: b.mid * m, high: b.high * m }; }
function add(a: CostBand3, b: CostBand3): CostBand3 { return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high }; }

export interface SumpPumpResult extends CalcComputeOutput {
  equipment: CostBand3;
  install: CostBand3;
  label: string;
  recommendation: string;
}

export function compute(inputs: SumpPumpInputs, opts?: ComputeOpts): SumpPumpResult {
  const { state, pump, floodRisk } = inputs;
  const laborMult = opts?.laborMult ?? (findStateLabor(state)?.plumber_multiplier ?? 1.0);
  const p = PUMPS[pump];
  const install = scale(p.install, laborMult);
  const gross = add(p.equipment, install);

  const recommendation =
    floodRisk === 'high' && pump !== 'combo' && pump !== 'smart' && pump !== 'generator_circuit'
      ? 'Upgrade to combo or smart — high flood risk warrants battery backup'
      : floodRisk === 'low' && pump === 'smart'
      ? 'Smart features may be overkill; combo is likely enough'
      : 'Good match for your risk profile';

  return {
    equipment: p.equipment, install, gross, label: p.label, recommendation,
    // Genuine category split: pump hardware is a clean equipment/materials
    // line; the install band is plumber labor.
    brk: {
      m: [Math.round(p.equipment.low), Math.round(p.equipment.high)],
      l: [Math.round(install.low), Math.round(install.high)],
    },
    scope: p.label,
    attrs: [
      ['Configuration', PUMP_OPTIONS.find(o => o.value === pump)?.label ?? ''],
      ['Flood risk', RISK_OPTIONS.find(o => o.value === floodRisk)?.label ?? ''],
    ],
  };
}

export const TIER_INPUTS: TierInputs<SumpPumpInputs> = {
  small:   { state: 'US', pump: 'basic', floodRisk: 'low' },
  typical: { state: 'US', pump: 'combo', floodRisk: 'medium' },
  large:   { state: 'US', pump: 'smart', floodRisk: 'high' },
};

export const TIER_LABELS: TierLabels = {
  small: 'like-for-like swap',
  typical: 'new install',
  large: '+ battery backup',
};

export const COST_MIX: CostMix = { material: 0.45, labor: 0.50, equipment: 0.05 };
