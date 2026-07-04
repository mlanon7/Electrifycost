#!/usr/bin/env node
/*
 * scripts/build-scenario-bands.cjs
 *
 * Generates src/data/scenario-projects.json — the per-project tier band table
 * that feeds the Project Simulator. It is NOT a second source of truth: it
 * bundles scripts/band-entry.ts with esbuild (resolving the same `?raw` CSV
 * imports Vite resolves) and executes the REAL calculator compute functions
 * headlessly at national labor, so a published band can never drift from what
 * the live calculator computes. Pattern from ProjectCostPro's
 * build-scenario-bands.cjs (commit 157d935).
 *
 * Usage:
 *   node scripts/build-scenario-bands.cjs           # write src/data/scenario-projects.json
 *   node scripts/build-scenario-bands.cjs --check   # exit 1 if the file is stale (npm test stage)
 *
 * No new dependencies: esbuild ships with Astro.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'src', 'data', 'scenario-projects.json');

// Vite's `?raw` imports (used by src/lib/data.ts) resolved the same way:
// strip the query, read the file, ship it as a text module.
const rawLoaderPlugin = {
  name: 'vite-raw',
  setup(build) {
    build.onResolve({ filter: /\?raw$/ }, args => ({
      path: path.resolve(args.resolveDir, args.path.replace(/\?raw$/, '')),
      namespace: 'raw-text',
    }));
    build.onLoad({ filter: /.*/, namespace: 'raw-text' }, args => ({
      contents: fs.readFileSync(args.path, 'utf8'),
      loader: 'text',
    }));
  },
};

async function bundleAndLoad() {
  const outfile = path.join(os.tmpdir(), `ec-band-entry-${process.pid}.cjs`);
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'scripts', 'band-entry.ts')],
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node18',
    outfile,
    plugins: [rawLoaderPlugin],
    alias: { '@': path.join(ROOT, 'src') },
    logLevel: 'silent',
    // React never executes here (only pure compute modules are imported),
    // but keep resolution happy if a module pulls in a type-only dep.
    external: ['react', 'react-dom'],
  });
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    const mod = require(outfile);
    return mod.buildScenarioData();
  } finally {
    try { fs.unlinkSync(outfile); } catch { /* best effort */ }
  }
}

function stableStringify(obj) { return JSON.stringify(obj, null, 2) + '\n'; }

(async function main() {
  const check = process.argv.includes('--check');
  let data;
  try {
    data = await bundleAndLoad();
  } catch (e) {
    console.error('FAIL: band generator could not run the calculators: ' + (e && e.message ? e.message : e));
    process.exit(1);
  }
  const text = stableStringify(data);

  if (check) {
    if (!fs.existsSync(OUT)) {
      console.error('FAIL: ' + path.relative(ROOT, OUT) + ' is missing. Run: node scripts/build-scenario-bands.cjs');
      process.exit(1);
    }
    const norm = s => s.replace(/\r\n/g, '\n').trim();
    if (norm(fs.readFileSync(OUT, 'utf8')) !== norm(text)) {
      console.error('FAIL: src/data/scenario-projects.json is stale (calculator bands changed). Regenerate: node scripts/build-scenario-bands.cjs');
      process.exit(1);
    }
    console.log('OK: scenario-projects.json matches the live calculator bands (' + data.projectCount + ' projects).');
    return;
  }

  fs.writeFileSync(OUT, text);
  console.log('Wrote ' + path.relative(ROOT, OUT) + ' — ' + data.projectCount + ' projects, ' +
    data.projects.reduce((n, p) => n + p.tiers.length, 0) + ' tiers.');
})();
