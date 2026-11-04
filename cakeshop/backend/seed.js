// Creates sample users (with bcrypt-hashed passwords) and sample orders.
// Run once after loading database/schema.sql:   npm run seed
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('./config/db');

const adminEmail = (process.env.SEED_ADMIN_EMAIL || 'admin@cakeshop.com').toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@12345';

const users = [
  { full_name: 'Shop Admin',   email: adminEmail,           phone: '9000000000', password: adminPassword, role: 'admin' },
  { full_name: 'Asha Patil',   email: 'asha@example.com',   phone: '9876543210', password: 'Customer@123', role: 'customer' },
  { full_name: 'Rohan Mehta',  email: 'rohan@example.com',  phone: '9123456780', password: 'Customer@123', role: 'customer' },
];

(async () => {
  try {
    for (const u of users) {
      const hash = await bcrypt.hash(u.password, 12);
      await pool.execute(
        `INSERT INTO users (full_name, email, phone, password_hash, role) VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), phone = VALUES(phone), password_hash = VALUES(password_hash), role = VALUES(role)`,
        [u.full_name, u.email, u.phone, hash, u.role]
      );
      console.log(`user ready: ${u.email} (${u.role})`);
    }

    const [[existing]] = await pool.execute('SELECT COUNT(*) AS n FROM orders');
    if (existing.n === 0) {
      const [[asha]] = await pool.execute('SELECT id FROM users WHERE email = ?', ['asha@example.com']);
      const [[rohan]] = await pool.execute('SELECT id FROM users WHERE email = ?', ['rohan@example.com']);
      const [cakes] = await pool.execute('SELECT id, price FROM cakes ORDER BY id LIMIT 4');

      const samples = [
        { user: asha.id,  status: 'Delivered',        addr: '12 Rose Villa, Hiranandani Estate, Thane, Maharashtra 400607', lines: [[cakes[0], 1], [cakes[3], 1]] },
        { user: asha.id,  status: 'Preparing',        addr: '12 Rose Villa, Hiranandani Estate, Thane, Maharashtra 400607', lines: [[cakes[1], 2]] },
        { user: rohan.id, status: 'Pending',          addr: '45 Lake View Apartments, Powai, Mumbai, Maharashtra 400076',  lines: [[cakes[2], 1]] },
      ];
      for (const s of samples) {
        const total = s.lines.reduce((sum, [c, q]) => sum + c.price * q, 0);
        const [r] = await pool.execute(
          'INSERT INTO orders (user_id, total_amount, status, delivery_address, contact_phone) VALUES (?,?,?,?,?)',
          [s.user, total, s.status, s.addr, '9876543210']
        );
        for (const [c, q] of s.lines) {
          await pool.execute('INSERT INTO order_items (order_id, cake_id, quantity, unit_price) VALUES (?,?,?,?)', [r.insertId, c.id, q, c.price]);
        }
      }
      console.log('sample orders created');
    } else {
      console.log('orders already exist - skipped sample orders');
    }

    console.log(`\nAdmin login:    ${adminEmail} / ${adminPassword}`);
    console.log('Customer login: asha@example.com / Customer@123');
    console.log('CHANGE the admin password before any real deployment.');
  } catch (err) {
    console.error('Seed failed:', err.code || '', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
