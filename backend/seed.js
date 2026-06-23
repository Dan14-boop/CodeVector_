require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const CATEGORIES = ['Electronics', 'Clothing', 'Books', 'Home & Garden', 'Sports', 'Toys', 'Beauty', 'Automotive', 'Food', 'Music'];

async function seed() {
  const client = await pool.connect();
  try {
    console.log('Creating table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price NUMERIC(10,2) NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_created_at ON products (created_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_products_category_created_at ON products (category, created_at DESC);`);

    console.log('Seeding 200,000 products...');

    // Bulk insert using unnest — fast, not a loop
    await client.query(`
      INSERT INTO products (id, name, category, price, created_at, updated_at)
      SELECT
        gen_random_uuid(),
        'Product #' || seq,
        (ARRAY['Electronics','Clothing','Books','Home & Garden','Sports','Toys','Beauty','Automotive','Food','Music'])[floor(random()*10)::int + 1],
        round((random() * 9900 + 100)::numeric, 2),
        NOW() - (random() * INTERVAL '365 days'),
        NOW() - (random() * INTERVAL '30 days')
      FROM generate_series(1, 200000) AS seq;
    `);

    const { rows } = await client.query('SELECT COUNT(*) FROM products');
    console.log(`Done! Total products: ${rows[0].count}`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);