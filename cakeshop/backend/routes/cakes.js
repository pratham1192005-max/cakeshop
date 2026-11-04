const express = require('express');
const { pool } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validateCake } = require('../controllers/validators');

const router = express.Router();

const COLUMNS = 'id, name, description, category, price, image_url, is_featured, is_available, created_at';

function parseId(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) {
    res.status(400).json({ error: 'Invalid cake id.' });
    return null;
  }
  return id;
}

// GET /api/cakes?category=Chocolate&featured=1&search=velvet   (public)
router.get('/', async (req, res, next) => {
  try {
    const where = ['is_available = 1'];
    const params = [];
    if (req.query.category) { where.push('category = ?'); params.push(String(req.query.category)); }
    if (req.query.featured === '1') where.push('is_featured = 1');
    if (req.query.search) { where.push('(name LIKE ? OR description LIKE ?)'); const s = `%${String(req.query.search).slice(0, 60)}%`; params.push(s, s); }

    const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM cakes WHERE ${where.join(' AND ')} ORDER BY id`, params);
    res.json({ cakes: rows });
  } catch (err) { next(err); }
});

// GET /api/cakes/:id   (public)
router.get('/:id', async (req, res, next) => {
  try {
    const id = parseId(req, res); if (!id) return;
    const [rows] = await pool.execute(`SELECT ${COLUMNS} FROM cakes WHERE id = ?`, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cake not found.' });
    res.json({ cake: rows[0] });
  } catch (err) { next(err); }
});

// POST /api/cakes   (admin)
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { errors, values: v } = validateCake(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    try {
      const [result] = await pool.execute(
        'INSERT INTO cakes (name, description, category, price, image_url, is_featured, is_available) VALUES (?,?,?,?,?,?,?)',
        [v.name, v.description, v.category, v.price, v.image_url, v.is_featured, v.is_available]
      );
      res.status(201).json({ message: 'Cake added.', id: result.insertId });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A cake with this name already exists.' });
      throw err;
    }
  } catch (err) { next(err); }
});

// PUT /api/cakes/:id   (admin)
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = parseId(req, res); if (!id) return;
    const { errors, values: v } = validateCake(req.body || {});
    if (errors.length) return res.status(400).json({ error: errors[0], errors });
    try {
      const [result] = await pool.execute(
        `UPDATE cakes SET name=?, description=?, category=?, price=?, image_url=?, is_featured=?, is_available=? WHERE id=?`,
        [v.name, v.description, v.category, v.price, v.image_url, v.is_featured, v.is_available, id]
      );
      if (!result.affectedRows) return res.status(404).json({ error: 'Cake not found.' });
      res.json({ message: 'Cake updated.' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'A cake with this name already exists.' });
      throw err;
    }
  } catch (err) { next(err); }
});

// DELETE /api/cakes/:id   (admin)
// If the cake appears in past orders the FK prevents deletion, so we hide it instead.
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = parseId(req, res); if (!id) return;
    try {
      const [result] = await pool.execute('DELETE FROM cakes WHERE id = ?', [id]);
      if (!result.affectedRows) return res.status(404).json({ error: 'Cake not found.' });
      res.json({ message: 'Cake deleted.' });
    } catch (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
        await pool.execute('UPDATE cakes SET is_available = 0 WHERE id = ?', [id]);
        return res.json({ message: 'Cake is part of existing orders, so it was hidden from the shop instead of deleted.', hidden: true });
      }
      throw err;
    }
  } catch (err) { next(err); }
});

module.exports = router;
