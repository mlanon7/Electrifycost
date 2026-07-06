import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, stateEnergy } from '@/lib/data';
import { fmtUSD } from '@/lib/format';

type Category = 'compact' | 'sedan' | 'suv' | 'truck' | 'luxury';
type Hold = 5 | 8 | 10;
type NewUsed = 'new' | 'used';
type CreditEligible = 'yes' | 'no' | 'unknown';

// Federal 30D (new) and 25E (used) Clean Vehicle Credits — under OBBBA both terminated
// for vehicles ACQUIRED after 2025-09-30. Date-of-acquisition is the legal trigger.
// Verify with IRS: https://www.irs.gov/clean-vehicle-tax-credits
// New: $7,500 max with income caps ($300k joint / $225k HoH / $150k single) + MSRP caps ($80k SUV/truck/van, $55k car).
// Used: min($4,000, 30% of sale price) — must be from licensed dealer, vehicle ≥2 model years old, sale price ≤$25,000.
function federalCredit(newOrUsed: NewUsed, eligible: CreditEligible, acquisitionYYYYMMDD: string, salePrice: number): number {
  if (eligible !== 'yes') return 0;
  // Termination: vehicles acquired after 2025-09-30 get no credit.
  if (acquisitionYYYYMMDD > '2025-09-30') return 0;
  if (newOrUsed === 'new') return 7500;
  // Used: 30% of sale price, capped at $4,000.
  return Math.min(4000, Math.round(salePrice * 0.30));
}

// State EV credit snapshot (2026). Conservative; verify with state revenue/energy department.
const STATE_EV_CREDIT: Record<string, { amount: number; note: string }> = {
  CA: { amount: 0, note: 'CVRP rebate paused 2023; CalCAP-EV and CC4A income-tested replacements available' },
  CO: { amount: 5000, note: 'Innovative Motor Vehicle Credit (refundable income-tax credit, $5,000 new EV through 2026)' },
  CT: { amount: 4250, note: 'CHEAPR rebate — base + income-tier adders for qualifying vehicles' },
  DE: { amount: 2500, note: 'DE Clean Vehicle Rebate Program' },
  IL: { amount: 4000, note: 'IL EV Rebate Program (eligibility windows; check current funding)' },
  ME: { amount: 2000, note: 'Efficiency Maine EV rebate (income-tiered)' },
  MD: { amount: 3000, note: 'MD Excise Tax Credit (limited budget; first-come)' },
  MA: { amount: 3500, note: 'MOR-EV (base + income tier adder)' },
  NJ: { amount: 4000, note: 'NJ Charge Up rebate (limited budget; check status)' },
  NY: { amount: 2000, note: 'NYS Drive Clean Rebate' },
  OR: { amount: 2500, note: 'OR Clean Vehicle Rebate (Standard + Charge Ahead income-tier)' },
  PA: { amount: 2000, note: 'PA AFV Rebate' },
  RI: { amount: 2500, note: 'RI DRIVE EV rebate' },
  VT: { amount: 4000, note: 'VT EV Incentive Program (income-tiered)' },
};

// EV efficiency by category (kWh/mile, real-world including charging losses)
// EPA combined ratings, +15% charging losses for at-home AC L2 charging
const EV_KWH_PER_MILE: Record<Category, number> = {
  compact: 0.28,    // Chevy Bolt, MINI SE
  sedan: 0.30,      // Tesla Model 3, Hyundai Ioniq 6, Polestar 2
  suv: 0.36,        // Tesla Model Y, VW ID.4, Hyundai Ioniq 5
  truck: 0.45,      // F-150 Lightning, Cybertruck, Silverado EV
  luxury: 0.38,     // Lucid Air, BMW iX, Mercedes EQS
};

// Gas MPG combined by category (EPA averages 2024)
const GAS_MPG: Record<Category, number> = {
  compact: 36,      // Civic, Corolla
  sedan: 32,        // Camry, Accord
  suv: 26,          // CR-V, RAV4, Highlander
  truck: 22,        // F-150, Silverado V6
  luxury: 26,       // BMW 3 Series, Mercedes E
};

// Maintenance cost per mile (Consumer Reports 2024, AAA TrueCost)
// EVs save ~$0.05-0.06/mile in maintenance over equivalent ICE
const MAINT_PER_MILE: Record<'ev' | 'gas', number> = {
  ev: 0.045,    // tires, wipers, brake pads (very rare), 12V battery
  gas: 0.105,   // oil changes, brakes, exhaust, transmission, spark plugs, belts
};

// Insurance differential (EVs typically 8-15% higher due to repair complexity)
const INSURANCE_EV_MULT = 1.10;

// Depreciation per year as % of original purchase price
// EVs depreciated faster historically; new model years post-2023 trending toward parity
const DEPRECIATION_PER_YEAR: Record<'ev' | 'gas', { y1: number; y2to5: number; y6plus: number }> = {
  ev:  { y1: 0.18, y2to5: 0.11, y6plus: 0.08 },     // ~62% remaining at 5 yr (faster than historic norm)
  gas: { y1: 0.15, y2to5: 0.10, y6plus: 0.07 },     // ~65% remaining at 5 yr
};

interface CostBand { low: number; mid: number; high: number; }

function tco(
  purchasePrice: number,
  fuelOrCharge: 'ev' | 'gas',
  miles: number,
  years: number,
  effPerMile: number,
  pricePerUnit: number,    // $/kWh for EV, $/gal for gas (gallon equivalent)
  insuranceBase: number,
  fedCredit: number,
  stateCredit: number,
): { purchase: number; credit: number; net: number; fuel: number; maint: number; insurance: number; deprec: number; residual: number; total: number } {
  const credit = fedCredit + stateCredit;
  // "Net purchase" = what you actually pay up-front after credits (cannot go below 0)
  const net = Math.max(0, purchasePrice - credit);

  // Fuel/charging cost
  const fuelPerMile = fuelOrCharge === 'gas' ? (1 / effPerMile) * pricePerUnit
                                              : effPerMile * pricePerUnit;
  const fuel = fuelPerMile * miles * years;

  const maint = MAINT_PER_MILE[fuelOrCharge] * miles * years;
  const insurance = insuranceBase * (fuelOrCharge === 'ev' ? INSURANCE_EV_MULT : 1.0) * years;

  // Residual value after hold period (% of original purchase price)
  const dep = DEPRECIATION_PER_YEAR[fuelOrCharge];
  let remainingFrac = 1.0;
  for (let y = 1; y <= years; y++) {
    if (y === 1) remainingFrac *= (1 - dep.y1);
    else if (y <= 5) remainingFrac *= (1 - dep.y2to5);
    else remainingFrac *= (1 - dep.y6plus);
  }
  const residual = purchasePrice * remainingFrac;
  const depreciation = purchasePrice - residual;  // gross dollars lost to depreciation

  // CORRECT TCO = ownership cost over hold period
  // = (net purchase price paid) − (residual recovered at sale) + operating costs
  // Equivalent: depreciation − credit + operating
  // Sanity test: $40k purchase, $0 credit, $20k residual, $10k op cost → $30k total. ✓
  const total = net - residual + fuel + maint + insurance;

  return { purchase: purchasePrice, credit, net, fuel, maint, insurance, deprec: depreciation, residual, total };
}

export default function EvTcoCalculator() {
  useCalculatorUsed('ev-tco');
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [category, setCategory] = useState<Category>('sedan');
  const [evPrice, setEvPrice] = useState(42000);
  const [gasPrice, setGasPrice] = useState(32000);
  const [miles, setMiles] = useState(12000);
  const [hold, setHold] = useState<Hold>(8);
  const [gasGalPrice, setGasGalPrice] = useState(3.50);
  const [newOrUsed, setNewOrUsed] = useState<NewUsed>('new');
  const [credEligible, setCredEligible] = useState<CreditEligible>('unknown');
  const [acquisitionDate, setAcquisitionDate] = useState('2026-05-11');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const eRow = stateEnergy.find(e => e.state === state);
    const elecRate = eRow ? eRow.electricity_cents_per_kwh / 100 : 0.16;
    const insuranceBase = category === 'luxury' ? 2200 : category === 'truck' ? 1800 : 1500;

    const fedCred = federalCredit(newOrUsed, credEligible, acquisitionDate, evPrice);
    const stateInfo = STATE_EV_CREDIT[state];
    const stateCred = stateInfo?.amount ?? 0;

    const ev = tco(evPrice, 'ev', miles, hold, EV_KWH_PER_MILE[category], elecRate, insuranceBase, fedCred, stateCred);
    const gas = tco(gasPrice, 'gas', miles, hold, GAS_MPG[category], gasGalPrice, insuranceBase, 0, 0);

    const evSavings = gas.total - ev.total;
    const annualFuelSavings = (gas.fuel - ev.fuel) / hold;
    const annualMaintSavings = (gas.maint - ev.maint) / hold;
    const breakeven = (ev.net - gas.net) > 0
      ? Math.round(((ev.net - gas.net) / (annualFuelSavings + annualMaintSavings - (ev.insurance - gas.insurance) / hold)) * 10) / 10
      : 0;

    return { ev, gas, evSavings, elecRate, fedCred, stateCred, stateInfo, annualFuelSavings, annualMaintSavings, breakeven };
  }, [state, category, evPrice, gasPrice, miles, hold, gasGalPrice, newOrUsed, credEligible, acquisitionDate]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label htmlFor="evtco-zip" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input
            id="evtco-zip"
            type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 94103"
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-600">Optional — auto-detects state</p>
        </div>

        <div>
          <label htmlFor="evtco-state" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select id="evtco-state" className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="evtco-category" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Vehicle category</label>
          <select id="evtco-category" className="input mt-1 w-full" value={category} onChange={e => setCategory(e.target.value as Category)}>
            <option value="compact">Compact (Bolt, MINI SE) · 0.28 kWh/mi · 36 mpg</option>
            <option value="sedan">Sedan (Model 3, Ioniq 6) · 0.30 kWh/mi · 32 mpg</option>
            <option value="suv">SUV (Model Y, ID.4) · 0.36 kWh/mi · 26 mpg</option>
            <option value="truck">Truck (Lightning, Silverado EV) · 0.45 kWh/mi · 22 mpg</option>
            <option value="luxury">Luxury (Lucid Air, BMW iX) · 0.38 kWh/mi · 26 mpg</option>
          </select>
        </div>

        <div>
          <label htmlFor="evtco-hold" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Hold period</label>
          <select id="evtco-hold" className="input mt-1 w-full" value={hold} onChange={e => setHold(Number(e.target.value) as Hold)}>
            <option value={5}>5 years</option>
            <option value={8}>8 years</option>
            <option value={10}>10 years</option>
          </select>
        </div>

        <div>
          <label htmlFor="evtco-ev-price" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">EV price (MSRP, less options)</label>
          <input
            id="evtco-ev-price"
            type="number" min={15000} max={150000} step={500} value={evPrice}
            onChange={e => setEvPrice(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
        </div>

        <div>
          <label htmlFor="evtco-gas-price" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Equivalent gas vehicle price</label>
          <input
            id="evtco-gas-price"
            type="number" min={15000} max={150000} step={500} value={gasPrice}
            onChange={e => setGasPrice(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
        </div>

        <div>
          <label htmlFor="evtco-miles" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Annual miles</label>
          <input
            id="evtco-miles"
            type="number" min={1000} max={40000} step={500} value={miles}
            onChange={e => setMiles(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
        </div>

        <div>
          <label htmlFor="evtco-gas-gal-price" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Gas price ($/gal)</label>
          <input
            id="evtco-gas-gal-price"
            type="number" min={2.0} max={7.0} step={0.05} value={gasGalPrice}
            onChange={e => setGasGalPrice(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
        </div>

        <div>
          <label htmlFor="evtco-new-used" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">New or used</label>
          <select id="evtco-new-used" className="input mt-1 w-full" value={newOrUsed} onChange={e => setNewOrUsed(e.target.value as NewUsed)}>
            <option value="new">New ($7,500 federal credit if eligible &amp; pre-2025-09-30)</option>
            <option value="used">Used (30% × price, max $4,000, if pre-2025-09-30)</option>
          </select>
        </div>

        <div>
          <label htmlFor="evtco-acquisition-date" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Acquisition date</label>
          <input id="evtco-acquisition-date" type="date" className="input mt-1 w-full" value={acquisitionDate}
            onChange={e => setAcquisitionDate(e.target.value)} />
          <p className="mt-1 text-[11px] text-ink-600">30D + 25E credits ended for vehicles acquired after 2025-09-30 (OBBBA).</p>
        </div>

        <div>
          <label htmlFor="evtco-cred-eligible" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Federal credit eligibility?</label>
          <select id="evtco-cred-eligible" className="input mt-1 w-full" value={credEligible} onChange={e => setCredEligible(e.target.value as CreditEligible)}>
            <option value="unknown">Unknown</option>
            <option value="yes">Yes — meets sourcing + income + MSRP caps</option>
            <option value="no">No — exceeds caps or non-qualifying model</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-blue-300/60 bg-gradient-to-br from-blue-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
            {hold}-year total cost of ownership · {stateName}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700">EV ({fmtUSD(result.ev.net)} net)</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-blue-800">{fmtUSD(result.ev.total)}</p>
              <p className="mt-1 text-[11px] text-ink-600">over {hold} years</p>
            </div>
            <div className="rounded-lg border border-ink-200 bg-white/70 p-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-700">Gas ({fmtUSD(result.gas.net)} net)</p>
              <p className="mt-0.5 text-2xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gas.total)}</p>
              <p className="mt-1 text-[11px] text-ink-600">over {hold} years</p>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">
              {result.evSavings >= 0 ? 'EV saves over hold period' : 'EV costs more over hold period'}
            </p>
            <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">
              {result.evSavings >= 0 ? '+' : ''}{fmtUSD(result.evSavings)}
            </p>
            <p className="mt-1 text-[11px] text-ink-700">
              Breakeven: {result.breakeven > 0 ? `${result.breakeven} years` : 'EV cheaper from day 1'} · annual fuel savings ~{fmtUSD(result.annualFuelSavings)} · annual maintenance savings ~{fmtUSD(result.annualMaintSavings)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">EV breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3"><span>Purchase price</span><span className="tabular-nums">{fmtUSD(result.ev.purchase)}</span></li>
              <li className="flex justify-between gap-3"><span>Federal 30D credit</span><span className="tabular-nums text-brand-700">−{fmtUSD(result.fedCred)}</span></li>
              <li className="flex justify-between gap-3"><span>State EV credit</span><span className="tabular-nums text-brand-700">−{fmtUSD(result.stateCred)}</span></li>
              <li className="flex justify-between gap-3 font-semibold"><span>Net purchase</span><span className="tabular-nums">{fmtUSD(result.ev.net)}</span></li>
              <li className="flex justify-between gap-3"><span>Charging cost ({result.elecRate.toFixed(2)}/kWh × {hold} yr)</span><span className="tabular-nums">{fmtUSD(result.ev.fuel)}</span></li>
              <li className="flex justify-between gap-3"><span>Maintenance ({hold} yr)</span><span className="tabular-nums">{fmtUSD(result.ev.maint)}</span></li>
              <li className="flex justify-between gap-3"><span>Insurance ({hold} yr)</span><span className="tabular-nums">{fmtUSD(result.ev.insurance)}</span></li>
              <li className="flex justify-between gap-3"><span>Depreciation</span><span className="tabular-nums">{fmtUSD(result.ev.deprec)}</span></li>
            </ul>
            {result.stateInfo?.note && (
              <p className="mt-3 text-[11px] text-ink-600 leading-relaxed">{result.stateInfo.note}</p>
            )}
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Gas breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3"><span>Purchase price</span><span className="tabular-nums">{fmtUSD(result.gas.purchase)}</span></li>
              <li className="flex justify-between gap-3 font-semibold"><span>Net purchase</span><span className="tabular-nums">{fmtUSD(result.gas.net)}</span></li>
              <li className="flex justify-between gap-3"><span>Fuel cost (${gasGalPrice}/gal × {hold} yr)</span><span className="tabular-nums">{fmtUSD(result.gas.fuel)}</span></li>
              <li className="flex justify-between gap-3"><span>Maintenance ({hold} yr)</span><span className="tabular-nums">{fmtUSD(result.gas.maint)}</span></li>
              <li className="flex justify-between gap-3"><span>Insurance ({hold} yr)</span><span className="tabular-nums">{fmtUSD(result.gas.insurance)}</span></li>
              <li className="flex justify-between gap-3"><span>Depreciation</span><span className="tabular-nums">{fmtUSD(result.gas.deprec)}</span></li>
            </ul>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Caveats:</strong> Federal 30D + 25E credits expired for vehicles acquired after 2025-09-30 (OBBBA). State EV credits vary by funding status — confirm with your state revenue/energy department before counting on them. Depreciation curves assume normal mileage and well-cared-for vehicle.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Things this calculator doesn't include</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Home Level 2 charger install (typically $800–$2,800 — see EV charger calculator).</li>
            <li>· Time-of-use electricity rates (most utilities offer EV-friendly TOU plans with 8-12¢/kWh overnight).</li>
            <li>· Public DC fast-charging premium ($0.35-0.55/kWh) for road trips.</li>
            <li>· State vehicle registration fee surcharges some states levy on EVs ($100–$250/year).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
