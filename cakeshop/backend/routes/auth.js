const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../config/db');
const { authenticate, signToken, cookieOptions, COOKIE_NAME } = require('../middleware/auth');
const { validateRegistration, EMAIL_RE, str } = require('../controllers/validators');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { errors, values } = validateRegistration(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors[0], errors });

    const hash = await bcrypt.hash(values.password, 12);
    try {
      const [result] = await pool.execute(
        'INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [values.full_name, values.email, values.phone, hash, 'customer']
      );
      res.status(201).json({ message: 'Registration successful. Please log in.', id: result.insertId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An account with this email already exists.' });
      throw err;
    }
  } catch (err) { next(err); }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
  try {
    const email = str(req.body && req.body.email).toLowerCase();
    const password = req.body && typeof req.body.password === 'string' ? req.body.password : '';
    if (!EMAIL_RE.test(email) || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const [rows] = await pool.execute(
      'SELECT id, full_name, email, phone, role, password_hash FROM users WHERE email = ?',
      [email]
    );
    const user = rows[0];
    // Same message for unknown email and wrong password (no account enumeration)
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

    res.cookie(COOKIE_NAME, signToken(user), cookieOptions());
    res.json({
      message: 'Login successful.',
      user: { id: user.id, full_name: user.full_name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (err) { next(err); }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOptions());
  res.json({ message: 'Logged out.' });
});

// GET /api/auth/me  -> current user profile (401 if not logged in)
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, full_name, email, phone, role, created_at FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Account no longer exists.' });
    res.json({ user: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;
