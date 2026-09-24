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

Environment variables in Vercel:

| Key | Required | Where to get it |
| --- | --- | --- |
| `RESEND_API_KEY` | yes | https://resend.com/api-keys |
| `FORM_SECRET` | recommended | Any long random string — `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Falls back to `RESEND_API_KEY` if unset. |
| `TURNSTILE_SITE_KEY` | optional | https://dash.cloudflare.com → Turnstile |
| `TURNSTILE_SECRET_KEY` | optional | Same widget as above |

Set both Turnstile keys to switch the CAPTCHA on; leave them blank and the form
skips it. No code change either way.

### Form abuse defences

`/api/contact` applies these in order, cheapest first:

1. **Origin allowlist** — a script POSTing straight at the endpoint sends no
   `Origin`, which is how the form was being abused.
2. **Rate limit** — 3 per 10 min and 12 per day per address. In-memory, so it is
   best-effort across serverless instances.
3. **Honeypots** — `bot-field` and `company_website`.
4. **Signed token** — HMAC, bound to a hash of the requester's address, valid
   from 3 s to 2 h. Issued by `/api/form-token`.
5. **Turnstile** — when configured.
6. **Content scoring** — links, known spam phrases, gibberish runs. Above the
   hard threshold the message is dropped; borderline mail is still delivered,
   subject-tagged `[possible spam]`, so a misjudgement never loses a real lead.

Anything rejected as a bot gets `200 OK` so it neither retries nor adapts.

## Structure

```
.
├── index.html         # Single-page site
├── styles.css         # All styles
├── script.js          # Reveal animations, tilt, form handler
├── api/contact.js     # Contact form → Resend
├── api/form-token.js  # Issues the anti-spam token
├── api/_lib/guard.js  # Origin, token, rate limit, spam scoring
├── vercel.json        # Headers, caching
├── images/            # Logo, portrait, social/tool icons
├── robots.txt
└── sitemap.xml
```

## Contact

Email: **lemuelduyag@gmail.com** · Phone: **+63 909 982 3972**
