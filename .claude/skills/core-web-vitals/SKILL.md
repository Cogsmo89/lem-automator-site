---
name: core-web-vitals
description: Improve Core Web Vitals and search experience — LCP, CLS, INP, image pipeline, font loading. Use when a page is slow, when asked about SXO, PageSpeed/Lighthouse scores, layout shift, or before shipping any image-heavy section.
---

# Core Web Vitals / SXO

SXO is SEO plus the experience after the click. Rankings and conversion both
degrade with the same problems, so fixing these pays twice.

| Metric | Target | Usual culprit |
|---|---|---|
| **LCP** | < 2.5s | An oversized hero image |
| **CLS** | < 0.1 | `<img>` with no `width`/`height` |
| **INP** | < 200ms | Long tasks, heavy scroll handlers |

## LCP: the hero image is almost always the problem

Check its real weight first — this is the single most common serious finding:

```bash
ls -la images/ | sort -k5 -rn | head
```

A 1.6 MB PNG hero is not unusual on a hand-built site and is catastrophic on
mobile. Convert, resize to ~2× display width, and serve responsively:

```python
from PIL import Image, ImageOps
im = ImageOps.exif_transpose(Image.open(src))   # honour rotation BEFORE stripping
im = im.convert("RGBA")                          # keep alpha if it composites
for w, out in ((900, "hero.webp"), (560, "hero@560.webp")):
    c = im.copy()
    if c.width > w:                              # never upscale
        c = c.resize((w, round(c.height * w / c.width)), Image.LANCZOS)
    c.save(out, "WEBP", quality=86, method=6)    # no exif= → metadata stripped
```

Expect **85–92% reduction** from PNG to WebP on photographic content.

Then prioritise it — the browser can't know it's the LCP element until layout:

```html
<link rel="preload" as="image" href="hero.webp"
      imagesrcset="hero@560.webp 560w, hero.webp 900w"
      imagesizes="(max-width: 900px) 70vw, 420px" fetchpriority="high" />
```
```html
<img src="hero.webp" srcset="hero@560.webp 560w, hero.webp 900w"
     sizes="(max-width: 900px) 70vw, 420px"
     width="800" height="1200" fetchpriority="high" decoding="async" alt="…" />
```

Never put `loading="lazy"` on the LCP image.

## CLS: dimensions on every image, no exceptions

```bash
grep -oE '<img[^>]*>' index.html | grep -v 'width=' | wc -l
```

Any non-zero result is reserved layout the browser can't compute. Stamp real
intrinsic sizes (read them from the files, don't guess) — the aspect ratio is
what reserves the box, so CSS can still size it however it likes.

## The lazy-loading trap in carousels

**Native `loading="lazy"` does not work for slides moved off-frame by
`transform`.** The browser's intersection check uses layout position; a slide
translated out of view may never "enter" the viewport, so its image stays blank
forever. This silently breaks most hand-rolled carousels.

Fix — promote the active slide and its neighbours as you navigate:

```js
function preload(i) {
  [i - 1, i, i + 1].forEach((n) => {
    slides[(n + slides.length) % slides.length]
      .querySelectorAll('img[loading="lazy"]')
      .forEach((img) => { img.loading = 'eager'; });
  });
}
```

Load the first slide eagerly in the markup.

## Mixed portrait/landscape imagery

Cropping to one aspect ratio decapitates portraits. Letterbox instead, over a
blurred copy of the same image so the frame stays full-bleed:

```css
.stage { position: relative; height: clamp(340px, 52vw, 560px); overflow: hidden; }
.stage .bg    { position: absolute; inset: -8%; width: 116%; height: 116%;
                object-fit: cover; filter: blur(28px) brightness(.42); }
.stage .photo { position: relative; width: 100%; height: 100%; object-fit: contain; }
```

Mark the blurred backdrop `alt="" aria-hidden="true"`.

## Fonts

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
```
Always `&display=swap`. Both preconnects — the second needs `crossorigin` or
it's wasted. Subset to the weights actually used.

## Always strip EXIF on photos

Phone photos embed **GPS coordinates** and device serials. Publishing those on a
business site leaks the owner's location history. Saving via Pillow without an
explicit `exif=` argument drops all metadata — but call `exif_transpose()`
*first* or portraits will render rotated.

Verify:
```python
from PIL import Image
assert not Image.open(f).getexif(), f"{f} still carries metadata"
```

## Measure, don't assume

```bash
curl -s -o /dev/null -w "%{time_total}s  %{size_download} bytes\n" https://site.com/
```
Then Lighthouse (mobile, throttled) and — more importantly — the **CrUX field
data** in Search Console. Lab scores are a debugging tool; field data is what
actually affects ranking.
