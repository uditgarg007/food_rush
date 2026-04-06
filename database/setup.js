/**
 * database/setup.js
 * Run once: creates the DB, schema, and populates demo data.
 * Usage:  node database/setup.js
 */

const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
const fs      = require('fs');
const path    = require('path');

const DB_CONFIG = {
  host:     process.env.MYSQL_HOST || 'localhost',
  port:     parseInt(process.env.MYSQL_PORT) || 3306,
  user:     process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASS || '',
};

async function setup() {
  console.log('🚀  Setting up Food Delivery database...\n');

  const conn = await mysql.createConnection({ ...DB_CONFIG, multipleStatements: true });

  // --- Schema ---
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await conn.query(schema);
  await conn.query('USE food_delivery');
  console.log('✅  Schema created');

  // --- Hash passwords ---
  const hash = await bcrypt.hash('password123', 10);

  // --- Demo Users ---
  const users = [
    ['Priya Sharma',   'customer@demo.com',    hash, '9876543210', 'customer'],
    ['Raj Patel',      'restaurant@demo.com',  hash, '9876543211', 'restaurant_owner'],
    ['Arjun Singh',    'restaurant2@demo.com', hash, '9876543215', 'restaurant_owner'],
    ['Meera Iyer',     'restaurant3@demo.com', hash, '9876543216', 'restaurant_owner'],
    ['Vikram Kumar',   'rider@demo.com',       hash, '9876543212', 'rider'],
    ['Sonia Gupta',    'rider2@demo.com',      hash, '9876543213', 'rider'],
  ];

  for (const u of users) {
    await conn.query(
      'INSERT IGNORE INTO users (name,email,password,phone,role) VALUES (?,?,?,?,?)', u
    );
  }
  console.log('✅  Demo users created');

  // --- Categories ---
  const categories = [
    ['Biryani','🍛'], ['Pizza','🍕'], ['Burgers','🍔'], ['Chinese','🍜'],
    ['North Indian','🥘'], ['South Indian','🌿'], ['Desserts','🍰'],
    ['Beverages','☕'], ['Healthy','🥗'], ['Sushi','🍣'],
  ];
  for (const [name, icon] of categories) {
    await conn.query('INSERT IGNORE INTO categories (name,icon) VALUES (?,?)', [name, icon]);
  }
  console.log('✅  Categories created');

  // --- Get IDs ---
  const [[{ id: custId }]]   = await conn.query("SELECT id FROM users WHERE email='customer@demo.com'");
  const [[{ id: rest1Id }]]  = await conn.query("SELECT id FROM users WHERE email='restaurant@demo.com'");
  const [[{ id: rest2Id }]]  = await conn.query("SELECT id FROM users WHERE email='restaurant2@demo.com'");
  const [[{ id: rest3Id }]]  = await conn.query("SELECT id FROM users WHERE email='restaurant3@demo.com'");
  const [[{ id: rider1Id }]] = await conn.query("SELECT id FROM users WHERE email='rider@demo.com'");
  const [[{ id: rider2Id }]] = await conn.query("SELECT id FROM users WHERE email='rider2@demo.com'");

  const catMap = {};
  const [cats] = await conn.query('SELECT id, name FROM categories');
  cats.forEach(c => catMap[c.name] = c.id);

  // --- Skip restaurants/menu if already seeded ---
  const [[{ cnt: restCount }]] = await conn.query('SELECT COUNT(*) AS cnt FROM restaurants');
  if (restCount > 0) {
    console.log('⚠️   Restaurants already exist — skipping restaurant & menu seed (prevents duplicates)');
    console.log('    To re-seed, manually DELETE FROM menu_items, restaurants first.');
  } else {

  // --- Restaurants ---
  const restaurants = [
    [rest1Id, 'Spice Garden', 'North Indian',
     'Authentic North Indian cuisine with rich gravies and tandoor specials.',
     'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=800',
     '12, Connaught Place, New Delhi', 'New Delhi', 4.3, 25, 30, 149],
    [rest2Id, 'Biryani House', 'Biryani',
     'Home-style dum biryani crafted fresh every day with premium basmati.',
     'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800',
     '34, Banjara Hills, Hyderabad', 'Hyderabad', 4.6, 35, 49, 199],
    [rest3Id, 'Burger Barn', 'Burgers',
     'Gourmet smashed burgers and loaded fries — comfort food elevated.',
     'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800',
     '78, Koregaon Park, Pune', 'Pune', 4.1, 25, 29, 99],
  ];

  const restIds = [];
  for (const r of restaurants) {
    const [res] = await conn.query(
      `INSERT IGNORE INTO restaurants
       (owner_id,name,cuisine_type,description,image_url,address,city,rating,delivery_time,delivery_fee,min_order)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`, r
    );
    restIds.push(res.insertId || 0);
  }

  // Re-fetch proper IDs
  const [rests] = await conn.query('SELECT id, name FROM restaurants');
  const restMap = {};
  rests.forEach(r => restMap[r.name] = r.id);

  const R1 = restMap['Spice Garden'];
  const R2 = restMap['Biryani House'];
  const R3 = restMap['Burger Barn'];

  // --- Menu Items ---
  const menuItems = [
    // Spice Garden (North Indian)
    [R1, catMap['North Indian'], 'Butter Chicken', 'Tender chicken in rich tomato-cream gravy', 320, 'https://images.unsplash.com/photo-1603894584373-5ac82b2ae398?w=400', 0],
    [R1, catMap['North Indian'], 'Palak Paneer',   'Cottage cheese in spiced spinach sauce',      280, 'https://images.unsplash.com/photo-1535400255456-984e3e9f5a3e?w=400', 1],
    [R1, catMap['North Indian'], 'Dal Makhani',    'Slow-cooked black lentils with cream',         220, 'https://images.unsplash.com/photo-1546833999-b9f581a1996d?w=400', 1],
    [R1, catMap['North Indian'], 'Garlic Naan',    'Fluffy naan with garlic butter',               60,  'https://images.unsplash.com/photo-1585581296574-a2b7d2f1d65d?w=400', 1],
    [R1, catMap['Beverages'],    'Mango Lassi',    'Chilled mango yogurt drink',                   80,  'https://images.unsplash.com/photo-1570696516188-ade861b84a49?w=400', 1],

    // Biryani House
    [R2, catMap['Biryani'], 'Hyderabadi Dum Biryani',    'Aromatic basmati with slow-cooked chicken',  380, 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=400', 0],
    [R2, catMap['Biryani'], 'Veg Biryani',               'Garden vegetables in fragrant basmati',       280, 'https://images.unsplash.com/photo-1589302168068-964664d93dc0?w=400', 1],
    [R2, catMap['Biryani'], 'Mutton Biryani',            'Slow-cooked succulent mutton',                450, 'https://images.unsplash.com/photo-1585937421612-70a008356fbe?w=400', 0],
    [R2, catMap['South Indian'], 'Mirchi Ka Salan',      'Peanut sesame gravy with green chillies',     120, 'https://images.unsplash.com/photo-1574484284002-952d92456975?w=400', 1],
    [R2, catMap['Desserts'],     'Double Ka Meetha',     'Hyderabadi bread pudding with rabri',         150, 'https://images.unsplash.com/photo-1571115177098-24ec42ed204d?w=400', 1],

    // Burger Barn
    [R3, catMap['Burgers'], 'Classic Smash Burger',     'Double patty, cheddar, special sauce',       249, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400', 0],
    [R3, catMap['Burgers'], 'Crispy Chicken Burger',    'Buttermilk fried chicken, pickles, slaw',    229, 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?w=400', 0],
    [R3, catMap['Burgers'], 'Veggie Burger',            'Spiced black bean patty, avocado',            189, 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400', 1],
    [R3, catMap['Burgers'], 'Loaded Fries',             'Crispy fries, cheese sauce, jalapeños',       149, 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400', 1],
    [R3, catMap['Beverages'], 'Thick Vanilla Shake',   'House-made soft-serve vanilla shake',         139, 'https://images.unsplash.com/photo-1572490122747-3e9d4f8d35b0?w=400', 1],
  ];

  for (const item of menuItems) {
    await conn.query(
      `INSERT IGNORE INTO menu_items
       (restaurant_id,category_id,name,description,price,image_url,is_veg)
       VALUES (?,?,?,?,?,?,?)`, item
    );
  }
  console.log('✅  Menu items created');

  // --- Riders ---
  await conn.query(
    'INSERT IGNORE INTO riders (user_id,vehicle_type,vehicle_number) VALUES (?,?,?)',
    [rider1Id, 'motorcycle', 'DL-1AB-2345']
  );
  await conn.query(
    'INSERT IGNORE INTO riders (user_id,vehicle_type,vehicle_number) VALUES (?,?,?)',
    [rider2Id, 'scooter', 'MH-12CD-6789']
  );
  console.log('✅  Riders created');
  } // end of restaurant/menu seed block

  await conn.end();

  console.log('\n🎉  Setup complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Demo Credentials (password: password123)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  👤 Customer  : customer@demo.com');
  console.log('  🍽️  Restaurant: restaurant@demo.com  (Spice Garden)');
  console.log('  🍛 Restaurant: restaurant2@demo.com (Biryani House)');
  console.log('  🍔 Restaurant: restaurant3@demo.com (Burger Barn)');
  console.log('  🛵 Rider     : rider@demo.com');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

setup().catch(err => { console.error('❌  Setup failed:', err.message); process.exit(1); });
