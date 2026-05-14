import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';

type Type = 'portable' | 'inverter' | 'standby_air' | 'standby_liquid';
type Fuel = 'natural_gas' | 'propane' | 'diesel' | 'gasoline';
type Transfer = 'none' | 'interlock' | 'ats_partial' | 'ats_whole';
type Sizing = '5kw' | '7kw' | '10kw' | '14kw' | '18kw' | '22kw' | '26kw';

interface CostBand { low: number; mid: number; high: number; }
const add = (a: CostBand, b: CostBand): CostBand => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand, m: number): CostBand => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// Equipment ranges 2026 (Generac, Kohler, Briggs & Stratton, Champion). Sources: manufacturer MSRPs,
// Home Depot / Lowe's contractor pricing 2024-2025, electrician install surveys.
const EQUIPMENT_BASE: Record<Type, Record<Sizing, CostBand>> = {
  portable: {
    '5kw':  { low: 600,  mid: 900,  high: 1200 },
    '7kw':  { low: 800,  mid: 1100, high: 1400 },
    '10kw': { low: 1300, mid: 1700, high: 2200 },
    '14kw': { low: 1800, mid: 2300, high: 2800 },
    '18kw': { low: 0, mid: 0, high: 0 },
    '22kw': { low: 0, mid: 0, high: 0 },
    '26kw': { low: 0, mid: 0, high: 0 },
  },
  inverter: {
    '5kw':  { low: 1200, mid: 1600, high: 2000 },
    '7kw':  { low: 1700, mid: 2100, high: 2500 },
    '10kw': { low: 2400, mid: 2900, high: 3400 },
    '14kw': { low: 0, mid: 0, high: 0 },
    '18kw': { low: 0, mid: 0, high: 0 },
    '22kw': { low: 0, mid: 0, high: 0 },
    '26kw': { low: 0, mid: 0, high: 0 },
  },
  standby_air: {     // air-cooled standby (Generac Guardian etc.)
    '5kw':  { low: 0, mid: 0, high: 0 },
    '7kw':  { low: 0, mid: 0, high: 0 },
    '10kw': { low: 2800, mid: 3500, high: 4200 },
    '14kw': { low: 3400, mid: 4200, high: 5000 },
    '18kw': { low: 4200, mid: 5100, high: 6100 },
    '22kw': { low: 5000, mid: 6000, high: 7200 },
    '26kw': { low: 5800, mid: 6900, high: 8200 },
  },
  standby_liquid: {  // liquid-cooled (Generac Protector, Kohler 14RESV)
    '5kw':  { low: 0, mid: 0, high: 0 },
    '7kw':  { low: 0, mid: 0, high: 0 },
    '10kw': { low: 0, mid: 0, high: 0 },
    '14kw': { low: 8500, mid: 10500, high: 12500 },
    '18kw': { low: 10500, mid: 12500, high: 14500 },
    '22kw': { low: 12500, mid: 14500, high: 17000 },
    '26kw': { low: 14500, mid: 16500, high: 19500 },
  },
};

// Transfer mechanism cost
const TRANSFER_COST: Record<Transfer, CostBand> = {
  none:         { low: 0, mid: 0, high: 0 },            // direct extension cords (portable only)
  interlock:    { low: 250, mid: 450, high: 700 },      // 30-50A breaker interlock + inlet box
  ats_partial:  { low: 800, mid: 1500, high: 2400 },    // critical-load subpanel ATS
  ats_whole:    { low: 1500, mid: 2500, high: 4200 },   // 200A service-rated ATS
};

// Install labor + materials by configuration (electrician + plumber for fuel + pad/concrete)
const INSTALL_BASE: Record<Type, CostBand> = {
  portable:       { low: 50,  mid: 150, high: 350 },     // minor — inlet box wire run
  inverter:       { low: 100, mid: 250, high: 500 },
  standby_air:    { low: 1500, mid: 2800, high: 4500 },  // pad, fuel line, wiring, ATS commissioning
  standby_liquid: { low: 2500, mid: 4500, high: 7500 },  // larger pad, dedicated subpanel
};

// Natural gas line extension (if standby and existing gas service available)
const GAS_LINE_EXT: CostBand = { low: 600, mid: 1400, high: 2800 };

// Propane tank install (if propane chosen) — typical 500 gal in-ground tank with regulator
const PROPANE_TANK: CostBand = { low: 1800, mid: 2800, high: 4200 };

// Permit + inspection
const PERMIT: CostBand = { low: 250, mid: 500, high: 900 };

// Annual maintenance (standby units need yearly service)
const ANNUAL_MAINT: Record<Type, number> = {
  portable: 80,
  inverter: 80,
  standby_air: 250,
  standby_liquid: 450,
};

// Fuel consumption — gallons or therms per hour at 50% load (typical residential running profile)
// Standby NG ~ 1.0-2.4 therms/hr by size; propane ~ 1.2-3.2 gal/hr; gasoline portable ~ 0.6-1.5 gal/hr
function fuelCostPerHour(type: Type, sizing: Sizing, fuel: Fuel): number {
  const ngTherm = type === 'standby_air' || type === 'standby_liquid' ? 1.0 : 1.0;
  const sizeMultiplier = ({'5kw': 0.5, '7kw': 0.6, '10kw': 0.8, '14kw': 1.1, '18kw': 1.4, '22kw': 1.7, '26kw': 2.0} as Record<Sizing, number>)[sizing];
  if (fuel === 'natural_gas') return 1.50 * sizeMultiplier * ngTherm;    // $1.50/therm typical
  if (fuel === 'propane') return 3.20 * sizeMultiplier * 1.0;             // $3.20/gal; 1 gal ≈ 0.92 therm
  if (fuel === 'diesel') return 4.00 * sizeMultiplier * 0.7;              // $4.00/gal, slightly more efficient
  if (fuel === 'gasoline') return 3.50 * sizeMultiplier * 1.0;
  return 1.50 * sizeMultiplier;
}

const SIZE_BTU_HOURS: Record<Sizing, number> = {
  '5kw': 5000, '7kw': 7000, '10kw': 10000, '14kw': 14000, '18kw': 18000, '22kw': 22000, '26kw': 26000,
};

export default function GeneratorCalculator() {
  const [state, setState] = useState('FL');
  const [zip, setZip] = useState('');
  const [type, setType] = useState<Type>('standby_air');
  const [sizing, setSizing] = useState<Sizing>('18kw');
  const [fuel, setFuel] = useState<Fuel>('natural_gas');
  const [transfer, setTransfer] = useState<Transfer>('ats_whole');
  const [annualHours, setAnnualHours] = useState(24);

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const elecMult = lab?.electrician_multiplier ?? 1.0;

    const equipment = EQUIPMENT_BASE[type][sizing];
    const transferCost = scale(TRANSFER_COST[transfer], elecMult);
    const installCost = scale(INSTALL_BASE[type], elecMult);
    const gasLine = (type === 'standby_air' || type === 'standby_liquid') && fuel === 'natural_gas'
      ? scale(GAS_LINE_EXT, elecMult) : { low: 0, mid: 0, high: 0 };
    const propTank = fuel === 'propane' && (type === 'standby_air' || type === 'standby_liquid')
      ? PROPANE_TANK : { low: 0, mid: 0, high: 0 };
    const permit = scale(PERMIT, elecMult);

    const gross = add(add(add(add(add(equipment, transferCost), installCost), gasLine), propTank), permit);

    const fuelPerHour = fuelCostPerHour(type, sizing, fuel);
    const annualFuelCost = fuelPerHour * annualHours;
    const maint = ANNUAL_MAINT[type];
    const annualOperating = annualFuelCost + maint;

    const equipmentValid = equipment.mid > 0;

    return { equipment, transferCost, installCost, gasLine, propTank, permit, gross, fuelPerHour, annualFuelCost, maint, annualOperating, equipmentValid };
  }, [state, type, sizing, fuel, transfer, annualHours]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  const validSizings: Sizing[] = type === 'portable' || type === 'inverter' ? ['5kw', '7kw', '10kw', '14kw']
    : type === 'standby_air' ? ['10kw', '14kw', '18kw', '22kw', '26kw']
    : ['14kw', '18kw', '22kw', '26kw'];

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input
            type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 33101"
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-500">Optional — auto-detects state</p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Generator type</label>
          <select className="input mt-1 w-full" value={type} onChange={e => { setType(e.target.value as Type); setSizing('10kw'); }}>
            <option value="portable">Portable (wheels, extension cords or inlet box)</option>
            <option value="inverter">Inverter (quieter, cleaner power, more $/kW)</option>
            <option value="standby_air">Standby air-cooled (Generac Guardian)</option>
            <option value="standby_liquid">Standby liquid-cooled (Generac Protector, Kohler)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Sizing (kW)</label>
          <select className="input mt-1 w-full" value={sizing} onChange={e => setSizing(e.target.value as Sizing)}>
            {validSizings.map(s => <option key={s} value={s}>{s.replace('kw', ' kW')} ({SIZE_BTU_HOURS[s].toLocaleString()} W)</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Fuel</label>
          <select className="input mt-1 w-full" value={fuel} onChange={e => setFuel(e.target.value as Fuel)}>
            <option value="natural_gas">Natural gas (utility, unlimited runtime)</option>
            <option value="propane">Propane (tank required)</option>
            <option value="diesel">Diesel (most efficient; tank required)</option>
            <option value="gasoline">Gasoline (portable only; ~10 hr/tank)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Transfer mechanism</label>
          <select className="input mt-1 w-full" value={transfer} onChange={e => setTransfer(e.target.value as Transfer)}>
            <option value="none">None / extension cords (portable only — code-questionable)</option>
            <option value="interlock">Interlock kit + inlet box (NEC 702.5)</option>
            <option value="ats_partial">Automatic transfer switch + critical-load subpanel</option>
            <option value="ats_whole">Whole-home ATS (200A service)</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Expected annual runtime (hours)</label>
          <input
            type="number" min={0} max={2000} step={5} value={annualHours}
            onChange={e => setAnnualHours(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-500">Avg U.S. household experiences ~8 outage-hours/year; hurricane regions average 40-120 hours.</p>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        {!result.equipmentValid ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
            That size isn&rsquo;t available in this generator class. Try a different size or type.
          </div>
        ) : (
          <>
            <div className="net-card relative overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-white to-amber-50 p-5 shadow-card">
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Installed cost · {sizing.replace('kw', ' kW')} · {stateName}
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
                <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)} installed</p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">Annual operating</p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-amber-800">{fmtUSD(result.annualOperating)}/yr</p>
                  <p className="mt-1 text-[11px] text-ink-600">~{annualHours} hours runtime + service</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">Fuel rate</p>
                  <p className="mt-0.5 text-xl font-semibold tabular-nums text-amber-800">{fmtUSD(result.fuelPerHour)}/hr</p>
                  <p className="mt-1 text-[11px] text-ink-600">at 50% load, current fuel prices</p>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="card p-4">
                <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
                <ul className="mt-3 space-y-1.5 text-sm">
                  <li className="flex justify-between gap-3"><span>Generator equipment</span><span className="tabular-nums">{fmtUSD(result.equipment.mid)}</span></li>
                  <li className="flex justify-between gap-3"><span>Transfer mechanism</span><span className="tabular-nums">{fmtUSD(result.transferCost.mid)}</span></li>
                  <li className="flex justify-between gap-3"><span>Install labor + materials</span><span className="tabular-nums">{fmtUSD(result.installCost.mid)}</span></li>
                  {result.gasLine.mid > 0 && (
                    <li className="flex justify-between gap-3"><span>Natural gas line extension</span><span className="tabular-nums">{fmtUSD(result.gasLine.mid)}</span></li>
                  )}
                  {result.propTank.mid > 0 && (
                    <li className="flex justify-between gap-3"><span>Propane tank install</span><span className="tabular-nums">{fmtUSD(result.propTank.mid)}</span></li>
                  )}
                  <li className="flex justify-between gap-3"><span>Permit + inspection</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
                </ul>
              </div>

              <div className="card p-4">
                <h3 className="text-sm font-semibold text-ink-900">Consider battery storage instead</h3>
                <p className="mt-2 text-sm text-ink-700">
                  A 13.5 kWh battery (Powerwall, Franklin) installs for $13,000–$19,000 — comparable to a 22 kW standby generator with whole-home ATS. The federal 25D credit (30%, including standalone batteries ≥3 kWh) was terminated by OBBBA for property placed in service after 2025-12-31, so it does not reduce 2026-forward battery installs; check state storage programs (CA SGIP, NY-Sun Storage, CT, MD). Battery is silent, doesn&rsquo;t require fuel, runs from solar if you have it. Generator wins on sustained multi-day outages and unlimited capacity.
                </p>
                <a href="/home-battery-cost-calculator/" className="mt-2 inline-block text-xs font-medium text-brand-700">Open battery calculator →</a>
              </div>
            </div>

            <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <strong>Code compliance:</strong> permanent generator installs are governed by NEC 702 (Optional Standby Systems). Interlock kits must be UL-listed and breaker-specific. Backfeeding without an interlock or ATS is illegal in all 50 states and can kill utility lineworkers during outage repair. Always pull a permit.
            </div>

            <div className="mt-5 card p-4">
              <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
              <ul className="mt-2 space-y-1 text-sm text-ink-700">
                <li>· Permit pulled and inspected — non-negotiable.</li>
                <li>· Pad: poured concrete or pre-cast composite (Versa-Lift). Cheap installs use a gravel pad which fails NEC clearance requirements in many jurisdictions.</li>
                <li>· Fuel line sizing — natural gas needs adequate line pressure; many residential lines undersized for 22+ kW units.</li>
                <li>· Battery for control circuit — without it, the unit won&rsquo;t start in winter.</li>
                <li>· ATS rating matches your service entrance (200A standard).</li>
                <li>· Bi-annual exercise schedule (most units self-test weekly).</li>
                <li>· Service contract: $200-450/year for standby units; check what&rsquo;s included (oil + filter, valve adjustment, battery, transfer switch test).</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
