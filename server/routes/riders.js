// server/routes/riders.js
const express = require('express');
const pool    = require('../db');
const router  = express.Router();

function requireRider(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  if (req.session.role !== 'rider') return res.status(403).json({ error: 'Riders only' });
  next();
}

// ── GET /api/rider/profile ───────────────────────────────────
router.get('/profile', requireRider, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ri.*, u.name, u.email, u.phone FROM riders ri
       JOIN users u ON u.id=ri.user_id
       WHERE ri.user_id=?`, [req.session.userId]
    );
    res.json(rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/rider/profile — update vehicle info ─────────────
router.put('/profile', requireRider, async (req, res) => {
  try {
    const { vehicle_type, vehicle_number, is_available } = req.body;
    await pool.query(
      `UPDATE riders SET
         vehicle_type=COALESCE(?,vehicle_type),
         vehicle_number=COALESCE(?,vehicle_number),
         is_available=COALESCE(?,is_available)
       WHERE user_id=?`,
      [vehicle_type, vehicle_number, is_available !== undefined ? (is_available ? 1 : 0) : null, req.session.userId]
    );
    const [rows] = await pool.query(
      `SELECT ri.*, u.name, u.email, u.phone FROM riders ri
       JOIN users u ON u.id=ri.user_id WHERE ri.user_id=?`, [req.session.userId]
    );
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/rider/available-orders — orders ready for pickup ─
router.get('/available-orders', requireRider, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT o.*,
             r.name AS restaurant_name, r.address AS restaurant_address,
             u.name AS customer_name, u.phone AS customer_phone
      FROM orders o
      JOIN restaurants r ON r.id=o.restaurant_id
      JOIN users u ON u.id=o.customer_id
      WHERE o.status='ready' AND o.rider_id IS NULL
      ORDER BY o.updated_at ASC`
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/rider/orders/:id/accept ───────────────────────
router.post('/orders/:id/accept', requireRider, async (req, res) => {
  try {
    const [riders] = await pool.query('SELECT id FROM riders WHERE user_id=?', [req.session.userId]);
    if (!riders.length) return res.status(404).json({ error: 'Rider profile not found' });
    const riderId = riders[0].id;

    const [orders] = await pool.query('SELECT * FROM orders WHERE id=? AND status=? AND rider_id IS NULL',
      [req.params.id, 'ready']);
    if (!orders.length) return res.status(400).json({ error: 'Order not available' });

    await pool.query(
      "UPDATE orders SET rider_id=?, status='out_for_delivery' WHERE id=?",
      [riderId, req.params.id]
    );
    const [updated] = await pool.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/rider/orders/:id/deliver ─────────────────────
router.patch('/orders/:id/deliver', requireRider, async (req, res) => {
  try {
    const [riders] = await pool.query('SELECT id FROM riders WHERE user_id=?', [req.session.userId]);
    if (!riders.length) return res.status(404).json({ error: 'Rider profile not found' });

    const [orders] = await pool.query(
      "SELECT * FROM orders WHERE id=? AND rider_id=? AND status='out_for_delivery'",
      [req.params.id, riders[0].id]
    );
    if (!orders.length) return res.status(400).json({ error: 'Cannot mark this order as delivered' });

    await pool.query("UPDATE orders SET status='delivered' WHERE id=?", [req.params.id]);
    await pool.query(
      'UPDATE riders SET deliveries_count=deliveries_count+1, total_earnings=total_earnings+49 WHERE id=?',
      [riders[0].id]
    );
    const [updated] = await pool.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/rider/history ───────────────────────────────────
router.get('/history', requireRider, async (req, res) => {
  try {
    const [riders] = await pool.query('SELECT id FROM riders WHERE user_id=?', [req.session.userId]);
    if (!riders.length) return res.json([]);

    const [rows] = await pool.query(`
      SELECT o.*,
             r.name AS restaurant_name,
             u.name AS customer_name
      FROM orders o
      JOIN restaurants r ON r.id=o.restaurant_id
      JOIN users u ON u.id=o.customer_id
      WHERE o.rider_id=? AND o.status='delivered'
      ORDER BY o.updated_at DESC`, [riders[0].id]
    );
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/rider/availability — toggle availability ──────
router.patch('/availability', requireRider, async (req, res) => {
  try {
    const [riders] = await pool.query('SELECT id,is_available FROM riders WHERE user_id=?', [req.session.userId]);
    if (!riders.length) return res.status(404).json({ error: 'Not found' });
    const next = riders[0].is_available ? 0 : 1;
    await pool.query('UPDATE riders SET is_available=? WHERE user_id=?', [next, req.session.userId]);
    res.json({ is_available: !!next });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
