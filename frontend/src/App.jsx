import { useState, useEffect, useCallback } from "react";
import "./App.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:3000";

const CATEGORY_ICONS = {
  "Electronics": "⚡",
  "Clothing": "👕",
  "Books": "📚",
  "Home & Garden": "🌿",
  "Sports": "🏃",
  "Toys": "🎮",
  "Beauty": "✨",
  "Automotive": "🚗",
  "Food": "🍽️",
  "Music": "🎵",
};

export default function App() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [cursor, setCursor] = useState(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [total, setTotal] = useState(0);
  const [dark, setDark] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  useEffect(() => {
    fetch(`${API}/api/categories`)
      .then(r => r.json())
      .then(setCategories)
      .catch(() => setError("Could not load categories"));
  }, []);

  const fetchProducts = useCallback(async (cat, cur, append = false) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: 24 });
      if (cat) params.set("category", cat);
      if (cur) params.set("cursor", cur);
      const res = await fetch(`${API}/api/products?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setProducts(prev => {
        const next = append ? [...prev, ...data.items] : data.items;
        setTotal(next.length);
        return next;
      });
      setCursor(data.nextCursor);
      setHasNextPage(data.hasNextPage);
    } catch (err) {
      setError("Failed to load products. Is the backend running?");
      console.error(err);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, []);

  useEffect(() => {
    setInitialLoad(true);
    setProducts([]);
    setTotal(0);
    setCursor(null);
    fetchProducts(selectedCategory, null, false);
  }, [selectedCategory, fetchProducts]);

  const handleLoadMore = useCallback(() => {
    if (!loading && hasNextPage && cursor) {
      fetchProducts(selectedCategory, cursor, true);
    }
  }, [loading, hasNextPage, cursor, selectedCategory, fetchProducts]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="logo">
          <div className="logo-mark">C</div>
          <div>
            <div className="logo-name">CodeVector</div>
            <div className="logo-sub">200k catalog</div>
          </div>
          <button className="theme-toggle" onClick={() => setDark(d => !d)} title="Toggle theme">
            {dark ? "☀️" : "🌙"}
          </button>
        </div>

        <nav className="nav">
          <div className="nav-label">Categories</div>
          <button
            className={`nav-item ${selectedCategory === "" ? "active" : ""}`}
            onClick={() => setSelectedCategory("")}
          >
            <span className="nav-icon">🗂️</span>
            <span>All Products</span>
            {selectedCategory === "" && <span className="nav-pip" />}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              className={`nav-item ${selectedCategory === cat ? "active" : ""}`}
              onClick={() => setSelectedCategory(cat)}
            >
              <span className="nav-icon">{CATEGORY_ICONS[cat] || "•"}</span>
              <span>{cat}</span>
              {selectedCategory === cat && <span className="nav-pip" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="stat-row">
            <span className="stat-label">Showing</span>
            <span className="stat-value">{total.toLocaleString()}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Pagination</span>
            <span className="stat-badge">Cursor-based</span>
          </div>
        </div>
      </aside>

      <div className="content">
        <div className="topbar">
          <div className="topbar-left">
            <h1 className="page-title">{selectedCategory || "All Products"}</h1>
            <span className="page-count">{total.toLocaleString()} loaded</span>
          </div>
          {loading && !initialLoad && (
            <div className="loading-pill">
              <span className="spinner" /> Loading
            </div>
          )}
        </div>

        {error && <div className="error-banner">⚠️ {error}</div>}

        {initialLoad && loading ? (
          <div className="grid">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="card skeleton" style={{ animationDelay: `${i * 30}ms` }} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid">
              {products.map((p, i) => (
                <div key={p.id} className="card" style={{ animationDelay: `${(i % 24) * 20}ms` }}>
                  <div className="card-top">
                    <span className="card-cat-badge">
                      {CATEGORY_ICONS[p.category]} {p.category}
                    </span>
                    <span className="card-price">
                      ₹{Number(p.price).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="card-name">{p.name}</div>
                  <div className="card-bottom">
                    <span className="card-date">
                      {new Date(p.created_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", year: "numeric"
                      })}
                    </span>
                    <span className="card-id" title={p.id}>#{p.id.slice(0, 6)}</span>
                  </div>
                </div>
              ))}
            </div>

            {hasNextPage && (
              <div className="load-more-wrap">
                <button className="load-more" onClick={handleLoadMore} disabled={loading}>
                  {loading ? <><span className="spinner" /> Loading…</> : "Load 24 more"}
                </button>
              </div>
            )}

            {!hasNextPage && products.length > 0 && (
              <div className="end-msg">
                <div className="end-line" />
                <span>All {total.toLocaleString()} products loaded</span>
                <div className="end-line" />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}