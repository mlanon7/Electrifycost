import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor, stateEnergy } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type UseCase = 'backup_only' | 'self_consumption' | 'tou_arbitrage' | 'full_home_backup';
type Chemistry = 'lfp' | 'nmc';
type PairedSolar = 'yes' | 'no';
type Panel = '100A' | '200A' | 'unknown';

interface CostBand { low: number; mid: number; high: number; }
const add = (a: CostBand, b: CostBand): CostBand => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand, m: number): CostBand => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// 2026 installed cost benchmarks ($/kWh installed, including inverter integration and labor).
// LBNL "Tracking the Sun" 2024 reports a median $1,330/kWh installed for paired solar-plus-storage;
// retrofitted standalone storage commands a premium. NREL's 2024 storage benchmark for residential
// (single Powerwall-class system): $1,200–$1,500/kWh installed for 10-13.5 kWh systems, with smaller
// systems closer to $1,500/kWh and larger systems trending toward $1,100/kWh.
const COST_PER_KWH_PAIRED: CostBand = { low: 950, mid: 1200, high: 1500 };       // installed at same time as solar
const COST_PER_KWH_RETROFIT: CostBand = { low: 1150, mid: 1400, high: 1750 };    // standalone retrofit

// LFP (LiFePO4) chemistry: 0-5% premium for cycle life + safety vs NMC for residential class.
const CHEMISTRY_PREMIUM: Record<Chemistry, number> = {
  lfp: 1.03,   // ~3% premium typical, often comparable
  nmc: 1.00,
};

// Use-case driven labor + transfer switch cost. Full-home backup requires whole-house automatic
// transfer switch + critical load panel resizing; backup-only is a small subpanel install.
const USECASE_PREMIUM: Record<UseCase, number> = {
  backup_only: 1.00,            // small subpanel, 4-6 critical circuits
  self_consumption: 1.05,       // grid-tied storage, no transfer switch
  tou_arbitrage: 1.05,
  full_home_backup: 1.15,       // automatic transfer switch + critical load panel
};

// Permit fees baseline (state labor multiplier scales this)
const BASE_PERMIT: CostBand = { low: 250, mid: 500, high: 900 };

// State storage incentive snapshot (2026). Per-kWh upfront or one-time grants.
// Values are conservative — many programs have tiers/income limits.
interface StateIncentive { name: string; perKwh?: number; flat?: number; cap?: number; note: string; }
const STATE_BATTERY_INCENTIVE: Record<string, StateIncentive> = {
  CA: { name: 'CA SGIP (Equity Resiliency tier)', perKwh: 150, cap: 5000, note: 'Self-Generation Incentive Program — General Market tier; higher tiers for low-income, fire-prone areas, medical baseline.' },
  CT: { name: 'CT Energy Storage Solutions', perKwh: 200, cap: 7500, note: 'CT Green Bank — declining-block upfront incentive plus performance payments.' },
  MA: { name: 'MA ConnectedSolutions', flat: 0, note: 'Performance-based: pays ~$275–$300/kWh-year for grid services, not upfront — not modeled in upfront cost.' },
  MD: { name: 'MD Energy Storage Tax Credit', perKwh: 0, cap: 5000, note: '30% state income-tax credit up to $5,000 (separate from federal 25D). 2025 expansion makes it more accessible.' },
  NY: { name: 'NY-Sun Storage adder', perKwh: 250, cap: 5000, note: 'NY-Sun Residential Storage Incentive — varies by region and declining block.' },
  OR: { name: 'OR Solar + Storage Rebate', flat: 2500, note: 'Energy Trust of Oregon — combined solar + storage rebate.' },
  CO: { name: 'Xcel Energy Battery Pilot', flat: 0, note: 'Tariff-based, not upfront.' },
};

function utilityRebateRange(state: string, kwh: number): CostBand & { name: string; note: string } | null {
  const s = STATE_BATTERY_INCENTIVE[state];
  if (!s) return null;
  if (s.flat && s.flat > 0) {
    return { name: s.name, note: s.note, low: s.flat * 0.8, mid: s.flat, high: s.flat * 1.1 };
  }
  if (s.perKwh && s.perKwh > 0) {
    const v = Math.min(s.perKwh * kwh, s.cap ?? Infinity);
    return { name: s.name, note: s.note, low: v * 0.7, mid: v, high: v * 1.2 };
  }
  return null;
}

// TOU arbitrage savings — rough heuristic. Daily cycle, 80% depth of discharge, 90% round-trip efficiency.
// Savings per kWh-cycled equals (peak-rate - off-peak-rate). Median ratio ~3:1 in TOU-aggressive states.
function annualArbitrageSavings(state: string, kwh: number): number {
  const row = stateEnergy.find(e => e.state === state);
  const rate = row ? row.electricity_cents_per_kwh / 100 : 0.16;
  // TOU spread by state (rough)
  const touSpread: Record<string, number> = {
    CA: 0.30, NY: 0.20, MA: 0.18, HI: 0.25, CT: 0.18, NJ: 0.15, NH: 0.15, RI: 0.18,
    AZ: 0.15, NV: 0.12, FL: 0.10, TX: 0.12, IL: 0.10, MD: 0.12,
  };
  const spread = touSpread[state] ?? Math.max(0.05, rate * 0.5);
  const usableDaily = kwh * 0.80 * 0.90;
  return usableDaily * spread * 365;
}

// Avoided outage cost — qualitative. Use a small annualized resilience value:
// average household loses $150–$300/year in spoilage + lost-productivity from outages (NREL ICE Calculator)
function annualResilienceValue(useCase: UseCase): number {
  switch (useCase) {
    case 'backup_only': return 100;
    case 'self_consumption': return 50;
    case 'tou_arbitrage': return 50;
    case 'full_home_backup': return 250;
  }
}

export default function BatteryCalculator() {
  useCalculatorUsed('home-battery');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [kwh, setKwh] = useState(13.5);   // Powerwall-3 default
  const [useCase, setUseCase] = useState<UseCase>('self_consumption');
  const [chemistry, setChemistry] = useState<Chemistry>('lfp');
  const [paired, setPaired] = useState<PairedSolar>('yes');
  const [panel, setPanel] = useState<Panel>('200A');
  const [installYear, setInstallYear] = useState(2026);

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const stateMult = findStateLabor(state)?.electrician_multiplier ?? 1.0;
    const basePerKwh = paired === 'yes' ? COST_PER_KWH_PAIRED : COST_PER_KWH_RETROFIT;
    const chemMult = CHEMISTRY_PREMIUM[chemistry];
    const ucMult = USECASE_PREMIUM[useCase];

    const equipmentAndLabor: CostBand = {
      low: basePerKwh.low * kwh * chemMult * ucMult * stateMult,
      mid: basePerKwh.mid * kwh * chemMult * ucMult * stateMult,
      high: basePerKwh.high * kwh * chemMult * ucMult * stateMult,
    };

    // Panel-adjacent work: 100A panels often need a critical-load subpanel; 200A typically does not for backup-only
    const panelAdder: CostBand = panel === '100A' && (useCase === 'full_home_backup' || useCase === 'backup_only')
      ? { low: 800, mid: 1400, high: 2200 }
      : { low: 0, mid: 0, high: 0 };

    const permit: CostBand = scale(BASE_PERMIT, stateMult);

    const gross = add(add(equipmentAndLabor, panelAdder), permit);

    // 25D federal credit — TERMINATED by OBBBA for property placed in service after 2025-12-31.
    // Standalone battery >=3 kWh qualified historically; not available for 2026 onward.
    // Source: IRS https://www.irs.gov/credits-deductions/residential-clean-energy-credit
    const fedRate = installYear <= 2025 ? 0.30 : 0;
    const federalCredit: CostBand = scale(gross, fedRate);

    const stateRebate = utilityRebateRange(state, kwh);
    const stateAmt: CostBand = stateRebate
      ? { low: stateRebate.low, mid: stateRebate.mid, high: stateRebate.high }
      : { low: 0, mid: 0, high: 0 };

    const net: CostBand = {
      low: Math.max(0, gross.low - federalCredit.low - stateAmt.low),
      mid: Math.max(0, gross.mid - federalCredit.mid - stateAmt.mid),
      high: Math.max(0, gross.high - federalCredit.high - stateAmt.high),
    };

    // Operating savings
    const tou = useCase === 'tou_arbitrage' || useCase === 'self_consumption'
      ? annualArbitrageSavings(state, kwh)
      : 0;
    const resilience = annualResilienceValue(useCase);
    const annualSavings = tou + resilience;
    const paybackYears = annualSavings > 0 ? Math.round((net.mid / annualSavings) * 10) / 10 : null;

    return {
      gross, federalCredit, stateAmt, stateRebate, net, fedRate,
      annualSavings, tou, resilience, paybackYears,
    };
  }, [state, kwh, useCase, chemistry, paired, panel, installYear]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <>
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input
            type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 02134"
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-600">Optional — auto-detects state</p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">
            Usable capacity: <span className="font-bold tabular-nums text-ink-900">{kwh} kWh</span>
          </label>
          <input
            type="range" min={5} max={40} step={0.5} value={kwh}
            onChange={e => setKwh(Number(e.target.value))}
            className="mt-2 w-full accent-brand-600"
          />
          <div className="mt-1 flex justify-between text-[10px] text-ink-600">
            <span>5 kWh (small)</span><span>13.5 kWh (Powerwall)</span><span>40 kWh (large)</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Use case</label>
          <select className="input mt-1 w-full" value={useCase} onChange={e => setUseCase(e.target.value as UseCase)}>
            <option value="self_consumption">Self-consumption (NEM 3.0 / VDER)</option>
            <option value="tou_arbitrage">Time-of-use arbitrage</option>
            <option value="backup_only">Backup-only (critical loads)</option>
            <option value="full_home_backup">Full-home backup</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Cell chemistry</label>
          <select className="input mt-1 w-full" value={chemistry} onChange={e => setChemistry(e.target.value as Chemistry)}>
            <option value="lfp">LFP (LiFePO4 — safer, longer-cycle)</option>
            <option value="nmc">NMC (denser, older Powerwall, LG)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Paired with new solar?</label>
          <select className="input mt-1 w-full" value={paired} onChange={e => setPaired(e.target.value as PairedSolar)}>
            <option value="yes">Yes — installed together (cheaper)</option>
            <option value="no">No — retrofit to existing panels</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Main panel</label>
          <select className="input mt-1 w-full" value={panel} onChange={e => setPanel(e.target.value as Panel)}>
            <option value="200A">200A (standard)</option>
            <option value="100A">100A (may need subpanel for backup)</option>
            <option value="unknown">Unknown</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Install year</label>
          <select className="input mt-1 w-full" value={installYear} onChange={e => setInstallYear(Number(e.target.value))}>
            <option value={2026}>2026 (no federal — 25D expired)</option>
            <option value={2027}>2027 (no federal)</option>
            <option value={2028}>2028 (no federal)</option>
            <option value={2025}>2025 (historical — last 30% year)</option>
          </select>
          <p className="mt-1 text-[11px] text-ink-600">25D Residential Clean Energy Credit terminated by OBBBA for property placed in service after 2025-12-31.</p>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-blue-300/60 bg-gradient-to-br from-blue-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            Estimated installed cost · {kwh} kWh · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)} gross</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">Net after incentives (mid)</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-blue-800">{fmtUSD(result.net.mid)}</p>
              <p className="mt-1 text-[11px] text-ink-600">Range {fmtUSDRange(result.net.low, result.net.high)}</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">
                {result.paybackYears != null && result.paybackYears <= 25 ? 'Payback' : 'Annual benefit'}
              </p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-blue-800">
                {result.paybackYears != null && result.paybackYears <= 25
                  ? `${result.paybackYears} yr`
                  : `${fmtUSD(result.annualSavings)}/yr`}
              </p>
              <p className="mt-1 text-[11px] text-ink-600">
                TOU + resilience savings
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Incentive stack</h3>
            <ul className="mt-3 space-y-2 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-ink-700">Federal 25D ({Math.round(result.fedRate * 100)}%, ≥3 kWh)</span>
                <span className="font-medium tabular-nums text-brand-700">
                  −{fmtUSD(result.federalCredit.mid)}
                </span>
              </li>
              {result.stateRebate && (
                <li className="flex justify-between gap-3">
                  <span className="text-ink-700">{result.stateRebate.name}</span>
                  <span className="font-medium tabular-nums text-brand-700">
                    {result.stateAmt.mid > 0 ? `−${fmtUSD(result.stateAmt.mid)}` : 'see note'}
                  </span>
                </li>
              )}
              {result.stateRebate?.note && (
                <li className="text-[11px] text-ink-600 leading-relaxed">{result.stateRebate.note}</li>
              )}
            </ul>
            <p className="mt-3 text-[11px] text-ink-600">
              Federal 25D credit (30% standalone battery ≥3 kWh) was terminated by OBBBA for property placed in service after 2025-12-31. State programs vary; verify income tier and capacity caps with the program administrator.
            </p>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Benefits estimate</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Annual TOU savings</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{fmtUSD(result.tou)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Resilience value</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{fmtUSD(result.resilience)}/yr</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Useful cycles</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">~6,000 (LFP) / ~3,500 (NMC)</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Warranty (typical)</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">10 yr / 70% capacity</dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-ink-600">
              Resilience value is a conservative annualized figure; actual avoided-outage cost can be much higher during sustained outages or for medical-baseline households.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Note:</strong> Payback math for batteries is best-case in TOU-aggressive states (CA, MA, NY, HI). In flat-rate utility territory the financial case usually depends on outage avoidance, not arbitrage. The resilience value here is a placeholder — quantify your own based on outage frequency and what you'd lose.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Usable capacity (not nameplate) and end-of-warranty capacity retention (typically 70-80%).</li>
            <li>· Round-trip efficiency (modern systems 89-92%).</li>
            <li>· Cycle warranty (10,000 cycles for LFP, 6,000-7,000 for NMC).</li>
            <li>· Backup loads and transfer time (whole-home transfer: ms to seconds; partial: instant via dedicated subpanel).</li>
            <li>· Whether the inverter is integrated (Powerwall 3, Franklin) or separate (Enphase requires separate IQ8 microinverters or System Controller).</li>
            <li>· Monitoring, software updates, and grid-services enrollment (Tesla VPP, Sunrun Connected Solutions, etc.).</li>
            <li>· Permit and interconnection lead time — typical 4–10 weeks in 2026.</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="home-battery"
    />
    </>
  );
}
