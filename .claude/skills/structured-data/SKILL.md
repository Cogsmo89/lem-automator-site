---
name: structured-data
description: Build and validate JSON-LD structured data as a single linked @graph — Person, Organization, WebSite, WebPage, FAQPage, Service, BreadcrumbList. Use when adding schema markup, fixing rich-result eligibility, or making a site's facts machine-readable for search engines and LLMs.
---

# Structured data

Structured data is the highest-leverage work in the whole discoverability stack.
It serves classic rich results, AI answer citation and LLM entity resolution
**from one artefact**. Do this before anything else.

## The rule that matters most: one `@graph`, not many blocks

Most sites scatter three or four separate `<script type="application/ld+json">`
tags. Each becomes an island — nothing connects the Person to the Organization
to the page. Emit **one** block containing a `@graph` array, with `@id` anchors
and cross-references:

```json
{
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "Person",  "@id": "https://site.com/#person",
      "name": "…", "worksFor": { "@id": "https://site.com/#business" } },
    { "@type": "ProfessionalService", "@id": "https://site.com/#business",
      "founder": { "@id": "https://site.com/#person" } },
    { "@type": "WebSite", "@id": "https://site.com/#website",
      "publisher": { "@id": "https://site.com/#business" } },
    { "@type": "WebPage", "@id": "https://site.com/#webpage",
      "isPartOf": { "@id": "https://site.com/#website" },
      "about":    { "@id": "https://site.com/#person" } }
  ]
}
```

The `@id` values are URIs with fragments — they never need to resolve to
anything. They exist so a consumer can tell that the `Person` on this page and
the `founder` of the business are the *same entity*. That single fact is what
lets an LLM answer "who runs X?" with confidence.

## Generate from the DOM, never by hand

Hand-written schema drifts from the page within one edit, and mismatched schema
is worse than none — it is a spam signal. Parse the real markup:

```python
faq_sec = re.search(r'<section id="faq".*?</section>', src, re.S).group(0)
faqs = [(clean(q), clean(a)) for q, a in
        re.findall(r'<summary>(.*?)</summary>\s*<p>(.*?)</p>', faq_sec, re.S)]
```

Then build the graph from `faqs`. Now the schema cannot contradict the page.
Strip tags, unescape entities (`html.unescape`), and normalise whitespace —
including non-breaking hyphens (`\u2011`), which sneak in from design tools.

## What to include, by page type

| Page | Nodes |
|---|---|
| Home / about | `Person` + `Organization`/`ProfessionalService` + `WebSite` + `WebPage` |
| Any page with Q&As | `FAQPage` — **highest value single addition** |
| Services | `OfferCatalog` of `Service` items |
| Articles | `Article` with `author` → `@id` of the Person |
| All | `BreadcrumbList` |
| Utility (privacy/terms) | `WebPage` + `BreadcrumbList` only — don't bloat |

## `speakable` — and the trap

```json
"speakable": { "@type": "SpeakableSpecification",
               "cssSelector": ["#hero-title", ".lede", "#faq .faq p"] }
```

**Verify every selector actually matches an element.** A selector pointing at a
class that doesn't exist is silently useless. Check in the browser:

```js
selectors.map(s => [s, document.querySelectorAll(s).length])
```

Give the `<h1>` a real `id` if it doesn't have one.

## Validate before shipping

```bash
python .claude/skills/structured-data/scripts/validate.py index.html
```

Then confirm externally:
- **search.google.com/test/rich-results** — eligibility
- **validator.schema.org** — vocabulary correctness

Google's tester is the one that decides whether you get rich results; the
schema.org validator will pass things Google ignores.

## Honesty constraints

- Never invent a `sameAs`, an `aggregateRating`, or a review you can't evidence.
  Fake `Review`/`AggregateRating` markup is an explicit manual-action target.
- Only mark up content that is **visible on the page**. Hidden schema-only
  content violates Google's guidelines.
- Don't claim `Person` credentials (awards, degrees) without a source.
