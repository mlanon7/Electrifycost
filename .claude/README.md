# .claude/ — Working Memory for AI Assistants

This directory captures everything an AI assistant (Claude Code, Cursor, Copilot) needs to be productive on this codebase **and** to replicate the pattern on a future similar project.

Treat this directory as a **toolkit you can clone**: copy `.claude/` into a new calculator-first content site, edit a handful of nouns (the niche, the federal landscape, the founder name), and you have most of the workflow scaffolding done.

---

## Structure

```
.claude/
├── README.md                — this file
├── launch.json              — dev-server configurations (used by preview_start MCP tool)
├── commands/                — slash commands for routine workflows
│   ├── ship.md              — full ship workflow: test → build → commit → push
│   ├── preflight.md         — pre-deploy verification gate
│   ├── add-calculator.md    — procedure for adding a new flagship calculator
│   ├── add-guide.md         — procedure for adding a new long-form guide
│   ├── add-state-pages.md   — procedure for cloning a state-programmatic template
│   ├── update-data.md       — CSV update procedure with last_reviewed bump
│   ├── refresh-sources.md   — quarterly source-review playbook
│   └── audit-site.md        — kick off a multi-stream site audit
├── lessons/                 — postmortems on bugs we hit, so we don't repeat them
│   ├── 01-sitemap-namespace-typo.md
│   ├── 02-esbuild-template-literal-bug.md
│   ├── 03-calculator-default-state-prop.md
│   ├── 04-three-guide-templates-drift.md
│   ├── 05-csv-as-single-source-of-truth.md
│   ├── 06-cold-start-mediavine-timing.md
│   └── 07-no-funnel-brand-position.md
├── prompts/                 — drop-in prompts for any AI assistant (Manus, ChatGPT, Claude.ai)
│   ├── full-site-audit.md   — comprehensive audit brief (~30 min agent runtime)
│   ├── content-quality-review.md
│   ├── data-verification.md
│   └── cold-start-seo-strategy.md
└── worktrees/               — git worktree workspace (created by harness; gitignored)
```

---

## Quickstart for a future similar project

1. **Clone this directory** into the new repo's `.claude/` folder.
2. **Edit `.claude/commands/*.md`** — replace project-specific nouns ("electrification" → "your niche", "OBBBA" → "your regulatory landscape", calculator URLs, etc.).
3. **Edit `.claude/lessons/*.md`** — keep the general anti-patterns; remove the project-specific examples that don't apply.
4. **Edit `.claude/prompts/*.md`** — these are the highest-leverage reusable files. Replace IRS/DOE/NEEP citations with your niche's primary-source canon.
5. **Update the project root** with the [TEMPLATE.md](../TEMPLATE.md) 6-pass build sequence.

---

## How to use slash commands

In Claude Code (or any AI assistant that supports them), type `/<command-name>` in chat and the contents of the matching `commands/*.md` file get expanded into the prompt context.

For example, when shipping a change:

```
/ship
```

Claude reads `.claude/commands/ship.md`, follows the procedure (run tests, run build, write a structured commit message, push to origin/main), and reports back when each step completes.

You can chain commands: `/preflight` first, then `/ship`. Each command is idempotent — running it twice should be safe.

---

## How to use lessons

`.claude/lessons/*.md` files are postmortems on specific bugs or anti-patterns we hit on this project. They're written so a future AI session reading them can **prevent the same bug from recurring** — each one ends with a "Detection rule" or "Forward-looking rule" section.

When debugging, check `lessons/` BEFORE diving in. The bug you're looking at might already have a documented fix.

---

## How to use prompts

`.claude/prompts/*.md` files are **drop-in prompts** designed to be pasted (or referenced) in any AI tool — not just Claude Code. They have project-specific tokens (URLs, source canon, expected output format) but the structure is reusable.

Recommended workflow:
- Quarterly: run `prompts/data-verification.md` against the current CSVs to flag any rebate / cost / energy-price rows that have drifted from current industry data
- Before a major version ship: run `prompts/full-site-audit.md` to get a 3rd-party audit
- When you suspect a content quality issue: run `prompts/content-quality-review.md` against the suspected page

---

## What's NOT in here

- **No secrets.** No API keys, no env-var values, no credentials. The `.env.example` at the repo root is the placeholder reference.
- **No project-specific runtime config.** Things like `tailwind.config.mjs`, `astro.config.mjs`, `vercel.json` live at the repo root, not here.
- **No CI scripts.** GitHub Actions config is at `.github/workflows/ci.yml` (repo root convention).

This directory is **just workflow memory + AI working context**. The actual product code is everywhere else.

---

## Last reviewed: 2026-05-17
