import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor, findStateEnergy, findClimate } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';

type Fuel = 'natural_gas' | 'propane' | 'heating_oil' | 'electric';
type Tier = 'standard' | 'condensing' | 'modulating';
type Size = 'small' | 'medium' | 'large';

interface Band { low: number; mid: number; high: number; }

// Per CSV: boiler-cost-ranges.csv (Modernize 2024 + DOE 2024)
const BOILER: Record<Fuel, Record<Tier, { equipment: Record<Size, Band>; labor: Band; afue: number; label: string }>> = {
  natural_gas: {
    standard: {
      afue: 85, label: 'Cast-iron 85% AFUE',
      equipment: {
        small:  { low: 2200, mid: 3100, high: 4000 },
        medium: { low: 2500, mid: 3500, high: 4500 },
        large:  { low: 3200, mid: 4500, high: 5800 },
      },
      labor: { low: 2500, mid: 3500, high: 4500 },
    },
    condensing: {
      afue: 95, label: 'Condensing 95% AFUE',
      equipment: {
        small:  { low: 4000, mid: 5400, high: 7000 },
        medium: { low: 4500, mid: 6000, high: 8000 },
        large:  { low: 5400, mid: 7200, high: 9500 },
      },
      labor: { low: 3500, mid: 5000, high: 6500 },
    },
    modulating: {
      afue: 96, label: 'Modulating 96% AFUE (premium)',
      equipment: {
        small:  { low: 5500, mid: 7800, high: 10000 },
        medium: { low: 6000, mid: 8500, high: 11000 },
        large:  { low: 6800, mid: 9500, high: 12500 },
      },
      labor: { low: 4000, mid: 5500, high: 7500 },
    },
  },
  propane: {
    standard: {
      afue: 85, label: 'Propane 85% AFUE',
      equipment: {
        small:  { low: 2500, mid: 3500, high: 4500 },
        medium: { low: 2800, mid: 4000, high: 5200 },
        large:  { low: 3500, mid: 5000, high: 6500 },
      },
      labor: { low: 2700, mid: 3800, high: 5000 },
    },
    condensing: {
      afue: 95, label: 'Propane condensing 95% AFUE',
      equipment: {
        small:  { low: 4300, mid: 5800, high: 7500 },
        medium: { low: 4800, mid: 6500, high: 8500 },
        large:  { low: 5800, mid: 7800, high: 10000 },
      },
      labor: { low: 3500, mid: 5000, high: 6500 },
    },
    modulating: {
      afue: 96, label: 'Propane modulating premium',
      equipment: {
        small:  { low: 5800, mid: 8000, high: 10500 },
        medium: { low: 6500, mid: 9000, high: 11500 },
        large:  { low: 7200, mid: 10000, high: 13000 },
      },
      labor: { low: 4000, mid: 5500, high: 7500 },
    },
  },
  heating_oil: {
    standard: {
      afue: 85, label: 'Oil 85% AFUE',
      equipment: {
        small:  { low: 4000, mid: 5500, high: 7000 },
        medium: { low: 4500, mid: 6000, high: 7800 },
        large:  { low: 5500, mid: 7200, high: 9500 },
      },
      labor: { low: 3500, mid: 5000, high: 6500 },
    },
    condensing: {
      afue: 87, label: 'Premium oil 87% AFUE',
      equipment: {
        small:  { low: 5200, mid: 6800, high: 8800 },
        medium: { low: 5800, mid: 7500, high: 9800 },
        large:  { low: 6500, mid: 8500, high: 11000 },
      },
      labor: { low: 4000, mid: 5500, high: 7500 },
    },
    modulating: {
      afue: 87, label: 'Premium oil 87% AFUE (same as condensing)',
      equipment: {
        small:  { low: 5200, mid: 6800, high: 8800 },
        medium: { low: 5800, mid: 7500, high: 9800 },
        large:  { low: 6500, mid: 8500, high: 11000 },
      },
      labor: { low: 4000, mid: 5500, high: 7500 },
    },
  },
  electric: {
    standard: {
      afue: 100, label: 'Electric resistance',
      equipment: {
        small:  { low: 1800, mid: 2700, high: 3800 },
        medium: { low: 2200, mid: 3200, high: 4500 },
        large:  { low: 2800, mid: 4000, high: 5800 },
      },
      labor: { low: 1800, mid: 2800, high: 4000 },
    },
    condensing: {
      afue: 100, label: 'Electric resistance (same)',
      equipment: {
        small:  { low: 1800, mid: 2700, high: 3800 },
        medium: { low: 2200, mid: 3200, high: 4500 },
        large:  { low: 2800, mid: 4000, high: 5800 },
      },
      labor: { low: 1800, mid: 2800, high: 4000 },
    },
    modulating: {
      afue: 100, label: 'Electric resistance (same)',
      equipment: {
        small:  { low: 1800, mid: 2700, high: 3800 },
        medium: { low: 2200, mid: 3200, high: 4500 },
        large:  { low: 2800, mid: 4000, high: 5800 },
      },
      labor: { low: 1800, mid: 2800, high: 4000 },
    },
  },
};

function scale(b: Band, m: number): Band {
  return { low: b.low * m, mid: b.mid * m, high: b.high * m };
}
function add(a: Band, b: Band): Band {
  return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high };
}

// Hydronic-compatible heat pump (air-to-water) replacement
const HEAT_PUMP_HYDRONIC: Record<Size, Band> = {
  small:  { low: 14000, mid: 19000, high: 25000 },
  medium: { low: 17000, mid: 23000, high: 30000 },
  large:  { low: 22000, mid: 28000, high: 38000 },
};

export default function BoilerCalculator() {
  const [state, setState] = useState('MA');
  const [zip, setZip] = useState('');
  const [fuel, setFuel] = useState<Fuel>('natural_gas');
  const [tier, setTier] = useState<Tier>('condensing');
  const [size, setSize] = useState<Size>('medium');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const laborMult = lab?.hvac_multiplier ?? 1.0;
    const cfg = BOILER[fuel][tier];
    const equipment = cfg.equipment[size];
    const labor = scale(cfg.labor, laborMult);
    const permit: Band = { low: 200, mid: 400, high: 800 };
    const gross = add(add(equipment, labor), permit);

    const hp = HEAT_PUMP_HYDRONIC[size];
    return { equipment, labor, permit, gross, afue: cfg.afue, label: cfg.label, hp };
  }, [state, fuel, tier, size]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  const climate = findClimate(state)?.iecc_zone ?? '5A';

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
          <label className="label" htmlFor="fuel">Fuel</label>
          <select id="fuel" className="input" value={fuel} onChange={e => setFuel(e.target.value as Fuel)}>
            <option value="natural_gas">Natural gas (most common)</option>
            <option value="heating_oil">Heating oil (NE / rural)</option>
            <option value="propane">Propane (rural)</option>
            <option value="electric">Electric resistance (rare)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="tier">Efficiency tier</label>
          <select id="tier" className="input" value={tier} onChange={e => setTier(e.target.value as Tier)}>
            <option value="standard">Standard (cast-iron / older tech)</option>
            <option value="condensing">Condensing 95%+ AFUE</option>
            <option value="modulating">Modulating premium</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="label" htmlFor="size">Home size</label>
          <select id="size" className="input" value={size} onChange={e => setSize(e.target.value as Size)}>
            <option value="small">Small (≤1500 sqft) — 80-100k BTU</option>
            <option value="medium">Medium (1500-2500 sqft) — 100-140k BTU</option>
            <option value="large">Large (2500+ sqft) — 140-180k BTU</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-rose-300/60 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Installed cost · {result.label} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-rose-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-rose-700">Hydronic heat-pump alternative</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-rose-800">{fmtUSD(result.hp.mid)}</p>
              <p className="mt-1 text-[11px] text-ink-600">Air-to-water heat pump for hydronic distribution</p>
            </div>
            <div className="rounded-lg border border-rose-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-rose-700">AFUE</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-rose-800">{result.afue}%</p>
              <p className="mt-1 text-[11px] text-ink-600">Climate zone: {climate}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Equipment</span><span className="tabular-nums">{fmtUSD(result.equipment.mid)}</span></li>
              <li className="flex justify-between"><span>Labor (state-adjusted)</span><span className="tabular-nums">{fmtUSD(result.labor.mid)}</span></li>
              <li className="flex justify-between"><span>Permit &amp; inspection</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
              <li className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><span>Total (mid)</span><span className="tabular-nums">{fmtUSD(result.gross.mid)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Hydronic + heat pump?</h3>
            <p className="mt-2 text-sm text-ink-700">
              Air-to-water heat pumps (SpacePak, Chiltrix, Arctic Heat Pumps, Mitsubishi Ecodan) connect to your existing radiator/baseboard distribution. Capital cost is higher than a boiler — $14k–$30k installed — but operating cost is 50–65% lower, and you eliminate the carbon-monoxide and combustion risks of fuel-burning equipment.
            </p>
            <p className="mt-2 text-[11px] text-ink-500">
              Hydronic heat pumps typically work best with low-temperature distribution (in-floor or wall panel). Older high-temperature cast-iron baseboard may need supplemental backup.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Federal note:</strong> the 25C credit for boilers expired 2025-12-31 (OBBBA). HEEHRA / DOE Home Energy Rebates are electric-only — no federal subsidy on gas/oil/propane boilers in 2026. State and utility programs vary; check Mass Save (MA), NYSERDA Clean Heat (NY), Energy Trust of Oregon, and your local gas utility for any remaining rebates.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Heat-loss calculation in writing (Slant/Fin, Hydronics Institute IBR, or ACCA Manual J for hydronic).</li>
            <li>· AFUE and net rating both stated. Older nameplates list "input BTU" — what matters is net delivered.</li>
            <li>· Outdoor reset control included (cuts fuel ~10–15% by lowering supply temp on milder days).</li>
            <li>· Combustion analyzer printout from startup (CO, O2, stack temp). Without it, the install isn't tuned.</li>
            <li>· Expansion tank, low-water cutoff, and pressure relief valve replaced — they're consumables.</li>
            <li>· Indirect water heater integration if the old boiler did DHW too.</li>
            <li>· Asbestos abatement quote if existing pipe insulation is suspicious (pre-1980 homes).</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
