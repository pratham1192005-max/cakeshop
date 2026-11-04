const jwt = require('jsonwebtoken');

const COOKIE_NAME = 'cakeshop_token';

function cookieOptions() {
  return {
    httpOnly: true,                                   // not readable from JavaScript (XSS safe)
    sameSite: 'lax',                                  // basic CSRF protection
    secure: process.env.COOKIE_SECURE === 'true',     // HTTPS only in production
    maxAge: 2 * 60 * 60 * 1000,
    path: '/',
  };
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, name: user.full_name },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
  );
}

// Requires a valid login cookie (or Bearer token).
function authenticate(req, res, next) {
  let token = req.cookies && req.cookies[COOKIE_NAME];
  const header = req.headers.authorization;
  if (!token && header && header.startsWith('Bearer ')) token = header.slice(7);
  if (!token) return res.status(401).json({ error: 'Please log in to continue.' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    res.clearCookie(COOKIE_NAME, cookieOptions());
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

// Must be used AFTER authenticate.
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

module.exports = { authenticate, requireAdmin, signToken, cookieOptions, COOKIE_NAME };
