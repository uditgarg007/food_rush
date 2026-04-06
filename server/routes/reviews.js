// server/routes/reviews.js
const express = require('express');
const pool    = require('../db');
const router  = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  next();
}

// ── POST /api/reviews — customer submits a review ───────────
router.post('/', requireAuth, async (req, res) => {
  if (req.session.role !== 'customer') return res.status(403).json({ error: 'Customers only' });

  const { restaurant_id, order_id, rating, comment } = req.body;
  if (!restaurant_id || !rating) return res.status(400).json({ error: 'restaurant_id and rating required' });
  if (rating < 1 || rating > 5) return res.status(400).json({ error: 'Rating must be 1–5' });

  try {
    // If order_id provided, ensure it belongs to this customer and is delivered
    if (order_id) {
      const [orders] = await pool.query(
        "SELECT id FROM orders WHERE id=? AND customer_id=? AND status='delivered'",
        [order_id, req.session.userId]
      );
      if (!orders.length) return res.status(400).json({ error: 'You can only review delivered orders' });
    }

    const [result] = await pool.query(
      'INSERT INTO reviews (customer_id,restaurant_id,order_id,rating,comment) VALUES (?,?,?,?,?)',
      [req.session.userId, restaurant_id, order_id || null, rating, comment || null]
    );

    // Recompute restaurant average rating
    const [stats] = await pool.query(
      'SELECT AVG(rating) AS avg_r, COUNT(*) AS cnt FROM reviews WHERE restaurant_id=?',
      [restaurant_id]
    );
    await pool.query(
      'UPDATE restaurants SET rating=?, review_count=? WHERE id=?',
      [parseFloat(stats[0].avg_r).toFixed(1), stats[0].cnt, restaurant_id]
    );

    const [review] = await pool.query(
      `SELECT rv.*, u.name AS customer_name FROM reviews rv
       JOIN users u ON u.id=rv.customer_id WHERE rv.id=?`, [result.insertId]
    );
    res.status(201).json(review[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/reviews/:restaurantId ──────────────────────────
router.get('/:restaurantId', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT rv.*, u.name AS customer_name, u.avatar_url AS customer_avatar
      FROM reviews rv
      JOIN users u ON u.id=rv.customer_id
      WHERE rv.restaurant_id=?
      ORDER BY rv.created_at DESC
      LIMIT 50`, [req.params.restaurantId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
