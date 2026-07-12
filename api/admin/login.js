const bcrypt = require('bcryptjs');
const { checkLoginRateLimit, readDb } = require('../_lib/db');
const { setSessionCookie, getClientIp } = require('../_lib/auth');

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return {}; }
  }
  return req.body;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });

  try {
    const ip = getClientIp(req);
    const withinLimit = await checkLoginRateLimit(ip);
    if (!withinLimit) {
      return res.status(429).json({ error: 'Too many login attempts. Try again in a few minutes.' });
    }
  } catch (err) {
    console.error('rate limit check failed:', err);
    // If Redis itself is unreachable, fail closed on rate limiting but don't block login entirely —
    // surface a clear error instead so it's obvious the database isn't connected.
    return res.status(500).json({ error: 'Could not reach the database. Check your Upstash Redis setup.' });
  }

  const { username, password } = parseBody(req);
  if (!username || !password) {
    return res.status(401).json({ error: 'Incorrect name or password.' });
  }

  // The bootstrap Owner account always works off the env vars, so you can
  // never get locked out even if Redis or the admins list has issues.
  if (
    process.env.ADMIN_USER && process.env.ADMIN_PASS &&
    username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS
  ) {
    setSessionCookie(res, { username, permRole: 'owner' });
    return res.status(200).json({ ok: true });
  }

  // Otherwise check admin accounts created inside the dashboard.
  try {
    const db = await readDb();
    const account = db.admins.find((a) => a.username === username);
    if (account && bcrypt.compareSync(password, account.passwordHash)) {
      setSessionCookie(res, { username: account.username, permRole: account.permRole });
      return res.status(200).json({ ok: true });
    }
  } catch (err) {
    console.error('login lookup error:', err);
    return res.status(500).json({ error: 'Could not reach the database.' });
  }

  return res.status(401).json({ error: 'Incorrect name or password.' });
};
