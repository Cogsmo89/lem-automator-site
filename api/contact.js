// Contact form endpoint — replaces Netlify Forms.
// Validates the submission, drops obvious bots, and relays it via Resend.
// Requires env var: RESEND_API_KEY

const TO_EMAIL = 'lemuelduyag@gmail.com';
const FROM_EMAIL = 'LemAutomator <noreply@lemautomator.work>';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const LIMITS = { name: 120, email: 200, phone: 40, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));

function parseBody(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch (e) { return {}; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = parseBody(req.body);

  // Honeypot: bots fill hidden fields. Answer 200 so they don't retry.
  if (body['bot-field']) return res.status(200).json({ ok: true });

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

  if (!process.env.RESEND_API_KEY) {
    console.error('[contact] RESEND_API_KEY is not set');
    return res.status(500).json({ error: 'Mail is not configured. Please email me directly.' });
  }

  const html = `
    <h2>New project inquiry</h2>
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
        subject: `New project inquiry — ${name}`,
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
