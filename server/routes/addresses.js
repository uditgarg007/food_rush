// server/routes/addresses.js
const express = require('express');
const pool    = require('../db');
const router  = express.Router();

function requireCustomer(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  if (req.session.role !== 'customer') return res.status(403).json({ error: 'Customers only' });
  next();
}

// ── GET /api/addresses — list saved addresses ─────────────────
router.get('/', requireCustomer, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM addresses WHERE user_id=? ORDER BY id DESC',
      [req.session.userId]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/addresses — save a new address ──────────────────
router.post('/', requireCustomer, async (req, res) => {
  const { label, street, city, pincode } = req.body;
  if (!street) return res.status(400).json({ error: 'street is required' });

  try {
    // Avoid exact duplicates for the same user
    const [existing] = await pool.query(
      'SELECT id FROM addresses WHERE user_id=? AND street=?',
      [req.session.userId, street.trim()]
    );
    if (existing.length) return res.json(existing[0]); // already saved

    const [result] = await pool.query(
      'INSERT INTO addresses (user_id,label,street,city,pincode) VALUES (?,?,?,?,?)',
      [req.session.userId, label || 'Home', street.trim(), city || null, pincode || null]
    );
    const [rows] = await pool.query('SELECT * FROM addresses WHERE id=?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/addresses/:id — remove an address ────────────
router.delete('/:id', requireCustomer, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM addresses WHERE id=? AND user_id=?',
      [req.params.id, req.session.userId]
    );
    res.json({ message: 'Deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
