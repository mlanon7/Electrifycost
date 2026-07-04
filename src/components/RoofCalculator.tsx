import { useCalculatorUsed } from '@/lib/track';
import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';
import MonteCarloSim from './MonteCarloSim';
import { useHashStateInit, useHashStateSync, serializeHashState } from '@/lib/use-url-state';
import { usePublishEstimate } from '@/lib/estimate-snapshot';
import {
  compute, MATERIAL_OPTIONS, PITCH_OPTIONS, STORIES_OPTIONS,
  type Material, type Pitch, type Stories,
} from '@/lib/calcs/roof-replacement';

export default function RoofCalculator() {
  useCalculatorUsed('roof-replacement');
  const [state, setState] = useState('OH');
  const [zip, setZip] = useState('');
  const [roofSqft, setRoofSqft] = useState(2200);
  const [material, setMaterial] = useState<Material>('asphalt_architectural');
  const [pitch, setPitch] = useState<Pitch>('medium');
  const [stories, setStories] = useState<Stories>('2');
  const [needsTearoff, setNeedsTearoff] = useState(true);
  const [needsDeckRepair, setNeedsDeckRepair] = useState(false);
  const [needsGutters, setNeedsGutters] = useState(false);
  const [solarPlanned, setSolarPlanned] = useState(false);

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
      if (Number.isFinite(n)) setRoofSqft(Math.min(10000, Math.max(500, n)));
    }
    if (h.mat && MATERIAL_OPTIONS.some(o => o.value === h.mat)) setMaterial(h.mat as Material);
    if (h.pitch && PITCH_OPTIONS.some(o => o.value === h.pitch)) setPitch(h.pitch as Pitch);
    if (h.stories && STORIES_OPTIONS.some(o => o.value === h.stories)) setStories(h.stories as Stories);
    if (h.tear) setNeedsTearoff(h.tear === '1');
    if (h.deck) setNeedsDeckRepair(h.deck === '1');
    if (h.gut) setNeedsGutters(h.gut === '1');
    if (h.solar) setSolarPlanned(h.solar === '1');
  });
  const hashValues = {
    state, zip, sqft: roofSqft, mat: material, pitch, stories,
    tear: needsTearoff ? '1' : '0', deck: needsDeckRepair ? '1' : '0',
    gut: needsGutters ? '1' : '0', solar: solarPlanned ? '1' : '0',
  };
  useHashStateSync(hashValues);

  const result = useMemo(
    () => compute({ state, roofSqft, material, pitch, stories, needsTearoff, needsDeckRepair, needsGutters, solarPlanned }),
    [state, roofSqft, material, pitch, stories, needsTearoff, needsDeckRepair, needsGutters, solarPlanned],
  );

  const stateName = ALL_STATES.find(s => s.code === state)?.name ?? state;

  // Publish a structured estimate snapshot for the Project Simulator once the
  // user genuinely interacts (trusted events only — never a share-link replay).
  usePublishEstimate('roof-replacement', () => {
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

  return (
    <>
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
          <p className="mt-1 text-[10px] text-ink-600">{zip.length === 5 ? <span className="text-brand-700">State auto-set from ZIP</span> : 'Optional — auto-sets state'}</p>
        </div>

        <div>
          <label className="label" htmlFor="roofSqft">Roof area (sqft)</label>
          <input id="roofSqft" className="input" type="number" min={500} max={10000} step={50} value={roofSqft} onChange={e => setRoofSqft(Number(e.target.value) || 0)} />
          <p className="mt-1 text-[10px] text-ink-600">Roof area ≈ floor area × 1.1–1.4 depending on pitch and overhangs.</p>
        </div>
        <div>
          <label className="label" htmlFor="material">Material</label>
          <select id="material" className="input" value={material} onChange={e => setMaterial(e.target.value as Material)}>
            {MATERIAL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div>
          <label className="label" htmlFor="pitch">Roof pitch</label>
          <select id="pitch" className="input" value={pitch} onChange={e => setPitch(e.target.value as Pitch)}>
            {PITCH_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="stories">Number of stories</label>
          <select id="stories" className="input" value={stories} onChange={e => setStories(e.target.value as Stories)}>
            {STORIES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        <div className="md:col-span-2 space-y-2">
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={needsTearoff} onChange={e => setNeedsTearoff(e.target.checked)} />
            Tear off existing roof (vs overlay)
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={needsDeckRepair} onChange={e => setNeedsDeckRepair(e.target.checked)} />
            Roof deck repair likely needed
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={needsGutters} onChange={e => setNeedsGutters(e.target.checked)} />
            Replace gutters at the same time
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input type="checkbox" checked={solarPlanned} onChange={e => setSolarPlanned(e.target.checked)} />
            Plan to add solar (request solar-ready prep)
          </label>
        </div>
      </div>

      <div className="border-t border-ink-200 bg-ink-50/40 p-5 md:p-6">
        <div className="net-card relative overflow-hidden rounded-xl border border-ink-300/60 bg-gradient-to-br from-ink-50 via-white to-blue-50 p-5 shadow-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-700">
            Installed cost · {result.label} · {stateName}
          </p>
          <div className="mt-1 flex flex-wrap items-baseline gap-3">
            <p className="text-3xl font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</p>
            <p className="text-sm text-ink-600">range {fmtUSDRange(result.gross.low, result.gross.high)}</p>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-ink-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-ink-700">Per sqft</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink-800">${result.perSqft.toFixed(2)}</p>
            </div>
            <div className="rounded-lg border border-ink-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-ink-700">Lifespan</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink-800">{result.lifespan} yr</p>
            </div>
            <div className="rounded-lg border border-ink-200 bg-white/70 p-3">
              <p className="text-[10px] font-medium uppercase tracking-wide text-ink-700">Cost / year</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums text-ink-800">{fmtUSD(result.lifetimeCostPerYear)}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Cost breakdown</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              <li className="flex justify-between"><span>Material + install ({result.label})</span><span className="tabular-nums">{fmtUSD(result.materialCost.mid)}</span></li>
              {needsTearoff && <li className="flex justify-between"><span>Tear-off existing roof</span><span className="tabular-nums">{fmtUSD(result.tearoffCost.mid)}</span></li>}
              {needsDeckRepair && <li className="flex justify-between"><span>Deck repair</span><span className="tabular-nums">{fmtUSD(result.deckCost.mid)}</span></li>}
              {needsGutters && <li className="flex justify-between"><span>Gutters replacement</span><span className="tabular-nums">{fmtUSD(result.gutterCost.mid)}</span></li>}
              {solarPlanned && <li className="flex justify-between"><span>Solar-ready prep</span><span className="tabular-nums">{fmtUSD(result.solarPrepCost.mid)}</span></li>}
              <li className="flex justify-between border-t border-ink-100 pt-2 font-semibold"><span>Total (mid)</span><span className="tabular-nums">{fmtUSD(result.gross.mid)}</span></li>
            </ul>
          </div>
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-ink-900">Solar readiness</h3>
            <p className="mt-2 text-sm text-ink-700">
              <strong>{result.label}</strong> has solar-friendly score <strong>{result.solarReady}/5</strong> (lower is better).
              {result.solarReady <= 3
                ? ' This roof type works well with standard rail mounting and the installer will be happy.'
                : ' This roof type adds complexity — clay/wood shake adds $1–$3/W to solar costs because of special flashing.'}
            </p>
            {solarPlanned && (
              <p className="mt-2 text-[11px] text-ink-600">
                Solar-ready prep adds an attic conduit run and a labeled main-panel breaker — saves $300–$1,500 when solar is installed later. <a href="/solar-panel-cost-calculator/" className="text-brand-700 font-medium">Run the solar calculator →</a>
              </p>
            )}
          </div>
        </div>

        <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <strong>Solar timing rule:</strong> if your roof is older than 15 years, replace the roof <em>before</em> installing solar. Otherwise you’ll pay $2,000–$4,000 in panel removal-and-replace fees in 5–10 years when the roof fails. Solar panels and racking weigh ~3 lb/sqft, well within asphalt’s structural capacity.
        </div>

        <div className="mt-5 card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Quote check — what to ask</h3>
          <ul className="mt-2 space-y-1 text-sm text-ink-700">
            <li>· Tear-off vs overlay specified. Overlay (going over existing) is cheaper but voids most manufacturer warranties.</li>
            <li>· Underlayment type (synthetic, peel-and-stick at eaves, ice-and-water shield in cold climates).</li>
            <li>· Drip edge, starter strip, and ridge cap line-itemed — not "as needed."</li>
            <li>· Ice-and-water shield to code: 24" past warm-wall in cold climates per IBC R905.1.1.</li>
            <li>· Ventilation strategy — ridge vent + soffit ratio at least 1:1. Inadequate venting voids most shingle warranties.</li>
            <li>· Decking repair included as a per-sheet rate, not just "as needed."</li>
            <li>· Warranty: 10-year workmanship minimum from contractor; 25-50 year materials warranty from manufacturer.</li>
            <li>· License and insurance certificate. Roofing has the highest contractor-fraud rate of any home improvement; verify both.</li>
          </ul>
        </div>
      </div>
    </div>
    <MonteCarloSim
      band={{ low: result.gross.low, high: result.gross.high }}
      slug="roof-replacement"
    />
    </>
  );
}
