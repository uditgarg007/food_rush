// server/db.js — MySQL connection pool
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.MYSQL_HOST || 'localhost',
  port:     parseInt(process.env.MYSQL_PORT) || 3306,
  user:     process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASS || '',
  database: process.env.MYSQL_DB   || 'food_delivery',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  timezone: '+05:30',
});

pool.getConnection()
  .then(c => { console.log('✅  MySQL connected'); c.release(); })
  .catch(err => { console.error('❌  MySQL connection failed:', err.message); });

module.exports = pool;
