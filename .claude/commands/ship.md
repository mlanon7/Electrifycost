# /ship — Full ship workflow

When the user invokes `/ship`, follow this procedure exactly:

## 1. Run the full test suite

```bash
npm test
```

This runs 4 stages in order:
1. `validate-csvs.cjs` — schema check on all 49 CSVs
2. `validate-pages.cjs` — Layout open/close balance, JSX-trap detection on all .astro pages
3. `smoke-test.cjs` — 13 calculator scenarios + 9 targeted assertion groups
4. `new-calc-tests.cjs` — 29 formula assertions for non-flagship calculators

**If any stage fails, STOP. Do not proceed to commit.** Show the user the failure output and ask for guidance.

## 2. Type-check

```bash
npx tsc --noEmit
```

**If zero output → pass.** If errors appear, STOP and surface them.

## 3. Build

```bash
npm run build
```

**Expected output:** "409 page(s) built" (or current count, ≥ 400) + "[sitemap] wrote 408 URLs to dist/sitemap.xml" (or current count). If the build fails with `Unexpected "export"` at a `.astro` line, see `.claude/lessons/02-esbuild-template-literal-bug.md`.

## 4. Verify sitemap namespace

```bash
head -2 dist/sitemap.xml
```

**Must show:** `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` (slash, NOT hyphen). If it shows `sitemap-0.9` (hyphen), STOP — `.claude/lessons/01-sitemap-namespace-typo.md` documents the fix.

## 5. Stage changes

```bash
git status --short
git add <specific files — do NOT use git add -A or .>
```

**Never use `git add -A` or `git add .`** — it accidentally stages worktrees, env files, secrets. Always list files explicitly.

## 6. Write the commit message

Use the heredoc pattern with a structured body:

```
git commit -m "$(cat <<'EOF'
<Imperative subject line under 70 chars>

<Optional 2-3 sentence body explaining the WHY.>

<Bullets or sub-sections if multi-faceted:>
- Item 1
- Item 2

Verification:
- npm test: X assertions passed
- npx tsc --noEmit: zero errors
- npm run build: 409 pages OK

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

**Do not skip hooks** (`--no-verify`) and **do not bypass GPG signing** (`--no-gpg-sign`).

If a pre-commit hook fails, fix the underlying issue and create a NEW commit (do not amend).

## 7. Push

```bash
git push origin main
```

**Expected output:** `origin <old-sha>..<new-sha> main -> main` indicates success.

## 8. Report back

Tell the user:
- New commit SHA (7 chars)
- One-line summary of what changed
- Vercel deploy ETA (typically 1-2 min from push)
- GitHub Actions CI URL: `https://github.com/mlanon7/Electrifycost/actions`
- Any follow-up the user should do (verify the live page, check GSC, etc.)

## When NOT to /ship

- The user hasn't asked for a commit yet — `/ship` is a "go ahead" signal. Without that, default to "showing the diff" instead.
- Unrelated changes are uncommitted in the working tree — bundle them into separate logical commits or ask the user how to scope.
- Tests are failing — never ship red.

## After /ship

Suggest the next reasonable action: verify the change on `https://electrifycost.com/<path>`, check GSC for re-crawl, or move on to the next task. Don't loop back to `/ship` automatically.
