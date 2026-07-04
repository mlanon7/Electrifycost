/*
 * Roof replacement calculator — pure compute. Extracted verbatim from
 * src/components/RoofCalculator.tsx (2026-07-04) so the island, the
 * headless band generator, and tests all run the same math.
 */
import { findStateLabor } from '@/lib/data';
import type { CalcComputeOutput, ComputeOpts, CostMix, TierInputs, TierLabels } from './types';

export type Material = 'asphalt_3tab' | 'asphalt_architectural' | 'asphalt_premium' | 'metal_standing_seam' | 'metal_corrugated' | 'clay_tile' | 'concrete_tile' | 'slate' | 'synthetic_slate' | 'wood_shake' | 'flat_tpo' | 'flat_epdm';
export type Pitch = 'low' | 'medium' | 'steep' | 'extreme';
export type Stories = '1' | '2' | '3';

interface Band { low: number; mid: number; high: number; }

export interface RoofReplacementInputs {
  state: string;
  roofSqft: number;
  material: Material;
  pitch: Pitch;
  stories: Stories;
  needsTearoff: boolean;
  needsDeckRepair: boolean;
  needsGutters: boolean;
  solarPlanned: boolean;
}

export const MATERIAL_OPTIONS: { value: Material; label: string }[] = [
  { value: 'asphalt_3tab', label: '3-tab asphalt (cheapest)' },
  { value: 'asphalt_architectural', label: 'Architectural asphalt (most common)' },
  { value: 'asphalt_premium', label: 'Premium asphalt (50yr warranty)' },
  { value: 'metal_standing_seam', label: 'Standing-seam metal (best for solar)' },
  { value: 'metal_corrugated', label: 'Corrugated metal' },
  { value: 'clay_tile', label: 'Clay tile' },
  { value: 'concrete_tile', label: 'Concrete tile' },
  { value: 'slate', label: 'Natural slate (premium)' },
  { value: 'synthetic_slate', label: 'Synthetic slate composite' },
  { value: 'wood_shake', label: 'Wood shake' },
  { value: 'flat_tpo', label: 'Flat TPO membrane' },
  { value: 'flat_epdm', label: 'Flat EPDM rubber' },
];

export const PITCH_OPTIONS: { value: Pitch; label: string }[] = [
  { value: 'low', label: 'Low (≤4/12 — walkable)' },
  { value: 'medium', label: 'Medium (5/12-7/12)' },
  { value: 'steep', label: 'Steep (8/12-12/12)' },
  { value: 'extreme', label: 'Extreme (12/12+ — requires staging)' },
];

export const STORIES_OPTIONS: { value: Stories; label: string }[] = [
  { value: '1', label: '1 story' },
  { value: '2', label: '2 stories' },
  { value: '3', label: '3+ stories' },
];

const MAT: Record<Material, { perSqftLow: number; perSqftMid: number; perSqftHigh: number; lifespan: number; solarReady: number; label: string }> = {
  asphalt_3tab:           { perSqftLow: 3.50, perSqftMid: 5.00, perSqftHigh: 7.00, lifespan: 18, solarReady: 3, label: '3-tab asphalt shingle' },
  asphalt_architectural:  { perSqftLow: 4.50, perSqftMid: 7.00, perSqftHigh: 9.50, lifespan: 25, solarReady: 3, label: 'Architectural asphalt shingle' },
  asphalt_premium:        { perSqftLow: 7.00, perSqftMid: 9.50, perSqftHigh: 12.50, lifespan: 35, solarReady: 3, label: 'Premium architectural shingle' },
  metal_standing_seam:    { perSqftLow: 11.00, perSqftMid: 15.00, perSqftHigh: 21.00, lifespan: 50, solarReady: 2, label: 'Standing-seam metal' },
  metal_corrugated:       { perSqftLow: 7.50, perSqftMid: 10.00, perSqftHigh: 13.50, lifespan: 40, solarReady: 2, label: 'Corrugated metal' },
  clay_tile:              { perSqftLow: 11.00, perSqftMid: 16.00, perSqftHigh: 24.00, lifespan: 75, solarReady: 5, label: 'Clay tile' },
  concrete_tile:          { perSqftLow: 9.00, perSqftMid: 13.50, perSqftHigh: 18.00, lifespan: 50, solarReady: 4, label: 'Concrete tile' },
  slate:                  { perSqftLow: 18.00, perSqftMid: 25.00, perSqftHigh: 40.00, lifespan: 100, solarReady: 5, label: 'Natural slate' },
  synthetic_slate:        { perSqftLow: 9.00, perSqftMid: 12.50, perSqftHigh: 17.00, lifespan: 50, solarReady: 4, label: 'Synthetic slate composite' },
  wood_shake:             { perSqftLow: 8.50, perSqftMid: 12.00, perSqftHigh: 16.50, lifespan: 30, solarReady: 8, label: 'Wood shake' },
  flat_tpo:               { perSqftLow: 5.50, perSqftMid: 7.50, perSqftHigh: 10.00, lifespan: 25, solarReady: 2, label: 'Flat TPO membrane' },
  flat_epdm:              { perSqftLow: 5.00, perSqftMid: 7.00, perSqftHigh: 9.50, lifespan: 25, solarReady: 2, label: 'Flat EPDM rubber' },
};

const TEAR_OFF_PER_SQFT = 1.25; // average across materials
const PITCH_MULT: Record<Pitch, number> = { low: 0.9, medium: 1.0, steep: 1.25, extreme: 1.55 };
const STORIES_MULT: Record<Stories, number> = { '1': 1.0, '2': 1.10, '3': 1.25 };
const DECK_REPAIR_BAND: Band = { low: 0, mid: 800, high: 3500 };
const GUTTER_REPLACE: Band = { low: 800, mid: 1800, high: 3500 };

function scale(b: Band, m: number): Band {
  return { low: b.low * m, mid: b.mid * m, high: b.high * m };
}
function add(a: Band, b: Band): Band {
  return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high };
}

export interface RoofReplacementResult extends CalcComputeOutput {
  materialCost: Band;
  tearoffCost: Band;
  deckCost: Band;
  gutterCost: Band;
  solarPrepCost: Band;
  perSqft: number;
  lifespan: number;
  lifetimeCostPerYear: number;
  label: string;
  solarReady: number;
}

export function compute(inputs: RoofReplacementInputs, opts?: ComputeOpts): RoofReplacementResult {
  const { state, roofSqft, material, pitch, stories, needsTearoff, needsDeckRepair, needsGutters, solarPlanned } = inputs;
  const laborMult = opts?.laborMult
    ?? (findStateLabor(state)?.electrician_multiplier ?? 1.0); // proxy for trades
  const m = MAT[material];

  const baseBand: Band = {
    low: m.perSqftLow * roofSqft,
    mid: m.perSqftMid * roofSqft,
    high: m.perSqftHigh * roofSqft,
  };
  const pitchMult = PITCH_MULT[pitch];
  const storiesMult = STORIES_MULT[stories];
  let materialCost = scale(baseBand, laborMult * pitchMult * storiesMult);

  const tearoffCost: Band = needsTearoff
    ? scale({ low: TEAR_OFF_PER_SQFT * roofSqft * 0.9, mid: TEAR_OFF_PER_SQFT * roofSqft, high: TEAR_OFF_PER_SQFT * roofSqft * 1.2 }, laborMult)
    : { low: 0, mid: 0, high: 0 };
  const deckCost: Band = needsDeckRepair ? DECK_REPAIR_BAND : { low: 0, mid: 0, high: 0 };
  const gutterCost: Band = needsGutters ? GUTTER_REPLACE : { low: 0, mid: 0, high: 0 };
  const solarPrepCost: Band = solarPlanned ? { low: 200, mid: 500, high: 1200 } : { low: 0, mid: 0, high: 0 };

  const gross = add(add(add(add(materialCost, tearoffCost), deckCost), gutterCost), solarPrepCost);
  const perSqft = gross.mid / roofSqft;
  const lifespan = m.lifespan;
  const lifetimeCostPerYear = gross.mid / lifespan;

  return {
    gross, materialCost, tearoffCost, deckCost, gutterCost, solarPrepCost,
    perSqft, lifespan, lifetimeCostPerYear, label: m.label, solarReady: m.solarReady,
    brk: {},   // whole-job installed per-sqft pricing — no honest materials/labor split
    scope: `${roofSqft.toLocaleString('en-US')} sqft · ${needsTearoff ? 'tear-off' : 'overlay'}`,
    attrs: [
      ['Material', m.label],
      ['Pitch', PITCH_OPTIONS.find(o => o.value === pitch)?.label ?? pitch],
    ],
  };
}

export const TIER_INPUTS: TierInputs<RoofReplacementInputs> = {
  small:   { state: 'US', roofSqft: 1500, material: 'asphalt_architectural', pitch: 'medium', stories: '1', needsTearoff: true, needsDeckRepair: false, needsGutters: false, solarPlanned: false },
  typical: { state: 'US', roofSqft: 2000, material: 'asphalt_architectural', pitch: 'medium', stories: '2', needsTearoff: true, needsDeckRepair: false, needsGutters: false, solarPlanned: false },
  large:   { state: 'US', roofSqft: 2600, material: 'asphalt_premium', pitch: 'steep', stories: '1', needsTearoff: true, needsDeckRepair: false, needsGutters: false, solarPlanned: false },
};

export const TIER_LABELS: TierLabels = {
  small: 'ranch (1,500 sqft)',
  typical: '2,000 sqft architectural',
  large: 'complex / premium',
};

export const COST_MIX: CostMix = { material: 0.47, labor: 0.48, equipment: 0.05 };
