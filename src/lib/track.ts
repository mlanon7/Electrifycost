// Shared GA4 conversion-event helper for the bespoke calculators that do NOT use
// ResultPanel. The 5 flagship calculators fire `calculator_used` from ResultPanel
// itself; this hook gives the other 32 calculator islands the same signal so
// affiliate / Mediavine attribution covers the full product, not just the flagships.
//
// Fires once per island after hydration. A calculator island only hydrates when a
// real (JS-enabled) visitor reaches its page, so a single fire-on-mount is a clean
// "this calculator was engaged" conversion signal, consistent with how the flagship
// ResultPanel fires on first result render.
import { useEffect, useRef } from 'react';

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

/** Fire the GA4 `calculator_used` event once for a bespoke (non-ResultPanel) calculator. */
export function useCalculatorUsed(slug: string): void {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    fired.current = true;
    window.gtag('event', 'calculator_used', { module: slug, scenario: slug });
  }, [slug]);
}
