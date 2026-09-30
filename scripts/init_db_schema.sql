-- scripts/init_db_schema.sql
-- Khởi tạo cấu trúc Database cho dự án thanh_giuse_pc

-- 1. BẢNG PHÒNG BAN (Departments)
CREATE TABLE IF NOT EXISTS departments (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL UNIQUE
);

-- Khởi tạo dữ liệu mặc định 3 phòng ban cốt lõi
INSERT INTO departments (id, name, code)
VALUES 
    ('990653', 'Thiếu Nhi', 'TN'),
    ('990730', 'Legiô Mariae', 'LM'),
    ('990731', 'Giới Trẻ', 'GT')
ON CONFLICT (id) DO UPDATE SET 
    name = EXCLUDED.name,
    code = EXCLUDED.code;

-- 2. BẢNG LỚP / ĐOÀN THỂ (Classes)
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    department_id VARCHAR(50) REFERENCES departments(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. BẢNG NHÂN SỰ / THÀNH VIÊN (Persons)
CREATE TABLE IF NOT EXISTS persons (
    id SERIAL PRIMARY KEY,
    alias_id VARCHAR(100) UNIQUE NOT NULL,
    person_id VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    class_name VARCHAR(100) REFERENCES classes(name) ON DELETE SET NULL,
    department_id VARCHAR(50) REFERENCES departments(id) ON DELETE SET NULL,
    title VARCHAR(100) NOT NULL,
    face_url TEXT,
    sync_status VARCHAR(50) DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. BỘ CHỈ MỤC TỐI ƯU HÓA TRUY VẤN (Indexes)
CREATE INDEX IF NOT EXISTS idx_persons_alias ON persons(alias_id);
CREATE INDEX IF NOT EXISTS idx_persons_name_class ON persons(name, class_name);
CREATE INDEX IF NOT EXISTS idx_persons_person_id ON persons(person_id);
CREATE INDEX IF NOT EXISTS idx_persons_sync_status ON persons(sync_status);
CREATE INDEX IF NOT EXISTS idx_classes_name ON classes(name);
