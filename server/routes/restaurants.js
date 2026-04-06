// server/routes/restaurants.js
const express = require('express');
const pool    = require('../db');
const router  = express.Router();

// ── Auth helpers ────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
    if (!roles.includes(req.session.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

// ── GET /api/restaurants — public list with filters ─────────
router.get('/', async (req, res) => {
  try {
    const { search, cuisine, sort, city } = req.query;
    let sql = `
      SELECT r.*, u.name AS owner_name
      FROM restaurants r
      JOIN users u ON u.id = r.owner_id
      WHERE 1=1
    `;
    const params = [];

    if (search)  { sql += ' AND r.name LIKE ?';         params.push(`%${search}%`); }
    if (cuisine) { sql += ' AND r.cuisine_type LIKE ?';  params.push(`%${cuisine}%`); }
    if (city)    { sql += ' AND r.city LIKE ?';          params.push(`%${city}%`); }

    const orderMap = {
      rating: 'r.rating DESC',
      delivery_time: 'r.delivery_time ASC',
      newest: 'r.created_at DESC',
    };
    sql += ` ORDER BY ${orderMap[sort] || 'r.rating DESC'}`;

    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/restaurants/my — owner's own restaurant ────────
router.get('/my', requireRole('restaurant_owner'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM restaurants WHERE owner_id=?', [req.session.userId]
    );
    res.json(rows[0] || null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/restaurants/:id — detail + grouped menu ────────
router.get('/:id', async (req, res) => {
  try {
    const [rests] = await pool.query(`
      SELECT r.*, u.name AS owner_name
      FROM restaurants r JOIN users u ON u.id=r.owner_id
      WHERE r.id=?`, [req.params.id]);
    if (!rests.length) return res.status(404).json({ error: 'Restaurant not found' });

    const [items] = await pool.query(`
      SELECT mi.*, c.name AS category_name, c.icon AS category_icon
      FROM menu_items mi
      LEFT JOIN categories c ON c.id = mi.category_id
      WHERE mi.restaurant_id=?
      ORDER BY c.name, mi.name`, [req.params.id]);

    // Group by category
    const grouped = {};
    items.forEach(item => {
      const key = item.category_name || 'Other';
      if (!grouped[key]) grouped[key] = { icon: item.category_icon || '🍽️', items: [] };
      grouped[key].items.push(item);
    });

    res.json({ restaurant: rests[0], menu: grouped });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/restaurants/:id — update profile ────────────────
router.put('/:id', requireRole('restaurant_owner'), async (req, res) => {
  try {
    const [r] = await pool.query('SELECT id FROM restaurants WHERE id=? AND owner_id=?',
      [req.params.id, req.session.userId]);
    if (!r.length) return res.status(403).json({ error: 'Not your restaurant' });

    const { name, cuisine_type, description, image_url, address, city, delivery_time, delivery_fee, min_order } = req.body;
    await pool.query(`
      UPDATE restaurants SET
        name=COALESCE(?,name), cuisine_type=COALESCE(?,cuisine_type),
        description=COALESCE(?,description), image_url=COALESCE(?,image_url),
        address=COALESCE(?,address), city=COALESCE(?,city),
        delivery_time=COALESCE(?,delivery_time), delivery_fee=COALESCE(?,delivery_fee),
        min_order=COALESCE(?,min_order)
      WHERE id=?`,
      [name, cuisine_type, description, image_url, address, city, delivery_time, delivery_fee, min_order, req.params.id]
    );
    const [updated] = await pool.query('SELECT * FROM restaurants WHERE id=?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/restaurants/:id/toggle — open/close ──────────
router.patch('/:id/toggle', requireRole('restaurant_owner'), async (req, res) => {
  try {
    const [r] = await pool.query('SELECT id,is_open FROM restaurants WHERE id=? AND owner_id=?',
      [req.params.id, req.session.userId]);
    if (!r.length) return res.status(403).json({ error: 'Not your restaurant' });
    await pool.query('UPDATE restaurants SET is_open=? WHERE id=?', [r[0].is_open ? 0 : 1, req.params.id]);
    res.json({ is_open: !r[0].is_open });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/restaurants/:id/menu — add item ───────────────
router.post('/:id/menu', requireRole('restaurant_owner'), async (req, res) => {
  try {
    const [r] = await pool.query('SELECT id FROM restaurants WHERE id=? AND owner_id=?',
      [req.params.id, req.session.userId]);
    if (!r.length) return res.status(403).json({ error: 'Not your restaurant' });

    const { name, description, price, image_url, is_veg, category_id } = req.body;
    if (!name || !price) return res.status(400).json({ error: 'name and price required' });

    const [result] = await pool.query(
      `INSERT INTO menu_items (restaurant_id,category_id,name,description,price,image_url,is_veg)
       VALUES (?,?,?,?,?,?,?)`,
      [req.params.id, category_id || null, name, description || null, price, image_url || null, is_veg ? 1 : 0]
    );
    const [item] = await pool.query('SELECT * FROM menu_items WHERE id=?', [result.insertId]);
    res.status(201).json(item[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PUT /api/restaurants/:id/menu/:itemId ───────────────────
router.put('/:id/menu/:itemId', requireRole('restaurant_owner'), async (req, res) => {
  try {
    const [r] = await pool.query('SELECT id FROM restaurants WHERE id=? AND owner_id=?',
      [req.params.id, req.session.userId]);
    if (!r.length) return res.status(403).json({ error: 'Not your restaurant' });

    const { name, description, price, image_url, is_veg, category_id, is_available } = req.body;
    await pool.query(`
      UPDATE menu_items SET
        name=COALESCE(?,name), description=COALESCE(?,description),
        price=COALESCE(?,price), image_url=COALESCE(?,image_url),
        is_veg=COALESCE(?,is_veg), category_id=COALESCE(?,category_id),
        is_available=COALESCE(?,is_available)
      WHERE id=? AND restaurant_id=?`,
      [name, description, price, image_url, is_veg !== undefined ? (is_veg ? 1 : 0) : null,
       category_id, is_available !== undefined ? (is_available ? 1 : 0) : null,
       req.params.itemId, req.params.id]
    );
    const [item] = await pool.query('SELECT * FROM menu_items WHERE id=?', [req.params.itemId]);
    res.json(item[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── DELETE /api/restaurants/:id/menu/:itemId ────────────────
router.delete('/:id/menu/:itemId', requireRole('restaurant_owner'), async (req, res) => {
  try {
    const [r] = await pool.query('SELECT id FROM restaurants WHERE id=? AND owner_id=?',
      [req.params.id, req.session.userId]);
    if (!r.length) return res.status(403).json({ error: 'Not your restaurant' });
    await pool.query('DELETE FROM menu_items WHERE id=? AND restaurant_id=?',
      [req.params.itemId, req.params.id]);
    res.json({ message: 'Item deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/restaurants/:id/menu/:itemId/toggle ──────────
router.patch('/:id/menu/:itemId/toggle', requireRole('restaurant_owner'), async (req, res) => {
  try {
    const [items] = await pool.query(
      'SELECT id,is_available FROM menu_items WHERE id=? AND restaurant_id=?',
      [req.params.itemId, req.params.id]);
    if (!items.length) return res.status(404).json({ error: 'Item not found' });
    await pool.query('UPDATE menu_items SET is_available=? WHERE id=?',
      [items[0].is_available ? 0 : 1, req.params.itemId]);
    res.json({ is_available: !items[0].is_available });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
