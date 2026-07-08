# Documentation map — ElectrifyCost

Every Markdown doc in the repo, with a one-line purpose and when to reach for it. The site is
the product; these docs are working memory for whoever edits it. Start with **`CLAUDE.md`** —
it is the operating context for the whole repo. This file just tells you where everything else is.

---

## Start here

| Doc | Purpose |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | The working context / repo reality — stack, page inventory, engine, conventions, critical dates. Read first. |
| [`README.md`](README.md) | Project overview and local-dev quickstart. |

## Architecture, code, and voice

| Doc | Purpose |
|---|---|
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | How the system fits together — the calculator engine, the CSV-first data layer, the programmatic-SEO page dimensions. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Contribution workflow, the `npm test` gate, and commit conventions. |
| [`STYLEGUIDE.md`](STYLEGUIDE.md) | Voice, sourcing standards, and the AI-slop blacklist. Every published word answers to this. |
| [`TEMPLATE.md`](TEMPLATE.md) | "The ElectrifyCost pattern" — the architectural + editorial template a new portfolio site clones. |

## Operations

| Doc | Purpose |
|---|---|
| [`DEPLOY.md`](DEPLOY.md) | Deploy procedure (Vercel static build + custom sitemap step). |
| [`INFRASTRUCTURE.md`](INFRASTRUCTURE.md) | Domain, DNS, hosting, email (ImprovMX + SPF/DKIM/DMARC), and analytics — the non-code operational facts. |
| [`SECURITY.md`](SECURITY.md) | Security policy and the headers posture. |

## Planning and history

| Doc | Purpose |
|---|---|
| [`ROADMAP.md`](ROADMAP.md) | Planned work — keyword tiers, guide-design phases, the per-module CSV-chunking refactor. |
| [`CHANGELOG.md`](CHANGELOG.md) | Shipped-version log, newest first. Links out to the audit reports for deep-dive context. |
| [`HANDOFF_FROM_PROJECTCOSTPRO_2026-07-04.md`](HANDOFF_FROM_PROJECTCOSTPRO_2026-07-04.md) | Historical brief — the sister-site Simulator v2 handoff the 2026-07-04 port implemented. Kept as a record. |
| [`AGENTS.md`](AGENTS.md) | Pointer for cross-vendor AI agents (non-Claude tooling) into this repo's context. |

## Audit reports

| Location | Purpose |
|---|---|
| [`audit/README.md`](audit/README.md) | Index of every deep-audit report, current + archived. **Read this before opening any individual audit.** |
| `audit/FULL_AUDIT_2026-07-*.md` (+ `.log`) | Current full-site deep audits (2026-07-04, 2026-07-05). |
| `audit/archive/` | Superseded May–June 2026 audits + per-pass change logs + the keyword backlog. Preserved, not deleted. |

## `.claude/` toolkit

| Location | Purpose |
|---|---|
| [`.claude/README.md`](.claude/README.md) | Index of the repo's Claude toolkit. |
| `.claude/commands/*.md` | Slash-command playbooks — `ship`, `preflight`, `audit-site`, `add-calculator`, `add-guide`, `add-state-pages`, `debug-build`, `refresh-sources`, `update-data`. |
| `.claude/lessons/01`–`11` | Hard-won repo lessons (sitemap-namespace typo, esbuild template-literal bug, route-collision patterns, CSV single-source-of-truth, no-funnel position, email auth, Monte Carlo port, …). Read the relevant one before touching that surface. |
| `.claude/prompts/*.md` | Reusable prompts — full-site audit, content-quality review, data verification, cold-start SEO, HackerNews launch. |

## Data

| Doc | Purpose |
|---|---|
| [`data/csv/README.md`](data/csv/README.md) | Per-column documentation and the edit checklist for the 51 source-of-truth CSVs. |

---

*Portfolio-level docs (the calculator-portfolio operating rules and shared styleguide) live one
and two directories up at `../CLAUDE.md`, `../STYLEGUIDE.md`, and the workspace-root `CLAUDE.md`.*

Last reviewed: 2026-07-06.
