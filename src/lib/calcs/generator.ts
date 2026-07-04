/*
 * Generator calculator — pure compute. Extracted verbatim from
 * src/components/GeneratorCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Type = 'portable' | 'inverter' | 'standby_air' | 'standby_liquid';
export type Fuel = 'natural_gas' | 'propane' | 'diesel' | 'gasoline';
export type Transfer = 'none' | 'interlock' | 'ats_partial' | 'ats_whole';
export type Sizing = '5kw' | '7kw' | '10kw' | '14kw' | '18kw' | '22kw' | '26kw';

export interface GeneratorInputs {
  state: string;
  type: Type;
  sizing: Sizing;
  fuel: Fuel;
  transfer: Transfer;
  annualHours: number;
}

export const TYPE_OPTIONS: { value: Type; label: string }[] = [
  { value: 'portable', label: 'Portable (wheels, extension cords or inlet box)' },
  { value: 'inverter', label: 'Inverter (quieter, cleaner power, more $/kW)' },
  { value: 'standby_air', label: 'Standby air-cooled (Generac Guardian)' },
  { value: 'standby_liquid', label: 'Standby liquid-cooled (Generac Protector, Kohler)' },
];

export const FUEL_OPTIONS: { value: Fuel; label: string }[] = [
  { value: 'natural_gas', label: 'Natural gas (utility, unlimited runtime)' },
  { value: 'propane', label: 'Propane (tank required)' },
  { value: 'diesel', label: 'Diesel (most efficient; tank required)' },
  { value: 'gasoline', label: 'Gasoline (portable only; ~10 hr/tank)' },
];

export const TRANSFER_OPTIONS: { value: Transfer; label: string }[] = [
  { value: 'none', label: 'None / extension cords (portable only — code-questionable)' },
  { value: 'interlock', label: 'Interlock kit + inlet box (NEC 702.5)' },
  { value: 'ats_partial', label: 'Automatic transfer switch + critical-load subpanel' },
  { value: 'ats_whole', label: 'Whole-home ATS (200A service)' },
];

const add = (a: CostBand3, b: CostBand3): CostBand3 => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand3, m: number): CostBand3 => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// Equipment ranges 2026 (Generac, Kohler, Briggs & Stratton, Champion). Sources: manufacturer MSRPs,
// Home Depot / Lowe's contractor pricing 2024-2025, electrician install surveys.
const EQUIPMENT_BASE: Record<Type, Record<Sizing, CostBand3>> = {
  portable: {
    '5kw':  { low: 600,  mid: 900,  high: 1200 },
    '7kw':  { low: 800,  mid: 1100, high: 1400 },
    '10kw': { low: 1300, mid: 1700, high: 2200 },
    '14kw': { low: 1800, mid: 2300, high: 2800 },
    '18kw': { low: 0, mid: 0, high: 0 },
    '22kw': { low: 0, mid: 0, high: 0 },
    '26kw': { low: 0, mid: 0, high: 0 },
  },
  inverter: {
    '5kw':  { low: 1200, mid: 1600, high: 2000 },
    '7kw':  { low: 1700, mid: 2100, high: 2500 },
    '10kw': { low: 2400, mid: 2900, high: 3400 },
    '14kw': { low: 0, mid: 0, high: 0 },
    '18kw': { low: 0, mid: 0, high: 0 },
    '22kw': { low: 0, mid: 0, high: 0 },
    '26kw': { low: 0, mid: 0, high: 0 },
  },
  standby_air: {     // air-cooled standby (Generac Guardian etc.)
    '5kw':  { low: 0, mid: 0, high: 0 },
    '7kw':  { low: 0, mid: 0, high: 0 },
    '10kw': { low: 2800, mid: 3500, high: 4200 },
    '14kw': { low: 3400, mid: 4200, high: 5000 },
    '18kw': { low: 4200, mid: 5100, high: 6100 },
    '22kw': { low: 5000, mid: 6000, high: 7200 },
    '26kw': { low: 5800, mid: 6900, high: 8200 },
  },
  standby_liquid: {  // liquid-cooled (Generac Protector, Kohler 14RESV)
    '5kw':  { low: 0, mid: 0, high: 0 },
    '7kw':  { low: 0, mid: 0, high: 0 },
    '10kw': { low: 0, mid: 0, high: 0 },
    '14kw': { low: 8500, mid: 10500, high: 12500 },
    '18kw': { low: 10500, mid: 12500, high: 14500 },
    '22kw': { low: 12500, mid: 14500, high: 17000 },
    '26kw': { low: 14500, mid: 16500, high: 19500 },
  },
};

// Transfer mechanism cost
const TRANSFER_COST: Record<Transfer, CostBand3> = {
  none:         { low: 0, mid: 0, high: 0 },            // direct extension cords (portable only)
  interlock:    { low: 250, mid: 450, high: 700 },      // 30-50A breaker interlock + inlet box
  ats_partial:  { low: 800, mid: 1500, high: 2400 },    // critical-load subpanel ATS
  ats_whole:    { low: 1500, mid: 2500, high: 4200 },   // 200A service-rated ATS
};

// Install labor + materials by configuration (electrician + plumber for fuel + pad/concrete)
const INSTALL_BASE: Record<Type, CostBand3> = {
  portable:       { low: 50,  mid: 150, high: 350 },     // minor — inlet box wire run
  inverter:       { low: 100, mid: 250, high: 500 },
  standby_air:    { low: 1500, mid: 2800, high: 4500 },  // pad, fuel line, wiring, ATS commissioning
  standby_liquid: { low: 2500, mid: 4500, high: 7500 },  // larger pad, dedicated subpanel
};

// Natural gas line extension (if standby and existing gas service available)
const GAS_LINE_EXT: CostBand3 = { low: 600, mid: 1400, high: 2800 };

// Propane tank install (if propane chosen) — typical 500 gal in-ground tank with regulator
const PROPANE_TANK: CostBand3 = { low: 1800, mid: 2800, high: 4200 };

// Permit + inspection
const PERMIT: CostBand3 = { low: 250, mid: 500, high: 900 };

// Annual maintenance (standby units need yearly service)
const ANNUAL_MAINT: Record<Type, number> = {
  portable: 80,
  inverter: 80,
  standby_air: 250,
  standby_liquid: 450,
};

// Fuel consumption — gallons or therms per hour at 50% load (typical residential running profile)
// Standby NG ~ 1.0-2.4 therms/hr by size; propane ~ 1.2-3.2 gal/hr; gasoline portable ~ 0.6-1.5 gal/hr
function fuelCostPerHour(type: Type, sizing: Sizing, fuel: Fuel): number {
  const ngTherm = type === 'standby_air' || type === 'standby_liquid' ? 1.0 : 1.0;
  const sizeMultiplier = ({'5kw': 0.5, '7kw': 0.6, '10kw': 0.8, '14kw': 1.1, '18kw': 1.4, '22kw': 1.7, '26kw': 2.0} as Record<Sizing, number>)[sizing];
  if (fuel === 'natural_gas') return 1.50 * sizeMultiplier * ngTherm;    // $1.50/therm typical
  if (fuel === 'propane') return 3.20 * sizeMultiplier * 1.0;             // $3.20/gal; 1 gal ≈ 0.92 therm
  if (fuel === 'diesel') return 4.00 * sizeMultiplier * 0.7;              // $4.00/gal, slightly more efficient
  if (fuel === 'gasoline') return 3.50 * sizeMultiplier * 1.0;
  return 1.50 * sizeMultiplier;
}

export const SIZE_BTU_HOURS: Record<Sizing, number> = {
  '5kw': 5000, '7kw': 7000, '10kw': 10000, '14kw': 14000, '18kw': 18000, '22kw': 22000, '26kw': 26000,
};

// Sizes actually offered per generator class (matches EQUIPMENT_BASE non-zero rows)
export function validSizingsFor(type: Type): Sizing[] {
  return type === 'portable' || type === 'inverter' ? ['5kw', '7kw', '10kw', '14kw']
    : type === 'standby_air' ? ['10kw', '14kw', '18kw', '22kw', '26kw']
    : ['14kw', '18kw', '22kw', '26kw'];
}

export interface GeneratorResult extends CalcComputeOutput {
  equipment: CostBand3;
  transferCost: CostBand3;
  installCost: CostBand3;
  gasLine: CostBand3;
  propTank: CostBand3;
  permit: CostBand3;
  fuelPerHour: number;
  annualFuelCost: number;
  maint: number;
  annualOperating: number;
  equipmentValid: boolean;
}

export function compute(inputs: GeneratorInputs, opts?: ComputeOpts): GeneratorResult {
  const { state, type, sizing, fuel, transfer, annualHours } = inputs;
  const elecMult = opts?.laborMult
    ?? (findStateLabor(state)?.electrician_multiplier ?? 1.0);

  const equipment = EQUIPMENT_BASE[type][sizing];
  const transferCost = scale(TRANSFER_COST[transfer], elecMult);
  const installCost = scale(INSTALL_BASE[type], elecMult);
  const gasLine = (type === 'standby_air' || type === 'standby_liquid') && fuel === 'natural_gas'
    ? scale(GAS_LINE_EXT, elecMult) : { low: 0, mid: 0, high: 0 };
  const propTank = fuel === 'propane' && (type === 'standby_air' || type === 'standby_liquid')
    ? PROPANE_TANK : { low: 0, mid: 0, high: 0 };
  const permit = scale(PERMIT, elecMult);

  const gross = add(add(add(add(add(equipment, transferCost), installCost), gasLine), propTank), permit);

  const fuelPerHour = fuelCostPerHour(type, sizing, fuel);
  const annualFuelCost = fuelPerHour * annualHours;
  const maint = ANNUAL_MAINT[type];
  const annualOperating = annualFuelCost + maint;

  const equipmentValid = equipment.mid > 0;

  // Genuine partial split: the generator itself is a clean equipment line (m)
  // and permit + inspection is clean (p). Transfer hardware, install labor +
  // materials, and fuel-supply work are mixed whole-job lines the calc cannot
  // decompose → k (other), mirroring brkFromItemized's "everything else" fold.
  const brk: CalcComputeOutput['brk'] = {};
  if (equipment.high > 0) brk.m = [Math.round(equipment.low), Math.round(equipment.high)];
  const balance = add(add(add(transferCost, installCost), gasLine), propTank);
  if (balance.high > 0) brk.k = [Math.round(balance.low), Math.round(balance.high)];
  if (permit.high > 0) brk.p = [Math.round(permit.low), Math.round(permit.high)];

  return {
    equipment, transferCost, installCost, gasLine, propTank, permit, gross,
    fuelPerHour, annualFuelCost, maint, annualOperating, equipmentValid,
    brk,
    scope: `${TYPE_OPTIONS.find(o => o.value === type)?.label.replace(/\s*\(.*\)$/, '') ?? type} · ${sizing.replace('kw', ' kW')}`,
    attrs: [
      ['Fuel', FUEL_OPTIONS.find(o => o.value === fuel)?.label ?? ''],
      ['Transfer', TRANSFER_OPTIONS.find(o => o.value === transfer)?.label ?? ''],
    ],
  };
}

export const TIER_INPUTS: TierInputs<GeneratorInputs> = {
  small:   { state: 'US', type: 'portable', sizing: '14kw', fuel: 'gasoline', transfer: 'ats_partial', annualHours: 24 },
  typical: { state: 'US', type: 'standby_air', sizing: '14kw', fuel: 'natural_gas', transfer: 'ats_whole', annualHours: 24 },
  large:   { state: 'US', type: 'standby_liquid', sizing: '22kw', fuel: 'natural_gas', transfer: 'ats_whole', annualHours: 24 },
};

export const TIER_LABELS: TierLabels = {
  small: 'portable + switch',
  typical: '14 kW standby',
  large: 'liquid-cooled',
};

export const COST_MIX: CostMix = { material: 0.55, labor: 0.42, equipment: 0.03 };
