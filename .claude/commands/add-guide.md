# /add-guide — Add a long-form guide page

When the user wants to add a new `/guides/<topic>/` page.

## Step 0 — Clarify

Ask:
1. **What's the topic / slug?** (e.g., `pellet-stoves`, `solar-battery-financing`, `whole-house-fan`)
2. **Which calculator does it accompany?** Every guide should pair with a calculator (or comparison page).
3. **What 3 sibling guides** (from the existing 37) should the Related guides footer link to?

If there's no clear calculator pairing OR no obvious siblings, **the topic might be wrong** — guides exist to give context to calculators, not as standalone content.

## Step 1 — Create the file

Path: `src/pages/guides/<slug>.astro`

Use the canonical Template A structure (gold reference: `src/pages/guides/heat-pumps.astro`):

```astro
---
import Layout from '@/components/Layout.astro';
import AdSlot from '@/components/AdSlot.astro';
import RelatedGuides from '@/components/RelatedGuides.astro';

const schemaJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: '<Topic>: <Subtitle>',
  description: '<155-char meta-description-style summary>',
  datePublished: '2026-MM-DD',
  dateModified: '2026-MM-DD',
  author: { '@type': 'Organization', name: 'ElectrifyCost' },
};
---
<Layout
  title="<Topic>: <Specific Hook>"
  description="<155-char>"
  schemaJsonLd={schemaJsonLd}
  breadcrumbs={[
    { name: 'Home', href: '/' },
    { name: 'Guides', href: '/guides/' },
    { name: '<Topic>', href: '/guides/<slug>/' },
  ]}
>
  <section class="container-tight py-10 md:py-14">
    <p class="eyebrow">Guide</p>
    <h1 class="mt-1 text-3xl font-semibold tracking-tight text-ink-900 md:text-4xl">
      <Topic>: <Subtitle>
    </h1>
    <p class="mt-3 max-w-prose text-base text-ink-700">
      <Intro paragraph: what this guide covers, why the reader is here, where the calculator is.>
    </p>
    <div class="guide-toc not-prose">
      <a href="#what-it-is">1. What it is</a>
      <a href="#how-it-works">2. How it works</a>
      <!-- ... more pills, one per content H2 -->
      <a href="#related-guides" class="border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 hover:text-brand-700">Related &amp; calculator →</a>
    </div>
  </section>

  <section id="what-it-is" class="container-tight pb-10">
    <h2 class="text-2xl font-semibold text-ink-900">1. What it is</h2>
    <p class="mt-3 max-w-prose text-ink-700">
      <Body paragraph.>
    </p>
  </section>

  <!-- More numbered sections... -->

  <section id="calc" class="container-tight py-10 border-t border-ink-100">
    <h2 class="text-2xl font-semibold text-ink-900">Ready to estimate your cost?</h2>
    <p class="mt-3 max-w-prose text-ink-700">
      The <a href="/<calculator-url>/" class="text-brand-700 font-medium underline-offset-2 hover:underline"><name> calculator</a> takes your inputs and returns a low/mid/high installed-cost band.
    </p>
    <div class="mt-4 flex flex-wrap gap-3">
      <a href="/<calculator-url>/" class="btn-primary">Open the calculator →</a>
    </div>
  </section>

  <RelatedGuides slug="<slug>" />

  <div class="container-wide"><AdSlot /></div>
</Layout>
```

## Step 2 — Register the guide

Edit `src/lib/guide-relationships.ts`. Add an entry:

```typescript
'<slug>': {
  slug: '<slug>',
  title: '<Topic display name>',
  calculatorHref: '/<calculator-url>/',
  siblings: ['<sibling-1>', '<sibling-2>', '<sibling-3>'],
},
```

Then update sibling references in the 3 OTHER entries you chose, so the relationship is bidirectional. (Optional but improves cross-linking density.)

## Step 3 — Add to the guides hub

Edit `src/pages/guides/index.astro`. Add a row to the `guides` array with the right cluster.

## Step 4 — Content conventions (see STYLEGUIDE.md)

- **Length:** ~2,000–3,500 words for a flagship-quality guide
- **H2 numbering:** "1. X", "2. Y", "3. Z" — followed by an unnumbered "Sources" section at the end if you cite primary sources inline
- **H2 anchor IDs:** slug from heading text, matching the TOC pill hrefs
- **Inline SVG diagram:** optional but recommended for top guides — see heat-pumps.astro for the refrigerant cycle SVG pattern
- **Callout cards:** `<div class="card p-4">` blocks with a bold lead and explanatory body
- **Sources cited inline** — every numeric claim or efficiency standard linked to a primary source

## Step 5 — Verify

```bash
npm test
npx tsc --noEmit
npm run build
```

## Step 6 — Visual check

Open `http://localhost:4321/guides/<slug>/` and verify:
- TOC pills jump to the right sections (click each one)
- Related guides footer renders 3 siblings + the calculator button
- Eyebrow, H1, body prose look identical to other guides
- No console errors

## Step 7 — Ship

`/ship`

## When to skip writing a new guide

- The calculator already has a comprehensive FAQ that covers what you'd put in the guide. Don't duplicate.
- The topic is genuinely a sub-topic of an existing guide. Add a section to the existing one instead.
- You don't have a primary source for half the claims you'd want to make. Source first; write second.

## Common pitfalls

- **Forgot the RelatedGuides component** — leaves the page as a dead-end. (The validator won't catch this; visually check the footer.)
- **TOC anchors don't match H2 IDs** — clicking pills does nothing. Generate the slugs from the H2 text consistently.
- **Numbered headings drift from the TOC numbers** — keep them in sync. Use the same slugifier rules.
- **Image not in AVIF + WebP + PNG triple** — if you add a hero image, follow the existing pattern in `public/assets/topic-images/` so Core Web Vitals stay strong.
