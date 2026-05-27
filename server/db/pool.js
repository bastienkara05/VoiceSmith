const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected DB error:', err);
});

// Keep connection alive on free tier (Railway pauses idle connections)
setInterval(() => {
  pool.query('SELECT 1').catch(err => console.error('Keep-alive query failed:', err));
}, 60000); // Every 60 seconds

module.exports = pool;
