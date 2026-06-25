import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor, findClimate, stateEnergy, findHomeEnergyRebateStatus } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';

type Scope = 'attic_only' | 'walls_only' | 'attic_walls' | 'attic_walls_air' | 'whole_envelope';
type AtticType = 'blown_cellulose' | 'blown_fiberglass' | 'open_foam' | 'closed_foam';
type ExistingR = 'none' | 'low_r11' | 'medium_r19_30' | 'high_r38plus';
type Income = 'unknown' | 'low' | 'moderate' | 'high';

interface CostBand { low: number; mid: number; high: number; }
const add = (a: CostBand, b: CostBand): CostBand => ({ low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high });
const scale = (b: CostBand, m: number): CostBand => ({ low: b.low * m, mid: b.mid * m, high: b.high * m });

// Per-sqft pricing for attic insulation by material type, 2026 contractor rates.
// Sources: 2024 NAIMA contractor pricing surveys, Energy Star Home Performance with ENERGY STAR contractor data,
// HomeAdvisor + Modernize 2024-2025 marketplace data, Building Science Corp. retrofit cost guides.
const ATTIC_PER_SQFT: Record<AtticType, CostBand> = {
  blown_cellulose:  { low: 1.50, mid: 2.00, high: 2.50 },    // R-49 typical depth
  blown_fiberglass: { low: 1.25, mid: 1.75, high: 2.25 },    // R-49 typical depth
  open_foam:        { low: 3.50, mid: 4.50, high: 6.00 },    // R-30 open-cell, ~10 inches
  closed_foam:      { low: 4.50, mid: 6.00, high: 8.50 },    // R-38 closed-cell, ~6 inches
};

// Wall drill-and-fill (cellulose or fiberglass) — square feet of exterior wall surface
const WALL_PER_SQFT: CostBand = { low: 2.00, mid: 3.00, high: 4.50 };

// Air sealing (blower door diagnostic + sealing) — flat job cost range
const AIR_SEAL: CostBand = { low: 600, mid: 1200, high: 2200 };

// Rim joist + crawl space encapsulation (basement/crawl improvement)
const CRAWL: CostBand = { low: 3500, mid: 7500, high: 14000 };

// Target R-values by IECC climate zone (DOE / 2021 IECC residential)
// https://www.energy.gov/energysaver/types-insulation
function targetR(state: string): { attic: number; wall: number } {
  const zone = findClimate(state)?.iecc_zone ?? '4A';
  const head = zone[0];
  switch (head) {
    case '1': return { attic: 30, wall: 13 };
    case '2': return { attic: 49, wall: 13 };
    case '3': return { attic: 49, wall: 15 };
    case '4': return { attic: 60, wall: 15 };
    case '5': return { attic: 60, wall: 20 };
    case '6': return { attic: 60, wall: 20 };
    case '7': return { attic: 60, wall: 21 };
    case '8': return { attic: 60, wall: 21 };
    default:  return { attic: 49, wall: 15 };
  }
}

// Heating + cooling savings estimate (very rough)
// Per Building Science Corp / RECS analysis, attic upgrade from R-11 to R-49 typically cuts
// HVAC energy 8-15%. Wall fill 5-10%. Air-sealing 5-15%.
function annualSavingsPct(scope: Scope, existing: ExistingR): number {
  const atticGain = existing === 'none' ? 0.15
    : existing === 'low_r11' ? 0.12
    : existing === 'medium_r19_30' ? 0.05
    : 0.02;
  switch (scope) {
    case 'attic_only': return atticGain;
    case 'walls_only': return 0.07;
    case 'attic_walls': return atticGain + 0.05;
    case 'attic_walls_air': return atticGain + 0.05 + 0.07;
    case 'whole_envelope': return atticGain + 0.05 + 0.07 + 0.04;
  }
}

// Typical annual heating + cooling cost per sqft (very rough, from EIA RECS 2020)
// $1.20/sqft/yr in cold climates, $0.75 in mild, $0.90 average
function annualHvacCostPerSqft(state: string, sqft: number): number {
  const zone = findClimate(state)?.iecc_zone ?? '4A';
  const head = zone[0];
  const perSqft = head === '5' || head === '6' || head === '7' || head === '8' ? 1.20
    : head === '4' ? 1.00
    : head === '3' ? 0.85
    : 0.70;
  return perSqft * sqft;
}

// HOMES rebate (DOE Home Energy Rebates) per modeled savings tier
// Up to $4,000 moderate-income / $8,000 low-income for 35%+ modeled savings
function homesRebateEstimate(state: string, income: Income, savingsPct: number): CostBand {
  const status = findHomeEnergyRebateStatus(state)?.status;
  if (status !== 'open') return { low: 0, mid: 0, high: 0 };
  if (income === 'high' || income === 'unknown') {
    // HOMES has a market-rate tier (non-income-qualified) for 35%+ modeled savings: up to $2,000–$4,000
    if (savingsPct >= 0.20) return { low: 1000, mid: 2000, high: 4000 };
    return { low: 0, mid: 0, high: 0 };
  }
  if (income === 'moderate') {
    if (savingsPct >= 0.35) return { low: 2000, mid: 4000, high: 4000 };
    if (savingsPct >= 0.20) return { low: 1000, mid: 2000, high: 2000 };
  }
  if (income === 'low') {
    if (savingsPct >= 0.35) return { low: 4000, mid: 8000, high: 8000 };
    if (savingsPct >= 0.20) return { low: 2000, mid: 4000, high: 4000 };
  }
  return { low: 0, mid: 0, high: 0 };
}

export default function InsulationCalculator() {
  useCalculatorUsed('insulation');
  const [state, setState] = useState('MA');
  const [zip, setZip] = useState('');
  const [sqft, setSqft] = useState(1800);
  const [scope, setScope] = useState<Scope>('attic_walls_air');
  const [atticType, setAtticType] = useState<AtticType>('blown_cellulose');
  const [existing, setExisting] = useState<ExistingR>('low_r11');
  const [income, setIncome] = useState<Income>('unknown');

  useEffect(() => {
    if (zip.length === 5) {
      const detected = findStateForZip(zip);
      if (detected && detected !== state) setState(detected);
    }
  }, [zip, state]);

  const result = useMemo(() => {
    const atticArea = sqft;                  // assume single-story footprint = attic area
    const wallArea = sqft * 1.2;             // rough: exterior wall surface ≈ 1.2× footprint
    const stateLab = findStateLabor(state);
    const laborMult = stateLab?.electrician_multiplier ?? 1.0;  // proxy for general trades

    const atticPer = ATTIC_PER_SQFT[atticType];
    const atticCost: CostBand = scale(atticPer, atticArea * laborMult);
    const wallCost: CostBand = scale(WALL_PER_SQFT, wallArea * laborMult);
    const airSealCost = scale(AIR_SEAL, laborMult);
    const crawlCost = scale(CRAWL, laborMult);

    let gross: CostBand = { low: 0, mid: 0, high: 0 };
    if (scope === 'attic_only') gross = atticCost;
    else if (scope === 'walls_only') gross = wallCost;
    else if (scope === 'attic_walls') gross = add(atticCost, wallCost);
    else if (scope === 'attic_walls_air') gross = add(add(atticCost, wallCost), airSealCost);
    else if (scope === 'whole_envelope') gross = add(add(add(atticCost, wallCost), airSealCost), crawlCost);

    const savingsPct = annualSavingsPct(scope, existing);
    const annualHvac = annualHvacCostPerSqft(state, sqft);
    const annualSavings = annualHvac * savingsPct;
    const paybackYears = annualSavings > 0 ? Math.round((gross.mid / annualSavings) * 10) / 10 : null;

    // HEEHRA / HOMES rebate
    const homes = homesRebateEstimate(state, income, savingsPct);
    const net: CostBand = {
      low: Math.max(0, gross.low - homes.low),
      mid: Math.max(0, gross.mid - homes.mid),
      high: Math.max(0, gross.high - homes.high),
    };

    return { gross, atticCost, wallCost, airSealCost, crawlCost, savingsPct, annualHvac, annualSavings, paybackYears, homes, net };
  }, [state, sqft, scope, atticType, existing, income]);

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  const t = targetR(state);
  const climate = findClimate(state)?.iecc_zone ?? '4A';

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

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Home size (sqft)</label>
          <input
            type="number" min={500} max={6000} step={50} value={sqft}
            onChange={e => setSqft(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Job scope</label>
          <select className="input mt-1 w-full" value={scope} onChange={e => setScope(e.target.value as Scope)}>
            <option value="attic_only">Attic only</option>
            <option value="walls_only">Walls only (drill-and-fill)</option>
            <option value="attic_walls">Attic + walls</option>
            <option value="attic_walls_air">Attic + walls + air-sealing (recommended)</option>
            <option value="whole_envelope">Whole envelope (+ crawl/basement)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Attic material</label>
          <select className="input mt-1 w-full" value={atticType} onChange={e => setAtticType(e.target.value as AtticType)}>
            <option value="blown_cellulose">Blown-in cellulose (recommended)</option>
            <option value="blown_fiberglass">Blown-in fiberglass</option>
            <option value="open_foam">Open-cell spray foam</option>
            <option value="closed_foam">Closed-cell spray foam</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Existing attic R-value</label>
          <select className="input mt-1 w-full" value={existing} onChange={e => setExisting(e.target.value as ExistingR)}>
            <option value="none">None / nothing in attic</option>
            <option value="low_r11">Low (R-11, ~3 inches)</option>
            <option value="medium_r19_30">Medium (R-19 to R-30)</option>
            <option value="high_r38plus">High (R-38 or more)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Income tier (for HEEHRA/HOMES)</label>
          <select className="input mt-1 w-full" value={income} onChange={e => setIncome(e.target.value as Income)}>
            <option value="unknown">Unknown / prefer not to say</option>
            <option value="low">Low (&lt;80% Area Median Income)</option>
            <option value="moderate">Moderate (80-150% AMI)</option>
            <option value="high">High (&gt;150% AMI)</option>
          </select>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-br from-amber-50 via-white to-amber-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            Estimated installed cost · {sqft} sqft · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)} gross</p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">Net after rebate (mid)</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-amber-800">{fmtUSD(result.net.mid)}</p>
              <p className="mt-1 text-[11px] text-ink-600">Range {fmtUSDRange(result.net.low, result.net.high)}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-amber-700">Simple payback</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-amber-800">
                {result.paybackYears != null ? `${result.paybackYears} yr` : 'n/a'}
              </p>
              <p className="mt-1 text-[11px] text-ink-600">
                Saves ~{fmtUSD(result.annualSavings)}/yr on HVAC
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              {(scope === 'attic_only' || scope === 'attic_walls' || scope === 'attic_walls_air' || scope === 'whole_envelope') && (
                <li className="flex justify-between gap-3"><span>Attic ({atticType.replace('_', ' ')})</span><span className="tabular-nums">{fmtUSD(result.atticCost.mid)}</span></li>
              )}
              {(scope === 'walls_only' || scope === 'attic_walls' || scope === 'attic_walls_air' || scope === 'whole_envelope') && (
                <li className="flex justify-between gap-3"><span>Walls (drill-and-fill)</span><span className="tabular-nums">{fmtUSD(result.wallCost.mid)}</span></li>
              )}
              {(scope === 'attic_walls_air' || scope === 'whole_envelope') && (
                <li className="flex justify-between gap-3"><span>Air-sealing + blower door</span><span className="tabular-nums">{fmtUSD(result.airSealCost.mid)}</span></li>
              )}
              {scope === 'whole_envelope' && (
                <li className="flex justify-between gap-3"><span>Crawl/basement encapsulation</span><span className="tabular-nums">{fmtUSD(result.crawlCost.mid)}</span></li>
              )}
            </ul>
            <div className="mt-3 rounded-md border border-brand-200 bg-brand-50 p-3 text-xs text-brand-800">
              <strong>Target R-values for {climate}:</strong> attic R{t.attic}, walls R{t.wall} (per DOE / 2021 IECC residential).
            </div>
          </div>

          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Savings &amp; rebates</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">HVAC savings %</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{Math.round(result.savingsPct * 100)}%</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Climate zone</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{climate}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">Annual HVAC cost</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-ink-900">{fmtUSD(result.annualHvac)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-600">DOE HOMES rebate</dt>
                <dd className="mt-0.5 font-medium tabular-nums text-brand-700">
                  {result.homes.mid > 0 ? `−${fmtUSD(result.homes.mid)}` : 'not eligible'}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-[11px] text-ink-600">
              25C tax credit for insulation ended 2025-12-31. DOE HOMES rebate availability varies by state — see /rebates/ for current state status. State + utility programs (Mass Save, NYSERDA, Energy Trust of Oregon) often layer on top.
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <strong>Why envelope first:</strong> if you’re planning a heat pump, panel upgrade, or any electrification work, doing insulation + air-sealing <em>first</em> shrinks every downstream estimate. A tighter envelope means a smaller heat pump (less equipment cost), less demand on your panel (less likely to need an upgrade), and lower lifetime operating costs.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Pre and post blower-door numbers (ACH50 or CFM50). Without this, the contractor can’t verify what was actually achieved.</li>
            <li>· Target R-value at completion (R-49 attic, R-13/15/20 wall by climate zone).</li>
            <li>· Air-sealing is line-itemed separately from insulation, not bundled vaguely.</li>
            <li>· Vapor retarder strategy appropriate to climate zone (more critical north of zone 4).</li>
            <li>· Recessed lights are IC-rated or replaced before blow-in covers them.</li>
            <li>· Attic baffles installed at every soffit vent to maintain ridge ventilation.</li>
            <li>· Knee-walls in finished attics and rim joists addressed.</li>
            <li>· Building Performance Institute (BPI) or RESNET certified contractor for HOMES rebate eligibility.</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="insulation"
    />
    </>
  );
}
