// Removed: previously a no-op analytics shim. Treeshaking dropped it from
// the bundle since nothing imported it. If/when analytics is wired up,
// re-introduce this module with a real provider (Plausible, Fathom, GA4
// gtag) and import `track()` from the calculator components.
//
// Removed during the 2026-05-08 audit punch list (#5).
//
// Intentionally empty.

export {};
