/**
 * Cấu hình kết nối PostgreSQL Database Pool cho dự án thanh_giuse_pc
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'thanh_giuse_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'thanhgiuse_secure_pass_2026',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('❌ [PostgreSQL Pool Error]', err.message);
});

module.exports = {
  pool,
  query: (text, params) => pool.query(text, params)
};
