import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import type { CalculatorResult, CostBand, PanelSize, IncomeBand, Timing, FuelType } from '@/lib/calc';
import { runCalculator } from '@/lib/calc';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';

type ModuleKey = 'heat_pump' | 'ev_charger' | 'panel' | 'hpwh' | 'induction';

interface ModuleConfig {
  key: ModuleKey;
  label: string;
  description: string;
  scenario: string;
  scenarioLabel: string;
  checklistKey: string;
  defaultEnabled: boolean;
  extraArgs?: Record<string, unknown>;
}

// Module presets — sensible defaults a non-engineer can run without picking 30 inputs.
const MODULES: ModuleConfig[] = [
  {
    key: 'heat_pump', label: 'Heat pump (HVAC)', description: '3-ton ducted central heat pump replacing furnace + AC',
    scenario: 'ducted_central_3ton', scenarioLabel: 'Ducted central heat pump (3-ton)',
    checklistKey: 'heat_pump', defaultEnabled: true,
  },
  {
    key: 'hpwh', label: 'Heat pump water heater', description: '50-gallon 240V hybrid HPWH',
    scenario: 'hybrid_240v_50gal', scenarioLabel: '240V hybrid HPWH (50 gal)',
    checklistKey: 'hpwh', defaultEnabled: true,
  },
  {
    key: 'induction', label: 'Induction range', description: '30-inch induction range',
    scenario: 'range_30in_basic', scenarioLabel: '30-inch induction range',
    checklistKey: 'induction', defaultEnabled: true,
  },
  {
    key: 'ev_charger', label: 'EV charger (Level 2)', description: 'Hardwired Level 2 EVSE',
    scenario: 'level2_hardwired', scenarioLabel: 'Level 2 hardwired',
    checklistKey: 'ev_charger', defaultEnabled: true,
  },
  {
    key: 'panel', label: 'Panel upgrade (standalone)', description: '100A→200A service upgrade if needed',
    scenario: 'upgrade_100_to_200', scenarioLabel: '100A → 200A panel upgrade',
    checklistKey: 'panel', defaultEnabled: false,
  },
];

const PANEL_SIZES: PanelSize[] = ['unknown', '60A', '100A', '125A', '150A', '200A', '320/400A'];

const zero: CostBand = { low: 0, mid: 0, high: 0 };
const add = (a: CostBand, b: CostBand): CostBand => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const maxBand = (a: CostBand, b: CostBand): CostBand => ({
  low: Math.max(a.low, b.low), mid: Math.max(a.mid, b.mid), high: Math.max(a.high, b.high),
});

interface ModuleRun {
  key: ModuleKey;
  label: string;
  enabled: boolean;
  result: CalculatorResult | null;
  panelAdder: CostBand;
  grossExPanel: CostBand;
}

export default function WholeHomeCalculator() {
  useCalculatorUsed('whole-home-electrification');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [panelSize, setPanelSize] = useState<PanelSize>('100A');
  const [homeSqft, setHomeSqft] = useState('1800');
  const [fuelHeating, setFuelHeating] = useState<FuelType>('natural_gas');
  const [fuelWater, setFuelWater] = useState<FuelType>('natural_gas');
  const [timing, setTiming] = useState<Timing>('planning');
  const [income, setIncome] = useState<IncomeBand>('unknown');

  const [enabled, setEnabled] = useState<Record<ModuleKey, boolean>>(() =>
    MODULES.reduce((acc, m) => ({ ...acc, [m.key]: m.defaultEnabled }), {} as Record<ModuleKey, boolean>),
  );

  // ZIP → state sync (same pattern as the per-module calculators).
  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip]);

  const runs: ModuleRun[] = useMemo(() => {
    return MODULES.map(m => {
      if (!enabled[m.key]) {
        return { key: m.key, label: m.label, enabled: false, result: null, panelAdder: zero, grossExPanel: zero };
      }
      try {
        const result = runCalculator({
          module: m.key,
          scenario: m.scenario,
          scenarioLabel: m.scenarioLabel,
          contractorChecklistKey: m.checklistKey,
          state,
          zip,
          panelSize,
          difficulty: 'average',
          homeType: 'single_family',
          homeSqft: Number(homeSqft) || 1800,
          fuelHeating,
          fuelWater,
          timing,
          income,
        });
        const panelAdder = result.panelAdder ?? zero;
        const grossExPanel: CostBand = {
          low: Math.max(0, result.gross.low - panelAdder.low),
          mid: Math.max(0, result.gross.mid - panelAdder.mid),
          high: Math.max(0, result.gross.high - panelAdder.high),
        };
        return { key: m.key, label: m.label, enabled: true, result, panelAdder, grossExPanel };
      } catch {
        return { key: m.key, label: m.label, enabled: true, result: null, panelAdder: zero, grossExPanel: zero };
      }
    });
  }, [state, zip, panelSize, homeSqft, fuelHeating, fuelWater, timing, income, enabled]);

  // Aggregate. Panel work is shared: take the MAX panel adder across modules, not the sum.
  // Each module's gross is then its non-panel portion; we add one shared panel adder at the end.
  const aggregate = useMemo(() => {
    const activeRuns = runs.filter(r => r.enabled && r.result);
    if (activeRuns.length === 0) return null;

    const sharedPanel = activeRuns.reduce<CostBand>((acc, r) => maxBand(acc, r.panelAdder), zero);
    const grossNoPanel = activeRuns.reduce<CostBand>((acc, r) => add(acc, r.grossExPanel), zero);
    const gross = add(grossNoPanel, sharedPanel);

    const appliedIncentives = activeRuns.flatMap(r => r.result!.incentives);
    const potentialIncentives = activeRuns.flatMap(r => r.result!.potentialIncentives ?? []);
    const totalApplied = appliedIncentives.reduce<CostBand>((acc, i) => add(acc, i.amount), zero);
    const net: CostBand = {
      low: Math.max(0, gross.low - totalApplied.high),
      mid: Math.max(0, gross.mid - totalApplied.mid),
      high: Math.max(0, gross.high - totalApplied.low),
    };

    const monthlyImpact = activeRuns.reduce<CostBand>(
      (acc, r) => r.result!.monthlyEnergyImpact ? add(acc, r.result!.monthlyEnergyImpact) : acc,
      zero,
    );
    const hasImpact = activeRuns.some(r => r.result!.monthlyEnergyImpact);

    const caveatSet = new Set<string>();
    activeRuns.forEach(r => r.result!.caveats.forEach(c => caveatSet.add(c)));
    caveatSet.add('Whole-home figures assume one shared panel upgrade if any module triggers one — the panel adder is taken from the worst-case module, not summed.');

    return { gross, net, sharedPanel, appliedIncentives, potentialIncentives, monthlyImpact: hasImpact ? monthlyImpact : null, caveats: [...caveatSet] };
  }, [runs]);

  return (
    <div className="calc-grid">
      <form className="card calc-form p-5 space-y-4 print:hidden">
        <h2 className="text-base font-semibold text-ink-900">Your home</h2>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="state">State</label>
            <select id="state" className="input" value={state} onChange={e => setState(e.target.value)}>
              {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="zip">ZIP{zip.length === 5 ? <span className="ml-1 text-[10px] font-normal text-brand-700">(state auto-set)</span> : <span className="ml-1 text-[10px] font-normal text-ink-600">(optional)</span>}</label>
            <input id="zip" className="input" inputMode="numeric" pattern="\d*" maxLength={5} value={zip} onChange={e => setZip(e.target.value.replace(/[^0-9]/g, ''))} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="sqft">Home size (sqft)</label>
            <input id="sqft" className="input" inputMode="numeric" pattern="\d*" value={homeSqft} onChange={e => setHomeSqft(e.target.value.replace(/[^0-9]/g, ''))} />
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
            <label className="label" htmlFor="fh">Heating fuel today</label>
            <select id="fh" className="input" value={fuelHeating} onChange={e => setFuelHeating(e.target.value as FuelType)}>
              <option value="natural_gas">Natural gas</option>
              <option value="oil">Heating oil</option>
              <option value="propane">Propane</option>
              <option value="electric_resistance">Electric resistance</option>
              <option value="heat_pump">Older heat pump</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="fw">Water fuel today</label>
            <select id="fw" className="input" value={fuelWater} onChange={e => setFuelWater(e.target.value as FuelType)}>
              <option value="natural_gas">Natural gas</option>
              <option value="propane">Propane</option>
              <option value="oil">Oil</option>
              <option value="electric_resistance">Electric resistance</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="timing">Timing</label>
            <select id="timing" className="input" value={timing} onChange={e => setTiming(e.target.value as Timing)}>
              <option value="planning">Planning ahead</option>
              <option value="this_year">This year</option>
              <option value="emergency">Emergency</option>
            </select>
          </div>
          <div>
            <label className="label" htmlFor="income">Income</label>
            <select id="income" className="input" value={income} onChange={e => setIncome(e.target.value as IncomeBand)}>
              <option value="unknown">Not sure</option>
              <option value="standard">Standard</option>
              <option value="moderate_income">Moderate</option>
              <option value="low_income">Low income</option>
            </select>
          </div>
        </div>

        <div className="border-t border-ink-200 pt-4">
          <p className="label">Which upgrades?</p>
          <ul className="mt-2 space-y-2">
            {MODULES.map(m => (
              <li key={m.key}>
                <label className="flex items-start gap-2 text-sm text-ink-800">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={enabled[m.key]}
                    onChange={e => setEnabled(prev => ({ ...prev, [m.key]: e.target.checked }))}
                  />
                  <span>
                    <span className="font-medium">{m.label}</span>
                    <span className="block text-xs text-ink-600">{m.description}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </form>

      {!aggregate ? (
        <div className="card p-6 text-sm text-ink-600">Pick at least one upgrade to see a combined estimate.</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <CostCard label="Low" amount={aggregate.gross.low} />
            <CostCard label="Mid" amount={aggregate.gross.mid} emphasized />
            <CostCard label="High" amount={aggregate.gross.high} />
          </div>

          {aggregate.appliedIncentives.length > 0 && (
            <div className="net-card">
              <div className="flex items-center justify-between">
                <p className="net-card-title">Net cost after estimated incentives</p>
                <span className="badge-green">Mid: {fmtUSD(aggregate.net.mid)}</span>
              </div>
              <p className="net-card-amount">{fmtUSDRange(aggregate.net.low, aggregate.net.high)}</p>
              <p className="mt-2 text-xs text-brand-700">
                Combines confirmed federal credits, state programs, and DOE Home Energy Rebates where your state has launched. Potential incentives are not subtracted.
              </p>
            </div>
          )}

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">By upgrade</h3>
            <table className="mt-2 w-full text-sm">
              <thead className="text-xs text-ink-600">
                <tr>
                  <th className="text-left font-medium py-1.5">Upgrade</th>
                  <th className="text-right font-medium py-1.5">Low</th>
                  <th className="text-right font-medium py-1.5">Mid</th>
                  <th className="text-right font-medium py-1.5">High</th>
                </tr>
              </thead>
              <tbody>
                {runs.filter(r => r.enabled && r.result).map(r => (
                  <tr key={r.key} className="border-t border-ink-100">
                    <td className="py-2 font-medium text-ink-800">{r.label}</td>
                    <td className="py-2 text-right tabular-nums text-ink-700">{fmtUSD(r.grossExPanel.low)}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-ink-900">{fmtUSD(r.grossExPanel.mid)}</td>
                    <td className="py-2 text-right tabular-nums text-ink-700">{fmtUSD(r.grossExPanel.high)}</td>
                  </tr>
                ))}
                {aggregate.sharedPanel.mid > 0 && (
                  <tr className="border-t border-ink-100">
                    <td className="py-2 font-medium text-ink-800">Shared panel work (probabilistic)</td>
                    <td className="py-2 text-right tabular-nums text-ink-700">{fmtUSD(aggregate.sharedPanel.low)}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-ink-900">{fmtUSD(aggregate.sharedPanel.mid)}</td>
                    <td className="py-2 text-right tabular-nums text-ink-700">{fmtUSD(aggregate.sharedPanel.high)}</td>
                  </tr>
                )}
                <tr className="border-t-2 border-ink-200 bg-ink-50">
                  <td className="py-2 font-semibold text-ink-900">Total (gross)</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink-900">{fmtUSD(aggregate.gross.low)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink-900">{fmtUSD(aggregate.gross.mid)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-ink-900">{fmtUSD(aggregate.gross.high)}</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-600">Panel work is shared: we use the worst-case adder across modules, not the sum, because one upgrade typically supports multiple loads.</p>
          </div>

          {aggregate.monthlyImpact && (
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-600">Estimated monthly bill change (combined)</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">
                {aggregate.monthlyImpact.mid < 0 ? '−' : '+'}{fmtUSD(Math.abs(aggregate.monthlyImpact.mid))}<span className="ml-1 text-base font-normal text-ink-600">/ mo</span>
              </p>
              <p className="mt-1 text-xs text-ink-600">Sum of each module's operating-cost change vs. your current fuels. Range: {fmtUSD(aggregate.monthlyImpact.low)} to {fmtUSD(aggregate.monthlyImpact.high)} per month.</p>
            </div>
          )}

          {aggregate.potentialIncentives.length > 0 && (
            <div className="card p-4 border-amber-200 bg-amber-50/40">
              <h3 className="text-sm font-semibold text-amber-900">Possible additional incentives</h3>
              <p className="mt-1 text-xs text-amber-800">Not subtracted from your net cost. Eligibility depends on confirmation.</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-700">
                {aggregate.potentialIncentives.map((i, idx) => (
                  <li key={idx} className="flex justify-between">
                    <span>{i.name}</span>
                    <span className="tabular-nums text-amber-800">up to −{fmtUSD(i.amount.mid)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-medium">Important caveats for whole-home estimates</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {aggregate.caveats.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function CostCard({ label, amount, emphasized }: { label: string; amount: number; emphasized?: boolean }) {
  const tone = emphasized ? 'border-brand-300 bg-brand-50 ring-1 ring-brand-300' : 'border-ink-200 bg-white';
  return (
    <div className={`relative rounded-xl border p-4 shadow-card ${tone}`}>
      <p className={`text-xs font-medium uppercase tracking-wide ${emphasized ? 'text-brand-700' : 'text-ink-600'}`}>{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{fmtUSD(amount)}</p>
    </div>
  );
}
