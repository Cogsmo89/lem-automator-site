// Issues the short-lived, IP-bound token the contact form must present.
// Also reports the Turnstile site key, so enabling the widget is purely an
// environment-variable change with no edit to the markup.

const { originAllowed, issueToken, rateLimit, clientIp } = require('./_lib/guard');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!originAllowed(req)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Cheap to mint, but not free — cap how fast one address can stockpile them.
  const limit = rateLimit(`token:${clientIp(req)}`, 30, 10 * 60 * 1000);
  if (!limit.ok) {
    res.setHeader('Retry-After', String(limit.retryAfter));
    return res.status(429).json({ error: 'Too many requests.' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    token: issueToken(req),
    sitekey: process.env.TURNSTILE_SITE_KEY || null,
  });
};
