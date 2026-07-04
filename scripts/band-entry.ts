/*
 * band-entry.ts — the band generator's bundle entry. esbuild bundles this
 * (with a ?raw loader for the CSVs) and scripts/build-scenario-bands.cjs
 * executes it under Node, so the bands in src/data/scenario-projects.json are
 * produced by the SAME compute functions the calculator islands run — never
 * hand-typed. Each tier is computed at national labor (laborMult /
 * stateLaborOverride = 1); the simulator re-applies regional pricing at
 * runtime via each project's cost mix.
 */
import { FLAGSHIP_TIERS, flagshipBand } from '@/lib/calcs/flagship-tiers';
import type { CostMix, TierLabels } from '@/lib/calcs/types';

import * as miniSplit from '@/lib/calcs/mini-split';
import * as geothermal from '@/lib/calcs/geothermal';
import * as acReplacement from '@/lib/calcs/ac-replacement';
import * as gasFurnace from '@/lib/calcs/gas-furnace';
import * as boiler from '@/lib/calcs/boiler';
import * as ductwork from '@/lib/calcs/ductwork';
import * as smartThermostat from '@/lib/calcs/smart-thermostat';
import * as solar from '@/lib/calcs/solar';
import * as offGridSolar from '@/lib/calcs/off-grid-solar';
import * as homeBattery from '@/lib/calcs/home-battery';
import * as generator from '@/lib/calcs/generator';
import * as smartPanel from '@/lib/calcs/smart-panel';
import * as sumpPump from '@/lib/calcs/sump-pump';
import * as tankWaterHeater from '@/lib/calcs/tank-water-heater';
import * as tanklessWaterHeater from '@/lib/calcs/tankless-water-heater';
import * as hotWaterRecirculation from '@/lib/calcs/hot-water-recirculation';
import * as waterTreatment from '@/lib/calcs/water-treatment';
import * as poolHeatPump from '@/lib/calcs/pool-heat-pump';
import * as hotTubHeatPump from '@/lib/calcs/hot-tub-heat-pump';
import * as insulation from '@/lib/calcs/insulation';
import * as airSealing from '@/lib/calcs/air-sealing';
import * as windowReplacement from '@/lib/calcs/window-replacement';
import * as doorReplacement from '@/lib/calcs/door-replacement';
import * as roofReplacement from '@/lib/calcs/roof-replacement';
import * as homeEnergyAudit from '@/lib/calcs/home-energy-audit';
import * as heatPumpDryer from '@/lib/calcs/heat-pump-dryer';
import * as woodPelletStove from '@/lib/calcs/wood-pellet-stove';

type TierName = 'small' | 'typical' | 'large';
const TIER_NAMES: TierName[] = ['small', 'typical', 'large'];

interface BespokeModule {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  compute(inputs: any, opts?: { laborMult?: number }): { gross: { low: number; mid: number; high: number } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TIER_INPUTS: Record<TierName, any>;
  TIER_LABELS: TierLabels;
  COST_MIX: CostMix;
}

interface RegistryRow {
  slug: string;
  label: string;
  category: string;
  categoryLabel: string;
  calcUrl: string;
  mod?: BespokeModule;   // absent = flagship (shared engine via flagship-tiers)
}

// Catalog order is load-bearing: the simulator groups categories in
// first-seen order. Keep it identical to the previous hand-curated file.
const REGISTRY: RegistryRow[] = [
  { slug: 'heat-pump', label: 'Heat pump (central)', category: 'hvac', categoryLabel: 'HVAC & heating', calcUrl: '/heat-pump-cost-calculator/' },
  { slug: 'mini-split', label: 'Mini-split / ductless', category: 'hvac', categoryLabel: 'HVAC & heating', calcUrl: '/mini-split-heat-pump-cost-calculator/', mod: miniSplit },
  { slug: 'geothermal', label: 'Geothermal heat pump', category: 'hvac', categoryLabel: 'HVAC & heating', calcUrl: '/geothermal-heat-pump-cost-calculator/', mod: geothermal },
  { slug: 'ac-replacement', label: 'AC replacement', category: 'hvac', categoryLabel: 'HVAC & heating', calcUrl: '/ac-replacement-cost-calculator/', mod: acReplacement },
  { slug: 'gas-furnace', label: 'Gas furnace replacement', category: 'hvac', categoryLabel: 'HVAC & heating', calcUrl: '/gas-furnace-replacement-cost-calculator/', mod: gasFurnace },
  { slug: 'boiler', label: 'Boiler replacement', category: 'hvac', categoryLabel: 'HVAC & heating', calcUrl: '/boiler-replacement-cost-calculator/', mod: boiler },
  { slug: 'ductwork', label: 'Ductwork install', category: 'hvac', categoryLabel: 'HVAC & heating', calcUrl: '/ductwork-installation-cost-calculator/', mod: ductwork },
  { slug: 'smart-thermostat', label: 'Smart thermostat', category: 'hvac', categoryLabel: 'HVAC & heating', calcUrl: '/smart-thermostat-cost-calculator/', mod: smartThermostat },

  { slug: 'solar', label: 'Solar panels', category: 'solar', categoryLabel: 'Solar & power', calcUrl: '/solar-panel-cost-calculator/', mod: solar },
  { slug: 'off-grid-solar', label: 'Off-grid solar system', category: 'solar', categoryLabel: 'Solar & power', calcUrl: '/off-grid-solar-cost-calculator/', mod: offGridSolar },
  { slug: 'home-battery', label: 'Home battery', category: 'solar', categoryLabel: 'Solar & power', calcUrl: '/home-battery-cost-calculator/', mod: homeBattery },
  { slug: 'generator', label: 'Generator backup', category: 'solar', categoryLabel: 'Solar & power', calcUrl: '/generator-cost-calculator/', mod: generator },
  { slug: 'electrical-panel', label: 'Electrical panel upgrade', category: 'solar', categoryLabel: 'Solar & power', calcUrl: '/electrical-panel-upgrade-cost-calculator/' },
  { slug: 'smart-panel', label: 'Smart electrical panel', category: 'solar', categoryLabel: 'Solar & power', calcUrl: '/smart-panel-cost-calculator/', mod: smartPanel },
  { slug: 'sump-pump', label: 'Sump pump + battery backup', category: 'solar', categoryLabel: 'Solar & power', calcUrl: '/sump-pump-cost-calculator/', mod: sumpPump },

  { slug: 'ev-charger', label: 'EV charger install', category: 'ev', categoryLabel: 'EV charging', calcUrl: '/ev-charger-installation-cost-calculator/' },

  { slug: 'tank-water-heater', label: 'Tank water heater', category: 'water', categoryLabel: 'Water heating', calcUrl: '/tank-water-heater-cost-calculator/', mod: tankWaterHeater },
  { slug: 'heat-pump-water-heater', label: 'Heat pump water heater', category: 'water', categoryLabel: 'Water heating', calcUrl: '/heat-pump-water-heater-cost-calculator/' },
  { slug: 'tankless-water-heater', label: 'Tankless water heater', category: 'water', categoryLabel: 'Water heating', calcUrl: '/tankless-water-heater-cost-calculator/', mod: tanklessWaterHeater },
  { slug: 'hot-water-recirculation', label: 'Hot water recirculation pump', category: 'water', categoryLabel: 'Water heating', calcUrl: '/hot-water-recirculation-cost-calculator/', mod: hotWaterRecirculation },
  { slug: 'water-treatment', label: 'Water softener + filtration', category: 'water', categoryLabel: 'Water heating', calcUrl: '/water-treatment-cost-calculator/', mod: waterTreatment },
  { slug: 'pool-heat-pump', label: 'Pool heat pump', category: 'water', categoryLabel: 'Water heating', calcUrl: '/pool-heat-pump-cost-calculator/', mod: poolHeatPump },
  { slug: 'hot-tub-heat-pump', label: 'Hot tub heat pump', category: 'water', categoryLabel: 'Water heating', calcUrl: '/hot-tub-heat-pump-cost-calculator/', mod: hotTubHeatPump },

  { slug: 'insulation', label: 'Insulation', category: 'improvements', categoryLabel: 'Home improvements', calcUrl: '/insulation-cost-calculator/', mod: insulation },
  { slug: 'air-sealing', label: 'Air sealing', category: 'improvements', categoryLabel: 'Home improvements', calcUrl: '/air-sealing-cost-calculator/', mod: airSealing },
  { slug: 'window-replacement', label: 'Window replacement', category: 'improvements', categoryLabel: 'Home improvements', calcUrl: '/window-replacement-cost-calculator/', mod: windowReplacement },
  { slug: 'door-replacement', label: 'Door replacement', category: 'improvements', categoryLabel: 'Home improvements', calcUrl: '/door-replacement-cost-calculator/', mod: doorReplacement },
  { slug: 'roof-replacement', label: 'Roof replacement', category: 'improvements', categoryLabel: 'Home improvements', calcUrl: '/roof-replacement-cost-calculator/', mod: roofReplacement },
  { slug: 'home-energy-audit', label: 'Home energy audit', category: 'improvements', categoryLabel: 'Home improvements', calcUrl: '/home-energy-audit-cost-calculator/', mod: homeEnergyAudit },
  { slug: 'induction-stove', label: 'Induction stove', category: 'improvements', categoryLabel: 'Home improvements', calcUrl: '/induction-stove-cost-calculator/' },
  { slug: 'heat-pump-dryer', label: 'Heat pump dryer', category: 'improvements', categoryLabel: 'Home improvements', calcUrl: '/heat-pump-dryer-cost-calculator/', mod: heatPumpDryer },
  { slug: 'wood-pellet-stove', label: 'Wood / pellet stove', category: 'improvements', categoryLabel: 'Home improvements', calcUrl: '/wood-pellet-stove-cost-calculator/', mod: woodPelletStove },
];

export function buildScenarioData(): unknown {
  const projects = REGISTRY.map(row => {
    const tiers = TIER_NAMES.map(name => {
      let low: number, high: number, label: string;
      if (row.mod) {
        const g = row.mod.compute(row.mod.TIER_INPUTS[name], { laborMult: 1 }).gross;
        low = Math.round(g.low); high = Math.round(g.high);
        label = row.mod.TIER_LABELS[name];
      } else {
        const b = flagshipBand(row.slug, name);
        low = b.low; high = b.high;
        label = FLAGSHIP_TIERS[row.slug].labels[name];
      }
      if (!(Number.isFinite(low) && Number.isFinite(high) && low > 0 && high > low)) {
        throw new Error(`Bad band for ${row.slug}/${name}: ${low}-${high}`);
      }
      return { name, label, low, high };
    });
    const mix = row.mod ? row.mod.COST_MIX : FLAGSHIP_TIERS[row.slug].mix;
    return {
      slug: row.slug, label: row.label,
      category: row.category, categoryLabel: row.categoryLabel,
      calcUrl: row.calcUrl,
      mix: { material: mix.material, labor: mix.labor, equipment: mix.equipment },
      tiers,
    };
  });
  return {
    schemaVersion: '2',
    note: 'GENERATED by scripts/build-scenario-bands.cjs — do not hand-edit. Per-project installed-cost bands (national basis, before incentives) for the Project Simulator, computed by running each calculator’s real compute function on its TIER_INPUTS at national labor (laborMult 1). The simulator applies a state labor index to the labor share of each project’s cost mix at runtime. Regenerate: node scripts/build-scenario-bands.cjs',
    projectCount: projects.length,
    projects,
  };
}
