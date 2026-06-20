# Contributing to ElectrifyCost

This is currently a solo project; contributions from collaborators / AI assistants / future you should follow these conventions.

---

## Before you start

1. Read **[CLAUDE.md](CLAUDE.md)** — the working-context file. It explains the tech stack, the shared calculator engine, the OBBBA federal-credit dates, and known pitfalls.
2. Read **[ARCHITECTURE.md](ARCHITECTURE.md)** if you're touching the engine or the data layer.
3. Read **[STYLEGUIDE.md](STYLEGUIDE.md)** if you're writing or editing content (calculator FAQs, guide pages, comparison pages).

---

## Branch + commit conventions

- **Branch off `main`.** Use a short kebab-case name describing the change: `fix-state-page-default`, `phase-3-callout-cards`, `add-vermont-rebate-row`.
- **One concern per branch.** Don't bundle a CSS refactor with a content rewrite with a CSV update.
- **Commit messages:** subject line under 70 chars; descriptive body explaining the *why* (not the *what*). Existing commits like `Phase 1: Unify guide formatting across all 37 guides` and `Fix sitemap.xml namespace typo (sitemap-0.9 → sitemap/0.9)` are the style template.
- **Always include the co-author trailer** if an AI assistant wrote any portion of the change:
  ```
  Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
  ```

---

## The PR test gate

Every commit must pass the full test chain before pushing:

```bash
npm test
# Runs in this order, all must pass:
#   1. validate-csvs.cjs         — schema check on all 49 CSVs
#   2. validate-pages.cjs        — Layout open/close balance, JSX-trap detection
#   3. smoke-test.cjs            — 13 calculator scenarios + 9 assertion groups
#   4. new-calc-tests.cjs        — 29 formula assertions
```

Plus:

```bash
npx tsc --noEmit          # zero errors
npm run build             # must complete cleanly + emit 690+ URLs in sitemap.xml
```

CI runs the same chain on every push and PR via `.github/workflows/ci.yml`. If CI fails after you push, fix the issue and push a follow-up commit (don't force-push to rewrite history).

---

## Don't skip hooks

- Never commit with `--no-verify`.
- Never bypass GPG signing with `--no-gpg-sign`.
- If a pre-commit hook fails, fix the underlying issue. The hook caught something for a reason.

---

## How to add a new calculator

1. **Add the data row(s).** New cost scenarios go in `data/csv/project-cost-ranges.csv` (for flagship modules) or a new module-specific CSV like `data/csv/<module>-cost-ranges.csv` (for bespoke calculators). Every numeric column needs a `source_id` and `last_reviewed` date.
2. **Update `data/csv/README.md`** with the new file's column schema.
3. **Create the React component** at `src/components/<Module>Calculator.tsx`. Follow the pattern in `HeatPumpCalculator.tsx`:
   - Accept `initialState` prop (default `'CA'`)
   - useState hooks for each input
   - useMemo around `runCalculator()` if using the shared engine, otherwise inline math
   - Wrap result in `<ResultPanel result={result} />` for flagship-style UI
4. **Create the calculator page** at `src/pages/<module>-cost-calculator.astro`. Follow the structure of `heat-pump-cost-calculator.astro`:
   - Frontmatter: `faq` array, `schemaJsonLd` array (`WebApplication` + `FAQPage`)
   - Hero section with eyebrow + H1 + Quick-answer callout box
   - `<YourCalculator client:load />` islet
   - Below-fold: "New to <topic>?" intro paragraph, FAQ section, Related calculators links, `<AdSlot />`
5. **Add a card to `src/pages/index.astro`** (the modules grid).
6. **Add to the appropriate header dropdown** in `src/components/Header.astro`.
7. **Add a smoke-test case** in `scripts/smoke-cases.json` covering at least one realistic scenario.
8. **Run `npm test` and `npm run build` locally before committing.**

If the calculator is module-specific enough to also have state programmatic pages, clone `heat-pump-cost-[state].astro` (see "How to add state pages" below).

---

## How to add a new guide

1. **Create the file** at `src/pages/guides/<slug>.astro`.
2. **Use the Template A canonical structure** (see `heat-pumps.astro` as the gold reference):
   - Frontmatter: `TechArticle` JSON-LD with `headline`, `description`, `datePublished`, `dateModified`
   - `<Layout>` with breadcrumbs `[Home → Guides → <Topic>]`
   - First section: eyebrow + H1 + intro paragraph + `<div class="guide-toc not-prose">` pill bar
   - Numbered H2 sections: `<h2 id="<slug>">N. <Heading>` for each
   - End with "Use the calculator" CTA section
   - `<RelatedGuides slug="<slug>" />` immediately before closing `</Layout>`
3. **Update `src/lib/guide-relationships.ts`** — add an entry to `GUIDE_META` with the slug, title, `calculatorHref`, and 3 siblings. Update sibling references in other entries if appropriate.
4. **Update `src/pages/guides/index.astro`** (the guides hub) — add a row to the `guides` array.

---

## How to add a state-programmatic page set

For a new module that has 51 per-state pages:

1. **Clone an existing template** like `src/pages/heat-pump-cost-[state].astro`.
2. **Swap module-specific tokens:** calculator import + JSX, module filter in `rebatePrograms.filter(r => r.module === '<module>')`, `active=` URL, title, H1, FAQ content. **Critical:** pass `initialState={stateCode}` to the calculator — without this, every state page initially hydrates with California as the default state, surfacing wrong rebates.
3. **Create a by-state hub page** at `src/pages/<module>-cost-by-state.astro` — pattern is in `heat-pump-cost-by-state.astro`.
4. **Add a card to `src/pages/index.astro`** "Deep dives by state" section.
5. **Watch for the esbuild template-literal bug** (see CLAUDE.md "known parser pitfall"). If `npm run build` fails with `Unexpected "export"` at a `const faq = [` line, simplify any nested template literals to string concatenation.

---

## How to update rebate / cost / energy data

1. **Find the CSV row** — every numeric value lives in `data/csv/*.csv`. Never hard-code in TS/JS.
2. **Update the value(s)** in the relevant column.
3. **Bump the `last_reviewed` date** on that row to today's date (YYYY-MM-DD format).
4. **Update the `source_id`** if you're now citing a different primary source (the actual URL lives in `src/data/source-notes.json`; if it's new, add an entry there too).
5. **Run `npm test`** — the smoke-test exercises 13 scenarios and will tell you if your change broke the assertions.

The footer's "Data last refreshed YYYY-MM-DD" line surfaces the MAX `last_reviewed` across all sources, so once you bump a date the freshness signal updates automatically.

---

## Quality bars

A change is mergeable when:

- [ ] `npm test` passes (4 stages, all green)
- [ ] `npx tsc --noEmit` reports zero errors
- [ ] `npm run build` completes and emits 690+ URLs in `dist/sitemap.xml`
- [ ] No new dependencies added without explicit justification in commit body
- [ ] Any new content respects the "no funnel" position (see STYLEGUIDE.md)
- [ ] Any factual claim about a rebate, federal credit, or efficiency standard cites a primary source URL inline or in `/sources/`
- [ ] Disclaimers preserved on calculator pages ("Planning ranges, not contractor quotes")
- [ ] If the change touches a flagship calculator page, the visible Quick-answer band matches the homepage card range
