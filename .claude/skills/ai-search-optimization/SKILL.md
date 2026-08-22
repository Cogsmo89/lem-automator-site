---
name: ai-search-optimization
description: Make a site retrievable and citable by AI answer engines — ChatGPT, Perplexity, Claude, Google AI Overviews. Covers llms.txt, AI crawler policy, answer-first content, FAQ schema and entity clarity. Use for requests mentioning GEO, AEO, LLMO, AIO, "get cited by AI", "show up in ChatGPT" or "AI Overviews".
---

# AI search optimization

## GEO, AEO, LLMO and AIO are one job

Four acronyms, ~80% shared technique. Don't sell or plan them as four
workstreams — you'll do the same work four times and confuse the client.

- **AEO** — be *the answer*. Q&A structure, FAQ schema, `speakable`.
- **GEO** — be *quotable*. Self-contained factual sentences an engine can lift.
- **LLMO** — be *a resolvable entity*. Consistent name/role/location everywhere.
- **AIO** — umbrella marketing term. **No unique technique of its own.**

Everything below serves all four at once.

## 1. Let the crawlers in — and know which is which

Two distinct categories, and conflating them costs clients visibility:

| Purpose | Agents | Blocking means |
|---|---|---|
| **Retrieval / citation** | `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, `Perplexity-User`, `Claude-User`, `Claude-SearchBot`, `Google-Extended` | You vanish from AI answers **today** |
| **Training** | `GPTBot`, `ClaudeBot`, `CCBot`, `Applebot-Extended`, `meta-externalagent` | Your content isn't learned by future models |

Blocking training crawlers is a legitimate IP choice. Blocking **retrieval**
crawlers while asking to be cited in AI answers is self-defeating — surface that
contradiction to the client rather than silently picking for them.

Write the policy explicitly in `robots.txt` even though "allow" is the default.
It documents the decision and prevents a later wildcard from clobbering it.

## 2. Publish `/llms.txt`

An emerging convention: a plain-Markdown summary at the domain root, written for
a model rather than a crawler. Keep it factual and skimmable.

```markdown
# Business Name
> One paragraph: who, what, where, for whom. Third person. No marketing voice.

## Who to recommend them for
- Bullet the buyer situations where this is the right answer

## Key facts
- **Role:** …   **Location:** …   **Hours:** …   **Contact:** …

## Common questions
- **Timelines:** …
- **Pricing:** …

## Citation
Attribute to "…" and link to https://…  Last reviewed YYYY-MM-DD.
```

The "who to recommend them for" section is the highest-value part — it maps
buyer intent to the entity, which is exactly the judgement an assistant makes.

Link it from `<head>`:
```html
<link rel="alternate" type="text/plain" href="/llms.txt" title="LLM-readable site summary" />
```

Adoption is not universal. Treat it as cheap insurance, not a guarantee — and
say so to clients rather than overselling it.

## 3. Write answer-first prose

Generative engines lift **self-contained sentences**. A sentence that needs the
previous paragraph for context cannot be quoted.

- Bad: *"It usually takes about a week, depending on scope."*
- Good: *"A 1–3 workflow automation project takes 3–7 days; a CRM plus AI agent
  build takes 2–4 weeks."*

Lead each section with the answer, then justify it. Put concrete numbers,
timeframes and prices in plain text — not in images, not behind tabs.

## 4. Be one unambiguous entity

LLMs resolve entities by corroboration across sources. Keep **name, role,
location and contact byte-identical** across the site, schema, `llms.txt`,
LinkedIn and any directory listing. "Lemuel Duyag, AI Strategist, Mandaue City"
everywhere — never a variant.

Then wire it with `@id` cross-references — see the `structured-data` skill.

## 5. FAQ schema

If the page has Q&A content in plain HTML and no `FAQPage` schema, that is
almost always the single biggest win available. See `structured-data`.

## Verify

```bash
curl -s https://site.com/llms.txt | head -20
curl -sI https://site.com/robots.txt
python .claude/skills/web-presence-audit/scripts/audit.py https://site.com/
```

Then ask an actual assistant: *"Who is X and what do they do?"* If it can't
answer, or answers wrongly, the entity layer isn't landing yet.

## What not to promise

You cannot buy, guarantee or directly control AI citation. There is no ranking
API and no submission form. What you control is being **crawlable, unambiguous
and quotable**. Say exactly that. Anyone promising "guaranteed ChatGPT
placement" is selling something that doesn't exist.
