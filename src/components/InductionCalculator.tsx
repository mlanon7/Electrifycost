import { useEffect, useMemo, useState } from 'react';
import ResultPanel from './ResultPanel';
import { ALL_STATES, findAddonBand, findStateForZip } from '@/lib/data';
import {
  runCalculator,
  type CalcArgs,
  type Difficulty,
  type PanelSize,
  type HomeType,
  type Timing,
  type IncomeBand,
  type FuelType,
} from '@/lib/calc';

const SCENARIOS: { value: string; label: string }[] = [
  { value: 'range_30in_basic', label: '30-inch induction range (basic)' },
  { value: 'range_30in_premium', label: '30-inch induction range (premium / convection)' },
  { value: 'cooktop_30in_plugin', label: 'Plug-in induction cooktop only' },
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
  { value: 'natural_gas', label: 'Natural gas range' },
  { value: 'propane', label: 'Propane range' },
  { value: 'electric_resistance', label: 'Electric coil/resistance range' },
];

export default function InductionCalculator({ initialState = 'CA' }: { initialState?: string }) {
  const [state, setState] = useState(initialState);
  const [zip, setZip] = useState('');
  const [scenario, setScenario] = useState('range_30in_basic');
  const [panelSize, setPanelSize] = useState<PanelSize>('100A');
  const [difficulty, setDifficulty] = useState<Difficulty>('average');
  const [homeType, setHomeType] = useState<HomeType>('single_family');
  const [fuelKitchen, setFuelKitchen] = useState<FuelType>('natural_gas');
  const [need240Circuit, setNeed240Circuit] = useState<boolean>(true);
  const [capGasLine, setCapGasLine] = useState<boolean>(true);
  const [includeCookware, setIncludeCookware] = useState<boolean>(true);
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
    const isCooktop = scenario === 'cooktop_30in_plugin';
    const effectiveNeed240 = isCooktop ? false : need240Circuit;
    const effectiveCapGas = fuelKitchen === 'natural_gas' || fuelKitchen === 'propane' ? capGasLine : false;

    // Bands from data/csv/addons-bands.csv (induction_240v_circuit, _gas_line_cap, _cookware_starter).
    const circuitBand = findAddonBand('induction_240v_circuit');
    const circuitAdder = effectiveNeed240
      ? { low: circuitBand.low, mid: circuitBand.mid, high: circuitBand.high }
      : undefined;

    const args: CalcArgs = {
      module: 'induction',
      scenario,
      scenarioLabel: SCENARIOS.find(s => s.value === scenario)?.label ?? 'Induction install',
      contractorChecklistKey: 'induction',
      state,
      zip,
      panelSize,
      difficulty,
      homeType,
      fuelHeating: fuelKitchen,
      timing,
      income,
      circuitAdder,
      contractorQuote: contractorQuote ? Number(contractorQuote) : undefined,
    };

    try {
      const r = runCalculator(args);
      if (effectiveCapGas) {
        const capRow = findAddonBand('induction_gas_line_cap');
        const cap = { low: capRow.low, mid: capRow.mid, high: capRow.high };
        r.gross = {
          low: Math.round((r.gross.low + cap.low) / 25) * 25,
          mid: Math.round((r.gross.mid + cap.mid) / 25) * 25,
          high: Math.round((r.gross.high + cap.high) / 25) * 25,
        };
        r.netAfterIncentives = {
          low: Math.max(0, r.netAfterIncentives.low + cap.low),
          mid: Math.max(0, r.netAfterIncentives.mid + cap.mid),
          high: Math.max(0, r.netAfterIncentives.high + cap.high),
        };
        r.itemized.push({
          label: 'Gas line cap (licensed plumber)',
          amount: cap,
          notes: 'Required when removing a gas range; varies by jurisdiction and access.',
        });
      }
      if (includeCookware && !isCooktop) {
        const cwRow = findAddonBand('induction_cookware_starter');
        const cw = { low: cwRow.low, mid: cwRow.mid, high: cwRow.high };
        r.gross = {
          low: r.gross.low + cw.low,
          mid: r.gross.mid + cw.mid,
          high: r.gross.high + cw.high,
        };
        r.netAfterIncentives = {
          low: r.netAfterIncentives.low + cw.low,
          mid: r.netAfterIncentives.mid + cw.mid,
          high: r.netAfterIncentives.high + cw.high,
        };
        r.itemized.push({
          label: 'Induction-compatible cookware allowance',
          amount: cw,
          notes: 'Most stainless and cast-iron pans work; fully aluminum and copper do not.',
        });
      }
      if (isCooktop) {
        r.caveats.push('Plug-in induction cooktops typically run on standard 120V outlets but are limited to about 1,800W total.');
      }
      if (panelSize === '60A') {
        r.caveats.push('A 60A panel may not support a 240V induction range without service work.');
      }
      return { result: r, error: null as string | null };
    } catch (e) {
      return { result: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [state, zip, scenario, panelSize, difficulty, homeType, fuelKitchen, need240Circuit, capGasLine, includeCookware, timing, income, contractorQuote]);

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
          <label className="label" htmlFor="scenario">Equipment</label>
          <select id="scenario" className="input" value={scenario} onChange={e => setScenario(e.target.value)}>
            {SCENARIOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="fuel">Current cooking fuel</label>
          <select id="fuel" className="input" value={fuelKitchen} onChange={e => setFuelKitchen(e.target.value as FuelType)}>
            {FUEL_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="panel">Panel size</label>
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

        <div className="space-y-2 rounded-md border border-ink-200 bg-ink-50/60 p-3">
          {scenario !== 'cooktop_30in_plugin' && (
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={need240Circuit} onChange={e => setNeed240Circuit(e.target.checked)} />
              Add a new 240V circuit (typical when there is no existing electric range)
            </label>
          )}
          {(fuelKitchen === 'natural_gas' || fuelKitchen === 'propane') && (
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={capGasLine} onChange={e => setCapGasLine(e.target.checked)} />
              Cap and seal existing gas line (licensed plumber)
            </label>
          )}
          {scenario !== 'cooktop_30in_plugin' && (
            <label className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" checked={includeCookware} onChange={e => setIncludeCookware(e.target.checked)} />
              Include a starter induction cookware budget
            </label>
          )}
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
          <input id="quote" className="input" inputMode="numeric" placeholder="e.g. 3500" value={contractorQuote} onChange={e => setContractorQuote(e.target.value.replace(/[^0-9]/g, ''))} />
        </div>
      </form>

      <ResultPanel result={result} error={error} contractorQuote={contractorQuote ? Number(contractorQuote) : null} />
    </div>
  );
}
