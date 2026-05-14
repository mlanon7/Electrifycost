import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateEnergy, solarProductionByState } from '@/lib/data';
import { fmtUSD } from '@/lib/format';

type Financing = 'cash' | 'loan';
type NemTier = 'full_nem' | 'partial' | 'tariff_minimal';

const NEM_PCT: Record<NemTier, number> = {
  full_nem: 1.0,
  partial: 0.75,
  tariff_minimal: 0.40,
};

function lookupAcAnnualPerKw(state: string): number {
  const row = solarProductionByState.find(r => r.state === state);
  return row ? Number(row.ac_kwh_per_kw_year) || 1300 : 1300;
}

export default function SolarPaybackCalculator() {
  const [state, setState] = useState('TX');
  const [zip, setZip] = useState('');
  const [systemKw, setSystemKw] = useState(8);
  const [costPerWatt, setCostPerWatt] = useState(3.50);
  const [financing, setFinancing] = useState<Financing>('cash');
  const [loanRate, setLoanRate] = useState(7.0);
  const [loanYears, setLoanYears] = useState(15);
  const [nemTier, setNemTier] = useState<NemTier>('full_nem');
  const [annualEscalation, setAnnualEscalation] = useState(3.5);
  const [selfConsumption, setSelfConsumption] = useState(35);

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const energy = findStateEnergy(state);
    const elec = (energy?.electricity_cents_per_kwh ?? 16) / 100;
    const acPerKw = lookupAcAnnualPerKw(state);

    const grossCost = systemKw * 1000 * costPerWatt;

    // 25D federal credit terminated for 2026+ installs per OBBBA
    const installYear = new Date().getFullYear();
    const fed25D = installYear <= 2025 ? grossCost * 0.30 : 0;
    const netCost = Math.max(0, grossCost - fed25D);

    // First-year generation
    const firstYearKwh = systemKw * acPerKw;
    const selfPct = selfConsumption / 100;
    const exportPct = 1 - selfPct;
    const nemCreditRate = elec * NEM_PCT[nemTier];

    // First year revenue: self-consumed offsets at full retail, exports at NEM rate
    const yearOneRevenue = firstYearKwh * (selfPct * elec + exportPct * nemCreditRate);

    // 25-year cumulative model
    let cumulative = 0;
    let paybackYear: number | null = null;
    const escal = annualEscalation / 100;
    const degradation = 0.005; // 0.5%/yr
    const cashflow: { year: number; revenue: number; cumulative: number }[] = [];

    for (let y = 1; y <= 25; y++) {
      const yearKwh = firstYearKwh * Math.pow(1 - degradation, y - 1);
      const yearElecRate = elec * Math.pow(1 + escal, y - 1);
      const yearNem = yearElecRate * NEM_PCT[nemTier];
      const yearRev = yearKwh * (selfPct * yearElecRate + exportPct * yearNem);
      cumulative += yearRev;
      cashflow.push({ year: y, revenue: yearRev, cumulative });
      if (paybackYear === null && cumulative >= netCost) paybackYear = y;
    }

    // Inverter replacement in year 12
    const inverterReplacementCost = systemKw * 1000 * 0.25;
    const lifetime25YearProfit = cumulative - netCost - inverterReplacementCost;
    const roi25Year = netCost > 0 ? (lifetime25YearProfit / netCost) * 100 : 0;

    // For loan: simple monthly payment
    let loanMonthlyPayment = 0;
    if (financing === 'loan') {
      const monthlyRate = loanRate / 100 / 12;
      const n = loanYears * 12;
      loanMonthlyPayment = monthlyRate > 0
        ? netCost * (monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
        : netCost / n;
    }
    const yearOneMonthlyAvgRevenue = yearOneRevenue / 12;
    const isCashPositiveDay1 = financing === 'loan' && yearOneMonthlyAvgRevenue > loanMonthlyPayment;

    return {
      grossCost, fed25D, netCost,
      firstYearKwh, yearOneRevenue,
      paybackYear, lifetime25YearProfit, roi25Year,
      inverterReplacementCost,
      loanMonthlyPayment, yearOneMonthlyAvgRevenue, isCashPositiveDay1,
      cashflow,
    };
  }, [state, systemKw, costPerWatt, financing, loanRate, loanYears, nemTier, annualEscalation, selfConsumption]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
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

        <div>
          <label className="label" htmlFor="kw">System size (kW DC)</label>
          <input id="kw" className="input" type="number" min={2} max={30} step={0.5} value={systemKw} onChange={e => setSystemKw(Number(e.target.value) || 0)} />
          <p className="mt-1 text-[10px] text-ink-500">US median residential: 8 kW (LBNL 2024)</p>
        </div>
        <div>
          <label className="label" htmlFor="cpw">Installed cost per watt ($)</label>
          <input id="cpw" className="input" type="number" min={2} max={6} step={0.05} value={costPerWatt} onChange={e => setCostPerWatt(Number(e.target.value) || 0)} />
          <p className="mt-1 text-[10px] text-ink-500">US median 2024: $3.50/W (LBNL)</p>
        </div>

        <div>
          <label className="label" htmlFor="nem">Net metering tier</label>
          <select id="nem" className="input" value={nemTier} onChange={e => setNemTier(e.target.value as NemTier)}>
            <option value="full_nem">Full NEM (1:1 retail rate credit)</option>
            <option value="partial">Partial (60-90% retail rate)</option>
            <option value="tariff_minimal">Tariff / minimal (CA NEM 3.0 type)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="financing">Financing</label>
          <select id="financing" className="input" value={financing} onChange={e => setFinancing(e.target.value as Financing)}>
            <option value="cash">Cash purchase</option>
            <option value="loan">Solar loan</option>
          </select>
        </div>

        {financing === 'loan' && (
          <>
            <div>
              <label className="label" htmlFor="rate">Loan APR (%)</label>
              <input id="rate" className="input" type="number" min={0} max={15} step={0.1} value={loanRate} onChange={e => setLoanRate(Number(e.target.value) || 0)} />
            </div>
            <div>
              <label className="label" htmlFor="years">Loan term (years)</label>
              <input id="years" className="input" type="number" min={5} max={25} step={1} value={loanYears} onChange={e => setLoanYears(Number(e.target.value) || 1)} />
            </div>
          </>
        )}

        <div>
          <label className="label" htmlFor="escal">Annual electricity escalation (%)</label>
          <input id="escal" className="input" type="number" min={0} max={10} step={0.5} value={annualEscalation} onChange={e => setAnnualEscalation(Number(e.target.value) || 0)} />
          <p className="mt-1 text-[10px] text-ink-500">EIA AEO 2024 reference: ~3.5%/yr</p>
        </div>
        <div>
          <label className="label" htmlFor="self">Self-consumption % (no battery: ~35%)</label>
          <input id="self" className="input" type="number" min={20} max={95} step={1} value={selfConsumption} onChange={e => setSelfConsumption(Number(e.target.value) || 0)} />
          <p className="mt-1 text-[10px] text-ink-500">With 10 kWh battery: ~75%</p>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-amber-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Payback analysis · {systemKw} kW · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{result.paybackYear ? `${result.paybackYear} yr` : '25+ yr'}</p>
            <p className="text-sm text-ink-600">simple payback at current rates</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Year-1 revenue</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.yearOneRevenue)}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">25-yr profit</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.lifetime25YearProfit)}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">25-yr ROI</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{Math.round(result.roi25Year)}%</p>
            </div>
          </div>
          {financing === 'loan' && (
            <div className="mt-4 rounded-lg border border-brand-300 bg-white/80 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Monthly: solar revenue vs loan payment</p>
              <p className="mt-1 text-sm tabular-nums text-ink-900">
                Year-1 avg solar revenue: <strong>{fmtUSD(result.yearOneMonthlyAvgRevenue)}/mo</strong> · Loan payment: <strong>{fmtUSD(result.loanMonthlyPayment)}/mo</strong>
              </p>
              <p className="mt-1 text-[11px] {result.isCashPositiveDay1 ? 'text-brand-700' : 'text-amber-700'}">
                {result.isCashPositiveDay1 ? '✓ Cash-positive from day one' : '⚠ Monthly payment exceeds year-1 revenue; rises later'}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Net cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Gross install cost</span><span className="tabular-nums">{fmtUSD(result.grossCost)}</span></li>
              <li className="flex justify-between"><span>Federal 25D credit (expired 2025-12-31)</span><span className="tabular-nums text-rose-700">−{fmtUSD(result.fed25D)}</span></li>
              <li className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><span>Net cost</span><span className="tabular-nums">{fmtUSD(result.netCost)}</span></li>
              <li className="flex justify-between text-[11px] text-ink-500"><span>Inverter replacement (year 12)</span><span className="tabular-nums">{fmtUSD(result.inverterReplacementCost)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Key assumptions</h3>
            <ul className="mt-3 space-y-1 text-[12px] text-ink-700">
              <li>· Year-1 production: <strong>{Math.round(result.firstYearKwh).toLocaleString()} kWh</strong></li>
              <li>· Panel degradation: 0.5%/yr (modern Tier-1)</li>
              <li>· Electricity escalation: {annualEscalation}%/yr</li>
              <li>· NEM credit rate: {Math.round(NEM_PCT[nemTier] * 100)}% of retail</li>
              <li>· Self-consumption: {selfConsumption}%</li>
              <li>· Inverter replacement: year 12, ${(0.25).toFixed(2)}/W</li>
              <li>· 25-year horizon, no resale value</li>
            </ul>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Federal credit note:</strong> 25D (Residential Clean Energy Credit, 30% with no cap) covered solar through 2025-12-31. OBBBA (signed July 4 2025) terminated 25D for property placed in service after that date. Solar installs in 2026+ no longer have a federal tax credit. Some states (NY, MD, NC, MA, IA) still have state-level solar credits or production-based incentives — check DSIRE.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Cashflow over 25 years (every 5 yr)</h3>
          <table className="mt-2 w-full text-xs">
            <thead className="text-ink-600">
              <tr><th className="text-left py-1">Year</th><th className="text-right">Annual</th><th className="text-right">Cumulative</th></tr>
            </thead>
            <tbody>
              {result.cashflow.filter(c => c.year === 1 || c.year % 5 === 0 || c.year === 25).map(c => (
                <tr key={c.year} className="border-t border-ink-100">
                  <td className="py-1.5">Year {c.year}</td>
                  <td className="text-right tabular-nums">{fmtUSD(c.revenue)}</td>
                  <td className={`text-right tabular-nums ${c.cumulative >= result.netCost ? 'text-brand-700 font-medium' : ''}`}>{fmtUSD(c.cumulative)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
