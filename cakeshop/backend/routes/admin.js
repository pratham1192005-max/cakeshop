const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { ORDER_STATUSES } = require('../controllers/validators');

const router = express.Router();

// Every route in this file requires an admin.
router.use(authenticate, requireAdmin);

// GET /api/admin/stats
router.get('/stats', async (req, res, next) => {
  try {
    const [[u]] = await pool.execute("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'");
    const [[c]] = await pool.execute('SELECT COUNT(*) AS n FROM cakes');
    const [[o]] = await pool.execute('SELECT COUNT(*) AS n, COALESCE(SUM(CASE WHEN status <> \'Cancelled\' THEN total_amount END),0) AS revenue FROM orders');
    res.json({ customers: u.n, cakes: c.n, orders: o.n, revenue: Number(o.revenue) });
  } catch (err) { next(err); }
});

// GET /api/admin/users
router.get('/users', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, full_name, email, phone, role, created_at FROM users ORDER BY created_at DESC, id DESC'
    );
    res.json({ users: rows });
  } catch (err) { next(err); }
});

// GET /api/admin/cakes  (includes hidden cakes)
router.get('/cakes', async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, description, category, price, image_url, is_featured, is_available FROM cakes ORDER BY id'
    );
    res.json({ cakes: rows });
  } catch (err) { next(err); }
});

// GET /api/admin/orders
router.get('/orders', async (req, res, next) => {
  try {
    const [orders] = await pool.execute(
      `SELECT o.id, o.total_amount, o.status, o.delivery_address, o.contact_phone, o.notes, o.created_at,
              u.full_name AS customer_name, u.email AS customer_email
         FROM orders o JOIN users u ON u.id = o.user_id
        ORDER BY o.created_at DESC, o.id DESC`
    );
    if (orders.length) {
      const ids = orders.map((o) => o.id);
      const [items] = await pool.execute(
        `SELECT oi.order_id, oi.quantity, oi.unit_price, c.name
           FROM order_items oi JOIN cakes c ON c.id = oi.cake_id
          WHERE oi.order_id IN (${ids.map(() => '?').join(',')})`,
        ids
      );
      const byOrder = {};
      for (const it of items) (byOrder[it.order_id] = byOrder[it.order_id] || []).push(it);
      for (const o of orders) o.items = byOrder[o.id] || [];
    }
    res.json({ orders });
  } catch (err) { next(err); }
});

// PUT /api/admin/orders/:id/status   body: { status }
router.put('/orders/:id/status', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const status = req.body && req.body.status;
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid order id.' });
    if (!ORDER_STATUSES.includes(status)) return res.status(400).json({ error: `Status must be one of: ${ORDER_STATUSES.join(', ')}` });

    const [result] = await pool.execute('UPDATE orders SET status = ? WHERE id = ?', [status, id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Order not found.' });
    res.json({ message: 'Order status updated.' });
  } catch (err) { next(err); }
});

module.exports = router;
