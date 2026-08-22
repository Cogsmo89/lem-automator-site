---
name: web-presence-audit
description: Audit a website across all six discoverability layers — SEO, GEO, AEO, LLMO, AIO and SXO — and produce a prioritised fix list. Use when someone asks to "improve SEO", "rank better", "get cited by AI/ChatGPT", "show up in AI Overviews", or names any of those acronyms. Run this first; it routes to the specialist skills.
---

# Web presence audit

## First, be honest about the acronyms

Clients name six disciplines. There are really **four distinct bodies of work**.
Say so — it builds trust and stops you billing four times for one job.

| Client says | What it actually means | Real work |
|---|---|---|
| **SEO** | Search Engine Optimization | Crawlability, meta, canonicals, sitemaps, headings, links |
| **AEO** | Answer Engine Optimization | Be *the answer*: FAQ schema, answer-first prose, `speakable` |
| **GEO** | Generative Engine Optimization | Be quotable by AI Overviews / Perplexity / ChatGPT |
| **LLMO** | LLM Optimization | Be a resolvable *entity*: `llms.txt`, entity graph, AI crawler access |
| **AIO** | AI Optimization | Umbrella marketing term. No unique technique. |
| **SXO** | Search Experience Optimization | Core Web Vitals + UX + engagement signals |

**GEO, AEO, LLMO and AIO overlap by roughly 80%.** They all reduce to: publish
unambiguous facts, mark them up so machines can parse them, and let AI crawlers
in. Do that once and you've served all four. AIO in particular has no technique
of its own — if a client insists on it as a line item, it's the other three.

## Run the audit

```bash
python .claude/skills/web-presence-audit/scripts/audit.py <path-or-url>
```

Then read the findings against the four layers below and route to the
specialist skill for each failing area.

## The four layers, in fix order

### 1. Foundations → `seo-foundations`
Nothing else matters if the page can't be crawled or the canonical is wrong.
Check: robots.txt, sitemap with `lastmod`, one `<h1>`, unique title +
description per page, canonical, no redirect chains on internal links.

### 2. Machine-readable facts → `structured-data`
A single JSON-LD `@graph` with `@id` cross-references, not scattered blocks.
This is the highest-leverage work for GEO/AEO/LLMO simultaneously.

### 3. AI discoverability → `ai-search-optimization`
`llms.txt`, explicit AI crawler policy, FAQ schema, answer-first prose,
`speakable`. This is where GEO/AEO/LLMO/AIO actually get served.

### 4. Experience → `core-web-vitals`
LCP, CLS, INP. Slow pages lose rankings *and* lose the humans who arrive.

## Reporting

Give the client a table with **Layer / Finding / Impact / Effort**, sorted by
impact-per-hour. Lead with the one or two changes that move the most: usually
FAQ schema (if they have FAQ content in plain HTML) and the LCP image.

Never promise rankings. Promise correctness: "your FAQ content becomes eligible
for rich results and AI citation" is true; "you'll rank #1" is not.
