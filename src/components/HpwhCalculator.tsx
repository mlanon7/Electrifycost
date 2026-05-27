import { useEffect, useMemo, useState } from 'react';
import ResultPanel from './ResultPanel';
import { ALL_STATES, findAddonBand, findStateForZip } from '@/lib/data';
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

const SCENARIOS: { value: string; label: string }[] = [
  { value: 'plugin_120v_50gal', label: '120V plug-in HPWH (50 gal)' },
  { value: 'hybrid_240v_50gal', label: '240V hybrid HPWH (50 gal)' },
  { value: 'hybrid_240v_80gal', label: '240V hybrid HPWH (80 gal, larger households)' },
  { value: 'split_system', label: 'Split-system HPWH (separate compressor)' },
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
  { value: 'natural_gas', label: 'Natural gas water heater' },
  { value: 'propane', label: 'Propane water heater' },
  { value: 'oil', label: 'Oil-fired water heater' },
  { value: 'electric_resistance', label: 'Electric resistance water heater' },
];

const LOCATIONS: { value: string; label: string }[] = [
  { value: 'garage', label: 'Garage' },
  { value: 'basement', label: 'Basement' },
  { value: 'utility_room', label: 'Utility / closet (tight)' },
  { value: 'mechanical_room', label: 'Dedicated mechanical room' },
];

// Tight-space penalty as an explicit itemized line. Closet/utility installs
// add labor for free-air or ducted intake/exhaust routing.
// Band sourced from data/csv/addons-bands.csv (hpwh_tight_space).
function tightSpacePenaltyFor(location: string): CostBand | undefined {
  if (location !== 'utility_room') return undefined;
  const a = findAddonBand('hpwh_tight_space');
  return { low: a.low, mid: a.mid, high: a.high };
}

export default function HpwhCalculator({ initialState = 'CA' }: { initialState?: string }) {
  const [state, setState] = useState(initialState);
  const [zip, setZip] = useState('');
  const [scenario, setScenario] = useState('hybrid_240v_50gal');
  const [panelSize, setPanelSize] = useState<PanelSize>('100A');
  const [difficulty, setDifficulty] = useState<Difficulty>('average');
  const [homeType, setHomeType] = useState<HomeType>('single_family');
  const [fuelWater, setFuelWater] = useState<FuelType>('natural_gas');
  const [location, setLocation] = useState('garage');
  const [removeOld, setRemoveOld] = useState<boolean>(true);
  const [timing, setTiming] = useState<Timing>('this_year');
  const [income, setIncome] = useState<IncomeBand>('unknown');
  const [contractorQuote, setContractorQuote] = useState<string>('');

  // Sync state from ZIP whenever a complete 5-digit ZIP is entered.
  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip]);

  const { result, error } = useMemo(() => {
    // Removal adder anchor pulled from data/csv/addons-bands.csv (hpwh_removal_old_unit).
    const removalAdder = removeOld ? findAddonBand('hpwh_removal_old_unit').mid : 0;

    const args: CalcArgs = {
      module: 'hpwh',
      scenario,
      scenarioLabel: SCENARIOS.find(s => s.value === scenario)?.label ?? 'Heat pump water heater',
      contractorChecklistKey: 'hpwh',
      state,
      zip,
      panelSize,
      difficulty,
      homeType,
      fuelWater,
      timing,
      income,
      removalAdder,
      tightSpacePenalty: tightSpacePenaltyFor(location),
      contractorQuote: contractorQuote ? Number(contractorQuote) : undefined,
    };
    try {
      const r = runCalculator(args);
      if (location === 'utility_room') {
        r.caveats.push('Tight install location; verify the room has at least 700 cubic feet of free air, or plan for ducted air handling.');
      }
      if (scenario === 'plugin_120v_50gal' && (panelSize === '60A' || panelSize === 'unknown')) {
        r.caveats.push('A 120V plug-in HPWH avoids new circuit work and is a good fit for older or fully loaded panels.');
      }
      return { result: r, error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [state, zip, scenario, panelSize, difficulty, homeType, fuelWater, location, removeOld, timing, income, contractorQuote]);

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
            <p className="mt-1 text-[10px] text-ink-600">{zip.length === 5 ? <span className="text-brand-700">State auto-set from ZIP</span> : 'Optional — auto-sets state'}</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="scenario">Equipment</label>
          <select id="scenario" className="input" value={scenario} onChange={e => setScenario(e.target.value)}>
            {SCENARIOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="fuel">Current water heating fuel</label>
          <select id="fuel" className="input" value={fuelWater} onChange={e => setFuelWater(e.target.value as FuelType)}>
            {FUEL_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="loc">Install location</label>
            <select id="loc" className="input" value={location} onChange={e => setLocation(e.target.value)}>
              {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
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
            <label className="label" htmlFor="hometype">Home type</label>
            <select id="hometype" className="input" value={homeType} onChange={e => setHomeType(e.target.value as HomeType)}>
              {HOME_TYPES.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="difficulty">Install difficulty</label>
            <select id="difficulty" className="input" value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={removeOld} onChange={e => setRemoveOld(e.target.checked)} />
            Include removal &amp; disposal of old water heater
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="timing">Timing</label>
            <select id="timing" className="input" value={timing} onChange={e => setTiming(e.target.value as Timing)}>
              <option value="planning">Planning ahead</option>
              <option value="this_year">This year</option>
              <option value="emergency">Emergency replacement</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="income">Income</label>
            <select id="income" className="input" value={income} onChange={e => setIncome(e.target.value as IncomeBand)}>
              <option value="unknown">Not sure</option>
              <option value="standard">Standard</option>
              <option value="moderate_income">Moderate income</option>
              <option value="low_income">Low income</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="quote">Contractor quote (optional)</label>
          <input id="quote" className="input" inputMode="numeric" pattern="\d*" placeholder="e.g. 3200" value={contractorQuote} onChange={e => setContractorQuote(e.target.value.replace(/[^0-9]/g, ''))} />
        </div>
      </form>

      <ResultPanel result={result} error={error} contractorQuote={contractorQuote ? Number(contractorQuote) : null} />
    </div>
  );
}
