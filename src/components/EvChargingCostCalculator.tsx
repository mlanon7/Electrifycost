import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateEnergy } from '@/lib/data';
import { fmtUSD } from '@/lib/format';

type VehicleClass = 'sedan' | 'crossover' | 'suv' | 'pickup';
type ChargeMix = 'home_only' | 'mostly_home' | 'mixed' | 'mostly_public';

const KWH_PER_100MI: Record<VehicleClass, number> = { sedan: 28, crossover: 32, suv: 38, pickup: 42 };
const GAS_MPG: Record<VehicleClass, number> = { sedan: 38, crossover: 28, suv: 22, pickup: 20 };
const HOME_MIX_PCT: Record<ChargeMix, number> = { home_only: 1.0, mostly_home: 0.85, mixed: 0.60, mostly_public: 0.25 };

const AC_LOSS = 1.10; // 10% AC charge loss
const DCFC_LOSS = 1.05; // 5% DCFC loss
const DCFC_RATE = 0.42; // US average public DCFC rate ($/kWh)

export default function EvChargingCostCalculator() {
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [vehicle, setVehicle] = useState<VehicleClass>('crossover');
  const [annualMiles, setAnnualMiles] = useState(12000);
  const [chargeMix, setChargeMix] = useState<ChargeMix>('mostly_home');
  const [gasPrice, setGasPrice] = useState(3.45);

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const energy = findStateEnergy(state);
    const elec = (energy?.electricity_cents_per_kwh ?? 16) / 100;
    const kwhPer100 = KWH_PER_100MI[vehicle];

    const totalKwh = (annualMiles / 100) * kwhPer100;
    const homePct = HOME_MIX_PCT[chargeMix];
    const homeKwh = totalKwh * homePct * AC_LOSS;
    const publicKwh = totalKwh * (1 - homePct) * DCFC_LOSS;
    const homeCost = homeKwh * elec;
    const publicCost = publicKwh * DCFC_RATE;
    const evAnnualCost = homeCost + publicCost;
    const costPerMile = evAnnualCost / annualMiles;

    // Gas car equivalent
    const gasAnnualGallons = annualMiles / GAS_MPG[vehicle];
    const gasAnnualCost = gasAnnualGallons * gasPrice;
    const gasCostPerMile = gasAnnualCost / annualMiles;
    const annualSavings = gasAnnualCost - evAnnualCost;

    return { evAnnualCost, homeCost, publicCost, totalKwh, homeKwh, publicKwh, costPerMile, gasAnnualCost, gasCostPerMile, annualSavings };
  }, [state, vehicle, annualMiles, chargeMix, gasPrice]);

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
          <label className="label" htmlFor="vehicle">EV class</label>
          <select id="vehicle" className="input" value={vehicle} onChange={e => setVehicle(e.target.value as VehicleClass)}>
            <option value="sedan">Sedan (Model 3, Ioniq 6) — 28 kWh/100mi</option>
            <option value="crossover">Crossover (Model Y, Mach-E, Ioniq 5) — 32 kWh/100mi</option>
            <option value="suv">3-row SUV (R1S, EV9) — 38 kWh/100mi</option>
            <option value="pickup">Pickup (F-150 Lightning, R1T) — 42 kWh/100mi</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="miles">Annual miles</label>
          <input id="miles" className="input" type="number" min={3000} max={40000} step={500} value={annualMiles} onChange={e => setAnnualMiles(Number(e.target.value) || 0)} />
          <p className="mt-1 text-[10px] text-ink-500">US avg: 12,000 mi/yr</p>
        </div>

        <div>
          <label className="label" htmlFor="mix">Charging mix</label>
          <select id="mix" className="input" value={chargeMix} onChange={e => setChargeMix(e.target.value as ChargeMix)}>
            <option value="home_only">Home only (100%)</option>
            <option value="mostly_home">Mostly home (85% home, 15% public)</option>
            <option value="mixed">Mixed (60% home, 40% public)</option>
            <option value="mostly_public">Mostly public DCFC (25% home, 75% public)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="gas">Gas price for comparison ($/gal)</label>
          <input id="gas" className="input" type="number" min={2} max={7} step={0.05} value={gasPrice} onChange={e => setGasPrice(Number(e.target.value) || 0)} />
          <p className="mt-1 text-[10px] text-ink-500">US avg 2024: $3.45/gal</p>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-blue-300/60 bg-gradient-to-br from-blue-50 via-white to-brand-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">EV charging cost · {stateName}</p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.evAnnualCost)}/yr</p>
            <p className="text-sm text-ink-600">${result.costPerMile.toFixed(3)}/mile</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">Gas car at {GAS_MPG[vehicle]} mpg</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-blue-800">{fmtUSD(result.gasAnnualCost)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">${result.gasCostPerMile.toFixed(3)}/mile</p>
            </div>
            <div className="rounded-lg border border-blue-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">Annual savings</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-700">{fmtUSD(Math.max(0, result.annualSavings))}</p>
              <p className="mt-1 text-[11px] text-ink-600">{result.annualSavings > 0 ? 'EV cheaper to run' : 'Gas cheaper here'}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Total energy ({Math.round(result.totalKwh)} kWh/yr)</span><span className="tabular-nums">—</span></li>
              <li className="flex justify-between"><span>Home charging ({Math.round(result.homeKwh)} kWh)</span><span className="tabular-nums">{fmtUSD(result.homeCost)}</span></li>
              <li className="flex justify-between"><span>Public DCFC ({Math.round(result.publicKwh)} kWh)</span><span className="tabular-nums">{fmtUSD(result.publicCost)}</span></li>
              <li className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><span>Total EV cost</span><span className="tabular-nums">{fmtUSD(result.evAnnualCost)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Why public charging matters</h3>
            <p className="mt-2 text-sm text-ink-700">
              Public DCFC averages $0.42/kWh — 2.5× the typical home rate. If you DC-fast-charge 50% of your miles, your operating cost can double. The biggest savings lever is just plugging in at home overnight.
            </p>
            <p className="mt-2 text-[11px] text-ink-500">
              TOU (time-of-use) home rates with EV plans (PG&amp;E EV2-A, ConEd VoltageReady) drop overnight rates to 8-12¢/kWh — saving another 30-50%.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <strong>Not included here:</strong> the charging hardware, install, federal credits, purchase price, residual value, insurance, maintenance. This calculator is operating cost only — for full ownership cost see the <a href="/ev-total-cost-of-ownership-calculator/" className="underline">EV TCO calculator</a>.
        </div>
      </div>
    </div>
  );
}
