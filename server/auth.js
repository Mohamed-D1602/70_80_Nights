// Minimal admin authentication: one shared password (ADMIN_PASSWORD) and a
// signed, expiring token. No user accounts, no database table, no extra deps.

const crypto = require('crypto');

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours: covers prep + the event night

function createAuth({ password, secret }) {
  const key = secret || crypto.randomBytes(32).toString('hex');
  const failures = new Map(); // ip -> { count, until }

  function sign(payload) {
    return crypto.createHmac('sha256', key).update(payload).digest('base64url');
  }

  function issueToken() {
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TOKEN_TTL_MS })).toString('base64url');
    return `${payload}.${sign(payload)}`;
  }

  function verifyToken(token) {
    if (typeof token !== 'string') return false;
    const [payload, sig] = token.split('.');
    if (!payload || !sig || !safeEqual(sig, sign(payload))) return false;
    try {
      const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
      return typeof exp === 'number' && exp > Date.now();
    } catch {
      return false;
    }
  }

  // Very small brute-force guard: after 5 wrong passwords from one IP,
  // lock that IP out for 5 minutes.
  function checkPassword(ip, attempt) {
    const entry = failures.get(ip);
    if (entry && entry.until > Date.now()) return { ok: false, locked: true };
    if (password && typeof attempt === 'string' && safeEqual(attempt, password)) {
      failures.delete(ip);
      return { ok: true };
    }
    const count = (entry && entry.until <= Date.now() && entry.count >= 5 ? 0 : entry ? entry.count : 0) + 1;
    failures.set(ip, { count, until: count >= 5 ? Date.now() + 5 * 60 * 1000 : 0 });
    return { ok: false, locked: false };
  }

  function requireAdmin(req, res, next) {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!verifyToken(token)) return res.status(401).json({ error: 'Not logged in' });
    next();
  }

  return { enabled: Boolean(password), issueToken, verifyToken, checkPassword, requireAdmin };
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

module.exports = { createAuth };
