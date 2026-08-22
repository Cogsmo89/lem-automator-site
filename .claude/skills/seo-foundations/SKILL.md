---
name: seo-foundations
description: Classic technical SEO — titles, meta descriptions, canonicals, robots.txt, sitemaps, heading structure, internal links and social cards. Use when setting up a new site, fixing indexing problems, or as the first layer of any SEO/GEO/AEO engagement.
---

# SEO foundations

Nothing in the AI-discoverability stack works if the page can't be crawled or
points at the wrong canonical. Fix this layer first, always.

## Titles and descriptions

| Element | Budget | Notes |
|---|---|---|
| `<title>` | ~60 chars | Truncates near 600px. Front-load the distinctive term. |
| `meta description` | ~155 chars | Not a ranking factor; it *is* a click-through factor. |

Both must be **unique per page**. Check length programmatically — designers and
LLMs both over-write these:

```bash
grep -oE '<title>[^<]*' *.html | awk '{print length($0)-8, $0}' | sort -rn
```

Kill `<meta name="keywords">` if you like — no engine has used it in 15 years.
It's harmless, just noise.

## One `<h1>`, honest hierarchy

Exactly one `<h1>` per page, then `<h2>` for sections, `<h3>` beneath. Never
skip levels for styling — style with CSS. Screen readers and extraction models
both use this tree to decide what a page is about.

## Canonicals

Self-referencing canonical on every page. Get this wrong and you deindex
yourself. Verify the canonical matches the URL that actually serves 200:

```bash
curl -sI https://site.com/page.html | grep -i '^HTTP\|^location'
```

## The `cleanUrls` trap

Host-level "pretty URL" settings (Vercel `cleanUrls`, Netlify Pretty URLs)
rewrite `/page.html` → `/page` with a **308**. If your sitemap, internal links
or canonicals still use `.html`, every one becomes a redirect hop and the
sitemap advertises URLs that don't return 200.

Pick one form and make sitemap, links and canonical agree. On a migration,
**don't change URL semantics** — a hosting move should be invisible to search.

## robots.txt

```
User-agent: *
Allow: /

Sitemap: https://site.com/sitemap.xml
```

Then add an explicit AI-crawler policy — see the `ai-search-optimization` skill.
Never `Disallow: /` on staging that later gets promoted to production; it is the
most common catastrophic SEO mistake there is.

## sitemap.xml

Include `<lastmod>` with real dates — engines use it to prioritise recrawl, and
a static sitemap with no lastmod is treated as stale. Add image entries for
pages with meaningful imagery:

```xml
<url>
  <loc>https://site.com/</loc>
  <lastmod>2026-08-22</lastmod>
  <image:image>
    <image:loc>https://site.com/images/card.jpg</image:loc>
    <image:title>…</image:title>
  </image:image>
</url>
```

Requires `xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"`.
Validate it parses before shipping — a malformed sitemap is silently ignored.

## Social cards

The single most-missed win. A card needs:

```html
<meta property="og:image" content="https://site.com/images/og-card.jpg" />
<meta property="og:image:width"  content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt"    content="…" />
```

**1200×630, landscape, under ~300 KB, JPEG or PNG.** Pointing `og:image` at a
portrait photo is a common bug — every platform crops it badly. Generate a
proper card: brand background, logo, headline, one proof point. Declaring
width/height lets platforms reserve space instead of reflowing.

Also set `og:site_name`, `twitter:card=summary_large_image`, `twitter:creator`.

## Images

- `alt` on every meaningful image; `alt=""` + `aria-hidden="true"` on decorative
- `width`/`height` on all of them (see `core-web-vitals`)
- Descriptive filenames — `highlevel-team.webp`, not `IMG_6842.jpg`

## Verify

```bash
python .claude/skills/web-presence-audit/scripts/audit.py index.html
```
Then Search Console: Coverage, and URL Inspection on the canonical.
