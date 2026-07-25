# Audit history — ElectrifyCost

Every deep-audit report the site has had, newest first. Each audit is a point-in-time
snapshot: read it for the reasoning behind a change, not as current-state documentation
(the live state lives in `CLAUDE.md`, `ARCHITECTURE.md`, and the code).

**Current reports** sit at the top level of `audit/`. **Superseded reports** were moved to
`audit/archive/` during the 2026-07-06 cleanup — nothing was deleted, so the full chain of
reasoning is preserved and every cross-link between the archived files still resolves.

Reports pair a narrative `.md` with a companion machine `.log` where one exists.

---

## Current (top of `audit/`)

| Report | Date | What it covered |
|---|---|---|
| `TRAFFIC_AUDIT_2026-07-24.md` | 2026-07-24 | Traffic & search-visibility audit, triggered by an apparent sudden drop. Separated three conflated things: the "drop today" in Ahrefs is a **reporting artifact** (incomplete current UTC day; 30-day visitors were actually +19); the **real** decline was Google impressions falling ~93% (~101/day → ~7/day) around **June 10–17**, matching the May 2026 core update's completion and the end of the new-domain discovery boost; and **Bing has shown exactly 0 impressions since July 2** despite a successfully crawled sitemap and an indexed homepage. No manual actions, no deindexation, no technical fault. Root cause: the site is **authority-gated** — 2 real referring domains, ranking at position ~40–50 where clicks are ~0. |
| `FULL_AUDIT_2026-07-05.md` (+ `.log`) | 2026-07-05 | Second full-site deep audit. Seven parallel read-only streams, each briefed to go deeper than the prior pass and verify the 2026-07-04 fixes held live. Zero P0. Found four P1s — geothermal rebased **too low** on 07-04 (corrected to the $20k–$32k live-source range), 14 bespoke calculators with detached form labels (WCAG 1.3.1/3.3.2/4.1.2), two FAQ answers still framing an expired federal credit as live, and an ~8px horizontal-scroll hairline on every `.section-shelf` page — all fixed in `aa44a73`. |
| `FULL_AUDIT_2026-07-04.md` (+ `.log`) | 2026-07-04 | First full-site deep audit, run alongside the ProjectCostPro Simulator v2 port. Two-pass: content, UI/responsive, calculation accuracy, SEO/schema, accessibility, data integrity, and a documentation-correctness sweep. Established the baseline the 07-05 pass verified against. |

## Archived (`audit/archive/`)

| Report | Date | What it covered |
|---|---|---|
| `PRODUCT_AUDIT_2026-06-27.md` | 2026-06-27 | Product / UX / growth audit (6 agents incl. an adversarial lens). Surfaced the single necessary shortcoming — the site answered "what will THIS install cost" with no on-ramp for undecided visitors. Drove `/guides/should-i-electrify/`, `/guides/is-a-heat-pump-worth-it/`, `/guides/hiring-a-contractor/`, and the homepage on-ramp — all inside the no-funnel stance. |
| `FULL_AUDIT_CLAUDE_2026-06-25.md` | 2026-06-25 | Independent 18-agent full audit; every P0/P1 adversarially re-verified. Confirmed the site ship-clean (no P0) and found one P1 (panel-FAQ single-source-of-truth) plus governance/polish P2s. |
| `AUDIT_2026-05-27.md` | 2026-05-27 | Data-driven audit + build sprint. Closed P0 (wrong 30D date) + 12 P1 + 13 P2 + 3 Ahrefs items: `/privacy/` + `/terms/`, `BreadcrumbList` on state pages, `WebApplication` schema, WCAG-AA contrast pass, `env.d.ts` csv?raw fix. |
| `AUDIT_CLAUDE_2026-05-14.md` | 2026-05-14 | Pass 4 — federal-credit IRS cross-check + a 24-month revenue projection. |
| `DEEP_AUDIT_2026-05-13.md` | 2026-05-13 | Pass 3 — calculation-accuracy industry cross-check (solar $/W rebase, geothermal restructure, Mass Save cap update). **Caveat:** its geothermal "$10.5–16.5k" figure was later found too low and corrected in the 2026-07-05 audit — do not treat this doc's geothermal numbers as current. |
| `ATTACK_PLAN_2026-05-13.md` | 2026-05-13 | Pass 3 planning doc — scope and approach for the deep audit above. |
| `UX_REFINEMENT_2026-05-13.md` | 2026-05-13 | UX / design-system / information-architecture refinement audit (palette, breadcrumbs, result-panel redesign). |
| `AUDIT_v2.md` | 2026-05 | Pass 2 — CSV refactor + federal-credit date update. |
| `AUDIT.md` | 2026-05-08 | Pass 1 — initial deep audit; identified 14 truncated ship-path source files that blocked the build. |
| `CHANGES.md` | 2026-05 | Change log for the Pass-1 audit fix-up. |
| `CHANGES_v2.md` | 2026-05 | Change log for the Part-1 refactor (CSV data layer + local-server). |
| `CHANGES_v3.md` | 2026-05 | Change log for the v3 pass (trust/correctness, ZIP↔state, ad/affiliate scaffolding). |
| `CHANGES_2026-05-13.md` | 2026-05-13 | Change log for the Pass-3 deep-audit fixes. |
| `CHANGES_UX_2026-05-13.md` | 2026-05-13 | Change log for the UX refinement pass. |
| `KEYWORD_OPPORTUNITIES_2026-05.md` | 2026-05 | Keyword / page opportunity backlog. Tier 1 + Tier 2 shipped 2026-05-19; **Tier 3 is still pending** (referenced from `ROADMAP.md`). |

---

## Adding a new audit

1. Write the report as `audit/FULL_AUDIT_YYYY-MM-DD.md` (+ a `.log` companion if you ran scripted checks).
2. Add a row to the **Current** table above.
3. If it supersedes a prior full audit, move the older one to `audit/archive/` (`git mv`) and shift its row to the **Archived** table — keep cross-linked files together so their relative links survive.
