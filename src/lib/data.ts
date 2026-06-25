// Data loaders. Every numeric/tabular table lives in /data/csv/ at the
// project root so a non-engineer can edit it in a spreadsheet (or sync it
// through Google Sheets) without touching code. CSV contents are read at
// build time via Vite's ?raw query (which uses Node fs under the hood) and
// parsed with a small in-house CSV reader. There are no duplicate copies of
// these numbers anywhere in the TS/JS source.

import projectCostRangesCsv from '../../data/csv/project-cost-ranges.csv?raw';
import stateLaborCsv from '../../data/csv/state-labor-multipliers.csv?raw';
import stateEnergyCsv from '../../data/csv/state-energy-prices.csv?raw';
import rebateProgramsCsv from '../../data/csv/rebate-programs.csv?raw';
import climateZonesCsv from '../../data/csv/climate-zones.csv?raw';
import panelRiskCsv from '../../data/csv/panel-upgrade-risk-rules.csv?raw';
import costMultipliersCsv from '../../data/csv/cost-multipliers.csv?raw';
import moduleLaborRatesCsv from '../../data/csv/module-labor-rates.csv?raw';
import panelRiskFactorsCsv from '../../data/csv/panel-risk-factors.csv?raw';
import addonsBandsCsv from '../../data/csv/addons-bands.csv?raw';
import operatingCostConstantsCsv from '../../data/csv/operating-cost-constants.csv?raw';
import homeEnergyRebateStatusCsv from '../../data/csv/home-energy-rebate-status.csv?raw';
import zipToStateCsv from '../../data/csv/zip-to-state.csv?raw';
import topCitiesCsv from '../../data/csv/top-cities.csv?raw';
import brandProfilesCsv from '../../data/csv/brand-profiles.csv?raw';

// Wave-2 calculator-specific CSV imports — loaded so build fails fast if a file is missing.
// Components can switch from hardcoded constants to these CSVs incrementally; the import here
// guarantees the data is shipped to the bundle and stays in sync with Vercel deploys.
import federalCreditsCsv from '../../data/csv/federal-credits.csv?raw';
import solarCostRangesCsv from '../../data/csv/solar-cost-ranges.csv?raw';
import solarProductionByStateCsv from '../../data/csv/solar-production-by-state.csv?raw';
import solarStateIncentivesCsv from '../../data/csv/solar-state-incentives.csv?raw';
import batteryCostRangesCsv from '../../data/csv/battery-cost-ranges.csv?raw';
import batteryStateIncentivesCsv from '../../data/csv/battery-state-incentives.csv?raw';
import acCostRangesCsv from '../../data/csv/ac-cost-ranges.csv?raw';
import insulationCostRangesCsv from '../../data/csv/insulation-cost-ranges.csv?raw';
import evTcoAssumptionsCsv from '../../data/csv/ev-tco-assumptions.csv?raw';
import evStateCreditsCsv from '../../data/csv/ev-state-credits.csv?raw';
import tanklessAssumptionsCsv from '../../data/csv/tankless-assumptions.csv?raw';
import generatorCostRangesCsv from '../../data/csv/generator-cost-ranges.csv?raw';
import thermostatAssumptionsCsv from '../../data/csv/thermostat-assumptions.csv?raw';
import miniSplitCostRangesCsv from '../../data/csv/mini-split-cost-ranges.csv?raw';
import geothermalCostRangesCsv from '../../data/csv/geothermal-cost-ranges.csv?raw';
import ductworkCostRangesCsv from '../../data/csv/ductwork-cost-ranges.csv?raw';
import windowCostRangesCsv from '../../data/csv/window-cost-ranges.csv?raw';
import poolHpCostRangesCsv from '../../data/csv/pool-hp-cost-ranges.csv?raw';
import energyAuditTiersCsv from '../../data/csv/energy-audit-tiers.csv?raw';

// P19 — Wave 19 calculator CSV imports.
import gasFurnaceCostRangesCsv from '../../data/csv/gas-furnace-cost-ranges.csv?raw';
import boilerCostRangesCsv from '../../data/csv/boiler-cost-ranges.csv?raw';
import roofCostRangesCsv from '../../data/csv/roof-cost-ranges.csv?raw';
import hvacRepairReplaceRulesCsv from '../../data/csv/hvac-repair-replace-rules.csv?raw';
import heatPumpDryerCostRangesCsv from '../../data/csv/heat-pump-dryer-cost-ranges.csv?raw';
import airSealingCostRangesCsv from '../../data/csv/air-sealing-cost-ranges.csv?raw';
import solarPaybackAssumptionsCsv from '../../data/csv/solar-payback-assumptions.csv?raw';

// P20 — Wave 20 calculator CSV imports.
import tankWaterHeaterCostRangesCsv from '../../data/csv/tank-water-heater-cost-ranges.csv?raw';
import evChargingCostAssumptionsCsv from '../../data/csv/ev-charging-cost-assumptions.csv?raw';
import smartPanelCostRangesCsv from '../../data/csv/smart-panel-cost-ranges.csv?raw';
import hotWaterRecirculationCostRangesCsv from '../../data/csv/hot-water-recirculation-cost-ranges.csv?raw';
import waterTreatmentCostRangesCsv from '../../data/csv/water-treatment-cost-ranges.csv?raw';
import sumpPumpCostRangesCsv from '../../data/csv/sump-pump-cost-ranges.csv?raw';
import doorReplacementCostRangesCsv from '../../data/csv/door-replacement-cost-ranges.csv?raw';
import woodPelletStoveCostRangesCsv from '../../data/csv/wood-pellet-stove-cost-ranges.csv?raw';
import offGridSolarCostRangesCsv from '../../data/csv/off-grid-solar-cost-ranges.csv?raw';
import hotTubHeatPumpCostRangesCsv from '../../data/csv/hot-tub-heat-pump-cost-ranges.csv?raw';

import contractorChecklists from '@/data/contractor-checklists.json';
import sourceNotes from '@/data/source-notes.json';

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return [];
  const headers = splitCsvLine(lines[0]);
  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h.trim()] = (cells[i] ?? '').trim();
    });
    return row;
  });
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export type Module = 'heat_pump' | 'ev_charger' | 'panel' | 'hpwh' | 'induction';

export interface CostRange {
  module: Module;
  scenario: string;
  unit: string;
  base_low: number; base_mid: number; base_high: number;
  material_low: number; material_mid: number; material_high: number;
  labor_hours_low: number; labor_hours_mid: number; labor_hours_high: number;
  permit_low: number; permit_mid: number; permit_high: number;
  notes: string; source_id: string; last_reviewed: string;
}

export interface StateLabor {
  state: string; state_name: string;
  electrician_multiplier: number; hvac_multiplier: number; plumber_multiplier: number;
  permit_avg: number; notes: string;
}

export interface StateEnergy {
  state: string; state_name: string;
  electricity_cents_per_kwh: number; natural_gas_dollars_per_therm: number;
  propane_dollars_per_gallon: number; heating_oil_dollars_per_gallon: number;
  source_id: string; last_reviewed: string; notes: string;
}

export type IncentiveType = 'tax_credit' | 'rebate';

export interface RebateProgram {
  program_id: string;
  scope: 'federal' | 'state' | 'utility';
  state: string; utility: string;
  module: Module | '';
  program_name: string; incentive_type: IncentiveType;
  amount_low: number; amount_mid: number; amount_high: number;
  percent: number; cap: number;
  income_rule: string; eligible_equipment: string;
  expiration_date: string; status: string;
  source_url: string; source_id: string; last_reviewed: string; notes: string;
}

export interface ClimateZone {
  state: string; state_name: string; iecc_zone: string;
  heating_degree_days: number; cooling_degree_days: number;
  heat_pump_class: 'standard' | 'coldclimate'; notes: string;
}

export interface PanelRiskRule {
  rule_id: string; trigger_module: string; current_panel: string;
  target_addition: string;
  risk_level: 'minimal' | 'low' | 'medium' | 'high' | 'critical';
  upgrade_recommendation: string; explanation: string;
}

export interface CostMultiplier {
  factor_type: 'difficulty' | 'home_type' | 'timing';
  factor_key: string;
  low: number; mid: number; high: number;
  notes: string;
}

export interface ModuleLaborRate {
  module: Module; hourly_rate_usd: number; notes: string;
}

export interface PanelRiskFactor {
  risk_level: PanelRiskRule['risk_level'];
  factor: number; low_spread: number; high_spread: number; notes: string;
}

export interface AddonBand {
  addon_id: string; module: Module;
  low: number; mid: number; high: number; notes: string;
}

export interface OperatingCostConstant {
  constant_id: string; value: number; units: string; notes: string;
}

export type HomeEnergyRebateStatus = 'open' | 'reserved' | 'closed' | 'prelaunch' | 'unknown';
export interface HomeEnergyRebateRow {
  state: string;
  program: string;
  status: HomeEnergyRebateStatus;
  administrator: string;
  source_url: string;
  source_id: string;
  last_reviewed: string;
  notes: string;
}

export type SourceCategory =
  | 'tax_credit' | 'rebate_program' | 'product_list' | 'guide'
  | 'research' | 'energy_data' | 'labor_data' | 'climate_data' | 'code';

export interface SourceNote {
  title: string; url: string; publisher: string; last_reviewed: string;
  category?: SourceCategory; notes?: string;
}

export interface ContractorChecklist { title: string; items: string[]; }

const numericFields = new Set([
  'base_low','base_mid','base_high',
  'material_low','material_mid','material_high',
  'labor_hours_low','labor_hours_mid','labor_hours_high',
  'permit_low','permit_mid','permit_high',
  'electrician_multiplier','hvac_multiplier','plumber_multiplier','permit_avg',
  'electricity_cents_per_kwh','natural_gas_dollars_per_therm',
  'propane_dollars_per_gallon','heating_oil_dollars_per_gallon',
  'amount_low','amount_mid','amount_high','percent','cap',
  'heating_degree_days','cooling_degree_days',
  'low','mid','high','hourly_rate_usd',
  'factor','low_spread','high_spread','value',
]);

function coerce<T>(rows: Record<string, string>[]): T[] {
  return rows.map(r => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r)) {
      if (numericFields.has(k)) {
        const n = parseFloat(v);
        out[k] = Number.isFinite(n) ? n : 0;
      } else {
        out[k] = v;
      }
    }
    return out as T;
  });
}

function requireRows<T>(rows: T[], name: string): T[] {
  if (!rows || rows.length === 0) {
    throw new Error(`[data] CSV table "${name}" loaded zero rows. Check data/csv/${name}.csv for missing headers or content.`);
  }
  return rows;
}

export const costRanges: CostRange[] =
  requireRows(coerce<CostRange>(parseCsv(projectCostRangesCsv)), 'project-cost-ranges');
export const stateLabor: StateLabor[] =
  requireRows(coerce<StateLabor>(parseCsv(stateLaborCsv)), 'state-labor-multipliers');
export const stateEnergy: StateEnergy[] =
  requireRows(coerce<StateEnergy>(parseCsv(stateEnergyCsv)), 'state-energy-prices');
export const rebatePrograms: RebateProgram[] =
  requireRows(coerce<RebateProgram>(parseCsv(rebateProgramsCsv)), 'rebate-programs');
export const climateZones: ClimateZone[] =
  requireRows(coerce<ClimateZone>(parseCsv(climateZonesCsv)), 'climate-zones');
export const panelRiskRules: PanelRiskRule[] =
  requireRows(coerce<PanelRiskRule>(parseCsv(panelRiskCsv)), 'panel-upgrade-risk-rules');
export const costMultipliers: CostMultiplier[] =
  requireRows(coerce<CostMultiplier>(parseCsv(costMultipliersCsv)), 'cost-multipliers');
export const moduleLaborRates: ModuleLaborRate[] =
  requireRows(coerce<ModuleLaborRate>(parseCsv(moduleLaborRatesCsv)), 'module-labor-rates');
export const panelRiskFactors: PanelRiskFactor[] =
  requireRows(coerce<PanelRiskFactor>(parseCsv(panelRiskFactorsCsv)), 'panel-risk-factors');
export const addonBands: AddonBand[] =
  requireRows(coerce<AddonBand>(parseCsv(addonsBandsCsv)), 'addons-bands');
export const operatingCostConstants: OperatingCostConstant[] =
  requireRows(coerce<OperatingCostConstant>(parseCsv(operatingCostConstantsCsv)), 'operating-cost-constants');
export const homeEnergyRebateStatus: HomeEnergyRebateRow[] =
  requireRows(coerce<HomeEnergyRebateRow>(parseCsv(homeEnergyRebateStatusCsv)), 'home-energy-rebate-status');

// Wave-2 calculator-specific tables. Generic Record<string, string>[] until components
// promote them to typed rows; the import + parse here guarantees the CSVs ship + load.
export const federalCredits = requireRows(parseCsv(federalCreditsCsv), 'federal-credits');
export const solarCostRanges = requireRows(parseCsv(solarCostRangesCsv), 'solar-cost-ranges');
export const solarProductionByState = requireRows(parseCsv(solarProductionByStateCsv), 'solar-production-by-state');
export const solarStateIncentives = requireRows(parseCsv(solarStateIncentivesCsv), 'solar-state-incentives');
export const batteryCostRanges = requireRows(parseCsv(batteryCostRangesCsv), 'battery-cost-ranges');
export const batteryStateIncentives = requireRows(parseCsv(batteryStateIncentivesCsv), 'battery-state-incentives');
export const acCostRanges = requireRows(parseCsv(acCostRangesCsv), 'ac-cost-ranges');
export const insulationCostRanges = requireRows(parseCsv(insulationCostRangesCsv), 'insulation-cost-ranges');
export const evTcoAssumptions = requireRows(parseCsv(evTcoAssumptionsCsv), 'ev-tco-assumptions');
export const evStateCredits = requireRows(parseCsv(evStateCreditsCsv), 'ev-state-credits');
export const tanklessAssumptions = requireRows(parseCsv(tanklessAssumptionsCsv), 'tankless-assumptions');
export const generatorCostRanges = requireRows(parseCsv(generatorCostRangesCsv), 'generator-cost-ranges');
export const thermostatAssumptions = requireRows(parseCsv(thermostatAssumptionsCsv), 'thermostat-assumptions');
export const miniSplitCostRanges = requireRows(parseCsv(miniSplitCostRangesCsv), 'mini-split-cost-ranges');
export const geothermalCostRanges = requireRows(parseCsv(geothermalCostRangesCsv), 'geothermal-cost-ranges');
export const ductworkCostRanges = requireRows(parseCsv(ductworkCostRangesCsv), 'ductwork-cost-ranges');
export const windowCostRanges = requireRows(parseCsv(windowCostRangesCsv), 'window-cost-ranges');
export const poolHpCostRanges = requireRows(parseCsv(poolHpCostRangesCsv), 'pool-hp-cost-ranges');
export const energyAuditTiers = requireRows(parseCsv(energyAuditTiersCsv), 'energy-audit-tiers');

// P19 — calculator CSV exports
export const gasFurnaceCostRanges = requireRows(parseCsv(gasFurnaceCostRangesCsv), 'gas-furnace-cost-ranges');
export const boilerCostRanges = requireRows(parseCsv(boilerCostRangesCsv), 'boiler-cost-ranges');
export const roofCostRanges = requireRows(parseCsv(roofCostRangesCsv), 'roof-cost-ranges');
export const hvacRepairReplaceRules = requireRows(parseCsv(hvacRepairReplaceRulesCsv), 'hvac-repair-replace-rules');
export const heatPumpDryerCostRanges = requireRows(parseCsv(heatPumpDryerCostRangesCsv), 'heat-pump-dryer-cost-ranges');
export const airSealingCostRanges = requireRows(parseCsv(airSealingCostRangesCsv), 'air-sealing-cost-ranges');
export const solarPaybackAssumptions = requireRows(parseCsv(solarPaybackAssumptionsCsv), 'solar-payback-assumptions');

// P20 calculator exports
export const tankWaterHeaterCostRanges = requireRows(parseCsv(tankWaterHeaterCostRangesCsv), 'tank-water-heater-cost-ranges');
export const evChargingCostAssumptions = requireRows(parseCsv(evChargingCostAssumptionsCsv), 'ev-charging-cost-assumptions');
export const smartPanelCostRanges = requireRows(parseCsv(smartPanelCostRangesCsv), 'smart-panel-cost-ranges');
export const hotWaterRecirculationCostRanges = requireRows(parseCsv(hotWaterRecirculationCostRangesCsv), 'hot-water-recirculation-cost-ranges');
export const waterTreatmentCostRanges = requireRows(parseCsv(waterTreatmentCostRangesCsv), 'water-treatment-cost-ranges');
export const sumpPumpCostRanges = requireRows(parseCsv(sumpPumpCostRangesCsv), 'sump-pump-cost-ranges');
export const doorReplacementCostRanges = requireRows(parseCsv(doorReplacementCostRangesCsv), 'door-replacement-cost-ranges');
export const woodPelletStoveCostRanges = requireRows(parseCsv(woodPelletStoveCostRangesCsv), 'wood-pellet-stove-cost-ranges');
export const offGridSolarCostRanges = requireRows(parseCsv(offGridSolarCostRangesCsv), 'off-grid-solar-cost-ranges');
export const hotTubHeatPumpCostRanges = requireRows(parseCsv(hotTubHeatPumpCostRangesCsv), 'hot-tub-heat-pump-cost-ranges');

// Federal credit lookup by code + category. Component layer can ask "is 25D active for 2026?"
// and get a single source of truth, instead of having dates hardcoded in 4 React files.
export function findFederalCredit(creditCode: string, category?: string) {
  return federalCredits.find(r => r.credit_code === creditCode && (!category || r.category === category));
}

export const checklists: Record<string, ContractorChecklist> =
  contractorChecklists as Record<string, ContractorChecklist>;
export const sources: Record<string, SourceNote> =
  sourceNotes as Record<string, SourceNote>;

/** Most-recent `last_reviewed` date across all source notes. Used as the
 * site-wide "data freshness" stamp surfaced in the page header and footer. */
export const siteLastReviewed: string = (() => {
  const dates = Object.values(sources)
    .map(s => s.last_reviewed)
    .filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (dates.length === 0) return '';
  return dates.sort().pop()!;
})();

export function findStateLabor(state: string): StateLabor | undefined {
  return stateLabor.find(s => s.state === state);
}
export function findStateEnergy(state: string): StateEnergy | undefined {
  return stateEnergy.find(s => s.state === state);
}
export function findClimate(state: string): ClimateZone | undefined {
  return climateZones.find(s => s.state === state);
}
export function getCostScenarios(module: Module): CostRange[] {
  return costRanges.filter(r => r.module === module);
}
export function findCostScenario(module: Module, scenario: string): CostRange | undefined {
  return costRanges.find(r => r.module === module && r.scenario === scenario);
}
export function getRebatesFor(module: Module, state: string): RebateProgram[] {
  return rebatePrograms.filter(r =>
    (r.module === module || r.module === '') &&
    (r.scope === 'federal' || r.state === state || r.state === 'US')
  );
}
export function getPanelRisk(module: string, panelSize: string): PanelRiskRule | undefined {
  return panelRiskRules.find(
    r => r.trigger_module === module && r.current_panel === panelSize
  );
}
export function findCostMultiplier(
  factorType: CostMultiplier['factor_type'],
  factorKey: string,
): CostMultiplier {
  const m = costMultipliers.find(
    r => r.factor_type === factorType && r.factor_key === factorKey,
  );
  if (!m) throw new Error(`[data] cost-multipliers.csv missing row for ${factorType}/${factorKey}`);
  return m;
}
export function findModuleLaborRate(module: Module): number {
  const row = moduleLaborRates.find(r => r.module === module);
  if (!row) throw new Error(`[data] module-labor-rates.csv missing row for module ${module}`);
  return row.hourly_rate_usd;
}
export function findPanelRiskFactor(level: PanelRiskRule['risk_level']): PanelRiskFactor {
  const row = panelRiskFactors.find(r => r.risk_level === level);
  if (!row) throw new Error(`[data] panel-risk-factors.csv missing row for risk_level ${level}`);
  return row;
}
export function findAddonBand(addonId: string): AddonBand {
  const row = addonBands.find(r => r.addon_id === addonId);
  if (!row) throw new Error(`[data] addons-bands.csv missing row for addon_id ${addonId}`);
  return row;
}
export function findOperatingCostConstant(constantId: string): number {
  const row = operatingCostConstants.find(r => r.constant_id === constantId);
  if (!row) throw new Error(`[data] operating-cost-constants.csv missing row for constant_id ${constantId}`);
  return row.value;
}

/**
 * Lookup the DOE Home Energy Rebates rollout status for a given state.
 * Returns undefined when the state isn't in the CSV; callers should treat
 * undefined as `unknown` and surface the program as a potential incentive.
 */
export function findHomeEnergyRebateStatus(state: string): HomeEnergyRebateRow | undefined {
  return homeEnergyRebateStatus.find(r => r.state === state);
}

export const ALL_STATES: { code: string; name: string }[] =
  stateLabor.map(s => ({ code: s.state, name: s.state_name }));

export interface ZipToStateRow {
  state: string;
  zip_low: number;
  zip_high: number;
  notes: string;
}

const zipToStateNumeric = new Set(['zip_low', 'zip_high']);
function coerceZip(rows: Record<string, string>[]): ZipToStateRow[] {
  return rows.map(r => ({
    state: r.state,
    zip_low: parseInt(r.zip_low, 10),
    zip_high: parseInt(r.zip_high, 10),
    notes: r.notes || '',
  })).filter(r => Number.isFinite(r.zip_low) && Number.isFinite(r.zip_high));
}

export const zipToState: ZipToStateRow[] =
  requireRows(coerceZip(parseCsv(zipToStateCsv)), 'zip-to-state');

void zipToStateNumeric;

// Top U.S. cities for city-level programmatic pages. Each city maps to a
// state code so the page reuses state-level labor multipliers, energy prices,
// and climate data (those datasets are state-keyed). City adds geo-specificity
// to title/H1/copy. See data/csv/top-cities.csv.
export interface CityRow {
  slug: string;
  city: string;
  state: string;
  rank: number;
}
export const ALL_CITIES: CityRow[] =
  requireRows(parseCsv(topCitiesCsv), 'top-cities').map(r => ({
    slug: r.slug,
    city: r.city,
    state: r.state,
    rank: parseInt(r.rank, 10) || 0,
  }));

/** Look up a city row by its slug (e.g. 'houston-tx'). */
export function findCity(slug: string): CityRow | undefined {
  return ALL_CITIES.find(c => c.slug === slug);
}

/** Full state name for a 2-letter code, or the code itself if unknown. */
export function stateName(code: string): string {
  return ALL_STATES.find(s => s.code === code)?.name ?? code;
}

// Brand profiles for brand-level cost pages (e.g. /mitsubishi-heat-pump-cost/).
// One row per (category, brand). The slug is the URL prefix for that category's
// brand template. See data/csv/brand-profiles.csv.
export interface BrandProfile {
  category: string;   // heat_pump | hpwh | ev_charger | battery
  brand: string;      // display name
  slug: string;       // url slug, e.g. 'mitsubishi'
  tier: string;       // value | mid | premium
  positioning: string;
  models: string;     // '/'-separated model examples
  price_note: string;
  source_id: string;  // resolves to src/data/source-notes.json
  last_reviewed: string;
}
export const BRAND_PROFILES: BrandProfile[] =
  requireRows(parseCsv(brandProfilesCsv), 'brand-profiles').map(r => ({
    category: r.category,
    brand: r.brand,
    slug: r.slug,
    tier: r.tier,
    positioning: r.positioning,
    models: r.models,
    price_note: r.price_note,
    source_id: r.source_id,
    last_reviewed: r.last_reviewed,
  }));

/** All brand rows for a given category. */
export function brandsByCategory(category: string): BrandProfile[] {
  return BRAND_PROFILES.filter(b => b.category === category);
}

/**
 * Returns the state code for a US ZIP, or undefined if no range matches.
 * First-match-wins; CSV ordering is intentional for overlapping ranges
 * (e.g. DC vs MD at the 20xxx boundary). Accepts a 5-digit string or a
 * number. Anything that isn't 5 digits or isn't in range returns undefined.
 */
export function findStateForZip(zip: string | number | undefined): string | undefined {
  if (zip == null) return undefined;
  const s = String(zip).trim();
  if (!/^\d{5}$/.test(s)) return undefined;
  const n = parseInt(s, 10);
  for (const row of zipToState) {
    if (n >= row.zip_low && n <= row.zip_high) return row.state;
  }
  return undefined;
}
