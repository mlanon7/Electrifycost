# Audit history — ElectrifyCost

Every audit this site has had, newest first. **Read this file before opening any individual report.**

Each report is a **point-in-time snapshot**. Read it for the reasoning behind a decision, never as
current-state documentation — the live state lives in `CLAUDE.md`, `ARCHITECTURE.md`, and the code.

## How this folder is organised

```
audit/
├── README.md                    ← you are here: the index
├── FULL_AUDIT_2026-07-31.md     ← the ONE current report
└── archive/                     ← every superseded report (nothing is ever deleted)
```

**Rule: exactly one current report at the top level.** When a new audit supersedes it, the old one
moves to `archive/` and gains a row in the table below. Reports cross-link each other by bare
filename, so any group that references each other must move together.

---

## Current

| Report | Date | Scope and outcome |
|---|---|---|
| [`FULL_AUDIT_2026-07-31.md`](FULL_AUDIT_2026-07-31.md) | 2026-07-31 | Google is **improving** (avg position 51.2 → 49.6 → **39.9**); Bing is at **absolute zero for 27 straight days**. Found and fixed a self-inflicted regression — the 07-24 `www` 307→308 change appears to have caused Bing to **de-register the sitemap** (re-submitted 7/31). Bing now warns explicitly against the IndexNow batch sent on 07-24. **Headline:** the sibling-site comparison revises the "authority-gated" diagnosis — PetPlanWise has **DR 0** (below EC's DR 2) with a near-identical backlink profile yet earns 28 organic traffic / 25 keywords while EC earns zero. Niche difficulty and the thin-page ratio, not backlinks alone, are the binding constraints. Shipped the June 29 content-precision edits; dependency advisories 9 → 5. |

---

## Archived — Claude, July 2026 series

| Report | Date | Scope and outcome |
|---|---|---|
| `TRAFFIC_AUDIT_2026-07-24.md` | 2026-07-24 | The traffic investigation. Separated three conflated things: the "drop today" in Ahrefs was a **reporting artifact** (incomplete current UTC day); the **real** decline was Google impressions falling ~93% around **June 10–17**, matching the May 2026 core update and the end of the new-domain discovery boost; and **Bing went to exactly 0 on July 2**. Contains the full **elimination pass** (§3.1) proving no site-side fault — still the canonical reference for what was ruled out and how. Superseded on the diagnosis by 07-31. |
| `FULL_AUDIT_2026-07-05.md` (+ `.log`) | 2026-07-05 | Second full-site deep audit, 7 parallel streams. Zero P0. Four P1s fixed: geothermal had been rebased **too low** on 07-04 (corrected to the $20k–$32k live-source range), 14 bespoke calculators had **detached form labels**, two FAQ answers still framed an expired federal credit as live, and an ~8px horizontal-scroll hairline. |
| `FULL_AUDIT_2026-07-04.md` (+ `.log`) | 2026-07-04 | First full-site deep audit, run alongside the ProjectCostPro Simulator v2 port. Two-pass: content, UI, calculation accuracy, SEO/schema, accessibility, data integrity, docs. Established the baseline 07-05 verified against. |

## Archived — Codex, independent third-party passes

Run by a different agent against the same site. Valuable precisely because they are independent —
they caught things the Claude passes missed, and vice versa.

| Report | Date | Scope and outcome |
|---|---|---|
| `NINE_ITEM_REMAINING_AUDIT_CODEX_2026-07-25.md` | 2026-07-25 | Nine-item remaining-work audit. Its **P0 — the active main folder is stale, behind the fixed branch, and fails `npm test`** — was independently verified and is still open (see "Two-checkout hazard" below). Also flagged the live `/sources/` 30C wording and the contractor/start-guide precision gaps, all since fixed. Two of its calls were checked and did **not** hold: `sources.astro` had already been fixed in July (the staleness was in `source-notes.json`), and the Grundfos URL returns a connection reset (bot-blocking), not a 404. |
| `POST_REVISION_DEEP_AUDIT_CODEX_2026-06-25.md` | 2026-06-25 | Third pass of the June Codex series, after the revisions from the two below. |
| `POST_FIX_DEEP_AUDIT_CODEX_2026-06-25.md` | 2026-06-25 | Second pass, re-auditing after the first round of fixes. |
| `FULL_SITE_AUDIT_CODEX_2026-06-25.md` | 2026-06-25 | First full-site Codex pass. Drove the California TECH rebate correction (funds fully reserved → routed to *potential*, never subtracted), the federal-credit copy fixes (30D vs 25D vs 25E), and the new `validate-content.cjs` banned-string guard. See the 2026-06-25 CHANGELOG entry. |

## Archived — Claude, May–June 2026 series

| Report | Date | Scope and outcome |
|---|---|---|
| `PRODUCT_AUDIT_2026-06-27.md` | 2026-06-27 | Product / UX / growth audit (6 agents incl. an adversarial lens). Found the site answered "what will THIS cost" with no on-ramp for undecided visitors. Drove `/guides/should-i-electrify/`, `/guides/is-a-heat-pump-worth-it/`, `/guides/hiring-a-contractor/` and the homepage on-ramp — all inside the no-funnel stance. |
| `FULL_AUDIT_CLAUDE_2026-06-25.md` | 2026-06-25 | Independent 18-agent full audit; every P0/P1 adversarially re-verified. Confirmed ship-clean (no P0), found one P1 (panel-FAQ single-source-of-truth). |
| `AUDIT_2026-05-27.md` | 2026-05-27 | Data-driven audit + build sprint. P0 (wrong 30D date) + 12 P1 + 13 P2: `/privacy/` + `/terms/`, `BreadcrumbList` on state pages, `WebApplication` schema, WCAG-AA contrast pass, `env.d.ts` csv?raw fix. |
| `AUDIT_CLAUDE_2026-05-14.md` | 2026-05-14 | Pass 4 — federal-credit IRS cross-check + 24-month revenue projection. |
| `DEEP_AUDIT_2026-05-13.md` | 2026-05-13 | Pass 3 — calculation-accuracy industry cross-check. ⚠️ **Its geothermal figures are wrong** ("$10.5–16.5k"); corrected in the 2026-07-05 audit to $20k–$32k. Do not reuse its geothermal numbers. |
| `ATTACK_PLAN_2026-05-13.md` | 2026-05-13 | Pass 3 planning doc — scope and approach. |
| `UX_REFINEMENT_2026-05-13.md` | 2026-05-13 | UX / design-system / IA refinement (palette, breadcrumbs, result-panel redesign). |
| `AUDIT_v2.md` | 2026-05 | Pass 2 — CSV refactor + federal-credit date update. |
| `AUDIT.md` | 2026-05-08 | Pass 1 — initial deep audit; found 14 truncated ship-path source files that blocked the build. |

## Archived — change logs and reference material

| File | What it is |
|---|---|
| `CHANGES.md`, `CHANGES_v2.md`, `CHANGES_v3.md`, `CHANGES_2026-05-13.md`, `CHANGES_UX_2026-05-13.md` | Per-pass change logs from the May series. Superseded by the root `CHANGELOG.md` as the canonical record. |
| `KEYWORD_OPPORTUNITIES_2026-05.md` | Keyword / page opportunity backlog. Tier 1 + 2 shipped 2026-05-19; **Tier 3 still pending** (referenced from `ROADMAP.md`). |
| `HANDOFF_FROM_PROJECTCOSTPRO_2026-07-04.md` | The sister-site brief that specified the Simulator v2 port. Fully implemented on 2026-07-04; kept as the record of what was asked for. |

---

## ⚠️ Two-checkout hazard (still open)

This project exists in **two working copies**, and they have diverged:

| Checkout | State |
|---|---|
| `D:\claude projects\Websites\Electrifycost\` (main) | On `main`, **~19 commits behind** `origin/main`, with **19 uncommitted files**. **Fails `npm test`** on stale 30C assertions. |
| `.claude/worktrees/crazy-almeida-15dd08\` | On the working branch, **in sync with `origin/main`**, full gate green. |

**Never deploy or ship from the main folder until it is reconciled.** Its useful June 29 content
edits have already been ported (see the 2026-07-31 audit §5). Its
`data/csv/federal-credits.csv` still carries **30C `status=active`** — porting that file would revert
the July expiry flip and put the site back to implying a dead federal credit is claimable. **Port
content from that folder selectively, never in bulk.**

The four Codex reports above existed **only** as untracked files in the main folder and were rescued
into this archive on 2026-07-31 so they cannot be lost.

---

## Adding a new audit

1. Write it as `audit/FULL_AUDIT_YYYY-MM-DD.md` (add a `.log` companion if you ran scripted checks).
2. `git mv` the previous current report into `archive/` and add a row to the correct table above.
3. Put the new report in the **Current** table with a one-paragraph outcome — not just a title.
4. Keep cross-linked groups together when moving, so relative links keep resolving.
5. Update the audit-history section of `CLAUDE.md` if the top-level story changed.
