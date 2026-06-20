# AGENTS.md — ElectrifyCost

This repository's canonical AI working-context file is **[CLAUDE.md](CLAUDE.md)**.

AGENTS.md exists for tools that follow the cross-vendor `AGENTS.md` convention
(Cursor, Codex, Copilot, etc.). To avoid two files drifting out of sync, the
full project context lives in **CLAUDE.md** and is updated first. Read it before
touching anything — it has:

- What the site is + the "no funnel / source-cited / planning-ranges" position
- Tech stack (Astro static + React islands + CSV-first data + Vercel + GA4 + Ahrefs MCP)
- The 697-page inventory and the **four programmatic-SEO dimensions** (state, city, size, brand)
- The **routing rule** that prevents collisions when adding dimensions (prefix-static / subpath / suffix-dynamic)
- The shared calculator engine (`src/lib/calc.ts`) and result shape
- OBBBA federal-credit dates baked into the data (25C/25D/30D/25E expired; only 30C lives, through 2026-06-30)
- Commands (`npm run dev / build / test`) and editing conventions
- Known pitfalls (esbuild template-literal bug; sitemap namespace; CSV-comma parsing; state-default prop)

Deeper references, all under version control:
- `ARCHITECTURE.md` — system design for human developers
- `CONTRIBUTING.md` — PR test gate + "how to add a calculator / guide / programmatic-page set"
- `STYLEGUIDE.md` — voice, disclaimers, AI-slop blacklist, sourcing rules
- `CHANGELOG.md` — shipped-version history
- `ROADMAP.md` — what's planned / deferred
- `.claude/commands/*` — slash-command workflows (ship, preflight, add-calculator, add-guide, add-state-pages, update-data, refresh-sources, audit-site, debug-build)
- `.claude/lessons/*` — postmortems on bugs to never repeat (incl. 08-astro-route-collision-patterns)
- `.claude/prompts/*` — drop-in prompts (full-site-audit, data-verification, content-quality-review, cold-start-seo-strategy, hackernews-launch)

**Maintenance rule:** when project context changes, update `CLAUDE.md`. Leave
this file as the pointer. Do not let AGENTS.md grow a divergent copy of the
context.

Last reviewed: 2026-05-19.
