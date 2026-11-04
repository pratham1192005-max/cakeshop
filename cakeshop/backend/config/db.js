const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

// Connection pool: credentials come ONLY from environment variables.
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'cakeshop_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 10000,
  decimalNumbers: true, // return DECIMAL columns as numbers, not strings
  ssl: buildSsl(),
});

// TLS to RDS. Best: download the RDS CA bundle and set DB_SSL_CA to its path so the
// server certificate is fully verified. Without it we still encrypt but do not verify.
function buildSsl() {
  if (process.env.DB_SSL !== 'true') return undefined;
  if (process.env.DB_SSL_CA) {
    return { ca: fs.readFileSync(process.env.DB_SSL_CA), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

// Called once at startup so connection problems show up immediately in the logs.
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log(`[db] Connected to MySQL at ${process.env.DB_HOST}:${process.env.DB_PORT || 3306}`);
    return true;
  } catch (err) {
    console.error(`[db] Connection FAILED (${err.code || 'ERR'}): ${err.message}`);
    return false;
  }
}

module.exports = { pool, testConnection };
