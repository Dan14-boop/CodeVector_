# CodeVector — Product Catalog API

A backend engineering assignment built for CodeVector's internship take-home task. The goal: serve 200,000 products with fast, stable pagination that doesn't break when data changes.

---

## What I Built

A REST API that lets you browse a large product catalog — filter by category, paginate through results, and never see duplicate or skipped products even if new data is inserted mid-session.

A simple React frontend is included as a bonus to make the API tangible and easy to demo.

---

## The Core Problem: Why Not OFFSET?

The naive approach to pagination is `LIMIT 20 OFFSET 200`. This breaks on real data.

If someone is browsing page 5 and 50 new products get inserted at the top, every subsequent page shifts by 50 rows. The user either **sees the same product twice** or **skips 50 products entirely** — silently, with no error.

### The fix: Cursor-based pagination

Instead of "give me rows 200–220", we say "give me rows that came before this specific product."

Each response returns a `nextCursor` — a base64-encoded snapshot of the last item's `(created_at, id)`. The next request picks up exactly from there:

```sql
WHERE (created_at < $1 OR (created_at = $1 AND id < $2))
ORDER BY created_at DESC, id DESC
LIMIT 25
```

New inserts at the top of the table don't affect this at all. Your position in the list is anchored to a real row, not a row number.

The `id` UUID acts as a tie-breaker for products that share the same `created_at` timestamp, making the cursor fully deterministic.

---

## Why PostgreSQL (Neon)?

- Native `gen_random_uuid()` for unique IDs
- `generate_series` for fast bulk seeding
- Excellent index support for the composite cursor query
- Neon gives a free serverless Postgres instance with no credit card required

---

## Database Indexes

Two indexes make pagination fast regardless of table size:

```sql
-- For browsing all products
CREATE INDEX idx_products_created_at
  ON products (created_at DESC);

-- For category-filtered browsing
CREATE INDEX idx_products_category_created_at
  ON products (category, created_at DESC);
```

Without these, every page request would do a full sequential scan of 200,000 rows. With them, Postgres seeks directly to the cursor position — O(page_size) instead of O(table_size).

---

## Seeding 200,000 Products

The seed script uses a single SQL `INSERT` with `generate_series` — no JavaScript loop, no batching, no slow round-trips:

```sql
INSERT INTO products (id, name, category, price, created_at, updated_at)
SELECT
  gen_random_uuid(),
  'Product #' || seq,
  (ARRAY['Electronics','Clothing',...])[floor(random()*10)::int + 1],
  round((random() * 9900 + 100)::numeric, 2),
  NOW() - (random() * INTERVAL '365 days'),
  NOW()

  ---

## Running Locally

### Backend
```bash
cd backend
npm install
cp .env.example .env      # add your Neon DATABASE_URL
node seed.js              # seeds the database
npm run dev               # starts on port 3000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env      # set VITE_API_URL=http://localhost:3000
npm run dev               # starts on localhost:5173
```

---

## If I'm Accepted — What I'd Work On Next

These are things I'd want to build or improve given more time:

**Search** — full-text search across product names using Postgres `tsvector` and `GIN` indexes. Cursor pagination and search can coexist cleanly with the right query structure.

**Bi-directional pagination** — the current cursor only goes forward. I'd add a `prevCursor` so users can go back without reloading from the start, useful if the frontend becomes more complex.

**Price range filtering** — `WHERE price BETWEEN $1 AND $2` alongside the existing category filter, with a proper composite index to keep it fast.

**Sorting options** — currently hardcoded to newest first. I'd expose a `sort` param (`price_asc`, `price_desc`, `name_asc`) with the cursor logic adapting per sort key.

**Real-time updates** — use Postgres `LISTEN/NOTIFY` to push new product inserts to connected clients over WebSockets, so the catalog updates live without polling.

**Rate limiting** — add `express-rate-limit` before any public deployment to prevent abuse on the paginated endpoints.

**Deployed demo** — host the backend on Render and frontend on Vercel with environment variables wired up, so anyone can browse the live catalog without running it locally.