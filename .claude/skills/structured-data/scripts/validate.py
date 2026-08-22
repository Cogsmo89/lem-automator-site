#!/usr/bin/env python3
"""Validate JSON-LD in an HTML file: parse errors, @id wiring, and page-drift.

Usage: python validate.py index.html
"""
import json, re, sys, html, pathlib

def clean(t):
    t = re.sub(r"<[^>]+>", "", t)
    return re.sub(r"\s+", " ", html.unescape(t)).replace("\u2011", "-").strip()

def main(path):
    src = pathlib.Path(path).read_text(encoding="utf-8")
    blocks = re.findall(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', src, re.S)
    if not blocks:
        print("FAIL  no JSON-LD found"); return 1

    problems, nodes = [], []
    for i, b in enumerate(blocks):
        try:
            data = json.loads(b)
        except json.JSONDecodeError as e:
            problems.append(f"block {i+1}: invalid JSON — {e}"); continue
        nodes += data.get("@graph", [data]) if isinstance(data, dict) else data

    if len(blocks) > 1:
        problems.append(f"{len(blocks)} JSON-LD blocks; merge into one @graph so @id refs resolve")

    ids = {n["@id"] for n in nodes if isinstance(n, dict) and "@id" in n}
    refs = set()
    def walk(o):
        if isinstance(o, dict):
            if set(o.keys()) == {"@id"}: refs.add(o["@id"])
            for v in o.values(): walk(v)
        elif isinstance(o, list):
            for v in o: walk(v)
    walk(nodes)
    for dangling in sorted(refs - ids):
        problems.append(f"@id reference never defined in graph: {dangling}")

    # does FAQPage still match the page?
    faq_node = next((n for n in nodes if n.get("@type") == "FAQPage"), None)
    page_qs = [clean(q) for q in re.findall(r"<summary>(.*?)</summary>", src, re.S)]
    if faq_node:
        schema_qs = [q["name"] for q in faq_node.get("mainEntity", [])]
        if len(schema_qs) != len(page_qs):
            problems.append(f"FAQPage has {len(schema_qs)} questions, page has {len(page_qs)}")
        for q in schema_qs:
            if q not in page_qs:
                problems.append(f"FAQ question in schema but not on page: {q[:60]!r}")
    elif len(page_qs) >= 2:
        problems.append(f"page has {len(page_qs)} Q&As but no FAQPage schema")

    # speakable selectors must be plausible
    for n in nodes:
        for sel in (n.get("speakable", {}) or {}).get("cssSelector", []):
            token = re.match(r"^[#.]([\w-]+)", sel)
            if token and token.group(1) not in src:
                problems.append(f"speakable selector matches nothing on page: {sel}")

    types = sorted({t for n in nodes if isinstance(n, dict)
                      for t in ([n["@type"]] if isinstance(n.get("@type"), str) else n.get("@type", []))})
    print(f"File:   {path}")
    print(f"Nodes:  {len(nodes)}  ({', '.join(types)})")
    print(f"@ids:   {len(ids)} defined, {len(refs)} referenced")
    print("-" * 68)
    for p in problems:
        print(f"  FAIL  {p}")
    if not problems:
        print("  OK    graph is internally consistent and matches the page")
    return 1 if problems else 0

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__); sys.exit(2)
    sys.exit(main(sys.argv[1]))
