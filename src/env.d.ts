/// <reference path="../.astro/types.d.ts" />

// Vite ?raw imports for CSVs. Resolved at runtime by Vite (loaded as string),
// but tsc has no built-in declaration — without this, `npm run build` succeeds
// and `npx tsc --noEmit` emits ~50 spurious TS2307 errors, hiding real regressions.
declare module '*.csv?raw' {
  const content: string;
  export default content;
}
