import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findClimate } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, targetR, SCOPE_OPTIONS, ATTIC_OPTIONS, EXISTING_OPTIONS,
  type Scope, type AtticType, type ExistingR, type Income,
} from '@/lib/calcs/insulation';

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

  // Hydrate from URL hash on mount + serialize back (share-link persistence).
  // Restored values are validated so a crafted link can't render absurd totals.
  useHashStateInit(h => {
    if (h.state && ALL_STATES.some(s => s.code === h.state)) setState(h.state);
    if (h.zip) setZip(h.zip.replace(/\D/g, '').slice(0, 5));
    if (h.sqft) {
      const n = parseInt(h.sqft, 10);
      if (Number.isFinite(n)) setSqft(Math.min(6000, Math.max(500, n)));
    }
    if (h.scope && SCOPE_OPTIONS.some(o => o.value === h.scope)) setScope(h.scope as Scope);
    if (h.attic && ATTIC_OPTIONS.some(o => o.value === h.attic)) setAtticType(h.attic as AtticType);
    if (h.existing && EXISTING_OPTIONS.some(o => o.value === h.existing)) setExisting(h.existing as ExistingR);
    if (h.income && ['unknown', 'low', 'moderate', 'high'].includes(h.income)) setIncome(h.income as Income);
  });
  const hashValues = { state, zip, sqft, scope, attic: atticType, existing, income };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, sqft, scope, atticType, existing, income }),
    [state, sqft, scope, atticType, existing, income],
  );

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;
  usePublishEstimate('insulation', () => {
    if (!(result.gross.high > 0)) return null;
    return {
      v: 2,
      low: Math.round(result.gross.low),
      high: Math.round(result.gross.high),
      sub: result.scope,
      qs: serializeHashState(hashValues),
      attrs: result.attrs,
      brk: result.brk,
      loc: stateName,
      mode: 'installed',
      ts: Date.now(),
      int: true,
    };
  });

  const t = targetR(state);
  const climate = findClimate(state)?.iecc_zone ?? '4A';

  return (
    <>
    <div className="card overflow-hidden">
      <div className="grid gap-5 p-5 md:grid-cols-2 md:p-6">
        <div>
          <label htmlFor="insul-zip" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">ZIP code</label>
          <input
            id="insul-zip"
            type="text" inputMode="numeric" maxLength={5} value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g., 02134"
            className="input mt-1 w-full"
          />
          <p className="mt-1 text-[11px] text-ink-600">Optional — auto-detects state</p>
        </div>

        <div>
          <label htmlFor="insul-state" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">State</label>
          <select id="insul-state" className="input mt-1 w-full" value={state} onChange={e => setState(e.target.value)}>
            {ALL_STATES.map(s => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="insul-sqft" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Home size (sqft)</label>
          <input
            id="insul-sqft"
            type="number" min={500} max={6000} step={50} value={sqft}
            onChange={e => setSqft(Number(e.target.value) || 0)}
            className="input mt-1 w-full"
          />
        </div>

        <div>
          <label htmlFor="insul-scope" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Job scope</label>
          <select id="insul-scope" className="input mt-1 w-full" value={scope} onChange={e => setScope(e.target.value as Scope)}>
            {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="insul-attic" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Attic material</label>
          <select id="insul-attic" className="input mt-1 w-full" value={atticType} onChange={e => setAtticType(e.target.value as AtticType)}>
            {ATTIC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="insul-existing" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Existing attic R-value</label>
          <select id="insul-existing" className="input mt-1 w-full" value={existing} onChange={e => setExisting(e.target.value as ExistingR)}>
            {EXISTING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="insul-income" className="block text-xs font-semibold uppercase tracking-wide text-ink-700">Income tier (for HEEHRA/HOMES)</label>
          <select id="insul-income" className="input mt-1 w-full" value={income} onChange={e => setIncome(e.target.value as Income)}>
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
