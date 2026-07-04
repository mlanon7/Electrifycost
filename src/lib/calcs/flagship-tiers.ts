/*
 * Flagship tier configs for the band generator. The 5 flagship calculators
 * (heat pump, EV charger, panel, HPWH, induction) compute through the shared
 * engine (src/lib/calc.ts); these are the small/typical/large preset CalcArgs
 * the generator runs at national labor (stateLaborOverride: 1) to emit their
 * published Project Simulator bands.
 *
 * Deliberate choices, mirroring what the hand-curated tiers meant:
 *  - panelSize '200A' everywhere: panel work is its OWN catalog project;
 *    baking a panel-risk adder into another project's band would double-count
 *    when a visitor plans both.
 *  - ductwork 'good' on heat pumps: ductwork install is its own project too.
 *  - state 'OH' is only a carrier for the CalcArgs shape — the labor override
 *    makes the band national, and gross never reads energy prices or climate.
 *  - induction typical/large pass the same 240V circuit adder the component
 *    passes; the optional gas-cap and cookware add-ons stay out of the
 *    published band (they are user options, not the base install).
 */
import { runCalculator, type CalcArgs } from '@/lib/calc';
import { findAddonBand } from '@/lib/data';
import type { CostBand3, CostMix, TierLabels } from './types';

type TierName = 'small' | 'typical' | 'large';

interface FlagshipSpec {
  mix: CostMix;
  labels: TierLabels;
  args: Record<TierName, () => CalcArgs>;
}

const BASE = {
  state: 'OH',
  zip: '',
  panelSize: '200A' as const,
  difficulty: 'average' as const,
  homeType: 'single_family' as const,
  timing: 'this_year' as const,
  income: 'unknown' as const,
  stateLaborOverride: 1,
};

export const FLAGSHIP_TIERS: Record<string, FlagshipSpec> = {
  'heat-pump': {
    mix: { material: 0.58, labor: 0.39, equipment: 0.03 },
    labels: { small: '3-ton ducted, simple install', typical: '3-ton ducted', large: 'cold-climate ducted' },
    args: {
      small: () => ({
        ...BASE, module: 'heat_pump', scenario: 'ducted_central_3ton', scenarioLabel: 'Ducted central heat pump (3-ton)',
        contractorChecklistKey: 'heat_pump', difficulty: 'simple', homeSqft: 1400, fuelHeating: 'natural_gas', ductwork: 'good',
      }),
      typical: () => ({
        ...BASE, module: 'heat_pump', scenario: 'ducted_central_3ton', scenarioLabel: 'Ducted central heat pump (3-ton)',
        contractorChecklistKey: 'heat_pump', homeSqft: 1800, fuelHeating: 'natural_gas', ductwork: 'good',
      }),
      large: () => ({
        ...BASE, module: 'heat_pump', scenario: 'coldclimate_ducted', scenarioLabel: 'Cold-climate ducted heat pump',
        contractorChecklistKey: 'heat_pump', homeSqft: 2600, fuelHeating: 'natural_gas', ductwork: 'good',
      }),
    },
  },
  'ev-charger': {
    mix: { material: 0.44, labor: 0.50, equipment: 0.06 },
    labels: { small: 'plug-in (NEMA 14-50)', typical: 'hardwired Level 2', large: 'detached garage / long run' },
    args: {
      small: () => ({
        ...BASE, module: 'ev_charger', scenario: 'level2_plugin_nema14_50', scenarioLabel: 'Level 2 plug-in via NEMA 14-50 outlet',
        contractorChecklistKey: 'ev_charger',
      }),
      typical: () => ({
        ...BASE, module: 'ev_charger', scenario: 'level2_hardwired', scenarioLabel: 'Level 2 hardwired (most common)',
        contractorChecklistKey: 'ev_charger',
      }),
      large: () => ({
        ...BASE, module: 'ev_charger', scenario: 'level2_detached_garage_trench', scenarioLabel: 'Detached garage with trenching',
        contractorChecklistKey: 'ev_charger',
      }),
    },
  },
  'electrical-panel': {
    mix: { material: 0.40, labor: 0.56, equipment: 0.04 },
    labels: { small: '150A to 200A', typical: '100A to 200A', large: '200A to 320/400A' },
    args: {
      small: () => ({
        ...BASE, module: 'panel', scenario: 'upgrade_150_to_200', scenarioLabel: '150A → 200A panel upgrade',
        contractorChecklistKey: 'panel', panelSize: '150A',
      }),
      typical: () => ({
        ...BASE, module: 'panel', scenario: 'upgrade_100_to_200', scenarioLabel: '100A → 200A panel upgrade',
        contractorChecklistKey: 'panel', panelSize: '100A',
      }),
      large: () => ({
        ...BASE, module: 'panel', scenario: 'upgrade_200_to_320', scenarioLabel: '200A → 320/400A service upgrade',
        contractorChecklistKey: 'panel',
      }),
    },
  },
  'heat-pump-water-heater': {
    mix: { material: 0.62, labor: 0.35, equipment: 0.03 },
    labels: { small: '120V 50-gal', typical: '240V hybrid 50-gal', large: 'split-system / 80-gal' },
    args: {
      small: () => ({
        ...BASE, module: 'hpwh', scenario: 'plugin_120v_50gal', scenarioLabel: '120V plug-in HPWH (50 gal)',
        contractorChecklistKey: 'hpwh', fuelWater: 'electric_resistance',
        removalAdder: findAddonBand('hpwh_removal_old_unit').mid,
      }),
      typical: () => ({
        ...BASE, module: 'hpwh', scenario: 'hybrid_240v_50gal', scenarioLabel: '240V hybrid HPWH (50 gal)',
        contractorChecklistKey: 'hpwh', fuelWater: 'natural_gas',
        removalAdder: findAddonBand('hpwh_removal_old_unit').mid,
      }),
      large: () => ({
        ...BASE, module: 'hpwh', scenario: 'split_system', scenarioLabel: 'Split-system HPWH (separate compressor)',
        contractorChecklistKey: 'hpwh', fuelWater: 'natural_gas',
        removalAdder: findAddonBand('hpwh_removal_old_unit').mid,
      }),
    },
  },
  'induction-stove': {
    mix: { material: 0.85, labor: 0.13, equipment: 0.02 },
    labels: { small: 'cooktop only', typical: '30-inch range + circuit', large: 'premium range + circuit' },
    args: {
      small: () => ({
        ...BASE, module: 'induction', scenario: 'cooktop_30in_plugin', scenarioLabel: 'Plug-in induction cooktop only',
        contractorChecklistKey: 'induction', fuelHeating: 'electric_resistance',
      }),
      typical: () => ({
        ...BASE, module: 'induction', scenario: 'range_30in_basic', scenarioLabel: '30-inch induction range (basic)',
        contractorChecklistKey: 'induction', fuelHeating: 'natural_gas',
        circuitAdder: bandOf('induction_240v_circuit'),
      }),
      large: () => ({
        ...BASE, module: 'induction', scenario: 'range_30in_premium', scenarioLabel: '30-inch induction range (premium / convection)',
        contractorChecklistKey: 'induction', fuelHeating: 'natural_gas',
        circuitAdder: bandOf('induction_240v_circuit'),
      }),
    },
  },
};

function bandOf(key: string): CostBand3 {
  const a = findAddonBand(key);
  return { low: a.low, mid: a.mid, high: a.high };
}

/** Gross installed band for one flagship tier at national labor. */
export function flagshipBand(slug: string, tier: TierName): { low: number; high: number } {
  const spec = FLAGSHIP_TIERS[slug];
  if (!spec) throw new Error('Unknown flagship slug: ' + slug);
  const r = runCalculator(spec.args[tier]());
  return { low: Math.round(r.gross.low), high: Math.round(r.gross.high) };
}
