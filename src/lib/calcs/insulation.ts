/*
 * Insulation calculator — pure compute. Extracted verbatim from
 * src/components/InsulationCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor, findClimate, findHomeEnergyRebateStatus } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Scope = 'attic_only' | 'walls_only' | 'attic_walls' | 'attic_walls_air' | 'whole_envelope';
export type AtticType = 'blown_cellulose' | 'blown_fiberglass' | 'open_foam' | 'closed_foam';
export type ExistingR = 'none' | 'low_r11' | 'medium_r19_30' | 'high_r38plus';
export type Income = 'unknown' | 'low' | 'moderate' | 'high';

export interface InsulationInputs {
  state: string;
  sqft: number;
  scope: Scope;
  atticType: AtticType;
  existing: ExistingR;
  income: Income;
}

export const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: 'attic_only', label: 'Attic only' },
  { value: 'walls_only', label: 'Walls only (drill-and-fill)' },
  { value: 'attic_walls', label: 'Attic + walls' },
  { value: 'attic_walls_air', label: 'Attic + walls + air-sealing (recommended)' },
  { value: 'whole_envelope', label: 'Whole envelope (+ crawl/basement)' },
];

export const ATTIC_OPTIONS: { value: AtticType; label: string }[] = [
  { value: 'blown_cellulose', label: 'Blown-in cellulose (recommended)' },
  { value: 'blown_fiberglass', label: 'Blown-in fiberglass' },
  { value: 'open_foam', label: 'Open-cell spray foam' },
  { value: 'closed_foam', label: 'Closed-cell spray foam' },
];

export const EXISTING_OPTIONS: { value: ExistingR; label: string }[] = [
  { value: 'none', label: 'None / nothing in attic' },
  { value: 'low_r11', label: 'Low (R-11, ~3 inches)' },
  { value: 'medium_r19_30', label: 'Medium (R-19 to R-30)' },
  { value: 'high_r38plus', label: 'High (R-38 or more)' },
];

const add = (a: CostBand3, b: CostBand3): CostBand3 => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand3, m: number): CostBand3 => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// Per-sqft pricing for attic insulation by material type, 2026 contractor rates.
// Sources: 2024 NAIMA contractor pricing surveys, Energy Star Home Performance with ENERGY STAR contractor data,
// HomeAdvisor + Modernize 2024-2025 marketplace data, Building Science Corp. retrofit cost guides.
const ATTIC_PER_SQFT: Record<AtticType, CostBand3> = {
  blown_cellulose:  { low: 1.50, mid: 2.00, high: 2.50 },    // R-49 typical depth
  blown_fiberglass: { low: 1.25, mid: 1.75, high: 2.25 },    // R-49 typical depth
  open_foam:        { low: 3.50, mid: 4.50, high: 6.00 },    // R-30 open-cell, ~10 inches
  closed_foam:      { low: 4.50, mid: 6.00, high: 8.50 },    // R-38 closed-cell, ~6 inches
};

// Wall drill-and-fill (cellulose or fiberglass) — square feet of exterior wall surface
const WALL_PER_SQFT: CostBand3 = { low: 2.00, mid: 3.00, high: 4.50 };

// Air sealing (blower door diagnostic + sealing) — flat job cost range
const AIR_SEAL: CostBand3 = { low: 600, mid: 1200, high: 2200 };

// Rim joist + crawl space encapsulation (basement/crawl improvement)
const CRAWL: CostBand3 = { low: 3500, mid: 7500, high: 14000 };

// Target R-values by IECC climate zone (DOE / 2021 IECC residential)
// https://www.energy.gov/energysaver/types-insulation
export function targetR(state: string): { attic: number; wall: number } {
  const zone = findClimate(state)?.iecc_zone ?? '4A';
  const head = zone[0];
  switch (head) {
    case '1': return { attic: 30, wall: 13 };
    case '2': return { attic: 49, wall: 13 };
    case '3': return { attic: 49, wall: 15 };
    case '4': return { attic: 60, wall: 15 };
    case '5': return { attic: 60, wall: 20 };
    case '6': return { attic: 60, wall: 20 };
    case '7': return { attic: 60, wall: 21 };
    case '8': return { attic: 60, wall: 21 };
    default:  return { attic: 49, wall: 15 };
  }
}

// Heating + cooling savings estimate (very rough)
// Per Building Science Corp / RECS analysis, attic upgrade from R-11 to R-49 typically cuts
// HVAC energy 8-15%. Wall fill 5-10%. Air-sealing 5-15%.
function annualSavingsPct(scope: Scope, existing: ExistingR): number {
  const atticGain = existing === 'none' ? 0.15
    : existing === 'low_r11' ? 0.12
    : existing === 'medium_r19_30' ? 0.05
    : 0.02;
  switch (scope) {
    case 'attic_only': return atticGain;
    case 'walls_only': return 0.07;
    case 'attic_walls': return atticGain + 0.05;
    case 'attic_walls_air': return atticGain + 0.05 + 0.07;
    case 'whole_envelope': return atticGain + 0.05 + 0.07 + 0.04;
  }
}

// Typical annual heating + cooling cost per sqft (very rough, from EIA RECS 2020)
// $1.20/sqft/yr in cold climates, $0.75 in mild, $0.90 average
function annualHvacCostPerSqft(state: string, sqft: number): number {
  const zone = findClimate(state)?.iecc_zone ?? '4A';
  const head = zone[0];
  const perSqft = head === '5' || head === '6' || head === '7' || head === '8' ? 1.20
    : head === '4' ? 1.00
    : head === '3' ? 0.85
    : 0.70;
  return perSqft * sqft;
}

// HOMES rebate (DOE Home Energy Rebates) per modeled savings tier
// Up to $4,000 moderate-income / $8,000 low-income for 35%+ modeled savings
function homesRebateEstimate(state: string, income: Income, savingsPct: number): CostBand3 {
  const status = findHomeEnergyRebateStatus(state)?.status;
  if (status !== 'open') return { low: 0, mid: 0, high: 0 };
  if (income === 'high' || income === 'unknown') {
    // HOMES has a market-rate tier (non-income-qualified) for 35%+ modeled savings: up to $2,000–$4,000
    if (savingsPct >= 0.20) return { low: 1000, mid: 2000, high: 4000 };
    return { low: 0, mid: 0, high: 0 };
  }
  if (income === 'moderate') {
    if (savingsPct >= 0.35) return { low: 2000, mid: 4000, high: 4000 };
    if (savingsPct >= 0.20) return { low: 1000, mid: 2000, high: 2000 };
  }
  if (income === 'low') {
    if (savingsPct >= 0.35) return { low: 4000, mid: 8000, high: 8000 };
    if (savingsPct >= 0.20) return { low: 2000, mid: 4000, high: 4000 };
  }
  return { low: 0, mid: 0, high: 0 };
}

export interface InsulationResult extends CalcComputeOutput {
  atticCost: CostBand3;
  wallCost: CostBand3;
  airSealCost: CostBand3;
  crawlCost: CostBand3;
  savingsPct: number;
  annualHvac: number;
  annualSavings: number;
  paybackYears: number | null;
  homes: CostBand3;
  net: CostBand3;
}

export function compute(inputs: InsulationInputs, opts?: ComputeOpts): InsulationResult {
  const { state, sqft, scope, atticType, existing, income } = inputs;
  const atticArea = sqft;                  // assume single-story footprint = attic area
  const wallArea = sqft * 1.2;             // rough: exterior wall surface ≈ 1.2× footprint
  const laborMult = opts?.laborMult
    ?? (findStateLabor(state)?.electrician_multiplier ?? 1.0);  // proxy for general trades

  const atticPer = ATTIC_PER_SQFT[atticType];
  const atticCost: CostBand3 = scale(atticPer, atticArea * laborMult);
  const wallCost: CostBand3 = scale(WALL_PER_SQFT, wallArea * laborMult);
  const airSealCost = scale(AIR_SEAL, laborMult);
  const crawlCost = scale(CRAWL, laborMult);

  let gross: CostBand3 = { low: 0, mid: 0, high: 0 };
  if (scope === 'attic_only') gross = atticCost;
  else if (scope === 'walls_only') gross = wallCost;
  else if (scope === 'attic_walls') gross = add(atticCost, wallCost);
  else if (scope === 'attic_walls_air') gross = add(add(atticCost, wallCost), airSealCost);
  else if (scope === 'whole_envelope') gross = add(add(add(atticCost, wallCost), airSealCost), crawlCost);

  const savingsPct = annualSavingsPct(scope, existing);
  const annualHvac = annualHvacCostPerSqft(state, sqft);
  const annualSavings = annualHvac * savingsPct;
  const paybackYears = annualSavings > 0 ? Math.round((gross.mid / annualSavings) * 10) / 10 : null;

  // HEEHRA / HOMES rebate
  const homes = homesRebateEstimate(state, income, savingsPct);
  const net: CostBand3 = {
    low: Math.max(0, gross.low - homes.low),
    mid: Math.max(0, gross.mid - homes.mid),
    high: Math.max(0, gross.high - homes.high),
  };

  return {
    gross, atticCost, wallCost, airSealCost, crawlCost,
    savingsPct, annualHvac, annualSavings, paybackYears, homes, net,
    brk: {},   // installed per-sqft pricing — no honest materials/labor split
    scope: `${SCOPE_OPTIONS.find(o => o.value === scope)?.label.replace(/\s*\(.*\)$/, '') ?? scope} · ${sqft.toLocaleString('en-US')} sqft`,
    attrs: [['Attic material', ATTIC_OPTIONS.find(o => o.value === atticType)?.label ?? '']],
  };
}

export const TIER_INPUTS: TierInputs<InsulationInputs> = {
  small:   { state: 'US', sqft: 1500, scope: 'attic_only', atticType: 'blown_cellulose', existing: 'low_r11', income: 'unknown' },
  typical: { state: 'US', sqft: 1800, scope: 'attic_walls_air', atticType: 'blown_cellulose', existing: 'low_r11', income: 'unknown' },
  large:   { state: 'US', sqft: 2400, scope: 'whole_envelope', atticType: 'blown_cellulose', existing: 'low_r11', income: 'unknown' },
};

export const TIER_LABELS: TierLabels = {
  small: 'attic only',
  typical: 'attic + walls + air-seal',
  large: 'whole envelope',
};

export const COST_MIX: CostMix = { material: 0.27, labor: 0.60, equipment: 0.13 };
