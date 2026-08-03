# Documentation map — ElectrifyCost

**Every document in this repo, what it is for, and when to read it.** The site is the product; these
docs are working memory. If you are new here, read in this order:

1. **[`CLAUDE.md`](CLAUDE.md)** — the operating context. Stack, page inventory, the calculator engine,
   editing conventions, critical federal-credit dates. **Always read first.**
2. **[`README.md`](README.md)** — project overview and local-dev quickstart.
3. **[`audit/README.md`](audit/README.md)** — what has been audited, what was found, what is still open.
4. This file — where everything else lives.

---

## The flow

How work actually moves through this project. Do not skip the gate.

```
   ┌─────────────────────────────────────────────────────────────────┐
   │  1. ORIENT      CLAUDE.md → audit/README.md → .claude/lessons/  │
   │                 Check for a relevant lesson BEFORE editing.     │
   ├─────────────────────────────────────────────────────────────────┤
   │  2. CHANGE      Numbers → data/csv/*.csv   (never hard-code)    │
   │                 Pages  → src/pages/*.astro                      │
   │                 Math   → src/lib/calcs/<slug>.ts                │
   ├─────────────────────────────────────────────────────────────────┤
   │  3. GATE        npm test          (9 stages, all must pass)     │
   │                 npx tsc --noEmit                                │
   │                 npm run build     (701 pages / 500 sitemap URLs)│
   ├─────────────────────────────────────────────────────────────────┤
   │  4. SHIP        Stage files explicitly (never `git add -A`)     │
   │                 Commit → push to main → Vercel deploys          │
   ├─────────────────────────────────────────────────────────────────┤
   │  5. VERIFY      Check the change on the LIVE site, not local    │
   ├─────────────────────────────────────────────────────────────────┤
   │  6. RECORD      CHANGELOG.md for shipped work                   │
   │                 audit/ + audit/README.md for audits             │
   │                 .claude/lessons/ when something surprised you   │
   └─────────────────────────────────────────────────────────────────┘
```

**The gate (`npm test`, 9 stages, in order):** CSV schema → risk-events → page structure →
banned-content strings → 13 calculator scenarios → 29 formula assertions → 39 Monte Carlo assertions
→ 32 simulator-codec assertions → generated-band drift check. Stage 9 fails if
`src/data/scenario-projects.json` drifts from what the real calculator functions produce — those
bands are **generated, never hand-edited**.

---

## Root documents

| Doc | Purpose | Read it when |
|---|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Operating context: stack, 701-page inventory, engine, conventions, credit dates | Always, first |
| [`README.md`](README.md) | Overview + local-dev quickstart | Setting up |
| [`DOCS.md`](DOCS.md) | This map | Looking for something |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | How it fits together — engine, CSV data layer, programmatic-SEO dimensions | Changing structure |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Workflow, the gate, commit conventions | Before your first commit |
| [`STYLEGUIDE.md`](STYLEGUIDE.md) | Voice, sourcing standards, AI-slop blacklist | Writing any published copy |
| [`TEMPLATE.md`](TEMPLATE.md) | "The ElectrifyCost pattern" a new portfolio site clones | Starting a sibling site |
| [`DEPLOY.md`](DEPLOY.md) | Deploy procedure (Vercel + custom sitemap step) | Shipping |
| [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) | Domain, DNS, hosting, email (SPF/DKIM/DMARC), analytics | Touching anything non-code |
| [`SECURITY.md`](SECURITY.md) | Security policy and headers posture | Security questions |
| [`ROADMAP.md`](ROADMAP.md) | Planned work — keyword tiers, guide phases, CSV-chunking refactor | Planning |
| [`CHANGELOG.md`](CHANGELOG.md) | Shipped-version log, newest first | "When did X change?" |
| [`AGENTS.md`](AGENTS.md) | Pointer for non-Claude AI tooling into this context | Using another agent |
| `LICENSE` | License | — |

These stay at the repo root deliberately. `README`, `LICENSE`, `CONTRIBUTING`, `SECURITY` and
`CHANGELOG` are GitHub-convention root files, and `CHANGELOG.md` alone is referenced from 31 other
files — relocating them into a `docs/` folder would break dozens of links for no correctness gain.

## Audit

| Location | Purpose |
|---|---|
| [`audit/README.md`](audit/README.md) | **The index.** Every report, what it found, what shipped, and which archived reports contain known-wrong figures. Read before opening any individual report. |
| `audit/FULL_AUDIT_2026-07-31.md` | The one current report |
| `audit/archive/` | 25 superseded reports — Claude passes, independent Codex passes, per-pass change logs, the keyword backlog, and the ProjectCostPro handoff brief |

## `.claude/` toolkit

| Location | Purpose |
|---|---|
| [`.claude/README.md`](.claude/README.md) | Toolkit index |
| `.claude/commands/` (9) | Slash-command playbooks: `ship`, `preflight`, `audit-site`, `add-calculator`, `add-guide`, `add-state-pages`, `debug-build`, `refresh-sources`, `update-data` |
| `.claude/lessons/` (12) | **Hard-won lessons. Check the relevant one before touching that surface.** Sitemap namespace, esbuild template-literal bug, calculator state prop, guide-template drift, CSV single-source-of-truth, Mediavine timing, no-funnel position, Astro route collisions, email auth, portfolio cross-linking, Monte Carlo port, **programmatic duplication (12 — read before adding any programmatic dimension)** |
| `.claude/prompts/` (5) | Reusable prompts: full-site audit, content-quality review, data verification, cold-start SEO, HackerNews launch |
| `.claude/launch.json` | Dev-server config for the browser preview |

## Data and scripts

| Location | Purpose |
|---|---|
| [`data/csv/README.md`](data/csv/README.md) | Per-column docs + edit checklist for the 51 source-of-truth CSVs |
| `data/csv/*.csv` (51) | **Every number on the site.** Each row carries `source_id` + `last_reviewed` |
| `src/data/source-notes.json` | 200+ source entries behind `/sources/` |
| `src/data/scenario-projects.json` | **Generated** — never hand-edit; rebuild with `build-scenario-bands.cjs` |
| `scripts/` (17) | The gate, plus `build-sitemap.cjs` (postbuild), `indexnow-submit.cjs`, `audit-scan.cjs`, `contrast-check.cjs` |

---

## Known oddities

Things that look wrong but are not, and things that are genuinely unresolved.

- **⚠️ Two working copies.** `D:\claude projects\Websites\Electrifycost\` (main) is ~19 commits
  behind with 19 uncommitted files and **fails `npm test`**. The worktree under
  `.claude/worktrees/` is in sync and green. **Never ship from the main folder.** Never bulk-port its
  uncommitted changes — its `federal-credits.csv` still has 30C `active` and would revert the July
  expiry flip. Full detail in `audit/README.md`.
- **`scripts/submit-indexnow.cjs` does not exist here — that is correct.** Lesson 10 references it as
  the *ProjectCostPro* script name. This repo's is `scripts/indexnow-submit.cjs`. Do not "fix" it.
- **`source-backed-calculator-site.skill`** (34 KB, OOXML/zip at the repo root) — a packaged skill
  spec, not used by the build and not referenced by any living doc. Flagged P3 in the 2026-05-13
  audit ("move to docs or delete") and never resolved. Left in place; delete only deliberately.
- **`contrast-check.cjs` reports 1 failure** (`ink-400 on white`). Documented as decorative-only and
  intentionally accepted — 20 of 21 pairs pass.
- **Bing sitemap:** register the **apex only**. `www` now permanently redirects (308), and
  registering a permanently-redirecting sitemap URL is what caused Bing to de-register it in July.
- **Do not re-run `indexnow-submit.cjs` against the full sitemap.** Bing now warns against batch
  mode. New or changed URLs only.

---

*Portfolio-level context lives one and two directories up: `../CLAUDE.md` (calculator-portfolio
operating rules), `../STYLEGUIDE.md`, and the workspace-root `CLAUDE.md` (taxonomy).*

Last reviewed: 2026-07-31.
