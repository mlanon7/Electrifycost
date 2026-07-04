/*
 * Shared contract for the extracted bespoke-calculator compute modules
 * (src/lib/calcs/<slug>.ts). Each module owns the pure math that its React
 * island previously computed inline, so the SAME code path serves:
 *   1. the calculator island (useMemo -> compute(inputs)),
 *   2. the headless band generator (scripts/build-scenario-bands.cjs) that
 *      writes the Project Simulator's published tier table, and
 *   3. (later, deferred) a two-level line-item Monte Carlo.
 *
 * Every module exports:
 *   - <X>Inputs           — the calculator's logical inputs
 *   - compute(inputs, opts?) — pure; no DOM, no localStorage, no Date
 *   - TIER_INPUTS          — small/typical/large preset input configs; the
 *                            generator runs compute() on these at national
 *                            labor (opts.laborMult = 1) to emit the published
 *                            simulator bands, so bands can never drift
 *   - TIER_LABELS          — short human labels for those tiers
 *   - COST_MIX             — material/labor/equipment weighting used by the
 *                            simulator's regional index (curated prior)
 */

export interface CostBand3 { low: number; mid: number; high: number }

export type BrkKey = 'm' | 'l' | 'e' | 'p' | 'k';

export interface CalcComputeOutput {
  /** Gross installed-cost band, before incentives. */
  gross: CostBand3;
  /** Category cost breakdown [low, high] where the calc can genuinely split
   *  (m=materials, l=labor, e=equipment rental, p=permits, k=other). Empty
   *  object when the calc prices whole-job lines it cannot decompose. */
  brk: Partial<Record<BrkKey, [number, number]>>;
  /** Human scope sentence for the estimate-snapshot spec line. */
  scope: string;
  /** Labeled select choices (material/system/finish) for the spec line. */
  attrs: [string, string][];
}

export interface ComputeOpts {
  /** Override the state-labor lookup with an explicit multiplier
   *  (1 = national average). Used by the band generator and tests. */
  laborMult?: number;
}

export interface TierInputs<I> { small: I; typical: I; large: I }
export type TierLabels = { small: string; typical: string; large: string };
export interface CostMix { material: number; labor: number; equipment: number }
