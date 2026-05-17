import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { CalculatorResult } from '@/lib/calc';
import { sources, checklists } from '@/lib/data';
import { fmtUSD, fmtUSDRange, fmtMonths } from '@/lib/format';

// Fire a GA4 custom event when the calculator produces a valid result.
// Debounced via ref so we don't fire on every keystroke. Single event per
// result-module change.
declare global {
  interface Window { gtag?: (...args: unknown[]) => void; }
}

interface Props {
  result: CalculatorResult | null;
  loading?: boolean;
  /** When non-null, the engine threw — ResultPanel shows a visible error
   * banner instead of silently falling back to the empty-state copy. */
  error?: string | null;
  /** Contractor quote (USD). When set, ResultPanel renders a small
   * quote-check block comparing the quote vs. low/mid/high. Shared
   * across all five calculators. */
  contractorQuote?: number | null;
  /** When provided, used in the empty-state preview headline. */
  emptyStateLabel?: string;
  /** When provided, called when the user clicks "Reset to defaults" in
   * the error state. */
  onReset?: () => void;
}

export default function ResultPanel({
  result,
  loading = false,
  error = null,
  contractorQuote = null,
  emptyStateLabel = 'Estimated installed cost',
  onReset,
}: Props) {
  const [showSources, setShowSources] = useState(true);
  const [showChecklist, setShowChecklist] = useState(true);
  const [copied, setCopied] = useState(false);
  const [openWhy, setOpenWhy] = useState<string | null>(null);

  const checklist = useMemo(() => result ? checklists[result.contractorChecklistKey] : undefined, [result]);

  // GA4 calculator_used event. Fires once per distinct (module, scenario) the
  // user lands on. Captures which calculators are converting and from which
  // state — the single most useful signal for Mediavine/affiliate decisions.
  const lastEventRef = useRef<string | null>(null);
  useEffect(() => {
    if (!result) return;
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    const key = result.module + ':' + result.scenario;
    if (lastEventRef.current === key) return;
    lastEventRef.current = key;
    window.gtag('event', 'calculator_used', {
      module: result.module,
      scenario: result.scenario,
      gross_mid: result.gross?.mid,
      net_mid: result.netAfterIncentives?.mid,
    });
  }, [result]);

  if (loading) {
    return (
      <div className="card-elev p-6 animate-pulse" role="status" aria-busy="true" aria-label="Calculating estimate">
        <div className="h-3 w-1/4 rounded bg-ink-100 mb-3" />
        <div className="h-10 w-2/3 rounded bg-ink-100 mb-5" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-5">
          <div className="h-24 rounded-xl bg-ink-100" />
          <div className="h-28 rounded-xl bg-ink-100" />
          <div className="h-24 rounded-xl bg-ink-100" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-2/3 rounded bg-ink-100" />
          <div className="h-4 w-1/2 rounded bg-ink-100" />
          <div className="h-4 w-3/4 rounded bg-ink-100" />
        </div>
        <span className="sr-only">Calculating your estimate…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-elev p-6" role="alert">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-700">!</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-700">Couldn&apos;t compute an estimate.</p>
            <p className="mt-1 text-sm text-ink-700">{error}</p>
            <p className="mt-2 text-xs text-ink-600">
              This usually means a data row is missing or the inputs hit an unsupported combination.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {onReset && (
                <button type="button" onClick={onReset} className="btn-ghost border border-ink-200">
                  Reset to defaults
                </button>
              )}
              <a
                href="https://github.com/electrifycost/electrifycost/issues/new"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-700 underline-offset-2 hover:underline"
              >
                Report on GitHub ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="card-elev overflow-hidden">
        <div className="bg-gradient-to-br from-brand-50/60 via-white to-white p-6">
          <p className="eyebrow">{emptyStateLabel}</p>
          <p className="mt-1 text-4xl font-semibold tracking-tightest text-ink-300 tabular-nums">
            $— – $—
          </p>
          <p className="mt-2 text-sm text-ink-600">
            Tell us about your home and we&apos;ll estimate what this project will really cost &mdash; installed, after rebates, and on your monthly bill.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-hidden="true">
            {(['Low','Mid (typical)','High'] as const).map(label => (
              <div key={label} className="rounded-xl border border-dashed border-ink-200 bg-white px-3 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums text-ink-300">$—</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const handleCopy = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : '';
    const text = buildShareText(result, url);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handlePrint = () => window.print();

  const opMonth = result.monthlyEnergyImpact;
  const opDir = result.energyImpactDirection;

  return (
    <div
      className="space-y-4 print:space-y-3"
      role="region"
      aria-label="Cost estimate"
      aria-live="polite"
    >
      <section className="card-elev overflow-hidden">
        <header className="bg-gradient-to-br from-brand-50 via-white to-white px-5 py-5 sm:px-6 sm:py-6">
          <p className="eyebrow">Estimated installed cost</p>
          <p className="mt-1 break-words text-3xl font-semibold tracking-tightest text-ink-900 tabular-nums sm:text-4xl">
            {fmtUSD(result.gross.mid)}
          </p>
          <p className="mt-1 text-sm text-ink-600 tabular-nums">
            Typical range {fmtUSDRange(result.gross.low, result.gross.high)} · {result.scenarioLabel}
          </p>
        </header>
        <div className="grid grid-cols-1 gap-3 border-t border-ink-100 bg-white p-4 sm:grid-cols-3 sm:p-5">
          <CostCard label="Low" amount={result.gross.low} tone="ink" hint="Best case" />
          <CostCard label="Mid" amount={result.gross.mid} tone="brand" emphasized hint="Typical" />
          <CostCard label="High" amount={result.gross.high} tone="ink" hint="Worst case" />
        </div>
      </section>

      {contractorQuote != null && Number.isFinite(contractorQuote) && contractorQuote > 0 && (
        <QuoteCheck quote={contractorQuote} gross={result.gross} />
      )}

      {result.incentives.length > 0 && (
        <div className="net-card">
          <div className="flex items-center justify-between">
            <p className="net-card-title">Net cost after estimated incentives</p>
            <span className="badge-green">Mid: {fmtUSD(result.netAfterIncentives.mid)}</span>
          </div>
          <p className="net-card-amount">
            {fmtUSDRange(result.netAfterIncentives.low, result.netAfterIncentives.high)}
          </p>
          <p className="mt-2 text-xs text-brand-700">
            Net = gross minus rebates currently available. Federal 25C, 25D, 30D, 25E credits expired (OBBBA, 2025) and are not subtracted. 30C (EV charger) still applies through 2026-06-30 with eligible-tract rules.
          </p>
        </div>
      )}

      <div className="card p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-ink-900">Itemized cost breakdown</h3>
          <span className="text-xs text-ink-500">Click a row for math &amp; sources</span>
        </div>
        <table className="mt-2 w-full text-sm">
          <thead className="text-xs text-ink-600">
            <tr>
              <th className="text-left font-medium py-1.5">Line item</th>
              <th className="text-right font-medium py-1.5">Low</th>
              <th className="text-right font-medium py-1.5">Mid</th>
              <th className="text-right font-medium py-1.5">High</th>
            </tr>
          </thead>
          <tbody>
            {result.itemized.map(it => {
              const isOpen = openWhy === it.label;
              return (
                <Fragment key={it.label}>
                  <tr
                    className={`border-t border-ink-100 cursor-pointer transition-colors hover:bg-brand-50/40 ${isOpen ? 'bg-brand-50/40' : ''}`}
                    onClick={() => setOpenWhy(isOpen ? null : it.label)}
                    aria-expanded={isOpen}
                  >
                    <td className="py-2">
                      <div className="flex items-center gap-1.5 font-medium text-ink-800">
                        {it.label}
                        <span aria-hidden="true" className={`text-[10px] text-ink-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}>▸</span>
                      </div>
                      {it.notes && <div className="mt-0.5 text-xs text-ink-600">{it.notes}</div>}
                    </td>
                    <td className="py-2 text-right tabular-nums text-ink-700">{fmtUSD(it.amount.low)}</td>
                    <td className="py-2 text-right tabular-nums font-medium text-ink-900">{fmtUSD(it.amount.mid)}</td>
                    <td className="py-2 text-right tabular-nums text-ink-700">{fmtUSD(it.amount.high)}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-brand-50/40">
                      <td colSpan={4} className="px-3 py-3 text-xs text-ink-700">
                        <p className="font-semibold text-ink-900">Why this number?</p>
                        <p className="mt-1">
                          Mid value <span className="tabular-nums">{fmtUSD(it.amount.mid)}</span> sits inside the
                          {' '}<span className="tabular-nums">{fmtUSDRange(it.amount.low, it.amount.high)}</span> band
                          from the source data for <em>{result.scenario}</em>.
                          {it.notes ? ' ' + it.notes : ''}
                        </p>
                        {result.sourceIds.length > 0 && (
                          <p className="mt-1.5">
                            Sources used:{' '}
                            {result.sourceIds.slice(0, 3).map((id, i) => {
                              const s = sources[id];
                              if (!s) return null;
                              return (
                                <span key={id}>
                                  {i > 0 && ', '}
                                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-brand-700 underline-offset-2 hover:underline">
                                    {s.title}
                                  </a>
                                </span>
                              );
                            })}
                            {result.sourceIds.length > 3 && <span className="text-ink-500"> and {result.sourceIds.length - 3} more below</span>}
                            .
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <tr className="border-t-2 border-ink-200 bg-ink-50">
              <td className="py-2 font-semibold text-ink-900">Total</td>
              <td className="py-2 text-right font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.low)}</td>
              <td className="py-2 text-right font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.mid)}</td>
              <td className="py-2 text-right font-semibold tabular-nums text-ink-900">{fmtUSD(result.gross.high)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {result.incentives.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-ink-900">Rebates &amp; tax credits</h3>
          <ul className="mt-2 divide-y divide-ink-100">
            {result.incentives.map(i => (
              <li key={i.programId} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-ink-900">{i.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className={i.scope === 'federal' ? 'badge-green' : 'badge'}>
                        {i.scope === 'federal' ? 'Federal' : i.scope === 'state' ? 'State' : 'Utility'}
                      </span>
                      <span className="badge">{i.incentiveType === 'tax_credit' ? 'Tax credit' : 'Rebate'}</span>
                      {i.expiration && i.expiration !== 'unspecified' && i.expiration !== 'none' && (
                        <span className="text-ink-600">Expires {i.expiration}</span>
                      )}
                    </div>
                    {i.caveat && <p className="mt-1 text-xs text-amber-700">{i.caveat}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums text-brand-700">
                      −{fmtUSD(i.amount.mid)}
                    </div>
                    <div className="text-xs text-ink-600 tabular-nums">
                      {fmtUSDRange(i.amount.low, i.amount.high)}
                    </div>
                    {i.sourceUrl && (
                      <a href={i.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-[11px] text-ink-600 underline-offset-2 hover:underline">
                        Source ↗
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.potentialIncentives && result.potentialIncentives.length > 0 && (
        <div className="card p-4 border-amber-200 bg-amber-50/40">
          <h3 className="text-sm font-semibold text-amber-900">Possible additional incentives</h3>
          <p className="mt-1 text-xs text-amber-800">
            These are <em>not</em> subtracted from the net cost above because eligibility isn&apos;t confirmed for your address yet.
          </p>
          <ul className="mt-2 divide-y divide-amber-200/70">
            {result.potentialIncentives.map(i => (
              <li key={'pot_' + i.programId} className="py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-ink-900">{i.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="badge-amber">Potential</span>
                      <span className={i.scope === 'federal' ? 'badge-green' : 'badge'}>
                        {i.scope === 'federal' ? 'Federal' : i.scope === 'state' ? 'State' : 'Utility'}
                      </span>
                      <span className="badge">{i.incentiveType === 'tax_credit' ? 'Tax credit' : 'Rebate'}</span>
                    </div>
                    {i.caveat && <p className="mt-1 text-xs text-amber-800">{i.caveat}</p>}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums text-amber-800">
                      up to −{fmtUSD(i.amount.mid)}
                    </div>
                    {i.sourceUrl && (
                      <a href={i.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-[11px] text-ink-600 underline-offset-2 hover:underline">
                        Source ↗
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(opMonth || result.simplePaybackMonths != null) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {opMonth && opDir && (
            <div className="card p-4">
              <div className="flex items-baseline justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-600">Monthly energy impact</p>
                {opDir === 'savings' && <span className="badge-green">Savings</span>}
                {opDir === 'increase' && <span className="badge-amber">Increase</span>}
                {opDir === 'neutral' && <span className="badge">~Neutral</span>}
              </div>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${
                opDir === 'savings' ? 'text-brand-700' :
                opDir === 'increase' ? 'text-amber-700' :
                'text-ink-700'
              }`}>
                {opDir === 'savings' && '−'}
                {opDir === 'increase' && '+'}
                {fmtUSD(Math.abs(opMonth.mid))}
                <span className="ml-1 text-base font-normal text-ink-600">/ mo</span>
              </p>
              <p className="mt-1 text-xs text-ink-600">
                {opDir === 'savings' &&
                  <>Likely savings between {fmtUSD(Math.abs(opMonth.high))} and {fmtUSD(Math.abs(opMonth.low))} per month vs. your current fuel.</>}
                {opDir === 'increase' &&
                  <>Likely increase between {fmtUSD(opMonth.low)} and {fmtUSD(opMonth.high)} per month vs. your current fuel.</>}
                {opDir === 'neutral' &&
                  <>Bills change very little &mdash; between {fmtUSD(opMonth.low)} and {fmtUSD(opMonth.high)} per month either way.</>}
              </p>
            </div>
          )}
          {result.simplePaybackMonths != null && (
            <div className="card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-ink-600">Simple payback (mid)</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">
                {fmtMonths(result.simplePaybackMonths)}
              </p>
              <p className="mt-1 text-xs text-ink-600">Net cost ÷ annual savings vs. current fuel.</p>
            </div>
          )}
        </div>
      )}

      {result.panelRisk && (
        <div className="card p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-900">Panel upgrade likelihood</h3>
            <PanelRiskBadge level={result.panelRisk.risk_level} />
          </div>
          <p className="mt-1 text-sm text-ink-700">{result.panelRisk.explanation}</p>
          {result.panelAdder && result.panelAdder.mid > 0 && (
            <p className="mt-1 text-xs text-ink-600">
              Estimated adder included: {fmtUSDRange(result.panelAdder.low, result.panelAdder.high)}.
            </p>
          )}
        </div>
      )}

      {checklist && (
        <div className="card p-4">
          <button
            type="button"
            onClick={() => setShowChecklist(s => !s)}
            className="flex w-full items-center justify-between text-left"
            aria-expanded={showChecklist}
          >
            <h3 className="text-sm font-semibold text-ink-900">{checklist.title}</h3>
            <span className="text-xs text-ink-600">{showChecklist ? 'Hide' : 'Show'}</span>
          </button>
          {showChecklist && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">
              {checklist.items.map((q, i) => <li key={i}>{q}</li>)}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        <p className="font-medium">What can change this price</p>
        <ul className="mt-1 list-disc space-y-0.5 pl-5">
          {result.caveats.map((c, i) => <li key={i}>{c}</li>)}
        </ul>
      </div>

      <div className="card p-4">
        <button
          type="button"
          onClick={() => setShowSources(s => !s)}
          className="flex w-full items-center justify-between text-left"
          aria-expanded={showSources}
        >
          <h3 className="text-sm font-semibold text-ink-900">Sources used</h3>
          <span className="text-xs text-ink-600 tabular-nums">Last reviewed {result.reviewedAt}</span>
        </button>
        {showSources && (
          <ul className="mt-2 space-y-1 text-sm">
            {result.sourceIds.map(id => {
              const s = sources[id];
              if (!s) return null;
              return (
                <li key={id}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
                  <span className="ml-1 text-xs text-ink-600">&mdash; {s.publisher}, reviewed {s.last_reviewed}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="no-print flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleCopy} className="btn-ghost border border-ink-200" aria-label="Copy a shareable summary to the clipboard">
          {copied ? 'Copied!' : 'Share estimate'}
        </button>
        <button type="button" onClick={handlePrint} className="btn-ghost border border-ink-200" aria-label="Open the print dialog for a printable summary">
          Print summary
        </button>
      </div>
    </div>
  );
}

function CostCard({ label, amount, tone, emphasized, hint }: { label: string; amount: number; tone: 'ink' | 'brand'; emphasized?: boolean; hint?: string }) {
  const base = tone === 'brand' ? 'border-brand-200 bg-brand-50' : 'border-ink-200 bg-white';
  return (
    <div className={`relative rounded-xl border p-4 ${base} ${emphasized ? 'ring-1 ring-brand-300' : ''}`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className={`text-xs font-medium uppercase tracking-wide ${tone === 'brand' ? 'text-brand-700' : 'text-ink-600'}`}>{label}</p>
        {emphasized && (
          <span className="rounded-full bg-brand-700 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
            Typical
          </span>
        )}
      </div>
      <p className={`mt-1 tabular-nums font-semibold text-ink-900 ${emphasized ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'}`}>
        {fmtUSD(amount)}
      </p>
      {hint && <p className="mt-0.5 text-xs text-ink-600">{hint}</p>}
    </div>
  );
}

function PanelRiskBadge({ level }: { level: string }) {
  const map: Record<string, string> = {
    minimal: 'badge-green',
    low: 'badge-green',
    medium: 'badge-amber',
    high: 'badge-rose',
    critical: 'badge-rose',
  };
  const label = level.charAt(0).toUpperCase() + level.slice(1);
  return <span className={map[level] ?? 'badge'}>{label} risk</span>;
}

/** Shared quote-check block used when the user enters a contractor quote. */
function QuoteCheck({ quote, gross }: { quote: number; gross: CalculatorResult['gross'] }) {
  let band: 'low' | 'in' | 'high';
  let diff = 0;
  if (quote < gross.low) { band = 'low'; diff = gross.low - quote; }
  else if (quote > gross.high) { band = 'high'; diff = quote - gross.high; }
  else { band = 'in'; }

  const headlineColor =
    band === 'in' ? 'text-brand-700' :
    band === 'low' ? 'text-amber-700' :
    'text-rose-700';
  const headline =
    band === 'in' ? 'Your quote is inside the typical range.' :
    band === 'low' ? `Your quote is ~${fmtUSD(diff)} below the typical low end.` :
    `Your quote is ~${fmtUSD(diff)} above the typical high end.`;

  const checklist =
    band === 'low'
      ? [
          'Confirm permits and inspection are included in the price',
          'Confirm grounding, bonding, and meter/main work meet current code',
          'Confirm labor warranty length and what it covers',
          'Confirm equipment trim level / make / model (not a "we’ll match later")',
        ]
      : band === 'high'
      ? [
          'Ask for itemized labor hours and equipment line items',
          'Ask whether a panel upgrade is truly required or whether load management would work',
          'Ask whether multiple quotes from comparable contractors were considered',
          'Confirm the scope matches what you actually want (avoid "premium" add-ons you don’t need)',
        ]
      : [];

  return (
    <div className={`card p-4 ${band === 'in' ? 'border-brand-200 bg-brand-50/40' : band === 'low' ? 'border-amber-200 bg-amber-50/40' : 'border-rose-200 bg-rose-50/40'}`}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-ink-900">Bid check</h3>
        <span className="text-xs text-ink-600">Your quote: {fmtUSD(quote)}</span>
      </div>
      <p className={`mt-1 text-sm font-semibold ${headlineColor}`}>{headline}</p>
      <p className="mt-1 text-xs text-ink-700">
        Typical range for this project (low / mid / high): {fmtUSD(gross.low)} / {fmtUSD(gross.mid)} / {fmtUSD(gross.high)}.
      </p>
      {checklist.length > 0 && (
        <>
          <p className="mt-2 text-xs font-medium text-ink-900">Ask the contractor to itemize:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-ink-700">
            {checklist.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </>
      )}
    </div>
  );
}

function buildShareText(r: CalculatorResult, url?: string): string {
  const lines = [
    `ElectrifyCost.com estimate — ${r.scenarioLabel}`,
    `Total cost (low / mid / high): ${fmtUSD(r.gross.low)} / ${fmtUSD(r.gross.mid)} / ${fmtUSD(r.gross.high)}`,
    `Net after incentives (mid): ${fmtUSD(r.netAfterIncentives.mid)}`,
  ];
  if (r.incentives.length > 0) {
    lines.push('Incentives included:');
    for (const i of r.incentives) lines.push(`  • ${i.name}: −${fmtUSD(i.amount.mid)}`);
  }
  if (r.potentialIncentives && r.potentialIncentives.length > 0) {
    lines.push('Potential (not subtracted):');
    for (const i of r.potentialIncentives) lines.push(`  • ${i.name}: potential up to −${fmtUSD(i.amount.mid)}`);
  }
  if (r.monthlyEnergyImpact) {
    const m = r.monthlyEnergyImpact.mid;
    lines.push(`Monthly energy impact: ${m < 0 ? '−' : '+'}${fmtUSD(Math.abs(m))} / mo`);
  }
  lines.push(`Last reviewed: ${r.reviewedAt}`);
  if (url) lines.push(`Re-run with the same inputs: ${url}`);
  lines.push('Estimates are planning ranges, not contractor quotes.');
  return lines.join('\n');
}
