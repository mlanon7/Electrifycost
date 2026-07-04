/*
 * Home energy audit calculator — pure compute. Extracted verbatim from
 * src/components/EnergyAuditCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostBand3, CostMix, TierInputs, TierLabels } from './types';

export type Tier = 'walkthrough' | 'standard' | 'hers' | 'rater_full';
export type Utility = 'yes_free' | 'yes_subsidized' | 'no';

export interface EnergyAuditInputs {
  state: string;
  tier: Tier;
  utility: Utility;
}

export const TIER_OPTIONS: { value: Tier; label: string }[] = [
  { value: 'walkthrough', label: 'Walkthrough (visual only — least useful)' },
  { value: 'standard', label: 'Standard BPI (blower door + IR camera + recommendations)' },
  { value: 'hers', label: 'HERS Index rating (RESNET certified)' },
  { value: 'rater_full', label: 'HERS + Duct Blaster + Combustion Safety (full)' },
];

export const UTILITY_OPTIONS: { value: Utility; label: string }[] = [
  { value: 'yes_free', label: 'Yes — fully free (Mass Save, ConEd, similar)' },
  { value: 'yes_subsidized', label: 'Yes — partially subsidized (50% typical)' },
  { value: 'no', label: 'No — pay full price' },
];

const scale = (b: CostBand3, m: number): CostBand3 => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

const BASE: Record<Tier, CostBand3> = {
  walkthrough:  { low: 100, mid: 200, high: 350 },        // visual + clamp ammeter
  standard:     { low: 250, mid: 425, high: 650 },        // BPI Building Analyst, blower door, IR camera
  hers:         { low: 450, mid: 650, high: 900 },        // RESNET HERS rater
  rater_full:   { low: 600, mid: 900, high: 1400 },       // HERS + duct blaster + combustion safety + report
};

const UTILITY_DISCOUNT: Record<Utility, number> = {
  yes_free: 0,                  // utility-sponsored = free
  yes_subsidized: 0.4,
  no: 1.0,
};

export interface EnergyAuditResult extends CalcComputeOutput {
  base: CostBand3;
  net: CostBand3;
}

export function compute(inputs: EnergyAuditInputs, opts?: ComputeOpts): EnergyAuditResult {
  const { state, tier, utility } = inputs;
  const m = opts?.laborMult ?? (findStateLabor(state)?.electrician_multiplier ?? 1.0);
  const subsidy = UTILITY_DISCOUNT[utility];
  const base = scale(BASE[tier], m);
  const net: CostBand3 = { low: base.low * subsidy, mid: base.mid * subsidy, high: base.high * subsidy };
  return {
    base, net,
    gross: base,   // market price, before any utility sponsorship
    brk: {},       // flat-fee diagnostic service — no honest materials/labor split
    scope: `${TIER_OPTIONS.find(o => o.value === tier)?.label.replace(/\s*\(.*\)$/, '') ?? tier} audit`,
    attrs: [['Audit tier', TIER_OPTIONS.find(o => o.value === tier)?.label ?? '']],
  };
}

export const TIER_INPUTS: TierInputs<EnergyAuditInputs> = {
  small:   { state: 'US', tier: 'walkthrough', utility: 'yes_subsidized' },
  typical: { state: 'US', tier: 'standard', utility: 'yes_subsidized' },
  large:   { state: 'US', tier: 'rater_full', utility: 'yes_subsidized' },
};

export const TIER_LABELS: TierLabels = {
  small: 'basic',
  typical: 'blower-door + IR',
  large: 'comprehensive',
};

export const COST_MIX: CostMix = { material: 0.10, labor: 0.88, equipment: 0.02 };
