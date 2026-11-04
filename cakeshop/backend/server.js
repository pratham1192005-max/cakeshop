const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); // fallback

const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { pool, testConnection } = require('./config/db');

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('FATAL: JWT_SECRET is missing or too short. Set it in backend/.env');
  process.exit(1);
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.set('trust proxy', 1); // we sit behind Nginx / ALB

app.use(
  helmet({
    hsts: isProd,
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'https:'],
        'style-src': ["'self'", "'unsafe-inline'"],
        'upgrade-insecure-requests': null, // enable at the HTTPS terminator instead
      },
    },
  })
);
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());

// Rate limit login/registration to slow down brute force attacks
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' },
});

// Health check (used by the ALB target group): verifies the DB is reachable too
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'up' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', database: 'down' });
  }
});

app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/cakes', require('./routes/cakes'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));

app.use('/api', (req, res) => res.status(404).json({ error: 'API route not found.' }));

// Optional: serve the static frontend from Express (local development / single-server setups)
if (process.env.SERVE_FRONTEND !== 'false') {
  app.use(express.static(path.join(__dirname, '..', 'frontend')));
}

// Central error handler: log details server-side, return a generic message to the client
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  console.error('[error]', err.code || '', err.message);
  const dbDown = ['ECONNREFUSED', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST', 'ENOTFOUND', 'ER_ACCESS_DENIED_ERROR'].includes(err.code);
  if (dbDown) return res.status(503).json({ error: 'Database is temporarily unavailable. Please try again shortly.' });
  res.status(500).json({ error: 'Something went wrong on our side.' });
});

(async () => {
  await testConnection(); // logs the result but doesn't block startup; /api/health reports status
  app.listen(PORT, () => console.log(`[server] Cake Shop running on port ${PORT} (${process.env.NODE_ENV || 'development'})`));
})();

module.exports = app;
