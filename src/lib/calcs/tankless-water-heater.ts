/*
 * Tankless water heater calculator — pure compute. Extracted verbatim from
 * src/components/TanklessCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor, stateEnergy } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Type = 'gas_condensing' | 'gas_non_condensing' | 'electric_pos' | 'electric_whole';
export type Size = '140k' | '180k' | '199k' | 'electric_18' | 'electric_27' | 'electric_36';
export type Existing = 'gas_tank' | 'electric_tank' | 'none_new';
export type GasLine = 'adequate' | 'upsize' | 'new_run';
export type PanelOk = 'yes' | 'no' | 'unknown';

export interface TanklessInputs {
  state: string;
  type: Type;
  size: Size;
  existing: Existing;
  gasLine: GasLine;
  panelOk: PanelOk;
}

export const TYPE_OPTIONS: { value: Type; label: string }[] = [
  { value: 'gas_condensing', label: 'Gas condensing (95% AFUE — recommended)' },
  { value: 'gas_non_condensing', label: 'Gas non-condensing (82% AFUE — cheaper)' },
  { value: 'electric_whole', label: 'Electric whole-home (27-36 kW — needs panel capacity)' },
  { value: 'electric_pos', label: 'Electric point-of-use (under-sink booster)' },
];

export const SIZE_LABELS: Record<Size, string> = {
  '140k': '140,000 BTU/hr (2-3 bath)',
  '180k': '180,000 BTU/hr (3 bath)',
  '199k': '199,000 BTU/hr (4+ bath)',
  'electric_18': '18 kW point-of-use',
  'electric_27': '27 kW (warm-water states)',
  'electric_36': '36 kW (cold-water states)',
};

export const EXISTING_OPTIONS: { value: Existing; label: string }[] = [
  { value: 'gas_tank', label: 'Gas tank (40-50 gal)' },
  { value: 'electric_tank', label: 'Electric tank (40-50 gal)' },
  { value: 'none_new', label: 'New construction / no existing' },
];

export const GAS_LINE_OPTIONS: { value: GasLine; label: string }[] = [
  { value: 'adequate', label: 'Adequate as-is' },
  { value: 'upsize', label: 'Upsize existing run' },
  { value: 'new_run', label: 'New run from meter' },
];

export const PANEL_OPTIONS: { value: PanelOk; label: string }[] = [
  { value: 'yes', label: 'Yes — 200A+ service with spare capacity' },
  { value: 'no', label: 'No — needs panel upgrade' },
  { value: 'unknown', label: 'Unknown' },
];

// Sizes actually offered per tankless type (matches EQUIPMENT non-zero rows)
export function validSizesFor(type: Type): Size[] {
  return type === 'gas_condensing' || type === 'gas_non_condensing' ? ['140k', '180k', '199k']
    : type === 'electric_pos' ? ['electric_18']
    : ['electric_27', 'electric_36'];
}

const add = (a: CostBand3, b: CostBand3): CostBand3 => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand3, m: number): CostBand3 => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// 2026 installed cost — Rinnai, Navien, Rheem, Bosch, A.O. Smith. Source: manufacturer MSRPs, contractor surveys.
const EQUIPMENT: Record<Type, Record<Size, CostBand3>> = {
  gas_non_condensing: {     // direct vent, 80% AFUE, cheaper, shorter venting limits
    '140k': { low: 1000, mid: 1300, high: 1600 },
    '180k': { low: 1200, mid: 1500, high: 1900 },
    '199k': { low: 1400, mid: 1750, high: 2200 },
    'electric_18': { low: 0, mid: 0, high: 0 },
    'electric_27': { low: 0, mid: 0, high: 0 },
    'electric_36': { low: 0, mid: 0, high: 0 },
  },
  gas_condensing: {         // sealed combustion, 95% AFUE, PVC venting up to 100 ft
    '140k': { low: 1500, mid: 1900, high: 2400 },
    '180k': { low: 1800, mid: 2200, high: 2800 },
    '199k': { low: 2100, mid: 2600, high: 3300 },
    'electric_18': { low: 0, mid: 0, high: 0 },
    'electric_27': { low: 0, mid: 0, high: 0 },
    'electric_36': { low: 0, mid: 0, high: 0 },
  },
  electric_pos: {           // point-of-use under-sink — for additional bathrooms / kitchen
    '140k': { low: 0, mid: 0, high: 0 },
    '180k': { low: 0, mid: 0, high: 0 },
    '199k': { low: 0, mid: 0, high: 0 },
    'electric_18': { low: 250, mid: 350, high: 500 },
    'electric_27': { low: 0, mid: 0, high: 0 },
    'electric_36': { low: 0, mid: 0, high: 0 },
  },
  electric_whole: {         // whole-home — typically Stiebel Eltron Tempra Plus or EcoSmart
    '140k': { low: 0, mid: 0, high: 0 },
    '180k': { low: 0, mid: 0, high: 0 },
    '199k': { low: 0, mid: 0, high: 0 },
    'electric_18': { low: 0, mid: 0, high: 0 },
    'electric_27': { low: 700, mid: 900, high: 1100 },     // 27 kW, 3-shower capable in warm-water states
    'electric_36': { low: 900, mid: 1200, high: 1500 },    // 36 kW, whole-home in cold-water states
  },
};

// Installation labor + materials
const INSTALL_BASE: Record<Type, CostBand3> = {
  gas_non_condensing: { low: 800, mid: 1300, high: 2000 },
  gas_condensing: { low: 1200, mid: 1800, high: 2800 },     // PVC venting + condensate drain
  electric_pos: { low: 200, mid: 400, high: 700 },          // 240V circuit nearby
  electric_whole: { low: 1500, mid: 2500, high: 4000 },     // multiple 50A circuits + panel upgrade often required
};

// Gas line work
const GAS_LINE: Record<GasLine, CostBand3> = {
  adequate: { low: 0, mid: 0, high: 0 },
  upsize: { low: 500, mid: 900, high: 1500 },               // 1/2" → 3/4" run for tankless demand
  new_run: { low: 800, mid: 1500, high: 2800 },             // new run from meter
};

// Electric panel upgrade likelihood for electric whole-home tankless (it needs 100-150A by itself)
const PANEL_UPGRADE: CostBand3 = { low: 2500, mid: 4000, high: 6500 };

// Tank removal + disposal
const TANK_REMOVE: CostBand3 = { low: 150, mid: 250, high: 400 };

// Permit
const PERMIT: CostBand3 = { low: 250, mid: 450, high: 800 };

// Annual operating cost estimate based on actual water-heating physics.
// Energy to heat water = gallons × 8.34 lb/gal × ΔT °F × 1 BTU/lb-°F
// 1 therm = 100,000 BTU; 1 kWh = 3,412 BTU.
// Default: 64 gal/day × 8.34 × 70°F rise = 37,363 BTU/day = 0.374 therm/day delivered (before UEF losses).
// Source: DOE water-heating methodology https://www.energy.gov/energysaver/storage-water-heaters
function annualOperatingCost(
  type: Type,
  gasPerTherm: number,
  elecRate: number,
  galPerDay = 64,
  tempRiseF = 70,
): number {
  const btuPerDayDelivered = galPerDay * 8.34 * tempRiseF;
  const thermsPerDayDelivered = btuPerDayDelivered / 100_000;
  const kwhPerDayDelivered = btuPerDayDelivered / 3412;
  switch (type) {
    case 'gas_non_condensing': return (thermsPerDayDelivered / 0.82) * gasPerTherm * 365;  // UEF ~0.82
    case 'gas_condensing':     return (thermsPerDayDelivered / 0.95) * gasPerTherm * 365;  // UEF ~0.95
    case 'electric_pos':
    case 'electric_whole':     return (kwhPerDayDelivered / 0.99) * elecRate * 365;        // UEF ~0.99
  }
}

export interface TanklessResult extends CalcComputeOutput {
  equipment: CostBand3;
  install: CostBand3;
  gasLineCost: CostBand3;
  panelUpgrade: CostBand3;
  tankRemove: CostBand3;
  permit: CostBand3;
  operating: number;
  annualSavings: number;
}

export function compute(inputs: TanklessInputs, opts?: ComputeOpts): TanklessResult {
  const { state, type, size, existing, gasLine, panelOk } = inputs;
  const lab = findStateLabor(state);
  const plumbMult = opts?.laborMult ?? (lab?.plumber_multiplier ?? 1.0);
  const elecMult = opts?.laborMult ?? (lab?.electrician_multiplier ?? 1.0);
  const eRow = stateEnergy.find(e => e.state === state);
  const elecRate = eRow ? eRow.electricity_cents_per_kwh / 100 : 0.16;
  const gasRate = eRow ? eRow.natural_gas_dollars_per_therm : 1.50;

  const equipment = EQUIPMENT[type][size];
  const isGas = type === 'gas_condensing' || type === 'gas_non_condensing';
  const install = scale(INSTALL_BASE[type], isGas ? plumbMult : elecMult);
  const gasLineCost = isGas ? scale(GAS_LINE[gasLine], plumbMult) : { low: 0, mid: 0, high: 0 };
  const panelUpgrade = type === 'electric_whole' && (panelOk === 'no' || panelOk === 'unknown')
    ? (panelOk === 'no' ? scale(PANEL_UPGRADE, elecMult) : scale(PANEL_UPGRADE, elecMult * 0.5))
    : { low: 0, mid: 0, high: 0 };
  const tankRemove = existing === 'gas_tank' || existing === 'electric_tank'
    ? scale(TANK_REMOVE, plumbMult) : { low: 0, mid: 0, high: 0 };
  const permit = scale(PERMIT, plumbMult);

  const gross = add(add(add(add(add(equipment, install), gasLineCost), panelUpgrade), tankRemove), permit);

  const operating = annualOperatingCost(type, gasRate, elecRate);
  // Tank baseline same physics: 0.374 therm/day delivered, divide by UEF
  const dailyThermDelivered = 64 * 8.34 * 70 / 100_000;
  const dailyKwhDelivered = 64 * 8.34 * 70 / 3412;
  const tankBaselineGas = (dailyThermDelivered / 0.62) * gasRate * 365;        // UEF 0.62 standard gas tank
  const tankBaselineElec = (dailyKwhDelivered / 0.92) * elecRate * 365;        // UEF 0.92 standard electric tank
  const baselineForComparison = existing === 'electric_tank' ? tankBaselineElec : tankBaselineGas;
  const annualSavings = baselineForComparison - operating;  // can be negative — that's the truth

  // Genuine partial split: the tankless unit is a clean equipment line (m) and
  // permit + inspection is clean (p). Install labor + materials, gas-line work,
  // the panel-upgrade allowance, and tank removal are mixed whole-job lines the
  // calc cannot decompose → k (other), mirroring brkFromItemized's fold.
  const brk: CalcComputeOutput['brk'] = {};
  if (equipment.high > 0) brk.m = [Math.round(equipment.low), Math.round(equipment.high)];
  const balance = add(add(add(install, gasLineCost), panelUpgrade), tankRemove);
  if (balance.high > 0) brk.k = [Math.round(balance.low), Math.round(balance.high)];
  if (permit.high > 0) brk.p = [Math.round(permit.low), Math.round(permit.high)];

  const attrs: [string, string][] = [
    ['Existing water heater', EXISTING_OPTIONS.find(o => o.value === existing)?.label ?? ''],
  ];
  if (isGas) attrs.push(['Gas line', GAS_LINE_OPTIONS.find(o => o.value === gasLine)?.label ?? '']);
  else if (type === 'electric_whole') attrs.push(['Panel capacity', PANEL_OPTIONS.find(o => o.value === panelOk)?.label ?? '']);

  return {
    equipment, install, gasLineCost, panelUpgrade, tankRemove, permit, gross, operating, annualSavings,
    brk,
    scope: `${TYPE_OPTIONS.find(o => o.value === type)?.label.replace(/\s*\(.*\)$/, '') ?? type} · ${SIZE_LABELS[size].replace(/\s*\(.*\)$/, '')}`,
    attrs,
  };
}

export const TIER_INPUTS: TierInputs<TanklessInputs> = {
  small:   { state: 'US', type: 'electric_pos', size: 'electric_18', existing: 'none_new', gasLine: 'adequate', panelOk: 'yes' },
  typical: { state: 'US', type: 'gas_condensing', size: '180k', existing: 'gas_tank', gasLine: 'adequate', panelOk: 'yes' },
  large:   { state: 'US', type: 'gas_condensing', size: '199k', existing: 'gas_tank', gasLine: 'upsize', panelOk: 'yes' },
};

export const TIER_LABELS: TierLabels = {
  small: 'electric point-of-use',
  typical: 'gas whole-home',
  large: 'condensing + gas upsize',
};

export const COST_MIX: CostMix = { material: 0.58, labor: 0.39, equipment: 0.03 };
