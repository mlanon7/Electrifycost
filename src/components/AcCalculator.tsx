import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor, findClimate, stateEnergy } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type Tier = 'single' | 'two_stage' | 'variable';
type Tonnage = '2' | '2.5' | '3' | '3.5' | '4' | '5';
type DuctState = 'keep' | 'minor_repair' | 'replace';
type FurnaceBundle = 'no' | 'yes';

interface CostBand { low: number; mid: number; high: number; }
const add = (a: CostBand, b: CostBand): CostBand => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand, m: number): CostBand => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// 2026 installed-cost base ranges. Anchored to ASHRAE 2024 cost guide, ACCA Manual J/S/D guidance,
// AHRI directory pricing surveys, and Home Advisor / Modernize 2024-2025 contractor surveys.
// Costs reflect post-2023 SEER2 efficiency standard + R-410A → R-32/R-454B refrigerant transition.

// Tonnage base cost (per ton, includes condenser + evaporator coil + line set, before tier multiplier)
const PER_TON: Record<Tier, CostBand> = {
  single: { low: 1600, mid: 2100, high: 2700 },        // 14.3-16 SEER2 single-stage
  two_stage: { low: 2100, mid: 2700, high: 3400 },     // 16-19 SEER2 two-stage
  variable: { low: 2700, mid: 3400, high: 4400 },      // 18-26 SEER2 variable-speed (inverter)
};

// Tonnage map → BTU/hour and recommended sqft range
const TON_INFO: Record<Tonnage, { btu: number; sqftLow: number; sqftHigh: number; rec: number }> = {
  '2':   { btu: 24000, sqftLow: 1000, sqftHigh: 1300, rec: 2.0 },
  '2.5': { btu: 30000, sqftLow: 1300, sqftHigh: 1600, rec: 2.5 },
  '3':   { btu: 36000, sqftLow: 1500, sqftHigh: 1900, rec: 3.0 },
  '3.5': { btu: 42000, sqftLow: 1800, sqftHigh: 2200, rec: 3.5 },
  '4':   { btu: 48000, sqftLow: 2100, sqftHigh: 2500, rec: 4.0 },
  '5':   { btu: 60000, sqftLow: 2400, sqftHigh: 3000, rec: 5.0 },
};

// Duct work adders
const DUCT_ADDER: Record<DuctState, CostBand> = {
  keep: { low: 0, mid: 0, high: 0 },
  minor_repair: { low: 400, mid: 800, high: 1500 },          // seal + insulate trunk
  replace: { low: 2500, mid: 4500, high: 7500 },             // full duct replacement (small home)
};

// Bundled furnace replacement (gas, 80-95% AFUE) — only if user is doing both at same time
const FURNACE_BUNDLE: CostBand = { low: 2400, mid: 3500, high: 5000 };

// Labor hours per ton (varies by tier — variable systems take longer)
const LABOR_HOURS_PER_TON: Record<Tier, number> = {
  single: 6,        // 12-18 hours for 2-3 ton install
  two_stage: 7,
  variable: 8.5,    // commissioning + line set vacuum
};

// HVAC technician blended rate; sourced from module-labor-rates.csv (`ac` row, $110)
// so it's consistent with every other module's labor rate basis.
// Previously hard-coded at $95 — a separate source of truth from `module-labor-rates.csv`,
// flagged by the May-2026 audit as inconsistent.
const LABOR_RATE_USD = 110;

// Permit + disposal of old equipment
const PERMIT_BASE: CostBand = { low: 200, mid: 400, high: 700 };

// Refrigerant transition adder — A2L (R-32, R-454B) installs require new tools/training and
// in 2025-2026 some supply constraints. Add a modest premium.
const REFRIGERANT_PREMIUM: CostBand = { low: 200, mid: 400, high: 700 };

// SEER2 typical efficiency by tier
const SEER2_TYPICAL: Record<Tier, number> = {
  single: 15.0,
  two_stage: 17.5,
  variable: 21.0,
};

// Annual cooling load model. The cooling-degree-day method (Manual J building load coefficient):
//   annual cooling BTU ≈ sqft × CDD × ~18 BTU/(sqft·CDD-day) for a typical insulated home
// Source: ASHRAE Handbook + ACCA Manual J — BLC ranges 12–25 BTU/(sqft·°F·day) by envelope tightness.
// SEER2 is BTU output / Wh input, so kWh consumed = annualBtu / SEER2 / 1000.
// Sanity check: 1,800 sqft × 1,500 CDD × 18 = 48.6 MMBTU/yr ÷ SEER2 17.5 = ~2,780 kWh/yr.
// EIA RECS 2020 average residential AC: ~1,800-2,500 kWh/yr. Aligns.
const BLC_BTU_PER_SQFT_CDD = 18;
function estimateAnnualCoolingKwh(sqft: number, seer2: number, cdd: number): number {
  const annualBtu = sqft * cdd * BLC_BTU_PER_SQFT_CDD;
  const kwh = annualBtu / (seer2 * 1000);
  return Math.max(0, Math.round(kwh));
}

// Map climate zone to a cooling-degree-days proxy (very rough — real CDD from NOAA)
function cddProxy(state: string): number {
  const c = findClimate(state);
  if (c?.cooling_degree_days && c.cooling_degree_days > 0) return c.cooling_degree_days;
  const z = c?.iecc_zone ?? "4A";
  // Very rough mapping: 1A/2A hot/humid → 2500-3500, 3-4 → 1200-2000, 5-7 → 500-1000, 8 → ~200
  const head = z[0];
  switch (head) {
    case '1': return 3500;
    case '2': return 2800;
    case '3': return 1800;
    case '4': return 1200;
    case '5': return 800;
    case '6': return 500;
    case '7': return 300;
    case '8': return 150;
    default: return 1200;
  }
}

export default function AcCalculator() {
  useCalculatorUsed('ac-replacement');
  const [state, setState] = useState('TX');
  const [zip, setZip] = useState('');
  const [sqft, setSqft] = useState(1800);
  const [tonnage, setTonnage] = useState<Tonnage>('3');
  const [tier, setTier] = useState<Tier>('two_stage');
  const [ducts, setDucts] = useState<DuctState>('keep');
  const [furnaceBundle, setFurnaceBundle] = useState<FurnaceBundle>('no');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  // Tonnage recommendation based on sqft (Manual J shortcut — 1 ton per ~600 sqft is too aggressive;
  // 1 ton per ~700-800 sqft is more accurate; high-load climates closer to 600, low closer to 900)
  const recommendedTon: Tonnage = useMemo(() => {
    const target = sqft / 700;
    if (target < 2.25) return '2';
    if (target < 2.75) return '2.5';
    if (target < 3.25) return '3';
    if (target < 3.75) return '3.5';
    if (target < 4.5) return '4';
    return '5';
  }, [sqft]);

  const result = useMemo(() => {
    const tonNum = parseFloat(tonnage);
    const stateLab = findStateLabor(state);
    const hvacMult = stateLab?.hvac_multiplier ?? 1.0;

    const equipPerTon = PER_TON[tier];
    const equip: CostBand = scale(equipPerTon, tonNum);

    const laborHours = LABOR_HOURS_PER_TON[tier] * tonNum;
    const laborCostMid = laborHours * LABOR_RATE_USD * hvacMult;
    const labor: CostBand = { low: laborCostMid * 0.85, mid: laborCostMid, high: laborCostMid * 1.20 };

    const duct = DUCT_ADDER[ducts];
    const furnace = furnaceBundle === 'yes' ? FURNACE_BUNDLE : { low: 0, mid: 0, high: 0 };
    const refrigerant = REFRIGERANT_PREMIUM;
    const permit = scale(PERMIT_BASE, hvacMult);

    const gross = add(add(add(add(add(equip, labor), duct), furnace), refrigerant), permit);

    // Operating cost comparison
    const seer = SEER2_TYPICAL[tier];
    const cdd = cddProxy(state);
    const annualKwh = estimateAnnualCoolingKwh(sqft, seer, cdd);
    const baselineKwh = estimateAnnualCoolingKwh(sqft, 13.0, cdd); // pre-2023 SEER 13 baseline
    const eRow = stateEnergy.find(e => e.state === state);
    const rate = eRow ? eRow.electricity_cents_per_kwh / 100 : 0.16;
    const annualCost = annualKwh * rate;
    const annualSavings = (baselineKwh - annualKwh) * rate;

    // Heat-pump alternative cost (estimate vs same tier — central air-source HP runs ~$1,500-2,500/ton more)
    const hpAltMid = gross.mid + tonNum * 2000;

    return {
      gross, equip, labor, duct, furnace, refrigerant, permit,
      seer, annualKwh, baselineKwh, annualCost, annualSavings, hpAltMid,
    };
  }, [state, sqft, tonnage, tier, ducts, furnaceBundle]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  const tonMisfit = tonnage !== recommendedTon;
  const climate = findClimate(state)?.iecc_zone ?? "4A";

  return (
    <>
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input
            type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 30303"
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

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Home size (sqft)</label>
          <input
            type="number" min={500} max={6000} step={50} value={sqft}
            onChange={e => setSqft(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">
            System size · recommended: <span className="text-brand-700">{recommendedTon} ton</span>
          </label>
          <select className="input mt-1 w-full" value={tonnage} onChange={e => setTonnage(e.target.value as Tonnage)}>
            {(['2','2.5','3','3.5','4','5'] as Tonnage[]).map(t => (
              <option key={t} value={t}>
                {t} ton · {TON_INFO[t].btu.toLocaleString()} BTU · fits {TON_INFO[t].sqftLow}-{TON_INFO[t].sqftHigh} sqft
              </option>
            ))}
          </select>
          {tonMisfit && (
            <p className="mt-1 text-[11px] text-amber-700">
              Selected size differs from recommended for {sqft} sqft. Get a Manual J load calc before buying — oversized AC short-cycles and dehumidifies poorly.
            </p>
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Efficiency tier</label>
          <select className="input mt-1 w-full" value={tier} onChange={e => setTier(e.target.value as Tier)}>
            <option value="single">Single-stage (~15 SEER2 — basic)</option>
            <option value="two_stage">Two-stage (~17.5 SEER2 — mid)</option>
            <option value="variable">Variable-speed inverter (~21 SEER2 — premium)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Ductwork</label>
          <select className="input mt-1 w-full" value={ducts} onChange={e => setDucts(e.target.value as DuctState)}>
            <option value="keep">Keep existing (good condition)</option>
            <option value="minor_repair">Minor repair / seal / insulate</option>
            <option value="replace">Replace ductwork</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Bundle furnace?</label>
          <select className="input mt-1 w-full" value={furnaceBundle} onChange={e => setFurnaceBundle(e.target.value as FurnaceBundle)}>
            <option value="no">No (AC only)</option>
            <option value="yes">Yes — replace gas furnace at same time</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-rose-300/60 bg-gradient-to-br from-rose-50 via-white to-amber-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Estimated installed cost · {tonnage} ton {tier === 'single' ? 'single-stage' : tier === 'two_stage' ? 'two-stage' : 'variable-speed'} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)} installed</p>
          </div>

          <div className="mt-4 rounded-lg border border-brand-200 bg-brand-50 p-3">
            <p className="text-[10px] font-medium uppercase tracking-wide text-brand-700">Consider a heat pump instead</p>
            <p className="mt-1 text-sm text-ink-700">
              A central air-source heat pump <em>does</em> cooling and heating with the same equipment. Estimated equivalent install: <span className="font-semibold tabular-nums">{fmtUSD(result.hpAltMid)}</span>. Federal 25C credit ended 2025-12-31, but state and utility heat-pump rebates are widely available.
            </p>
            <a href="/heat-pump-cost-calculator/" className="mt-2 inline-block text-xs font-medium text-brand-700">Open heat pump calculator →</a>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between gap-3"><span>Equipment (condenser + coil)</span><span className="tabular-nums">{fmtUSD(result.equip.mid)}</span></li>
              <li className="flex justify-between gap-3"><span>Labor (install + commission)</span><span className="tabular-nums">{fmtUSD(result.labor.mid)}</span></li>
              <li className="flex justify-between gap-3"><span>Refrigerant transition (A2L tooling)</span><span className="tabular-nums">{fmtUSD(result.refrigerant.mid)}</span></li>
              <li className="flex justify-between gap-3"><span>Ductwork</span><span className="tabular-nums">{fmtUSD(result.duct.mid)}</span></li>
              {furnaceBundle === 'yes' && (
                <li className="flex justify-between gap-3"><span>Furnace bundled</span><span className="tabular-nums">{fmtUSD(result.furnace.mid)}</span></li>
              )}
              <li className="flex justify-between gap-3"><span>Permit + disposal</span><span className="tabular-nums">{fmtUSD(result.permit.mid)}</span></li>
            </ul>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Operating cost</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Climate zone</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{climate}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">SEER2 selected</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{result.seer}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Annual cooling kWh</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{result.annualKwh.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Annual cost</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{fmtUSD(result.annualCost)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Savings vs SEER 13 baseline</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-brand-700">{fmtUSD(result.annualSavings)}/yr</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>2026 regulatory note:</strong> Federal SEER2 minimums (14.3 north / 15.2 south) apply to new units placed in service after 2023-01-01. The 2025 EPA refrigerant rule phases R-410A out of new units; expect R-32 (Daikin) or R-454B (Carrier, Trane, Lennox, Goodman) in the equipment quoted. There is no federal 25C credit for air conditioning — heat pumps were eligible through 2025-12-31, AC alone was not.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Manual J load calculation (not a rule-of-thumb tonnage guess).</li>
            <li>· AHRI-matched system certificate (outdoor condenser + indoor coil pair).</li>
            <li>· SEER2, EER2, and HSPF2 numbers in writing — not SEER alone.</li>
            <li>· Refrigerant: R-32 or R-454B specifically (post-2025 units).</li>
            <li>· Line-set: new copper run vs flush-and-reuse of existing.</li>
            <li>· Equipment warranty (10-yr parts is standard) + labor warranty (1-10 yr varies by installer).</li>
            <li>· Commissioning report (charge weight, superheat/subcool, static pressure, airflow per ton).</li>
            <li>· Permit pulled (not "we don't need one — the city won't notice"). Improper installs void warranties.</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="ac-replacement"
    />
    </>
  );
}
