const express = require('express');
const { pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { PHONE_RE, str } = require('../controllers/validators');

const router = express.Router();

// POST /api/orders   (customer or admin, must be logged in)
// body: { items: [{ cake_id, quantity }], delivery_address, contact_phone, notes? }
// Prices are ALWAYS read from the database - never trusted from the browser.
router.post('/', authenticate, async (req, res, next) => {
  const body = req.body || {};
  const address = str(body.delivery_address);
  const phone = str(body.contact_phone);
  const notes = str(body.notes).slice(0, 500) || null;

  if (address.length < 10 || address.length > 500) return res.status(400).json({ error: 'Please enter a full delivery address (10-500 characters).' });
  if (!PHONE_RE.test(phone)) return res.status(400).json({ error: 'Enter a valid contact phone number.' });
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > 50) {
    return res.status(400).json({ error: 'Your cart is empty.' });
  }

  // Merge duplicate cakes and validate quantities
  const wanted = new Map();
  for (const it of body.items) {
    const cakeId = Number(it && it.cake_id);
    const qty = Number(it && it.quantity);
    if (!Number.isInteger(cakeId) || cakeId < 1 || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      return res.status(400).json({ error: 'Invalid item in cart (quantity must be 1-20).' });
    }
    wanted.set(cakeId, Math.min(20, (wanted.get(cakeId) || 0) + qty));
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const ids = [...wanted.keys()];
    const placeholders = ids.map(() => '?').join(',');
    const [cakes] = await conn.execute(
      `SELECT id, name, price FROM cakes WHERE is_available = 1 AND id IN (${placeholders})`, ids
    );
    if (cakes.length !== ids.length) {
      await conn.rollback();
      return res.status(400).json({ error: 'One or more cakes in your cart are no longer available.' });
    }

    let total = 0;
    for (const c of cakes) total += c.price * wanted.get(c.id);
    total = Math.round(total * 100) / 100;

    const [orderRes] = await conn.execute(
      'INSERT INTO orders (user_id, total_amount, status, delivery_address, contact_phone, notes) VALUES (?,?,?,?,?,?)',
      [req.user.id, total, 'Pending', address, phone, notes]
    );
    const orderId = orderRes.insertId;

    for (const c of cakes) {
      await conn.execute(
        'INSERT INTO order_items (order_id, cake_id, quantity, unit_price) VALUES (?,?,?,?)',
        [orderId, c.id, wanted.get(c.id), c.price]
      );
    }

    await conn.commit();
    res.status(201).json({ message: 'Order placed successfully!', order_id: orderId, total_amount: total });
  } catch (err) {
    try { await conn.rollback(); } catch (_) { /* ignore */ }
    next(err);
  } finally {
    conn.release();
  }
});

// GET /api/orders/my   (logged-in user's own orders with items)
router.get('/my', authenticate, async (req, res, next) => {
  try {
    const [orders] = await pool.execute(
      `SELECT id, total_amount, status, delivery_address, contact_phone, notes, created_at
         FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
      [req.user.id]
    );
    if (orders.length === 0) return res.json({ orders: [] });

    const ids = orders.map((o) => o.id);
    const [items] = await pool.execute(
      `SELECT oi.order_id, oi.cake_id, oi.quantity, oi.unit_price, c.name
         FROM order_items oi JOIN cakes c ON c.id = oi.cake_id
        WHERE oi.order_id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    const byOrder = {};
    for (const it of items) (byOrder[it.order_id] = byOrder[it.order_id] || []).push(it);
    for (const o of orders) o.items = byOrder[o.id] || [];

    res.json({ orders });
  } catch (err) { next(err); }
});

module.exports = router;
