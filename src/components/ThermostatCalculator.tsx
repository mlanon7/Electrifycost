import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor, stateEnergy } from '@/lib/data';
import { fmtUSD } from '@/lib/format';

type Model = 'basic' | 'nest_e' | 'ecobee_premium' | 'nest_learning' | 'honeywell_t9';
type Install = 'diy' | 'pro';
type Cwire = 'yes' | 'no' | 'unknown';
type HvacType = 'central_ac_furnace' | 'heat_pump' | 'boiler';

interface CostBand { low: number; mid: number; high: number; }

// Hardware MSRPs 2026
const HARDWARE: Record<Model, CostBand> = {
  basic:           { low: 60,  mid: 90,  high: 130 },   // Sensi, Honeywell RTH9580
  nest_e:          { low: 130, mid: 170, high: 200 },
  ecobee_premium:  { low: 230, mid: 250, high: 280 },
  nest_learning:   { low: 230, mid: 250, high: 280 },
  honeywell_t9:    { low: 180, mid: 220, high: 250 },
};

const PRO_INSTALL: CostBand = { low: 150, mid: 250, high: 400 };
const CWIRE_ADDER: CostBand = { low: 100, mid: 200, high: 350 };   // electrician adds C-wire if missing

// Annual HVAC savings: Nest's own studies put it 10-12% heating + 15% cooling, ENERGY STAR claims ~8%.
// We model 10% combined to be conservative.
const HVAC_SAVINGS_PCT: Record<HvacType, number> = {
  central_ac_furnace: 0.10,
  heat_pump: 0.08,        // heat pumps with proper smart-thermostat behavior; less if naive recovery cycles
  boiler: 0.12,           // hot-water boilers respond well to setback
};

// Typical utility rebate (snapshot — varies wildly by utility, often $50–$125)
function utilityRebate(state: string): number {
  // Strong programs in MA, CA, NY, CT, NJ, MN, CO
  const strong = ['MA', 'CA', 'NY', 'CT', 'NJ', 'MN', 'CO', 'IL'];
  if (strong.includes(state)) return 100;
  return 0;
}

export default function ThermostatCalculator() {
  const [state, setState] = useState('CA');
  const [zip, setZip] = useState('');
  const [model, setModel] = useState<Model>('ecobee_premium');
  const [install, setInstall] = useState<Install>('diy');
  const [cwire, setCwire] = useState<Cwire>('unknown');
  const [hvac, setHvac] = useState<HvacType>('central_ac_furnace');
  const [annualHvacCost, setAnnualHvacCost] = useState(1500);

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const elecMult = lab?.electrician_multiplier ?? 1.0;
    const hw = HARDWARE[model];
    const proCost: CostBand = install === 'pro'
      ? { low: PRO_INSTALL.low * elecMult, mid: PRO_INSTALL.mid * elecMult, high: PRO_INSTALL.high * elecMult }
      : { low: 0, mid: 0, high: 0 };
    const cw: CostBand = cwire === 'no'
      ? { low: CWIRE_ADDER.low * elecMult, mid: CWIRE_ADDER.mid * elecMult, high: CWIRE_ADDER.high * elecMult }
      : cwire === 'unknown'
      ? { low: 0, mid: CWIRE_ADDER.mid * 0.4 * elecMult, high: CWIRE_ADDER.high * 0.7 * elecMult }
      : { low: 0, mid: 0, high: 0 };

    const gross: CostBand = {
      low: hw.low + proCost.low + cw.low,
      mid: hw.mid + proCost.mid + cw.mid,
      high: hw.high + proCost.high + cw.high,
    };

    const rebate = utilityRebate(state);
    const net: CostBand = {
      low: Math.max(0, gross.low - rebate),
      mid: Math.max(0, gross.mid - rebate),
      high: Math.max(0, gross.high - rebate),
    };

    const savingsPct = HVAC_SAVINGS_PCT[hvac];
    const annualSavings = annualHvacCost * savingsPct;
    const paybackYears = annualSavings > 0 ? Math.round((net.mid / annualSavings) * 10) / 10 : null;

    return { hw, proCost, cw, gross, rebate, net, savingsPct, annualSavings, paybackYears };
  }, [state, model, install, cwire, hvac, annualHvacCost]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  return (
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input
            type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 94103"
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
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Model</label>
          <select className="input mt-1 w-full" value={model} onChange={e => setModel(e.target.value as Model)}>
            <option value="basic">Basic Wi-Fi (Sensi, Honeywell RTH)</option>
            <option value="nest_e">Nest E (mid)</option>
            <option value="honeywell_t9">Honeywell T9 (multi-sensor)</option>
            <option value="ecobee_premium">Ecobee Premium (multi-sensor + voice)</option>
            <option value="nest_learning">Nest Learning (4th gen)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Install</label>
          <select className="input mt-1 w-full" value={install} onChange={e => setInstall(e.target.value as Install)}>
            <option value="diy">DIY (free, ~30 min)</option>
            <option value="pro">Pro install ($150–$400)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">C-wire present?</label>
          <select className="input mt-1 w-full" value={cwire} onChange={e => setCwire(e.target.value as Cwire)}>
            <option value="yes">Yes</option>
            <option value="unknown">Unknown (most homes have one)</option>
            <option value="no">No (needs electrician to add)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">HVAC type</label>
          <select className="input mt-1 w-full" value={hvac} onChange={e => setHvac(e.target.value as HvacType)}>
            <option value="central_ac_furnace">Central AC + forced-air furnace</option>
            <option value="heat_pump">Heat pump (use heat-pump-aware mode)</option>
            <option value="boiler">Hot-water boiler / radiator</option>
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Annual HVAC energy cost ($)</label>
          <input
            type="number" min={200} max={6000} step={50} value={annualHvacCost}
            onChange={e => setAnnualHvacCost(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-500">Sum your heating + cooling utility bills for the last 12 months. National average ~$1,500.</p>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-brand-300/60 bg-gradient-to-br from-brand-50 via-white to-blue-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
            Installed cost · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.net.mid)}</p>
            <p className="text-sm text-ink-600">net after ~${result.rebate} utility rebate · {fmtUSD(result.gross.mid)} gross</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Annual HVAC savings</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">{fmtUSD(result.annualSavings)}/yr</p>
              <p className="mt-1 text-[11px] text-ink-600">{Math.round(result.savingsPct * 100)}% of ${annualHvacCost}</p>
            </div>
            <div className="rounded-lg border border-brand-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Payback</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-brand-800">
                {result.paybackYears != null ? `${result.paybackYears} yr` : 'n/a'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3"><span>Hardware</span><span className="tabular-nums">{fmtUSD(result.hw.mid)}</span></li>
              {install === 'pro' && (
                <li className="flex justify-between gap-3"><span>Pro install</span><span className="tabular-nums">{fmtUSD(result.proCost.mid)}</span></li>
              )}
              {cwire === 'no' && (
                <li className="flex justify-between gap-3"><span>Add C-wire (electrician)</span><span className="tabular-nums">{fmtUSD(result.cw.mid)}</span></li>
              )}
              {cwire === 'unknown' && (
                <li className="flex justify-between gap-3"><span>C-wire risk (estimated)</span><span className="tabular-nums">{fmtUSD(result.cw.mid)}</span></li>
              )}
              <li className="flex justify-between gap-3"><span>Utility rebate</span><span className="tabular-nums text-brand-700">−{fmtUSD(result.rebate)}</span></li>
            </ul>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Real-world savings notes</h3>
            <ul className="mt-3 space-y-1 text-sm text-ink-700">
              <li>· Nest&rsquo;s own studies show 10-12% heating savings, 15% cooling savings on average.</li>
              <li>· ENERGY STAR estimates ~8% combined HVAC savings — more conservative.</li>
              <li>· Heat pumps benefit less from aggressive setbacks (recovery cycles can waste efficiency). Use heat-pump-aware mode (Ecobee, Nest) for best results.</li>
              <li>· If you already set your thermostat manually with discipline (away setbacks, night setbacks), the marginal savings drop.</li>
            </ul>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>C-wire context:</strong> Most furnaces installed after ~2000 have a C-wire (common, 24V power). Pre-2000 furnaces and many boiler-only setups don&rsquo;t. Nest can run without one in some configurations (steals power from R-wire); Ecobee includes a Power Extender Kit to bridge the gap. Adding a true C-wire from the air handler is a 30-60 minute electrician visit.
        </div>
      </div>
    </div>
  );
}
