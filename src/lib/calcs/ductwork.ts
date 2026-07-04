/*
 * Ductwork calculator — pure compute. Extracted verbatim from
 * src/components/DuctworkCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Scope = 'seal_insulate' | 'partial_replace' | 'full_replace' | 'new_install';
export type Material = 'flex' | 'sheet_metal' | 'fiber_board';
export type Stories = '1' | '2' | '3';
export type Access = 'easy' | 'normal' | 'hard';
export type Aeroseal = 'yes' | 'no';

export interface DuctworkInputs {
  state: string;
  sqft: number;
  scope: Scope;
  material: Material;
  stories: Stories;
  access: Access;
  aeroseal: Aeroseal;
}

export const SCOPE_OPTIONS: { value: Scope; label: string }[] = [
  { value: 'seal_insulate', label: 'Seal + insulate existing (cheapest)' },
  { value: 'partial_replace', label: 'Partial replace (failing sections)' },
  { value: 'full_replace', label: 'Full replace (existing duct chases reused)' },
  { value: 'new_install', label: 'New install (no existing ducts)' },
];

export const MATERIAL_OPTIONS: { value: Material; label: string }[] = [
  { value: 'flex', label: 'Insulated flex (cheapest, most common)' },
  { value: 'sheet_metal', label: 'Sheet metal (premium, longest life)' },
  { value: 'fiber_board', label: 'Fiberglass duct board (insulated rigid)' },
];

export const STORIES_OPTIONS: { value: Stories; label: string }[] = [
  { value: '1', label: '1 story' },
  { value: '2', label: '2 stories' },
  { value: '3', label: '3+ stories' },
];

export const ACCESS_OPTIONS: { value: Access; label: string }[] = [
  { value: 'easy', label: 'Easy (unfinished basement / open attic)' },
  { value: 'normal', label: 'Normal (typical crawl space / partial attic)' },
  { value: 'hard', label: 'Hard (finished ceilings / tight crawl / chase work)' },
];

export const AEROSEAL_OPTIONS: { value: Aeroseal; label: string }[] = [
  { value: 'no', label: 'No' },
  { value: 'yes', label: 'Yes (+$1,500–$3,200 — seals leaks from inside)' },
];

const scale = (b: CostBand3, m: number): CostBand3 => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// Per-sqft pricing 2026. Sources: ACCA contractor surveys, Aeroseal proprietary network data,
// Home Advisor / Modernize 2024-2025 ductwork pricing reports, Energy Vanguard estimates.
const COST_PER_SQFT: Record<Scope, Record<Material, CostBand3>> = {
  seal_insulate: {
    flex:        { low: 0.80, mid: 1.30, high: 2.00 },
    sheet_metal: { low: 0.80, mid: 1.30, high: 2.00 },
    fiber_board: { low: 0.80, mid: 1.30, high: 2.00 },
  },
  partial_replace: {
    flex:        { low: 1.80, mid: 2.80, high: 4.20 },
    sheet_metal: { low: 2.50, mid: 3.80, high: 5.50 },
    fiber_board: { low: 2.00, mid: 3.00, high: 4.50 },
  },
  full_replace: {
    flex:        { low: 3.50, mid: 5.50, high: 8.00 },
    sheet_metal: { low: 5.00, mid: 7.50, high: 11.00 },
    fiber_board: { low: 3.80, mid: 6.00, high: 9.00 },
  },
  new_install: {
    flex:        { low: 4.50, mid: 6.50, high: 9.00 },
    sheet_metal: { low: 6.00, mid: 9.00, high: 13.00 },
    fiber_board: { low: 5.00, mid: 7.00, high: 10.00 },
  },
};

const STORY_MULT: Record<Stories, number> = { '1': 1.0, '2': 1.15, '3': 1.35 };
const ACCESS_MULT: Record<Access, number> = { easy: 0.95, normal: 1.0, hard: 1.25 };

const AEROSEAL: CostBand3 = { low: 1500, mid: 2200, high: 3200 };  // Aeroseal injection sealing addon

export interface DuctworkResult extends CalcComputeOutput {
  total: CostBand3;
  aeroCost: CostBand3;
}

export function compute(inputs: DuctworkInputs, opts?: ComputeOpts): DuctworkResult {
  const { state, sqft, scope, material, stories, access, aeroseal } = inputs;
  const hvacMult = opts?.laborMult
    ?? (findStateLabor(state)?.hvac_multiplier ?? 1.0);
  const base = COST_PER_SQFT[scope][material];
  const sm = STORY_MULT[stories];
  const am = ACCESS_MULT[access];
  const total: CostBand3 = scale(base, sqft * hvacMult * sm * am);
  const aeroCost = aeroseal === 'yes' ? scale(AEROSEAL, hvacMult) : { low: 0, mid: 0, high: 0 };
  const gross: CostBand3 = { low: total.low + aeroCost.low, mid: total.mid + aeroCost.mid, high: total.high + aeroCost.high };

  return {
    total, aeroCost, gross,
    brk: {},   // per-sqft installed pricing — no honest materials/labor split
    scope: `${SCOPE_OPTIONS.find(o => o.value === scope)?.label.replace(/\s*\(.*\)$/, '') ?? scope} · ${sqft.toLocaleString('en-US')} sqft`,
    attrs: [['Duct material', MATERIAL_OPTIONS.find(o => o.value === material)?.label ?? '']],
  };
}

export const TIER_INPUTS: TierInputs<DuctworkInputs> = {
  small:   { state: 'US', sqft: 1800, scope: 'seal_insulate', material: 'flex', stories: '2', access: 'normal', aeroseal: 'no' },
  typical: { state: 'US', sqft: 1800, scope: 'partial_replace', material: 'flex', stories: '2', access: 'normal', aeroseal: 'no' },
  large:   { state: 'US', sqft: 1800, scope: 'full_replace', material: 'flex', stories: '2', access: 'normal', aeroseal: 'no' },
};

export const TIER_LABELS: TierLabels = {
  small: 'repair / seal',
  typical: 'partial replace',
  large: 'whole-home replace',
};

export const COST_MIX: CostMix = { material: 0.40, labor: 0.56, equipment: 0.04 };
