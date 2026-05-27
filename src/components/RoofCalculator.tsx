import { useEffect, useMemo, useState } from 'react';
import { ALL_STATES, findStateForZip, findStateLabor } from '@/lib/data';
import { fmtUSD, fmtUSDRange } from '@/lib/format';

type Material = 'asphalt_3tab' | 'asphalt_architectural' | 'asphalt_premium' | 'metal_standing_seam' | 'metal_corrugated' | 'clay_tile' | 'concrete_tile' | 'slate' | 'synthetic_slate' | 'wood_shake' | 'flat_tpo' | 'flat_epdm';
type Pitch = 'low' | 'medium' | 'steep' | 'extreme';
type Stories = '1' | '2' | '3';

interface Band { low: number; mid: number; high: number; }

const MAT: Record<Material, { perSqftLow: number; perSqftMid: number; perSqftHigh: number; lifespan: number; solarReady: number; label: string }> = {
  asphalt_3tab:           { perSqftLow: 3.50, perSqftMid: 5.00, perSqftHigh: 7.00, lifespan: 18, solarReady: 3, label: '3-tab asphalt shingle' },
  asphalt_architectural:  { perSqftLow: 4.50, perSqftMid: 7.00, perSqftHigh: 9.50, lifespan: 25, solarReady: 3, label: 'Architectural asphalt shingle' },
  asphalt_premium:        { perSqftLow: 7.00, perSqftMid: 9.50, perSqftHigh: 12.50, lifespan: 35, solarReady: 3, label: 'Premium architectural shingle' },
  metal_standing_seam:    { perSqftLow: 11.00, perSqftMid: 15.00, perSqftHigh: 21.00, lifespan: 50, solarReady: 2, label: 'Standing-seam metal' },
  metal_corrugated:       { perSqftLow: 7.50, perSqftMid: 10.00, perSqftHigh: 13.50, lifespan: 40, solarReady: 2, label: 'Corrugated metal' },
  clay_tile:              { perSqftLow: 11.00, perSqftMid: 16.00, perSqftHigh: 24.00, lifespan: 75, solarReady: 5, label: 'Clay tile' },
  concrete_tile:          { perSqftLow: 9.00, perSqftMid: 13.50, perSqftHigh: 18.00, lifespan: 50, solarReady: 4, label: 'Concrete tile' },
  slate:                  { perSqftLow: 18.00, perSqftMid: 25.00, perSqftHigh: 40.00, lifespan: 100, solarReady: 5, label: 'Natural slate' },
  synthetic_slate:        { perSqftLow: 9.00, perSqftMid: 12.50, perSqftHigh: 17.00, lifespan: 50, solarReady: 4, label: 'Synthetic slate composite' },
  wood_shake:             { perSqftLow: 8.50, perSqftMid: 12.00, perSqftHigh: 16.50, lifespan: 30, solarReady: 8, label: 'Wood shake' },
  flat_tpo:               { perSqftLow: 5.50, perSqftMid: 7.50, perSqftHigh: 10.00, lifespan: 25, solarReady: 2, label: 'Flat TPO membrane' },
  flat_epdm:              { perSqftLow: 5.00, perSqftMid: 7.00, perSqftHigh: 9.50, lifespan: 25, solarReady: 2, label: 'Flat EPDM rubber' },
};

const TEAR_OFF_PER_SQFT = 1.25; // average across materials
const PITCH_MULT: Record<Pitch, number> = { low: 0.9, medium: 1.0, steep: 1.25, extreme: 1.55 };
const STORIES_MULT: Record<Stories, number> = { '1': 1.0, '2': 1.10, '3': 1.25 };
const DECK_REPAIR_BAND: Band = { low: 0, mid: 800, high: 3500 };
const GUTTER_REPLACE: Band = { low: 800, mid: 1800, high: 3500 };

function scale(b: Band, m: number): Band {
  return { low: b.low * m, mid: b.mid * m, high: b.high * m };
}
function add(a: Band, b: Band): Band {
  return { low: a.low + b.low, mid: a.mid + b.mid, high: a.high + b.high };
}

export default function RoofCalculator() {
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

  const result = useMemo(() => {
    const lab = findStateLabor(state);
    const laborMult = lab?.electrician_multiplier ?? 1.0; // proxy for trades
    const m = MAT[material];

    const baseBand: Band = {
      low: m.perSqftLow * roofSqft,
      mid: m.perSqftMid * roofSqft,
      high: m.perSqftHigh * roofSqft,
    };
    const pitchMult = PITCH_MULT[pitch];
    const storiesMult = STORIES_MULT[stories];
    let materialCost = scale(baseBand, laborMult * pitchMult * storiesMult);

    const tearoffCost: Band = needsTearoff
      ? scale({ low: TEAR_OFF_PER_SQFT * roofSqft * 0.9, mid: TEAR_OFF_PER_SQFT * roofSqft, high: TEAR_OFF_PER_SQFT * roofSqft * 1.2 }, laborMult)
      : { low: 0, mid: 0, high: 0 };
    const deckCost: Band = needsDeckRepair ? DECK_REPAIR_BAND : { low: 0, mid: 0, high: 0 };
    const gutterCost: Band = needsGutters ? GUTTER_REPLACE : { low: 0, mid: 0, high: 0 };
    const solarPrepCost: Band = solarPlanned ? { low: 200, mid: 500, high: 1200 } : { low: 0, mid: 0, high: 0 };

    const gross = add(add(add(add(materialCost, tearoffCost), deckCost), gutterCost), solarPrepCost);
    const perSqft = gross.mid / roofSqft;
    const lifespan = m.lifespan;
    const lifetimeCostPerYear = gross.mid / lifespan;

    return { gross, materialCost, tearoffCost, deckCost, gutterCost, solarPrepCost, perSqft, lifespan, lifetimeCostPerYear, label: m.label, solarReady: m.solarReady };
  }, [state, roofSqft, material, pitch, stories, needsTearoff, needsDeckRepair, needsGutters, solarPlanned]);

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
            <option value="asphalt_3tab">3-tab asphalt (cheapest)</option>
            <option value="asphalt_architectural">Architectural asphalt (most common)</option>
            <option value="asphalt_premium">Premium asphalt (50yr warranty)</option>
            <option value="metal_standing_seam">Standing-seam metal (best for solar)</option>
            <option value="metal_corrugated">Corrugated metal</option>
            <option value="clay_tile">Clay tile</option>
            <option value="concrete_tile">Concrete tile</option>
            <option value="slate">Natural slate (premium)</option>
            <option value="synthetic_slate">Synthetic slate composite</option>
            <option value="wood_shake">Wood shake</option>
            <option value="flat_tpo">Flat TPO membrane</option>
            <option value="flat_epdm">Flat EPDM rubber</option>
          </select>
        </div>

        <div>
          <label className="label" htmlFor="pitch">Roof pitch</label>
          <select id="pitch" className="input" value={pitch} onChange={e => setPitch(e.target.value as Pitch)}>
            <option value="low">Low (≤4/12 — walkable)</option>
            <option value="medium">Medium (5/12-7/12)</option>
            <option value="steep">Steep (8/12-12/12)</option>
            <option value="extreme">Extreme (12/12+ — requires staging)</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="stories">Number of stories</label>
          <select id="stories" className="input" value={stories} onChange={e => setStories(e.target.value as Stories)}>
            <option value="1">1 story</option>
            <option value="2">2 stories</option>
            <option value="3">3+ stories</option>
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
  );
}
