# /audit-site — Kick off a multi-stream site audit

When the user wants a comprehensive audit. This dispatches the work in parallel and synthesizes findings.

## Step 0 — Confirm scope with the user

A full audit covers multiple streams. Ask the user which to include:

1. **Calculation accuracy** — every numeric input vs. current primary-source benchmarks
2. **Content quality** — FAQ + guide pages for AI-slop, voice consistency, missing source citations
3. **SEO posture** — schema, sitemap, meta, canonical chain, internal linking, Core Web Vitals
4. **Accessibility** — WCAG AA contrast, semantic HTML, keyboard nav, screen reader
5. **Bug sweep** — broken links, build warnings, regressions in recent commits
6. **Monetization readiness** — what's wired, what's gated, what's missing for ad-network application
7. **Live vs local diff** — what's on production but missing locally, or vice versa

For a routine quarterly audit, run streams 1, 2, 3, and 5. For a pre-launch audit, run all 7.

## Step 1 — Snapshot the current state

Capture baseline metrics so you can compare to past audits:

```bash
cd "D:/claude projects/Electrifycost" && {
  echo "=== Audit baseline $(date +%Y-%m-%d) ==="
  echo "Pages: $(ls src/pages/*.astro src/pages/guides/*.astro | wc -l)"
  echo "Built HTML: $(find dist -name 'index.html' | wc -l)"
  echo "Sitemap URLs: $(grep -c '<url>' dist/sitemap.xml 2>/dev/null || echo 'no dist')"
  echo "CSVs: $(ls data/csv/*.csv | wc -l)"
  echo "Last commit: $(git log -1 --format='%h %s')"
  echo "Latest source last_reviewed:"
  awk -F',' 'NR>1 { print $NF }' data/csv/*.csv | sort | tail -3
}
```

## Step 2 — Dispatch parallel agents

For each scope item, dispatch a sub-agent with a focused brief. Use the `Agent` tool with `subagent_type: "general-purpose"`. Run them in parallel by sending multiple tool calls in a single message.

Briefs to use:

### Calculation accuracy
Reuse `.claude/prompts/data-verification.md`. Tell the agent: "Cross-check every numeric value in `data/csv/*.csv` against current primary-source benchmarks. Use the canon list in CLAUDE.md."

### Content quality
Reuse `.claude/prompts/content-quality-review.md`. Tell the agent: "Audit FAQ and guide pages for AI-slop tells, missing source citations, and voice consistency per STYLEGUIDE.md."

### SEO posture
Spawn an agent with: "Audit https://electrifycost.com for SEO posture. Crawl sitemap, check 5–10 random URLs for: meta title length, meta description length, canonical correctness, schema JSON-LD presence and validity, breadcrumb consistency, image alt text, Core Web Vitals via lighthouse if available, internal link density."

### Bug sweep
"Run `npm test && npx tsc --noEmit && npm run build`. Search recent git log for `Fix` commits and verify those issues didn't regress. Spot-check 5 random pages on the live site for layout / console errors / broken links."

## Step 3 — Synthesize

Each agent returns a report. Collect them. Synthesize into a single audit document at `audit/AUDIT_YYYY-MM-DD.md` with the structure:

```markdown
# ElectrifyCost — Audit YYYY-MM-DD

## Executive summary
P0: <count>
P1: <count>
P2: <count>
P3: <count>

Top 3 actionable findings:
1. <one-line P0>
2. <one-line P1>
3. <one-line P1>

## §1 — Calculation accuracy
<findings from agent 1>

## §2 — Content quality
<findings from agent 2>

## §3 — SEO posture
<findings from agent 3>

## §4 — Bugs / regressions
<findings from agent 4>

## Punch list (prioritized)
1. P0 - <action>
2. P0 - <action>
3. P1 - <action>
...
```

Severity scale:
- **P0** — site ships wrong numbers / blocks SEO / breaks a visible page. Fix immediately.
- **P1** — materially misleads users / loses meaningful traffic / breaks E-E-A-T signal. Fix this week.
- **P2** — quality / clarity / consistency. Fix this month.
- **P3** — nice-to-have, polish, deferred.

## Step 4 — Commit the audit doc

```bash
git add audit/AUDIT_YYYY-MM-DD.md
git commit -m "Audit YYYY-MM-DD: $count_p0 P0, $count_p1 P1 findings"
```

The historical audit docs at `audit/` should accumulate, not replace. Past audits help track what's been improved over time.

## Step 5 — Generate the next CHANGES doc

If the audit's P0+P1 items will be fixed in a planned batch, create a `audit/CHANGES_YYYY-MM-DD.md` ahead of time as a planning doc. Reference the audit findings by section/severity.

## Common pitfalls

- **Running all 7 streams sequentially** — agents are fast in parallel. Use multi-tool dispatch.
- **Skipping the live-site spot-check** — local builds can hide deploy-time issues (CSP errors, third-party fetch blocks, cache problems).
- **Asking the agents to FIX things** — the audit is read-only. Fixes come in a follow-up batch. Keep them separate.
- **Drowning in P3s** — if the audit returns 50+ items, sort by severity and only commit to fixing the P0s in this pass. P3s can be a backlog.
