import { useEffect, useMemo, useState } from 'react';
import ResultPanel from './ResultPanel';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { runCalculator, type CalcArgs, type Difficulty, type PanelSize, type HomeType, type Timing, type IncomeBand } from '@/lib/calc';
import { useHashStateInit, useHashStateSync } from '@/lib/use-url-state';

const SCENARIOS: { value: string; label: string }[] = [
  { value: 'upgrade_100_to_200', label: '100A → 200A panel upgrade' },
  { value: 'upgrade_150_to_200', label: '150A → 200A panel upgrade' },
  { value: 'upgrade_200_to_320', label: '200A → 320/400A service upgrade' },
  { value: 'subpanel_add', label: 'Add a subpanel' },
  { value: 'load_management_device', label: 'Smart load management (alternative to upgrade)' },
  { value: 'service_drop_overhead_to_underground', label: 'Overhead → underground service' },
];

const PANEL_SIZES: PanelSize[] = ['unknown', '60A', '100A', '125A', '150A', '200A', '320/400A'];
const DIFFICULTIES: Difficulty[] = ['simple', 'average', 'difficult'];
const HOME_TYPES: { value: HomeType; label: string }[] = [
  { value: 'single_family', label: 'Single-family' },
  { value: 'townhouse', label: 'Townhouse' },
  { value: 'condo', label: 'Condo' },
  { value: 'manufactured', label: 'Manufactured home' },
];

export default function PanelCalculator({ initialState = 'CA' }: { initialState?: string }) {
  const [state, setState] = useState(initialState);
  const [zip, setZip] = useState('');
  const [scenario, setScenario] = useState('upgrade_100_to_200');
  const [panelSize, setPanelSize] = useState<PanelSize>('100A');
  const [difficulty, setDifficulty] = useState<Difficulty>('average');
  const [homeType, setHomeType] = useState<HomeType>('single_family');
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

  // Hydrate from URL hash on mount + serialize state back to hash.
  useHashStateInit(h => {
    if (h.state) setState(h.state);
    if (h.zip) setZip(h.zip);
    if (h.scenario) setScenario(h.scenario);
    if (h.panel) setPanelSize(h.panel as PanelSize);
    if (h.diff) setDifficulty(h.diff as Difficulty);
    if (h.hometype) setHomeType(h.hometype as HomeType);
    if (h.timing) setTiming(h.timing as Timing);
    if (h.income) setIncome(h.income as IncomeBand);
    if (h.quote) setContractorQuote(h.quote);
  });
  useHashStateSync({
    state, zip, scenario, panel: panelSize, diff: difficulty,
    hometype: homeType, timing, income, quote: contractorQuote,
  });

  const { result, error } = useMemo(() => {
    const args: CalcArgs = {
      module: 'panel',
      scenario,
      scenarioLabel: SCENARIOS.find(s => s.value === scenario)?.label ?? 'Panel upgrade',
      contractorChecklistKey: 'panel',
      state,
      zip,
      panelSize,
      difficulty,
      homeType,
      timing,
      income,
      contractorQuote: contractorQuote ? Number(contractorQuote) : undefined,
    };
    try {
      return { result: runCalculator(args), error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [state, zip, scenario, panelSize, difficulty, homeType, timing, income, contractorQuote]);

  const quoteDelta = useMemo(() => {
    if (!result || !contractorQuote) return null;
    const q = Number(contractorQuote);
    if (!Number.isFinite(q)) return null;
    if (q < result.gross.low) return { kind: 'low', diff: result.gross.low - q };
    if (q > result.gross.high) return { kind: 'high', diff: q - result.gross.high };
    return { kind: 'in', diff: 0 };
  }, [result, contractorQuote]);

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
            <input id="zip" className="input" inputMode="numeric" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/[^0-9]/g, ''))} />
            <p className="mt-1 text-[10px] text-ink-500">{zip.length === 5 ? <span className="text-brand-700">State auto-set from ZIP</span> : 'Optional — auto-sets state'}</p>
          </div>
        </div>

        <div>
          <label className="label" htmlFor="scenario">Project</label>
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
            <label className="label" htmlFor="difficulty">Install difficulty</label>
            <select id="difficulty" className="input" value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>
              {DIFFICULTIES.map(d => <option key={d} value={d}>{labelFor(d)}</option>)}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="home">Home type</label>
            <select id="home" className="input" value={homeType} onChange={e => setHomeType(e.target.value as HomeType)}>
              {HOME_TYPES.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
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
          <p className="mt-1 text-xs text-ink-500">Used for income-qualified rebates (e.g., DOE HEEHRA).</p>
        </div>

        <div>
          <label className="label" htmlFor="quote">Contractor quote (optional, for bid-check)</label>
          <input id="quote" className="input" inputMode="numeric" placeholder="e.g. 3200" value={contractorQuote} onChange={e => setContractorQuote(e.target.value.replace(/[^0-9]/g, ''))} />
          {quoteDelta && (
            <p className={`mt-1 text-xs ${quoteDelta.kind === 'low' ? 'text-amber-700' : quoteDelta.kind === 'high' ? 'text-rose-700' : 'text-brand-700'}`}>
              {quoteDelta.kind === 'in' && 'Quote is within the typical range for this project.'}
              {quoteDelta.kind === 'low' && `Quote is ~${fmt$(quoteDelta.diff)} below the low end. Verify scope (permits, grounding, meter/main).`}
              {quoteDelta.kind === 'high' && `Quote is ~${fmt$(quoteDelta.diff)} above the high end. Ask why and request itemization.`}
            </p>
          )}
        </div>
      </form>

      <ResultPanel result={result} error={error} contractorQuote={contractorQuote ? Number(contractorQuote) : null} />
    </div>
  );
}

function labelFor(d: Difficulty) {
  if (d === 'simple') return 'Simple';
  if (d === 'difficult') return 'Difficult';
  return 'Average';
}

function fmt$(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
