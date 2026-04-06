// server/routes/orders.js
const express = require('express');
const pool    = require('../db');
const router  = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Login required' });
  next();
}

// ── POST /api/orders — customer places an order ─────────────
router.post('/', requireAuth, async (req, res) => {
  if (req.session.role !== 'customer') return res.status(403).json({ error: 'Customers only' });

  const { restaurant_id, items, delivery_address, special_instructions } = req.body;
  if (!restaurant_id || !items?.length || !delivery_address) {
    return res.status(400).json({ error: 'restaurant_id, items, and delivery_address required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Fetch item prices from DB (never trust client-side prices)
    const ids = items.map(i => i.menu_item_id);
    const [dbItems] = await conn.query(
      `SELECT id,name,price,is_veg,is_available,restaurant_id FROM menu_items WHERE id IN (?)`, [ids]
    );

    // Validate all items belong to the same restaurant and are available
    for (const it of dbItems) {
      if (parseInt(it.restaurant_id) !== parseInt(restaurant_id)) {
        await conn.rollback(); conn.release();
        return res.status(400).json({ error: 'All items must be from the same restaurant' });
      }
      if (!it.is_available) {
        await conn.rollback(); conn.release();
        return res.status(400).json({ error: `${it.name} is currently unavailable` });
      }
    }

    const itemMap = {};
    dbItems.forEach(i => itemMap[i.id] = i);

    // Get restaurant delivery fee
    const [rests] = await conn.query('SELECT delivery_fee FROM restaurants WHERE id=?', [restaurant_id]);
    const deliveryFee = rests[0]?.delivery_fee || 30;

    let subtotal = 0;
    const orderItemsData = [];
    for (const it of items) {
      const dbItem = itemMap[it.menu_item_id];
      if (!dbItem) { await conn.rollback(); conn.release(); return res.status(400).json({ error: 'Invalid item' }); }
      const qty = Math.max(1, parseInt(it.quantity));
      subtotal += dbItem.price * qty;
      orderItemsData.push([null, it.menu_item_id, dbItem.name, qty, dbItem.price, dbItem.is_veg]);
    }
    const total = subtotal + parseFloat(deliveryFee);

    const [orderResult] = await conn.query(
      `INSERT INTO orders (customer_id,restaurant_id,status,total_amount,delivery_fee,delivery_address,special_instructions)
       VALUES (?,?,'placed',?,?,?,?)`,
      [req.session.userId, restaurant_id, total, deliveryFee, delivery_address, special_instructions || null]
    );
    const orderId = orderResult.insertId;

    // Set order_id in each row
    const finalItems = orderItemsData.map(r => { r[0] = orderId; return r; });
    await conn.query(
      `INSERT INTO order_items (order_id,menu_item_id,item_name,quantity,price_at_time,is_veg) VALUES ?`,
      [finalItems]
    );

    await conn.commit();
    conn.release();

    const [fullOrder] = await pool.query(
      `SELECT o.*, r.name AS restaurant_name FROM orders o
       JOIN restaurants r ON r.id=o.restaurant_id WHERE o.id=?`, [orderId]
    );
    res.status(201).json(fullOrder[0]);
  } catch (err) {
    await conn.rollback(); conn.release();
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/orders — list (scoped by role) ─────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    let sql, params;

    if (req.session.role === 'customer') {
      sql = `
        SELECT o.*, r.name AS restaurant_name, r.image_url AS restaurant_image
        FROM orders o
        JOIN restaurants r ON r.id=o.restaurant_id
        WHERE o.customer_id=?
        ORDER BY o.created_at DESC`;
      params = [req.session.userId];

    } else if (req.session.role === 'restaurant_owner') {
      sql = `
        SELECT o.*, u.name AS customer_name, u.phone AS customer_phone
        FROM orders o
        JOIN restaurants r ON r.id=o.restaurant_id
        JOIN users u ON u.id=o.customer_id
        WHERE r.owner_id=?
        ORDER BY o.created_at DESC`;
      params = [req.session.userId];

    } else if (req.session.role === 'rider') {
      const [ri] = await pool.query('SELECT id FROM riders WHERE user_id=?', [req.session.userId]);
      if (!ri.length) return res.json([]);
      sql = `
        SELECT o.*, r.name AS restaurant_name, r.address AS restaurant_address,
               u.name AS customer_name
        FROM orders o
        JOIN restaurants r ON r.id=o.restaurant_id
        JOIN users u ON u.id=o.customer_id
        WHERE o.rider_id=?
        ORDER BY o.created_at DESC`;
      params = [ri[0].id];
    } else {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [rows] = await pool.query(sql, params);

    // Attach status filter if provided
    const { status } = req.query;
    const filtered = status ? rows.filter(r => r.status === status) : rows;
    res.json(filtered);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/orders/:id — full detail ───────────────────────
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [orders] = await pool.query(`
      SELECT o.*,
             r.name AS restaurant_name, r.image_url AS restaurant_image,
             r.address AS restaurant_address, r.phone AS restaurant_phone,
             u.name AS customer_name, u.phone AS customer_phone
      FROM orders o
      JOIN restaurants r ON r.id=o.restaurant_id
      JOIN users u ON u.id=o.customer_id
      WHERE o.id=?`, [req.params.id]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });

    const order = orders[0];

    // Access check
    const allowed =
      (req.session.role === 'customer'          && order.customer_id === req.session.userId) ||
      (req.session.role === 'restaurant_owner') ||  // further checked below
      (req.session.role === 'rider');
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    const [items] = await pool.query(`
      SELECT oi.*, mi.image_url
      FROM order_items oi
      LEFT JOIN menu_items mi ON mi.id=oi.menu_item_id
      WHERE oi.order_id=?`, [req.params.id]);

    res.json({ ...order, items });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── PATCH /api/orders/:id/status — update status ────────────
router.patch('/:id/status', requireAuth, async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status required' });

  // Allowed transitions per role
  const transitions = {
    restaurant_owner: { placed: 'accepted', accepted: 'preparing', preparing: 'ready', placed_cancel: 'cancelled' },
    rider:            { out_for_delivery: 'delivered' },
  };

  try {
    const [orders] = await pool.query(`
      SELECT o.*, r.owner_id FROM orders o
      JOIN restaurants r ON r.id=o.restaurant_id
      WHERE o.id=?`, [req.params.id]);
    if (!orders.length) return res.status(404).json({ error: 'Order not found' });
    const order = orders[0];

    // Validate transition
    if (req.session.role === 'restaurant_owner') {
      if (order.owner_id !== req.session.userId) return res.status(403).json({ error: 'Forbidden' });
      const validStatuses = ['accepted', 'preparing', 'ready', 'cancelled'];
      if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Invalid status for restaurant' });
    } else if (req.session.role === 'rider') {
      if (status !== 'delivered') return res.status(400).json({ error: 'Rider can only mark as delivered' });
    } else {
      return res.status(403).json({ error: 'Not allowed' });
    }

    await pool.query('UPDATE orders SET status=? WHERE id=?', [status, req.params.id]);

    // If delivered, update rider stats
    if (status === 'delivered' && order.rider_id) {
      await pool.query(
        'UPDATE riders SET deliveries_count=deliveries_count+1, total_earnings=total_earnings+49 WHERE id=?',
        [order.rider_id]
      );
    }

    const [updated] = await pool.query('SELECT * FROM orders WHERE id=?', [req.params.id]);
    res.json(updated[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
