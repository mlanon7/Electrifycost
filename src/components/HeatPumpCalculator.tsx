import { useEffect, useMemo, useState } from 'react';
import ResultPanel from './ResultPanel';
import { ALL_STATES, findClimate, findAddonBand, findStateForZip } from '@/lib/data';
import {
  runCalculator,
  type CalcArgs,
  type CostBand,
  type Difficulty,
  type PanelSize,
  type HomeType,
  type Timing,
  type IncomeBand,
  type FuelType,
} from '@/lib/calc';
import { useHashStateInit, useHashStateSync } from '@/lib/use-url-state';

const SCENARIOS: { value: string; label: string; recommendsCold?: boolean }[] = [
  { value: 'ducted_central_3ton', label: 'Ducted central heat pump (3-ton, ~1,500–2,200 sqft)' },
  { value: 'ducted_central_4ton', label: 'Ducted central heat pump (4-ton, ~2,200–3,000 sqft)' },
  { value: 'ductless_minisplit_1head', label: 'Single-zone ductless mini-split' },
  { value: 'ductless_minisplit_3head', label: 'Three-zone ductless mini-split' },
  { value: 'coldclimate_ducted', label: 'Cold-climate ducted heat pump', recommendsCold: true },
  { value: 'dual_fuel_with_gas_furnace', label: 'Dual-fuel (heat pump + existing gas furnace backup)' },
];

const PANEL_SIZES: PanelSize[] = ['unknown', '60A', '100A', '125A', '150A', '200A', '320/400A'];
const DIFFICULTIES: Difficulty[] = ['simple', 'average', 'difficult'];
const HOME_TYPES: { value: HomeType; label: string }[] = [
  { value: 'single_family', label: 'Single-family' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'condo', label: 'Condo' },
  { value: 'manufactured', label: 'Manufactured home' },
];

const FUEL_OPTIONS: { value: FuelType; label: string }[] = [
  { value: 'natural_gas', label: 'Natural gas furnace' },
  { value: 'oil', label: 'Heating oil' },
  { value: 'propane', label: 'Propane' },
  { value: 'electric_resistance', label: 'Electric resistance / baseboard' },
  { value: 'heat_pump', label: 'Older heat pump' },
];

// Ductwork penalty as an explicit itemized line. Bands sourced from
// data/csv/addons-bands.csv (DOE Building America anchor).
function ductworkPenaltyFor(ductwork: string, scenario: string): CostBand | undefined {
  if (ductwork === 'good' || ductwork === 'fair') return undefined;
  if (ductwork === 'poor') {
    const a = findAddonBand('ductwork_repair_poor');
    return { low: a.low, mid: a.mid, high: a.high };
  }
  if (ductwork === 'none' && scenario.startsWith('ducted')) {
    const a = findAddonBand('ductwork_replace_none');
    return { low: a.low, mid: a.mid, high: a.high };
  }
  return undefined;
}

export default function HeatPumpCalculator() {
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [scenario, setScenario] = useState('ducted_central_3ton');
  const [panelSize, setPanelSize] = useState<PanelSize>('100A');
  const [difficulty, setDifficulty] = useState<Difficulty>('average');
  const [homeType, setHomeType] = useState<HomeType>('single_family');
  const [homeSqft, setHomeSqft] = useState('1800');
  const [fuelHeating, setFuelHeating] = useState<FuelType>('natural_gas');
  const [ductwork, setDuctwork] = useState<'good' | 'fair' | 'poor' | 'none'>('good');
  const [timing, setTiming] = useState<Timing>('this_year');
  const [income, setIncome] = useState<IncomeBand>('unknown');
  const [contractorQuote, setContractorQuote] = useState<string>('');

  const climate = findClimate(state);
  const recommendsCold = climate?.heat_pump_class === 'coldclimate';

  // Sync state from ZIP whenever a complete 5-digit ZIP is entered.
  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip]);

  // Hydrate from URL hash on mount (share-link / refresh persistence).
  useHashStateInit(h => {
    if (h.state) setState(h.state);
    if (h.zip) setZip(h.zip);
    if (h.scenario) setScenario(h.scenario);
    if (h.panel) setPanelSize(h.panel as PanelSize);
    if (h.diff) setDifficulty(h.diff as Difficulty);
    if (h.hometype) setHomeType(h.hometype as HomeType);
    if (h.sqft) setHomeSqft(h.sqft);
    if (h.fuel) setFuelHeating(h.fuel as FuelType);
    if (h.duct) setDuctwork(h.duct as 'good' | 'fair' | 'poor' | 'none');
    if (h.timing) setTiming(h.timing as Timing);
    if (h.income) setIncome(h.income as IncomeBand);
    if (h.quote) setContractorQuote(h.quote);
  });

  // Serialize current state back into the URL hash (replaceState — no history pollution).
  useHashStateSync({
    state, zip, scenario, panel: panelSize, diff: difficulty,
    hometype: homeType, sqft: homeSqft, fuel: fuelHeating, duct: ductwork,
    timing, income, quote: contractorQuote,
  });

  const { result, error } = useMemo(() => {
    const args: CalcArgs = {
      module: 'heat_pump',
      scenario,
      scenarioLabel: SCENARIOS.find(s => s.value === scenario)?.label ?? 'Heat pump',
      contractorChecklistKey: 'heat_pump',
      state,
      zip,
      panelSize,
      difficulty,
      homeType,
      homeSqft: Number(homeSqft) || 1800,
      fuelHeating,
      ductwork,
      timing,
      income,
      contractorQuote: contractorQuote ? Number(contractorQuote) : undefined,
      ductworkPenalty: ductworkPenaltyFor(ductwork, scenario),
    };
    try {
      return { result: runCalculator(args), error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [state, zip, scenario, panelSize, difficulty, homeType, homeSqft, fuelHeating, ductwork, timing, income, contractorQuote]);

  return (
    <div className="calc-grid">
      <form className="card calc-form p-5 space-y-4 print:hidden">
        <h2 className="text-base font-semibold text-ink-900">Your details</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="state">State</label>
            <select id="state" className="input" value={state} onChange={e => setState(e.target.value)}>
              {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="zip">ZIP</label>
            <input id="zip" className="input" inputMode="numeric" pattern="\d*" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/[^0-9]/g, ''))} />
            <p className="mt-1 text-[10px] text-ink-500">{zip.length === 5 ? <span className="text-brand-700">State auto-set from ZIP</span> : 'Optional — auto-sets state'}</p>
          </div>
        </div>

        {recommendsCold && !scenario.startsWith('coldclimate') && !scenario.startsWith('dual') && (
          <div className="rounded-md border border-blue-200 bg-blue-50 p-2.5 text-xs text-blue-800">
            Your climate zone has cold winters. Consider a cold-climate-rated or dual-fuel system for the most reliable heat at low temperatures.
          </div>
        )}

        <div>
          <label className="label" htmlFor="scenario">Equipment</label>
          <select id="scenario" className="input" value={scenario} onChange={e => setScenario(e.target.value)}>
            {SCENARIOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="sqft">Home size (sqft)</label>
            <input id="sqft" className="input" inputMode="numeric" pattern="\d*" value={homeSqft} onChange={e => setHomeSqft(e.target.value.replace(/[^0-9]/g, ''))} />
          </div>
          <div>
            <label className="label" htmlFor="hometype">Home type</label>
            <select id="hometype" className="input" value={homeType} onChange={e => setHomeType(e.target.value as HomeType)}>
              {HOME_TYPES.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="fuel">Current heating fuel</label>
          <select id="fuel" className="input" value={fuelHeating} onChange={e => setFuelHeating(e.target.value as FuelType)}>
            {FUEL_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="duct">Ductwork condition</label>
            <select id="duct" className="input" value={ductwork} onChange={e => setDuctwork(e.target.value as 'good' | 'fair' | 'poor' | 'none')}>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="none">No ductwork</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="panel">Panel size</label>
            <select id="panel" className="input" value={panelSize} onChange={e => setPanelSize(e.target.value as PanelSize)}>
              {PANEL_SIZES.map(p => <option key={p} value={p}>{p === 'unknown' ? 'Not sure' : p}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="difficulty">Install difficulty</label>
            <select id="difficulty" className="input" value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="timing">Timing</label>
            <select id="timing" className="input" value={timing} onChange={e => setTiming(e.target.value as Timing)}>
              <option value="planning">Planning ahead</option>
              <option value="this_year">This year</option>
              <option value="emergency">Emergency replacement</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="income">Income / rebate eligibility</label>
          <select id="income" className="input" value={income} onChange={e => setIncome(e.target.value as IncomeBand)}>
            <option value="unknown">Not sure</option>
            <option value="standard">Standard income</option>
            <option value="moderate_income">Moderate income</option>
            <option value="low_income">Low income</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="quote">Contractor quote (optional)</label>
          <input id="quote" className="input" inputMode="numeric" pattern="\d*" placeholder="e.g. 14000" value={contractorQuote} onChange={e => setContractorQuote(e.target.value.replace(/[^0-9]/g, ''))} />
        </div>
      </form>

      <ResultPanel result={result} error={error} contractorQuote={contractorQuote ? Number(contractorQuote) : null} />
    </div>
  );
}
