-- migrations/005_create_transfer_snapshots.sql
-- Khởi tạo bảng snapshot lưu vết lịch sử chuyển lớp và điểm phục hồi dữ liệu

CREATE TABLE IF NOT EXISTS transfer_snapshots (
    id BIGSERIAL PRIMARY KEY,
    batch_id VARCHAR(64) NOT NULL,
    person_id_local BIGINT NOT NULL REFERENCES persons(id) ON DELETE CASCADE,
    from_class VARCHAR(100) NOT NULL,
    to_class VARCHAR(100) NOT NULL,
    old_alias_id VARCHAR(100),
    new_alias_id VARCHAR(100),
    hanet_person_id VARCHAR(64),
    face_url TEXT,
    sync_status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    restored_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_transfer_snapshots_batch ON transfer_snapshots(batch_id);
CREATE INDEX IF NOT EXISTS idx_transfer_snapshots_person ON transfer_snapshots(person_id_local);
CREATE INDEX IF NOT EXISTS idx_transfer_snapshots_created ON transfer_snapshots(created_at DESC);
