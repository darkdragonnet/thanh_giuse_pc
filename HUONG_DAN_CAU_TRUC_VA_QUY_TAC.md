# HƯỚNG DẪN CẤU TRÚC VÀ QUY TẮC FUNCTION HỆ THỐNG
**Hệ Thống Đăng Ký & Quản Lý Nhận Diện Khuôn Mặt Face ID (Postgres-First & HANET AI Cloud)**

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG (ARCHITECTURE OVERVIEW)

Hệ thống được thiết kế theo mô hình **Postgres-First Architecture** kết hợp với **HANET AI Cloud**:
- **Cơ sở dữ liệu quan hệ (PostgreSQL 16):** Toàn bộ danh mục phòng ban (`departments`), lớp học (`classes`), nhân sự (`persons`) và lịch sử can thiệp (`audit_logs`) được quản lý tập trung và an toàn trên PostgreSQL.
- **Single Source of Truth cho Face ID (HANET Cloud):** Quản lý định danh sinh trắc học khuôn mặt (`person_id`, `face_url`), đồng bộ hai chiều với PostgreSQL qua `sync_status` (`PENDING`, `SYNCED`, `FAILED`).
- **Hàng đợi ngầm (Bull Queue on Redis DB 4):** Xử lý bất đồng bộ các tác vụ đăng ký Face ID, nén ảnh, gán phòng ban và cập nhật dữ liệu.
- **Bộ chuẩn hóa ảnh Sharp (Backend Engine):** Giải mã HEIC/HEIF tự động, đảm bảo 100% ảnh khuôn mặt gửi lên HANET đúng tỷ lệ chuẩn `1280 x 738` (`fit: 'contain'`), tự động sửa góc xoay EXIF và nén JPEG chất lượng 90.
- **Stateful Session Store (Redis DB 4):** Lưu trữ phiên làm việc và thông báo tương tác (`connect-flash`).

```
[ Người Dùng / Mobile / Zalo ]
           │
           ▼
[ Express Router & Middlewares ] (src/routes, src/middlewares)
           │
           ▼
[ Controllers / Services ] (personController, departmentController, dbClassService)
     │                     │
     ▼                     ▼
[ ImageService ]     [ PostgreSQL 16 ]
(HEIC / 1280x738)    (departments, classes, persons)
     │
     ▼
[ QueueService ] (Bull Queue on Redis DB 4)
     │
     ▼ (Worker chạy ngầm)
[ HanetService ] ◄──► [ HANET AI Cloud API ]
     │ (Đồng bộ khi thành công / Fallback -9007)
     ▼
[ PostgreSQL Pool ] ──► Cập nhật person_id, face_url & sync_status = 'SYNCED'
```

---

## 2. CẤU TRÚC THƯ MỤC DỰ ÁN

```
thanh_giuse_pc/
├── public/                     # Tài nguyên tĩnh (CSS, JS, Fonts, Icons)
├── scripts/                    # Các kịch bản khởi tạo database, schema và migration
│   ├── init_db_schema.sql      # Định nghĩa cấu trúc bảng PostgreSQL
│   ├── run_schema.js           # Khởi tạo/cập nhật schema tự động
│   └── migrate_csv_to_db.js    # Script migration lịch sử từ CSV sang PostgreSQL
├── src/                        # Mã nguồn chính của ứng dụng
│   ├── app.js                  # Entry point: Cấu hình Express, Redis, Session, Routes
│   ├── config/                 # Cấu hình kết nối cơ sở dữ liệu
│   │   └── database.js         # Connection pool kết nối PostgreSQL 16 (pg)
│   ├── controllers/            # Tầng điều khiển nghiệp vụ (Business Controllers)
│   │   ├── personController.js     # Đăng ký, sửa, xóa, xem danh sách, check-in
│   │   ├── departmentController.js # Quản lý phòng ban và thành viên phòng ban
│   │   └── authController.js       # Xác thực đăng nhập quản trị
│   ├── middlewares/            # Các Middleware lọc request
│   │   ├── authMiddleware.js       # Phân quyền RBAC (SUPER_ADMIN, ADMIN, GROUP_LEADER, PUBLIC_USER)
│   │   └── auditMiddleware.js      # Ghi nhận nhật ký hệ thống Structured Audit Log vào DB
│   ├── routes/                 # Định tuyến URL cho ứng dụng
│   │   ├── classRoutes.js          # REST API Quản lý Lớp Học (PostgreSQL)
│   │   ├── personRoutes.js         # Đăng ký Face ID, quản trị nhân sự
│   │   └── departmentRoutes.js     # Quản lý danh mục phòng ban
│   ├── services/               # Tầng dịch vụ nghiệp vụ (Business Services)
│   │   ├── dbClassService.js       # Quản lý Lớp học và Học viên trên PostgreSQL
│   │   ├── hanetService.js         # Tích hợp toàn diện API HANET AI Cloud
│   │   ├── queueService.js         # Quản lý Bull Queue, DLQ, Fallback và Sync PostgreSQL
│   │   ├── imageService.js         # Xử lý HEIC/HEIF, Sharp 1280x738, Cleanup Delayed
│   │   ├── idempotencyService.js   # Chống trùng lặp tác vụ với Redis SETNX Lock
│   │   └── csvService.js           # [DEPRECATED] Module lịch sử
│   └── views/                  # Giao diện ứng dụng (EJS Templates)
│       ├── class_manager.ejs       # Quản lý Lớp học SPA (Thêm, Sửa, Xóa, Đổi tên)
│       ├── register.ejs            # Giao diện chụp/tải ảnh Face ID (Canvas Pan/Zoom)
│       ├── links.ejs               # Danh sách link lớp học cho Zalo WebView
│       └── layout.ejs              # Master layout
├── uploads/                    # Thư mục lưu trữ ảnh tạm thời trong chu trình xử lý
├── docker-compose.yml          # Cấu hình container: App, PostgreSQL, Redis, Cloudflare Tunnel
└── package.json                # Danh mục dependencies của dự án
```

---

## 3. BẢN ĐỒ SERVICE VÀ QUY TẮC HỆ THỐNG

### 3.1. `src/services/dbClassService.js`
- `getClassMembers(className)`: Lấy danh sách thành viên thuộc lớp từ database.
- `addMember({ name, className, departmentId, title, aliasId })`: Thêm thành viên mới, tự sinh `alias_id` chuẩn 3 phần, gán trạng thái `PENDING`.
- `updateMember(aliasId, updateData)`: Sửa thông tin thành viên.
- `deleteMember(aliasId)`: Xóa an toàn dòng học viên khỏi database.
- `renameClass(oldName, newName)`: Transaction ACID (`BEGIN ... COMMIT / ROLLBACK`) đổi tên lớp và cập nhật toàn bộ học viên.

### 3.2. `src/services/imageService.js`
- `isHeic(buffer)`: Kiểm tra magic bytes HEIC/HEIF.
- `loadSharpInstance(buffer)`: Giải mã heic-decode fallback sang Sharp raw RGBA.
- `normalizeImage(input, outputPath)`: Chuẩn hóa ảnh `1280 x 738` (`fit: 'contain'`), xoay EXIF, xuất JPEG 90.
- `cleanupDelayed(filePath, delayMs)`: Xóa an toàn sau 30 giây (RULE-022).

### 3.3. `src/services/queueService.js`
- Quản lý Bull Queue `hanet-registration` và `hanet-registration-dlq`.
- Xử lý mã `-9007` tự động fallback sang `updateByFaceUrl`.
- Khi job thành công hoặc fallback hoàn tất:
  ```sql
  UPDATE persons 
  SET person_id = $1, face_url = $2, sync_status = 'SYNCED', updated_at = CURRENT_TIMESTAMP 
  WHERE alias_id = $3;
  ```
- Khi job thất bại vĩnh viễn: Lưu ảnh `dlq_<filename>.jpg` và đưa vào DLQ.

---
*Tài liệu hướng dẫn cấu trúc và quy chuẩn hệ thống **Thành Giuse PC**.*
