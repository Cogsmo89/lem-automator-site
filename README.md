# Lem Automator

Personal site for **Lemuel Duyag** — automation expert specializing in n8n, Make.com, Zapier, and GoHighLevel.

🌐 **Live:** [lemautomator.work](https://lemautomator.work)

## Stack

- Static HTML / CSS / vanilla JS — no build step
- Hosted on **Vercel** (contact form via `/api/contact` + Resend)
- DNS on **Cloudflare**
- Designed for SEO: JSON-LD `ProfessionalService` schema, Open Graph, sitemap, robots

## Local development

Just open `index.html` in a browser, or run a local server:

```bash
# Python
python -m http.server 8000

# Node
npx serve

# PHP
php -S localhost:8000
```

## Deploy

Push to `main` — Vercel auto-deploys. No build step; the only server-side
code is the `api/contact.js` function.

Required environment variable in Vercel:

| Key | Where to get it |
| --- | --- |
| `RESEND_API_KEY` | https://resend.com/api-keys |

## Structure

```
.
├── index.html         # Single-page site
├── styles.css         # All styles
├── script.js          # Reveal animations, tilt, form handler
├── api/contact.js     # Contact form → Resend
├── vercel.json        # Headers, caching
├── images/            # Logo, portrait, social/tool icons
├── robots.txt
└── sitemap.xml
```

## Contact

Email: **lemuelduyag@gmail.com** · Phone: **+63 909 982 3972**
