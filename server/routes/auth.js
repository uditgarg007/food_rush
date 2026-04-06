// server/routes/auth.js
const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../db');
const router  = express.Router();

// ── POST /api/auth/register ─────────────────────────────────
router.post('/register', async (req, res) => {
  const { name, email, password, phone, role,
          // restaurant owner extras
          restaurant_name, cuisine_type, address, city, description, image_url,
          // rider extras
          vehicle_type, vehicle_number } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password and role are required' });
  }
  const validRoles = ['customer', 'restaurant_owner', 'rider'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  try {
    // Check duplicate
    const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      'INSERT INTO users (name,email,password,phone,role) VALUES (?,?,?,?,?)',
      [name, email, hashed, phone || null, role]
    );
    const userId = result.insertId;

    // Role-specific setup
    if (role === 'restaurant_owner') {
      if (!restaurant_name) return res.status(400).json({ error: 'restaurant_name is required' });
      await pool.query(
        `INSERT INTO restaurants (owner_id,name,cuisine_type,description,image_url,address,city)
         VALUES (?,?,?,?,?,?,?)`,
        [userId, restaurant_name, cuisine_type || null, description || null,
         image_url || null, address || null, city || 'City']
      );
    }

    if (role === 'rider') {
      await pool.query(
        'INSERT INTO riders (user_id,vehicle_type,vehicle_number) VALUES (?,?,?)',
        [userId, vehicle_type || 'motorcycle', vehicle_number || null]
      );
    }

    req.session.userId = userId;
    req.session.role   = role;

    const [users] = await pool.query(
      'SELECT id,name,email,phone,role FROM users WHERE id=?', [userId]
    );
    res.status(201).json({ message: 'Registered successfully', user: users[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/auth/login ────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE email=?', [email]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    req.session.userId = user.id;
    req.session.role   = user.role;

    const { password: _, ...safeUser } = user;
    res.json({ message: 'Login successful', user: safeUser });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/auth/logout ───────────────────────────────────
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ message: 'Logged out' }));
});

// ── GET /api/auth/me ────────────────────────────────────────
router.get('/me', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const [rows] = await pool.query(
      'SELECT id,name,email,phone,role FROM users WHERE id=?', [req.session.userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
