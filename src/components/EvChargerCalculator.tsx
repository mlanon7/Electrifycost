import { useEffect, useMemo, useState } from 'react';
import ResultPanel from './ResultPanel';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import {
  runCalculator,
  type CalcArgs,
  type CensusTract,
  type Difficulty,
  type PanelSize,
  type HomeType,
  type Timing,
  type IncomeBand,
} from '@/lib/calc';

const SCENARIOS: { value: string; label: string }[] = [
  { value: 'level2_hardwired', label: 'Level 2 hardwired (most common)' },
  { value: 'level2_plugin_nema14_50', label: 'Level 2 plug-in via NEMA 14-50 outlet' },
  { value: 'level2_long_run_50ft', label: 'Level 2 with long conduit run (30–50 ft)' },
  { value: 'level2_detached_garage_trench', label: 'Detached garage with trenching' },
];

const PANEL_SIZES: PanelSize[] = ['unknown', '60A', '100A', '125A', '150A', '200A', '320/400A'];
const DIFFICULTIES: Difficulty[] = ['simple', 'average', 'difficult'];
const HOME_TYPES: { value: HomeType; label: string }[] = [
  { value: 'single_family', label: 'Single-family' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'condo', label: 'Condo' },
  { value: 'manufactured', label: 'Manufactured home' },
];

export default function EvChargerCalculator({ initialState = 'CA' }: { initialState?: string }) {
  const [state, setState] = useState(initialState);
  const [zip, setZip] = useState('');
  const [scenario, setScenario] = useState('level2_hardwired');
  const [panelSize, setPanelSize] = useState<PanelSize>('200A');
  const [difficulty, setDifficulty] = useState<Difficulty>('average');
  const [homeType, setHomeType] = useState<HomeType>('single_family');
  const [timing, setTiming] = useState<Timing>('this_year');
  const [income, setIncome] = useState<IncomeBand>('unknown');
  const [eligibleCensusTract, setEligibleCensusTract] = useState<CensusTract>('unknown');
  const [contractorQuote, setContractorQuote] = useState<string>('');

  // Sync state from ZIP whenever a complete 5-digit ZIP is entered.
  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip]);

  const { result, error } = useMemo(() => {
    const args: CalcArgs = {
      module: 'ev_charger',
      scenario,
      scenarioLabel: SCENARIOS.find(s => s.value === scenario)?.label ?? 'EV charger install',
      contractorChecklistKey: 'ev_charger',
      state,
      zip,
      panelSize,
      difficulty,
      homeType,
      timing,
      income,
      eligibleCensusTract,
      contractorQuote: contractorQuote ? Number(contractorQuote) : undefined,
    };
    try {
      return { result: runCalculator(args), error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [state, zip, scenario, panelSize, difficulty, homeType, timing, income, eligibleCensusTract, contractorQuote]);

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
          <label className="label" htmlFor="scenario">Install scenario</label>
          <select id="scenario" className="input" value={scenario} onChange={e => setScenario(e.target.value)}>
            {SCENARIOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="panel">Current panel size</label>
            <select id="panel" className="input" value={panelSize} onChange={e => setPanelSize(e.target.value as PanelSize)}>
              {PANEL_SIZES.map(p => <option key={p} value={p}>{p === 'unknown' ? 'Not sure' : p}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="hometype">Home type</label>
            <select id="hometype" className="input" value={homeType} onChange={e => setHomeType(e.target.value as HomeType)}>
              {HOME_TYPES.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
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
              <option value="emergency">ASAP</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="census">Federal 30C credit — eligible census tract?</label>
          <select id="census" className="input" value={eligibleCensusTract} onChange={e => setEligibleCensusTract(e.target.value as CensusTract)}>
            <option value="unknown">Not sure</option>
            <option value="yes">Yes — confirmed eligible</option>
            <option value="no">No — not eligible</option>
          </select>
          <p className="mt-1 text-xs text-ink-600">The federal 30C credit only applies to qualifying census tracts. Check with the IRS Form 8911 instructions.</p>
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
          <input id="quote" className="input" inputMode="numeric" pattern="\d*" placeholder="e.g. 1800" value={contractorQuote} onChange={e => setContractorQuote(e.target.value.replace(/[^0-9]/g, ''))} />
        </div>
      </form>

      <ResultPanel result={result} error={error} contractorQuote={contractorQuote ? Number(contractorQuote) : null} />
    </div>
  );
}
