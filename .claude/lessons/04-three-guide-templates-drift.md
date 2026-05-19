# Lesson 04 — Three competing guide templates running in parallel

**Date:** 2026-05-17
**Severity:** P2 (visible to readers; not factually wrong; SEO-suboptimal due to missing cross-links)
**Commits fixing:** `cebbfc2` (Phase 1) + `9490474` (Phase 2)

## What broke

By the time we had 37 long-form guide pages, **three different page templates were running side by side**:

| Template | Count | Hallmarks |
|---|---|---|
| **A — Long-form (canonical)** | 5 | Tailwind utility classes everywhere, numbered H2 sections ("1. ...", "2. ..."), inline SVG diagrams, `.guide-toc` pill-bar jump links, `<a class="btn-primary">Open the calculator →</a>` end card |
| **B — guide-prose** | 15 | Used `.guide-prose` parent class to style bare `<h2>`/`<p>` via CSS. Different H1 wording ("X, Properly Explained"). No TOC. No inline SVG. Card-style end CTA. |
| **C — prose-guide** | 17 | Used a class name `.prose-guide` that had **no CSS definition** (phantom class). Different H1 wording ("X in 2026"). Inline-link CTA (no button). "Last reviewed" timestamp header. |

A reader hopping between guides noticed instantly. The eyebrow, the H1 size, the section structure, the CTA style — everything flipped between guides.

Plus: zero of the 37 guides had a "Related guides" footer. Every guide was a dead-end for the reader and a missed internal-linking signal for Google.

## How it happened

The three templates were authored at different points by different hands. Each pass added new guides matching whichever template was active at the time. No one went back to unify.

Specifically:
- The 5 flagship guides came first (Pass 1) with Tailwind utility classes.
- A later pass introduced `.guide-prose` CSS for prose styling and added Template B guides.
- A LATER pass added Template C guides referencing `.prose-guide` — but never added the CSS rules for it, so those guides rendered with bare browser defaults inside an unstyled article wrapper.

The `.prose-guide` phantom class is the most embarrassing artifact: a class name referenced in 17 .astro files that does literally nothing because no CSS targets it.

## How we found it

User caught it. "Did you notice the guides are not consistently formatted between different topics?" The audit confirmed: three templates, no related-guides footer anywhere.

## The fix (in two phases)

### Phase 1 — visual unification without content changes

1. **CSS alias.** Change every `.guide-prose` selector in `global.css` from `.guide-prose` to `:is(.guide-prose, .prose-guide)`. Now Template C guides inherit Template B's styling.
2. **Eyebrow normalization.** Update `.eyebrow` CSS class to match Template A's exact recipe (`text-xs font-semibold uppercase tracking-wider text-brand-700`).
3. **New `RelatedGuides.astro` component.** Takes a `slug` prop, looks up siblings + calculator from a new `src/lib/guide-relationships.ts` map, renders a uniform footer.
4. **Inject `<RelatedGuides slug="...">` into all 37 guides.** Mechanical batch — 37 files modified by a sub-agent.

### Phase 2 — numbered H2s + TOC bars

1. **For each of the 32 non-Template-A guides:** generate slug from H2 text, add `id="<slug>"`, prepend "N. " numbering, build a TOC pill-bar at the top with anchor jump-links to each numbered section, link the last pill to `#related-guides`.
2. **Skip "Sources" / housekeeping H2s** from numbering and from the TOC.
3. **Dispatched via a sub-agent** for parallel processing across 32 files.

## Forward-looking rules

### Rule 1: Pick a canonical template at Pass 1 and stick to it

Don't introduce "Template B" because the existing Template A felt heavy. Use the same structure even for shorter guides — they'll just have fewer sections and lighter content. Drift is the enemy.

### Rule 2: When you find a duplicate CSS class name, fix it immediately

The `.guide-prose` vs `.prose-guide` confusion was a code smell from the moment both names appeared. Should have been caught in code review or audit.

Use grep to verify class-name conventions before merging:

```bash
grep -rh "class=\"[^\"]*prose[^\"]*\"" src/ | sort -u
```

If multiple variations show up, normalize before adding more files.

### Rule 3: Every long-form content page deserves a "Related X" footer

It's a known internal-linking SEO signal AND user retention helper. Zero internal links from a guide = dead-end for the reader = thin signal to Google.

For any new content-page type (guides, comparison pages, case studies, etc.), build the "Related X" component at the same time as the first page. Don't ship 37 pages then bolt it on.

### Rule 4: Periodic guide-format audit

Every 6 months, sample 5 random guides side by side. If they look noticeably different in eyebrow, H1, body type, CTA, footer — drift is happening. Catch it early.

### Rule 5: Document the canonical template

`.claude/commands/add-guide.md` now describes the canonical template AND points at `heat-pumps.astro` as the gold reference. Any new guide MUST follow that pattern. The doc is now load-bearing.

## What the user-visible result looks like

After both phases:
- Eyebrow: identical 12px / brand-700 / wider-tracking treatment on all 37 guides
- H1: same Tailwind class on all 37
- Body prose: full styling (`.guide-prose` rules apply via `:is()` alias)
- TOC bar: pill-style anchor jump links at the top of all 37 guides
- Numbered H2s: 1. through N. on all 37
- Related guides footer: 3 sibling cards + calculator CTA button on all 37

The deferred Phase 3 (custom SVG diagrams + topic-specific callout cards) is a per-guide editorial-design lift; not solvable by a mechanical batch.

## Detection signal in future projects

If long-form content pages on the same site look noticeably different in:
- Eyebrow / kicker style
- H1 wording pattern
- Section heading numbering or formatting
- End-of-page CTA style
- Internal cross-link footer

→ template drift. Likely multiple authors / passes without a canonical reference. Run the equivalent of Phase 1 + Phase 2 here.
