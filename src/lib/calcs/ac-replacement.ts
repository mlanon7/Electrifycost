/*
 * AC replacement calculator — pure compute. Extracted verbatim from
 * src/components/AcCalculator.tsx (2026-07-04) so the island, the headless
 * band generator, and tests all run the same math.
 */
import { findStateLabor, findClimate, stateEnergy } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Tier = 'single' | 'two_stage' | 'variable';
export type Tonnage = '2' | '2.5' | '3' | '3.5' | '4' | '5';
export type DuctState = 'keep' | 'minor_repair' | 'replace';
export type FurnaceBundle = 'no' | 'yes';

export interface AcInputs {
  state: string;
  sqft: number;
  tonnage: Tonnage;
  tier: Tier;
  ducts: DuctState;
  furnaceBundle: FurnaceBundle;
}

const add = (a: CostBand3, b: CostBand3): CostBand3 => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand3, m: number): CostBand3 => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// 2026 installed-cost base ranges. Anchored to ASHRAE 2024 cost guide, ACCA Manual J/S/D guidance,
// AHRI directory pricing surveys, and Home Advisor / Modernize 2024-2025 contractor surveys.
// Costs reflect post-2023 SEER2 efficiency standard + R-410A → R-32/R-454B refrigerant transition.

// Tonnage base cost (per ton, includes condenser + evaporator coil + line set, before tier multiplier)
const PER_TON: Record<Tier, CostBand3> = {
  single: { low: 1600, mid: 2100, high: 2700 },        // 14.3-16 SEER2 single-stage
  two_stage: { low: 2100, mid: 2700, high: 3400 },     // 16-19 SEER2 two-stage
  variable: { low: 2700, mid: 3400, high: 4400 },      // 18-26 SEER2 variable-speed (inverter)
};

// Tonnage map → BTU/hour and recommended sqft range
const TON_INFO: Record<Tonnage, { btu: number; sqftLow: number; sqftHigh: number; rec: number }> = {
  '2':   { btu: 24000, sqftLow: 1000, sqftHigh: 1300, rec: 2.0 },
  '2.5': { btu: 30000, sqftLow: 1300, sqftHigh: 1600, rec: 2.5 },
  '3':   { btu: 36000, sqftLow: 1500, sqftHigh: 1900, rec: 3.0 },
  '3.5': { btu: 42000, sqftLow: 1800, sqftHigh: 2200, rec: 3.5 },
  '4':   { btu: 48000, sqftLow: 2100, sqftHigh: 2500, rec: 4.0 },
  '5':   { btu: 60000, sqftLow: 2400, sqftHigh: 3000, rec: 5.0 },
};

// Duct work adders
const DUCT_ADDER: Record<DuctState, CostBand3> = {
  keep: { low: 0, mid: 0, high: 0 },
  minor_repair: { low: 400, mid: 800, high: 1500 },          // seal + insulate trunk
  replace: { low: 2500, mid: 4500, high: 7500 },             // full duct replacement (small home)
};

// Bundled furnace replacement (gas, 80-95% AFUE) — only if user is doing both at same time
const FURNACE_BUNDLE: CostBand3 = { low: 2400, mid: 3500, high: 5000 };

// Labor hours per ton (varies by tier — variable systems take longer)
const LABOR_HOURS_PER_TON: Record<Tier, number> = {
  single: 6,        // 12-18 hours for 2-3 ton install
  two_stage: 7,
  variable: 8.5,    // commissioning + line set vacuum
};

// HVAC technician blended rate; sourced from module-labor-rates.csv (`ac` row, $110)
// so it's consistent with every other module's labor rate basis.
// Previously hard-coded at $95 — a separate source of truth from `module-labor-rates.csv`,
// flagged by the May-2026 audit as inconsistent.
const LABOR_RATE_USD = 110;

// Permit + disposal of old equipment
const PERMIT_BASE: CostBand3 = { low: 200, mid: 400, high: 700 };

// Refrigerant transition adder — A2L (R-32, R-454B) installs require new tools/training and
// in 2025-2026 some supply constraints. Add a modest premium.
const REFRIGERANT_PREMIUM: CostBand3 = { low: 200, mid: 400, high: 700 };

// SEER2 typical efficiency by tier
const SEER2_TYPICAL: Record<Tier, number> = {
  single: 15.0,
  two_stage: 17.5,
  variable: 21.0,
};

// Annual cooling load model. The cooling-degree-day method (Manual J building load coefficient):
//   annual cooling BTU ≈ sqft × CDD × ~18 BTU/(sqft·CDD-day) for a typical insulated home
// Source: ASHRAE Handbook + ACCA Manual J — BLC ranges 12–25 BTU/(sqft·°F·day) by envelope tightness.
// SEER2 is BTU output / Wh input, so kWh consumed = annualBtu / SEER2 / 1000.
// Sanity check: 1,800 sqft × 1,500 CDD × 18 = 48.6 MMBTU/yr ÷ SEER2 17.5 = ~2,780 kWh/yr.
// EIA RECS 2020 average residential AC: ~1,800-2,500 kWh/yr. Aligns.
const BLC_BTU_PER_SQFT_CDD = 18;
function estimateAnnualCoolingKwh(sqft: number, seer2: number, cdd: number): number {
  const annualBtu = sqft * cdd * BLC_BTU_PER_SQFT_CDD;
  const kwh = annualBtu / (seer2 * 1000);
  return Math.max(0, Math.round(kwh));
}

// Map climate zone to a cooling-degree-days proxy (very rough — real CDD from NOAA)
function cddProxy(state: string): number {
  const c = findClimate(state);
  if (c?.cooling_degree_days && c.cooling_degree_days > 0) return c.cooling_degree_days;
  const z = c?.iecc_zone ?? "4A";
  // Very rough mapping: 1A/2A hot/humid → 2500-3500, 3-4 → 1200-2000, 5-7 → 500-1000, 8 → ~200
  const head = z[0];
  switch (head) {
    case '1': return 3500;
    case '2': return 2800;
    case '3': return 1800;
    case '4': return 1200;
    case '5': return 800;
    case '6': return 500;
    case '7': return 300;
    case '8': return 150;
    default: return 1200;
  }
}

export const TONNAGE_OPTIONS: { value: Tonnage; label: string }[] =
  (['2', '2.5', '3', '3.5', '4', '5'] as Tonnage[]).map(t => ({
    value: t,
    label: `${t} ton · ${TON_INFO[t].btu.toLocaleString()} BTU · fits ${TON_INFO[t].sqftLow}-${TON_INFO[t].sqftHigh} sqft`,
  }));

export const EFFICIENCY_OPTIONS: { value: Tier; label: string }[] = [
  { value: 'single', label: 'Single-stage (~15 SEER2 — basic)' },
  { value: 'two_stage', label: 'Two-stage (~17.5 SEER2 — mid)' },
  { value: 'variable', label: 'Variable-speed inverter (~21 SEER2 — premium)' },
];

export const DUCT_OPTIONS: { value: DuctState; label: string }[] = [
  { value: 'keep', label: 'Keep existing (good condition)' },
  { value: 'minor_repair', label: 'Minor repair / seal / insulate' },
  { value: 'replace', label: 'Replace ductwork' },
];

export const FURNACE_OPTIONS: { value: FurnaceBundle; label: string }[] = [
  { value: 'no', label: 'No (AC only)' },
  { value: 'yes', label: 'Yes — replace gas furnace at same time' },
];

// Tonnage recommendation based on sqft (Manual J shortcut — 1 ton per ~600 sqft is too aggressive;
// 1 ton per ~700-800 sqft is more accurate; high-load climates closer to 600, low closer to 900)
export function recommendedTonnage(sqft: number): Tonnage {
  const target = sqft / 700;
  if (target < 2.25) return '2';
  if (target < 2.75) return '2.5';
  if (target < 3.25) return '3';
  if (target < 3.75) return '3.5';
  if (target < 4.5) return '4';
  return '5';
}

export interface AcResult extends CalcComputeOutput {
  equip: CostBand3;
  labor: CostBand3;
  duct: CostBand3;
  furnace: CostBand3;
  refrigerant: CostBand3;
  permit: CostBand3;
  seer: number;
  annualKwh: number;
  baselineKwh: number;
  annualCost: number;
  annualSavings: number;
  hpAltMid: number;
}

export function compute(inputs: AcInputs, opts?: ComputeOpts): AcResult {
  const { state, sqft, tonnage, tier, ducts, furnaceBundle } = inputs;
  const tonNum = parseFloat(tonnage);
  const hvacMult = opts?.laborMult
    ?? (findStateLabor(state)?.hvac_multiplier ?? 1.0);

  const equipPerTon = PER_TON[tier];
  const equip: CostBand3 = scale(equipPerTon, tonNum);

  const laborHours = LABOR_HOURS_PER_TON[tier] * tonNum;
  const laborCostMid = laborHours * LABOR_RATE_USD * hvacMult;
  const labor: CostBand3 = { low: laborCostMid * 0.85, mid: laborCostMid, high: laborCostMid * 1.20 };

  const duct = DUCT_ADDER[ducts];
  const furnace = furnaceBundle === 'yes' ? FURNACE_BUNDLE : { low: 0, mid: 0, high: 0 };
  const refrigerant = REFRIGERANT_PREMIUM;
  const permit = scale(PERMIT_BASE, hvacMult);

  const gross = add(add(add(add(add(equip, labor), duct), furnace), refrigerant), permit);

  // Operating cost comparison
  const seer = SEER2_TYPICAL[tier];
  const cdd = cddProxy(state);
  const annualKwh = estimateAnnualCoolingKwh(sqft, seer, cdd);
  const baselineKwh = estimateAnnualCoolingKwh(sqft, 13.0, cdd); // pre-2023 SEER 13 baseline
  const eRow = stateEnergy.find(e => e.state === state);
  const rate = eRow ? eRow.electricity_cents_per_kwh / 100 : 0.16;
  const annualCost = annualKwh * rate;
  const annualSavings = (baselineKwh - annualKwh) * rate;

  // Heat-pump alternative cost (estimate vs same tier — central air-source HP runs ~$1,500-2,500/ton more)
  const hpAltMid = gross.mid + tonNum * 2000;

  // The calc genuinely prices equipment / labor / permit as separate bands;
  // duct + furnace + refrigerant adders fold into k (adjustments & add-ons).
  const brk: CalcComputeOutput['brk'] = {
    m: [Math.round(equip.low), Math.round(equip.high)],
    l: [Math.round(labor.low), Math.round(labor.high)],
    p: [Math.round(permit.low), Math.round(permit.high)],
  };
  const addOnsHigh = duct.high + furnace.high + refrigerant.high;
  if (addOnsHigh > 0) {
    brk.k = [Math.round(duct.low + furnace.low + refrigerant.low), Math.round(addOnsHigh)];
  }

  const tierWord = tier === 'single' ? 'single-stage' : tier === 'two_stage' ? 'two-stage' : 'variable-speed';

  return {
    gross, equip, labor, duct, furnace, refrigerant, permit,
    seer, annualKwh, baselineKwh, annualCost, annualSavings, hpAltMid,
    brk,
    scope: `${tonnage} ton ${tierWord} · ${sqft.toLocaleString('en-US')} sqft`,
    attrs: [
      ['Efficiency tier', EFFICIENCY_OPTIONS.find(o => o.value === tier)?.label ?? ''],
      ['Ductwork', DUCT_OPTIONS.find(o => o.value === ducts)?.label ?? ''],
    ],
  };
}

export const TIER_INPUTS: TierInputs<AcInputs> = {
  small:   { state: 'US', sqft: 1200, tonnage: '2', tier: 'single', ducts: 'keep', furnaceBundle: 'no' },
  typical: { state: 'US', sqft: 1800, tonnage: '3', tier: 'two_stage', ducts: 'keep', furnaceBundle: 'no' },
  large:   { state: 'US', sqft: 2000, tonnage: '3', tier: 'variable', ducts: 'keep', furnaceBundle: 'no' },
};

export const TIER_LABELS: TierLabels = {
  small: 'condenser swap',
  typical: 'AC + coil',
  large: 'high-SEER + line set',
};

export const COST_MIX: CostMix = { material: 0.60, labor: 0.37, equipment: 0.03 };
