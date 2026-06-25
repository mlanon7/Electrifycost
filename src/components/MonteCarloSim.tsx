import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { streamer } from '@/lib/montecarlo.js';
import riskEventsData from '@/data/risk-events.json';
import { money, domainFor, buildChart } from '@/lib/mc-chart';
import type { McBand, McItem, McEvent, McDist, McResult } from '@/lib/mc-chart';

/*
 * MonteCarloSim — per-calculator Monte Carlo simulation island (React port of
 * ProjectCostPro's montecarlo-ui.js). Fed the live GROSS installed-cost band +
 * line items from a calculator's result, it streams 10,000 trials and shows the
 * emergent distribution: P10 (optimistic) / most-likely (the curve's peak) / P90
 * (safer budget). The simple published low-high is drawn only as a faint
 * reference — never relabeled as the answer.
 *
 * Each line item is drawn from a triangular distribution and the items are tied
 * together by a one-factor Gaussian copula (rho 0.5), so the most-likely value
 * and the range EMERGE from the simulation. Markup is 1:1 (ElectrifyCost's engine
 * has no separate markup band; the band passed in is already the installed cost).
 */

interface Props {
  /** Reference band — the gross installed-cost low/high. */
  band?: McBand | null;
  /** Line items (each {low, high}); they should sum to the band. */
  items?: McItem[];
  /** Calculator slug, used to look up real-world surprise events. */
  slug: string;
}

// `_meta` lives alongside the slug keys; it is never looked up by slug at runtime.
const RISK_EVENTS = riskEventsData as unknown as Record<string, McEvent[]>;
const TRIALS = 10000;
const PER_FRAME = 320;

/** Map the live band + items into a sim model. Synthesizes sub-items when the
 *  calculator provides no line detail, so the portfolio effect still applies. */
function buildModel(band: McBand | null | undefined, items: McItem[] | undefined) {
  if (!band || !(band.high > band.low)) return null;
  let its: McItem[] = (items || [])
    .map(it => ({ low: +it.low || 0, high: +it.high || 0 }))
    .filter(it => it.high >= it.low && it.high > 0);
  if (its.length < 2) {
    const split = [0.5, 0.35, 0.15];
    its = split.map(s => ({ low: band.low * s, high: band.high * s }));
  }
  return { band: { low: band.low, high: band.high }, items: its };
}

export default function MonteCarloSim({ band, items, slug }: Props) {
  const events = useMemo<McEvent[]>(() => RISK_EVENTS[slug] || [], [slug]);
  const model = useMemo(() => buildModel(band, items), [band, items]);

  const [includeSurprises, setIncludeSurprises] = useState(false);
  const [res, setRes] = useState<McResult | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasRun, setHasRun] = useState(false);
  const [stale, setStale] = useState(false);

  const sectionRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  // Re-render gating: when the calculator inputs change after a run, invite a
  // re-run rather than re-animating on every keystroke.
  const sig = model ? `${model.band.low}|${model.band.high}|${model.items.length}` : 'none';
  const prevSigRef = useRef(sig);
  useEffect(() => {
    if (prevSigRef.current !== sig) {
      prevSigRef.current = sig;
      if (hasRun && !running) setStale(true);
    }
  }, [sig, hasRun, running]);

  const stopRaf = () => { if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };

  const run = useCallback(() => {
    if (!model) return;
    stopRaf();
    setStale(false);
    setRunning(true);
    setHasRun(true);
    setProgress(0);
    // Fresh random seed each run so re-runs genuinely vary (real sampling noise).
    const seed = (Math.random() * 4294967296) >>> 0;
    const stream = streamer(model.items, {
      trials: TRIALS, rho: 0.5, markup: { low: 1, high: 1 }, band: model.band,
      seed, events: events.length ? events : [],
    });
    const reduce = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      const r = stream.batch(TRIALS) as McResult;
      setRes(r); setProgress(TRIALS); setRunning(false);
      return;
    }
    let done = 0;
    const frame = () => {
      const nb = Math.min(PER_FRAME, TRIALS - done);
      const r = stream.batch(nb) as McResult;
      done += nb;
      setRes(r); setProgress(done);
      if (done < TRIALS) { rafRef.current = requestAnimationFrame(frame); }
      else { rafRef.current = null; setRunning(false); }
    };
    rafRef.current = requestAnimationFrame(frame);
  }, [model, events]);

  // Keep a ref to the latest run() so the once-on-mount observer always calls
  // the current closure (with the latest model/events) without re-subscribing.
  const runRef = useRef(run);
  runRef.current = run;
  const hasModelRef = useRef(!!model);
  hasModelRef.current = !!model;

  // Auto-run once when the section scrolls into view (never an empty box). Set
  // up the observer a single time so calculator keystrokes don't churn it.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const go = () => { if (!startedRef.current && hasModelRef.current) { startedRef.current = true; runRef.current(); } };
    if (typeof IntersectionObserver === 'undefined') { go(); return; }
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.isIntersecting) { io.disconnect(); go(); return; }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => () => stopRaf(), []);

  // Persist the configured installed-cost band so the Project Simulator can read
  // it back as a "Custom" tier. Only writes once the band moves off its default
  // (i.e. the user actually changed an input) — matching ProjectCostPro: merely
  // viewing a calculator never creates a saved config. One write point here
  // covers every calculator, since each embeds this component with its slug.
  const bandKey = model ? `${model.band.low}|${model.band.high}` : '';
  const defaultBandRef = useRef<string | null>(null);
  useEffect(() => {
    if (!model || !bandKey) return;
    if (defaultBandRef.current === null) { defaultBandRef.current = bandKey; return; }
    if (bandKey === defaultBandRef.current) return;
    try {
      localStorage.setItem('ec:est:' + slug, JSON.stringify({ low: model.band.low, high: model.band.high, ts: Date.now(), int: true }));
    } catch { /* localStorage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bandKey, slug]);

  if (!model) return null;

  const dist: McDist | null = res ? ((includeSurprises && res.events) ? res.events : res.base) : null;
  const dom = domainFor(model.band, includeSurprises);
  const chartHtml = dist ? buildChart(dist, model.band, dom) : '';
  const counterText = running
    ? `simulating ${progress.toLocaleString('en-US')} / ${TRIALS.toLocaleString('en-US')} scenarios`
    : stale ? 'inputs changed — run again'
    : hasRun ? `${TRIALS.toLocaleString('en-US')} scenarios simulated` : '';

  return (
    <section ref={sectionRef} className="mc-section" data-slug={slug}>
      <div className="mc-head">
        <span className="mc-head-ic" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="4" y="4" width="16" height="16" rx="3.5" />
            <circle cx="9" cy="9" r="1.15" fill="currentColor" stroke="none" />
            <circle cx="15" cy="9" r="1.15" fill="currentColor" stroke="none" />
            <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
            <circle cx="9" cy="15" r="1.15" fill="currentColor" stroke="none" />
            <circle cx="15" cy="15" r="1.15" fill="currentColor" stroke="none" />
          </svg>
        </span>
        <span className="mc-head-text">
          <span className="mc-head-eyebrow">Cost simulator</span>
          <span className="mc-head-title">Monte Carlo simulation</span>
          <span className="mc-head-sub">See the full range of likely installed costs — with the odds</span>
        </span>
      </div>

      <div className="mc-inner">
        <div className="mc-cards">
          <div className="mc-card">
            <span className="mc-card-label">Optimistic</span>
            <span className="mc-card-val">{dist ? money(dist.p10) : '—'}</span>
            <span className="mc-card-sub">10% chance under</span>
          </div>
          <div className="mc-card mc-card-mid">
            <span className="mc-card-label">Most likely</span>
            <span className="mc-card-val">{dist ? money(dist.mode) : '—'}</span>
            <span className="mc-card-sub">the single most-likely cost</span>
          </div>
          <div className="mc-card">
            <span className="mc-card-label">Safer budget</span>
            <span className="mc-card-val">{dist ? money(dist.p90) : '—'}</span>
            <span className="mc-card-sub">90% chance under</span>
          </div>
        </div>

        <p className="mc-summary">
          {dist ? (
            <>
              Most projects like this come in around <b>{money(dist.mode)}</b>. The simulation puts about
              {' '}8 in 10 between <b>{money(dist.p10)}</b> and <b>{money(dist.p90)}</b> — tighter than the simple
              {' '}{money(model.band.low)}–{money(model.band.high)} range, because the costs rarely all land at their
              {' '}extremes at once.
            </>
          ) : (
            <>Run a Monte Carlo of 10,000 possible outcomes to see the full distribution and the single most-likely installed cost.</>
          )}
        </p>

        <div className="mc-chart">
          {dist
            ? <div dangerouslySetInnerHTML={{ __html: chartHtml }} />
            : <div className="mc-chart-empty"><span>Press <b>Run simulation</b> to roll 10,000 scenarios and watch the odds take shape.</span></div>}
        </div>

        <p className="mc-refnote">
          {dist ? `Faint lines mark the simple low–high range (${money(model.band.low)}–${money(model.band.high)}) — the full theoretical spread.` : ''}
        </p>

        <div className="mc-runrow">
          <button type="button" className="mc-run" onClick={run} disabled={running}>
            {running ? 'Running…' : hasRun ? 'Run again' : 'Run simulation'}
          </button>
          <span className="mc-counter">{counterText}</span>
        </div>

        {events.length > 0 && (
          <div className="mc-surprises">
            <label className="mc-switch">
              <input type="checkbox" checked={includeSurprises} onChange={e => setIncludeSurprises(e.target.checked)} />
              <span className="mc-switch-track"><span className="mc-switch-thumb" /></span>
              <span className="mc-switch-text">Include real-world surprises</span>
            </label>
            <p className="mc-surprise-stat">
              {includeSurprises && dist && res?.events
                ? <>About <b>{Math.round((res.events.pctHitAny ?? 0) * 100)}%</b> of these projects hit at least one surprise — typically <b>+{money(res.events.meanAddedWhenHit ?? 0)}</b>.</>
                : ''}
            </p>
            <ul className="mc-ev-list">
              {events.map((ev, i) => (
                <li key={i}>
                  <span className="mc-ev-odds">{ev.show_probability === false ? 'Possible' : '~' + Math.round(ev.p * 100) + '%'}</span>
                  <span className="mc-ev-label">{ev.label}</span>
                  <span className="mc-ev-cost">+{money(ev.costLow)}–{money(ev.costHigh)}</span>
                </li>
              ))}
            </ul>
            <p className="mc-approx">
              Surprise odds are approximate planning estimates, not measured rates; cost ranges are sourced where shown.{' '}
              <a href="/methodology/">How this works</a>.
            </p>
          </div>
        )}

        <p className="mc-method">
          Each cost line is drawn from a triangular distribution and correlated by a shared market factor (~0.5);
          the most-likely value and range emerge from the simulation, not the band. A planning simulation, not a quote.
        </p>
      </div>
    </section>
  );
}
