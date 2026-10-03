-- migrations/006_register_integrity_outbox.sql
-- Khởi tạo bảng registration_requests và registration_outbox bảo toàn danh tính, outbox và trạng thái đăng ký Face ID

-- 1. BẢNG YÊU CẦU ĐĂNG KÝ (registration_requests)
CREATE TABLE IF NOT EXISTS registration_requests (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(100) UNIQUE NOT NULL,
    alias_id VARCHAR(100) NOT NULL,
    person_id VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    class_name VARCHAR(100),
    department_id VARCHAR(50),
    title VARCHAR(100),
    image_path TEXT,
    image_filename VARCHAR(255),
    public_image_url TEXT,
    operation_type VARCHAR(50) NOT NULL DEFAULT 'REGISTER_NEW', -- REGISTER_NEW, UPDATE_PHOTO, RETAKE_FACE
    status VARCHAR(50) NOT NULL DEFAULT 'ACCEPTED', -- ACCEPTED, PROCESSING, SYNCED, REVIEW_REQUIRED, FAILED
    cloud_result JSONB,
    error_message TEXT,
    attempts INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. BẢNG OUTBOX PHỤC HỒI ENQUEUE (registration_outbox)
CREATE TABLE IF NOT EXISTS registration_outbox (
    id BIGSERIAL PRIMARY KEY,
    request_id VARCHAR(100) NOT NULL REFERENCES registration_requests(request_id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, ENQUEUED, FAILED
    attempts INT DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. CHỈ MỤC TỐI ƯU TRUY VẤN
CREATE INDEX IF NOT EXISTS idx_reg_requests_req_id ON registration_requests(request_id);
CREATE INDEX IF NOT EXISTS idx_reg_requests_alias ON registration_requests(alias_id);
CREATE INDEX IF NOT EXISTS idx_reg_requests_person_id ON registration_requests(person_id);
CREATE INDEX IF NOT EXISTS idx_reg_requests_status ON registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_reg_requests_created ON registration_requests(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reg_outbox_status ON registration_outbox(status);
CREATE INDEX IF NOT EXISTS idx_reg_outbox_req_id ON registration_outbox(request_id);
CREATE INDEX IF NOT EXISTS idx_reg_outbox_created ON registration_outbox(created_at ASC);
