# Lesson 01 — Sitemap namespace typo

**Date:** 2026-05-17
**Severity:** P0 (blocked Google Search Console for ~5 days)
**Commit fixing:** `3bf55c7`
**Cost:** ~3–5 days of lost crawl velocity at the most expensive point in a site's life — its first week after launch.

## What broke

`scripts/build-sitemap.cjs` emitted:

```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">
                                                   ^
                                          HYPHEN — wrong
```

The correct namespace per the [sitemaps.org spec](https://www.sitemaps.org/protocol.html) is:

```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                                                  ^
                                         SLASH — correct
```

Google Search Console rejected the sitemap with "Sitemap can be read, but has errors: Incorrect namespace, 1 instance, Line 2, Tag: urlset."

The site still got partial indexing (Google's parser is forgiving — discovered 194 of 194 URLs at that point even with the wrong namespace), but the sitemap wasn't fully trusted. New URLs added after the bug shipped weren't picked up promptly.

## How it slipped through

1. The bug originated in `scripts/build-sitemap.cjs` line 62 during the original sitemap-script authorship (a previous pass).
2. Local `validate-pages.cjs` didn't check sitemap structure — only Astro page balance.
3. The smoke test didn't validate XML against the schema.
4. No one opened the live `https://electrifycost.com/sitemap.xml` in a browser after deploy.
5. The audit pass that reviewed deployment + SEO checked that the sitemap *existed* but not that its namespace was correct.

## How it was found

The user submitted `sitemap.xml` to GSC. GSC showed "1 error - Incorrect namespace" in the submitted-sitemaps panel. The error message was specific enough to identify the exact tag and line.

## The fix

```diff
- <urlset xmlns="http://www.sitemaps.org/schemas/sitemap-0.9">
+ <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
```

One character. ~5 days lost.

## Forward-looking rules

### Rule 1: Always open `https://<your-domain>/sitemap.xml` in a browser after any Vercel deploy that touches the sitemap script

The first two lines should be visible immediately. Visually scan for: `xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"` — slash, not hyphen. Two minutes, every deploy.

### Rule 2: Add sitemap-namespace assertion to the test suite

Either to `validate-pages.cjs` or as a new `validate-sitemap.cjs`:

```javascript
const sitemapPath = path.join(__dirname, '..', 'dist', 'sitemap.xml');
if (fs.existsSync(sitemapPath)) {
  const head = fs.readFileSync(sitemapPath, 'utf8').slice(0, 200);
  if (!head.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')) {
    console.error('FAIL: sitemap.xml missing correct xmlns');
    process.exit(1);
  }
}
```

### Rule 3: After any post-build script change, check the build artifact's first 5 lines

```bash
head -5 dist/sitemap.xml
head -5 dist/robots.txt
```

If the script outputs files that get crawled, those files need a sanity-check after each script change.

### Rule 4: Trust GSC's specific error messages

GSC's "Incorrect namespace, Line 2, Tag: urlset" was correct and actionable. Don't assume the error is "false positive" or "GSC being slow." Read the error literally and check the indicated line.

## Detection signal in future projects

If a brand-new site shows:
- Sitemap submitted successfully
- "Discovered pages" count > 0
- BUT "Status" = error with "Incorrect namespace"

→ check the namespace string character-by-character. It's almost always a typo in a hand-rolled sitemap generator.
