// server/index.js — Express app entry point
const express       = require('express');
const session       = require('express-session');
const path          = require('path');

const authRoutes       = require('./routes/auth');
const restaurantRoutes = require('./routes/restaurants');
const orderRoutes      = require('./routes/orders');
const riderRoutes      = require('./routes/riders');
const reviewRoutes     = require('./routes/reviews');
const pool             = require('./db');

const app  = express();
const PORT = 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: 'fd_secret_2024_xK9pQ',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 24 * 60 * 60 * 1000 }, // 24 h
}));

// Serve static frontend
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ──────────────────────────────────────────────
app.use('/api/auth',        authRoutes);
app.use('/api/restaurants', restaurantRoutes);
app.use('/api/orders',      orderRoutes);
app.use('/api/rider',       riderRoutes);
app.use('/api/reviews',     reviewRoutes);

// Categories
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── SPA fallback ────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀  Server running → http://localhost:${PORT}\n`);
});
