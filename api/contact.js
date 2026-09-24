// Contact form endpoint.
// Layered defences, cheapest first: origin, rate limit, honeypot, signed
// timing token, Turnstile, then content scoring. Requires RESEND_API_KEY.
// Optional: FORM_SECRET, TURNSTILE_SITE_KEY, TURNSTILE_SECRET_KEY.

const {
  clientIp,
  originAllowed,
  verifyToken,
  rateLimit,
  verifyTurnstile,
  scoreContent,
} = require('./_lib/guard');

const TO_EMAIL = 'lemuelduyag@gmail.com';
const FROM_EMAIL = 'LemAutomator <noreply@lemautomator.work>';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const LIMITS = { name: 120, email: 200, phone: 40, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Reject outright above HARD; deliver but flag between SOFT and HARD, so a
// misjudged real enquiry still reaches the inbox instead of vanishing.
const SOFT_SCORE = 3;
const HARD_SCORE = 6;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

// Subjects must stay on one line and stay short.
const subjectSafe = (s) => String(s).replace(/[\r\n\t]+/g, ' ').trim().slice(0, 80);

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

// Bots are told everything went fine, so they neither retry nor adapt.
const silentOk = (res) => res.status(200).json({ ok: true });

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = clientIp(req);

  // 1. Origin. A script posting straight at the endpoint sends none.
  if (!originAllowed(req)) {
    console.warn('[contact] blocked: bad origin', req.headers.origin, req.headers.referer, ip);
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 2. Rate limit, short burst and daily ceiling.
  for (const [suffix, max, window] of [
    ['burst', 3, 10 * 60 * 1000],
    ['daily', 12, 24 * 60 * 60 * 1000],
  ]) {
    const limit = rateLimit(`contact:${suffix}:${ip}`, max, window);
    if (!limit.ok) {
      console.warn(`[contact] blocked: rate limit ${suffix}`, ip);
      res.setHeader('Retry-After', String(limit.retryAfter));
      return res.status(429).json({ error: 'Too many messages. Please try again later, or email me directly.' });
    }
  }

  const body = parseBody(req.body);

  // 3. Honeypots. The original name is kept so older cached pages still pass.
  if (body['bot-field'] || body.company_website) {
    console.warn('[contact] blocked: honeypot', ip);
    return silentOk(res);
  }

  // 4. Signed, IP-bound, time-windowed token.
  const token = verifyToken(body.formToken, req);
  if (!token.ok) {
    console.warn('[contact] blocked: token', token.reason, ip);
    if (token.reason === 'expired') {
      return res.status(400).json({ error: 'This form expired. Please reload the page and try again.' });
    }
    // A fast autofill can genuinely beat the minimum age. Say so rather than
    // dropping the message — silently binning a real enquiry is the worse bug,
    // and the bot still has to slow down, which is the whole point of the trap.
    if (token.reason === 'too-fast') {
      return res.status(400).json({ error: 'That was quick — please take a moment and send again.' });
    }
    return silentOk(res);
  }

  // 5. Turnstile, when configured.
  const turnstile = await verifyTurnstile(body.turnstileToken, req);
  if (!turnstile.ok) {
    console.warn('[contact] blocked: turnstile', turnstile.reason, ip);
    return res.status(400).json({ error: 'Verification failed. Please reload the page and try again.' });
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const phone = String(body.phone || '').trim();
  const message = String(body.message || '').trim();

  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'That email address looks invalid.' });
  }
  for (const [field, max] of Object.entries(LIMITS)) {
    if (String(body[field] || '').length > max) {
      return res.status(400).json({ error: `The ${field} field is too long.` });
    }
  }

  // 6. Content scoring.
  const { score, reasons } = scoreContent({ name, email, message, phone });
  if (score >= HARD_SCORE) {
    console.warn('[contact] blocked: content score', score, reasons.join(','), ip);
    return silentOk(res);
  }
  const suspect = score >= SOFT_SCORE;
  if (suspect) console.warn('[contact] flagged: content score', score, reasons.join(','), ip);

  if (!process.env.RESEND_API_KEY) {
    console.error('[contact] RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'Mail is not configured. Please email me directly.' });
  }

  const html = `
    <h2>New project inquiry</h2>
    ${suspect ? `<p style="background:#fff4e5;padding:10px;border-left:3px solid #f59e0b">
      <strong>Possible spam</strong> — score ${score} (${esc(reasons.join(', '))}).
      Delivered anyway in case it is genuine.</p>` : ''}
    <p><strong>Name:</strong> ${esc(name)}</p>
    <p><strong>Email:</strong> ${esc(email)}</p>
    <p><strong>Phone:</strong> ${esc(phone) || '&mdash;'}</p>
    <hr />
    <p style="white-space:pre-wrap">${esc(message)}</p>
  `;

  try {
    const r = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: [TO_EMAIL],
        reply_to: email,
        subject: `${suspect ? '[possible spam] ' : ''}New project inquiry — ${subjectSafe(name)}`,
        html,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      console.error('[contact] Resend rejected the send:', r.status, detail);
      return res.status(502).json({ error: 'Could not send right now. Please try again.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[contact] Unexpected failure:', err);
    return res.status(500).json({ error: 'Could not send right now. Please try again.' });
  }
};
