require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false
});

app.use(cors({ origin: '*', methods: ['GET'] }));
app.use(express.json());

console.log('DB URL loaded:', !!process.env.DATABASE_URL);

app.get('/api/products', async (req, res) => {
  try {
    const { category, cursor, limit = 24 } = req.query;
    const pageSize = Math.min(parseInt(limit) || 24, 100);

    const params = [];
    const conditions = [];

    if (category) {
      params.push(category);
      conditions.push(`category = $${params.length}`);
    }

    if (cursor) {
      try {
        const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
        params.push(decoded.created_at);
        const tIdx = params.length;
        params.push(decoded.id);
        const idIdx = params.length;
        conditions.push(`(created_at < $${tIdx} OR (created_at = $${tIdx} AND id < $${idIdx}))`);
      } catch (e) {
        return res.status(400).json({ error: 'Invalid cursor' });
      }
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(pageSize + 1);
    const limitParam = `$${params.length}`;

    const query = `
      SELECT id, name, category, price, created_at, updated_at
      FROM products
      ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ${limitParam}
    `;

    const { rows } = await pool.query(query, params);
    const hasNextPage = rows.length > pageSize;
    const items = hasNextPage ? rows.slice(0, pageSize) : rows;

    let nextCursor = null;
    if (hasNextPage) {
      const last = items[items.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ created_at: last.created_at, id: last.id })
      ).toString('base64');
    }

    res.json({ items, nextCursor, hasNextPage });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT DISTINCT category FROM products ORDER BY category`);
    res.json(rows.map(r => r.category));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/test', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT COUNT(*) FROM products');
    res.json({ count: rows[0].count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));