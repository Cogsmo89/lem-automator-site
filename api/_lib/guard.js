// Shared abuse defences for the public form endpoints.
// Files prefixed with _ are not routed by Vercel, so this stays private.

const crypto = require('crypto');

// Hosts allowed to submit. Vercel preview deploys are matched by suffix so a
// branch deploy can still be tested without editing this list.
const ALLOWED_HOSTS = ['lemautomator.work', 'www.lemautomator.work'];
const ALLOWED_SUFFIXES = ['.vercel.app'];

// The token is signed with a dedicated secret when one is configured. Falling
// back to the Resend key keeps the defence working before FORM_SECRET is set —
// it is server-only and HMAC never discloses its key.
const secret = () => process.env.FORM_SECRET || process.env.RESEND_API_KEY || '';

const TOKEN_MIN_AGE_MS = 3 * 1000;        // humans do not fill a form in under 3s
const TOKEN_MAX_AGE_MS = 2 * 60 * 60 * 1000;

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd) return fwd.split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
}

function hostOf(value) {
  if (!value) return null;
  try { return new URL(value).host.toLowerCase(); } catch (e) { return null; }
}

// A scripted spammer posting straight at the endpoint sends no Origin at all,
// which is the single most common way this form was being abused.
function originAllowed(req) {
  const host = hostOf(req.headers.origin) || hostOf(req.headers.referer);
  if (!host) return false;
  const bare = host.replace(/:\d+$/, '');
  if (ALLOWED_HOSTS.includes(bare)) return true;
  return ALLOWED_SUFFIXES.some((suffix) => bare.endsWith(suffix));
}

const sign = (payload) =>
  crypto.createHmac('sha256', secret()).update(payload).digest('base64url');

// Bind to the network, not the exact address. IPv6 privacy extensions rotate
// the host part of an address per connection, and mobile carriers reassign
// addresses mid-session — binding to the full address would silently reject
// genuine visitors who took a few minutes to write their message. A /64 for
// IPv6 and a /24 for IPv4 survive that while still defeating replay from a
// different network.
function ipPrefix(ip) {
  if (!ip || ip === 'unknown') return 'unknown';
  if (ip.includes(':')) {
    const head = ip.split('::')[0].split(':').filter(Boolean);
    return `v6:${head.slice(0, 4).join(':')}`;
  }
  return `v4:${ip.split('.').slice(0, 3).join('.')}`;
}

// The network is hashed, never stored raw, so the token carries no personal
// identifier. "|" is the delimiter because IPv4 contains dots and IPv6 colons.
const ipTag = (req) =>
  crypto.createHmac('sha256', secret()).update(`ip:${ipPrefix(clientIp(req))}`).digest('base64url').slice(0, 22);

// Tokens are bound to the requester, so one harvested token cannot be replayed
// from a bot farm.
function issueToken(req) {
  const payload = `${Date.now()}|${crypto.randomBytes(9).toString('base64url')}|${ipTag(req)}`;
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`;
}

function verifyToken(token, req) {
  if (!secret()) return { ok: false, reason: 'no-secret' };
  if (typeof token !== 'string' || !token.includes('.')) return { ok: false, reason: 'missing' };

  const idx = token.lastIndexOf('.');
  const body = token.slice(0, idx);
  const mac = token.slice(idx + 1);

  let payload;
  try { payload = Buffer.from(body, 'base64url').toString('utf8'); }
  catch (e) { return { ok: false, reason: 'malformed' }; }

  const expected = sign(payload);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'bad-signature' };
  }

  const [issuedAt, , boundIp] = payload.split('|');
  const age = Date.now() - Number(issuedAt);
  if (!Number.isFinite(age)) return { ok: false, reason: 'malformed' };
  // Binding is checked before age: only a same-IP submission should ever get
  // the forgiving "too-fast" reply, never a token replayed from elsewhere.
  if (boundIp !== ipTag(req)) return { ok: false, reason: 'ip-mismatch' };
  if (age < TOKEN_MIN_AGE_MS) return { ok: false, reason: 'too-fast' };
  if (age > TOKEN_MAX_AGE_MS) return { ok: false, reason: 'expired' };

  return { ok: true, age };
}

// Best-effort limiter. Vercel runs several instances, so a flood gets a few
// more through than the numbers suggest — it is a backstop behind the origin
// check and Turnstile, not the primary defence.
const buckets = new Map();

function rateLimit(key, max, windowMs) {
  const now = Date.now();
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (now - v.start > v.window) buckets.delete(k);
  }
  const hit = buckets.get(key);
  if (!hit || now - hit.start > hit.window) {
    buckets.set(key, { start: now, window: windowMs, count: 1 });
    return { ok: true, remaining: max - 1 };
  }
  hit.count += 1;
  if (hit.count > max) {
    return { ok: false, retryAfter: Math.ceil((hit.start + hit.window - now) / 1000) };
  }
  return { ok: true, remaining: max - hit.count };
}

async function verifyTurnstile(token, req) {
  const key = process.env.TURNSTILE_SECRET_KEY;
  if (!key) return { configured: false, ok: true };
  if (!token) return { configured: true, ok: false, reason: 'missing' };

  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: key, response: token, remoteip: clientIp(req) }),
    });
    const data = await r.json();
    return { configured: true, ok: data.success === true, reason: (data['error-codes'] || []).join(',') };
  } catch (err) {
    // Never lock the form out because Cloudflare had a bad minute.
    console.error('[guard] turnstile verify failed open:', err);
    return { configured: true, ok: true, reason: 'verify-unreachable' };
  }
}

// Content scoring. Deliberately conservative: a real enquiry that mentions a
// couple of URLs must still get through, so only stacked signals reject.
const SPAM_PHRASES = [
  'seo service', 'seo expert', 'guest post', 'backlink', 'link building',
  'buy now', 'cheap price', 'viagra', 'casino', 'crypto investment',
  'bitcoin profit', 'forex', 'loan offer', 'make money fast', 'work from home',
  'click here now', 'limited time offer', 'increase your traffic',
  'rank your website', 'dear sir/madam', 'bulk email', 'telegram me',
];

function scoreContent({ name, email, message, phone }) {
  const reasons = [];
  let score = 0;
  const blob = `${name} ${message}`.toLowerCase();

  const urls = (message.match(/https?:\/\/|www\./gi) || []).length;
  if (urls >= 4) { score += 4; reasons.push(`urls:${urls}`); }
  else if (urls === 3) { score += 2; reasons.push('urls:3'); }

  if (/\[url[=\]]|\[link[=\]]|<a\s+href/i.test(message)) { score += 4; reasons.push('markup-links'); }

  const hits = SPAM_PHRASES.filter((p) => blob.includes(p));
  if (hits.length) { score += hits.length * 2; reasons.push(`phrases:${hits.slice(0, 3).join('|')}`); }

  // A name field is not a place for URLs or newlines.
  if (/https?:\/\/|www\./i.test(name)) { score += 5; reasons.push('url-in-name'); }
  if (/[\r\n]/.test(name)) { score += 3; reasons.push('newline-in-name'); }

  if (message.length < 12) { score += 2; reasons.push('very-short'); }

  // Long share links are normal in a real enquiry, so URLs are removed before
  // looking for an unbroken run — what is left is genuinely unreadable.
  const deLinked = message.replace(/\S*(https?:\/\/|www\.)\S*/gi, ' ');
  const longest = (deLinked.split(/\s+/).sort((a, b) => b.length - a.length)[0] || '').length;
  if (longest > 60) { score += 4; reasons.push('gibberish-run'); }

  const letters = message.replace(/[^a-z]/gi, '');
  if (letters.length > 25) {
    const caps = (message.match(/[A-Z]/g) || []).length / letters.length;
    if (caps > 0.6) { score += 2; reasons.push('shouting'); }
  }

  if (/(.)\1{9,}/.test(message)) { score += 2; reasons.push('repeat-run'); }

  // Cyrillic is a weak signal on its own — score it, never reject on it alone.
  if (/[Ѐ-ӿ]/.test(blob)) { score += 2; reasons.push('cyrillic'); }

  if (email && name && email.split('@')[0].toLowerCase() === name.toLowerCase() && urls > 0) {
    score += 1; reasons.push('name-equals-localpart');
  }

  if (phone && /https?:\/\//i.test(phone)) { score += 4; reasons.push('url-in-phone'); }

  return { score, reasons };
}

module.exports = {
  clientIp,
  originAllowed,
  issueToken,
  verifyToken,
  rateLimit,
  verifyTurnstile,
  scoreContent,
  ALLOWED_HOSTS,
};
