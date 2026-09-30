/**
 * Script thực thi khởi tạo Database Schema cho PostgreSQL
 * Đọc file scripts/init_db_schema.sql và áp dụng vào PostgreSQL Database
 * Sử dụng: node scripts/run_schema.js
 */

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const dotenv = require('dotenv');

// Nạp biến môi trường từ .env
dotenv.config();

// Cấu hình kết nối PostgreSQL
const poolConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'thanh_giuse_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'thanhgiuse_secure_pass_2026',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
    };

const pool = new Pool(poolConfig);

async function runSchema() {
  const schemaPath = path.join(__dirname, 'init_db_schema.sql');

  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ [Lỗi] Không tìm thấy file schema tại: ${schemaPath}`);
    process.exit(1);
  }

  const sqlContent = fs.readFileSync(schemaPath, 'utf-8');
  console.log('====================================================');
  console.log('🚀 [POSTGRESQL] BẮT ĐẦU KHỞI TẠO CẤU TRÚC DATABASE');
  console.log('====================================================');
  console.log(`📍 Host: ${poolConfig.host || 'qua DATABASE_URL'}`);
  console.log(`📍 Port: ${poolConfig.port || 5432}`);
  console.log(`📍 Database: ${poolConfig.database || 'mặc định'}`);
  console.log(`📍 User: ${poolConfig.user || 'postgres'}`);
  console.log('----------------------------------------------------');

  let client;
  try {
    client = await pool.connect();
    console.log('✅ [PostgreSQL] Kết nối Database thành công!');

    console.log('⏳ Đang thực thi các câu lệnh DDL trong init_db_schema.sql...');
    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');

    console.log('✅ [Hoàn tất] Khởi tạo Database Schema thành công rực rỡ!');
    console.log('   - Bảng departments: Đã sẵn sàng & nạp 3 phòng ban cốt lõi.');
    console.log('   - Bảng classes: Đã sẵn sàng.');
    console.log('   - Bảng persons: Đã sẵn sàng.');
    console.log('   - Toàn bộ Indexes: Đã khởi tạo tối ưu.');
    console.log('====================================================');
  } catch (err) {
    if (client) {
      await client.query('ROLLBACK').catch(() => {});
    }
    console.error('❌ [Thất bại] Lỗi thực thi schema:', err.message);
    console.error(err);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

// Thực thi script
runSchema();
