#!/usr/bin/env python3
"""Audit a local HTML file or a live URL across the four discoverability layers.

Usage:
    python audit.py index.html
    python audit.py https://example.com/
"""
import json, re, sys, html, urllib.request, pathlib

AI_AGENTS = ["OAI-SearchBot", "GPTBot", "ClaudeBot", "PerplexityBot",
             "Google-Extended", "Applebot-Extended", "CCBot"]

def fetch(target):
    if target.startswith(("http://", "https://")):
        req = urllib.request.Request(target, headers={"User-Agent": "audit/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read().decode("utf-8", "replace"), target
    return pathlib.Path(target).read_text(encoding="utf-8"), None

def sibling(url_or_none, base_path, name):
    """Read robots.txt / llms.txt next to the page, remote or local."""
    try:
        if url_or_none:
            from urllib.parse import urljoin
            req = urllib.request.Request(urljoin(url_or_none, "/" + name),
                                         headers={"User-Agent": "audit/1.0"})
            with urllib.request.urlopen(req, timeout=15) as r:
                return r.read().decode("utf-8", "replace") if r.status == 200 else None
        p = pathlib.Path(base_path).parent / name
        return p.read_text(encoding="utf-8") if p.exists() else None
    except Exception:
        return None

def main(target):
    src, url = fetch(target)
    findings = []          # (layer, severity, message)
    def add(layer, sev, msg): findings.append((layer, sev, msg))

    # ---------- Layer 1: foundations ----------
    title = re.search(r"<title>(.*?)</title>", src, re.S)
    title = html.unescape(title.group(1)).strip() if title else ""
    if not title:                 add("SEO", "HIGH", "No <title>")
    elif len(title) > 65:         add("SEO", "LOW", f"Title {len(title)} chars; truncates near 60")

    desc = re.search(r'<meta\s+name="description"\s+content="(.*?)"', src, re.S)
    if not desc:                  add("SEO", "HIGH", "No meta description")
    elif len(desc.group(1)) > 165: add("SEO", "LOW", f"Description {len(desc.group(1))} chars; truncates near 155")

    h1 = re.findall(r"<h1[\s>]", src)
    if len(h1) == 0:              add("SEO", "HIGH", "No <h1>")
    elif len(h1) > 1:             add("SEO", "MED", f"{len(h1)} <h1> elements; use exactly one")

    if 'rel="canonical"' not in src: add("SEO", "MED", "No canonical link")
    if 'property="og:image"' not in src: add("SEO", "MED", "No og:image (poor social CTR)")
    if 'property="og:image:width"' not in src and 'property="og:image"' in src:
        add("SEO", "LOW", "og:image has no declared width/height")

    imgs = re.findall(r"<img\b[^>]*>", src)
    no_alt = [i for i in imgs if "alt=" not in i]
    no_dim = [i for i in imgs if not ("width=" in i and "height=" in i)]
    if no_alt: add("SEO", "MED", f"{len(no_alt)}/{len(imgs)} <img> without alt")
    if no_dim: add("SXO", "MED", f"{len(no_dim)}/{len(imgs)} <img> without width+height (CLS risk)")

    robots = sibling(url, target, "robots.txt")
    if not robots:                add("SEO", "HIGH", "No robots.txt")
    elif "Sitemap:" not in robots: add("SEO", "MED", "robots.txt declares no Sitemap")

    # ---------- Layer 2: structured data ----------
    blocks = re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', src, re.S)
    types = []
    if not blocks:
        add("GEO/AEO", "HIGH", "No JSON-LD structured data at all")
    for i, b in enumerate(blocks):
        try:
            data = json.loads(b)
        except json.JSONDecodeError as e:
            add("GEO/AEO", "HIGH", f"JSON-LD block {i+1} is invalid JSON: {e}")
            continue
        nodes = data.get("@graph", [data]) if isinstance(data, dict) else data
        for n in nodes:
            if isinstance(n, dict) and n.get("@type"):
                t = n["@type"]
                types += t if isinstance(t, list) else [t]
    if len(blocks) > 1:
        add("GEO/AEO", "LOW", f"{len(blocks)} separate JSON-LD blocks; merge into one @graph with @id links")
    # Only ask for schema the page can actually support.
    real_faq = len(re.findall(r"<summary", src)) >= 2 or                bool(re.search(r'<section[^>]+id="[^"]*faq', src, re.I))
    is_utility = bool(re.search(r"(privacy|terms|cookie|legal)", title, re.I))

    if real_faq and "FAQPage" not in types:
        add("AEO", "HIGH", "FAQ content on the page but no FAQPage schema — the single "
                           "highest-leverage fix for AI citation")
    if not is_utility and "Person" not in types and "Organization" not in types        and not any(t.endswith(("Service", "Business")) for t in types):
        add("LLMO", "MED", "No Person/Organization schema — nothing for an LLM to resolve as an entity")
    if "BreadcrumbList" not in types:
        add("SEO", "LOW", "No BreadcrumbList schema")

    # ---------- Layer 3: AI discoverability ----------
    if not sibling(url, target, "llms.txt"):
        add("LLMO", "MED", "No /llms.txt — no LLM-readable site summary")
    if robots:
        missing = [a for a in AI_AGENTS if a.lower() not in robots.lower()]
        blocked = re.findall(r"User-agent:\s*(\S+)\s*\n\s*Disallow:\s*/\s*$", robots, re.M | re.I)
        if blocked:
            add("LLMO", "HIGH", f"robots.txt fully blocks: {', '.join(blocked)}")
        if len(missing) == len(AI_AGENTS):
            add("LLMO", "LOW", "robots.txt names no AI crawlers; add an explicit policy either way")
    if "speakable" not in src:
        add("AEO", "LOW", "No speakable specification (voice assistants)")

    # ---------- Layer 4: experience ----------
    # Only pages with a real hero image have an LCP image worth prioritising.
    big_img = re.search(r'<img[^>]*(hero|portrait|banner|cover)[^>]*>', src, re.I)
    if big_img and "fetchpriority" not in src:
        add("SXO", "MED", "Hero image has no fetchpriority=\"high\" hint")
    if 'loading="lazy"' in src and "translateX" in src:
        add("SXO", "HIGH", "Lazy images inside a transform-shifted track never load — see core-web-vitals skill")
    if re.search(r"<link[^>]+fonts\.googleapis", src) and "preconnect" not in src:
        add("SXO", "MED", "Google Fonts without preconnect")

    # ---------- report ----------
    order = {"HIGH": 0, "MED": 1, "LOW": 2}
    findings.sort(key=lambda f: order[f[1]])
    print(f"\nAudit: {target}")
    print(f"Title: {title[:70]}")
    print(f"Schema types found: {', '.join(sorted(set(types))) or 'none'}")
    print("-" * 72)
    if not findings:
        print("No issues found.")
    for layer, sev, msg in findings:
        print(f"  [{sev:<4}] {layer:<9} {msg}")
    counts = {s: sum(1 for f in findings if f[1] == s) for s in ("HIGH", "MED", "LOW")}
    print("-" * 72)
    print(f"  {counts['HIGH']} high · {counts['MED']} medium · {counts['LOW']} low")
    return 1 if counts["HIGH"] else 0

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__); sys.exit(2)
    sys.exit(main(sys.argv[1]))
