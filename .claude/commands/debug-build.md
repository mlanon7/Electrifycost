# /debug-build — Triage a failing build

When `npm run build` or `npm test` fails. Walk this checklist before diving into the code.

## Step 1 — Get the exact error

```bash
npm run build 2>&1 | tail -30
```

Capture the FULL error output. The first few lines usually point at the file + line. The "Stack trace" lines are noise.

## Step 2 — Match against known patterns

### A. `Unexpected "export"` at a `.astro` file line

**Cause:** esbuild parser bug with nested template literals + Unicode characters in Astro frontmatter. Specifically affects `const faq = [` declarations that use `${interpolation}` mixed with `°`, `±`, `→`, or nested backticks.

**Fix:**
- Simplify the FAQ template literals. Replace nested backticks with string concatenation:
  ```typescript
  // BREAKS:
  a: `... ${condition ? `nested ${expr}` : 'fallback'} ...`
  // WORKS:
  a: 'plain string ' + variable + ' more text' + (condition ? 'X' : 'Y')
  ```
- If that doesn't fix it, use plain strings without `${stateName}` interpolation at all and rely on the page-level state-name displayed elsewhere.
- See `.claude/lessons/02-esbuild-template-literal-bug.md` for the full case study.

### B. `Cannot find module '@/...'`

**Cause:** Path alias broken or file moved without updating imports.

**Fix:**
- Check `tsconfig.json` for the `paths` config (should map `@/*` to `src/*`)
- Verify the imported file actually exists at the expected location
- If a file was renamed, search-and-replace the old path: `grep -rn "old/path" src/`

### C. `RollupError: Could not resolve '...'`

**Cause:** Vite can't find a CSV file or asset path.

**Fix:**
- Verify the file exists at the path the `?raw` import points to
- Check capitalization (case-sensitive on Linux/Vercel build, case-insensitive locally on Windows). This bites Windows developers — Vercel will fail on a name that worked locally.

### D. `'X' is not defined` in JSX

**Cause:** Used an Astro frontmatter variable inside a `{...}` JSX expression without it being declared in the frontmatter.

**Fix:**
- Check the frontmatter block (`---` ... `---`) — the variable must be declared there for it to be usable in the body
- Watch for typos: `stateCode` vs `stateName` vs `state` are all valid identifiers in different contexts

### E. `Failed to compile @astrojs/sitemap` or similar plugin failure

**Cause:** Sometimes an Astro integration crashes against a newer version.

**Fix:**
- Check `astro.config.mjs` — is the integration commented out? It may have been disabled for a reason (we use a custom `scripts/build-sitemap.cjs` instead).
- DON'T re-enable a disabled integration without understanding why it was disabled. Check `git log -p astro.config.mjs` for context.

### F. `Type error: ... is not assignable to ...`

**Cause:** TypeScript type mismatch.

**Fix:**
- Read the error carefully — TS usually tells you the expected type and the actual type
- Check the imported interface (e.g., `CalcArgs`, `CostBand`) for the right shape
- Avoid `as any` — use the right type or restructure the call

### G. `@rollup/rollup-linux-x64-gnu` not found

**Cause:** Native binary mismatch between Windows host and Linux build environment. Affects ONLY developer machines, not Vercel CI.

**Fix:**
- On the Windows host, `node_modules` got installed with Linux-targeted native binaries from a sandbox/devcontainer
- Delete `node_modules` and `package-lock.json`, run `npm install` fresh on the Windows machine
- Vercel build will install fresh on Linux, no conflict

## Step 3 — Validate isolated stage

If `npm test` fails, run each stage independently:

```bash
node scripts/validate-csvs.cjs      # CSV schema
node scripts/validate-pages.cjs     # Layout balance + JSX traps
node scripts/smoke-test.cjs         # 13 engine scenarios
node scripts/new-calc-tests.cjs     # 29 bespoke formula assertions
```

This isolates which stage is failing. The error from one stage doesn't always block the others.

## Step 4 — Check recent commits

If the build was passing recently:

```bash
git log --oneline -10
git diff HEAD~1 -- "<path-to-broken-file>"
```

What changed in the last commit that could have introduced this? Often it's a content edit that bumped into a parser limitation.

## Step 5 — Bisect if needed

If the broken commit is far back:

```bash
git bisect start
git bisect bad HEAD
git bisect good <known-good-sha>
# git checks out a midpoint; run npm test
git bisect good   # or 'bad'
# repeat until isolated
git bisect reset
```

## Step 6 — Verify the fix

After the fix:

```bash
npm test
npx tsc --noEmit
npm run build
```

All three must pass. Then run `/preflight` for a final check before `/ship`.

## When to escalate to the user

- The error mentions a file you didn't touch and weren't expecting to change
- The error is in a third-party dependency (`node_modules/...`)
- The error references the Windows-vs-Linux rollup binary issue and you don't have permission to delete `node_modules`
- The fix would require breaking a documented invariant (changing a calculator's public output, modifying a CSV schema column)

In these cases, surface the exact error + the relevant lesson-doc link to the user and ask for guidance.
