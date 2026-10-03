# TỔNG HỢP DỰ ÁN: THANH GIUSE PC (HANET CLOUD-FIRST)
> Thời gian tạo: 2026-10-02 14:04:32
> Mục đích: Lưu trữ toàn bộ rules, skills, cấu trúc DB, và mã nguồn dự án vào một file duy nhất cho AI Agent.

---

## 1. HỆ THỐNG RULES & SKILLS

### Tài liệu: `./HUONG_DAN_CAU_TRUC_VA_QUY_TAC.md`
```markdown
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

```

### Tài liệu: `./.agents/rules`
```markdown

```

### Tài liệu: `./.agents/rules/hanet-sdd-context.md`
```markdown
---
name: hanet-sdd-context
description: Ngữ cảnh kiến trúc, cấu trúc module, API HANET và các quy tắc kỹ thuật của dự án HANET Cloud-First thanh_giuse_pc theo bản SDD v1.0. Dùng khi lập trình, sửa bug hoặc viết tính năng mới cho dự án.
---

# Ngữ cảnh Kỹ thuật & SDD — thanh_giuse_pc (v1.0)

## 1. Kiến trúc & Công nghệ Cốt lõi
- **Runtime & Framework:** Node.js 20-alpine, Express.js, EJS.
- **Queue & Cache:** Bull + Redis (DB 4).
- **Deployment:** Docker Compose trên VPS Ubuntu, public qua Cloudflare Tunnel (`thanh_giuse.gaudetedomino.io.vn`).
- **Kiến trúc:** Cloud-First (không dùng DB cục bộ, dữ liệu đồng bộ trực tiếp qua HANET API).

## 2. Các quy tắc API HANET Bắt buộc (Tránh bẫy Doc sai)
- **Cập nhật/Xóa phòng ban (`update`, `remove`):** Phải dùng field `id` (số ít), **không** dùng `departmentID`.
- **Gỡ nhân sự khỏi phòng (`remove-person`):** Phải dùng field `personID` (số ít), **không** dùng `personIDs`.
- **Place ID:** Phải sử dụng getter động `process.env.HANET_PLACE_ID` để tránh lỗi `undefined` do thứ tự nạp dotenv.

## 3. Quy tắc Code & Xử lý Lỗi (Fail-Soft)
- **RULE-007:** Khi gặp lỗi `-9007` (khuôn mặt đã tồn tại trên HANET Cloud), bắt buộc coi là thành công (Fail-Soft). Trích xuất `existingPersonID` từ payload lỗi, gọi `hanetService.updatePersonByFaceUrl` để ghi đè ảnh mới + `hanetService.updatePersonInfo` cập nhật thông tin + `addPersonsToDepartment`. KHÔNG throw error làm fail job trong Bull Queue.
- **RULE-008:** Mọi URL ảnh đọc từ CSV hoặc form nhập liệu phải qua bước làm sạch (sanitize) để loại bỏ định dạng Markdown `[url](url)`.
- **RULE-009:** Mã NV (aliasID) sinh tức thì (0ms) theo format: `[Ký tự đầu Phòng Ban]_[Tên Lớp đầy đủ của Cột 2]_[Token Độc Bản Base36]`. Tuyệt đối không cắt bớt tên lớp (VD: `TN_BaoDong_1a_7K2F`).
- **RULE-022:** Cleanup Ảnh (Queue Worker): Bắt buộc **delay 30 giây** (`imageService.cleanupDelayed` 30000ms) trước khi xóa file ảnh trong `uploads/` để HANET AI kịp fetch public URL qua Cloudflare.
- **RULE-026:** Không bao giờ hiển thị mã lỗi thô (`-9006`, `-9008`, `-1`, `-5008`,...) cho người dùng. Bắt buộc dịch qua từ điển tiếng Việt `src/utils/hanetErrorMap.js`.
- **So sánh ID:** Luôn ép kiểu `String()` khi so sánh ID từ HANET (number) với form/dropdown (string).
- **View / Controller:** Không được `res.redirect` hoặc crash app khi gặp lỗi API 403 từ HANET. Luôn bắt lỗi, gán cờ `permissionError` và render view kèm flash message.

```

### Tài liệu: `./.agents/knowledge.md`
```markdown
# Knowledge Base — thanh_giuse_pc

## Kiến thức & Quy chuẩn Hệ thống (Knowledge Items)

### [KI-037] Xử lý lỗi -9007 (EMPLOYEE_REGISTER_IMG_DUPLICATE_ERROR)
- **Đặc điểm:** Khi gửi ảnh khuôn mặt đã tồn tại trên Cloud qua `/person/register` hoặc `/person/registerByUrl`, HANET trả HTTP 400 kèm JSON `{ returnCode: -9007, returnMessage: "...", data: { personID: "..." } }`.
- **Giải pháp:** Queue worker bắt mã `-9007`, trích xuất `data.personID`, gọi tiếp `updatePersonByFaceUrl` để cập nhật Face ID mới, gọi `updatePersonInfo` để cập nhật thông tin họ tên / chức vụ / mã NV, và gán phòng ban nếu có. Đánh dấu job hoàn tất thành công mà không throw error.

### [KI-038] Bind Volume thư mục Data CSV trong Docker Compose
- **Đặc điểm:** Thư mục `data/` chứa các file CSV danh mục (`thieu_nhi.csv`, `le_sinh.csv`, `ca_doan.csv`,...).
- **Giải pháp:** Phải cấu hình bind volume `./data:/app/data` trong `docker-compose.yml` để khi container khởi chạy hoặc restart, các tệp CSV thêm mới/ghi tiếp (append) không bị mất dữ liệu.

### [KI-039] Bảng ánh xạ 6 cột dữ liệu CSV Tiếng Việt chuẩn hóa
- **Cột 1 (Tên):** `ho_ten` — Họ và Tên thành viên.
- **Cột 2 (Lớp):** `lop` — Tên Lớp đầy đủ, giữ nguyên định dạng không viết tắt (ví dụ: `BaoDong_1a`, `Chiên Con 1`).
- **Cột 3 (Phòng Ban):** `phong_ban` — Tên phòng ban (ví dụ: `Thiếu Nhi`, `Ban Lễ Sinh`).
- **Cột 4 (Chức Vụ):** `chuc_vu` — Chức vụ (ví dụ: `Học Sinh`, `Huynh Trưởng`).
- **Cột 5 (links):** `anh_url` — Đường dẫn ảnh Face ID hoặc avatar thumbnail.
- **Cột 6 (PersonID):** `hanet_person_id` — ID định danh duy nhất trên Cloud của HANET.

### [KI-040] Hỗ trợ Camera trên Trình duyệt Zalo In-App Mobile
- **Đặc điểm:** Trình duyệt nội bộ của Zalo trên iOS/Android thường chặn hoặc hạn chế API WebRTC `navigator.mediaDevices.getUserMedia`.
- **Giải pháp:** Cung cấp song song `<input type="file" accept="image/*" capture="user">` để kích hoạt trực tiếp Camera trước (Selfie) của thiết bị di động, đảm bảo 100% người dùng trên Zalo đều chụp được ảnh.

### [KI-041] Bảng mã lỗi chính thức HANET Developer API (Official returnCodes)
- `1`: Thao tác thành công.
- `-1`: Dữ liệu gửi lên không hợp lệ hoặc thiếu tham số bắt buộc.
- `-103`: Access Token hết hạn (Hệ thống tự động xoay vòng qua OAuth2).
- `-404`: Endpoint / Yêu cầu không được hỗ trợ.
- `-503`: Máy chủ HANET Cloud bảo trì / quá tải.
- `-909`: Lỗi upload dữ liệu khuôn mặt.
- `-1001`: Lỗi khởi tạo địa điểm (Place).
- `-1005`: Địa điểm không tồn tại trên hệ thống.
- `-10076`: Không có quyền chỉnh sửa địa điểm.
- `-2035`: Không có quyền truy cập vào phòng ban hoặc địa điểm.
- `-5004`: Không thể tạo khuôn mặt do mạng không ổn định.
- `-5005`: Không thể cập nhật thông tin thành viên (không tìm thấy thành viên).
- `-5006`: Không thể xóa thành viên khỏi phòng ban.
- `-5008`: Cập nhật khuôn mặt mới thất bại.
- `-5010`: Ảnh khuôn mặt không hợp lệ.
- `-5011`: Không tìm thấy hồ sơ thành viên trên Cloud.
- `-9002`: Định dạng ảnh không hợp lệ (chỉ nhận JPG, JPEG, PNG).
- `-9003`: Lỗi máy chủ khi đăng ký thành viên mới.
- `-9004`: Lỗi khi xóa nhân sự.
- `-9005`: Mã nhân viên (aliasID) đã tồn tại.
- `-9006`: Ảnh chụp không đạt chuẩn (mờ, che mặt, nhiều người hoặc không có khuôn mặt).
- `-9007`: Khuôn mặt đã tồn tại trên Cloud (`data.personID`).
- `-9008`: Dung lượng bộ nhớ Face ID của địa điểm đã hết.
```

### Tài liệu: `./PROJECT_ARCHITECTURE_UNIFIED.md`
```markdown
# KIẾN TRÚC HỆ THỐNG VÀ ĐẶC TẢ KỸ THUẬT HỢP NHẤT
## DỰ ÁN: THANH GIUSE PC (POSTGRES-FIRST & HANET AI CLOUD INTEGRATION)

---

## MỤC LỤC
1. **PHẦN 1: TỔNG QUAN HỆ THỐNG & LUỒNG LIÊN KẾT (Postgres-First Architecture & Data Flow)**
   - Sơ đồ tương tác và luồng chạy dữ liệu khép kín.
   - Quản lý dữ liệu quan hệ (Relational Database) trên PostgreSQL 16.
2. **PHẦN 2: BẢN ĐỒ MÃ NGUỒN TỔNG HỢP (Unified Source Code Map)**
   - Services: `hanetService.js`, `queueService.js`, `dbClassService.js`, `imageService.js`, `idempotencyService.js`.
   - Controllers & Routes: `personController.js`, `departmentController.js`, `classRoutes.js`, `personRoutes.js`.
   - Views (EJS): `class_manager.ejs`, `register.ejs`, `links.ejs`, `layout.ejs`.
   - Cơ sở dữ liệu: `src/config/database.js`, `scripts/init_db_schema.sql`.
   - Cấu hình hạ tầng: `docker-compose.yml`, `Dockerfile`, `thanh_giuse_pc_postgres`, `thanh_giuse_pc_redis`, `cloudflared tunnel`.
3. **PHẦN 3: TRI THỨC HỆ THỐNG (Knowledge Base)**
   - HANET Cloud API Specification (OAuth2, Endpoints, Formats, Headers).
   - Bảng mã lỗi chi tiết & Cơ chế Fallback (-5011, -9007, -103).
   - Ma trận phân quyền RBAC và Structured Audit Logging.
4. **PHẦN 4: QUY TẮC VÀ ĐẶC TẢ KỸ THUẬT (Rules & System Constraints)**
   - **RULE-001:** Khai tử CSV — 100% PostgreSQL Data Layer.
   - **RULE-002:** Bảo toàn & Đồng bộ 2 chiều HANET Cloud ⟷ PostgreSQL.
   - **RULE-003:** Tính toàn vẹn giao dịch (ACID Database Transactions).
   - **RULE-004:** Chuẩn hóa Định danh `alias_id` 3 phần.
   - **RULE-022:** Delayed Cleanup 30s & Bảo tồn ảnh DLQ.
   - **RULE-090:** Full Source Code Integrity.
5. **PHẦN 5: KỸ NĂNG VÀ THAO TÁC VẬN HÀNH (Skills & Operations)**
   - Quy trình Git & Deployment chuẩn trên VPS Ubuntu (`root@vpssieutoc`).
   - Lệnh điều phối Docker, PostgreSQL, Redis và bảo trì dữ liệu ngầm.

---

## PHẦN 1: TỔNG QUAN HỆ THỐNG & LUỒNG LIÊN KẾT (Postgres-First Architecture & Data Flow)

### 1.1 Sơ Đồ Khép Kín Hệ Thống (End-to-End Architecture)

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Client & Zalo WebView"]
        A1["Người Dùng Zalo / Web Mobile"] -->|Mở Link Đăng Ký / Anti-Cache Meta| A2["Giao Diện Canvas (register.ejs)"]
        A2 -->|Chụp Ảnh / Tải Ảnh + Pan/Zoom 1280x738| A3["Gửi Form (POST Multipart)"]
        A4["Quản Trị Viên / Giáo Lý Viên"] -->|Quản Lý Lớp Học SPA| A5["class_manager.ejs"]
    end

    subgraph AppLayer ["2. Express.js Application Server"]
        B1["classRoutes.js / personRoutes.js"] --> B2["personController.js / dbClassService.js"]
        B2 -->|Tiền Xử Lý Ảnh| B3["imageService.js (HEIC Decode + Sharp 1280x738 Contain)"]
        B3 -->|Đẩy Tác Vụ Ngầm| B4["queueService.js (Bull Queue - Redis DB 4)"]
    end

    subgraph HanetLayer ["3. HANET AI Cloud Integration (Single Source of Truth)"]
        B4 -->|1. Gọi Đăng Ký Nhân Sự| C1["hanetService.registerPerson"]
        C1 -->|Multipart Binary / URL| C2["HANET Cloud API (/person/register)"]
        C2 -- "Mã -9007 (Mặt đã tồn tại)" --> C3["Luồng Fallback: extractPersonIDFromHanet"]
        C3 -->|2. Cập Nhật Face ID| C4["hanetService.updateByFaceUrl"]
        C3 -->|3. Cập Nhật Info & Title| C5["hanetService.updateInfo"]
        C3 -->|4. Khóa Phòng Ban| C6["hanetService.addPersonsToDepartment"]
        C2 -- "Thành Công (returnCode: 1)" --> C6
    end

    subgraph DataLayer ["4. PostgreSQL 16 Relational Data Layer"]
        C6 -->|5. Cập Nhật Trạng Thái SYNCED| D1["PostgreSQL: persons table"]
        B2 <-->|CRUD & Transaction ACID| D2["PostgreSQL: classes & departments"]
        B4 -->|6. Dọn Dẹp File Tạm Sau 30s (RULE-022)| D3["uploads/ cleanupDelayed (Lưu dlq_ nếu lỗi)"]
    end

    subgraph InfraLayer ["5. Hạ Tầng & Container Stack"]
        E1["VPS Ubuntu (root@vpssieutoc)"] <-->|Git Fetch / Reset Hard| E2["Local Workspace"]
        E1 -->|Docker Compose| E3["Node.js App Container"]
        E1 -->|Docker Compose| E4["PostgreSQL 16 (thanh_giuse_pc_postgres)"]
        E1 -->|Docker Compose| E5["Redis 7-Alpine DB 4 (thanh_giuse_pc_redis)"]
        E1 -->|Docker Compose| E6["Cloudflare Tunnel (thanh_giuse_pc_tunnel)"]
    end

    A3 --> B1
    A5 --> B1
```

### 1.2 Cấu Trúc Bảng Dữ Liệu PostgreSQL 16
Hệ thống vận hành trên cơ sở dữ liệu quan hệ PostgreSQL 16 với 4 bảng dữ liệu cốt lõi:
1. **`departments`**: Lưu danh mục phòng ban chuẩn (`990653` - Thiếu Nhi, `990730` - Legiô Mariae, `990731` - Giới Trẻ, `990732` - Gia Trưởng, `990733` - Hiền Mẫu).
2. **`classes`**: Lưu danh sách các lớp học / đoàn thể (Khóa ngoại `department_id` trỏ về `departments.id`).
3. **`persons`**: Lưu danh sách nhân sự, `alias_id` (UNIQUE), `person_id` (HANET Cloud ID), `face_url`, `sync_status` (`PENDING`, `SYNCED`, `FAILED`).
4. **`audit_logs`**: Lưu vết toàn bộ hoạt động can thiệp dữ liệu có cấu trúc JSONB.

---

## PHẦN 2: BẢN ĐỒ MÃ NGUỒN TỔNG HỢP (Unified Source Code Map)

### 2.1 Services (`src/services/`)
- **[`dbClassService.js`](file:///Users/dragon/thanh_giuse_pc/src/services/dbClassService.js):**
  + Tầng truy xuất dữ liệu lớp học và học viên thuần PostgreSQL qua `pg` pool.
  + `getClassMembers(className)`: Truy vấn danh sách thành viên theo lớp.
  + `addMember(memberData)`: Tự động sinh `alias_id` chuẩn 3 phần, đảm bảo khóa ngoại `classes` và thêm vào `persons` (`sync_status = 'PENDING'`).
  + `updateMember(aliasId, updateData)`: Sửa thông tin / đổi tên nhân sự.
  + `deleteMember(aliasId)`: Xóa an toàn nhân sự khỏi database.
  + `renameClass(oldName, newName)`: Thực thi Transaction ACID (`BEGIN ... COMMIT / ROLLBACK`) đồng bộ bảng `classes` và `persons`.
- **[`hanetService.js`](file:///Users/dragon/thanh_giuse_pc/src/services/hanetService.js):**
  + Tự động quản lý vòng đời OAuth2 token, xoay vòng khi token hết hạn (mã lỗi `-103`).
  + `registerPerson(data)`: Gửi stream file ảnh nhị phân trực tiếp (`form-data`) tới `/person/register`.
  + `updateInfo(data)` & `updatePerson(data)`: Chuẩn hóa payload `application/x-www-form-urlencoded`.
  + `updateByFaceUrl(data)`: Cập nhật khuôn mặt qua `faceUrl`.
  + `getListByPlace({ fetchAll: true })`: Quét phân trang toàn bộ nhân sự từ Cloud, chống rate limit.
  + `addPersonsToDepartment(departmentID, personIDs)`: Khóa phân quyền nhân sự vào phòng ban trên Cloud.
- **[`queueService.js`](file:///Users/dragon/thanh_giuse_pc/src/services/queueService.js):**
  + Điều phối hàng đợi Bull Queue chính `hanet-registration` và hàng đợi chết `hanet-registration-dlq` trên Redis DB 4.
  + Cấu hình Retry lũy thừa (`attempts: 3`, `backoff: exponential 2000ms`: 2s, 4s, 8s).
  + Định nghĩa lớp lỗi `UnrecoverableError`: Khi gặp lỗi vĩnh viễn (`-9002`, `-9005`, `-9006`), tự động dừng retry (`job.discard()`), lưu trữ ảnh với tiền tố `dlq_<filename>` và đưa sang DLQ.
  + Bắt mã lỗi `-9007` (*Face already exists*), trích xuất `personID` linh hoạt qua `extractPersonIDFromHanet`, chuyển tiếp sang hàm xử lý `handleFaceExistsFallback`.
  + Cập nhật trực tiếp kết quả vào PostgreSQL: `UPDATE persons SET person_id = $1, face_url = $2, sync_status = 'SYNCED' WHERE alias_id = $3`.
- **[`imageService.js`](file:///Users/dragon/thanh_giuse_pc/src/services/imageService.js):**
  + Tích hợp giải mã HEIC/HEIF tự động qua Magic Bytes (`isHeic`) và `heic-decode`.
  + Chuẩn hóa khung hình `1280x738` bằng Sharp với `fit: 'contain'` (tránh cắt mất khuôn mặt -9006).
  + Nén chất lượng ảnh JPEG 90 mozjpeg.
  + `cleanupDelayed(filePath, 30000)`: Xóa file ảnh tạm an toàn sau 30 giây (bảo toàn ảnh khi vào DLQ).
- **[`idempotencyService.js`](file:///Users/dragon/thanh_giuse_pc/src/services/idempotencyService.js):**
  + Quản lý chống trùng lặp tác vụ (Idempotency) và phân tán khóa (Distributed Lock) qua Redis SETNX trên DB 4.

### 2.2 Routes & Controllers
- **[`classRoutes.js`](file:///Users/dragon/thanh_giuse_pc/src/routes/classRoutes.js):** REST API quản lý lớp học kết nối trực tiếp `dbClassService`.
- **[`personRoutes.js`](file:///Users/dragon/thanh_giuse_pc/src/routes/personRoutes.js):** Routes công khai đăng ký Zalo WebView và routes quản trị bảo vệ bởi RBAC + Audit Log.
- **[`personController.js`](file:///Users/dragon/thanh_giuse_pc/src/controllers/personController.js):** Controller điều phối dữ liệu nhân sự, danh sách lớp (`classes` table) và tích hợp Queue.

---

## PHẦN 3: TRI THỨC HỆ THỐNG (Knowledge Base)

### 3.1 Bảng Mã Lỗi & Cơ Chế Phục Hồi Tự Động (Fallback Matrix)
| Mã Lỗi | Tên Lỗi / Ý Nghĩa | Phân Loại | Cơ Chế Xử Lý Của Hệ Thống |
| :---: | :--- | :--- | :--- |
| **`1`** | **Thành công (Success)** | Thành công | Ghi nhận `person_id`, gán phòng ban và cập nhật `sync_status = 'SYNCED'` vào PostgreSQL. |
| **`-103`** | **Access Token Expired** | Tạm thời | Tự động gọi OAuth2 lấy token mới và retry ngay lập tức. |
| **`-5011`** | **Không tìm thấy nhân sự** | Nghiệp vụ | Log cảnh báo, chuyển sang tạo mới hoặc kiểm tra lại mã AliasID/PersonID. |
| **`-9007`** | **Khuôn mặt đã tồn tại (Face exists)** | Nghiệp vụ Fallback | Trích xuất `personID` từ phản hồi -> Gọi `updateByFaceUrl` và `updateInfo` -> Khóa phòng ban -> Đồng bộ `SYNCED` vào PostgreSQL. |
| **`-9002`** | **Không phát hiện khuôn mặt** | Lỗi vĩnh viễn | Dừng retry, bảo tồn ảnh `dlq_*`, chuyển vào DLQ. |
| **`-9005`** | **Ảnh quá mờ / không đạt chuẩn** | Lỗi vĩnh viễn | Dừng retry, bảo tồn ảnh `dlq_*`, chuyển vào DLQ. |
| **`-9006`** | **Phát hiện nhiều hơn 1 khuôn mặt** | Lỗi vĩnh viễn | Dừng retry, bảo tồn ảnh `dlq_*`, chuyển vào DLQ. |

---

## PHẦN 4: QUY TẮC VÀ ĐẶC TẢ KỸ THUẬT (Rules & System Constraints)

### 4.1 RULE-001: Khai Tử CSV — 100% PostgreSQL Data Layer
- Tuyệt đối cấm đọc, ghi, parse, tạo file trong `data/*.csv`.
- Mọi dữ liệu phòng ban, lớp học, nhân sự và audit logs đều lưu trữ trong cơ sở dữ liệu **PostgreSQL 16**.

### 4.2 RULE-002: Bảo Toàn & Đồng Bộ 2 Chiều HANET Cloud ⟷ PostgreSQL
- HANET Cloud là **Single Source of Truth** cho nhận diện khuôn mặt (`person_id`, `face_url`).
- PostgreSQL ghi nhận và đồng bộ trạng thái nhân sự qua câu lệnh:
  ```sql
  INSERT INTO persons (alias_id, name, class_name, department_id, title, face_url, person_id, sync_status)
  VALUES ($1, $2, $3, $4, $5, $6, $7, 'SYNCED')
  ON CONFLICT (alias_id) DO UPDATE SET
    name = EXCLUDED.name,
    class_name = EXCLUDED.class_name,
    department_id = EXCLUDED.department_id,
    title = EXCLUDED.title,
    face_url = COALESCE(EXCLUDED.face_url, persons.face_url),
    person_id = COALESCE(EXCLUDED.person_id, persons.person_id),
    sync_status = 'SYNCED',
    updated_at = CURRENT_TIMESTAMP;
  ```

### 4.3 RULE-003: Tính Toàn Vẹn Giao Dịch (ACID Database Transactions)
- Các thao tác thay đổi nhiều bảng (Đổi tên lớp, chuyển lớp, cấu trúc lại phòng ban) bắt buộc bọc trong Transaction (`BEGIN ... COMMIT / ROLLBACK`).

### 4.4 RULE-004: Chuẩn Hóa Định Danh `alias_id` 3 Phần
- Định dạng: `[MÃ_PHÒNG_BAN]_[TÊN_LỚP_KHÔNG_DẤU_VIẾT_HOA]_[MÃ_4_KÝ_TỰ_A-Z0-9]`.
- Ví dụ: `TN_THEMSUC1A_8XI8`, `LM_DMHCCC_4BDI`, `GT_GIOITRE_9M1N`.

### 4.5 RULE-022: Cleanup Delay 30s Policy & DLQ Preservation
- Ảnh chuẩn hóa `1280x738` (`fit: 'contain'`) xóa sau 30 giây bằng `imageService.cleanupDelayed(imagePath, 30000)` khi job thành công hoặc retry.
- Khi job chuyển vào DLQ, hủy cleanup và đổi tên thành `dlq_<filename>.jpg` để phục vụ tái nạp và kiểm tra.

### 4.6 RULE-090: Full Source Code Integrity
- Cung cấp toàn bộ mã nguồn hoàn chỉnh, không dùng placeholder `/* giữ nguyên code cũ */`.

---

## PHẦN 5: KỸ NĂNG VÀ THAO TÁC VẬN HÀNH (Skills & Operations)

### 5.1 Quy Trình Git & Deployment Chuẩn Trên VPS Ubuntu (`root@vpssieutoc`)

```bash
# 1. Truy cập vào thư mục dự án trên VPS
cd /root/thanh_giuse_pc

# 2. Cập nhật mã nguồn mới nhất từ nhánh main
git fetch origin
git reset --hard origin/main

# 3. Khởi chạy toàn bộ Container Stack (App, Postgres, Redis, Tunnel)
docker compose up -d --build

# 4. Kiểm tra trạng thái hoạt động của các container
docker compose ps

# 5. Theo dõi log thời gian thực của ứng dụng
docker compose logs -f app
```

### 5.2 Lệnh Quản Trị Cơ Sở Dữ Liệu PostgreSQL

```bash
# Khởi tạo hoặc cập nhật schema database
docker compose exec app node scripts/run_schema.js

# Kiểm tra tổng số nhân sự đã đồng bộ trong database
docker compose exec postgres psql -U postgres -d thanh_giuse_db -c "SELECT sync_status, COUNT(*) FROM persons GROUP BY sync_status;"
```

---
*Tài liệu kiến trúc chuẩn hóa cho hệ thống **Thành Giuse PC - Postgres-First Architecture**.*

```

---
## 2. CƠ SỞ DỮ LIỆU & FILE SQL

### Schema thực tế từ Container PostgreSQL
```sql
--
-- PostgreSQL database dump
--

\restrict 3zTB5bFy5loJBwoAWboOIcqxg2h4ikqDfnfCJVFQ5zGMHjIBoyUGN6nwdwzKpaN

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    action character varying(100) NOT NULL,
    user_id character varying(100) DEFAULT 'ANONYMOUS'::character varying,
    username character varying(100),
    role character varying(50),
    status_code integer,
    ip_address character varying(50),
    user_agent text,
    target_id character varying(150),
    details jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.classes (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    department_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.classes OWNER TO postgres;

--
-- Name: classes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classes_id_seq OWNER TO postgres;

--
-- Name: classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(10) NOT NULL
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: persons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.persons (
    id integer NOT NULL,
    alias_id character varying(100),
    person_id character varying(100),
    name character varying(255) NOT NULL,
    class_name character varying(100),
    department_id character varying(50),
    title character varying(100) NOT NULL,
    face_url text,
    sync_status character varying(50) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.persons OWNER TO postgres;

--
-- Name: persons_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.persons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.persons_id_seq OWNER TO postgres;

--
-- Name: persons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.persons_id_seq OWNED BY public.persons.id;


--
-- Name: transfer_snapshots; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.transfer_snapshots (
    id bigint NOT NULL,
    batch_id character varying(64) NOT NULL,
    person_id_local bigint NOT NULL,
    from_class character varying(100) NOT NULL,
    to_class character varying(100) NOT NULL,
    old_alias_id character varying(100),
    new_alias_id character varying(100),
    hanet_person_id character varying(64),
    face_url text,
    sync_status character varying(30) DEFAULT 'PENDING'::character varying NOT NULL,
    error_message text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    restored_at timestamp with time zone
);


ALTER TABLE public.transfer_snapshots OWNER TO postgres;

--
-- Name: transfer_snapshots_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.transfer_snapshots_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transfer_snapshots_id_seq OWNER TO postgres;

--
-- Name: transfer_snapshots_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.transfer_snapshots_id_seq OWNED BY public.transfer_snapshots.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: classes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);


--
-- Name: persons id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons ALTER COLUMN id SET DEFAULT nextval('public.persons_id_seq'::regclass);


--
-- Name: transfer_snapshots id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfer_snapshots ALTER COLUMN id SET DEFAULT nextval('public.transfer_snapshots_id_seq'::regclass);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: classes classes_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_name_key UNIQUE (name);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: persons persons_alias_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_alias_id_key UNIQUE (alias_id);


--
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (id);


--
-- Name: transfer_snapshots transfer_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfer_snapshots
    ADD CONSTRAINT transfer_snapshots_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_classes_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_classes_name ON public.classes USING btree (name);


--
-- Name: idx_persons_alias; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_alias ON public.persons USING btree (alias_id);


--
-- Name: idx_persons_name_class; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_name_class ON public.persons USING btree (name, class_name);


--
-- Name: idx_persons_person_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_person_id ON public.persons USING btree (person_id);


--
-- Name: idx_persons_sync_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_sync_status ON public.persons USING btree (sync_status);


--
-- Name: idx_transfer_snapshots_batch; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transfer_snapshots_batch ON public.transfer_snapshots USING btree (batch_id);


--
-- Name: idx_transfer_snapshots_created; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transfer_snapshots_created ON public.transfer_snapshots USING btree (created_at DESC);


--
-- Name: idx_transfer_snapshots_person; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_transfer_snapshots_person ON public.transfer_snapshots USING btree (person_id_local);


--
-- Name: classes classes_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: persons persons_class_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_class_name_fkey FOREIGN KEY (class_name) REFERENCES public.classes(name) ON DELETE SET NULL;


--
-- Name: persons persons_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: transfer_snapshots transfer_snapshots_person_id_local_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.transfer_snapshots
    ADD CONSTRAINT transfer_snapshots_person_id_local_fkey FOREIGN KEY (person_id_local) REFERENCES public.persons(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict 3zTB5bFy5loJBwoAWboOIcqxg2h4ikqDfnfCJVFQ5zGMHjIBoyUGN6nwdwzKpaN

```

### File SQL: `./scripts/init_db_schema.sql`
```sql
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

-- 4. BẢNG NHẬT KÝ HỆ THỐNG (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) DEFAULT 'ANONYMOUS',
    username VARCHAR(100),
    role VARCHAR(50),
    status_code INT,
    ip_address VARCHAR(50),
    user_agent TEXT,
    target_id VARCHAR(150),
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. BỘ CHỈ MỤC TỐI ƯU HÓA TRUY VẤN (Indexes)
CREATE INDEX IF NOT EXISTS idx_persons_alias ON persons(alias_id);
CREATE INDEX IF NOT EXISTS idx_persons_name_class ON persons(name, class_name);
CREATE INDEX IF NOT EXISTS idx_persons_person_id ON persons(person_id);
CREATE INDEX IF NOT EXISTS idx_persons_sync_status ON persons(sync_status);
CREATE INDEX IF NOT EXISTS idx_classes_name ON classes(name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

```

### File SQL: `./database_backup/vps_sync_backup.sql`
```sql
--
-- PostgreSQL database dump
--

\restrict qVjNTS3Ghv3LUVp6pTjhvB1h5IS4EzR9acVsT4WAACATaZDigRka6ROwEvK3buZ

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.persons DROP CONSTRAINT IF EXISTS persons_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.persons DROP CONSTRAINT IF EXISTS persons_class_name_fkey;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_department_id_fkey;
DROP INDEX IF EXISTS public.idx_persons_sync_status;
DROP INDEX IF EXISTS public.idx_persons_person_id;
DROP INDEX IF EXISTS public.idx_persons_name_class;
DROP INDEX IF EXISTS public.idx_persons_alias;
DROP INDEX IF EXISTS public.idx_classes_name;
DROP INDEX IF EXISTS public.idx_audit_logs_created_at;
DROP INDEX IF EXISTS public.idx_audit_logs_action;
ALTER TABLE IF EXISTS ONLY public.persons DROP CONSTRAINT IF EXISTS persons_pkey;
ALTER TABLE IF EXISTS ONLY public.persons DROP CONSTRAINT IF EXISTS persons_alias_id_key;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_pkey;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_code_key;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_pkey;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_name_key;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey;
ALTER TABLE IF EXISTS public.persons ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.classes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.audit_logs ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.persons_id_seq;
DROP TABLE IF EXISTS public.persons;
DROP TABLE IF EXISTS public.departments;
DROP SEQUENCE IF EXISTS public.classes_id_seq;
DROP TABLE IF EXISTS public.classes;
DROP SEQUENCE IF EXISTS public.audit_logs_id_seq;
DROP TABLE IF EXISTS public.audit_logs;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    action character varying(100) NOT NULL,
    user_id character varying(100) DEFAULT 'ANONYMOUS'::character varying,
    username character varying(100),
    role character varying(50),
    status_code integer,
    ip_address character varying(50),
    user_agent text,
    target_id character varying(150),
    details jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.classes (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    department_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.classes OWNER TO postgres;

--
-- Name: classes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classes_id_seq OWNER TO postgres;

--
-- Name: classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(10) NOT NULL
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: persons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.persons (
    id integer NOT NULL,
    alias_id character varying(100),
    person_id character varying(100),
    name character varying(255) NOT NULL,
    class_name character varying(100),
    department_id character varying(50),
    title character varying(100) NOT NULL,
    face_url text,
    sync_status character varying(50) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.persons OWNER TO postgres;

--
-- Name: persons_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.persons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.persons_id_seq OWNER TO postgres;

--
-- Name: persons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.persons_id_seq OWNED BY public.persons.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: classes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);


--
-- Name: persons id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons ALTER COLUMN id SET DEFAULT nextval('public.persons_id_seq'::regclass);


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, action, user_id, username, role, status_code, ip_address, user_agent, target_id, details, created_at) FROM stdin;
1	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	180.148.4.185	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	TN_THEMSUC2C_YB6Z	{"query": {}, "params": {}, "changes": {"name": "ANNA Trần Phương Vy", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_YB6Z", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 05:59:24.483953+00
2	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	180.148.4.185	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	TN_THEMSUC2C_48P3	{"query": {}, "params": {}, "changes": {"name": "ANNA Trần Phương Vy", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_48P3", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 06:00:47.157064+00
3	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2402:800:639e:e220:f858:7ccb:579b:69d8	Mozilla/5.0 (Linux; Android 16; SM-A566B Build/BP2A.250605.031.A3;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.57 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC2C_CC3O	{"query": {}, "params": {}, "changes": {"name": "MARIA Nguyễn Trâm Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_CC3O", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 06:09:20.660158+00
4	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2402:800:639e:e220:f858:7ccb:579b:69d8	Mozilla/5.0 (Linux; Android 16; SM-A566B Build/BP2A.250605.031.A3;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.57 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC2C_HBS2	{"query": {}, "params": {}, "changes": {"name": "MARIA Nguyễn Trâm Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_HBS2", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 06:11:27.181345+00
5	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.173.188.23	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260901802 ZaloTheme/light ZaloLanguage/vn	TN_Chung_EME7	{"query": {}, "params": {}, "changes": {"name": "Urxula Trần Thị Bảo Minh Vào đời 1", "title": "Học Sinh", "aliasID": "TN_Chung_EME7", "className": "VaoDoi_1", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 09:24:06.820561+00
6	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.191.196.44	Mozilla/5.0 (Linux; Android 13; CPH2237 Build/TP1A.220905.001;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC2C_ZYA1	{"query": {}, "params": {}, "changes": {"name": "MARIA Phạm Quỳnh Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_ZYA1", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 10:40:22.995999+00
7	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	45.118.138.93	Mozilla/5.0 (Linux; Android 15; SM-A266B Build/AP3A.240905.015.A2;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC2C_11JA	{"query": {}, "params": {}, "changes": {"name": "PHÊRÔ Lê Nguyễn Gia Huy", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_11JA", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 12:03:15.228575+00
8	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4802:98c3:d940:615d:f89:6505:414b	Mozilla/5.0 (Linux; Android 14; CPH2579 Build/UP1A.230620.001;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC1C_QIBI	{"query": {}, "params": {}, "changes": {"name": "MARIA Nguyễn Trần Lan Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC1C_QIBI", "className": "THEMSUC1C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 13:17:24.255721+00
9	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4802:98c3:d940:615d:f89:6505:414b	Mozilla/5.0 (Linux; Android 14; CPH2579 Build/UP1A.230620.001;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC1C_REIQ	{"query": {}, "params": {}, "changes": {"name": "MARIA Phạm Vân Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC1C_REIQ", "className": "THEMSUC1C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 13:17:58.585617+00
10	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4802:98c3:d940:615d:f89:6505:414b	Mozilla/5.0 (Linux; Android 14; CPH2579 Build/UP1A.230620.001;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC1C_S9S3	{"query": {}, "params": {}, "changes": {"name": "PHÊRÔ Phạm Vũ Huy Khang", "title": "Học Sinh", "aliasID": "TN_THEMSUC1C_S9S3", "className": "THEMSUC1C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 13:18:42.592296+00
11	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.173.188.23	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260901802 ZaloTheme/light ZaloLanguage/vn	TN_Chung_B82P	{"query": {}, "params": {}, "changes": {"name": "Urxula Trần Thị Bảo Minh", "title": "Học Sinh", "aliasID": "TN_Chung_B82P", "className": "VaoDoi_1", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 14:30:03.804205+00
12	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.173.188.23	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260901802 ZaloTheme/light ZaloLanguage/vn	TN_Chung_FKIA	{"query": {}, "params": {}, "changes": {"name": "Urxula_Trần Thị Bảo Minh_vaodoi1_minh_fkey", "title": "Học Sinh", "aliasID": "TN_Chung_FKIA", "className": "VaoDoi_1", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 14:32:32.403501+00
13	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	113.174.15.98	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260901802 ZaloTheme/light ZaloLanguage/vn	TN_BAODONG2A_5B89	{"query": {}, "params": {}, "changes": {"name": "MARIA Hoàng Thị Kim Ngân", "title": "Học Sinh", "aliasID": "TN_BAODONG2A_5B89", "className": "BAODONG2A", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 15:22:19.751025+00
14	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.191.68.22	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260802802 ZaloTheme/light ZaloLanguage/vn	TN_GLV_5CVP	{"query": {}, "params": {}, "changes": {"name": "TÔMA Hoàng Thành Lợi", "title": "Giáo Lý Viên", "aliasID": "TN_GLV_5CVP", "className": "GLV", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-10-01 04:55:39.691773+00
15	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4803:b4e1:eec0:5b1:3e54:7ed9:7f9b	Mozilla/5.0 (Linux; Android 15; 24117RN76O Build/AP3A.240905.015.A2;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.57 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_GLV_PPZD	{"query": {}, "params": {}, "changes": {"name": "Terexa Nguyễn Thị Mỹ Linh", "title": "Giáo Lý Viên", "aliasID": "TN_GLV_PPZD", "className": "GLV", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-10-01 07:00:16.82033+00
16	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4803:b4e1:eec0:5b1:3e54:7ed9:7f9b	Mozilla/5.0 (Linux; Android 15; 24117RN76O Build/AP3A.240905.015.A2;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.57 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_GLV_RIS4	{"query": {}, "params": {}, "changes": {"name": "Terexa Nguyễn Thị Mỹ Linh ", "title": "Giáo Lý Viên", "aliasID": "TN_GLV_RIS4", "className": "GLV", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-10-01 07:01:51.033503+00
17	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2402:800:6388:8e8c:50a1:819e:c35:bc96	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/143.0.0.0 Mobile Safari/537.36	TN_GLV_U77E	{"query": {}, "params": {}, "changes": {"name": "GIOAN Phạm Tiến Chức", "title": "Giáo Lý Viên", "aliasID": "TN_GLV_U77E", "className": "GLV", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-10-01 09:24:08.481923+00
\.


--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.classes (id, name, department_id, created_at) FROM stdin;
1	BAODONG1A	990653	2026-09-30 05:36:03.210476
2	BAODONG1B	990653	2026-09-30 05:36:03.281118
3	BAODONG1C	990653	2026-09-30 05:36:03.33306
4	BAODONG2A	990653	2026-09-30 05:36:03.370024
5	BAODONG2B	990653	2026-09-30 05:36:03.434035
6	BAODONG3	990653	2026-09-30 05:36:03.474686
7	DMHCCC	990730	2026-09-30 05:36:03.549569
8	GLV	990653	2026-09-30 05:36:03.577341
9	KHAITAM1	990653	2026-09-30 05:36:03.666323
10	KHAITAM2	990653	2026-09-30 05:36:03.675684
11	KHAITAM3	990653	2026-09-30 05:36:03.7053
12	THEMSUC1A	990653	2026-09-30 05:36:03.74369
13	THEMSUC1B	990653	2026-09-30 05:36:03.793887
14	THEMSUC1C	990653	2026-09-30 05:36:03.827899
15	THEMSUC2A	990653	2026-09-30 05:36:03.859373
16	THEMSUC2B	990653	2026-09-30 05:36:03.90906
17	THEMSUC2C	990653	2026-09-30 05:36:03.958411
18	THEMSUC3A	990653	2026-09-30 05:36:03.994913
19	THEMSUC3B	990653	2026-09-30 05:36:04.037681
20	THEMSUC3C	990653	2026-09-30 05:36:04.096797
21	VAODOI1	990653	2026-09-30 05:36:04.151386
22	VAODOI2	990653	2026-09-30 05:36:04.19325
23	XUNGTOI1A	990653	2026-09-30 05:36:04.213688
24	XUNGTOI1B	990653	2026-09-30 05:36:04.260115
25	XUNGTOI2A	990653	2026-09-30 05:36:04.302486
26	XUNGTOI2B	990653	2026-09-30 05:36:04.346273
27	XUNGTOI3A	990653	2026-09-30 05:36:04.392903
28	XUNGTOI3B	990653	2026-09-30 05:36:04.450243
29	XUNGTOI3C	990653	2026-09-30 05:36:04.506426
30	THEMSUC	990653	2026-10-01 07:16:07.240949
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, name, code) FROM stdin;
990653	Thiếu Nhi	TN
990730	Legiô Mariae	LM
990731	Giới Trẻ	GT
\.


--
-- Data for Name: persons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.persons (id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, created_at, updated_at) FROM stdin;
1	\N	\N	GIUSE Nguyễn Đình Thiên Ân	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
2	\N	\N	TÊRÊSA Trần Ngọc Quỳnh Anh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
3	\N	\N	MARIA Danh Nguyễn Hoài Anh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
4	\N	\N	TÊRÊSA Đỗ Hà Anh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
5	\N	\N	GIUSE Nguyễn Duy Anh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
6	\N	\N	GIUSE Vũ Xuân Bắc	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
7	\N	\N	GIUSE Nguyễn Bùi Gia Bảo	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
8	\N	\N	ANNA Nguyễn Bảo Châu	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
9	\N	\N	MARIA Nguyễn Khánh Chi	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
10	\N	\N	VINHSƠN Trần Thành Cương	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
11	\N	\N	VINHSƠN Lê Hải Đăng	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
12	\N	\N	MARIA Hoàng Bích Diệp	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
13	\N	\N	PHÊRÔ Mai Nguyên Đức	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
14	\N	\N	GIUSE Trịnh Nam Dương	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
15	\N	\N	MARIA Ngô Gia Hân	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
16	\N	\N	MARIA Trần Thị Hoài	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
17	\N	\N	GIUSE Nguyễn Thế Hoàng	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
18	\N	\N	GIOANB. Hồ Quốc Hưng	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
19	\N	\N	ANTÔN Trần Nhật Huy	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
20	\N	\N	PHAOLÔ Bùi Phúc Khang	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
21	\N	\N	EMMANUEL Nguyễn Bảo Khang	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
22	\N	\N	MICAE Nguyễn Minh Khang	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
23	\N	\N	GIOAN B. Dương Đình Khang	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
24	\N	\N	GIUSE Phạm Đăng Khoa	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
25	\N	\N	PHAOLÔ Nguyễn Trung Kiên	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
26	\N	\N	MARIA Nguyễn Trịnh Nhã Lam	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
27	\N	\N	TÊRÊSA Nguyễn Ngọc Lan	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
28	\N	\N	MARIA Nguyễn Ngọc Lan	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
29	\N	\N	MARIA Nguyễn Uyên Linh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
30	\N	\N	ANNA Trương Ngọc Linh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
31	\N	\N	PHÊRÔ Trình Nguyễn Hoàng Long	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
32	\N	\N	MARIA Nguyễn Khánh Ly	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
33	\N	\N	MARIA Nguyễn Lê Hà My	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
34	\N	\N	MARIA Nguyễn Thị Phương Nam	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
35	\N	\N	MARIA Trần Bảo Nghi	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
36	\N	\N	MARIA Nguyễn Thị Bảo Ngọc	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
37	\N	\N	AUGUSTINÔ Nguyễn Hoàng Nguyên	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
38	\N	\N	MARIA Nguyễn Thanh Trúc	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
39	\N	\N	ANNA Nguyễn Nhật Vy	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
40	\N	\N	ĐAMINH Đinh Hoàng Gia	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
41	\N	\N	ĐAMINH Ngô Gia Hưng	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
42	\N	\N	GIUSE Trần Bảo Lâm	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
43	\N	\N	MARIA Nguyễn My My	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
44	\N	\N	MARIA Trần Ly Na	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
45	\N	\N	GIUSE Trần Bảo Nam	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
46	\N	\N	MARIA Đinh Thanh Ngọc	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
47	\N	\N	GIUSE Trần Đức Nguyên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
48	\N	\N	TÊRÊSA Nguyễn Thị Thiên Nhi	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
49	\N	\N	MARIA Vũ Đàm An Nhiên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
50	\N	\N	PHAOLÔ Nguyễn Vũ Nhật Phong	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
51	\N	\N	MARIA Nguyễn Ngọc Thiên Phúc	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
52	\N	\N	ANNA Trương Thanh Thảo	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
53	\N	\N	MARIA Nguyễn Thị Mai Thi	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
54	\N	\N	MARIA Đinh Thị Anh Thư	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
55	\N	\N	MARIA Tạ Thuỷ Tiên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
56	\N	\N	GIUSE Phan Thành Tiến	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
57	\N	\N	PHÊRÔ Nguyễn Tuấn Toàn	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
58	\N	\N	MARIA Nguyễn Bảo Trâm	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
59	\N	\N	ROSA Ngô Nguyễn Quỳnh Trâm	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
60	\N	\N	MARIA Trần Bảo Trân	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
61	\N	\N	ANNA Trần Nguyễn Bảo Trân	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
62	\N	\N	MARIA Trần Thị Quỳnh Trang	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
63	\N	\N	PHÊRÔ Trần Đình Triết	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
64	\N	\N	MARIA Trần Vũ Kiều Trinh	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
65	\N	\N	MARIA Cao Nguyễn Bảo Trúc	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
66	\N	\N	GIUSE Vũ Trần Đức Trung	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
67	\N	\N	VINHSƠN Nguyễn Đức Trung	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
68	\N	\N	GIUSE Lê Kiến Trung	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
69	\N	\N	BÊNAĐÔ Nguyễn Hoàng Minh Tuấn	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
70	\N	\N	TÊRÊSA Nguyễn Phương Uyên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
71	\N	\N	MARIA Hà Nhã Uyên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
72	\N	\N	PHAOLÔ Nguyễn Công Vinh	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
73	\N	\N	MARIA Vũ Thị Tường Vy	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
74	\N	\N	TÊRÊSA MARIA Phạm Trịnh Trúc Vy	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
75	\N	\N	MARIA Đinh Hoàng Hải Yến	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
76	\N	\N	PHÊRÔ Nguyễn Hoàng Tuấn Anh	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
77	\N	\N	TÊRÊSA Nguyễn Hồng Anh	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
78	\N	\N	Wang Thiên Bội	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
79	\N	\N	MARIA Nguyễn Ngọc Bảo Châu	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
80	\N	\N	GIUSE Nguyễn Tuấn Cường	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
81	\N	\N	PHÊRÔ Nguyễn Hoàng Dương	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
82	\N	\N	ANNA Phạm Nguyễn Gia Hân	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
83	\N	\N	GIUSE Nguyễn Hưng	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
84	\N	\N	GIUSE Lê Gia Hưng	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
85	\N	\N	GIOAN BAOTIXITA Nguyễn Minh Huy	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
86	\N	\N	PHÊRÔ Nguyễn Hoàng Anh Khôi	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
87	\N	\N	GIUSE Phùng Lê Trung Kiên	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
88	\N	\N	ĐAMINH Đoàn Phi Long	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
89	\N	\N	PHÊRÔ Nguyễn Bảo Nam	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
90	\N	\N	MATTA Nguyễn Gia Như	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
91	\N	\N	GIUSE Trần Thanh Phong	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
92	\N	\N	ANRÊ Nguyễn Lê Bá Quốc	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
93	\N	\N	MARIA Huỳnh Nguyễn Ngọc Thảo	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
94	\N	\N	GIUSE Phạm Hoàng Thiên	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
95	\N	\N	TÊRÊSA Phạm Vân Trang	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
96	\N	\N	MARIA Vũ Đoàn Thảo Vy	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
97	\N	\N	TÊRÊSA Nguyễn Hoài An	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
98	\N	\N	ANNA Trần Quỳnh Anh	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
99	\N	\N	GIOAN BOSCO Nguyễn Đình Bách	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
100	\N	\N	ANNA Đỗ Lê Khánh Băng	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
101	\N	\N	ĐAMINH Nguyễn Thanh Bình	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
102	\N	\N	GIUSE Vũ Mạnh Cường	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
103	\N	\N	PHÊRÔ Nguyễn Mạnh Cường	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
104	\N	\N	GIUSE Đỗ Nguyễn Tuấn Đạt	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
105	\N	\N	MARIA Nguyễn Thị Ngọc Diệu	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
106	\N	\N	PHÊRÔ Phạm Hoàng Định	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
107	\N	\N	GIUSE Văn Minh Thiên Đức	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
108	\N	\N	MARIA Nguyễn Ngọc Dung	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
109	\N	\N	GIOAN B. Ngô Mạnh Dũng	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
110	\N	\N	PHÊRÔ Bùi Lê Khánh Duy	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
111	\N	\N	AUGUSTINÔ Nguyễn Minh Hải	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
112	\N	\N	MARIA Phan Vũ Bảo Hân	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
113	\N	\N	LUCA Trần Dương Trọng Hiếu	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
114	\N	\N	VINHSƠN Phạm Gia Hưng	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
115	\N	\N	MARIA Hoàng Thị Thu Hường	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
116	\N	\N	PHÊRÔ Trần Gia Huy	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
117	\N	\N	GIUSE Nguyễn Nhật Huy	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
118	\N	\N	GIUSE Lê Đăng Khoa	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
119	\N	\N	MARIA Đỗ Phan Bảo Linh	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
121	\N	\N	GIUSE Nguyễn Minh Long	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
122	\N	\N	GIUSE Võ Hoàng Long	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
124	\N	\N	LUCIA Lưu Hoàng Bảo Ngọc	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
125	\N	\N	AUGUSTINÔ Nguyễn Nhật Khôi Nguyên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
126	\N	\N	PHÊRÔ Mai Long Nguyên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
127	\N	\N	GIUSE Đào Nguyên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
128	\N	\N	PHÊRÔ Vũ Thành Nhân	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
129	\N	\N	GIUSE Bùi Nguyễn Minh Nhật	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
130	\N	\N	AUGUSTINÔ Lê Đỉnh Thiên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
131	\N	\N	GIUSE Nguyễn Hoàng Thiên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
132	\N	\N	MARIA Phạm Hoài Thương	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
120	\N	\N	MARIA Trần Thị Diệu Linh	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
133	\N	\N	TÊRÊSA Đặng Ngọc Bảo Trâm	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
134	\N	\N	GIUSE Lê Quốc Việt	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
135	\N	\N	MARIA Nguyễn Phương Vy	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
136	\N	\N	GIOAN BAOTIXITA Triệu Trường Vỹ	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
137	\N	\N	TÊRÊSA Phan Thị Vân Anh	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
138	\N	\N	PHANXICÔ Phạm Lê Trung Hiếu	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
139	\N	\N	PHÊRÔ Thái Khải Hoàng	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
140	\N	\N	LUCIA Nguyễn Ngọc Kiên	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
141	\N	\N	ANNA Lê Thanh Kiều Linh	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
142	\N	\N	MARIA Nguyễn Minh Bảo Ngọc	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
143	\N	\N	GIUSE Tống Trần Phúc Nguyên	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
144	\N	\N	ĐAMINH Nguyễn Khôi Nguyên	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
145	\N	\N	MARIA Trần Dương Thảo Nhi	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
146	\N	\N	MARIA Trương Hoàng Yến Nhi	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
147	\N	\N	TÊRÊSA Nguyễn Linh Nhi	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
148	\N	\N	ANTÔN Trịnh Quang Thành Phát	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
149	\N	\N	PHÊRÔ Ngô Phan Lai Phát	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
150	\N	\N	PHÊRÔ Xích Công Thiên Phong	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
151	\N	\N	ANNA Hoàng Nguyễn Mai Phương	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
152	\N	\N	PHAOLÔ Nguyễn Hải Quân	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
153	\N	\N	MARIA Nguyễn Đinh Tú Quỳnh	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
154	\N	\N	GIUSE Nguyễn Huỳnh Khánh Tâm	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
155	\N	\N	PHÊRÔ Nguyễn Hoàng Thiên	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
156	\N	\N	ANNA Hồ Phạm Anh Thư	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
157	\N	\N	MARIA Vũ Thị Thư	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
158	\N	\N	MARIA Nguyễn Ngọc Bảo Trân	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
159	\N	\N	MARIA Trịnh Minh Trang	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
160	\N	\N	GIOAKIM Vũ Thanh Tùng	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
161	\N	\N	PHÊRÔ Nguyễn Hoàng Thiên Vương	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
162	\N	\N	MARIA Phạm Phương Vy	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
163	\N	\N	MARIA Trần Ngọc Khánh Vy	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
164	\N	\N	MARIA Nguyễn Thúy Hà Vy	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
165	\N	\N	MARIA Phạm Hồng Triệu Vy	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
166	\N	\N	PHÊRÔ Nguyễn Khánh An	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
167	\N	\N	MARTINÔ Đinh Đặng Thiên Ân	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
168	\N	\N	TÊRÊXA Nguyễn Hồng Ân	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
169	\N	\N	MARIA Nguyễn Thị Hải Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
170	\N	\N	ANNA Võ Thị Vân Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
171	\N	\N	TÊRÊSA Trần Mỹ Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
172	\N	\N	MARIA Cao Kiều Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
173	\N	\N	ANNA Nguyễn Trâm Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
174	\N	\N	MARIA Lương Tiểu Băng	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
175	\N	\N	GIOAN BAOTIXITA Trần Quốc Bảo	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
176	\N	\N	GIOAN B. Nguyễn Ngọc Thanh Bình	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
177	\N	\N	TÊRÊSA Lê Ngọc Lan Chi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
178	\N	\N	MARIA Tạ Quỳnh Chi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
182	\N	\N	MAĐALÊNA Huỳnh Thị Ngọc Diễm	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
183	\N	\N	PHÊRÔ Nguyễn Huỳnh Đức	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
184	\N	\N	GIUSE Nguyễn Minh Đức	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
185	\N	\N	TÔMA Bùi Minh Đức	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
186	\N	\N	MARIA Nguyễn Thị Thùy Dung	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
187	\N	\N	PHÊRÔ Trần Đức Duy	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
188	\N	\N	PHÊRÔ Nguyễn Ngọc Minh Hoàng	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
189	\N	\N	MARIA Trần Thị Thu Hường	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
190	\N	\N	PHÊRÔ Trần Quang Khải	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
191	\N	\N	GIUSE Nguyễn Phúc Khang	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
192	\N	\N	MARIA Phạm Kim Khanh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
194	\N	\N	MARIA Nguyễn Thị Phương Linh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
195	\N	\N	GIUSE Ngyễn Ngọc Bảo Long	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
196	\N	\N	TÊRÊSA Nguyễn Trần Thảo My	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
197	\N	\N	CLARA Nguyễn Duy Mỹ	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
198	\N	\N	VINHSƠN Trần Uy Nam	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
199	\N	\N	GIUSE Nguyễn Thành Nam	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
179	\N	\N	PHÊRÔ Nguyễn Việt Cường	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
180	\N	\N	MARIA Bùi Ngọc Linh Đan	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
181	\N	\N	SIMON PHAOLÔ Nguyễn Hoàng Đạt	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
200	\N	\N	ISAVE Nguyễn Ngọc Thủy Ngân	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
201	\N	\N	MARIA Phạm Ngọc Gia Ngyên	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
202	\N	\N	MARIA Trần Ngọc Uyên Nhi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
203	\N	\N	MARIA Mai Vũ Ngọc Nhi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
204	\N	\N	MARIA Lê Ngọc Nhi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
205	\N	\N	MARIA Nguyễn Thị Quỳnh Như	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
206	\N	\N	TÊRÊSA Hà Trang Nhung	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
207	\N	\N	GIOAN Hoàng Thiên Phát	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
208	\N	\N	GIUSE Trần Đức Phát	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
209	\N	\N	PHILIPPHÊ Nguyễn Hoàng Minh Phúc	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
210	\N	\N	PHÊRÔ Lê Minh Phúc	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
211	\N	\N	GIUSE MARIA Nguyễn Minh Quân	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
212	\N	\N	GIUSE Trần Hiếu Thảo	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
213	\N	\N	TÊRÊSA Nguyễn Phạm Bảo Thy	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
214	\N	\N	ANNA Phạm Hoàng Thủy Tiên	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
215	\N	\N	MARIA Lê Trần Nguyên Trang	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
216	\N	\N	MARTINÔ Vũ Trần Đức Trí	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
217	\N	\N	ĐAMINH Đinh Phi Trường	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
218	\N	\N	PHÊRÔ Trần Đình Tùng	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
219	\N	\N	MARIA Nguyễn Đoàn Bảo Uyên	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
220	\N	\N	ANTÔN Ngô Công Vinh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
221	\N	\N	PHÊRÔ Nguyễn Phong Vinh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
224	\N	\N	GIUSE Cao Tấn Bình	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
227	\N	\N	MARIA Nguyễn Thị Nha	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
228	\N	\N	MARIA Nguyễn Thị Yến	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
236	\N	\N	MARIA Trịnh Thị Hoa	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
237	\N	\N	GIUSE Nguyễn Thanh Long	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
241	\N	\N	MARIA Trần Thị Duyên	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
242	\N	\N	MARIA Đào Thị Phương Thảo	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
244	\N	\N	PHANXICÔ XAVIÊ Vũ Đoàn Bảo Nguyên	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
246	\N	\N	MARIA Trần Ngọc Uyên	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
248	\N	\N	MARIA Nguyễn Huỳnh Khánh Nguyên	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
249	\N	\N	MARIA Nguyễn Thị Phước	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
251	\N	\N	MARIA Nguyễn Thị Thu Ngọc	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
254	\N	\N	GIUSE Phạm Tiến Chức	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
261	\N	\N	MADALENA Huỳnh Thị Ngọc Vy	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
264	\N	\N	LUCA Đỗ Đức Trọng	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
266	\N	\N	GIOAN Trần Văn Phương	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
268	\N	\N	ANTÔN Trần Nguyễn Xuân Lộc	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
269	\N	\N	MARIA Nguyễn Thị Xuyến	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
274	\N	\N	GIUSE Nguyễn Duy Pháp	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
276	\N	\N	ĐAMINH Trương Quang Chung	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
285	\N	\N	CELESTINÔ Nguyễn Quốc Bảo	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
286	\N	\N	LUI Lê Anh Minh	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
223	TN_BAODONG3_38U1	3328995786624073728	Phê Rô Trần Đình Tùng	BAODONG3	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/4c51fa70-2381-4e94-a7a0-4dfe678795a7.jpg	SYNCED	2026-09-30 05:36:03.474686	2026-10-01 09:11:40.371516
225	LM_DMHCCC_WMGW	3326007309951303680	ANNA Trần Thị Quy	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/fbcb46e2-8fd0-4e58-9174-6f8f7546e0a9.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.614804
230	LM_DMHCCC_4KZ3	3326385095140442112	MARIA Trần Thị Ngát	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/b56368cf-61fe-439a-8585-1c59d79161ce.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.622023
231	LM_DMHCCC_PJL6	3326392862773346304	MARIA Phạm Thị Mai	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/3433efb9-e8d3-4095-9ee1-243e36ae4dd2.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.631018
229	LM_DMHCCC_9QHS	3327100769005469696	MARIA Vũ Thị Ngát	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/d457eee4-ee79-451c-9195-204186e34c51.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.63708
226	LM_DMHCCC_T83U	3329347380171505664	CATARINA Nguyễn Thị Hương Giang	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/92f91378-79ed-427b-9386-645accc65084.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.652366
289	\N	\N	GIUSE Võ Hồng Em	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
291	\N	\N	TERESA Nguyễn Thị Mỹ Linh	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
292	\N	\N	Phan Tuấn Anh	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
997	TN_GLV_4ZLV	3318421576143077376	PHANXICÔ XAVIÊ Trần Nhật Minh Tân	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/a0a95749-5ba9-4cc8-b0f2-9402259fc24e.jpg	SYNCED	2026-10-01 09:11:40.089368	2026-10-01 09:11:40.089368
233	\N	\N	GIUSE Cao Tấn Lộc	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
234	\N	\N	MARIA Nguyễn Thị Thê	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
235	\N	\N	LUCA Đỗ Ngọc Lâm	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
293	\N	\N	Nguyễn Trần Gia Bảo	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
294	\N	\N	Nguyễn Văn Đoàn	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
295	\N	\N	Phùng Văn Đức	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
296	\N	\N	Nguyễn Trí Hào	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
297	\N	\N	Nguyễn Đức Hùng	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
298	\N	\N	Nguyễn Mạnh Hùng	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
299	\N	\N	Phạm Đức Lượng	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
301	\N	\N	Đoàn Thanh Nhàn	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
302	\N	\N	Trần Ngọc Thảo Nhi	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
303	\N	\N	Nguyễn Văn Quang	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
304	\N	\N	Nguyễn Thị Mỹ Tâm	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
305	\N	\N	Trần Danh Thái	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
312	\N	\N	GIUSE Đoàn Gia Phú	KHAITAM1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.666323	2026-10-01 09:08:34.181219
313	\N	\N	MARIA Lý San San	KHAITAM1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.666323	2026-10-01 09:08:34.181219
314	\N	\N	MARIA Lê Nguyễn Thiên An	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
315	\N	\N	MARIA Nguyễn Huỳnh Khánh An	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
316	\N	\N	MARIA Nguyễn Linh Anh	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
317	\N	\N	GIOAN BAPTIST Nguyễn Kim Bảo	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
243	TN_GLV_ACIP	3318330549059190784	TERESA MARIA Nguyễn Thị Cương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/3bd097a7-242c-493b-951f-1bd18456796d.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.060312
275	TN_GLV_YFH0	3318416787397148672	MARIA Nguyễn Thị Thể	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/8b5bf3ee-9a01-4c97-ab23-4b320c41d082.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.074402
253	TN_GLV_ESNY	3318418277750800384	MARIA Hoàng Anh Thư	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/c91d682f-433a-4ea4-bf94-901b2d0d32c4.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.079724
256	TN_GLV_7A8J	3318422336469729280	GIUSE Phan Chính Hướng	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/7dec3b3a-cab6-467f-a738-9c7be17c052c.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.096999
240	TN_GLV_YNCN	3318424907527749632	TERESA Phùng Thị Tuyền	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/4a387268-102f-409f-8671-59dec16d0114.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.101442
247	TN_GLV_XY0C	3318450257800462336	MARIA Trần Ngọc Mai Phương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/81207a82-01ab-4fab-b769-30b086b9df2b.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.110024
267	TN_GLV_BKBJ	3318791672199905280	TERESA Nguyễn Thị Kiều	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/ba85fe6c-2738-4028-ab04-08749683ba06.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.116251
255	TN_GLV_B9RH	3319007037530046464	MATTA Phùng Nguyên Phương Nhi	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/d3382c28-8248-4e6c-95ed-601b91431f4a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.136391
252	TN_GLV_7O99	3319095003652816896	PHANXICÔ XAVIÊ Trần Nhật Minh Tân	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/ab8ef4f2-5b03-48bc-a596-c69353cb4981.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.141605
272	TN_GLV_EJKS	3319980022374072320	ĐA MINH Bùi Tấn Đạt	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/62667b8a-96a1-40d8-9cad-bf39009c7d77.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.156323
273	TN_GLV_FK2S	3320464283921285120	LUCIA Lê Thanh Minh Phương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/e30f9dcc-9bd5-4cd3-b134-4e901ea7903c.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.161374
265	TN_GLV_KBKT	3320466582416654336	ANNA Nguyễn Thị Lan Hương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/7e2e274a-4c48-4c37-9c06-08d55453256f.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.171834
257	TN_GLV_3QAP	3320468870753419264	MARIA Nguyễn Thị Thanh Tuyền	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/14e63f76-e062-4a8b-9120-8dd6215f4ea8.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.177193
262	TN_GLV_J7JL	3320489451355897856	PHÊRÔ Nguyễn Hoàng Anh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/81a35420-93a0-4802-8ef0-15b85a51600a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.188294
270	TN_GLV_0QFY	3318308764574023680	MARIA Nguyễn Huỳnh Khánh Uyên	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/73f97198-3d23-4a61-9cfe-5a30f20a0add.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.051407
258	TN_GLV_00PD	3319789794514436096	MARIA Phan Thị Hằng	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/4a0c5f80-6ae1-4ce8-9236-cc46a7056167.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.150904
250	TN_GLV_VVRL	3320492381521838080	TERESA Nguyễn Triệu Mỹ	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/1a252637-dde1-4e0f-b68f-7a1eedfa327d.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.193949
245	TN_GLV_RTTN	3323503762542166016	MARIA Nguyễn Thị Ngọc Linh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/56e2316b-3c17-4caa-a3b2-d0ed562d84e9.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.211565
260	TN_GLV_Z9C0	3323957150899765248	MARIA Nguyễn Thị Nam	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/0e72749c-d6a8-4a6e-abe3-6455ee28a97b.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.217294
263	TN_GLV_9FBU	3323957550256226304	MARIA Phạm Thị Thực	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/703f7b5b-4b1e-4dde-811f-448173c7dd83.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.223722
238	LM_DMHCCC_I2SG	3325595360948125696	MARIA Nguyễn Thị Thật	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/4514121a-3f94-4049-beec-5ebc3b7eca19.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.608514
239	LM_DMHCCC_GWQI	3330804726420733952	Bà Chiến Lêgio	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/f38b6769-adb8-4e66-b63c-ade569ebbf75.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.664097
277	\N	\N	GIUSE Nguyễn Chí Phú	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
280	\N	\N	GIOAN BAOTIXITA Vũ Hồng Ân	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
283	\N	\N	PHÊRÔ Trần Đình Thái	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
318	\N	\N	MARIA Nguyễn Thị Lan Chi	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
319	\N	\N	ANNA Lê Ngọc linh Đan	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
320	\N	\N	MARIA Bùi Ngọc Diệp	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
321	\N	\N	GIUSE Nguyễn Tiến Dũng	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
322	\N	\N	MARIA Nguyễn Đăng Minh Hằng	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
323	\N	\N	PHANXICÔ XAVIÊ Nguyễn Phú Gia Khiêm	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
324	\N	\N	Lý Anh Khôi	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
325	\N	\N	MARIA Thái Trúc Lâm	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
326	\N	\N	TÊRÊSA Đặng Trúc Nghi	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
327	\N	\N	MARIA Trần Vũ Bảo Ngọc	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
328	\N	\N	MARIA Nguyễn Huỳnh Mỹ Ngọc	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
331	\N	\N	MARIA Nguyễn Huỳnh Bảo Như	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
332	\N	\N	TÊRÊSA Nguyễn Ngọc Quỳnh Như	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
333	\N	\N	MARIA Nguyễn Đỗ Quyên	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
334	\N	\N	MAĐALÊNA Trần Thị Lan Thanh	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
335	\N	\N	MARIA Nguyễn Ngọc Khánh An	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
336	\N	\N	GIUSE Phạm Thiên Ân	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
337	\N	\N	ANTÔN Nguyễn Trần Đức Ân	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
338	\N	\N	TÊRÊSA Ngô Ngọc Anh	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
339	\N	\N	Nguyễn Ngọc Trâm Anh	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
340	\N	\N	GIOAN B. Nguyễn Hoàng Thiên Bảo	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
341	\N	\N	GIUSE Phùng Lê An Bình	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
342	\N	\N	GIUSE Nguyễn Tiến Dũng	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
344	\N	\N	MARIA Bùi Gia Hân	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
345	\N	\N	MARIA Võ Xuân Hạnh	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
346	\N	\N	GIUSE Lê Quốc Vũ Hoàng	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
347	\N	\N	MARIA Phùng Ngọc Khánh Huyền	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
348	\N	\N	GIUSE Đoàn Nguyên Khang	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
349	\N	\N	PHÊRÔ Lê Trần Duy Khang	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
350	\N	\N	GIOAN B. Trần Minh Khang	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
351	\N	\N	PHÊRÔ Nguyễn Xuân Hoàng Khôi	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
352	\N	\N	MARIA Lưu Hoàng Kim	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
353	\N	\N	MARIA Thái Trúc Lâm	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
354	\N	\N	ANNA Nguyễn Kim Ngọc	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
355	\N	\N	Bùi Nguyễn Trọng Phát	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
288	TN_GLV_8CQW	3318875957460205568	GIOAKIM Nguyễn Tâm Tỉnh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/9a4d7d0c-c7f1-4f62-b4cb-c947ba137ee0.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.126176
278	TN_GLV_MPFD	3318895424332365824	MARIA Nguyễn Thị Vy	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/900d36f1-8bec-4d7d-8fc5-0d51a7e57ee8.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.131171
284	TN_GLV_WTMA	3319107475684196352	GIOAN BAOTIXITA Võ Quốc Sang	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/9e88624a-81a8-49a2-8b8f-c23747fe7f85.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.145992
287	TN_GLV_IYPD	3320465446548799488	MARIA Nguyễn Mỹ Lệ	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/6daba4e8-c073-420c-8615-08868ada425a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.166163
308	TN_GLV_1BTM	3320474344940896256	Vinh sơn Nguyễn Văn Quang	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/2ed354eb-ca50-48af-9a35-5e14040084a9.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.182392
281	TN_GLV_UUYD	3320555706267992064	GIUSE Nguyễn Văn Phương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/cdc3cc55-0c92-4f6a-8a05-8960d747eeb4.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.200682
307	TN_GLV_GAG3	3318869643774394368	Vinh Sơn Nguyễn Văn Đoàn	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/cd67259c-b6a8-4058-a78b-c84ccefd2853.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.121096
310	TN_GLV_8OXZ	3323973694744690688	JB Vũ Hồng Ân	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/702e92ab-a8d8-4cfc-a4b6-70045d17da58.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.238019
309	GLV_70	3320489451355897856	Phê-rô Nguyễn Hoàng Anh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/81a35420-93a0-4802-8ef0-15b85a51600a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 07:16:06.972659
311	TN_GLV_5Z9D	3324074415100002304	Luy Lê Anh Minh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/875c4eff-95d2-4cb6-9da8-f3b3175f3770.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.243561
290	TN_GLV_7P8S	3326851047594393600	AUGUSTINÔ Đặng Hùng	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/69752799-7b60-4026-bcdf-7a53890af636.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.274321
306	TN_GLV_68RW	3329800250893271040	GIUSE Nguyễn Thanh Long	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/e21af251-ac85-4257-9e79-6dcec638d25a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.515011
279	TN_GLV_LAQI	3331088036556439552	PHÊRÔ Hoàng Văn Nam	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/88559e00-e3eb-4f3b-be4b-6676009da112.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.537818
329	\N	\N	GIUSE Nguyễn Hải Nguyên	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
330	\N	\N	PHÊRÔ Trần Thành Nhân	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
356	\N	\N	Wang Thiệu Phong	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
357	\N	\N	GIOAN B. Võ Hoàng Phúc	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
358	\N	\N	MARIA Nguyễn Thị Phương Thảo	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
359	\N	\N	MARIA Lâm Nguyễn Ngọc Thảo	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
360	\N	\N	MARIA Bùi Anh Thư	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
361	\N	\N	PHÊRÔ Nguyễn Phú Tịnh	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
362	\N	\N	MARIA Trần Lê Hoàng Yến	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
368	\N	\N	PHANXICÔ Phạm Gia Bảo	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
370	\N	\N	MARIA Ngô Lệ Lan Chi	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
373	\N	\N	MARIA Phạm Ngọc Diệp	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
374	\N	\N	GIUSE Lê Nguyễn Minh Đức	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
378	\N	\N	EMMANUEL Lê Hạo	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
391	\N	\N	MARIA Lê Ngọc An Nhiên	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
394	\N	\N	ANRÊ Nguyễn Lê Bá Quốc	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
395	\N	\N	GIUSE Mai Phúc Thịnh	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
396	\N	\N	MARIA Đặng Trần Giáng Tiên	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
400	\N	\N	RAPHAEL Lê Ngọc Huyền Chân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
401	\N	\N	GIUSE Nguyễn Tiến Dũng	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
402	\N	\N	LUCIA Huỳnh Thị Ngọc Hân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
403	\N	\N	PHÊRÔ Lê Anh Khoa	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
404	\N	\N	PHANXICÔ Dương Minh Khôi	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
405	\N	\N	MONICA Đinh Tuệ Lâm	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
406	\N	\N	MARIA Nguyễn Thùy Linh	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
407	\N	\N	PHANXICÔ Nguyễn Thiên Lộc	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
408	\N	\N	ĐAMINH Nguyễn Minh Long	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
409	\N	\N	ANNA Nguyễn Hoàng My	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
410	\N	\N	MARIA Trần Ngọc Khánh Ngân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
411	\N	\N	MARIA Trần Thị Phương Nghi	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
412	\N	\N	MARIA Nguyễn Khánh Ngọc	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
413	\N	\N	MARIA Lã Hà Gia Nguyên	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
414	\N	\N	TÊRÊSA Nguyễn Lường Yến Nhi	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
415	\N	\N	PHÊRÔ Nguyễn Gia Phúc	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
416	\N	\N	PHAOLÔ Đặng Ngọc Minh Quân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
417	\N	\N	GIUSE Nguyễn Trần Nhật Quân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
418	\N	\N	MARIA Trần Bảo Quyên	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
419	\N	\N	TÔMA Nguyễn Phú Tài	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
420	\N	\N	GIUSE Nguyễn Quốc Thái	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
377	TN_THEMSUC1A_0S88	3328966772257718272	MARIA Phạm Trương Gia Hân	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/4fdd67df-d521-44be-adb0-8d615c15a9a9.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.319335
376	TN_THEMSUC1A_2EX4	3328995363662069760	MARIA TÊRÊSA Trần Thanh Hà	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ca805157-4cf7-4e58-96de-2df35f89c1e4.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.353809
366	TN_THEMSUC1A_2ZO3	3328995570265096192	MARIA Trương Quỳnh Anh	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/f4b3d4af-7f40-4a33-8223-1fbb3af3f83a.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.365749
375	TN_THEMSUC1A_3QYP	3328995874310193152	TÊRÊSA Nguyễn Thị Thu Hà	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/1cce40e3-a9e7-41bf-b124-09cbccfc4073.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.376784
372	TN_THEMSUC1A_6CUJ	3328996891386970112	PHÊRÔ Bạch Công Đăng	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/f56db1c3-e74e-4077-81e2-658e7af7c265.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.39856
371	TN_THEMSUC1A_AEVZ	3328998513097834496	MARIA Trần Linh Đan	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/0887a289-aef9-474d-be5a-9c09a91810a6.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.433062
367	TN_THEMSUC1A_AUYC	3328998667473387520	MARIA Trần Ngọc Ánh	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/becfddd0-fc84-4f9e-baa9-fe4ff875e92e.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.438332
379	TN_THEMSUC1A_BHCP	3328998914064908288	PHANXICÔ Đinh Vũ Minh Hiếu	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/3ac0aaf5-1624-41f8-b115-94759f326221.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.449811
363	TN_THEMSUC1A_EP29	3329000175828992000	GIUSE Trần Nam An	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/87ad8952-ba8f-4f2e-b4c8-c93169b0cf86.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.474185
343	TN_KHAITAM3_QD6D	3329146302435950592	GIOAN B. Trần Thiên Duy	KHAITAM3	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/caeaf0ca-35df-4348-97bb-b247e90e6c55.jpg	SYNCED	2026-09-30 05:36:03.7053	2026-10-01 09:11:40.48176
421	\N	\N	MARIA Nguyễn Võ Xuân Thảo	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
422	\N	\N	GIUSE Hoàng Chí Thiện	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
365	TN_THEMSUC1A_0QA6	3326358193973493760	Nguyễn Ngọc Thuỳ Anh	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/f97bb99d-750f-443a-a9c3-a8e7648dff7c.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.259881
386	\N	\N	MATTA Nguyễn Thị Ngọc Mai	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
387	\N	\N	MARIA Nguyễn Phan Diễm My	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
388	\N	\N	MARIA Đoàn Vũ Ánh Ngọc	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
423	\N	\N	MARIA Nguyễn Hoàng Anh Thư	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
424	\N	\N	GIUSE Nguyễn Minh Trí	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
425	\N	\N	MARIA Lê Nhã Trúc	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
426	\N	\N	INHAXIÔ Võ Đặng Khánh Tường	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
435	\N	\N	MARIA Lý Gia Hân	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
436	\N	\N	AUGUSTINÔ Nguyễn Minh Khang	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
437	\N	\N	PHÊRÔ Nguyễn Trịnh Tuấn Khang	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
440	\N	\N	TÊRÊSA Nguyễn Thị Trà My	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
441	\N	\N	GIUSE Nguyễn Gia Nguyên	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
442	\N	\N	GIUSE Nguyễn Khôi Nguyên	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
444	\N	\N	GIUSE Đỗ Gia Phúc	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
446	\N	\N	VINHSƠN Phạm Hoàng Quân	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
447	\N	\N	MARIA Ngô Như Quỳnh	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
449	\N	\N	TÊRÊSA Lê Ngọc Khả Ái	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
450	\N	\N	GIUSE Nguyễn Quốc An	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
451	\N	\N	ROSA Thẩm Phẩm Anh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
452	\N	\N	MARIA Võ Quỳnh Anh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
453	\N	\N	MARIA Ngô Ngọc Ánh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
454	\N	\N	GIOAN B. Sơn Gia Bảo	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
455	\N	\N	GIUSE Lê Huy Bảo	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
456	\N	\N	PHANXICÔ Nguyễn Gia Bảo	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
457	\N	\N	MARIA Phan Mai Ca	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
458	\N	\N	MARIA Nguyễn Minh Châu	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
459	\N	\N	CATARINA Huỳnh Khiết Đan	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
460	\N	\N	GIUSE Nguyễn Bạch Hải Đăng	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
461	\N	\N	MARIA Đoàn Gia Di	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
462	\N	\N	ANTÔN Hoàng Minh Đức	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
463	\N	\N	PHÊRÔ Dương Thái Duy	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
464	\N	\N	MARIA Phạm Nguyễn Gia Hân	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
465	\N	\N	MICAE Nguyễn Trung Hiếu	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
466	\N	\N	GIOAN Nguyễn Minh Hiếu	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
467	\N	\N	PHÊRÔ Lê Đăng Khoa	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
468	\N	\N	GIOAN PHAOLÔ II Phạm Anh Minh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
398	TN_THEMSUC1A_4GVC	3328996152241553408	PHAOLÔ Nguyễn Minh Trí	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/520fc538-b9f0-4176-b6a2-899d0960aa12.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.382002
381	TN_THEMSUC1A_53TY	3328996438259531776	TÔMA Trần Văn Hưng	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/0178b03b-1aab-4b78-8b8a-735cd961877a.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.387525
399	TN_THEMSUC1A_72AM	3328997169871978496	MATTA Lê Phương Uyên	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/685b21e5-c202-477c-81a2-0a39659fc0d8.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.403885
384	TN_THEMSUC1A_7JYJ	3328997362793185280	RAPHAEL Phạm Thế Khang	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/f2a4cf57-e82a-457f-85fa-bb15026c97aa.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.410363
389	TN_THEMSUC1A_87RS	3328997618746392576	ANNA Trương Ngọc Thảo Nguyên	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/824e7051-67d9-4176-ab2a-b66911167694.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.416258
390	TN_THEMSUC1A_8XI8	3328997893875957760	ANNA THÀNH Nguyễn Thị Tuyết Nhi	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/b5730630-e9a8-413c-97f5-9361a45f76a4.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.42125
397	TN_THEMSUC1A_9S71	3328998250257580032	MARIA Vũ Bảo Trân	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/22c68b7a-a3d6-492f-8926-bbd94bcd6914.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.42689
380	TN_THEMSUC1A_C0TL	3328999120072343552	PHAOLÔ Lê Đức Hòa	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/a3197833-e794-4edb-b420-765ab3b4027d.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.455643
385	TN_THEMSUC1A_CJT5	3328999320048369664	ANNA Thái Thị Trúc Linh	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/66e5b08b-4a99-4129-b742-3ec43dac385e.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.461165
393	TN_THEMSUC1A_D9U6	3328999597837123584	MARIA Lê Như	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/9198f391-40cb-495d-8602-7121923b1a50.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.467371
427	TN_THEMSUC_1C_YZBW	3329769151831998464	TÊRÊSA Nguyễn Đỗ Hoài An	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/644880c0-f738-4f56-9486-2a3be167a52e.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.509205
428	TN_THEMSUC_1C_PG82	3330371052592168960	MARIA Phạm Nguyễn Hà Anh	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/9bb28e83-a45f-4685-8639-21554def3fb0.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.521239
469	\N	\N	ĐAMINH Nguyễn Hải Nam	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
470	\N	\N	MARIA Phạm Yến Nhi	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
392	TN_THEMSUC1A_JR1Q	3328959937563852800	MAĐALÊNA Lâm Ngọc An Nhiên	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/7b42fbff-35e7-4716-95be-fa2f6bc83b41.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.307114
431	\N	\N	TÔMASÔ Trần Hoàng Gia Bảo	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
432	\N	\N	MARIA Đặng Phương Mỹ Chi	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
433	\N	\N	TÊRÊSA Trần Ngọc Lan Chi	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
471	\N	\N	MARIA Mai Vũ Uyên Nhi	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
472	\N	\N	MARIA Trần Tú Nhi	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
473	\N	\N	LUCIA Phạm Thị Quỳnh Như	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
474	\N	\N	VINHSƠN Phạm Hồng Thiên Phát	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
475	\N	\N	PHANXICÔ Kiều Phong	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
476	\N	\N	PHÊRÔ Xích Công Thiện Phú	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
477	\N	\N	MICAE Phan Nguyễn Tiến Quốc	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
478	\N	\N	TÊRÊSA Trịnh Bùi Gia Quỳnh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
479	\N	\N	TÊRÊSA Đỗ Diễm Quỳnh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
480	\N	\N	MARIA Huỳnh Thị Tiết Sương	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
481	\N	\N	PHÊRÔ Phạm Hoàng Tấn	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
482	\N	\N	ANNA Trần Thị Anh Thơ	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
483	\N	\N	TÊRÊSA Hà Huỳnh Cát Tiên	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
484	\N	\N	TÊRÊSA Nguyễn Bảo Trâm	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
489	\N	\N	MARIA Phạm Thảo An	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
490	\N	\N	MARIA Đặng Nguyễn Diệu Anh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
491	\N	\N	MARIA Nguyễn Ngọc Anh Anh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
492	\N	\N	GIÊRAĐÔ Phạm Bảo Anh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
493	\N	\N	PHÊRÔ Nguyễn Trung Gia Bảo	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
494	\N	\N	GIUSE Trần Thanh Gia Bảo	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
495	\N	\N	PHAOLÔ Phạm Thành Công	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
496	\N	\N	MICAE Nguyễn Trung Hiếu	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
497	\N	\N	TÔMA Nguyễn Trần Thái Hòa	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
499	\N	\N	GIOAN B. Ngô Mạnh Hùng	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
500	\N	\N	ANTÔN Vũ Mạnh Hùng	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
501	\N	\N	PHÊRÔ Trần Gia Hưng	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
502	\N	\N	ĐAMINH Lại Trần Quốc Huy	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
503	\N	\N	GIUSE Nguyễn Duy Khang	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
504	\N	\N	ĐAMINH Đinh Gia Khiêm	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
505	\N	\N	PHAOLÔ Nguyễn Bảo Khôi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
506	\N	\N	TÔMA Trần Nguyên Khôi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
507	\N	\N	ANTÔN Trương Trung Kiên	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
508	\N	\N	MARIA Bùi Nguyễn Nhật Lam	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
509	\N	\N	ANNA Nguyễn Lê Nhật Linh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
510	\N	\N	MICAE Nguyễn Uy Long	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
511	\N	\N	TÊRÊSA Đỗ Hà Uyên Minh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
512	\N	\N	MARIA Trần Phạm Khánh My	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
513	\N	\N	TÊRÊSA Lê Hoàng Thảo Nghi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
514	\N	\N	MARIA Trần Bảo Ngọc	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
515	\N	\N	MARIA Nguyễn Bảo Ngọc	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
516	\N	\N	MARIA Tạ Quỳnh Ngọc	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
517	\N	\N	MARIA Vũ Bảo Ngọc	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
518	\N	\N	ANNA Phan Ngọc Yến Nhi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
519	\N	\N	MARIA Trần Ngọc Trúc Như	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
520	\N	\N	PHÊRÔ Nguyễn Thanh Gia Phú	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
521	\N	\N	TÊRÊSA Phạm Vũ Minh Tâm	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
522	\N	\N	GIOAN B. Nguyễn Ngọc Minh Thắng	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
523	\N	\N	ĐAMINH Nguyễn Minh Thiện	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
434	TN_THEMSUC1C_4CFF	3328897607052296192	PHANXICÔ Vũ Minh Đăng	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/277583f7-2abc-4e26-85c8-f0fd7182cdf7.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.284887
439	TN_THEMSUC1C_5MST	3328898065976262656	MARIA Vũ Thị Trà My	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/2a5f3644-430a-4d0d-b4c3-70ac8bd9aea7.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.290734
443	TN_THEMSUC1C_7PX6	3328898956250841088	MARIA Trương Trần Tuyết Nhi	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ac1b83b7-c0d0-4d33-adbb-de4ea33c4129.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.296374
445	TN_THEMSUC1C_8IK9	3328899345977180160	MICAE Phan Vũ Minh Quân	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/e7f75a8c-cf85-47ef-8524-1391b616d98c.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.301708
524	\N	\N	ANPHONGSÔ Đỗ Phạm Quốc Thịnh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
525	\N	\N	TÊRÊSA Hà Huỳnh Cát Tiên	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
448	TN_THEMSUC1C_YUAS	3326985968413573120	PHANXICÔ XAVIÊ Trần Hoàng Việt	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/9024dacd-c482-4263-bd08-6a4f550441ce.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.279737
485	\N	\N	MARIA Trần Thị Tuyết	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
486	\N	\N	MATTA Lê Nhã Uyên	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
487	\N	\N	TÊRÊSA Trần Ngọc Lan Vy	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
488	\N	\N	MATTA Bùi Ngọc Hoàng Yến	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
526	\N	\N	ANTÔN Trương Chính Trực	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
527	\N	\N	GIUSE Mai Anh Tuấn	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
528	\N	\N	MARIA Lê Thị Thảo Vi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
529	\N	\N	ANNA Trần Hải Yến	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
530	\N	\N	ANTÔN Nguyễn Minh Thiên Ân	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
531	\N	\N	LUCIA Trương Nguyễn Hồng Ân	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
532	\N	\N	MARIA Trần Đoàn Phương Anh	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
534	\N	\N	MARIA Nguyễn Trâm Anh	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
535	\N	\N	PHANXICÔ XAVIÊ Phạm Gia Bảo	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
536	\N	\N	TÔMASÔ Trần Gia Bảo	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
538	\N	\N	PHÊRÔ Nguyễn Trung Hiếu	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
539	\N	\N	GIUSE Hoàng Công Hiếu	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
540	\N	\N	ĐAMINH Đỗ Chí Hưng	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
542	\N	\N	GIUSE Phan Quốc Huy	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
544	\N	\N	MARIA Nguyễn Thị Mỹ Huyền	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
545	\N	\N	GIUSE Trương Tuấn Khang	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
546	\N	\N	MARIA Nguyễn Vũ Khánh Ngọc	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
547	\N	\N	MARIA Nguyễn Thị Minh Nguyệt	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
548	\N	\N	GIUSE Đào Quốc Phát	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
549	\N	\N	PHAOLÔ Nguyễn Hoàng Phi	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
550	\N	\N	MARIA Hoàng Anh Thư	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
551	\N	\N	TÔMASÔ Đặng Phúc Vinh	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
552	\N	\N	MICAE Trần Thái Vũ	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
553	\N	\N	ANNA Trần Phương Vy	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
554	\N	\N	TÊRÊSA Bùi Lê Khánh Vy	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
555	\N	\N	MATTA Nguyễn Như Ý	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
556	\N	\N	MARIA Nguyễn Hải Yến	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
557	\N	\N	GIOAN Nguyễn Phúc An	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
558	\N	\N	MARIA Nguyễn Bảo Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
559	\N	\N	TÊRÊSA Phạm Ngọc Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
560	\N	\N	MARIA Nguyễn Ngọc Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
561	\N	\N	MARIA Nguyễn Lê Ngọc Minh Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
562	\N	\N	MARIA Nguyễn Thị Minh Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
563	\N	\N	MARIA Nguyễn Lê Đông Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
564	\N	\N	LUCA Hồ Tuấn Bảo	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
565	\N	\N	PHANXICÔ XAVIÊ Trần Gia Bảo	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
566	\N	\N	GIUSE Vũ Gia Bảo	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
567	\N	\N	MARIA Nguyễn Phạm Thiên Ân (tâm Bình)	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
568	\N	\N	MARIA Nguyễn Phạm Thiên Ân (như Bình)	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
569	\N	\N	GIUSE Phạm Đức Cường	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
570	\N	\N	GIUSE Nguyễn Thành Đạt	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
571	\N	\N	GIOAN B. Trần Tứ Đức	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
572	\N	\N	GIUSE Nguyễn Phùng Thiên Đức	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
573	\N	\N	PHÊRÔ Mai Nguyên Đức	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
574	\N	\N	MARIA Tống Hồng Ngọc Hà	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
575	\N	\N	PHÊRÔ Nguyễn Nhật Huy	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
576	\N	\N	MAĐALÊNA Phan Hoàng An Huyên	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
577	\N	\N	GIOAN Lê Nguyễn An Khang	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
578	\N	\N	GIOAN Phạm Trí Khang	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
579	\N	\N	GIUSE Nguyễn Đăng Khoa	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
580	\N	\N	GIOAN Trần Nguyên Khôi	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
581	\N	\N	PHAOLÔ Bùi Quán Kiệt	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
582	\N	\N	MARIA Huỳnh Phương Linh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
583	\N	\N	MARIA Nguyễn Ngọc Gia Linh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
584	\N	\N	MARIA Phạm Hoài Linh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
369	TN_THEMSUC1A_NB6E	3328961743941533696	PHÊRÔ Bùi Bối Bối	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/dec33767-7baf-4675-a784-df164b18720c.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.312815
222	TN_BAODONG3_02BA	3328995387393441792	Vicente Trần Uy Nam	BAODONG3	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/d8c06290-adbc-49ae-bc48-b363ac1eabc5.jpg	SYNCED	2026-09-30 05:36:03.474686	2026-10-01 09:11:40.359825
585	\N	\N	GIUSE Trương Thế Lộc	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
586	\N	\N	VINHSƠN Phạm Nguyễn Gia Minh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
587	\N	\N	PHAOLÔ Nguyễn Công Minh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
588	\N	\N	TÊRÊSA Trần Dương Trà My	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
589	\N	\N	MARIA Lý Nguyễn Kim Ngân	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
590	\N	\N	TÊRÊSA Nguyễn Khánh Ngọc	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
591	\N	\N	MAĐALÊNA Nguyễn Thái Bảo Ngọc	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
592	\N	\N	MARIA Trương Phương Nhi	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
593	\N	\N	ANNA Nguyễn Hoàng Minh Thư	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
594	\N	\N	TÊRÊSA Huỳnh Nữ Ngọc Tiên	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
595	\N	\N	MARIA Đinh Ngọc Nhã Uyên	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
596	\N	\N	MARIA Phạm Ngọc Như ý	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
597	\N	\N	MARIA Nguyễn Lê Đông Anh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
598	\N	\N	PHÊRÔ Nguyễn Đình Thế Anh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
599	\N	\N	GIACÔBÊ Trần Bạch Hải Đăng	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
600	\N	\N	MARIA Đoàn Ngọc Thiên Di	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
601	\N	\N	PHAOLÔ Nguyễn Văn Đồng	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
602	\N	\N	MARIA Tống Hồng Ngọc Hà	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
604	\N	\N	GIOAN BAOTIXITA Nguyễn Minh Huy	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
605	\N	\N	PHÊRÔ Vương Đăng Khoa	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
606	\N	\N	MARIA Vũ Đoàn Khánh Linh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
607	\N	\N	MAĐALÊNA Nguyễn Thái Bảo Ngọc	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
608	\N	\N	GIUSE Phạm Nguyễn Khôi Nguyên	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
609	\N	\N	MARIA Nguyễn Hồ Như Nguyệt	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
610	\N	\N	GIUSE Lê Nguyễn Thiện Nhân	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
611	\N	\N	PHAOLÔ Nguyễn Võ Hoàng Nhật	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
612	\N	\N	MARIA Hoàng Nguyễn Phương Nhi	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
613	\N	\N	ANNA Nguyễn Ngọc Thảo Nhi	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
614	\N	\N	MARIA Vũ Võ Quỳnh Như	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
615	\N	\N	GIUSE Đỗ Ngọc Phát	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
616	\N	\N	ANTÔN Phạm Hoàng Phong	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
617	\N	\N	ĐAMINH Nguyễn Trần Gia Phúc	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
618	\N	\N	TÊRÊSA Nguyễn Mai Phước	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
619	\N	\N	MARIA Nguyễn Hoàng Nam Phương	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
620	\N	\N	MICAE Phan Vũ Anh Quân	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
621	\N	\N	GIUSE Bùi Trấn Quốc	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
622	\N	\N	GIUSE Võ Văn Quý	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
623	\N	\N	MARIA Nguyễn Đặng Ngọc Quyên	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
624	\N	\N	ANNA Vương Nguyễn Như Quỳnh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
625	\N	\N	PHANXICÔ Phan Võ Tấn Sinh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
626	\N	\N	MARIA Phan Phương Thảo	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
627	\N	\N	MARIA Đặng Uyên Thảo	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
628	\N	\N	MARIA Vũ Minh Thư	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
629	\N	\N	PHÊRÔ Trần An Thuyên	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
630	\N	\N	Huỳnh Nữ Ngọc Tiên	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
631	\N	\N	MARIA Nguyễn Ngọc Bảo Trân	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
632	\N	\N	GIUSE Lê Minh Triết	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
633	\N	\N	PHÊRÔ Nguyễn Minh Tuấn	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
634	\N	\N	PHAOLÔ Nguyễn Thanh Tùng	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
635	\N	\N	MARIA Vũ Phạm Khánh Tường	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
636	\N	\N	GIACÔBÊ Võ Đặng Khánh Đình Vương	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
637	\N	\N	MARIA Nguyễn Ngọc Bảo An	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
638	\N	\N	GIUSE Nguyễn Thiên Ân	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
639	\N	\N	ANNA Đặng Trâm Anh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
640	\N	\N	MARIA Nguyễn Đinh Quỳnh Anh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
641	\N	\N	GIUSE Trần Bảo Anh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
642	\N	\N	GIUSE Trịnh Hoàng Anh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
643	\N	\N	CATARINA Nguyễn Khánh Băng	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
644	\N	\N	GIOAN Nguyễn Gia Bảo	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
645	\N	\N	GỈOAN Phạm Gia Bảo	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
646	\N	\N	MARIA Tạ Hoài Phương Chi	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
647	\N	\N	GIOAN Phan Thành Công	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
648	\N	\N	PHÊRÔ Vũ Phú Cường	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
649	\N	\N	TÊRÊSA Nguyễn Đỗ Linh Đan	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
603	\N	\N	GIOAN BAOTIXITA Nguyễn Thành Hưng	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
650	\N	\N	GIUSE Lê Tiến Đạt	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
651	\N	\N	VINHSƠN Nguyễn Văn Quốc Đạt	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
652	\N	\N	GIOAN Vũ Minh Đức	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
653	\N	\N	ANNA Hoàng Thị Diễm Hằng	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
654	\N	\N	PHAOLÔ Huỳnh Phước Huy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
655	\N	\N	PHANXICÔ Nguyễn Quốc Huy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
656	\N	\N	PHAOLÔ Vũ Minh Khoa	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
657	\N	\N	PHÊRÔ Nguyễn Đặng Quốc Kiệt	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
658	\N	\N	MARIA Huỳnh Phương Linh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
659	\N	\N	GIÊGÔRIÔ Trần Hoàng Long	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
660	\N	\N	PHANXICÔ Nguyễn Duy Mạnh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
662	\N	\N	MARIA Trần Phạm Thảo My	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
663	\N	\N	ANNA Lê Khởi My	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
664	\N	\N	MARIA Trần Hồng Ngọc	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
665	\N	\N	ANTÔN Trịnh Quang Thành Nhân	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
666	\N	\N	MARIA Lê Vũ Yến Nhi	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
667	\N	\N	MARIA Trần Thảo Nhi	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
668	\N	\N	PHÊRÔ Võ Hoàng Phát	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
669	\N	\N	GIUSE Phạm Trí Quốc	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
670	\N	\N	MARIA Trương Huỳnh Anh Thư	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
671	\N	\N	ANNA Nguyễn Hoàng Minh Thư	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
672	\N	\N	MARIA Trần Hồ Bảo Trân	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
673	\N	\N	MARIA Vũ Kiều Trang	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
674	\N	\N	ANTÔN Trương Anh Tuấn	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
675	\N	\N	PHÊRÔ Trần Mạnh Tuấn	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
676	\N	\N	PHÊRÔ Vũ Văn Tùng	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
677	\N	\N	MARIA Lê Phương Uyên	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
678	\N	\N	MATTA Phạm Thị Kim Uyên	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
679	\N	\N	MARIA Trần Phạm Thảo Vy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
680	\N	\N	(DỰ TÒNG) Nguyễn Nhật Vy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
681	\N	\N	ANNA Nguyễn Khánh Vy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
682	\N	\N	ANNA Hoàng Quỳnh Anh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
683	\N	\N	PHÊRÔ Bùi Mai Quang Anh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
684	\N	\N	GIUSE Nguyễn Bùi Hoàng Đạt	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
685	\N	\N	MARIA Nguyễn Thị Ngọc Diễm	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
686	\N	\N	MARIA Võ Nguyễn Khánh Hà	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
687	\N	\N	TÊRÊSA Trương Thanh Hiền	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
688	\N	\N	ĐAMINH Lê Văn Hoàng	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
689	\N	\N	PHÊRÔ Nguyễn Xuân Huy	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
690	\N	\N	PHÊRÔ Nguyễn Hoàng Lâm	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
691	\N	\N	TÊRÊSA Trương Thị Ngọc Lan	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
692	\N	\N	MARIA Phạm Hoàng Phương Linh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
693	\N	\N	TÊRÊSA Mai Ngọc Linh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
694	\N	\N	GIUSE Phạm Thành Lộc	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
695	\N	\N	URSULA Trần Thị Bảo Minh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
696	\N	\N	PHÊRÔ Bùi Mai Quang Minh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
697	\N	\N	VINHSƠN Vũ Hải Nam	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
698	\N	\N	INÊ Nguyễn Ngọc Ngân	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
699	\N	\N	MARIA Trần Thị Hồng Nhung	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
700	\N	\N	LUCA Nguyễn Lộc Phát	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
701	\N	\N	GIUSE Nguyễn Minh Phúc	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
702	\N	\N	MARIA Trần Mai Phương	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
703	\N	\N	MARIA Lã Hà Kiều Phương	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
704	\N	\N	GIOAN Nguyễn Việt Quang	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
705	\N	\N	GIUSE Vũ Hồ Thành Tâm	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
706	\N	\N	MARIA Vũ Kiều Thanh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
707	\N	\N	MARIA Phạm Hoàng Minh Thùy	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
708	\N	\N	MARIA Nguyễn Bảo Thy	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
709	\N	\N	PHAOLÔ Nguyễn Văn Trường	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
710	\N	\N	TÊRÊSA Phan Ngọc Uyên	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
711	\N	\N	GIOAN Trần Gia Bảo	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
712	\N	\N	GIUSE Vũ Văn Cảnh	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
713	\N	\N	TÔMASÔ Phan Đình Chung	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
714	\N	\N	ANTÔN Nguyễn Trung Hà	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
715	\N	\N	MARIA Lê Thanh Hằng	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
716	\N	\N	GIUSE Nguyễn Mạnh Hùng	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
717	\N	\N	GIOAN B. Đỗ Ngọc Phước	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
718	\N	\N	PHAOLÔ Trần Hồng Quân	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
719	\N	\N	ANTÔN Trương Trung Quân	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
720	\N	\N	GIUSE Nguyễn Minh Quang	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
721	\N	\N	MARIA Nguyễn Bùi Thủy Trúc	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
722	\N	\N	MARIA Trần Thanh Vân	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
726	\N	\N	MARIA Bùi Phương Anh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
727	\N	\N	Nguyễn Lê Gia Bảo	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
728	\N	\N	Đan Quỳnh Chi	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
729	\N	\N	MARIA Nguyễn An Chi	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
730	\N	\N	GIUSE Phạm Tiến Đạt	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
731	\N	\N	ANNA Bùi Hạnh Dung	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
732	\N	\N	PHAOLÔ Nguyễn Huy Hải	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
733	\N	\N	GIUSE Phạm Tấn Hưng	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
734	\N	\N	PHANXICÔ Nguyễn Nhật Hưng	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
735	\N	\N	GIUSE Nguyễn Phúc Gia Khiêm	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
736	\N	\N	Hoàng Xuân Khôi	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
737	\N	\N	GIUSE Mai Tuấn Kiệt	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
738	\N	\N	ANÊ Phạm Gia Linh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
739	\N	\N	PHÊRÔ Phạm Văn Minh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
740	\N	\N	Nguyễn Bảo Nam	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
741	\N	\N	MARIA Trần Khánh Ngân	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
742	\N	\N	MARIA Nguyễn Bích Ngân	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
743	\N	\N	MARIA Nguyễn Ngọc Bảo Nhi	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
744	\N	\N	Đỗ An Nhiên	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
745	\N	\N	Lê Ngọc Quỳnh Như	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
746	\N	\N	PHÊRÔ Nguyễn Anh Phát	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
747	\N	\N	PHÊRÔ Nguyễn Đình Phong	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
748	\N	\N	PHÊRÔ Lê Ngọc Phúc	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
749	\N	\N	GIUSE Đoàn Quý Phước	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
750	\N	\N	PHANXICÔ XAVIÊ Nguyễn Văn Minh Quân	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
751	\N	\N	Đặng Trúc Quỳnh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
752	\N	\N	Nguyễn Ngọc Đan Quỳnh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
753	\N	\N	MARIA Nguyễn Ngọc Linh San	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
754	\N	\N	MARIA Hoàng Thục Tâm	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
755	\N	\N	GIUSE Dương Thành Thắng	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
756	\N	\N	PHÊRÔ Nguyễn Phúc Thịnh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
757	\N	\N	MARIA Đặng Uyên Thư	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
758	\N	\N	Trần Minh Thư	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
759	\N	\N	ANNA Lê Thị Mỹ Trinh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
760	\N	\N	MARIA Đỗ Ngọc Cát Tường	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
761	\N	\N	MARIA Nguyễn Bảo Yến	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
762	\N	\N	GIUSE Nguyễn Trần Thiên Ân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
763	\N	\N	PHÊRÔ Trần Nguyễn Thiên Ân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
765	\N	\N	PHANXICÔ Phạm Nguyễn Minh Anh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
766	\N	\N	MARIA Nguyễn Phạm Yên Chi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
767	\N	\N	MARIA Đinh Phương Chi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
769	\N	\N	Đỗ Ngọc Hân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
770	\N	\N	Cao Khả Hân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
771	\N	\N	AUGUSTINÔ Võ Gia Hưng	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
772	\N	\N	MARIA Nguyễn Lê Quỳnh Hương	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
774	\N	\N	ĐAMINH Nguyễn Minh Khang	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
775	\N	\N	GIUSE Bùi Nguyễn Minh Khôi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
776	\N	\N	PHÊRÔ Trần Đăng Khôi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
777	\N	\N	MARIA Nguyễn Quý Kiều	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
778	\N	\N	MARIA Trần Khánh Linh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
779	\N	\N	ANNA Nguyễn Ngọc Khánh Linh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
780	\N	\N	PHANXICÔ XAVIÊ Phạm Nguyễn Gia Minh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
781	\N	\N	VICENTÊ Nguyễn Thiện Nhân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
782	\N	\N	MARIA Mai Quỳnh Như	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
785	\N	\N	GIUSE Nguyễn Hoàng Minh Phước	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
787	\N	\N	TÊRÊSA Đặng Nguyễn Anh Thư	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
788	\N	\N	MARIA Nguyễn Lê Huyền Thư	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
789	\N	\N	MARIA Nguyễn Ngọc Cát Tiên	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
723	\N	\N	MARIA Hoàng Hải Yến	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
724	\N	\N	VINHSƠN Hồ Thiên Ân	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
725	\N	\N	Nguyễn Quỳnh Anh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
790	\N	\N	GIOAN Trần Tuấn Tú	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
791	\N	\N	PHÊRÔ Hoàng Thị Anh Tú	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
792	\N	\N	LUCIA Lê Nguyễn Tú Uyên	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
793	\N	\N	ANNA Lê Tường Vy	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
794	\N	\N	ANNA Nguyễn Bảo An	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
796	\N	\N	MARIA Nguyễn Hoàng Anh	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
797	\N	\N	GIUSE Đinh Gia Bảo	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
798	\N	\N	MARIA Phạm Phương Chi	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
800	\N	\N	PHÊRÔ Nguyễn Hải Đăng	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
802	\N	\N	TÊRÊSA Lê Ngọc Khả Hân	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
803	\N	\N	TÊRÊSA Nguyễn Thiên Hoa	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
804	\N	\N	VINHSƠN Phạm Gia Khiêm	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
806	\N	\N	PHÊRÔ Nguyễn Tuấn Kiệt	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
807	\N	\N	GIOAN B. Dương Hoàng Minh	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
808	\N	\N	MARIA Vũ Phạm Khánh My	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
809	\N	\N	MARIA Trương Hoàng Diễm My	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
810	\N	\N	MARIA Dương Hà My	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
811	\N	\N	Võ Nguyễn Khánh Ngọc	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
812	\N	\N	MARIA Nguyễn Thảo Nguyên	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
813	\N	\N	Nguyễn Gia Nhi	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
814	\N	\N	PHAOLÔ Nguyễn Quang Phúc	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
815	\N	\N	MATTA Trương Nguyễn Hồng Phước	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
816	\N	\N	MARIA Nguyễn Huỳnh Quyên	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
817	\N	\N	GIOAN Lê Nguyễn Phúc Thịnh	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
818	\N	\N	MARIA Trần Minh Trang Thư	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
819	\N	\N	PHÊRÔ Nguyễn Anh Tú	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
820	\N	\N	ANNA Nguyễn Ngọc Yến Vy	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
821	\N	\N	ANNA Võ Trần Như Ý	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
822	\N	\N	TÊRÊSA Nguyễn Hải Yến	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
823	\N	\N	MARIA Bùi Gia An	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
824	\N	\N	Trần Nguyễn Thiên Ân	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
825	\N	\N	MICAE Nguyễn Quốc Bảo	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
826	\N	\N	MARIA Nguyễn Ngọc Thuỳ Dung	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
827	\N	\N	TÊRÊSA Lê Ngọc Khả Hân	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
828	\N	\N	MARIA Nguyễn Thị Mỹ Hoà	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
829	\N	\N	MARIA Phạm Thiên Hương	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
831	\N	\N	TÊRÊSA Bùi Quỳnh Hương	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
832	\N	\N	GIUSE Mai Bảo Khang	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
833	\N	\N	GIOAN PHAOLO Nguyễn Phúc Gia Khang	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
834	\N	\N	ĐAMINH Tạ Minh Khang	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
835	\N	\N	GIUSE Trần Nguyễn Bảo Khánh	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
836	\N	\N	GIUSE Vũ Quốc Khánh	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
837	\N	\N	PHÊRÔ Nguyễn Anh Khoa	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
838	\N	\N	MARIA Lê Gia Linh	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
839	\N	\N	GIUSE Nguyễn Thành Long	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
840	\N	\N	ANNA Nguyễn A My	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
841	\N	\N	GIÊRÔNIMÔ Trần Hoàng Nghĩa	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
842	\N	\N	PHÊRÔ Nguyễn Hoàng Gia Phát	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
843	\N	\N	PHÊRÔ Nguyễn Hoàng Thiên Phúc	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
844	\N	\N	GIUSE Trần Thiên Phúc	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
845	\N	\N	GIUSE Vũ Minh Quân	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
846	\N	\N	MARIA Đoàn Nhã Thi	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
847	\N	\N	ANNA Trương Thuỷ Tiên	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
848	\N	\N	ANTÔN Nguyễn Nguyên Trực	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
849	\N	\N	GIUSE Hồ Xuân Trường	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
850	\N	\N	MARIA Đỗ Ngọc Như Ý	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
851	\N	\N	MARIA Mai Vũ Ngọc Yến	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
852	\N	\N	GIUSE Đoàn Bảo An	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
853	\N	\N	GIUSE Cao Bảo An	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
854	\N	\N	FAUSTINA Võ Trần Ngọc An	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
498	TN_THEMSUC2B_GQUW	3329157505522597888	ĐAMINH Nguyễn Việt Hoàng	THEMSUC2B	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/e3789e1e-7d15-4bfd-a9c0-d9e2fef5f3b1.jpg	SYNCED	2026-09-30 05:36:03.90906	2026-10-01 09:11:40.494607
783	\N	\N	ANNA Đõ Ánh Phi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
784	\N	\N	PHÊRÔ Phan Nguyễn Hoàng Phúc	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
786	\N	\N	Đặng Trúc Quỳnh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
855	\N	\N	PHANXICÔ XAVIÊ Trần Nguyễn Thiên Ân	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
856	\N	\N	ANNA Nguyễn Ngọc Diệu Anh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
857	\N	\N	PHÊRÔ Lưu Hoàng Anh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
858	\N	\N	MARIA Nguyễn Đặng Ngọc Ánh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
859	\N	\N	PHÊRÔ Lê Nguyễn Thiên Bảo	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
860	\N	\N	GIUSE Võ Trần Tấn Bình	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
861	\N	\N	GIUSE Hồ Sỹ Minh Châu	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
862	\N	\N	PHÊRÔ Nguyên Hieu Duy	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
863	\N	\N	GIUSE Trịnh Sơn Hải	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
864	\N	\N	MARIA Nguyễn Lê Ngọc Hân	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
865	\N	\N	ANNA Nguyễn Ngọc Quỳnh Hoa	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
867	\N	\N	MARIA Đỗ Quỳnh Hương	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
868	\N	\N	SIMON  Sơn Gia Huy	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
869	\N	\N	PHÊRÔ Phạm Quang Khải	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
870	\N	\N	GIOAN PHAOLÔ II Chu Nguyên Khang	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
871	\N	\N	MARIA Nguyễn Ngọc Thiên Khánh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
872	\N	\N	AUGUSTINÔ Nguyễn Trần Gia Khiêm	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
873	\N	\N	PHANXICÔ Võ Lý Minh Khoa	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
874	\N	\N	PHÊRÔ Trần Nguyễn Nguyên Khôi	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
875	\N	\N	GIUSE Nguyễn Tuấn Kiệt	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
876	\N	\N	Lại Bảo Lâm	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
877	\N	\N	MARIA Vũ Phan Khánh Linh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
878	\N	\N	ANÊ Nguyễn Thị Thảo Nhi	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
879	\N	\N	MARIA Phạm Cát An Nhiên	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
880	\N	\N	ROSA Nguyễn Quỳnh Như	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
881	\N	\N	ANTÔN Trịnh Thanh Phong	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
882	\N	\N	AUGUSTINÔ Trần Văn Phúc	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
883	\N	\N	GIUSE Đinh Đặng Thiên Phước	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
884	\N	\N	CALORÔ Cao Nguyễn Hải Quân	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
885	\N	\N	MARIA Phan Thị Như Quỳnh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
886	\N	\N	GIOAN Nguyễn Ngọc Thiện	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
887	\N	\N	MARIA Nguyễn Đặng Minh Trang	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
888	\N	\N	GIUSE Vũ Thành Trung	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
889	\N	\N	GIUSE Nguyễn Tuấn Tú	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
890	\N	\N	MARIA Bùi Thị Nhã Uyên	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
891	\N	\N	ANNA Nguyễn Thị Hải Yến	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
892	\N	\N	ANNA Trần Bạch Vy An	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
893	\N	\N	ĐAMINH Tạ Phúc An	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
894	\N	\N	PHÊRÔ Vũ Thiên Ân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
895	\N	\N	PHÊRÔ Danh Nguyễn Thiên Ân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
896	\N	\N	VICENTÊ ĐặngThiên Ân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
897	\N	\N	VICENTÊ Phạm Tuấn Anh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
898	\N	\N	PHÊRÔ Lê Nguyễn Gia Bảo	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
901	\N	\N	PHÊRÔ Lê Tấn Đạt	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
902	\N	\N	PHÊRÔ Nguyễn Đức Duy	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
903	\N	\N	MARIA Nguyễn Ngọc Bảo Hân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
904	\N	\N	Phạm Huy Hoàng	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
905	\N	\N	TÊRÊSA Nguyễn Ánh Hồng	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
906	\N	\N	PHÊRÔ Phạm Văn Huy	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
907	\N	\N	GIUSE Phạm Gia Khiêm	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
908	\N	\N	PHILIPPHÊ Trần Đăng Khoa	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
801	TN_XUNGTOI2A_7K3S	3328969255352795136	MARIA Trương Gia Hân	XUNGTOI2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/393cb3de-075c-428e-ae39-18c5ae3755dc.jpg	SYNCED	2026-09-30 05:36:04.302486	2026-10-01 09:11:40.336677
805	TN_XUNGTOI2A_8YER	3328969797676302336	ĐAMINH Phạm Trung Kiên	XUNGTOI2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ab37d55b-74e1-4921-a1de-fb8d4bbad44b.jpg	SYNCED	2026-09-30 05:36:04.302486	2026-10-01 09:11:40.342038
909	\N	\N	GIUSE Bùi Anh Khoa	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
910	\N	\N	ANRÊ Lê Đăng Khôi	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
911	\N	\N	MARIA PhạmThị Liên	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
799	TN_XUNGTOI2A_6TTX	3328968970609885184	ANNA Nguyễn Phạm Thảo Chi	XUNGTOI2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/8716bf4d-c908-493c-8789-2f2652403f10.jpg	SYNCED	2026-09-30 05:36:04.302486	2026-10-01 09:11:40.33181
866	\N	\N	Hà Gia Hưng	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
912	\N	\N	MARIA Phạm Trúc Linh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
913	\N	\N	INHAXIÔ Hoàng Đức Mạnh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
914	\N	\N	PHÊRÔ Nguyễn Nhật Minh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
915	\N	\N	MARIA Phạm Ngọc Khánh My	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
916	\N	\N	MARIA Nguyễn Khánh Ngân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
917	\N	\N	TÊRÊSA Nguyễn Bảo Ngọc	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
918	\N	\N	GIUSE Nguyễn Hoàng Nhân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
919	\N	\N	MARIA Nguyễn An Nhiên	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
920	\N	\N	TÔMA Hoàng Minh Quân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
921	\N	\N	FAUSTINA Nguyễn Ngọc Đỗ Quyên	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
922	\N	\N	ĐAMINH Đinh Trường Thành	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
923	\N	\N	GIUSE Phạm Minh Thiện	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
924	\N	\N	ANNA Huỳnh Anh Thư	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
925	\N	\N	MARIA Trần Thảo Tiên	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
926	\N	\N	MARIA Nguyễn Ngọc Bảo Trâm	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
927	\N	\N	TÊRÊSA Trần Nguyễn Uyên Trinh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
928	\N	\N	ANNA Nguyễn Thanh Trúc	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
929	\N	\N	MARIA Nguyễn Danh Thảo Vy	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
930	\N	\N	MARIA Trần Thảo Vy	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
931	\N	\N	MARIA Triệu Nguyễn Như Ý	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
932	\N	\N	MARIA Lâm Nguyễn Bảo An	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
933	\N	\N	MARIA Vũ Thiên An	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
934	\N	\N	MARTINÔ Phạm Nguyễn Bình An	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
935	\N	\N	PHÊRÔ Nguyễn Thiên Ân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
937	\N	\N	MARIA Nguyễn Hoài Ân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
938	\N	\N	Hồ Việt Anh	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
939	\N	\N	GIUSE Nguyễn Trần Hoàng Gia Gia Bảo	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
940	\N	\N	PHÊRÔ Trần Nguyễn Gia Bảo	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
941	\N	\N	GIOAN Phạm Lê Hải Đăng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
942	\N	\N	GIUSE Trần Quốc Đông	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
943	\N	\N	GIOAN Lê Dương Han	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
944	\N	\N	MARIA Nguyễn Ngọc Khánh Hân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
945	\N	\N	GIUSE Phạm Minh Hiền	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
946	\N	\N	MARIA Trần Thái Hòa	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
947	\N	\N	STÊPHANÔ Lê Thanh Nhật Hoàng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
948	\N	\N	PHÊRÔ Nguyễn Thái Tuấn Hoàng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
949	\N	\N	GIUSE Trần Bảo Hưng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
950	\N	\N	GIUSE Trương Gia Hưng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
951	\N	\N	PHAOLÔ Quang Đức Huy	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
952	\N	\N	MARIA Phan Diệu Huyền	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
953	\N	\N	GIUSE Nguyễn Lê Nhật Huynh	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
954	\N	\N	PHÊRÔ Nguyễn Gia Khánh	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
955	\N	\N	GIUSE Vũ Đăng Khoa	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
956	\N	\N	ANRÊ Bùi Nhật Đăng Khôi	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
957	\N	\N	VINHSƠN Lâm Hoàng Khôi	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
966	\N	\N	GIUSE Hồ Xuân Nguyên	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
967	\N	\N	TÊRÊSA Nguyễn Ngọc An Nhiên	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
968	\N	\N	GIUSE Lê Nguyễn Gia Phúc	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
969	\N	\N	GIUSE Huỳnh Minh Sơn	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
970	\N	\N	PHAOLÔ Ngô Huỳnh Thế Thiện	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
971	\N	\N	MARIA Trương Kiều Trang	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
972	\N	\N	CATARINA Đoàn Ngọc Khả Tú	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
973	\N	\N	ANNA Lê Nguyễn Nhã Uyên	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
974	\N	\N	GIUSE Nguyễn Minh Kiều Văn	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
975	\N	\N	PHÊRÔ Bùi Tuấn Vũ	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
976	\N	\N	MARIA Phạm Trần Thảo Vy	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
977	\N	\N	MARIA Nguyễn Danh Thảo Vy	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
978	\N	\N	MARIA Trần Thị Cát Vy	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
979	\N	\N	Đoàn Vũ Hải Yến	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
998	TN_GLV_U77E	\N	GIOAN Phạm Tiến Chức	GLV	990653	Giáo Lý Viên	http://localhost:3000/uploads/processed_1790846647982_2.jpg	FAILED	2026-10-01 09:24:08.387174	2026-10-01 09:24:11.780118
899	\N	\N	PHÊRÔ Bùi Minh Bảo Cường	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
900	\N	\N	SIMON  Nguyễn Xuân Hoàng Đăng	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
958	\N	\N	GIUSE Trần Đinh Nhật Long	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
959	\N	\N	TÊRÊSA Nguyễn Khánh Ly	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
960	\N	\N	ANNA Nguyễn Thị Trà My	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
961	\N	\N	ĐAMINH Lê Hồ Văn Nam	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
962	\N	\N	MARIA Ngô Hoàng Kim Ngân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
963	\N	\N	MAĐALÊNA Huỳnh Thị Ngọc Ngân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
964	\N	\N	TÊRÊSA Vũ Thiên Minh Ngọc	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
965	\N	\N	MARIA Trần Lê Khánh Ngọc	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
984	TN_THEMSUC2C_11JA	3331433337163087872	PHÊRÔ Lê Nguyễn Gia Huy	THEMSUC2C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/eb2d19b2-9bb9-49c2-9aec-da5e8340ed98.jpg	SYNCED	2026-09-30 12:03:15.129752	2026-10-01 09:11:40.547028
985	TN_THEMSUC1C_QIBI	3331470658163965952	MARIA Nguyễn Trần Lan Anh	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/98a8796a-b739-466d-827b-b502d3e6f544.jpg	SYNCED	2026-09-30 13:17:24.203824	2026-10-01 09:11:40.551807
259	TN_GLV_FNWD	3318304752428646400	PHÊRÔ Trần Minh Mẫn	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/0e29c5cb-4cc5-495b-ba6a-018b36eedbc6.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.043442
300	TN_GLV_SMY2	3318364624818012160	Võ Thị Mơ	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/951128e7-0a60-4390-9b6a-29a4bc466779.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.067164
282	TN_GLV_089I	3323973138915524608	TÔMA AQUINÔ Trần Ngọc Bích	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/e77d56df-1412-41ef-b15b-5c12cdc4360a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.231471
364	TN_THEMSUC1A_ZG1P	3326101836275908608	PHAOLÔ Lê Trần Thiên Ân	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/7d24f682-7fb6-4a0a-9970-1a67ed037b91.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.25282
383	TN_THEMSUC1A_EZB8	3326761102288617472	GIUSE Trần Gia Khang	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ad19b3f4-fc82-4cb7-9b31-990ff87f510b.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.268063
795	TN_XUNGTOI2A_4BDI	3328968207531769856	TÊRÊSA Mai Vũ Hồng Ân	XUNGTOI2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/106bc219-8050-435a-aa21-545689419ebe.jpg	SYNCED	2026-09-30 05:36:04.302486	2026-10-01 09:11:40.325589
193	TN_BAODONG3_YS03	3328993938504679424	MATTA Vũ Thị Diệu Linh	BAODONG3	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/782fa8e3-9be7-4e62-aca2-06aeb87de788.jpg	SYNCED	2026-09-30 05:36:03.474686	2026-10-01 09:11:40.347448
382	TN_THEMSUC1A_5T0Y	3328996715687575552	GIOAN Nguyễn Viết Thiện Hữu	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/39ffe66f-8c84-4007-b93f-5fcb383fb6bf.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.393465
983	TN_THEMSUC2C_ZYA1	3331391626789519360	MARIA Phạm Quỳnh Anh	THEMSUC2C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/065402bc-b1e2-401a-9095-b7ed39d7c046.jpg	SYNCED	2026-09-30 10:40:22.778248	2026-10-01 09:11:40.542214
986	TN_THEMSUC1C_REIQ	3331470946522365952	MARIA Phạm Vân Anh	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/1752645b-8360-442d-9ac5-ad2beca0f560.jpg	SYNCED	2026-09-30 13:17:58.531958	2026-10-01 09:11:40.556651
987	TN_THEMSUC1C_S9S3	3331471323414134784	PHÊRÔ Phạm Vũ Huy Khang	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/7a6a3e21-d9b0-4de9-baad-752249a5c27b.jpg	SYNCED	2026-09-30 13:18:42.544005	2026-10-01 09:11:40.561245
990	TN_BAODONG2A_5B89	3331533535302385664	MARIA Hoàng Thị Kim Ngân	BAODONG2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/0aef1cf8-0294-4fe3-b6e5-3191398e057a.jpg	SYNCED	2026-09-30 15:22:19.700252	2026-10-01 09:11:40.566107
991	TN_GLV_5CVP	3331942900354252800	TÔMA Hoàng Thành Lợi	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/149e5092-039c-40a8-a231-95c6058507c9.jpg	SYNCED	2026-10-01 04:55:39.633953	2026-10-01 09:11:40.570958
992	TN_GLV_PPZD	3332005623570104320	Terexa Nguyễn Thị Mỹ Linh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/972dbdf3-8e14-40b3-bbf1-e13e136980c8.jpg	SYNCED	2026-10-01 07:00:16.559837	2026-10-01 09:11:40.576449
936	TN_XUNGTOI3C_SOIG	3329146769899520000	PHANXICÔ XAVIÊ Trần Nguyễn Thiên Ân	XUNGTOI3C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/3db68062-a76f-4492-9d12-e0c3e2fbe3c0.jpg	SYNCED	2026-09-30 05:36:04.506426	2026-10-01 09:11:40.488582
768	TN_XUNGTOI1B_ZVP4	3329248063356141568	VINHSƠN Phạm Gia Đạt	XUNGTOI1B	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/5af00c44-a79a-486e-ab84-68c5120336b9.jpg	SYNCED	2026-09-30 05:36:04.260115	2026-10-01 09:11:40.502245
994	TN_THEMSUC_2C_RAUX	3330766809635749888	Phêrô NGUYỄN TRUNG HIẾU (thêm sức 2c	THEMSUC	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/e206de14-b2d1-4097-82eb-cb9c88ff3f78.jpg	SYNCED	2026-10-01 07:16:07.253109	2026-10-01 09:11:40.526458
995	TN_THEMSUC_2C_S0CZ	3330767313816256512	GIUSE Phan Quốc Huy	THEMSUC	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ec6ecb28-2c31-4365-a083-44927f12389c.jpg	SYNCED	2026-10-01 07:16:07.261772	2026-10-01 09:11:40.532572
232	LM_DMHCCC_0AX6	3329318864474341376	GIUSE Nguyễn Quốc Tuấn	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/df99bbae-2f12-4ae9-bd1e-320df10e45e2.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.64642
996	LM_DMHCCC_FV9O	3329888368933732352	Chú Long Lêgiô	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/0439bc4e-894a-4370-843d-d5a200759ecb.jpg	SYNCED	2026-10-01 07:16:07.373604	2026-10-01 09:11:40.657685
764	\N	\N	Trương Quốc Anh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
\.


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 17, true);


--
-- Name: classes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.classes_id_seq', 130, true);


--
-- Name: persons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.persons_id_seq', 998, true);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: classes classes_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_name_key UNIQUE (name);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: persons persons_alias_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_alias_id_key UNIQUE (alias_id);


--
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_classes_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_classes_name ON public.classes USING btree (name);


--
-- Name: idx_persons_alias; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_alias ON public.persons USING btree (alias_id);


--
-- Name: idx_persons_name_class; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_name_class ON public.persons USING btree (name, class_name);


--
-- Name: idx_persons_person_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_person_id ON public.persons USING btree (person_id);


--
-- Name: idx_persons_sync_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_sync_status ON public.persons USING btree (sync_status);


--
-- Name: classes classes_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: persons persons_class_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_class_name_fkey FOREIGN KEY (class_name) REFERENCES public.classes(name) ON DELETE SET NULL;


--
-- Name: persons persons_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict qVjNTS3Ghv3LUVp6pTjhvB1h5IS4EzR9acVsT4WAACATaZDigRka6ROwEvK3buZ


```

### File SQL: `./vps_sync_backup.sql`
```sql
--
-- PostgreSQL database dump
--

\restrict qVjNTS3Ghv3LUVp6pTjhvB1h5IS4EzR9acVsT4WAACATaZDigRka6ROwEvK3buZ

-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

ALTER TABLE IF EXISTS ONLY public.persons DROP CONSTRAINT IF EXISTS persons_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.persons DROP CONSTRAINT IF EXISTS persons_class_name_fkey;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_department_id_fkey;
DROP INDEX IF EXISTS public.idx_persons_sync_status;
DROP INDEX IF EXISTS public.idx_persons_person_id;
DROP INDEX IF EXISTS public.idx_persons_name_class;
DROP INDEX IF EXISTS public.idx_persons_alias;
DROP INDEX IF EXISTS public.idx_classes_name;
DROP INDEX IF EXISTS public.idx_audit_logs_created_at;
DROP INDEX IF EXISTS public.idx_audit_logs_action;
ALTER TABLE IF EXISTS ONLY public.persons DROP CONSTRAINT IF EXISTS persons_pkey;
ALTER TABLE IF EXISTS ONLY public.persons DROP CONSTRAINT IF EXISTS persons_alias_id_key;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_pkey;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_code_key;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_pkey;
ALTER TABLE IF EXISTS ONLY public.classes DROP CONSTRAINT IF EXISTS classes_name_key;
ALTER TABLE IF EXISTS ONLY public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_pkey;
ALTER TABLE IF EXISTS public.persons ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.classes ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.audit_logs ALTER COLUMN id DROP DEFAULT;
DROP SEQUENCE IF EXISTS public.persons_id_seq;
DROP TABLE IF EXISTS public.persons;
DROP TABLE IF EXISTS public.departments;
DROP SEQUENCE IF EXISTS public.classes_id_seq;
DROP TABLE IF EXISTS public.classes;
DROP SEQUENCE IF EXISTS public.audit_logs_id_seq;
DROP TABLE IF EXISTS public.audit_logs;
SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_logs (
    id bigint NOT NULL,
    action character varying(100) NOT NULL,
    user_id character varying(100) DEFAULT 'ANONYMOUS'::character varying,
    username character varying(100),
    role character varying(50),
    status_code integer,
    ip_address character varying(50),
    user_agent text,
    target_id character varying(150),
    details jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.audit_logs OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO postgres;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: classes; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.classes (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    department_id character varying(50),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.classes OWNER TO postgres;

--
-- Name: classes_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.classes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.classes_id_seq OWNER TO postgres;

--
-- Name: classes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.classes_id_seq OWNED BY public.classes.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id character varying(50) NOT NULL,
    name character varying(255) NOT NULL,
    code character varying(10) NOT NULL
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: persons; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.persons (
    id integer NOT NULL,
    alias_id character varying(100),
    person_id character varying(100),
    name character varying(255) NOT NULL,
    class_name character varying(100),
    department_id character varying(50),
    title character varying(100) NOT NULL,
    face_url text,
    sync_status character varying(50) DEFAULT 'PENDING'::character varying,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.persons OWNER TO postgres;

--
-- Name: persons_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.persons_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.persons_id_seq OWNER TO postgres;

--
-- Name: persons_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.persons_id_seq OWNED BY public.persons.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: classes id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes ALTER COLUMN id SET DEFAULT nextval('public.classes_id_seq'::regclass);


--
-- Name: persons id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons ALTER COLUMN id SET DEFAULT nextval('public.persons_id_seq'::regclass);


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_logs (id, action, user_id, username, role, status_code, ip_address, user_agent, target_id, details, created_at) FROM stdin;
1	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	180.148.4.185	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	TN_THEMSUC2C_YB6Z	{"query": {}, "params": {}, "changes": {"name": "ANNA Trần Phương Vy", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_YB6Z", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 05:59:24.483953+00
2	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	180.148.4.185	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	TN_THEMSUC2C_48P3	{"query": {}, "params": {}, "changes": {"name": "ANNA Trần Phương Vy", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_48P3", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 06:00:47.157064+00
3	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2402:800:639e:e220:f858:7ccb:579b:69d8	Mozilla/5.0 (Linux; Android 16; SM-A566B Build/BP2A.250605.031.A3;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.57 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC2C_CC3O	{"query": {}, "params": {}, "changes": {"name": "MARIA Nguyễn Trâm Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_CC3O", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 06:09:20.660158+00
4	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2402:800:639e:e220:f858:7ccb:579b:69d8	Mozilla/5.0 (Linux; Android 16; SM-A566B Build/BP2A.250605.031.A3;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.57 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC2C_HBS2	{"query": {}, "params": {}, "changes": {"name": "MARIA Nguyễn Trâm Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_HBS2", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 06:11:27.181345+00
5	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.173.188.23	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260901802 ZaloTheme/light ZaloLanguage/vn	TN_Chung_EME7	{"query": {}, "params": {}, "changes": {"name": "Urxula Trần Thị Bảo Minh Vào đời 1", "title": "Học Sinh", "aliasID": "TN_Chung_EME7", "className": "VaoDoi_1", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 09:24:06.820561+00
6	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.191.196.44	Mozilla/5.0 (Linux; Android 13; CPH2237 Build/TP1A.220905.001;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC2C_ZYA1	{"query": {}, "params": {}, "changes": {"name": "MARIA Phạm Quỳnh Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_ZYA1", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 10:40:22.995999+00
7	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	45.118.138.93	Mozilla/5.0 (Linux; Android 15; SM-A266B Build/AP3A.240905.015.A2;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC2C_11JA	{"query": {}, "params": {}, "changes": {"name": "PHÊRÔ Lê Nguyễn Gia Huy", "title": "Học Sinh", "aliasID": "TN_THEMSUC2C_11JA", "className": "THEMSUC2C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 12:03:15.228575+00
8	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4802:98c3:d940:615d:f89:6505:414b	Mozilla/5.0 (Linux; Android 14; CPH2579 Build/UP1A.230620.001;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC1C_QIBI	{"query": {}, "params": {}, "changes": {"name": "MARIA Nguyễn Trần Lan Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC1C_QIBI", "className": "THEMSUC1C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 13:17:24.255721+00
9	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4802:98c3:d940:615d:f89:6505:414b	Mozilla/5.0 (Linux; Android 14; CPH2579 Build/UP1A.230620.001;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC1C_REIQ	{"query": {}, "params": {}, "changes": {"name": "MARIA Phạm Vân Anh", "title": "Học Sinh", "aliasID": "TN_THEMSUC1C_REIQ", "className": "THEMSUC1C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 13:17:58.585617+00
10	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4802:98c3:d940:615d:f89:6505:414b	Mozilla/5.0 (Linux; Android 14; CPH2579 Build/UP1A.230620.001;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.8010.36 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_THEMSUC1C_S9S3	{"query": {}, "params": {}, "changes": {"name": "PHÊRÔ Phạm Vũ Huy Khang", "title": "Học Sinh", "aliasID": "TN_THEMSUC1C_S9S3", "className": "THEMSUC1C", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 13:18:42.592296+00
11	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.173.188.23	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260901802 ZaloTheme/light ZaloLanguage/vn	TN_Chung_B82P	{"query": {}, "params": {}, "changes": {"name": "Urxula Trần Thị Bảo Minh", "title": "Học Sinh", "aliasID": "TN_Chung_B82P", "className": "VaoDoi_1", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 14:30:03.804205+00
12	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.173.188.23	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260901802 ZaloTheme/light ZaloLanguage/vn	TN_Chung_FKIA	{"query": {}, "params": {}, "changes": {"name": "Urxula_Trần Thị Bảo Minh_vaodoi1_minh_fkey", "title": "Học Sinh", "aliasID": "TN_Chung_FKIA", "className": "VaoDoi_1", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 14:32:32.403501+00
13	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	113.174.15.98	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260901802 ZaloTheme/light ZaloLanguage/vn	TN_BAODONG2A_5B89	{"query": {}, "params": {}, "changes": {"name": "MARIA Hoàng Thị Kim Ngân", "title": "Học Sinh", "aliasID": "TN_BAODONG2A_5B89", "className": "BAODONG2A", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-09-30 15:22:19.751025+00
14	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	14.191.68.22	Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Zalo iOS/260802802 ZaloTheme/light ZaloLanguage/vn	TN_GLV_5CVP	{"query": {}, "params": {}, "changes": {"name": "TÔMA Hoàng Thành Lợi", "title": "Giáo Lý Viên", "aliasID": "TN_GLV_5CVP", "className": "GLV", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-10-01 04:55:39.691773+00
15	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4803:b4e1:eec0:5b1:3e54:7ed9:7f9b	Mozilla/5.0 (Linux; Android 15; 24117RN76O Build/AP3A.240905.015.A2;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.57 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_GLV_PPZD	{"query": {}, "params": {}, "changes": {"name": "Terexa Nguyễn Thị Mỹ Linh", "title": "Giáo Lý Viên", "aliasID": "TN_GLV_PPZD", "className": "GLV", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-10-01 07:00:16.82033+00
16	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2405:4803:b4e1:eec0:5b1:3e54:7ed9:7f9b	Mozilla/5.0 (Linux; Android 15; 24117RN76O Build/AP3A.240905.015.A2;) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/154.0.8037.57 Mobile Safari/537.36 Zalo android/260901903 ZaloTheme/light ZaloLanguage/vi	TN_GLV_RIS4	{"query": {}, "params": {}, "changes": {"name": "Terexa Nguyễn Thị Mỹ Linh ", "title": "Giáo Lý Viên", "aliasID": "TN_GLV_RIS4", "className": "GLV", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-10-01 07:01:51.033503+00
17	REGISTER_FACE_GENERAL	ANONYMOUS	anonymous_user	GUEST	302	2402:800:6388:8e8c:50a1:819e:c35:bc96	Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/30.0 Chrome/143.0.0.0 Mobile Safari/537.36	TN_GLV_U77E	{"query": {}, "params": {}, "changes": {"name": "GIOAN Phạm Tiến Chức", "title": "Giáo Lý Viên", "aliasID": "TN_GLV_U77E", "className": "GLV", "departmentID": "990653"}, "bodyKeys": ["source_csv", "existing_person_id", "name", "departmentName", "departmentID", "lop", "title", "aliasID"]}	2026-10-01 09:24:08.481923+00
\.


--
-- Data for Name: classes; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.classes (id, name, department_id, created_at) FROM stdin;
1	BAODONG1A	990653	2026-09-30 05:36:03.210476
2	BAODONG1B	990653	2026-09-30 05:36:03.281118
3	BAODONG1C	990653	2026-09-30 05:36:03.33306
4	BAODONG2A	990653	2026-09-30 05:36:03.370024
5	BAODONG2B	990653	2026-09-30 05:36:03.434035
6	BAODONG3	990653	2026-09-30 05:36:03.474686
7	DMHCCC	990730	2026-09-30 05:36:03.549569
8	GLV	990653	2026-09-30 05:36:03.577341
9	KHAITAM1	990653	2026-09-30 05:36:03.666323
10	KHAITAM2	990653	2026-09-30 05:36:03.675684
11	KHAITAM3	990653	2026-09-30 05:36:03.7053
12	THEMSUC1A	990653	2026-09-30 05:36:03.74369
13	THEMSUC1B	990653	2026-09-30 05:36:03.793887
14	THEMSUC1C	990653	2026-09-30 05:36:03.827899
15	THEMSUC2A	990653	2026-09-30 05:36:03.859373
16	THEMSUC2B	990653	2026-09-30 05:36:03.90906
17	THEMSUC2C	990653	2026-09-30 05:36:03.958411
18	THEMSUC3A	990653	2026-09-30 05:36:03.994913
19	THEMSUC3B	990653	2026-09-30 05:36:04.037681
20	THEMSUC3C	990653	2026-09-30 05:36:04.096797
21	VAODOI1	990653	2026-09-30 05:36:04.151386
22	VAODOI2	990653	2026-09-30 05:36:04.19325
23	XUNGTOI1A	990653	2026-09-30 05:36:04.213688
24	XUNGTOI1B	990653	2026-09-30 05:36:04.260115
25	XUNGTOI2A	990653	2026-09-30 05:36:04.302486
26	XUNGTOI2B	990653	2026-09-30 05:36:04.346273
27	XUNGTOI3A	990653	2026-09-30 05:36:04.392903
28	XUNGTOI3B	990653	2026-09-30 05:36:04.450243
29	XUNGTOI3C	990653	2026-09-30 05:36:04.506426
30	THEMSUC	990653	2026-10-01 07:16:07.240949
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, name, code) FROM stdin;
990653	Thiếu Nhi	TN
990730	Legiô Mariae	LM
990731	Giới Trẻ	GT
\.


--
-- Data for Name: persons; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.persons (id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, created_at, updated_at) FROM stdin;
1	\N	\N	GIUSE Nguyễn Đình Thiên Ân	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
2	\N	\N	TÊRÊSA Trần Ngọc Quỳnh Anh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
3	\N	\N	MARIA Danh Nguyễn Hoài Anh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
4	\N	\N	TÊRÊSA Đỗ Hà Anh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
5	\N	\N	GIUSE Nguyễn Duy Anh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
6	\N	\N	GIUSE Vũ Xuân Bắc	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
7	\N	\N	GIUSE Nguyễn Bùi Gia Bảo	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
8	\N	\N	ANNA Nguyễn Bảo Châu	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
9	\N	\N	MARIA Nguyễn Khánh Chi	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
10	\N	\N	VINHSƠN Trần Thành Cương	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
11	\N	\N	VINHSƠN Lê Hải Đăng	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
12	\N	\N	MARIA Hoàng Bích Diệp	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
13	\N	\N	PHÊRÔ Mai Nguyên Đức	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
14	\N	\N	GIUSE Trịnh Nam Dương	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
15	\N	\N	MARIA Ngô Gia Hân	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
16	\N	\N	MARIA Trần Thị Hoài	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
17	\N	\N	GIUSE Nguyễn Thế Hoàng	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
18	\N	\N	GIOANB. Hồ Quốc Hưng	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
19	\N	\N	ANTÔN Trần Nhật Huy	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
20	\N	\N	PHAOLÔ Bùi Phúc Khang	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
21	\N	\N	EMMANUEL Nguyễn Bảo Khang	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
22	\N	\N	MICAE Nguyễn Minh Khang	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
23	\N	\N	GIOAN B. Dương Đình Khang	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
24	\N	\N	GIUSE Phạm Đăng Khoa	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
25	\N	\N	PHAOLÔ Nguyễn Trung Kiên	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
26	\N	\N	MARIA Nguyễn Trịnh Nhã Lam	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
27	\N	\N	TÊRÊSA Nguyễn Ngọc Lan	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
28	\N	\N	MARIA Nguyễn Ngọc Lan	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
29	\N	\N	MARIA Nguyễn Uyên Linh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
30	\N	\N	ANNA Trương Ngọc Linh	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
31	\N	\N	PHÊRÔ Trình Nguyễn Hoàng Long	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
32	\N	\N	MARIA Nguyễn Khánh Ly	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
33	\N	\N	MARIA Nguyễn Lê Hà My	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
34	\N	\N	MARIA Nguyễn Thị Phương Nam	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
35	\N	\N	MARIA Trần Bảo Nghi	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
36	\N	\N	MARIA Nguyễn Thị Bảo Ngọc	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
37	\N	\N	AUGUSTINÔ Nguyễn Hoàng Nguyên	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
38	\N	\N	MARIA Nguyễn Thanh Trúc	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
39	\N	\N	ANNA Nguyễn Nhật Vy	BAODONG1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.210476	2026-10-01 09:08:34.181219
40	\N	\N	ĐAMINH Đinh Hoàng Gia	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
41	\N	\N	ĐAMINH Ngô Gia Hưng	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
42	\N	\N	GIUSE Trần Bảo Lâm	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
43	\N	\N	MARIA Nguyễn My My	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
44	\N	\N	MARIA Trần Ly Na	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
45	\N	\N	GIUSE Trần Bảo Nam	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
46	\N	\N	MARIA Đinh Thanh Ngọc	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
47	\N	\N	GIUSE Trần Đức Nguyên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
48	\N	\N	TÊRÊSA Nguyễn Thị Thiên Nhi	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
49	\N	\N	MARIA Vũ Đàm An Nhiên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
50	\N	\N	PHAOLÔ Nguyễn Vũ Nhật Phong	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
51	\N	\N	MARIA Nguyễn Ngọc Thiên Phúc	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
52	\N	\N	ANNA Trương Thanh Thảo	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
53	\N	\N	MARIA Nguyễn Thị Mai Thi	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
54	\N	\N	MARIA Đinh Thị Anh Thư	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
55	\N	\N	MARIA Tạ Thuỷ Tiên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
56	\N	\N	GIUSE Phan Thành Tiến	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
57	\N	\N	PHÊRÔ Nguyễn Tuấn Toàn	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
58	\N	\N	MARIA Nguyễn Bảo Trâm	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
59	\N	\N	ROSA Ngô Nguyễn Quỳnh Trâm	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
60	\N	\N	MARIA Trần Bảo Trân	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
61	\N	\N	ANNA Trần Nguyễn Bảo Trân	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
62	\N	\N	MARIA Trần Thị Quỳnh Trang	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
63	\N	\N	PHÊRÔ Trần Đình Triết	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
64	\N	\N	MARIA Trần Vũ Kiều Trinh	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
65	\N	\N	MARIA Cao Nguyễn Bảo Trúc	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
66	\N	\N	GIUSE Vũ Trần Đức Trung	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
67	\N	\N	VINHSƠN Nguyễn Đức Trung	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
68	\N	\N	GIUSE Lê Kiến Trung	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
69	\N	\N	BÊNAĐÔ Nguyễn Hoàng Minh Tuấn	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
70	\N	\N	TÊRÊSA Nguyễn Phương Uyên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
71	\N	\N	MARIA Hà Nhã Uyên	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
72	\N	\N	PHAOLÔ Nguyễn Công Vinh	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
73	\N	\N	MARIA Vũ Thị Tường Vy	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
74	\N	\N	TÊRÊSA MARIA Phạm Trịnh Trúc Vy	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
75	\N	\N	MARIA Đinh Hoàng Hải Yến	BAODONG1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.281118	2026-10-01 09:08:34.181219
76	\N	\N	PHÊRÔ Nguyễn Hoàng Tuấn Anh	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
77	\N	\N	TÊRÊSA Nguyễn Hồng Anh	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
78	\N	\N	Wang Thiên Bội	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
79	\N	\N	MARIA Nguyễn Ngọc Bảo Châu	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
80	\N	\N	GIUSE Nguyễn Tuấn Cường	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
81	\N	\N	PHÊRÔ Nguyễn Hoàng Dương	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
82	\N	\N	ANNA Phạm Nguyễn Gia Hân	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
83	\N	\N	GIUSE Nguyễn Hưng	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
84	\N	\N	GIUSE Lê Gia Hưng	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
85	\N	\N	GIOAN BAOTIXITA Nguyễn Minh Huy	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
86	\N	\N	PHÊRÔ Nguyễn Hoàng Anh Khôi	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
87	\N	\N	GIUSE Phùng Lê Trung Kiên	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
88	\N	\N	ĐAMINH Đoàn Phi Long	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
89	\N	\N	PHÊRÔ Nguyễn Bảo Nam	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
90	\N	\N	MATTA Nguyễn Gia Như	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
91	\N	\N	GIUSE Trần Thanh Phong	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
92	\N	\N	ANRÊ Nguyễn Lê Bá Quốc	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
93	\N	\N	MARIA Huỳnh Nguyễn Ngọc Thảo	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
94	\N	\N	GIUSE Phạm Hoàng Thiên	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
95	\N	\N	TÊRÊSA Phạm Vân Trang	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
96	\N	\N	MARIA Vũ Đoàn Thảo Vy	BAODONG1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.33306	2026-10-01 09:08:34.181219
97	\N	\N	TÊRÊSA Nguyễn Hoài An	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
98	\N	\N	ANNA Trần Quỳnh Anh	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
99	\N	\N	GIOAN BOSCO Nguyễn Đình Bách	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
100	\N	\N	ANNA Đỗ Lê Khánh Băng	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
101	\N	\N	ĐAMINH Nguyễn Thanh Bình	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
102	\N	\N	GIUSE Vũ Mạnh Cường	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
103	\N	\N	PHÊRÔ Nguyễn Mạnh Cường	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
104	\N	\N	GIUSE Đỗ Nguyễn Tuấn Đạt	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
105	\N	\N	MARIA Nguyễn Thị Ngọc Diệu	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
106	\N	\N	PHÊRÔ Phạm Hoàng Định	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
107	\N	\N	GIUSE Văn Minh Thiên Đức	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
108	\N	\N	MARIA Nguyễn Ngọc Dung	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
109	\N	\N	GIOAN B. Ngô Mạnh Dũng	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
110	\N	\N	PHÊRÔ Bùi Lê Khánh Duy	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
111	\N	\N	AUGUSTINÔ Nguyễn Minh Hải	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
112	\N	\N	MARIA Phan Vũ Bảo Hân	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
113	\N	\N	LUCA Trần Dương Trọng Hiếu	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
114	\N	\N	VINHSƠN Phạm Gia Hưng	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
115	\N	\N	MARIA Hoàng Thị Thu Hường	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
116	\N	\N	PHÊRÔ Trần Gia Huy	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
117	\N	\N	GIUSE Nguyễn Nhật Huy	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
118	\N	\N	GIUSE Lê Đăng Khoa	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
119	\N	\N	MARIA Đỗ Phan Bảo Linh	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
121	\N	\N	GIUSE Nguyễn Minh Long	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
122	\N	\N	GIUSE Võ Hoàng Long	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
124	\N	\N	LUCIA Lưu Hoàng Bảo Ngọc	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
125	\N	\N	AUGUSTINÔ Nguyễn Nhật Khôi Nguyên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
126	\N	\N	PHÊRÔ Mai Long Nguyên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
127	\N	\N	GIUSE Đào Nguyên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
128	\N	\N	PHÊRÔ Vũ Thành Nhân	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
129	\N	\N	GIUSE Bùi Nguyễn Minh Nhật	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
130	\N	\N	AUGUSTINÔ Lê Đỉnh Thiên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
131	\N	\N	GIUSE Nguyễn Hoàng Thiên	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
132	\N	\N	MARIA Phạm Hoài Thương	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
120	\N	\N	MARIA Trần Thị Diệu Linh	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
133	\N	\N	TÊRÊSA Đặng Ngọc Bảo Trâm	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
134	\N	\N	GIUSE Lê Quốc Việt	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
135	\N	\N	MARIA Nguyễn Phương Vy	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
136	\N	\N	GIOAN BAOTIXITA Triệu Trường Vỹ	BAODONG2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.370024	2026-10-01 09:08:34.181219
137	\N	\N	TÊRÊSA Phan Thị Vân Anh	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
138	\N	\N	PHANXICÔ Phạm Lê Trung Hiếu	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
139	\N	\N	PHÊRÔ Thái Khải Hoàng	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
140	\N	\N	LUCIA Nguyễn Ngọc Kiên	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
141	\N	\N	ANNA Lê Thanh Kiều Linh	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
142	\N	\N	MARIA Nguyễn Minh Bảo Ngọc	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
143	\N	\N	GIUSE Tống Trần Phúc Nguyên	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
144	\N	\N	ĐAMINH Nguyễn Khôi Nguyên	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
145	\N	\N	MARIA Trần Dương Thảo Nhi	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
146	\N	\N	MARIA Trương Hoàng Yến Nhi	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
147	\N	\N	TÊRÊSA Nguyễn Linh Nhi	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
148	\N	\N	ANTÔN Trịnh Quang Thành Phát	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
149	\N	\N	PHÊRÔ Ngô Phan Lai Phát	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
150	\N	\N	PHÊRÔ Xích Công Thiên Phong	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
151	\N	\N	ANNA Hoàng Nguyễn Mai Phương	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
152	\N	\N	PHAOLÔ Nguyễn Hải Quân	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
153	\N	\N	MARIA Nguyễn Đinh Tú Quỳnh	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
154	\N	\N	GIUSE Nguyễn Huỳnh Khánh Tâm	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
155	\N	\N	PHÊRÔ Nguyễn Hoàng Thiên	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
156	\N	\N	ANNA Hồ Phạm Anh Thư	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
157	\N	\N	MARIA Vũ Thị Thư	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
158	\N	\N	MARIA Nguyễn Ngọc Bảo Trân	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
159	\N	\N	MARIA Trịnh Minh Trang	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
160	\N	\N	GIOAKIM Vũ Thanh Tùng	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
161	\N	\N	PHÊRÔ Nguyễn Hoàng Thiên Vương	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
162	\N	\N	MARIA Phạm Phương Vy	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
163	\N	\N	MARIA Trần Ngọc Khánh Vy	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
164	\N	\N	MARIA Nguyễn Thúy Hà Vy	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
165	\N	\N	MARIA Phạm Hồng Triệu Vy	BAODONG2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.434035	2026-10-01 09:08:34.181219
166	\N	\N	PHÊRÔ Nguyễn Khánh An	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
167	\N	\N	MARTINÔ Đinh Đặng Thiên Ân	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
168	\N	\N	TÊRÊXA Nguyễn Hồng Ân	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
169	\N	\N	MARIA Nguyễn Thị Hải Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
170	\N	\N	ANNA Võ Thị Vân Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
171	\N	\N	TÊRÊSA Trần Mỹ Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
172	\N	\N	MARIA Cao Kiều Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
173	\N	\N	ANNA Nguyễn Trâm Anh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
174	\N	\N	MARIA Lương Tiểu Băng	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
175	\N	\N	GIOAN BAOTIXITA Trần Quốc Bảo	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
176	\N	\N	GIOAN B. Nguyễn Ngọc Thanh Bình	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
177	\N	\N	TÊRÊSA Lê Ngọc Lan Chi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
178	\N	\N	MARIA Tạ Quỳnh Chi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
182	\N	\N	MAĐALÊNA Huỳnh Thị Ngọc Diễm	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
183	\N	\N	PHÊRÔ Nguyễn Huỳnh Đức	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
184	\N	\N	GIUSE Nguyễn Minh Đức	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
185	\N	\N	TÔMA Bùi Minh Đức	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
186	\N	\N	MARIA Nguyễn Thị Thùy Dung	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
187	\N	\N	PHÊRÔ Trần Đức Duy	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
188	\N	\N	PHÊRÔ Nguyễn Ngọc Minh Hoàng	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
189	\N	\N	MARIA Trần Thị Thu Hường	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
190	\N	\N	PHÊRÔ Trần Quang Khải	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
191	\N	\N	GIUSE Nguyễn Phúc Khang	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
192	\N	\N	MARIA Phạm Kim Khanh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
194	\N	\N	MARIA Nguyễn Thị Phương Linh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
195	\N	\N	GIUSE Ngyễn Ngọc Bảo Long	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
196	\N	\N	TÊRÊSA Nguyễn Trần Thảo My	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
197	\N	\N	CLARA Nguyễn Duy Mỹ	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
198	\N	\N	VINHSƠN Trần Uy Nam	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
199	\N	\N	GIUSE Nguyễn Thành Nam	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
179	\N	\N	PHÊRÔ Nguyễn Việt Cường	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
180	\N	\N	MARIA Bùi Ngọc Linh Đan	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
181	\N	\N	SIMON PHAOLÔ Nguyễn Hoàng Đạt	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
200	\N	\N	ISAVE Nguyễn Ngọc Thủy Ngân	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
201	\N	\N	MARIA Phạm Ngọc Gia Ngyên	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
202	\N	\N	MARIA Trần Ngọc Uyên Nhi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
203	\N	\N	MARIA Mai Vũ Ngọc Nhi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
204	\N	\N	MARIA Lê Ngọc Nhi	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
205	\N	\N	MARIA Nguyễn Thị Quỳnh Như	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
206	\N	\N	TÊRÊSA Hà Trang Nhung	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
207	\N	\N	GIOAN Hoàng Thiên Phát	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
208	\N	\N	GIUSE Trần Đức Phát	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
209	\N	\N	PHILIPPHÊ Nguyễn Hoàng Minh Phúc	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
210	\N	\N	PHÊRÔ Lê Minh Phúc	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
211	\N	\N	GIUSE MARIA Nguyễn Minh Quân	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
212	\N	\N	GIUSE Trần Hiếu Thảo	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
213	\N	\N	TÊRÊSA Nguyễn Phạm Bảo Thy	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
214	\N	\N	ANNA Phạm Hoàng Thủy Tiên	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
215	\N	\N	MARIA Lê Trần Nguyên Trang	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
216	\N	\N	MARTINÔ Vũ Trần Đức Trí	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
217	\N	\N	ĐAMINH Đinh Phi Trường	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
218	\N	\N	PHÊRÔ Trần Đình Tùng	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
219	\N	\N	MARIA Nguyễn Đoàn Bảo Uyên	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
220	\N	\N	ANTÔN Ngô Công Vinh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
221	\N	\N	PHÊRÔ Nguyễn Phong Vinh	BAODONG3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.474686	2026-10-01 09:08:34.181219
224	\N	\N	GIUSE Cao Tấn Bình	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
227	\N	\N	MARIA Nguyễn Thị Nha	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
228	\N	\N	MARIA Nguyễn Thị Yến	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
236	\N	\N	MARIA Trịnh Thị Hoa	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
237	\N	\N	GIUSE Nguyễn Thanh Long	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
241	\N	\N	MARIA Trần Thị Duyên	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
242	\N	\N	MARIA Đào Thị Phương Thảo	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
244	\N	\N	PHANXICÔ XAVIÊ Vũ Đoàn Bảo Nguyên	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
246	\N	\N	MARIA Trần Ngọc Uyên	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
248	\N	\N	MARIA Nguyễn Huỳnh Khánh Nguyên	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
249	\N	\N	MARIA Nguyễn Thị Phước	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
251	\N	\N	MARIA Nguyễn Thị Thu Ngọc	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
254	\N	\N	GIUSE Phạm Tiến Chức	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
261	\N	\N	MADALENA Huỳnh Thị Ngọc Vy	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
264	\N	\N	LUCA Đỗ Đức Trọng	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
266	\N	\N	GIOAN Trần Văn Phương	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
268	\N	\N	ANTÔN Trần Nguyễn Xuân Lộc	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
269	\N	\N	MARIA Nguyễn Thị Xuyến	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
274	\N	\N	GIUSE Nguyễn Duy Pháp	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
276	\N	\N	ĐAMINH Trương Quang Chung	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
285	\N	\N	CELESTINÔ Nguyễn Quốc Bảo	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
286	\N	\N	LUI Lê Anh Minh	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
223	TN_BAODONG3_38U1	3328995786624073728	Phê Rô Trần Đình Tùng	BAODONG3	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/4c51fa70-2381-4e94-a7a0-4dfe678795a7.jpg	SYNCED	2026-09-30 05:36:03.474686	2026-10-01 09:11:40.371516
225	LM_DMHCCC_WMGW	3326007309951303680	ANNA Trần Thị Quy	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/fbcb46e2-8fd0-4e58-9174-6f8f7546e0a9.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.614804
230	LM_DMHCCC_4KZ3	3326385095140442112	MARIA Trần Thị Ngát	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/b56368cf-61fe-439a-8585-1c59d79161ce.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.622023
231	LM_DMHCCC_PJL6	3326392862773346304	MARIA Phạm Thị Mai	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/3433efb9-e8d3-4095-9ee1-243e36ae4dd2.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.631018
229	LM_DMHCCC_9QHS	3327100769005469696	MARIA Vũ Thị Ngát	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/d457eee4-ee79-451c-9195-204186e34c51.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.63708
226	LM_DMHCCC_T83U	3329347380171505664	CATARINA Nguyễn Thị Hương Giang	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/92f91378-79ed-427b-9386-645accc65084.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.652366
289	\N	\N	GIUSE Võ Hồng Em	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
291	\N	\N	TERESA Nguyễn Thị Mỹ Linh	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
292	\N	\N	Phan Tuấn Anh	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
997	TN_GLV_4ZLV	3318421576143077376	PHANXICÔ XAVIÊ Trần Nhật Minh Tân	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/a0a95749-5ba9-4cc8-b0f2-9402259fc24e.jpg	SYNCED	2026-10-01 09:11:40.089368	2026-10-01 09:11:40.089368
233	\N	\N	GIUSE Cao Tấn Lộc	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
234	\N	\N	MARIA Nguyễn Thị Thê	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
235	\N	\N	LUCA Đỗ Ngọc Lâm	DMHCCC	990730	Hội Viên	\N	PENDING	2026-09-30 05:36:03.549569	2026-10-01 09:08:34.181219
293	\N	\N	Nguyễn Trần Gia Bảo	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
294	\N	\N	Nguyễn Văn Đoàn	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
295	\N	\N	Phùng Văn Đức	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
296	\N	\N	Nguyễn Trí Hào	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
297	\N	\N	Nguyễn Đức Hùng	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
298	\N	\N	Nguyễn Mạnh Hùng	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
299	\N	\N	Phạm Đức Lượng	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
301	\N	\N	Đoàn Thanh Nhàn	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
302	\N	\N	Trần Ngọc Thảo Nhi	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
303	\N	\N	Nguyễn Văn Quang	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
304	\N	\N	Nguyễn Thị Mỹ Tâm	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
305	\N	\N	Trần Danh Thái	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
312	\N	\N	GIUSE Đoàn Gia Phú	KHAITAM1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.666323	2026-10-01 09:08:34.181219
313	\N	\N	MARIA Lý San San	KHAITAM1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.666323	2026-10-01 09:08:34.181219
314	\N	\N	MARIA Lê Nguyễn Thiên An	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
315	\N	\N	MARIA Nguyễn Huỳnh Khánh An	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
316	\N	\N	MARIA Nguyễn Linh Anh	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
317	\N	\N	GIOAN BAPTIST Nguyễn Kim Bảo	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
243	TN_GLV_ACIP	3318330549059190784	TERESA MARIA Nguyễn Thị Cương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/3bd097a7-242c-493b-951f-1bd18456796d.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.060312
275	TN_GLV_YFH0	3318416787397148672	MARIA Nguyễn Thị Thể	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/8b5bf3ee-9a01-4c97-ab23-4b320c41d082.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.074402
253	TN_GLV_ESNY	3318418277750800384	MARIA Hoàng Anh Thư	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/c91d682f-433a-4ea4-bf94-901b2d0d32c4.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.079724
256	TN_GLV_7A8J	3318422336469729280	GIUSE Phan Chính Hướng	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/7dec3b3a-cab6-467f-a738-9c7be17c052c.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.096999
240	TN_GLV_YNCN	3318424907527749632	TERESA Phùng Thị Tuyền	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/4a387268-102f-409f-8671-59dec16d0114.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.101442
247	TN_GLV_XY0C	3318450257800462336	MARIA Trần Ngọc Mai Phương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/81207a82-01ab-4fab-b769-30b086b9df2b.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.110024
267	TN_GLV_BKBJ	3318791672199905280	TERESA Nguyễn Thị Kiều	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/ba85fe6c-2738-4028-ab04-08749683ba06.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.116251
255	TN_GLV_B9RH	3319007037530046464	MATTA Phùng Nguyên Phương Nhi	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/d3382c28-8248-4e6c-95ed-601b91431f4a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.136391
252	TN_GLV_7O99	3319095003652816896	PHANXICÔ XAVIÊ Trần Nhật Minh Tân	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/ab8ef4f2-5b03-48bc-a596-c69353cb4981.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.141605
272	TN_GLV_EJKS	3319980022374072320	ĐA MINH Bùi Tấn Đạt	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/62667b8a-96a1-40d8-9cad-bf39009c7d77.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.156323
273	TN_GLV_FK2S	3320464283921285120	LUCIA Lê Thanh Minh Phương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/e30f9dcc-9bd5-4cd3-b134-4e901ea7903c.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.161374
265	TN_GLV_KBKT	3320466582416654336	ANNA Nguyễn Thị Lan Hương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/7e2e274a-4c48-4c37-9c06-08d55453256f.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.171834
257	TN_GLV_3QAP	3320468870753419264	MARIA Nguyễn Thị Thanh Tuyền	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/14e63f76-e062-4a8b-9120-8dd6215f4ea8.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.177193
262	TN_GLV_J7JL	3320489451355897856	PHÊRÔ Nguyễn Hoàng Anh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/81a35420-93a0-4802-8ef0-15b85a51600a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.188294
270	TN_GLV_0QFY	3318308764574023680	MARIA Nguyễn Huỳnh Khánh Uyên	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/73f97198-3d23-4a61-9cfe-5a30f20a0add.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.051407
258	TN_GLV_00PD	3319789794514436096	MARIA Phan Thị Hằng	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/4a0c5f80-6ae1-4ce8-9236-cc46a7056167.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.150904
250	TN_GLV_VVRL	3320492381521838080	TERESA Nguyễn Triệu Mỹ	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/1a252637-dde1-4e0f-b68f-7a1eedfa327d.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.193949
245	TN_GLV_RTTN	3323503762542166016	MARIA Nguyễn Thị Ngọc Linh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/56e2316b-3c17-4caa-a3b2-d0ed562d84e9.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.211565
260	TN_GLV_Z9C0	3323957150899765248	MARIA Nguyễn Thị Nam	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/0e72749c-d6a8-4a6e-abe3-6455ee28a97b.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.217294
263	TN_GLV_9FBU	3323957550256226304	MARIA Phạm Thị Thực	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/703f7b5b-4b1e-4dde-811f-448173c7dd83.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.223722
238	LM_DMHCCC_I2SG	3325595360948125696	MARIA Nguyễn Thị Thật	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/4514121a-3f94-4049-beec-5ebc3b7eca19.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.608514
239	LM_DMHCCC_GWQI	3330804726420733952	Bà Chiến Lêgio	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/f38b6769-adb8-4e66-b63c-ade569ebbf75.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.664097
277	\N	\N	GIUSE Nguyễn Chí Phú	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
280	\N	\N	GIOAN BAOTIXITA Vũ Hồng Ân	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
283	\N	\N	PHÊRÔ Trần Đình Thái	GLV	990653	Giáo Lý Viên	\N	PENDING	2026-09-30 05:36:03.577341	2026-10-01 09:08:34.181219
318	\N	\N	MARIA Nguyễn Thị Lan Chi	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
319	\N	\N	ANNA Lê Ngọc linh Đan	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
320	\N	\N	MARIA Bùi Ngọc Diệp	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
321	\N	\N	GIUSE Nguyễn Tiến Dũng	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
322	\N	\N	MARIA Nguyễn Đăng Minh Hằng	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
323	\N	\N	PHANXICÔ XAVIÊ Nguyễn Phú Gia Khiêm	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
324	\N	\N	Lý Anh Khôi	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
325	\N	\N	MARIA Thái Trúc Lâm	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
326	\N	\N	TÊRÊSA Đặng Trúc Nghi	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
327	\N	\N	MARIA Trần Vũ Bảo Ngọc	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
328	\N	\N	MARIA Nguyễn Huỳnh Mỹ Ngọc	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
331	\N	\N	MARIA Nguyễn Huỳnh Bảo Như	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
332	\N	\N	TÊRÊSA Nguyễn Ngọc Quỳnh Như	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
333	\N	\N	MARIA Nguyễn Đỗ Quyên	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
334	\N	\N	MAĐALÊNA Trần Thị Lan Thanh	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
335	\N	\N	MARIA Nguyễn Ngọc Khánh An	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
336	\N	\N	GIUSE Phạm Thiên Ân	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
337	\N	\N	ANTÔN Nguyễn Trần Đức Ân	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
338	\N	\N	TÊRÊSA Ngô Ngọc Anh	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
339	\N	\N	Nguyễn Ngọc Trâm Anh	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
340	\N	\N	GIOAN B. Nguyễn Hoàng Thiên Bảo	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
341	\N	\N	GIUSE Phùng Lê An Bình	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
342	\N	\N	GIUSE Nguyễn Tiến Dũng	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
344	\N	\N	MARIA Bùi Gia Hân	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
345	\N	\N	MARIA Võ Xuân Hạnh	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
346	\N	\N	GIUSE Lê Quốc Vũ Hoàng	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
347	\N	\N	MARIA Phùng Ngọc Khánh Huyền	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
348	\N	\N	GIUSE Đoàn Nguyên Khang	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
349	\N	\N	PHÊRÔ Lê Trần Duy Khang	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
350	\N	\N	GIOAN B. Trần Minh Khang	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
351	\N	\N	PHÊRÔ Nguyễn Xuân Hoàng Khôi	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
352	\N	\N	MARIA Lưu Hoàng Kim	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
353	\N	\N	MARIA Thái Trúc Lâm	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
354	\N	\N	ANNA Nguyễn Kim Ngọc	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
355	\N	\N	Bùi Nguyễn Trọng Phát	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
288	TN_GLV_8CQW	3318875957460205568	GIOAKIM Nguyễn Tâm Tỉnh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/9a4d7d0c-c7f1-4f62-b4cb-c947ba137ee0.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.126176
278	TN_GLV_MPFD	3318895424332365824	MARIA Nguyễn Thị Vy	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/900d36f1-8bec-4d7d-8fc5-0d51a7e57ee8.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.131171
284	TN_GLV_WTMA	3319107475684196352	GIOAN BAOTIXITA Võ Quốc Sang	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/9e88624a-81a8-49a2-8b8f-c23747fe7f85.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.145992
287	TN_GLV_IYPD	3320465446548799488	MARIA Nguyễn Mỹ Lệ	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/6daba4e8-c073-420c-8615-08868ada425a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.166163
308	TN_GLV_1BTM	3320474344940896256	Vinh sơn Nguyễn Văn Quang	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/2ed354eb-ca50-48af-9a35-5e14040084a9.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.182392
281	TN_GLV_UUYD	3320555706267992064	GIUSE Nguyễn Văn Phương	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/cdc3cc55-0c92-4f6a-8a05-8960d747eeb4.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.200682
307	TN_GLV_GAG3	3318869643774394368	Vinh Sơn Nguyễn Văn Đoàn	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/cd67259c-b6a8-4058-a78b-c84ccefd2853.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.121096
310	TN_GLV_8OXZ	3323973694744690688	JB Vũ Hồng Ân	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/702e92ab-a8d8-4cfc-a4b6-70045d17da58.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.238019
309	GLV_70	3320489451355897856	Phê-rô Nguyễn Hoàng Anh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/81a35420-93a0-4802-8ef0-15b85a51600a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 07:16:06.972659
311	TN_GLV_5Z9D	3324074415100002304	Luy Lê Anh Minh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/875c4eff-95d2-4cb6-9da8-f3b3175f3770.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.243561
290	TN_GLV_7P8S	3326851047594393600	AUGUSTINÔ Đặng Hùng	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/69752799-7b60-4026-bcdf-7a53890af636.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.274321
306	TN_GLV_68RW	3329800250893271040	GIUSE Nguyễn Thanh Long	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/e21af251-ac85-4257-9e79-6dcec638d25a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.515011
279	TN_GLV_LAQI	3331088036556439552	PHÊRÔ Hoàng Văn Nam	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/88559e00-e3eb-4f3b-be4b-6676009da112.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.537818
329	\N	\N	GIUSE Nguyễn Hải Nguyên	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
330	\N	\N	PHÊRÔ Trần Thành Nhân	KHAITAM2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.675684	2026-10-01 09:08:34.181219
356	\N	\N	Wang Thiệu Phong	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
357	\N	\N	GIOAN B. Võ Hoàng Phúc	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
358	\N	\N	MARIA Nguyễn Thị Phương Thảo	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
359	\N	\N	MARIA Lâm Nguyễn Ngọc Thảo	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
360	\N	\N	MARIA Bùi Anh Thư	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
361	\N	\N	PHÊRÔ Nguyễn Phú Tịnh	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
362	\N	\N	MARIA Trần Lê Hoàng Yến	KHAITAM3	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.7053	2026-10-01 09:08:34.181219
368	\N	\N	PHANXICÔ Phạm Gia Bảo	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
370	\N	\N	MARIA Ngô Lệ Lan Chi	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
373	\N	\N	MARIA Phạm Ngọc Diệp	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
374	\N	\N	GIUSE Lê Nguyễn Minh Đức	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
378	\N	\N	EMMANUEL Lê Hạo	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
391	\N	\N	MARIA Lê Ngọc An Nhiên	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
394	\N	\N	ANRÊ Nguyễn Lê Bá Quốc	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
395	\N	\N	GIUSE Mai Phúc Thịnh	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
396	\N	\N	MARIA Đặng Trần Giáng Tiên	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
400	\N	\N	RAPHAEL Lê Ngọc Huyền Chân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
401	\N	\N	GIUSE Nguyễn Tiến Dũng	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
402	\N	\N	LUCIA Huỳnh Thị Ngọc Hân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
403	\N	\N	PHÊRÔ Lê Anh Khoa	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
404	\N	\N	PHANXICÔ Dương Minh Khôi	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
405	\N	\N	MONICA Đinh Tuệ Lâm	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
406	\N	\N	MARIA Nguyễn Thùy Linh	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
407	\N	\N	PHANXICÔ Nguyễn Thiên Lộc	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
408	\N	\N	ĐAMINH Nguyễn Minh Long	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
409	\N	\N	ANNA Nguyễn Hoàng My	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
410	\N	\N	MARIA Trần Ngọc Khánh Ngân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
411	\N	\N	MARIA Trần Thị Phương Nghi	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
412	\N	\N	MARIA Nguyễn Khánh Ngọc	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
413	\N	\N	MARIA Lã Hà Gia Nguyên	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
414	\N	\N	TÊRÊSA Nguyễn Lường Yến Nhi	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
415	\N	\N	PHÊRÔ Nguyễn Gia Phúc	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
416	\N	\N	PHAOLÔ Đặng Ngọc Minh Quân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
417	\N	\N	GIUSE Nguyễn Trần Nhật Quân	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
418	\N	\N	MARIA Trần Bảo Quyên	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
419	\N	\N	TÔMA Nguyễn Phú Tài	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
420	\N	\N	GIUSE Nguyễn Quốc Thái	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
377	TN_THEMSUC1A_0S88	3328966772257718272	MARIA Phạm Trương Gia Hân	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/4fdd67df-d521-44be-adb0-8d615c15a9a9.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.319335
376	TN_THEMSUC1A_2EX4	3328995363662069760	MARIA TÊRÊSA Trần Thanh Hà	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ca805157-4cf7-4e58-96de-2df35f89c1e4.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.353809
366	TN_THEMSUC1A_2ZO3	3328995570265096192	MARIA Trương Quỳnh Anh	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/f4b3d4af-7f40-4a33-8223-1fbb3af3f83a.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.365749
375	TN_THEMSUC1A_3QYP	3328995874310193152	TÊRÊSA Nguyễn Thị Thu Hà	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/1cce40e3-a9e7-41bf-b124-09cbccfc4073.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.376784
372	TN_THEMSUC1A_6CUJ	3328996891386970112	PHÊRÔ Bạch Công Đăng	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/f56db1c3-e74e-4077-81e2-658e7af7c265.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.39856
371	TN_THEMSUC1A_AEVZ	3328998513097834496	MARIA Trần Linh Đan	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/0887a289-aef9-474d-be5a-9c09a91810a6.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.433062
367	TN_THEMSUC1A_AUYC	3328998667473387520	MARIA Trần Ngọc Ánh	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/becfddd0-fc84-4f9e-baa9-fe4ff875e92e.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.438332
379	TN_THEMSUC1A_BHCP	3328998914064908288	PHANXICÔ Đinh Vũ Minh Hiếu	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/3ac0aaf5-1624-41f8-b115-94759f326221.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.449811
363	TN_THEMSUC1A_EP29	3329000175828992000	GIUSE Trần Nam An	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/87ad8952-ba8f-4f2e-b4c8-c93169b0cf86.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.474185
343	TN_KHAITAM3_QD6D	3329146302435950592	GIOAN B. Trần Thiên Duy	KHAITAM3	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/caeaf0ca-35df-4348-97bb-b247e90e6c55.jpg	SYNCED	2026-09-30 05:36:03.7053	2026-10-01 09:11:40.48176
421	\N	\N	MARIA Nguyễn Võ Xuân Thảo	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
422	\N	\N	GIUSE Hoàng Chí Thiện	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
365	TN_THEMSUC1A_0QA6	3326358193973493760	Nguyễn Ngọc Thuỳ Anh	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/f97bb99d-750f-443a-a9c3-a8e7648dff7c.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.259881
386	\N	\N	MATTA Nguyễn Thị Ngọc Mai	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
387	\N	\N	MARIA Nguyễn Phan Diễm My	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
388	\N	\N	MARIA Đoàn Vũ Ánh Ngọc	THEMSUC1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.74369	2026-10-01 09:08:34.181219
423	\N	\N	MARIA Nguyễn Hoàng Anh Thư	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
424	\N	\N	GIUSE Nguyễn Minh Trí	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
425	\N	\N	MARIA Lê Nhã Trúc	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
426	\N	\N	INHAXIÔ Võ Đặng Khánh Tường	THEMSUC1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.793887	2026-10-01 09:08:34.181219
435	\N	\N	MARIA Lý Gia Hân	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
436	\N	\N	AUGUSTINÔ Nguyễn Minh Khang	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
437	\N	\N	PHÊRÔ Nguyễn Trịnh Tuấn Khang	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
440	\N	\N	TÊRÊSA Nguyễn Thị Trà My	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
441	\N	\N	GIUSE Nguyễn Gia Nguyên	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
442	\N	\N	GIUSE Nguyễn Khôi Nguyên	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
444	\N	\N	GIUSE Đỗ Gia Phúc	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
446	\N	\N	VINHSƠN Phạm Hoàng Quân	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
447	\N	\N	MARIA Ngô Như Quỳnh	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
449	\N	\N	TÊRÊSA Lê Ngọc Khả Ái	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
450	\N	\N	GIUSE Nguyễn Quốc An	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
451	\N	\N	ROSA Thẩm Phẩm Anh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
452	\N	\N	MARIA Võ Quỳnh Anh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
453	\N	\N	MARIA Ngô Ngọc Ánh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
454	\N	\N	GIOAN B. Sơn Gia Bảo	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
455	\N	\N	GIUSE Lê Huy Bảo	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
456	\N	\N	PHANXICÔ Nguyễn Gia Bảo	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
457	\N	\N	MARIA Phan Mai Ca	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
458	\N	\N	MARIA Nguyễn Minh Châu	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
459	\N	\N	CATARINA Huỳnh Khiết Đan	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
460	\N	\N	GIUSE Nguyễn Bạch Hải Đăng	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
461	\N	\N	MARIA Đoàn Gia Di	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
462	\N	\N	ANTÔN Hoàng Minh Đức	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
463	\N	\N	PHÊRÔ Dương Thái Duy	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
464	\N	\N	MARIA Phạm Nguyễn Gia Hân	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
465	\N	\N	MICAE Nguyễn Trung Hiếu	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
466	\N	\N	GIOAN Nguyễn Minh Hiếu	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
467	\N	\N	PHÊRÔ Lê Đăng Khoa	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
468	\N	\N	GIOAN PHAOLÔ II Phạm Anh Minh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
398	TN_THEMSUC1A_4GVC	3328996152241553408	PHAOLÔ Nguyễn Minh Trí	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/520fc538-b9f0-4176-b6a2-899d0960aa12.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.382002
381	TN_THEMSUC1A_53TY	3328996438259531776	TÔMA Trần Văn Hưng	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/0178b03b-1aab-4b78-8b8a-735cd961877a.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.387525
399	TN_THEMSUC1A_72AM	3328997169871978496	MATTA Lê Phương Uyên	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/685b21e5-c202-477c-81a2-0a39659fc0d8.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.403885
384	TN_THEMSUC1A_7JYJ	3328997362793185280	RAPHAEL Phạm Thế Khang	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/f2a4cf57-e82a-457f-85fa-bb15026c97aa.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.410363
389	TN_THEMSUC1A_87RS	3328997618746392576	ANNA Trương Ngọc Thảo Nguyên	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/824e7051-67d9-4176-ab2a-b66911167694.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.416258
390	TN_THEMSUC1A_8XI8	3328997893875957760	ANNA THÀNH Nguyễn Thị Tuyết Nhi	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/b5730630-e9a8-413c-97f5-9361a45f76a4.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.42125
397	TN_THEMSUC1A_9S71	3328998250257580032	MARIA Vũ Bảo Trân	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/22c68b7a-a3d6-492f-8926-bbd94bcd6914.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.42689
380	TN_THEMSUC1A_C0TL	3328999120072343552	PHAOLÔ Lê Đức Hòa	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/a3197833-e794-4edb-b420-765ab3b4027d.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.455643
385	TN_THEMSUC1A_CJT5	3328999320048369664	ANNA Thái Thị Trúc Linh	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/66e5b08b-4a99-4129-b742-3ec43dac385e.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.461165
393	TN_THEMSUC1A_D9U6	3328999597837123584	MARIA Lê Như	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/9198f391-40cb-495d-8602-7121923b1a50.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.467371
427	TN_THEMSUC_1C_YZBW	3329769151831998464	TÊRÊSA Nguyễn Đỗ Hoài An	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/644880c0-f738-4f56-9486-2a3be167a52e.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.509205
428	TN_THEMSUC_1C_PG82	3330371052592168960	MARIA Phạm Nguyễn Hà Anh	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/9bb28e83-a45f-4685-8639-21554def3fb0.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.521239
469	\N	\N	ĐAMINH Nguyễn Hải Nam	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
470	\N	\N	MARIA Phạm Yến Nhi	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
392	TN_THEMSUC1A_JR1Q	3328959937563852800	MAĐALÊNA Lâm Ngọc An Nhiên	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/7b42fbff-35e7-4716-95be-fa2f6bc83b41.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.307114
431	\N	\N	TÔMASÔ Trần Hoàng Gia Bảo	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
432	\N	\N	MARIA Đặng Phương Mỹ Chi	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
433	\N	\N	TÊRÊSA Trần Ngọc Lan Chi	THEMSUC1C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.827899	2026-10-01 09:08:34.181219
471	\N	\N	MARIA Mai Vũ Uyên Nhi	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
472	\N	\N	MARIA Trần Tú Nhi	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
473	\N	\N	LUCIA Phạm Thị Quỳnh Như	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
474	\N	\N	VINHSƠN Phạm Hồng Thiên Phát	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
475	\N	\N	PHANXICÔ Kiều Phong	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
476	\N	\N	PHÊRÔ Xích Công Thiện Phú	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
477	\N	\N	MICAE Phan Nguyễn Tiến Quốc	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
478	\N	\N	TÊRÊSA Trịnh Bùi Gia Quỳnh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
479	\N	\N	TÊRÊSA Đỗ Diễm Quỳnh	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
480	\N	\N	MARIA Huỳnh Thị Tiết Sương	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
481	\N	\N	PHÊRÔ Phạm Hoàng Tấn	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
482	\N	\N	ANNA Trần Thị Anh Thơ	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
483	\N	\N	TÊRÊSA Hà Huỳnh Cát Tiên	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
484	\N	\N	TÊRÊSA Nguyễn Bảo Trâm	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
489	\N	\N	MARIA Phạm Thảo An	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
490	\N	\N	MARIA Đặng Nguyễn Diệu Anh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
491	\N	\N	MARIA Nguyễn Ngọc Anh Anh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
492	\N	\N	GIÊRAĐÔ Phạm Bảo Anh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
493	\N	\N	PHÊRÔ Nguyễn Trung Gia Bảo	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
494	\N	\N	GIUSE Trần Thanh Gia Bảo	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
495	\N	\N	PHAOLÔ Phạm Thành Công	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
496	\N	\N	MICAE Nguyễn Trung Hiếu	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
497	\N	\N	TÔMA Nguyễn Trần Thái Hòa	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
499	\N	\N	GIOAN B. Ngô Mạnh Hùng	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
500	\N	\N	ANTÔN Vũ Mạnh Hùng	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
501	\N	\N	PHÊRÔ Trần Gia Hưng	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
502	\N	\N	ĐAMINH Lại Trần Quốc Huy	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
503	\N	\N	GIUSE Nguyễn Duy Khang	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
504	\N	\N	ĐAMINH Đinh Gia Khiêm	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
505	\N	\N	PHAOLÔ Nguyễn Bảo Khôi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
506	\N	\N	TÔMA Trần Nguyên Khôi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
507	\N	\N	ANTÔN Trương Trung Kiên	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
508	\N	\N	MARIA Bùi Nguyễn Nhật Lam	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
509	\N	\N	ANNA Nguyễn Lê Nhật Linh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
510	\N	\N	MICAE Nguyễn Uy Long	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
511	\N	\N	TÊRÊSA Đỗ Hà Uyên Minh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
512	\N	\N	MARIA Trần Phạm Khánh My	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
513	\N	\N	TÊRÊSA Lê Hoàng Thảo Nghi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
514	\N	\N	MARIA Trần Bảo Ngọc	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
515	\N	\N	MARIA Nguyễn Bảo Ngọc	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
516	\N	\N	MARIA Tạ Quỳnh Ngọc	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
517	\N	\N	MARIA Vũ Bảo Ngọc	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
518	\N	\N	ANNA Phan Ngọc Yến Nhi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
519	\N	\N	MARIA Trần Ngọc Trúc Như	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
520	\N	\N	PHÊRÔ Nguyễn Thanh Gia Phú	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
521	\N	\N	TÊRÊSA Phạm Vũ Minh Tâm	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
522	\N	\N	GIOAN B. Nguyễn Ngọc Minh Thắng	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
523	\N	\N	ĐAMINH Nguyễn Minh Thiện	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
434	TN_THEMSUC1C_4CFF	3328897607052296192	PHANXICÔ Vũ Minh Đăng	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/277583f7-2abc-4e26-85c8-f0fd7182cdf7.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.284887
439	TN_THEMSUC1C_5MST	3328898065976262656	MARIA Vũ Thị Trà My	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/2a5f3644-430a-4d0d-b4c3-70ac8bd9aea7.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.290734
443	TN_THEMSUC1C_7PX6	3328898956250841088	MARIA Trương Trần Tuyết Nhi	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ac1b83b7-c0d0-4d33-adbb-de4ea33c4129.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.296374
445	TN_THEMSUC1C_8IK9	3328899345977180160	MICAE Phan Vũ Minh Quân	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/e7f75a8c-cf85-47ef-8524-1391b616d98c.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.301708
524	\N	\N	ANPHONGSÔ Đỗ Phạm Quốc Thịnh	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
525	\N	\N	TÊRÊSA Hà Huỳnh Cát Tiên	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
448	TN_THEMSUC1C_YUAS	3326985968413573120	PHANXICÔ XAVIÊ Trần Hoàng Việt	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/9024dacd-c482-4263-bd08-6a4f550441ce.jpg	SYNCED	2026-09-30 05:36:03.827899	2026-10-01 09:11:40.279737
485	\N	\N	MARIA Trần Thị Tuyết	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
486	\N	\N	MATTA Lê Nhã Uyên	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
487	\N	\N	TÊRÊSA Trần Ngọc Lan Vy	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
488	\N	\N	MATTA Bùi Ngọc Hoàng Yến	THEMSUC2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.859373	2026-10-01 09:08:34.181219
526	\N	\N	ANTÔN Trương Chính Trực	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
527	\N	\N	GIUSE Mai Anh Tuấn	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
528	\N	\N	MARIA Lê Thị Thảo Vi	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
529	\N	\N	ANNA Trần Hải Yến	THEMSUC2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.90906	2026-10-01 09:08:34.181219
530	\N	\N	ANTÔN Nguyễn Minh Thiên Ân	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
531	\N	\N	LUCIA Trương Nguyễn Hồng Ân	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
532	\N	\N	MARIA Trần Đoàn Phương Anh	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
534	\N	\N	MARIA Nguyễn Trâm Anh	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
535	\N	\N	PHANXICÔ XAVIÊ Phạm Gia Bảo	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
536	\N	\N	TÔMASÔ Trần Gia Bảo	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
538	\N	\N	PHÊRÔ Nguyễn Trung Hiếu	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
539	\N	\N	GIUSE Hoàng Công Hiếu	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
540	\N	\N	ĐAMINH Đỗ Chí Hưng	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
542	\N	\N	GIUSE Phan Quốc Huy	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
544	\N	\N	MARIA Nguyễn Thị Mỹ Huyền	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
545	\N	\N	GIUSE Trương Tuấn Khang	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
546	\N	\N	MARIA Nguyễn Vũ Khánh Ngọc	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
547	\N	\N	MARIA Nguyễn Thị Minh Nguyệt	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
548	\N	\N	GIUSE Đào Quốc Phát	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
549	\N	\N	PHAOLÔ Nguyễn Hoàng Phi	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
550	\N	\N	MARIA Hoàng Anh Thư	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
551	\N	\N	TÔMASÔ Đặng Phúc Vinh	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
552	\N	\N	MICAE Trần Thái Vũ	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
553	\N	\N	ANNA Trần Phương Vy	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
554	\N	\N	TÊRÊSA Bùi Lê Khánh Vy	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
555	\N	\N	MATTA Nguyễn Như Ý	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
556	\N	\N	MARIA Nguyễn Hải Yến	THEMSUC2C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.958411	2026-10-01 09:08:34.181219
557	\N	\N	GIOAN Nguyễn Phúc An	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
558	\N	\N	MARIA Nguyễn Bảo Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
559	\N	\N	TÊRÊSA Phạm Ngọc Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
560	\N	\N	MARIA Nguyễn Ngọc Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
561	\N	\N	MARIA Nguyễn Lê Ngọc Minh Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
562	\N	\N	MARIA Nguyễn Thị Minh Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
563	\N	\N	MARIA Nguyễn Lê Đông Anh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
564	\N	\N	LUCA Hồ Tuấn Bảo	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
565	\N	\N	PHANXICÔ XAVIÊ Trần Gia Bảo	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
566	\N	\N	GIUSE Vũ Gia Bảo	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
567	\N	\N	MARIA Nguyễn Phạm Thiên Ân (tâm Bình)	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
568	\N	\N	MARIA Nguyễn Phạm Thiên Ân (như Bình)	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
569	\N	\N	GIUSE Phạm Đức Cường	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
570	\N	\N	GIUSE Nguyễn Thành Đạt	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
571	\N	\N	GIOAN B. Trần Tứ Đức	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
572	\N	\N	GIUSE Nguyễn Phùng Thiên Đức	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
573	\N	\N	PHÊRÔ Mai Nguyên Đức	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
574	\N	\N	MARIA Tống Hồng Ngọc Hà	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
575	\N	\N	PHÊRÔ Nguyễn Nhật Huy	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
576	\N	\N	MAĐALÊNA Phan Hoàng An Huyên	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
577	\N	\N	GIOAN Lê Nguyễn An Khang	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
578	\N	\N	GIOAN Phạm Trí Khang	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
579	\N	\N	GIUSE Nguyễn Đăng Khoa	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
580	\N	\N	GIOAN Trần Nguyên Khôi	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
581	\N	\N	PHAOLÔ Bùi Quán Kiệt	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
582	\N	\N	MARIA Huỳnh Phương Linh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
583	\N	\N	MARIA Nguyễn Ngọc Gia Linh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
584	\N	\N	MARIA Phạm Hoài Linh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
369	TN_THEMSUC1A_NB6E	3328961743941533696	PHÊRÔ Bùi Bối Bối	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/dec33767-7baf-4675-a784-df164b18720c.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.312815
222	TN_BAODONG3_02BA	3328995387393441792	Vicente Trần Uy Nam	BAODONG3	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/d8c06290-adbc-49ae-bc48-b363ac1eabc5.jpg	SYNCED	2026-09-30 05:36:03.474686	2026-10-01 09:11:40.359825
585	\N	\N	GIUSE Trương Thế Lộc	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
586	\N	\N	VINHSƠN Phạm Nguyễn Gia Minh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
587	\N	\N	PHAOLÔ Nguyễn Công Minh	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
588	\N	\N	TÊRÊSA Trần Dương Trà My	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
589	\N	\N	MARIA Lý Nguyễn Kim Ngân	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
590	\N	\N	TÊRÊSA Nguyễn Khánh Ngọc	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
591	\N	\N	MAĐALÊNA Nguyễn Thái Bảo Ngọc	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
592	\N	\N	MARIA Trương Phương Nhi	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
593	\N	\N	ANNA Nguyễn Hoàng Minh Thư	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
594	\N	\N	TÊRÊSA Huỳnh Nữ Ngọc Tiên	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
595	\N	\N	MARIA Đinh Ngọc Nhã Uyên	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
596	\N	\N	MARIA Phạm Ngọc Như ý	THEMSUC3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:03.994913	2026-10-01 09:08:34.181219
597	\N	\N	MARIA Nguyễn Lê Đông Anh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
598	\N	\N	PHÊRÔ Nguyễn Đình Thế Anh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
599	\N	\N	GIACÔBÊ Trần Bạch Hải Đăng	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
600	\N	\N	MARIA Đoàn Ngọc Thiên Di	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
601	\N	\N	PHAOLÔ Nguyễn Văn Đồng	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
602	\N	\N	MARIA Tống Hồng Ngọc Hà	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
604	\N	\N	GIOAN BAOTIXITA Nguyễn Minh Huy	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
605	\N	\N	PHÊRÔ Vương Đăng Khoa	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
606	\N	\N	MARIA Vũ Đoàn Khánh Linh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
607	\N	\N	MAĐALÊNA Nguyễn Thái Bảo Ngọc	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
608	\N	\N	GIUSE Phạm Nguyễn Khôi Nguyên	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
609	\N	\N	MARIA Nguyễn Hồ Như Nguyệt	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
610	\N	\N	GIUSE Lê Nguyễn Thiện Nhân	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
611	\N	\N	PHAOLÔ Nguyễn Võ Hoàng Nhật	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
612	\N	\N	MARIA Hoàng Nguyễn Phương Nhi	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
613	\N	\N	ANNA Nguyễn Ngọc Thảo Nhi	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
614	\N	\N	MARIA Vũ Võ Quỳnh Như	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
615	\N	\N	GIUSE Đỗ Ngọc Phát	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
616	\N	\N	ANTÔN Phạm Hoàng Phong	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
617	\N	\N	ĐAMINH Nguyễn Trần Gia Phúc	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
618	\N	\N	TÊRÊSA Nguyễn Mai Phước	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
619	\N	\N	MARIA Nguyễn Hoàng Nam Phương	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
620	\N	\N	MICAE Phan Vũ Anh Quân	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
621	\N	\N	GIUSE Bùi Trấn Quốc	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
622	\N	\N	GIUSE Võ Văn Quý	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
623	\N	\N	MARIA Nguyễn Đặng Ngọc Quyên	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
624	\N	\N	ANNA Vương Nguyễn Như Quỳnh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
625	\N	\N	PHANXICÔ Phan Võ Tấn Sinh	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
626	\N	\N	MARIA Phan Phương Thảo	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
627	\N	\N	MARIA Đặng Uyên Thảo	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
628	\N	\N	MARIA Vũ Minh Thư	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
629	\N	\N	PHÊRÔ Trần An Thuyên	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
630	\N	\N	Huỳnh Nữ Ngọc Tiên	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
631	\N	\N	MARIA Nguyễn Ngọc Bảo Trân	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
632	\N	\N	GIUSE Lê Minh Triết	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
633	\N	\N	PHÊRÔ Nguyễn Minh Tuấn	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
634	\N	\N	PHAOLÔ Nguyễn Thanh Tùng	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
635	\N	\N	MARIA Vũ Phạm Khánh Tường	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
636	\N	\N	GIACÔBÊ Võ Đặng Khánh Đình Vương	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
637	\N	\N	MARIA Nguyễn Ngọc Bảo An	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
638	\N	\N	GIUSE Nguyễn Thiên Ân	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
639	\N	\N	ANNA Đặng Trâm Anh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
640	\N	\N	MARIA Nguyễn Đinh Quỳnh Anh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
641	\N	\N	GIUSE Trần Bảo Anh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
642	\N	\N	GIUSE Trịnh Hoàng Anh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
643	\N	\N	CATARINA Nguyễn Khánh Băng	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
644	\N	\N	GIOAN Nguyễn Gia Bảo	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
645	\N	\N	GỈOAN Phạm Gia Bảo	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
646	\N	\N	MARIA Tạ Hoài Phương Chi	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
647	\N	\N	GIOAN Phan Thành Công	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
648	\N	\N	PHÊRÔ Vũ Phú Cường	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
649	\N	\N	TÊRÊSA Nguyễn Đỗ Linh Đan	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
603	\N	\N	GIOAN BAOTIXITA Nguyễn Thành Hưng	THEMSUC3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.037681	2026-10-01 09:08:34.181219
650	\N	\N	GIUSE Lê Tiến Đạt	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
651	\N	\N	VINHSƠN Nguyễn Văn Quốc Đạt	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
652	\N	\N	GIOAN Vũ Minh Đức	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
653	\N	\N	ANNA Hoàng Thị Diễm Hằng	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
654	\N	\N	PHAOLÔ Huỳnh Phước Huy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
655	\N	\N	PHANXICÔ Nguyễn Quốc Huy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
656	\N	\N	PHAOLÔ Vũ Minh Khoa	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
657	\N	\N	PHÊRÔ Nguyễn Đặng Quốc Kiệt	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
658	\N	\N	MARIA Huỳnh Phương Linh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
659	\N	\N	GIÊGÔRIÔ Trần Hoàng Long	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
660	\N	\N	PHANXICÔ Nguyễn Duy Mạnh	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
662	\N	\N	MARIA Trần Phạm Thảo My	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
663	\N	\N	ANNA Lê Khởi My	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
664	\N	\N	MARIA Trần Hồng Ngọc	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
665	\N	\N	ANTÔN Trịnh Quang Thành Nhân	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
666	\N	\N	MARIA Lê Vũ Yến Nhi	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
667	\N	\N	MARIA Trần Thảo Nhi	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
668	\N	\N	PHÊRÔ Võ Hoàng Phát	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
669	\N	\N	GIUSE Phạm Trí Quốc	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
670	\N	\N	MARIA Trương Huỳnh Anh Thư	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
671	\N	\N	ANNA Nguyễn Hoàng Minh Thư	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
672	\N	\N	MARIA Trần Hồ Bảo Trân	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
673	\N	\N	MARIA Vũ Kiều Trang	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
674	\N	\N	ANTÔN Trương Anh Tuấn	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
675	\N	\N	PHÊRÔ Trần Mạnh Tuấn	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
676	\N	\N	PHÊRÔ Vũ Văn Tùng	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
677	\N	\N	MARIA Lê Phương Uyên	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
678	\N	\N	MATTA Phạm Thị Kim Uyên	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
679	\N	\N	MARIA Trần Phạm Thảo Vy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
680	\N	\N	(DỰ TÒNG) Nguyễn Nhật Vy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
681	\N	\N	ANNA Nguyễn Khánh Vy	THEMSUC3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.096797	2026-10-01 09:08:34.181219
682	\N	\N	ANNA Hoàng Quỳnh Anh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
683	\N	\N	PHÊRÔ Bùi Mai Quang Anh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
684	\N	\N	GIUSE Nguyễn Bùi Hoàng Đạt	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
685	\N	\N	MARIA Nguyễn Thị Ngọc Diễm	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
686	\N	\N	MARIA Võ Nguyễn Khánh Hà	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
687	\N	\N	TÊRÊSA Trương Thanh Hiền	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
688	\N	\N	ĐAMINH Lê Văn Hoàng	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
689	\N	\N	PHÊRÔ Nguyễn Xuân Huy	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
690	\N	\N	PHÊRÔ Nguyễn Hoàng Lâm	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
691	\N	\N	TÊRÊSA Trương Thị Ngọc Lan	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
692	\N	\N	MARIA Phạm Hoàng Phương Linh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
693	\N	\N	TÊRÊSA Mai Ngọc Linh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
694	\N	\N	GIUSE Phạm Thành Lộc	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
695	\N	\N	URSULA Trần Thị Bảo Minh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
696	\N	\N	PHÊRÔ Bùi Mai Quang Minh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
697	\N	\N	VINHSƠN Vũ Hải Nam	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
698	\N	\N	INÊ Nguyễn Ngọc Ngân	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
699	\N	\N	MARIA Trần Thị Hồng Nhung	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
700	\N	\N	LUCA Nguyễn Lộc Phát	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
701	\N	\N	GIUSE Nguyễn Minh Phúc	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
702	\N	\N	MARIA Trần Mai Phương	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
703	\N	\N	MARIA Lã Hà Kiều Phương	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
704	\N	\N	GIOAN Nguyễn Việt Quang	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
705	\N	\N	GIUSE Vũ Hồ Thành Tâm	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
706	\N	\N	MARIA Vũ Kiều Thanh	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
707	\N	\N	MARIA Phạm Hoàng Minh Thùy	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
708	\N	\N	MARIA Nguyễn Bảo Thy	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
709	\N	\N	PHAOLÔ Nguyễn Văn Trường	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
710	\N	\N	TÊRÊSA Phan Ngọc Uyên	VAODOI1	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.151386	2026-10-01 09:08:34.181219
711	\N	\N	GIOAN Trần Gia Bảo	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
712	\N	\N	GIUSE Vũ Văn Cảnh	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
713	\N	\N	TÔMASÔ Phan Đình Chung	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
714	\N	\N	ANTÔN Nguyễn Trung Hà	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
715	\N	\N	MARIA Lê Thanh Hằng	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
716	\N	\N	GIUSE Nguyễn Mạnh Hùng	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
717	\N	\N	GIOAN B. Đỗ Ngọc Phước	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
718	\N	\N	PHAOLÔ Trần Hồng Quân	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
719	\N	\N	ANTÔN Trương Trung Quân	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
720	\N	\N	GIUSE Nguyễn Minh Quang	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
721	\N	\N	MARIA Nguyễn Bùi Thủy Trúc	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
722	\N	\N	MARIA Trần Thanh Vân	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
726	\N	\N	MARIA Bùi Phương Anh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
727	\N	\N	Nguyễn Lê Gia Bảo	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
728	\N	\N	Đan Quỳnh Chi	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
729	\N	\N	MARIA Nguyễn An Chi	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
730	\N	\N	GIUSE Phạm Tiến Đạt	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
731	\N	\N	ANNA Bùi Hạnh Dung	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
732	\N	\N	PHAOLÔ Nguyễn Huy Hải	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
733	\N	\N	GIUSE Phạm Tấn Hưng	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
734	\N	\N	PHANXICÔ Nguyễn Nhật Hưng	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
735	\N	\N	GIUSE Nguyễn Phúc Gia Khiêm	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
736	\N	\N	Hoàng Xuân Khôi	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
737	\N	\N	GIUSE Mai Tuấn Kiệt	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
738	\N	\N	ANÊ Phạm Gia Linh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
739	\N	\N	PHÊRÔ Phạm Văn Minh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
740	\N	\N	Nguyễn Bảo Nam	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
741	\N	\N	MARIA Trần Khánh Ngân	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
742	\N	\N	MARIA Nguyễn Bích Ngân	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
743	\N	\N	MARIA Nguyễn Ngọc Bảo Nhi	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
744	\N	\N	Đỗ An Nhiên	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
745	\N	\N	Lê Ngọc Quỳnh Như	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
746	\N	\N	PHÊRÔ Nguyễn Anh Phát	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
747	\N	\N	PHÊRÔ Nguyễn Đình Phong	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
748	\N	\N	PHÊRÔ Lê Ngọc Phúc	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
749	\N	\N	GIUSE Đoàn Quý Phước	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
750	\N	\N	PHANXICÔ XAVIÊ Nguyễn Văn Minh Quân	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
751	\N	\N	Đặng Trúc Quỳnh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
752	\N	\N	Nguyễn Ngọc Đan Quỳnh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
753	\N	\N	MARIA Nguyễn Ngọc Linh San	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
754	\N	\N	MARIA Hoàng Thục Tâm	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
755	\N	\N	GIUSE Dương Thành Thắng	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
756	\N	\N	PHÊRÔ Nguyễn Phúc Thịnh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
757	\N	\N	MARIA Đặng Uyên Thư	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
758	\N	\N	Trần Minh Thư	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
759	\N	\N	ANNA Lê Thị Mỹ Trinh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
760	\N	\N	MARIA Đỗ Ngọc Cát Tường	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
761	\N	\N	MARIA Nguyễn Bảo Yến	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
762	\N	\N	GIUSE Nguyễn Trần Thiên Ân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
763	\N	\N	PHÊRÔ Trần Nguyễn Thiên Ân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
765	\N	\N	PHANXICÔ Phạm Nguyễn Minh Anh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
766	\N	\N	MARIA Nguyễn Phạm Yên Chi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
767	\N	\N	MARIA Đinh Phương Chi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
769	\N	\N	Đỗ Ngọc Hân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
770	\N	\N	Cao Khả Hân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
771	\N	\N	AUGUSTINÔ Võ Gia Hưng	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
772	\N	\N	MARIA Nguyễn Lê Quỳnh Hương	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
774	\N	\N	ĐAMINH Nguyễn Minh Khang	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
775	\N	\N	GIUSE Bùi Nguyễn Minh Khôi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
776	\N	\N	PHÊRÔ Trần Đăng Khôi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
777	\N	\N	MARIA Nguyễn Quý Kiều	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
778	\N	\N	MARIA Trần Khánh Linh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
779	\N	\N	ANNA Nguyễn Ngọc Khánh Linh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
780	\N	\N	PHANXICÔ XAVIÊ Phạm Nguyễn Gia Minh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
781	\N	\N	VICENTÊ Nguyễn Thiện Nhân	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
782	\N	\N	MARIA Mai Quỳnh Như	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
785	\N	\N	GIUSE Nguyễn Hoàng Minh Phước	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
787	\N	\N	TÊRÊSA Đặng Nguyễn Anh Thư	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
788	\N	\N	MARIA Nguyễn Lê Huyền Thư	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
789	\N	\N	MARIA Nguyễn Ngọc Cát Tiên	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
723	\N	\N	MARIA Hoàng Hải Yến	VAODOI2	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.19325	2026-10-01 09:08:34.181219
724	\N	\N	VINHSƠN Hồ Thiên Ân	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
725	\N	\N	Nguyễn Quỳnh Anh	XUNGTOI1A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.213688	2026-10-01 09:08:34.181219
790	\N	\N	GIOAN Trần Tuấn Tú	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
791	\N	\N	PHÊRÔ Hoàng Thị Anh Tú	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
792	\N	\N	LUCIA Lê Nguyễn Tú Uyên	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
793	\N	\N	ANNA Lê Tường Vy	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
794	\N	\N	ANNA Nguyễn Bảo An	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
796	\N	\N	MARIA Nguyễn Hoàng Anh	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
797	\N	\N	GIUSE Đinh Gia Bảo	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
798	\N	\N	MARIA Phạm Phương Chi	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
800	\N	\N	PHÊRÔ Nguyễn Hải Đăng	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
802	\N	\N	TÊRÊSA Lê Ngọc Khả Hân	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
803	\N	\N	TÊRÊSA Nguyễn Thiên Hoa	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
804	\N	\N	VINHSƠN Phạm Gia Khiêm	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
806	\N	\N	PHÊRÔ Nguyễn Tuấn Kiệt	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
807	\N	\N	GIOAN B. Dương Hoàng Minh	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
808	\N	\N	MARIA Vũ Phạm Khánh My	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
809	\N	\N	MARIA Trương Hoàng Diễm My	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
810	\N	\N	MARIA Dương Hà My	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
811	\N	\N	Võ Nguyễn Khánh Ngọc	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
812	\N	\N	MARIA Nguyễn Thảo Nguyên	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
813	\N	\N	Nguyễn Gia Nhi	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
814	\N	\N	PHAOLÔ Nguyễn Quang Phúc	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
815	\N	\N	MATTA Trương Nguyễn Hồng Phước	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
816	\N	\N	MARIA Nguyễn Huỳnh Quyên	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
817	\N	\N	GIOAN Lê Nguyễn Phúc Thịnh	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
818	\N	\N	MARIA Trần Minh Trang Thư	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
819	\N	\N	PHÊRÔ Nguyễn Anh Tú	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
820	\N	\N	ANNA Nguyễn Ngọc Yến Vy	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
821	\N	\N	ANNA Võ Trần Như Ý	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
822	\N	\N	TÊRÊSA Nguyễn Hải Yến	XUNGTOI2A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.302486	2026-10-01 09:08:34.181219
823	\N	\N	MARIA Bùi Gia An	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
824	\N	\N	Trần Nguyễn Thiên Ân	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
825	\N	\N	MICAE Nguyễn Quốc Bảo	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
826	\N	\N	MARIA Nguyễn Ngọc Thuỳ Dung	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
827	\N	\N	TÊRÊSA Lê Ngọc Khả Hân	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
828	\N	\N	MARIA Nguyễn Thị Mỹ Hoà	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
829	\N	\N	MARIA Phạm Thiên Hương	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
831	\N	\N	TÊRÊSA Bùi Quỳnh Hương	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
832	\N	\N	GIUSE Mai Bảo Khang	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
833	\N	\N	GIOAN PHAOLO Nguyễn Phúc Gia Khang	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
834	\N	\N	ĐAMINH Tạ Minh Khang	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
835	\N	\N	GIUSE Trần Nguyễn Bảo Khánh	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
836	\N	\N	GIUSE Vũ Quốc Khánh	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
837	\N	\N	PHÊRÔ Nguyễn Anh Khoa	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
838	\N	\N	MARIA Lê Gia Linh	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
839	\N	\N	GIUSE Nguyễn Thành Long	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
840	\N	\N	ANNA Nguyễn A My	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
841	\N	\N	GIÊRÔNIMÔ Trần Hoàng Nghĩa	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
842	\N	\N	PHÊRÔ Nguyễn Hoàng Gia Phát	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
843	\N	\N	PHÊRÔ Nguyễn Hoàng Thiên Phúc	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
844	\N	\N	GIUSE Trần Thiên Phúc	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
845	\N	\N	GIUSE Vũ Minh Quân	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
846	\N	\N	MARIA Đoàn Nhã Thi	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
847	\N	\N	ANNA Trương Thuỷ Tiên	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
848	\N	\N	ANTÔN Nguyễn Nguyên Trực	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
849	\N	\N	GIUSE Hồ Xuân Trường	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
850	\N	\N	MARIA Đỗ Ngọc Như Ý	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
851	\N	\N	MARIA Mai Vũ Ngọc Yến	XUNGTOI2B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.346273	2026-10-01 09:08:34.181219
852	\N	\N	GIUSE Đoàn Bảo An	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
853	\N	\N	GIUSE Cao Bảo An	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
854	\N	\N	FAUSTINA Võ Trần Ngọc An	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
498	TN_THEMSUC2B_GQUW	3329157505522597888	ĐAMINH Nguyễn Việt Hoàng	THEMSUC2B	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/e3789e1e-7d15-4bfd-a9c0-d9e2fef5f3b1.jpg	SYNCED	2026-09-30 05:36:03.90906	2026-10-01 09:11:40.494607
783	\N	\N	ANNA Đõ Ánh Phi	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
784	\N	\N	PHÊRÔ Phan Nguyễn Hoàng Phúc	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
786	\N	\N	Đặng Trúc Quỳnh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
855	\N	\N	PHANXICÔ XAVIÊ Trần Nguyễn Thiên Ân	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
856	\N	\N	ANNA Nguyễn Ngọc Diệu Anh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
857	\N	\N	PHÊRÔ Lưu Hoàng Anh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
858	\N	\N	MARIA Nguyễn Đặng Ngọc Ánh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
859	\N	\N	PHÊRÔ Lê Nguyễn Thiên Bảo	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
860	\N	\N	GIUSE Võ Trần Tấn Bình	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
861	\N	\N	GIUSE Hồ Sỹ Minh Châu	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
862	\N	\N	PHÊRÔ Nguyên Hieu Duy	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
863	\N	\N	GIUSE Trịnh Sơn Hải	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
864	\N	\N	MARIA Nguyễn Lê Ngọc Hân	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
865	\N	\N	ANNA Nguyễn Ngọc Quỳnh Hoa	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
867	\N	\N	MARIA Đỗ Quỳnh Hương	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
868	\N	\N	SIMON  Sơn Gia Huy	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
869	\N	\N	PHÊRÔ Phạm Quang Khải	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
870	\N	\N	GIOAN PHAOLÔ II Chu Nguyên Khang	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
871	\N	\N	MARIA Nguyễn Ngọc Thiên Khánh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
872	\N	\N	AUGUSTINÔ Nguyễn Trần Gia Khiêm	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
873	\N	\N	PHANXICÔ Võ Lý Minh Khoa	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
874	\N	\N	PHÊRÔ Trần Nguyễn Nguyên Khôi	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
875	\N	\N	GIUSE Nguyễn Tuấn Kiệt	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
876	\N	\N	Lại Bảo Lâm	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
877	\N	\N	MARIA Vũ Phan Khánh Linh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
878	\N	\N	ANÊ Nguyễn Thị Thảo Nhi	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
879	\N	\N	MARIA Phạm Cát An Nhiên	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
880	\N	\N	ROSA Nguyễn Quỳnh Như	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
881	\N	\N	ANTÔN Trịnh Thanh Phong	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
882	\N	\N	AUGUSTINÔ Trần Văn Phúc	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
883	\N	\N	GIUSE Đinh Đặng Thiên Phước	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
884	\N	\N	CALORÔ Cao Nguyễn Hải Quân	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
885	\N	\N	MARIA Phan Thị Như Quỳnh	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
886	\N	\N	GIOAN Nguyễn Ngọc Thiện	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
887	\N	\N	MARIA Nguyễn Đặng Minh Trang	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
888	\N	\N	GIUSE Vũ Thành Trung	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
889	\N	\N	GIUSE Nguyễn Tuấn Tú	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
890	\N	\N	MARIA Bùi Thị Nhã Uyên	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
891	\N	\N	ANNA Nguyễn Thị Hải Yến	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
892	\N	\N	ANNA Trần Bạch Vy An	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
893	\N	\N	ĐAMINH Tạ Phúc An	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
894	\N	\N	PHÊRÔ Vũ Thiên Ân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
895	\N	\N	PHÊRÔ Danh Nguyễn Thiên Ân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
896	\N	\N	VICENTÊ ĐặngThiên Ân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
897	\N	\N	VICENTÊ Phạm Tuấn Anh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
898	\N	\N	PHÊRÔ Lê Nguyễn Gia Bảo	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
901	\N	\N	PHÊRÔ Lê Tấn Đạt	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
902	\N	\N	PHÊRÔ Nguyễn Đức Duy	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
903	\N	\N	MARIA Nguyễn Ngọc Bảo Hân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
904	\N	\N	Phạm Huy Hoàng	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
905	\N	\N	TÊRÊSA Nguyễn Ánh Hồng	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
906	\N	\N	PHÊRÔ Phạm Văn Huy	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
907	\N	\N	GIUSE Phạm Gia Khiêm	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
908	\N	\N	PHILIPPHÊ Trần Đăng Khoa	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
801	TN_XUNGTOI2A_7K3S	3328969255352795136	MARIA Trương Gia Hân	XUNGTOI2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/393cb3de-075c-428e-ae39-18c5ae3755dc.jpg	SYNCED	2026-09-30 05:36:04.302486	2026-10-01 09:11:40.336677
805	TN_XUNGTOI2A_8YER	3328969797676302336	ĐAMINH Phạm Trung Kiên	XUNGTOI2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ab37d55b-74e1-4921-a1de-fb8d4bbad44b.jpg	SYNCED	2026-09-30 05:36:04.302486	2026-10-01 09:11:40.342038
909	\N	\N	GIUSE Bùi Anh Khoa	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
910	\N	\N	ANRÊ Lê Đăng Khôi	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
911	\N	\N	MARIA PhạmThị Liên	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
799	TN_XUNGTOI2A_6TTX	3328968970609885184	ANNA Nguyễn Phạm Thảo Chi	XUNGTOI2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/8716bf4d-c908-493c-8789-2f2652403f10.jpg	SYNCED	2026-09-30 05:36:04.302486	2026-10-01 09:11:40.33181
866	\N	\N	Hà Gia Hưng	XUNGTOI3A	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.392903	2026-10-01 09:08:34.181219
912	\N	\N	MARIA Phạm Trúc Linh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
913	\N	\N	INHAXIÔ Hoàng Đức Mạnh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
914	\N	\N	PHÊRÔ Nguyễn Nhật Minh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
915	\N	\N	MARIA Phạm Ngọc Khánh My	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
916	\N	\N	MARIA Nguyễn Khánh Ngân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
917	\N	\N	TÊRÊSA Nguyễn Bảo Ngọc	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
918	\N	\N	GIUSE Nguyễn Hoàng Nhân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
919	\N	\N	MARIA Nguyễn An Nhiên	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
920	\N	\N	TÔMA Hoàng Minh Quân	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
921	\N	\N	FAUSTINA Nguyễn Ngọc Đỗ Quyên	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
922	\N	\N	ĐAMINH Đinh Trường Thành	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
923	\N	\N	GIUSE Phạm Minh Thiện	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
924	\N	\N	ANNA Huỳnh Anh Thư	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
925	\N	\N	MARIA Trần Thảo Tiên	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
926	\N	\N	MARIA Nguyễn Ngọc Bảo Trâm	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
927	\N	\N	TÊRÊSA Trần Nguyễn Uyên Trinh	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
928	\N	\N	ANNA Nguyễn Thanh Trúc	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
929	\N	\N	MARIA Nguyễn Danh Thảo Vy	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
930	\N	\N	MARIA Trần Thảo Vy	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
931	\N	\N	MARIA Triệu Nguyễn Như Ý	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
932	\N	\N	MARIA Lâm Nguyễn Bảo An	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
933	\N	\N	MARIA Vũ Thiên An	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
934	\N	\N	MARTINÔ Phạm Nguyễn Bình An	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
935	\N	\N	PHÊRÔ Nguyễn Thiên Ân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
937	\N	\N	MARIA Nguyễn Hoài Ân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
938	\N	\N	Hồ Việt Anh	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
939	\N	\N	GIUSE Nguyễn Trần Hoàng Gia Gia Bảo	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
940	\N	\N	PHÊRÔ Trần Nguyễn Gia Bảo	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
941	\N	\N	GIOAN Phạm Lê Hải Đăng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
942	\N	\N	GIUSE Trần Quốc Đông	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
943	\N	\N	GIOAN Lê Dương Han	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
944	\N	\N	MARIA Nguyễn Ngọc Khánh Hân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
945	\N	\N	GIUSE Phạm Minh Hiền	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
946	\N	\N	MARIA Trần Thái Hòa	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
947	\N	\N	STÊPHANÔ Lê Thanh Nhật Hoàng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
948	\N	\N	PHÊRÔ Nguyễn Thái Tuấn Hoàng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
949	\N	\N	GIUSE Trần Bảo Hưng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
950	\N	\N	GIUSE Trương Gia Hưng	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
951	\N	\N	PHAOLÔ Quang Đức Huy	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
952	\N	\N	MARIA Phan Diệu Huyền	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
953	\N	\N	GIUSE Nguyễn Lê Nhật Huynh	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
954	\N	\N	PHÊRÔ Nguyễn Gia Khánh	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
955	\N	\N	GIUSE Vũ Đăng Khoa	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
956	\N	\N	ANRÊ Bùi Nhật Đăng Khôi	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
957	\N	\N	VINHSƠN Lâm Hoàng Khôi	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
966	\N	\N	GIUSE Hồ Xuân Nguyên	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
967	\N	\N	TÊRÊSA Nguyễn Ngọc An Nhiên	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
968	\N	\N	GIUSE Lê Nguyễn Gia Phúc	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
969	\N	\N	GIUSE Huỳnh Minh Sơn	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
970	\N	\N	PHAOLÔ Ngô Huỳnh Thế Thiện	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
971	\N	\N	MARIA Trương Kiều Trang	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
972	\N	\N	CATARINA Đoàn Ngọc Khả Tú	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
973	\N	\N	ANNA Lê Nguyễn Nhã Uyên	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
974	\N	\N	GIUSE Nguyễn Minh Kiều Văn	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
975	\N	\N	PHÊRÔ Bùi Tuấn Vũ	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
976	\N	\N	MARIA Phạm Trần Thảo Vy	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
977	\N	\N	MARIA Nguyễn Danh Thảo Vy	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
978	\N	\N	MARIA Trần Thị Cát Vy	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
979	\N	\N	Đoàn Vũ Hải Yến	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
998	TN_GLV_U77E	\N	GIOAN Phạm Tiến Chức	GLV	990653	Giáo Lý Viên	http://localhost:3000/uploads/processed_1790846647982_2.jpg	FAILED	2026-10-01 09:24:08.387174	2026-10-01 09:24:11.780118
899	\N	\N	PHÊRÔ Bùi Minh Bảo Cường	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
900	\N	\N	SIMON  Nguyễn Xuân Hoàng Đăng	XUNGTOI3B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.450243	2026-10-01 09:08:34.181219
958	\N	\N	GIUSE Trần Đinh Nhật Long	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
959	\N	\N	TÊRÊSA Nguyễn Khánh Ly	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
960	\N	\N	ANNA Nguyễn Thị Trà My	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
961	\N	\N	ĐAMINH Lê Hồ Văn Nam	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
962	\N	\N	MARIA Ngô Hoàng Kim Ngân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
963	\N	\N	MAĐALÊNA Huỳnh Thị Ngọc Ngân	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
964	\N	\N	TÊRÊSA Vũ Thiên Minh Ngọc	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
965	\N	\N	MARIA Trần Lê Khánh Ngọc	XUNGTOI3C	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.506426	2026-10-01 09:08:34.181219
984	TN_THEMSUC2C_11JA	3331433337163087872	PHÊRÔ Lê Nguyễn Gia Huy	THEMSUC2C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/eb2d19b2-9bb9-49c2-9aec-da5e8340ed98.jpg	SYNCED	2026-09-30 12:03:15.129752	2026-10-01 09:11:40.547028
985	TN_THEMSUC1C_QIBI	3331470658163965952	MARIA Nguyễn Trần Lan Anh	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/98a8796a-b739-466d-827b-b502d3e6f544.jpg	SYNCED	2026-09-30 13:17:24.203824	2026-10-01 09:11:40.551807
259	TN_GLV_FNWD	3318304752428646400	PHÊRÔ Trần Minh Mẫn	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/0e29c5cb-4cc5-495b-ba6a-018b36eedbc6.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.043442
300	TN_GLV_SMY2	3318364624818012160	Võ Thị Mơ	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/951128e7-0a60-4390-9b6a-29a4bc466779.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.067164
282	TN_GLV_089I	3323973138915524608	TÔMA AQUINÔ Trần Ngọc Bích	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/e77d56df-1412-41ef-b15b-5c12cdc4360a.jpg	SYNCED	2026-09-30 05:36:03.577341	2026-10-01 09:11:40.231471
364	TN_THEMSUC1A_ZG1P	3326101836275908608	PHAOLÔ Lê Trần Thiên Ân	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/7d24f682-7fb6-4a0a-9970-1a67ed037b91.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.25282
383	TN_THEMSUC1A_EZB8	3326761102288617472	GIUSE Trần Gia Khang	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ad19b3f4-fc82-4cb7-9b31-990ff87f510b.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.268063
795	TN_XUNGTOI2A_4BDI	3328968207531769856	TÊRÊSA Mai Vũ Hồng Ân	XUNGTOI2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/106bc219-8050-435a-aa21-545689419ebe.jpg	SYNCED	2026-09-30 05:36:04.302486	2026-10-01 09:11:40.325589
193	TN_BAODONG3_YS03	3328993938504679424	MATTA Vũ Thị Diệu Linh	BAODONG3	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/782fa8e3-9be7-4e62-aca2-06aeb87de788.jpg	SYNCED	2026-09-30 05:36:03.474686	2026-10-01 09:11:40.347448
382	TN_THEMSUC1A_5T0Y	3328996715687575552	GIOAN Nguyễn Viết Thiện Hữu	THEMSUC1A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/39ffe66f-8c84-4007-b93f-5fcb383fb6bf.jpg	SYNCED	2026-09-30 05:36:03.74369	2026-10-01 09:11:40.393465
983	TN_THEMSUC2C_ZYA1	3331391626789519360	MARIA Phạm Quỳnh Anh	THEMSUC2C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/065402bc-b1e2-401a-9095-b7ed39d7c046.jpg	SYNCED	2026-09-30 10:40:22.778248	2026-10-01 09:11:40.542214
986	TN_THEMSUC1C_REIQ	3331470946522365952	MARIA Phạm Vân Anh	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/1752645b-8360-442d-9ac5-ad2beca0f560.jpg	SYNCED	2026-09-30 13:17:58.531958	2026-10-01 09:11:40.556651
987	TN_THEMSUC1C_S9S3	3331471323414134784	PHÊRÔ Phạm Vũ Huy Khang	THEMSUC1C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/7a6a3e21-d9b0-4de9-baad-752249a5c27b.jpg	SYNCED	2026-09-30 13:18:42.544005	2026-10-01 09:11:40.561245
990	TN_BAODONG2A_5B89	3331533535302385664	MARIA Hoàng Thị Kim Ngân	BAODONG2A	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/0aef1cf8-0294-4fe3-b6e5-3191398e057a.jpg	SYNCED	2026-09-30 15:22:19.700252	2026-10-01 09:11:40.566107
991	TN_GLV_5CVP	3331942900354252800	TÔMA Hoàng Thành Lợi	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/149e5092-039c-40a8-a231-95c6058507c9.jpg	SYNCED	2026-10-01 04:55:39.633953	2026-10-01 09:11:40.570958
992	TN_GLV_PPZD	3332005623570104320	Terexa Nguyễn Thị Mỹ Linh	GLV	990653	Giáo Lý Viên	https://static.hanet.ai/face/employee/998577/972dbdf3-8e14-40b3-bbf1-e13e136980c8.jpg	SYNCED	2026-10-01 07:00:16.559837	2026-10-01 09:11:40.576449
936	TN_XUNGTOI3C_SOIG	3329146769899520000	PHANXICÔ XAVIÊ Trần Nguyễn Thiên Ân	XUNGTOI3C	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/3db68062-a76f-4492-9d12-e0c3e2fbe3c0.jpg	SYNCED	2026-09-30 05:36:04.506426	2026-10-01 09:11:40.488582
768	TN_XUNGTOI1B_ZVP4	3329248063356141568	VINHSƠN Phạm Gia Đạt	XUNGTOI1B	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/5af00c44-a79a-486e-ab84-68c5120336b9.jpg	SYNCED	2026-09-30 05:36:04.260115	2026-10-01 09:11:40.502245
994	TN_THEMSUC_2C_RAUX	3330766809635749888	Phêrô NGUYỄN TRUNG HIẾU (thêm sức 2c	THEMSUC	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/e206de14-b2d1-4097-82eb-cb9c88ff3f78.jpg	SYNCED	2026-10-01 07:16:07.253109	2026-10-01 09:11:40.526458
995	TN_THEMSUC_2C_S0CZ	3330767313816256512	GIUSE Phan Quốc Huy	THEMSUC	990653	Học Sinh	https://static.hanet.ai/face/employee/998577/ec6ecb28-2c31-4365-a083-44927f12389c.jpg	SYNCED	2026-10-01 07:16:07.261772	2026-10-01 09:11:40.532572
232	LM_DMHCCC_0AX6	3329318864474341376	GIUSE Nguyễn Quốc Tuấn	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/df99bbae-2f12-4ae9-bd1e-320df10e45e2.jpg	SYNCED	2026-09-30 05:36:03.549569	2026-10-01 09:11:40.64642
996	LM_DMHCCC_FV9O	3329888368933732352	Chú Long Lêgiô	DMHCCC	990730	Hội Viên	https://static.hanet.ai/face/employee/998577/0439bc4e-894a-4370-843d-d5a200759ecb.jpg	SYNCED	2026-10-01 07:16:07.373604	2026-10-01 09:11:40.657685
764	\N	\N	Trương Quốc Anh	XUNGTOI1B	990653	Học Sinh	\N	PENDING	2026-09-30 05:36:04.260115	2026-10-01 09:08:34.181219
\.


--
-- Name: audit_logs_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_logs_id_seq', 17, true);


--
-- Name: classes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.classes_id_seq', 130, true);


--
-- Name: persons_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.persons_id_seq', 998, true);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: classes classes_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_name_key UNIQUE (name);


--
-- Name: classes classes_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_pkey PRIMARY KEY (id);


--
-- Name: departments departments_code_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_code_key UNIQUE (code);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: persons persons_alias_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_alias_id_key UNIQUE (alias_id);


--
-- Name: persons persons_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_pkey PRIMARY KEY (id);


--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action);


--
-- Name: idx_audit_logs_created_at; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_audit_logs_created_at ON public.audit_logs USING btree (created_at DESC);


--
-- Name: idx_classes_name; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_classes_name ON public.classes USING btree (name);


--
-- Name: idx_persons_alias; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_alias ON public.persons USING btree (alias_id);


--
-- Name: idx_persons_name_class; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_name_class ON public.persons USING btree (name, class_name);


--
-- Name: idx_persons_person_id; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_person_id ON public.persons USING btree (person_id);


--
-- Name: idx_persons_sync_status; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_persons_sync_status ON public.persons USING btree (sync_status);


--
-- Name: classes classes_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.classes
    ADD CONSTRAINT classes_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- Name: persons persons_class_name_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_class_name_fkey FOREIGN KEY (class_name) REFERENCES public.classes(name) ON DELETE SET NULL;


--
-- Name: persons persons_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.persons
    ADD CONSTRAINT persons_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id) ON DELETE SET NULL;


--
-- PostgreSQL database dump complete
--

\unrestrict qVjNTS3Ghv3LUVp6pTjhvB1h5IS4EzR9acVsT4WAACATaZDigRka6ROwEvK3buZ


```

### File SQL: `./migrations/005_create_transfer_snapshots.sql`
```sql
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

```

---
## 3. CẤU TRÚC THƯ MỤC DỰ ÁN
```text
.
├── Dockerfile
├── HUONG_DAN_CAU_TRUC_VA_QUY_TAC.md
├── PROJECT_ARCHITECTURE_UNIFIED.md
├── bundle_project.sh
├── data
│   ├── BAODONG1A.csv
│   ├── BAODONG1B.csv
│   ├── BAODONG1C.csv
│   ├── BAODONG2A.csv
│   ├── BAODONG2B.csv
│   ├── BAODONG3.csv
│   ├── DMHCCC.csv
│   ├── GLV.csv
│   ├── KHAITAM1.csv
│   ├── KHAITAM2.csv
│   ├── KHAITAM3.csv
│   ├── OLD.THIEUNHI.CSV.bak
│   ├── THEMSUC1A.csv
│   ├── THEMSUC1B.csv
│   ├── THEMSUC1C.csv
│   ├── THEMSUC2A.csv
│   ├── THEMSUC2B.csv
│   ├── THEMSUC2C.csv
│   ├── THEMSUC3A.csv
│   ├── THEMSUC3B.csv
│   ├── THEMSUC3C.csv
│   ├── THIEUNHI.CSV.bak
│   ├── VAODOI1.csv
│   ├── VAODOI2.csv
│   ├── XUNGTOI1A.csv
│   ├── XUNGTOI1B.csv
│   ├── XUNGTOI2A.csv
│   ├── XUNGTOI2B.csv
│   ├── XUNGTOI3A.csv
│   ├── XUNGTOI3B.csv
│   └── XUNGTOI3C.csv
├── data_archived_csv_backup
├── data_backup_csv_archived
│   ├── BAODONG1A.csv
│   ├── BAODONG1B.csv
│   ├── BAODONG1C.csv
│   ├── BAODONG2A.csv
│   ├── BAODONG2B.csv
│   ├── BAODONG3.csv
│   ├── DMHCCC.csv
│   ├── GLV.csv
│   ├── KHAITAM1.csv
│   ├── KHAITAM2.csv
│   ├── KHAITAM3.csv
│   ├── OLD.THIEUNHI.CSV.bak
│   ├── THEMSUC1A.csv
│   ├── THEMSUC1B.csv
│   ├── THEMSUC1C.csv
│   ├── THEMSUC2A.csv
│   ├── THEMSUC2B.csv
│   ├── THEMSUC2C.csv
│   ├── THEMSUC3A.csv
│   ├── THEMSUC3B.csv
│   ├── THEMSUC3C.csv
│   ├── THIEUNHI.CSV.bak
│   ├── VAODOI1.csv
│   ├── VAODOI2.csv
│   ├── XUNGTOI1A.csv
│   ├── XUNGTOI1B.csv
│   ├── XUNGTOI2A.csv
│   ├── XUNGTOI2B.csv
│   ├── XUNGTOI3A.csv
│   ├── XUNGTOI3B.csv
│   └── XUNGTOI3C.csv
├── database_backup
│   └── vps_sync_backup.sql
├── docker-compose.yml
├── error.log
├── fixForceUpdateInfo.js
├── fixNormalizeAllHanet.js
├── fixNormalizeHanetAlias.js
├── fixRandomSuffixAlias.js
├── fixRemoveUnderscoreInClass.js
├── fix_3_safe.js
├── fix_alias.js
├── fix_hanet_alias.js
├── inspect_hanet.js
├── logs
│   └── audit.log
├── migrations
│   └── 005_create_transfer_snapshots.sql
├── package-lock.json
├── package.json
├── postgres_data
│   ├── PG_VERSION
│   ├── base
│   │   ├── 1
│   │   │   ├── 112
│   │   │   ├── 113
│   │   │   ├── 1247
│   │   │   ├── 1247_fsm
│   │   │   ├── 1247_vm
│   │   │   ├── 1249
│   │   │   ├── 1249_fsm
│   │   │   ├── 1249_vm
│   │   │   ├── 1255
│   │   │   ├── 1255_fsm
│   │   │   ├── 1255_vm
│   │   │   ├── 1259
│   │   │   ├── 1259_fsm
│   │   │   ├── 1259_vm
│   │   │   ├── 13494
│   │   │   ├── 13494_fsm
│   │   │   ├── 13494_vm
│   │   │   ├── 13497
│   │   │   ├── 13498
│   │   │   ├── 13499
│   │   │   ├── 13499_fsm
│   │   │   ├── 13499_vm
│   │   │   ├── 13502
│   │   │   ├── 13503
│   │   │   ├── 13504
│   │   │   ├── 13504_fsm
│   │   │   ├── 13504_vm
│   │   │   ├── 13507
│   │   │   ├── 13508
│   │   │   ├── 13509
│   │   │   ├── 13509_fsm
│   │   │   ├── 13509_vm
│   │   │   ├── 13512
│   │   │   ├── 13513
│   │   │   ├── 1417
│   │   │   ├── 1418
│   │   │   ├── 174
│   │   │   ├── 175
│   │   │   ├── 2187
│   │   │   ├── 2224
│   │   │   ├── 2228
│   │   │   ├── 2328
│   │   │   ├── 2336
│   │   │   ├── 2337
│   │   │   ├── 2579
│   │   │   ├── 2600
│   │   │   ├── 2600_fsm
│   │   │   ├── 2600_vm
│   │   │   ├── 2601
│   │   │   ├── 2601_fsm
│   │   │   ├── 2601_vm
│   │   │   ├── 2602
│   │   │   ├── 2602_fsm
│   │   │   ├── 2602_vm
│   │   │   ├── 2603
│   │   │   ├── 2603_fsm
│   │   │   ├── 2603_vm
│   │   │   ├── 2604
│   │   │   ├── 2605
│   │   │   ├── 2605_fsm
│   │   │   ├── 2605_vm
│   │   │   ├── 2606
│   │   │   ├── 2606_fsm
│   │   │   ├── 2606_vm
│   │   │   ├── 2607
│   │   │   ├── 2607_fsm
│   │   │   ├── 2607_vm
│   │   │   ├── 2608
│   │   │   ├── 2608_fsm
│   │   │   ├── 2608_vm
│   │   │   ├── 2609
│   │   │   ├── 2609_fsm
│   │   │   ├── 2609_vm
│   │   │   ├── 2610
│   │   │   ├── 2610_fsm
│   │   │   ├── 2610_vm
│   │   │   ├── 2611
│   │   │   ├── 2612
│   │   │   ├── 2612_fsm
│   │   │   ├── 2612_vm
│   │   │   ├── 2613
│   │   │   ├── 2615
│   │   │   ├── 2615_fsm
│   │   │   ├── 2615_vm
│   │   │   ├── 2616
│   │   │   ├── 2616_fsm
│   │   │   ├── 2616_vm
│   │   │   ├── 2617
│   │   │   ├── 2617_fsm
│   │   │   ├── 2617_vm
│   │   │   ├── 2618
│   │   │   ├── 2618_fsm
│   │   │   ├── 2618_vm
│   │   │   ├── 2619
│   │   │   ├── 2619_fsm
│   │   │   ├── 2619_vm
│   │   │   ├── 2620
│   │   │   ├── 2650
│   │   │   ├── 2651
│   │   │   ├── 2652
│   │   │   ├── 2653
│   │   │   ├── 2654
│   │   │   ├── 2655
│   │   │   ├── 2656
│   │   │   ├── 2657
│   │   │   ├── 2658
│   │   │   ├── 2659
│   │   │   ├── 2660
│   │   │   ├── 2661
│   │   │   ├── 2662
│   │   │   ├── 2663
│   │   │   ├── 2664
│   │   │   ├── 2665
│   │   │   ├── 2666
│   │   │   ├── 2667
│   │   │   ├── 2668
│   │   │   ├── 2669
│   │   │   ├── 2670
│   │   │   ├── 2673
│   │   │   ├── 2674
│   │   │   ├── 2675
│   │   │   ├── 2678
│   │   │   ├── 2679
│   │   │   ├── 2680
│   │   │   ├── 2681
│   │   │   ├── 2682
│   │   │   ├── 2683
│   │   │   ├── 2684
│   │   │   ├── 2685
│   │   │   ├── 2686
│   │   │   ├── 2687
│   │   │   ├── 2688
│   │   │   ├── 2689
│   │   │   ├── 2690
│   │   │   ├── 2691
│   │   │   ├── 2692
│   │   │   ├── 2693
│   │   │   ├── 2696
│   │   │   ├── 2699
│   │   │   ├── 2701
│   │   │   ├── 2702
│   │   │   ├── 2703
│   │   │   ├── 2704
│   │   │   ├── 2753
│   │   │   ├── 2753_fsm
│   │   │   ├── 2753_vm
│   │   │   ├── 2754
│   │   │   ├── 2755
│   │   │   ├── 2756
│   │   │   ├── 2757
│   │   │   ├── 2830
│   │   │   ├── 2831
│   │   │   ├── 2832
│   │   │   ├── 2833
│   │   │   ├── 2834
│   │   │   ├── 2835
│   │   │   ├── 2836
│   │   │   ├── 2836_fsm
│   │   │   ├── 2836_vm
│   │   │   ├── 2837
│   │   │   ├── 2838
│   │   │   ├── 2838_fsm
│   │   │   ├── 2838_vm
│   │   │   ├── 2839
│   │   │   ├── 2840
│   │   │   ├── 2840_fsm
│   │   │   ├── 2840_vm
│   │   │   ├── 2841
│   │   │   ├── 2995
│   │   │   ├── 2996
│   │   │   ├── 3079
│   │   │   ├── 3079_fsm
│   │   │   ├── 3079_vm
│   │   │   ├── 3080
│   │   │   ├── 3081
│   │   │   ├── 3085
│   │   │   ├── 3118
│   │   │   ├── 3119
│   │   │   ├── 3164
│   │   │   ├── 3256
│   │   │   ├── 3257
│   │   │   ├── 3258
│   │   │   ├── 3350
│   │   │   ├── 3351
│   │   │   ├── 3379
│   │   │   ├── 3380
│   │   │   ├── 3381
│   │   │   ├── 3394
│   │   │   ├── 3394_fsm
│   │   │   ├── 3394_vm
│   │   │   ├── 3395
│   │   │   ├── 3429
│   │   │   ├── 3430
│   │   │   ├── 3431
│   │   │   ├── 3433
│   │   │   ├── 3439
│   │   │   ├── 3440
│   │   │   ├── 3455
│   │   │   ├── 3456
│   │   │   ├── 3456_fsm
│   │   │   ├── 3456_vm
│   │   │   ├── 3466
│   │   │   ├── 3467
│   │   │   ├── 3468
│   │   │   ├── 3501
│   │   │   ├── 3502
│   │   │   ├── 3503
│   │   │   ├── 3534
│   │   │   ├── 3541
│   │   │   ├── 3541_fsm
│   │   │   ├── 3541_vm
│   │   │   ├── 3542
│   │   │   ├── 3574
│   │   │   ├── 3575
│   │   │   ├── 3576
│   │   │   ├── 3596
│   │   │   ├── 3597
│   │   │   ├── 3598
│   │   │   ├── 3599
│   │   │   ├── 3600
│   │   │   ├── 3600_fsm
│   │   │   ├── 3600_vm
│   │   │   ├── 3601
│   │   │   ├── 3601_fsm
│   │   │   ├── 3601_vm
│   │   │   ├── 3602
│   │   │   ├── 3602_fsm
│   │   │   ├── 3602_vm
│   │   │   ├── 3603
│   │   │   ├── 3603_fsm
│   │   │   ├── 3603_vm
│   │   │   ├── 3604
│   │   │   ├── 3605
│   │   │   ├── 3606
│   │   │   ├── 3607
│   │   │   ├── 3608
│   │   │   ├── 3609
│   │   │   ├── 3712
│   │   │   ├── 3764
│   │   │   ├── 3764_fsm
│   │   │   ├── 3764_vm
│   │   │   ├── 3766
│   │   │   ├── 3767
│   │   │   ├── 3997
│   │   │   ├── 4143
│   │   │   ├── 4144
│   │   │   ├── 4145
│   │   │   ├── 4146
│   │   │   ├── 4147
│   │   │   ├── 4148
│   │   │   ├── 4149
│   │   │   ├── 4150
│   │   │   ├── 4151
│   │   │   ├── 4152
│   │   │   ├── 4153
│   │   │   ├── 4154
│   │   │   ├── 4155
│   │   │   ├── 4156
│   │   │   ├── 4157
│   │   │   ├── 4158
│   │   │   ├── 4159
│   │   │   ├── 4160
│   │   │   ├── 4163
│   │   │   ├── 4164
│   │   │   ├── 4165
│   │   │   ├── 4166
│   │   │   ├── 4167
│   │   │   ├── 4168
│   │   │   ├── 4169
│   │   │   ├── 4170
│   │   │   ├── 4171
│   │   │   ├── 4172
│   │   │   ├── 4173
│   │   │   ├── 4174
│   │   │   ├── 5002
│   │   │   ├── 548
│   │   │   ├── 549
│   │   │   ├── 6102
│   │   │   ├── 6104
│   │   │   ├── 6106
│   │   │   ├── 6110
│   │   │   ├── 6111
│   │   │   ├── 6112
│   │   │   ├── 6113
│   │   │   ├── 6116
│   │   │   ├── 6117
│   │   │   ├── 6175
│   │   │   ├── 6176
│   │   │   ├── 6228
│   │   │   ├── 6229
│   │   │   ├── 6237
│   │   │   ├── 6238
│   │   │   ├── 6239
│   │   │   ├── 826
│   │   │   ├── 827
│   │   │   ├── 828
│   │   │   ├── PG_VERSION
│   │   │   ├── pg_filenode.map
│   │   │   └── pg_internal.init
│   │   ├── 16384
│   │   │   ├── 112
│   │   │   ├── 113
│   │   │   ├── 1247
│   │   │   ├── 1247_fsm
│   │   │   ├── 1247_vm
│   │   │   ├── 1249
│   │   │   ├── 1249_fsm
│   │   │   ├── 1249_vm
│   │   │   ├── 1255
│   │   │   ├── 1255_fsm
│   │   │   ├── 1255_vm
│   │   │   ├── 1259
│   │   │   ├── 1259_fsm
│   │   │   ├── 1259_vm
│   │   │   ├── 13494
│   │   │   ├── 13494_fsm
│   │   │   ├── 13494_vm
│   │   │   ├── 13497
│   │   │   ├── 13498
│   │   │   ├── 13499
│   │   │   ├── 13499_fsm
│   │   │   ├── 13499_vm
│   │   │   ├── 13502
│   │   │   ├── 13503
│   │   │   ├── 13504
│   │   │   ├── 13504_fsm
│   │   │   ├── 13504_vm
│   │   │   ├── 13507
│   │   │   ├── 13508
│   │   │   ├── 13509
│   │   │   ├── 13509_fsm
│   │   │   ├── 13509_vm
│   │   │   ├── 13512
│   │   │   ├── 13513
│   │   │   ├── 1417
│   │   │   ├── 1418
│   │   │   ├── 16385
│   │   │   ├── 16388
│   │   │   ├── 16390
│   │   │   ├── 16392
│   │   │   ├── 16393
│   │   │   ├── 16398
│   │   │   ├── 16400
│   │   │   ├── 16407
│   │   │   ├── 16408
│   │   │   ├── 16408_fsm
│   │   │   ├── 16408_vm
│   │   │   ├── 16415
│   │   │   ├── 16416
│   │   │   ├── 16417
│   │   │   ├── 16419
│   │   │   ├── 16431
│   │   │   ├── 16432
│   │   │   ├── 16433
│   │   │   ├── 16434
│   │   │   ├── 16434_fsm
│   │   │   ├── 16435
│   │   │   ├── 16441
│   │   │   ├── 16442
│   │   │   ├── 16442_fsm
│   │   │   ├── 16448
│   │   │   ├── 16449
│   │   │   ├── 16450
│   │   │   ├── 16452
│   │   │   ├── 16453
│   │   │   ├── 16525
│   │   │   ├── 16526
│   │   │   ├── 16532
│   │   │   ├── 16533
│   │   │   ├── 16534
│   │   │   ├── 16541
│   │   │   ├── 16542
│   │   │   ├── 16543
│   │   │   ├── 174
│   │   │   ├── 175
│   │   │   ├── 2187
│   │   │   ├── 2224
│   │   │   ├── 2228
│   │   │   ├── 2328
│   │   │   ├── 2336
│   │   │   ├── 2337
│   │   │   ├── 2579
│   │   │   ├── 2600
│   │   │   ├── 2600_fsm
│   │   │   ├── 2600_vm
│   │   │   ├── 2601
│   │   │   ├── 2601_fsm
│   │   │   ├── 2601_vm
│   │   │   ├── 2602
│   │   │   ├── 2602_fsm
│   │   │   ├── 2602_vm
│   │   │   ├── 2603
│   │   │   ├── 2603_fsm
│   │   │   ├── 2603_vm
│   │   │   ├── 2604
│   │   │   ├── 2605
│   │   │   ├── 2605_fsm
│   │   │   ├── 2605_vm
│   │   │   ├── 2606
│   │   │   ├── 2606_fsm
│   │   │   ├── 2606_vm
│   │   │   ├── 2607
│   │   │   ├── 2607_fsm
│   │   │   ├── 2607_vm
│   │   │   ├── 2608
│   │   │   ├── 2608_fsm
│   │   │   ├── 2608_vm
│   │   │   ├── 2609
│   │   │   ├── 2609_fsm
│   │   │   ├── 2609_vm
│   │   │   ├── 2610
│   │   │   ├── 2610_fsm
│   │   │   ├── 2610_vm
│   │   │   ├── 2611
│   │   │   ├── 2612
│   │   │   ├── 2612_fsm
│   │   │   ├── 2612_vm
│   │   │   ├── 2613
│   │   │   ├── 2615
│   │   │   ├── 2615_fsm
│   │   │   ├── 2615_vm
│   │   │   ├── 2616
│   │   │   ├── 2616_fsm
│   │   │   ├── 2616_vm
│   │   │   ├── 2617
│   │   │   ├── 2617_fsm
│   │   │   ├── 2617_vm
│   │   │   ├── 2618
│   │   │   ├── 2618_fsm
│   │   │   ├── 2618_vm
│   │   │   ├── 2619
│   │   │   ├── 2619_fsm
│   │   │   ├── 2619_vm
│   │   │   ├── 2620
│   │   │   ├── 2650
│   │   │   ├── 2651
│   │   │   ├── 2652
│   │   │   ├── 2653
│   │   │   ├── 2654
│   │   │   ├── 2655
│   │   │   ├── 2656
│   │   │   ├── 2657
│   │   │   ├── 2658
│   │   │   ├── 2659
│   │   │   ├── 2660
│   │   │   ├── 2661
│   │   │   ├── 2662
│   │   │   ├── 2663
│   │   │   ├── 2664
│   │   │   ├── 2665
│   │   │   ├── 2666
│   │   │   ├── 2667
│   │   │   ├── 2668
│   │   │   ├── 2669
│   │   │   ├── 2670
│   │   │   ├── 2673
│   │   │   ├── 2674
│   │   │   ├── 2675
│   │   │   ├── 2678
│   │   │   ├── 2679
│   │   │   ├── 2680
│   │   │   ├── 2681
│   │   │   ├── 2682
│   │   │   ├── 2683
│   │   │   ├── 2684
│   │   │   ├── 2685
│   │   │   ├── 2686
│   │   │   ├── 2687
│   │   │   ├── 2688
│   │   │   ├── 2689
│   │   │   ├── 2690
│   │   │   ├── 2691
│   │   │   ├── 2692
│   │   │   ├── 2693
│   │   │   ├── 2696
│   │   │   ├── 2699
│   │   │   ├── 2701
│   │   │   ├── 2702
│   │   │   ├── 2703
│   │   │   ├── 2704
│   │   │   ├── 2753
│   │   │   ├── 2753_fsm
│   │   │   ├── 2753_vm
│   │   │   ├── 2754
│   │   │   ├── 2755
│   │   │   ├── 2756
│   │   │   ├── 2757
│   │   │   ├── 2830
│   │   │   ├── 2831
│   │   │   ├── 2832
│   │   │   ├── 2833
│   │   │   ├── 2834
│   │   │   ├── 2835
│   │   │   ├── 2836
│   │   │   ├── 2836_fsm
│   │   │   ├── 2836_vm
│   │   │   ├── 2837
│   │   │   ├── 2838
│   │   │   ├── 2838_fsm
│   │   │   ├── 2838_vm
│   │   │   ├── 2839
│   │   │   ├── 2840
│   │   │   ├── 2840_fsm
│   │   │   ├── 2840_vm
│   │   │   ├── 2841
│   │   │   ├── 2995
│   │   │   ├── 2996
│   │   │   ├── 3079
│   │   │   ├── 3079_fsm
│   │   │   ├── 3079_vm
│   │   │   ├── 3080
│   │   │   ├── 3081
│   │   │   ├── 3085
│   │   │   ├── 3118
│   │   │   ├── 3119
│   │   │   ├── 3164
│   │   │   ├── 3256
│   │   │   ├── 3257
│   │   │   ├── 3258
│   │   │   ├── 3350
│   │   │   ├── 3351
│   │   │   ├── 3379
│   │   │   ├── 3380
│   │   │   ├── 3381
│   │   │   ├── 3394
│   │   │   ├── 3394_fsm
│   │   │   ├── 3394_vm
│   │   │   ├── 3395
│   │   │   ├── 3429
│   │   │   ├── 3430
│   │   │   ├── 3431
│   │   │   ├── 3433
│   │   │   ├── 3439
│   │   │   ├── 3440
│   │   │   ├── 3455
│   │   │   ├── 3456
│   │   │   ├── 3456_fsm
│   │   │   ├── 3456_vm
│   │   │   ├── 3466
│   │   │   ├── 3467
│   │   │   ├── 3468
│   │   │   ├── 3501
│   │   │   ├── 3502
│   │   │   ├── 3503
│   │   │   ├── 3534
│   │   │   ├── 3541
│   │   │   ├── 3541_fsm
│   │   │   ├── 3541_vm
│   │   │   ├── 3542
│   │   │   ├── 3574
│   │   │   ├── 3575
│   │   │   ├── 3576
│   │   │   ├── 3596
│   │   │   ├── 3597
│   │   │   ├── 3598
│   │   │   ├── 3599
│   │   │   ├── 3600
│   │   │   ├── 3600_fsm
│   │   │   ├── 3600_vm
│   │   │   ├── 3601
│   │   │   ├── 3601_fsm
│   │   │   ├── 3601_vm
│   │   │   ├── 3602
│   │   │   ├── 3602_fsm
│   │   │   ├── 3602_vm
│   │   │   ├── 3603
│   │   │   ├── 3603_fsm
│   │   │   ├── 3603_vm
│   │   │   ├── 3604
│   │   │   ├── 3605
│   │   │   ├── 3606
│   │   │   ├── 3607
│   │   │   ├── 3608
│   │   │   ├── 3609
│   │   │   ├── 3712
│   │   │   ├── 3764
│   │   │   ├── 3764_fsm
│   │   │   ├── 3764_vm
│   │   │   ├── 3766
│   │   │   ├── 3767
│   │   │   ├── 3997
│   │   │   ├── 4143
│   │   │   ├── 4144
│   │   │   ├── 4145
│   │   │   ├── 4146
│   │   │   ├── 4147
│   │   │   ├── 4148
│   │   │   ├── 4149
│   │   │   ├── 4150
│   │   │   ├── 4151
│   │   │   ├── 4152
│   │   │   ├── 4153
│   │   │   ├── 4154
│   │   │   ├── 4155
│   │   │   ├── 4156
│   │   │   ├── 4157
│   │   │   ├── 4158
│   │   │   ├── 4159
│   │   │   ├── 4160
│   │   │   ├── 4163
│   │   │   ├── 4164
│   │   │   ├── 4165
│   │   │   ├── 4166
│   │   │   ├── 4167
│   │   │   ├── 4168
│   │   │   ├── 4169
│   │   │   ├── 4170
│   │   │   ├── 4171
│   │   │   ├── 4172
│   │   │   ├── 4173
│   │   │   ├── 4174
│   │   │   ├── 5002
│   │   │   ├── 548
│   │   │   ├── 549
│   │   │   ├── 6102
│   │   │   ├── 6104
│   │   │   ├── 6106
│   │   │   ├── 6110
│   │   │   ├── 6111
│   │   │   ├── 6112
│   │   │   ├── 6113
│   │   │   ├── 6116
│   │   │   ├── 6117
│   │   │   ├── 6175
│   │   │   ├── 6176
│   │   │   ├── 6228
│   │   │   ├── 6229
│   │   │   ├── 6237
│   │   │   ├── 6238
│   │   │   ├── 6239
│   │   │   ├── 826
│   │   │   ├── 827
│   │   │   ├── 828
│   │   │   ├── PG_VERSION
│   │   │   ├── pg_filenode.map
│   │   │   └── pg_internal.init
│   │   ├── 16454
│   │   │   ├── 112
│   │   │   ├── 113
│   │   │   ├── 1247
│   │   │   ├── 1247_fsm
│   │   │   ├── 1247_vm
│   │   │   ├── 1249
│   │   │   ├── 1249_fsm
│   │   │   ├── 1249_vm
│   │   │   ├── 1255
│   │   │   ├── 1255_fsm
│   │   │   ├── 1255_vm
│   │   │   ├── 1259
│   │   │   ├── 1259_fsm
│   │   │   ├── 1259_vm
│   │   │   ├── 13494
│   │   │   ├── 13494_fsm
│   │   │   ├── 13494_vm
│   │   │   ├── 13497
│   │   │   ├── 13498
│   │   │   ├── 13499
│   │   │   ├── 13499_fsm
│   │   │   ├── 13499_vm
│   │   │   ├── 13502
│   │   │   ├── 13503
│   │   │   ├── 13504
│   │   │   ├── 13504_fsm
│   │   │   ├── 13504_vm
│   │   │   ├── 13507
│   │   │   ├── 13508
│   │   │   ├── 13509
│   │   │   ├── 13509_fsm
│   │   │   ├── 13509_vm
│   │   │   ├── 13512
│   │   │   ├── 13513
│   │   │   ├── 1417
│   │   │   ├── 1418
│   │   │   ├── 16455
│   │   │   ├── 16458
│   │   │   ├── 16460
│   │   │   ├── 16462
│   │   │   ├── 16463
│   │   │   ├── 16468
│   │   │   ├── 16470
│   │   │   ├── 16477
│   │   │   ├── 16478
│   │   │   ├── 16485
│   │   │   ├── 16486
│   │   │   ├── 16487
│   │   │   ├── 16489
│   │   │   ├── 16501
│   │   │   ├── 16502
│   │   │   ├── 16508
│   │   │   ├── 16509
│   │   │   ├── 16510
│   │   │   ├── 16512
│   │   │   ├── 16513
│   │   │   ├── 16514
│   │   │   ├── 16515
│   │   │   ├── 16516
│   │   │   ├── 16517
│   │   │   ├── 16518
│   │   │   ├── 174
│   │   │   ├── 175
│   │   │   ├── 2187
│   │   │   ├── 2224
│   │   │   ├── 2228
│   │   │   ├── 2328
│   │   │   ├── 2336
│   │   │   ├── 2337
│   │   │   ├── 2579
│   │   │   ├── 2600
│   │   │   ├── 2600_fsm
│   │   │   ├── 2600_vm
│   │   │   ├── 2601
│   │   │   ├── 2601_fsm
│   │   │   ├── 2601_vm
│   │   │   ├── 2602
│   │   │   ├── 2602_fsm
│   │   │   ├── 2602_vm
│   │   │   ├── 2603
│   │   │   ├── 2603_fsm
│   │   │   ├── 2603_vm
│   │   │   ├── 2604
│   │   │   ├── 2605
│   │   │   ├── 2605_fsm
│   │   │   ├── 2605_vm
│   │   │   ├── 2606
│   │   │   ├── 2606_fsm
│   │   │   ├── 2606_vm
│   │   │   ├── 2607
│   │   │   ├── 2607_fsm
│   │   │   ├── 2607_vm
│   │   │   ├── 2608
│   │   │   ├── 2608_fsm
│   │   │   ├── 2608_vm
│   │   │   ├── 2609
│   │   │   ├── 2609_fsm
│   │   │   ├── 2609_vm
│   │   │   ├── 2610
│   │   │   ├── 2610_fsm
│   │   │   ├── 2610_vm
│   │   │   ├── 2611
│   │   │   ├── 2612
│   │   │   ├── 2612_fsm
│   │   │   ├── 2612_vm
│   │   │   ├── 2613
│   │   │   ├── 2615
│   │   │   ├── 2615_fsm
│   │   │   ├── 2615_vm
│   │   │   ├── 2616
│   │   │   ├── 2616_fsm
│   │   │   ├── 2616_vm
│   │   │   ├── 2617
│   │   │   ├── 2617_fsm
│   │   │   ├── 2617_vm
│   │   │   ├── 2618
│   │   │   ├── 2618_fsm
│   │   │   ├── 2618_vm
│   │   │   ├── 2619
│   │   │   ├── 2619_fsm
│   │   │   ├── 2619_vm
│   │   │   ├── 2620
│   │   │   ├── 2650
│   │   │   ├── 2651
│   │   │   ├── 2652
│   │   │   ├── 2653
│   │   │   ├── 2654
│   │   │   ├── 2655
│   │   │   ├── 2656
│   │   │   ├── 2657
│   │   │   ├── 2658
│   │   │   ├── 2659
│   │   │   ├── 2660
│   │   │   ├── 2661
│   │   │   ├── 2662
│   │   │   ├── 2663
│   │   │   ├── 2664
│   │   │   ├── 2665
│   │   │   ├── 2666
│   │   │   ├── 2667
│   │   │   ├── 2668
│   │   │   ├── 2669
│   │   │   ├── 2670
│   │   │   ├── 2673
│   │   │   ├── 2674
│   │   │   ├── 2675
│   │   │   ├── 2678
│   │   │   ├── 2679
│   │   │   ├── 2680
│   │   │   ├── 2681
│   │   │   ├── 2682
│   │   │   ├── 2683
│   │   │   ├── 2684
│   │   │   ├── 2685
│   │   │   ├── 2686
│   │   │   ├── 2687
│   │   │   ├── 2688
│   │   │   ├── 2689
│   │   │   ├── 2690
│   │   │   ├── 2691
│   │   │   ├── 2692
│   │   │   ├── 2693
│   │   │   ├── 2696
│   │   │   ├── 2699
│   │   │   ├── 2701
│   │   │   ├── 2702
│   │   │   ├── 2703
│   │   │   ├── 2704
│   │   │   ├── 2753
│   │   │   ├── 2753_fsm
│   │   │   ├── 2753_vm
│   │   │   ├── 2754
│   │   │   ├── 2755
│   │   │   ├── 2756
│   │   │   ├── 2757
│   │   │   ├── 2830
│   │   │   ├── 2831
│   │   │   ├── 2832
│   │   │   ├── 2833
│   │   │   ├── 2834
│   │   │   ├── 2835
│   │   │   ├── 2836
│   │   │   ├── 2836_fsm
│   │   │   ├── 2836_vm
│   │   │   ├── 2837
│   │   │   ├── 2838
│   │   │   ├── 2838_fsm
│   │   │   ├── 2838_vm
│   │   │   ├── 2839
│   │   │   ├── 2840
│   │   │   ├── 2840_fsm
│   │   │   ├── 2840_vm
│   │   │   ├── 2841
│   │   │   ├── 2995
│   │   │   ├── 2996
│   │   │   ├── 3079
│   │   │   ├── 3079_fsm
│   │   │   ├── 3079_vm
│   │   │   ├── 3080
│   │   │   ├── 3081
│   │   │   ├── 3085
│   │   │   ├── 3118
│   │   │   ├── 3119
│   │   │   ├── 3164
│   │   │   ├── 3256
│   │   │   ├── 3257
│   │   │   ├── 3258
│   │   │   ├── 3350
│   │   │   ├── 3351
│   │   │   ├── 3379
│   │   │   ├── 3380
│   │   │   ├── 3381
│   │   │   ├── 3394
│   │   │   ├── 3394_fsm
│   │   │   ├── 3394_vm
│   │   │   ├── 3395
│   │   │   ├── 3429
│   │   │   ├── 3430
│   │   │   ├── 3431
│   │   │   ├── 3433
│   │   │   ├── 3439
│   │   │   ├── 3440
│   │   │   ├── 3455
│   │   │   ├── 3456
│   │   │   ├── 3456_fsm
│   │   │   ├── 3456_vm
│   │   │   ├── 3466
│   │   │   ├── 3467
│   │   │   ├── 3468
│   │   │   ├── 3501
│   │   │   ├── 3502
│   │   │   ├── 3503
│   │   │   ├── 3534
│   │   │   ├── 3541
│   │   │   ├── 3541_fsm
│   │   │   ├── 3541_vm
│   │   │   ├── 3542
│   │   │   ├── 3574
│   │   │   ├── 3575
│   │   │   ├── 3576
│   │   │   ├── 3596
│   │   │   ├── 3597
│   │   │   ├── 3598
│   │   │   ├── 3599
│   │   │   ├── 3600
│   │   │   ├── 3600_fsm
│   │   │   ├── 3600_vm
│   │   │   ├── 3601
│   │   │   ├── 3601_fsm
│   │   │   ├── 3601_vm
│   │   │   ├── 3602
│   │   │   ├── 3602_fsm
│   │   │   ├── 3602_vm
│   │   │   ├── 3603
│   │   │   ├── 3603_fsm
│   │   │   ├── 3603_vm
│   │   │   ├── 3604
│   │   │   ├── 3605
│   │   │   ├── 3606
│   │   │   ├── 3607
│   │   │   ├── 3608
│   │   │   ├── 3609
│   │   │   ├── 3712
│   │   │   ├── 3764
│   │   │   ├── 3764_fsm
│   │   │   ├── 3764_vm
│   │   │   ├── 3766
│   │   │   ├── 3767
│   │   │   ├── 3997
│   │   │   ├── 4143
│   │   │   ├── 4144
│   │   │   ├── 4145
│   │   │   ├── 4146
│   │   │   ├── 4147
│   │   │   ├── 4148
│   │   │   ├── 4149
│   │   │   ├── 4150
│   │   │   ├── 4151
│   │   │   ├── 4152
│   │   │   ├── 4153
│   │   │   ├── 4154
│   │   │   ├── 4155
│   │   │   ├── 4156
│   │   │   ├── 4157
│   │   │   ├── 4158
│   │   │   ├── 4159
│   │   │   ├── 4160
│   │   │   ├── 4163
│   │   │   ├── 4164
│   │   │   ├── 4165
│   │   │   ├── 4166
│   │   │   ├── 4167
│   │   │   ├── 4168
│   │   │   ├── 4169
│   │   │   ├── 4170
│   │   │   ├── 4171
│   │   │   ├── 4172
│   │   │   ├── 4173
│   │   │   ├── 4174
│   │   │   ├── 5002
│   │   │   ├── 548
│   │   │   ├── 549
│   │   │   ├── 6102
│   │   │   ├── 6104
│   │   │   ├── 6106
│   │   │   ├── 6110
│   │   │   ├── 6111
│   │   │   ├── 6112
│   │   │   ├── 6113
│   │   │   ├── 6116
│   │   │   ├── 6117
│   │   │   ├── 6175
│   │   │   ├── 6176
│   │   │   ├── 6228
│   │   │   ├── 6229
│   │   │   ├── 6237
│   │   │   ├── 6238
│   │   │   ├── 6239
│   │   │   ├── 826
│   │   │   ├── 827
│   │   │   ├── 828
│   │   │   ├── PG_VERSION
│   │   │   ├── pg_filenode.map
│   │   │   └── pg_internal.init
│   │   ├── 4
│   │   │   ├── 112
│   │   │   ├── 113
│   │   │   ├── 1247
│   │   │   ├── 1247_fsm
│   │   │   ├── 1247_vm
│   │   │   ├── 1249
│   │   │   ├── 1249_fsm
│   │   │   ├── 1249_vm
│   │   │   ├── 1255
│   │   │   ├── 1255_fsm
│   │   │   ├── 1255_vm
│   │   │   ├── 1259
│   │   │   ├── 1259_fsm
│   │   │   ├── 1259_vm
│   │   │   ├── 13494
│   │   │   ├── 13494_fsm
│   │   │   ├── 13494_vm
│   │   │   ├── 13497
│   │   │   ├── 13498
│   │   │   ├── 13499
│   │   │   ├── 13499_fsm
│   │   │   ├── 13499_vm
│   │   │   ├── 13502
│   │   │   ├── 13503
│   │   │   ├── 13504
│   │   │   ├── 13504_fsm
│   │   │   ├── 13504_vm
│   │   │   ├── 13507
│   │   │   ├── 13508
│   │   │   ├── 13509
│   │   │   ├── 13509_fsm
│   │   │   ├── 13509_vm
│   │   │   ├── 13512
│   │   │   ├── 13513
│   │   │   ├── 1417
│   │   │   ├── 1418
│   │   │   ├── 174
│   │   │   ├── 175
│   │   │   ├── 2187
│   │   │   ├── 2224
│   │   │   ├── 2228
│   │   │   ├── 2328
│   │   │   ├── 2336
│   │   │   ├── 2337
│   │   │   ├── 2579
│   │   │   ├── 2600
│   │   │   ├── 2600_fsm
│   │   │   ├── 2600_vm
│   │   │   ├── 2601
│   │   │   ├── 2601_fsm
│   │   │   ├── 2601_vm
│   │   │   ├── 2602
│   │   │   ├── 2602_fsm
│   │   │   ├── 2602_vm
│   │   │   ├── 2603
│   │   │   ├── 2603_fsm
│   │   │   ├── 2603_vm
│   │   │   ├── 2604
│   │   │   ├── 2605
│   │   │   ├── 2605_fsm
│   │   │   ├── 2605_vm
│   │   │   ├── 2606
│   │   │   ├── 2606_fsm
│   │   │   ├── 2606_vm
│   │   │   ├── 2607
│   │   │   ├── 2607_fsm
│   │   │   ├── 2607_vm
│   │   │   ├── 2608
│   │   │   ├── 2608_fsm
│   │   │   ├── 2608_vm
│   │   │   ├── 2609
│   │   │   ├── 2609_fsm
│   │   │   ├── 2609_vm
│   │   │   ├── 2610
│   │   │   ├── 2610_fsm
│   │   │   ├── 2610_vm
│   │   │   ├── 2611
│   │   │   ├── 2612
│   │   │   ├── 2612_fsm
│   │   │   ├── 2612_vm
│   │   │   ├── 2613
│   │   │   ├── 2615
│   │   │   ├── 2615_fsm
│   │   │   ├── 2615_vm
│   │   │   ├── 2616
│   │   │   ├── 2616_fsm
│   │   │   ├── 2616_vm
│   │   │   ├── 2617
│   │   │   ├── 2617_fsm
│   │   │   ├── 2617_vm
│   │   │   ├── 2618
│   │   │   ├── 2618_fsm
│   │   │   ├── 2618_vm
│   │   │   ├── 2619
│   │   │   ├── 2619_fsm
│   │   │   ├── 2619_vm
│   │   │   ├── 2620
│   │   │   ├── 2650
│   │   │   ├── 2651
│   │   │   ├── 2652
│   │   │   ├── 2653
│   │   │   ├── 2654
│   │   │   ├── 2655
│   │   │   ├── 2656
│   │   │   ├── 2657
│   │   │   ├── 2658
│   │   │   ├── 2659
│   │   │   ├── 2660
│   │   │   ├── 2661
│   │   │   ├── 2662
│   │   │   ├── 2663
│   │   │   ├── 2664
│   │   │   ├── 2665
│   │   │   ├── 2666
│   │   │   ├── 2667
│   │   │   ├── 2668
│   │   │   ├── 2669
│   │   │   ├── 2670
│   │   │   ├── 2673
│   │   │   ├── 2674
│   │   │   ├── 2675
│   │   │   ├── 2678
│   │   │   ├── 2679
│   │   │   ├── 2680
│   │   │   ├── 2681
│   │   │   ├── 2682
│   │   │   ├── 2683
│   │   │   ├── 2684
│   │   │   ├── 2685
│   │   │   ├── 2686
│   │   │   ├── 2687
│   │   │   ├── 2688
│   │   │   ├── 2689
│   │   │   ├── 2690
│   │   │   ├── 2691
│   │   │   ├── 2692
│   │   │   ├── 2693
│   │   │   ├── 2696
│   │   │   ├── 2699
│   │   │   ├── 2701
│   │   │   ├── 2702
│   │   │   ├── 2703
│   │   │   ├── 2704
│   │   │   ├── 2753
│   │   │   ├── 2753_fsm
│   │   │   ├── 2753_vm
│   │   │   ├── 2754
│   │   │   ├── 2755
│   │   │   ├── 2756
│   │   │   ├── 2757
│   │   │   ├── 2830
│   │   │   ├── 2831
│   │   │   ├── 2832
│   │   │   ├── 2833
│   │   │   ├── 2834
│   │   │   ├── 2835
│   │   │   ├── 2836
│   │   │   ├── 2836_fsm
│   │   │   ├── 2836_vm
│   │   │   ├── 2837
│   │   │   ├── 2838
│   │   │   ├── 2838_fsm
│   │   │   ├── 2838_vm
│   │   │   ├── 2839
│   │   │   ├── 2840
│   │   │   ├── 2840_fsm
│   │   │   ├── 2840_vm
│   │   │   ├── 2841
│   │   │   ├── 2995
│   │   │   ├── 2996
│   │   │   ├── 3079
│   │   │   ├── 3079_fsm
│   │   │   ├── 3079_vm
│   │   │   ├── 3080
│   │   │   ├── 3081
│   │   │   ├── 3085
│   │   │   ├── 3118
│   │   │   ├── 3119
│   │   │   ├── 3164
│   │   │   ├── 3256
│   │   │   ├── 3257
│   │   │   ├── 3258
│   │   │   ├── 3350
│   │   │   ├── 3351
│   │   │   ├── 3379
│   │   │   ├── 3380
│   │   │   ├── 3381
│   │   │   ├── 3394
│   │   │   ├── 3394_fsm
│   │   │   ├── 3394_vm
│   │   │   ├── 3395
│   │   │   ├── 3429
│   │   │   ├── 3430
│   │   │   ├── 3431
│   │   │   ├── 3433
│   │   │   ├── 3439
│   │   │   ├── 3440
│   │   │   ├── 3455
│   │   │   ├── 3456
│   │   │   ├── 3456_fsm
│   │   │   ├── 3456_vm
│   │   │   ├── 3466
│   │   │   ├── 3467
│   │   │   ├── 3468
│   │   │   ├── 3501
│   │   │   ├── 3502
│   │   │   ├── 3503
│   │   │   ├── 3534
│   │   │   ├── 3541
│   │   │   ├── 3541_fsm
│   │   │   ├── 3541_vm
│   │   │   ├── 3542
│   │   │   ├── 3574
│   │   │   ├── 3575
│   │   │   ├── 3576
│   │   │   ├── 3596
│   │   │   ├── 3597
│   │   │   ├── 3598
│   │   │   ├── 3599
│   │   │   ├── 3600
│   │   │   ├── 3600_fsm
│   │   │   ├── 3600_vm
│   │   │   ├── 3601
│   │   │   ├── 3601_fsm
│   │   │   ├── 3601_vm
│   │   │   ├── 3602
│   │   │   ├── 3602_fsm
│   │   │   ├── 3602_vm
│   │   │   ├── 3603
│   │   │   ├── 3603_fsm
│   │   │   ├── 3603_vm
│   │   │   ├── 3604
│   │   │   ├── 3605
│   │   │   ├── 3606
│   │   │   ├── 3607
│   │   │   ├── 3608
│   │   │   ├── 3609
│   │   │   ├── 3712
│   │   │   ├── 3764
│   │   │   ├── 3764_fsm
│   │   │   ├── 3764_vm
│   │   │   ├── 3766
│   │   │   ├── 3767
│   │   │   ├── 3997
│   │   │   ├── 4143
│   │   │   ├── 4144
│   │   │   ├── 4145
│   │   │   ├── 4146
│   │   │   ├── 4147
│   │   │   ├── 4148
│   │   │   ├── 4149
│   │   │   ├── 4150
│   │   │   ├── 4151
│   │   │   ├── 4152
│   │   │   ├── 4153
│   │   │   ├── 4154
│   │   │   ├── 4155
│   │   │   ├── 4156
│   │   │   ├── 4157
│   │   │   ├── 4158
│   │   │   ├── 4159
│   │   │   ├── 4160
│   │   │   ├── 4163
│   │   │   ├── 4164
│   │   │   ├── 4165
│   │   │   ├── 4166
│   │   │   ├── 4167
│   │   │   ├── 4168
│   │   │   ├── 4169
│   │   │   ├── 4170
│   │   │   ├── 4171
│   │   │   ├── 4172
│   │   │   ├── 4173
│   │   │   ├── 4174
│   │   │   ├── 5002
│   │   │   ├── 548
│   │   │   ├── 549
│   │   │   ├── 6102
│   │   │   ├── 6104
│   │   │   ├── 6106
│   │   │   ├── 6110
│   │   │   ├── 6111
│   │   │   ├── 6112
│   │   │   ├── 6113
│   │   │   ├── 6116
│   │   │   ├── 6117
│   │   │   ├── 6175
│   │   │   ├── 6176
│   │   │   ├── 6228
│   │   │   ├── 6229
│   │   │   ├── 6237
│   │   │   ├── 6238
│   │   │   ├── 6239
│   │   │   ├── 826
│   │   │   ├── 827
│   │   │   ├── 828
│   │   │   ├── PG_VERSION
│   │   │   └── pg_filenode.map
│   │   └── 5
│   │       ├── 112
│   │       ├── 113
│   │       ├── 1247
│   │       ├── 1247_fsm
│   │       ├── 1247_vm
│   │       ├── 1249
│   │       ├── 1249_fsm
│   │       ├── 1249_vm
│   │       ├── 1255
│   │       ├── 1255_fsm
│   │       ├── 1255_vm
│   │       ├── 1259
│   │       ├── 1259_fsm
│   │       ├── 1259_vm
│   │       ├── 13494
│   │       ├── 13494_fsm
│   │       ├── 13494_vm
│   │       ├── 13497
│   │       ├── 13498
│   │       ├── 13499
│   │       ├── 13499_fsm
│   │       ├── 13499_vm
│   │       ├── 13502
│   │       ├── 13503
│   │       ├── 13504
│   │       ├── 13504_fsm
│   │       ├── 13504_vm
│   │       ├── 13507
│   │       ├── 13508
│   │       ├── 13509
│   │       ├── 13509_fsm
│   │       ├── 13509_vm
│   │       ├── 13512
│   │       ├── 13513
│   │       ├── 1417
│   │       ├── 1418
│   │       ├── 174
│   │       ├── 175
│   │       ├── 2187
│   │       ├── 2224
│   │       ├── 2228
│   │       ├── 2328
│   │       ├── 2336
│   │       ├── 2337
│   │       ├── 2579
│   │       ├── 2600
│   │       ├── 2600_fsm
│   │       ├── 2600_vm
│   │       ├── 2601
│   │       ├── 2601_fsm
│   │       ├── 2601_vm
│   │       ├── 2602
│   │       ├── 2602_fsm
│   │       ├── 2602_vm
│   │       ├── 2603
│   │       ├── 2603_fsm
│   │       ├── 2603_vm
│   │       ├── 2604
│   │       ├── 2605
│   │       ├── 2605_fsm
│   │       ├── 2605_vm
│   │       ├── 2606
│   │       ├── 2606_fsm
│   │       ├── 2606_vm
│   │       ├── 2607
│   │       ├── 2607_fsm
│   │       ├── 2607_vm
│   │       ├── 2608
│   │       ├── 2608_fsm
│   │       ├── 2608_vm
│   │       ├── 2609
│   │       ├── 2609_fsm
│   │       ├── 2609_vm
│   │       ├── 2610
│   │       ├── 2610_fsm
│   │       ├── 2610_vm
│   │       ├── 2611
│   │       ├── 2612
│   │       ├── 2612_fsm
│   │       ├── 2612_vm
│   │       ├── 2613
│   │       ├── 2615
│   │       ├── 2615_fsm
│   │       ├── 2615_vm
│   │       ├── 2616
│   │       ├── 2616_fsm
│   │       ├── 2616_vm
│   │       ├── 2617
│   │       ├── 2617_fsm
│   │       ├── 2617_vm
│   │       ├── 2618
│   │       ├── 2618_fsm
│   │       ├── 2618_vm
│   │       ├── 2619
│   │       ├── 2619_fsm
│   │       ├── 2619_vm
│   │       ├── 2620
│   │       ├── 2650
│   │       ├── 2651
│   │       ├── 2652
│   │       ├── 2653
│   │       ├── 2654
│   │       ├── 2655
│   │       ├── 2656
│   │       ├── 2657
│   │       ├── 2658
│   │       ├── 2659
│   │       ├── 2660
│   │       ├── 2661
│   │       ├── 2662
│   │       ├── 2663
│   │       ├── 2664
│   │       ├── 2665
│   │       ├── 2666
│   │       ├── 2667
│   │       ├── 2668
│   │       ├── 2669
│   │       ├── 2670
│   │       ├── 2673
│   │       ├── 2674
│   │       ├── 2675
│   │       ├── 2678
│   │       ├── 2679
│   │       ├── 2680
│   │       ├── 2681
│   │       ├── 2682
│   │       ├── 2683
│   │       ├── 2684
│   │       ├── 2685
│   │       ├── 2686
│   │       ├── 2687
│   │       ├── 2688
│   │       ├── 2689
│   │       ├── 2690
│   │       ├── 2691
│   │       ├── 2692
│   │       ├── 2693
│   │       ├── 2696
│   │       ├── 2699
│   │       ├── 2701
│   │       ├── 2702
│   │       ├── 2703
│   │       ├── 2704
│   │       ├── 2753
│   │       ├── 2753_fsm
│   │       ├── 2753_vm
│   │       ├── 2754
│   │       ├── 2755
│   │       ├── 2756
│   │       ├── 2757
│   │       ├── 2830
│   │       ├── 2831
│   │       ├── 2832
│   │       ├── 2833
│   │       ├── 2834
│   │       ├── 2835
│   │       ├── 2836
│   │       ├── 2836_fsm
│   │       ├── 2836_vm
│   │       ├── 2837
│   │       ├── 2838
│   │       ├── 2838_fsm
│   │       ├── 2838_vm
│   │       ├── 2839
│   │       ├── 2840
│   │       ├── 2840_fsm
│   │       ├── 2840_vm
│   │       ├── 2841
│   │       ├── 2995
│   │       ├── 2996
│   │       ├── 3079
│   │       ├── 3079_fsm
│   │       ├── 3079_vm
│   │       ├── 3080
│   │       ├── 3081
│   │       ├── 3085
│   │       ├── 3118
│   │       ├── 3119
│   │       ├── 3164
│   │       ├── 3256
│   │       ├── 3257
│   │       ├── 3258
│   │       ├── 3350
│   │       ├── 3351
│   │       ├── 3379
│   │       ├── 3380
│   │       ├── 3381
│   │       ├── 3394
│   │       ├── 3394_fsm
│   │       ├── 3394_vm
│   │       ├── 3395
│   │       ├── 3429
│   │       ├── 3430
│   │       ├── 3431
│   │       ├── 3433
│   │       ├── 3439
│   │       ├── 3440
│   │       ├── 3455
│   │       ├── 3456
│   │       ├── 3456_fsm
│   │       ├── 3456_vm
│   │       ├── 3466
│   │       ├── 3467
│   │       ├── 3468
│   │       ├── 3501
│   │       ├── 3502
│   │       ├── 3503
│   │       ├── 3534
│   │       ├── 3541
│   │       ├── 3541_fsm
│   │       ├── 3541_vm
│   │       ├── 3542
│   │       ├── 3574
│   │       ├── 3575
│   │       ├── 3576
│   │       ├── 3596
│   │       ├── 3597
│   │       ├── 3598
│   │       ├── 3599
│   │       ├── 3600
│   │       ├── 3600_fsm
│   │       ├── 3600_vm
│   │       ├── 3601
│   │       ├── 3601_fsm
│   │       ├── 3601_vm
│   │       ├── 3602
│   │       ├── 3602_fsm
│   │       ├── 3602_vm
│   │       ├── 3603
│   │       ├── 3603_fsm
│   │       ├── 3603_vm
│   │       ├── 3604
│   │       ├── 3605
│   │       ├── 3606
│   │       ├── 3607
│   │       ├── 3608
│   │       ├── 3609
│   │       ├── 3712
│   │       ├── 3764
│   │       ├── 3764_fsm
│   │       ├── 3764_vm
│   │       ├── 3766
│   │       ├── 3767
│   │       ├── 3997
│   │       ├── 4143
│   │       ├── 4144
│   │       ├── 4145
│   │       ├── 4146
│   │       ├── 4147
│   │       ├── 4148
│   │       ├── 4149
│   │       ├── 4150
│   │       ├── 4151
│   │       ├── 4152
│   │       ├── 4153
│   │       ├── 4154
│   │       ├── 4155
│   │       ├── 4156
│   │       ├── 4157
│   │       ├── 4158
│   │       ├── 4159
│   │       ├── 4160
│   │       ├── 4163
│   │       ├── 4164
│   │       ├── 4165
│   │       ├── 4166
│   │       ├── 4167
│   │       ├── 4168
│   │       ├── 4169
│   │       ├── 4170
│   │       ├── 4171
│   │       ├── 4172
│   │       ├── 4173
│   │       ├── 4174
│   │       ├── 5002
│   │       ├── 548
│   │       ├── 549
│   │       ├── 6102
│   │       ├── 6104
│   │       ├── 6106
│   │       ├── 6110
│   │       ├── 6111
│   │       ├── 6112
│   │       ├── 6113
│   │       ├── 6116
│   │       ├── 6117
│   │       ├── 6175
│   │       ├── 6176
│   │       ├── 6228
│   │       ├── 6229
│   │       ├── 6237
│   │       ├── 6238
│   │       ├── 6239
│   │       ├── 826
│   │       ├── 827
│   │       ├── 828
│   │       ├── PG_VERSION
│   │       ├── pg_filenode.map
│   │       └── pg_internal.init
│   ├── global
│   │   ├── 1213
│   │   ├── 1213_fsm
│   │   ├── 1213_vm
│   │   ├── 1214
│   │   ├── 1232
│   │   ├── 1233
│   │   ├── 1260
│   │   ├── 1260_fsm
│   │   ├── 1260_vm
│   │   ├── 1261
│   │   ├── 1261_fsm
│   │   ├── 1261_vm
│   │   ├── 1262
│   │   ├── 1262_fsm
│   │   ├── 1262_vm
│   │   ├── 2396
│   │   ├── 2396_fsm
│   │   ├── 2396_vm
│   │   ├── 2397
│   │   ├── 2671
│   │   ├── 2672
│   │   ├── 2676
│   │   ├── 2677
│   │   ├── 2694
│   │   ├── 2695
│   │   ├── 2697
│   │   ├── 2698
│   │   ├── 2846
│   │   ├── 2847
│   │   ├── 2964
│   │   ├── 2965
│   │   ├── 2966
│   │   ├── 2967
│   │   ├── 3592
│   │   ├── 3593
│   │   ├── 4060
│   │   ├── 4061
│   │   ├── 4175
│   │   ├── 4176
│   │   ├── 4177
│   │   ├── 4178
│   │   ├── 4181
│   │   ├── 4182
│   │   ├── 4183
│   │   ├── 4184
│   │   ├── 4185
│   │   ├── 4186
│   │   ├── 6000
│   │   ├── 6001
│   │   ├── 6002
│   │   ├── 6100
│   │   ├── 6114
│   │   ├── 6115
│   │   ├── 6243
│   │   ├── 6244
│   │   ├── 6245
│   │   ├── 6246
│   │   ├── 6247
│   │   ├── 6302
│   │   ├── 6303
│   │   ├── pg_control
│   │   ├── pg_filenode.map
│   │   └── pg_internal.init
│   ├── pg_commit_ts
│   ├── pg_dynshmem
│   ├── pg_hba.conf
│   ├── pg_ident.conf
│   ├── pg_logical
│   │   ├── mappings
│   │   ├── replorigin_checkpoint
│   │   └── snapshots
│   ├── pg_multixact
│   │   ├── members
│   │   │   └── 0000
│   │   └── offsets
│   │       └── 0000
│   ├── pg_notify
│   ├── pg_replslot
│   ├── pg_serial
│   ├── pg_snapshots
│   ├── pg_stat
│   ├── pg_stat_tmp
│   ├── pg_subtrans
│   │   └── 0000
│   ├── pg_tblspc
│   ├── pg_twophase
│   ├── pg_wal
│   │   ├── 000000010000000000000002
│   │   ├── 000000010000000000000003
│   │   └── archive_status
│   ├── pg_xact
│   │   └── 0000
│   ├── postgresql.auto.conf
│   ├── postgresql.conf
│   ├── postmaster.opts
│   └── postmaster.pid
├── project_full_bundle.md
├── public
├── renameDataFiles.js
├── restore_departments_by_alias.js
├── scripts
│   ├── check_missing_faces.js
│   ├── init_db_schema.sql
│   ├── migrate_csv_to_db.js
│   ├── repair_departments.js
│   ├── restore_departments_by_alias.js
│   ├── run_schema.js
│   ├── sync_83_faceids_to_csv.js
│   ├── sync_cloud_to_csv.js
│   ├── sync_csv_by_alias.js
│   └── sync_hanet_to_db.js
├── src
│   ├── app.js
│   ├── config
│   │   └── database.js
│   ├── controllers
│   │   ├── authController.js
│   │   ├── departmentController.js
│   │   ├── personController.js
│   │   └── transferController.js
│   ├── middlewares
│   │   ├── auditMiddleware.js
│   │   └── authMiddleware.js
│   ├── routes
│   │   ├── classRoutes.js
│   │   ├── departmentRoutes.js
│   │   ├── personRoutes.js
│   │   └── transferRoutes.js
│   ├── services
│   │   ├── csvService.js
│   │   ├── dbClassService.js
│   │   ├── hanetService.js
│   │   ├── idempotencyService.js
│   │   ├── imageService.js
│   │   ├── queueService.js
│   │   └── transferService.js
│   ├── utils
│   │   └── hanetErrorMap.js
│   └── views
│       ├── class_manager.ejs
│       ├── department
│       │   ├── index.ejs
│       │   └── members.ejs
│       ├── index.ejs
│       ├── layout.ejs
│       ├── links.ejs
│       ├── person
│       │   ├── checkin.ejs
│       │   ├── edit.ejs
│       │   ├── list.ejs
│       │   ├── register.ejs
│       │   └── register_csv.ejs
│       ├── register.ejs
│       └── transfer.ejs
├── syncAlias.js
├── syncFromHanetToCsv.js
├── syncToCsvFinal.js
├── testScript.js
├── tests
│   └── test_queue_update.js
├── uploads
│   ├── dlq_processed_1790846647982_2.jpg
│   ├── temp
│   │   ├── 184ac6b9d3cf869aa89d09de86fd70f5
│   │   └── e2f42f5110c777f80f17b5ce050f5ff4
│   ├── test_public.txt
│   └── test_sample.jpg
└── vps_sync_backup.sql

50 directories, 1772 files
```

---
## 4. CẤU HÌNH HỆ THỐNG & DEPLOYMENT

### File: `package.json`
```
{
  "name": "hanet-cloud-first-app",
  "version": "1.0.0",
  "description": "Ung dung Cloud-First quan ly Face ID va Checkin qua HANET AI Camera",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js"
  },
  "dependencies": {
    "axios": "^1.7.7",
    "bull": "^4.16.3",
    "connect-flash": "^0.1.1",
    "connect-redis": "^8.0.1",
    "csv-parser": "^3.2.1",
    "csv-writer": "^1.6.0",
    "dotenv": "^16.4.5",
    "ejs": "^3.1.10",
    "express": "^4.19.2",
    "express-ejs-layouts": "^2.5.1",
    "express-session": "^1.18.1",
    "form-data": "^4.0.6",
    "heic-decode": "^2.1.0",
    "ioredis": "^5.4.1",
    "method-override": "^3.0.0",
    "morgan": "^1.10.0",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.23.0",
    "qs": "^6.13.0",
    "redis": "^4.7.0",
    "sharp": "^0.33.5"
  },
  "devDependencies": {
    "nodemon": "^3.1.7"
  }
}

```

### File: `docker-compose.yml`
```
services:
  app:
    build: .
    container_name: thanh_giuse_pc_app
    restart: unless-stopped
    ports:
      - "3001:3000"
    env_file:
      - .env
    environment:
      - REDIS_HOST=redis
      - REDIS_PORT=6379
      - REDIS_DB=4
      - DB_HOST=postgres
      - DB_PORT=5432
      - DB_NAME=${DB_NAME:-thanh_giuse_db}
      - DB_USER=${DB_USER:-postgres}
      - DB_PASSWORD=${DB_PASSWORD:-thanhgiuse_secure_pass_2026}
    depends_on:
      redis:
        condition: service_healthy
      postgres:
        condition: service_healthy
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads

  postgres:
    image: postgres:16-alpine
    container_name: thanh_giuse_pc_postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME:-thanh_giuse_db}
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-thanhgiuse_secure_pass_2026}
    volumes:
      - ./postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: [ "CMD-SHELL", "pg_isready -U ${DB_USER:-postgres} -d ${DB_NAME:-thanh_giuse_db}" ]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: thanh_giuse_pc_redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    healthcheck:
      test: [ "CMD", "redis-cli", "ping" ]
      interval: 5s
      timeout: 5s
      retries: 5

  tunnel:
    image: cloudflare/cloudflared:latest
    container_name: thanh_giuse_pc_tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate --protocol http2 run --token ${CLOUDFLARE_TUNNEL_TOKEN:-${TUNNEL_TOKEN}}
    environment:
      - TUNNEL_TOKEN=${CLOUDFLARE_TUNNEL_TOKEN:-${TUNNEL_TOKEN}}
    depends_on:
      - app

```

### File: `Dockerfile`
```
FROM node:20-alpine

# Install dependencies required for sharp on alpine if needed (libvips/vips-tools)
RUN apk add --no-cache vips-dev build-base python3

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

# Create uploads directory
RUN mkdir -p uploads/temp

EXPOSE 3000

CMD ["node", "src/app.js"]

```

### File: `.env.example`
```
NODE_ENV=production
PORT=3000
BASE_URL=https://your-domain.com
SESSION_SECRET=chuoi_bao_mat_session_random_rat_dai_123456

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=4

HANET_CLIENT_ID=your_hanet_client_id
HANET_CLIENT_SECRET=your_hanet_client_secret
HANET_ACCESS_TOKEN=your_hanet_access_token_if_available
HANET_PLACE_ID=4628
HANET_API_BASE=https://partner.hanet.ai
HANET_OAUTH_BASE=https://oauth.hanet.com

# Cloudflare Tunnel
CLOUDFLARE_TUNNEL_TOKEN=your_cloudflare_tunnel_token

```

---
## 5. MÃ NGUỒN CHI TIẾT (SRC)

### File: `src/app.js`
```js
const express = require('express');
const path = require('path');
const fs = require('fs');
const morgan = require('morgan');
const methodOverride = require('method-override');
const session = require('express-session');
const flash = require('connect-flash');
const expressLayouts = require('express-ejs-layouts');
const { RedisStore } = require('connect-redis');
const { createClient } = require('redis');
const dotenv = require('dotenv');
const imageService = require('./services/imageService');
const defaultAuthMiddleware = require('./middlewares/authMiddleware');

dotenv.config();

const personRoutes = require('./routes/personRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const classRoutes = require('./routes/classRoutes');
const transferRoutes = require('./routes/transferRoutes');

// Khởi chạy Garbage Collection định kỳ mỗi 30 phút dọn dẹp file tạm mồ côi cũ hơn 1 giờ
const gcTimer = setInterval(() => {
  imageService.cleanOldFiles(60 * 60 * 1000);
}, 30 * 60 * 1000);
if (gcTimer && typeof gcTimer.unref === 'function') {
  gcTimer.unref();
}

const app = express();
const PORT = process.env.PORT || 3000;

// Khởi tạo Redis Client cho Express Session
const redisClient = createClient({
  url: `redis://${process.env.REDIS_HOST || 'redis'}:${process.env.REDIS_PORT || 6379}/${process.env.REDIS_DB || 4}`
});

redisClient.on('error', (err) => console.error('[Redis Client Error]', err.message));
redisClient.on('connect', () => console.log('✅ [Redis] Da ket noi thanh cong'));

redisClient.connect().catch((err) => {
  console.error('[Redis Connect Failed]', err.message);
});

app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(methodOverride('_method'));

// Session store qua Redis DB 4
app.use(
  session({
    store: new RedisStore({ client: redisClient, prefix: 'hanet_sess:' }),
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 8 } // 8 giờ
  })
);

app.use(flash());

// Cấu hình View Engine EJS
app.use(expressLayouts);
app.set('layout', 'layout');
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, '../public')));

// Middleware xử lý fallback cho ảnh bị dọn dẹp sau 30s (RULE-022)
app.get('/uploads/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../uploads', req.params.filename);

  // 1. File vẫn tồn tại (trong khoảng 30s đầu)
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  }

  // 2. File đã bị dọn dẹp (RULE-022) -> Trả về ảnh mặc định nếu có
  const defaultAvatarPath = path.join(__dirname, '../public/images/default-avatar.png');
  if (fs.existsSync(defaultAvatarPath)) {
    return res.sendFile(defaultAvatarPath);
  }

  // 3. Fallback cuối cùng: Trả về 1 ảnh SVG 1x1 trong suốt với HTTP 200 (Tránh 404 hoàn toàn)
  res.setHeader('Content-Type', 'image/svg+xml');
  return res.send(`
    <svg xmlns="http://www.w3.org/2000/svg" width="1" height="1" viewBox="0 0 1 1">
      <rect width="1" height="1" fill="transparent"/>
    </svg>
  `);
});

// Middleware biến toàn cục cho Views
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentPath = req.path;
  res.locals.user = req.session?.user || null;
  next();
});

// Tự động nhận diện token từ query (?token=...) mà KHÔNG chặn route công khai
app.use(defaultAuthMiddleware);

// Triệt tiêu log rác favicon 404
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Chuyển hướng trang chủ về danh sách liên kết
app.get('/', (req, res) => {
  return res.redirect('/links');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', architecture: 'Cloud-First (No-DB)' });
});

// Mount Routes
app.use('/departments', departmentRoutes);
app.use('/', classRoutes);
app.use('/', transferRoutes);
app.use('/', personRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Server dang chay tai: http://localhost:${PORT}`);
});

```

### File: `src/utils/hanetErrorMap.js`
```js
const ERROR_MAP = {
  1: 'Thao tác thành công.',
  '-1': 'Thông tin gửi lên không hợp lệ. Vui lòng kiểm tra lại các trường bắt buộc (Họ tên, mã NV, phòng ban).',
  '-103': 'Phiên đăng nhập đã hết hạn. Hệ thống đang tự động làm mới, vui lòng thử lại.',
  '-404': 'Yêu cầu không được hỗ trợ bởi hệ thống HANET.',
  '-503': 'Máy chủ HANET Cloud đang bảo trì hoặc quá tải. Vui lòng thử lại sau ít phút.',
  '-909': 'Lỗi trong quá trình tải dữ liệu khuôn mặt lên máy chủ.',
  '-1001': 'Lỗi khởi tạo địa điểm.',
  '-1005': 'Địa điểm không tồn tại trên hệ thống.',
  '-10076': 'Bạn không có quyền chỉnh sửa địa điểm này.',
  '-2035': 'Bạn không có quyền truy cập vào phòng ban hoặc địa điểm này.',
  '-5004': 'Không thể tạo khuôn mặt do kết nối mạng không ổn định. Vui lòng thử lại.',
  '-5005': 'Không thể cập nhật thông tin thành viên. Có thể thành viên không còn tồn tại.',
  '-5006': 'Không thể xóa thành viên khỏi phòng ban. Vui lòng kiểm tra lại dữ liệu.',
  '-5008': 'Cập nhật khuôn mặt mới thất bại. Vui lòng thử lại với ảnh rõ nét hơn.',
  '-5010': 'Ảnh khuôn mặt không hợp lệ.',
  '-5011': 'Không tìm thấy hồ sơ thành viên này trên HANET Cloud.',
  '-9002': 'Định dạng file ảnh không hợp lệ. Hệ thống chỉ hỗ trợ định dạng JPG, JPEG hoặc PNG.',
  '-9003': 'Máy chủ HANET gặp lỗi khi đăng ký thành viên mới.',
  '-9004': 'Lỗi khi xóa nhân sự.',
  '-9005': 'Mã nhân viên (Mã NV) này đã tồn tại trên hệ thống. Vui lòng chọn mã khác.',
  '-9006': 'Ảnh chụp không đạt chuẩn nhận diện! Yêu cầu: Ảnh rõ nét, chỉ có 1 người, nhìn thẳng vào camera, không đeo khẩu trang hay đội nón.',
  '-9007': 'Khuôn mặt này đã được đăng ký trước đó trên hệ thống.',
  '-9008': 'Dung lượng bộ nhớ Face ID của Nhà thờ đã hết. Vui lòng liên hệ Admin để nâng cấp gói Cloud.'
};

exports.getErrorMessage = (code, defaultMsg = 'Đã xảy ra lỗi không xác định từ máy chủ HANET.') => {
  if (!code && code !== 0) return defaultMsg;
  return ERROR_MAP[String(code)] || defaultMsg;
};

exports.ERROR_MAP = ERROR_MAP;

```

### File: `src/routes/personRoutes.js`
```js
const express = require('express');
const multer = require('multer');
const path = require('path');
const personController = require('../controllers/personController');
const authController = require('../controllers/authController');
const { authorize, ROLES } = require('../middlewares/authMiddleware');
const { auditLog } = require('../middlewares/auditMiddleware');

const router = express.Router();

const upload = multer({
  dest: path.join(process.cwd(), 'uploads/temp/'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB
});

/* =========================================================================
 * 1. PUBLIC ROUTES (Không dùng authorize - Dành cho Zalo WebView & Công khai)
 * ========================================================================= */
router.get('/links', personController.showLinks);
router.get('/login', authController.showLogin);
router.post('/login', authController.handleLogin);
router.get('/logout', authController.handleLogout);

// Đăng ký theo lớp / file danh mục CSV (Tối ưu Zalo WebView)
router.get('/register/:file_name', personController.showRegisterForm);
router.get('/register', personController.renderRegisterForm);
router.post('/register/:file_name', upload.any(), auditLog('REGISTER_FACE_BY_FILE'), personController.handleRegister);
router.post('/register', upload.any(), auditLog('REGISTER_FACE_GENERAL'), personController.handleRegister);

/* =========================================================================
 * 2. PROTECTED ROUTES (Áp dụng RBAC & Audit Log)
 * ========================================================================= */

// Quản lý danh sách nhân sự trên Cloud
router.get('/admin/person/list', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), personController.list);
router.get('/admin/list', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), personController.list);

// Cập nhật thông tin / FaceID nhân sự
router.post('/admin/person/update', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), upload.any(), auditLog('UPDATE_PERSON'), personController.update);
router.get('/edit/:personID', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), personController.renderEditForm);
router.put('/update/:personID', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), upload.any(), auditLog('UPDATE_PERSON'), personController.update);
router.post('/update/:personID', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), upload.any(), auditLog('UPDATE_PERSON'), personController.update);

// Xóa nhân sự khỏi Cloud và CSV
router.post('/admin/person/delete', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('DELETE_PERSON'), personController.delete);
router.delete('/delete/:personID', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('DELETE_PERSON'), personController.delete);
router.post('/delete/:personID', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('DELETE_PERSON'), personController.delete);
router.delete('/person/delete/:personID', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('DELETE_PERSON'), personController.delete);
router.post('/person/delete/:personID', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('DELETE_PERSON'), personController.delete);

// Đồng bộ Cloud về CSV
router.post('/admin/sync/cloud-to-csv', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('TRIGGER_CLOUD_SYNC'), personController.triggerSync);

// Quản lý Dead Letter Queue (DLQ)
router.get('/admin/dlq', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), personController.viewDLQ);

// Lịch sử Check-in Real-time
router.get('/checkin', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), personController.renderCheckin);

module.exports = router;

```

### File: `src/routes/departmentRoutes.js`
```js
const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authorize, ROLES } = require('../middlewares/authMiddleware');
const { auditLog } = require('../middlewares/auditMiddleware');

// [READ] Danh sách phòng ban
router.get('/', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), departmentController.listDepartments);

// [CREATE] Tạo mới phòng ban
router.post('/create', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('CREATE_DEPARTMENT'), departmentController.handleCreate);

// [UPDATE] Cập nhật phòng ban
router.put('/update/:id', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('UPDATE_DEPARTMENT'), departmentController.handleUpdate);

// [DELETE] Xóa phòng ban
router.delete('/delete/:id', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('DELETE_DEPARTMENT'), departmentController.handleDelete);

// [FIX] Tự động xoá và tạo lại phòng ban qua API app (gắn đúng placeID)
router.post('/fix/:id', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('FIX_DEPARTMENT'), departmentController.handleFix);

// [READ] Xem danh sách thành viên thuộc phòng ban
router.get('/:departmentID/members', authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]), departmentController.viewMembers);

// [CREATE/ADD] Thêm thành viên vào phòng ban
router.post('/:departmentID/members/add', authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]), auditLog('ADD_DEPARTMENT_MEMBERS'), departmentController.handleAddMembers);

module.exports = router;

```

### File: `src/routes/classRoutes.js`
```js
const express = require('express');
const router = express.Router();
const dbClassService = require('../services/dbClassService');

// 1. Hiển thị trang quản lý lớp học (PostgreSQL)
router.get('/class/:className', async (req, res) => {
  try {
    const { className } = req.params;
    const members = await dbClassService.getClassMembers(className);
    const department = members.length > 0 ? (members[0].department_id || '990653') : '990653';
    res.render('class_manager', { className, members, department, layout: false });
  } catch (err) {
    console.error('[ClassRoutes] Lỗi tải danh sách lớp từ PostgreSQL:', err.message);
    res.status(500).send('Lỗi máy chủ khi tải thông tin lớp');
  }
});

// 2. Thêm thành viên mới vào lớp (PostgreSQL)
router.post('/class/:className/member', async (req, res) => {
  try {
    const { className } = req.params;
    const { name, title, department, aliasId, alias_id } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên thành viên không được để trống' });
    }

    const member = await dbClassService.addMember({
      name: name.trim(),
      className,
      departmentId: department,
      title: title || 'Học Sinh',
      aliasId: aliasId || alias_id || null
    });

    res.json({
      success: true,
      member,
      aliasID: member.alias_id || member.AliasID
    });
  } catch (err) {
    console.error('[ClassRoutes] Lỗi thêm thành viên:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Chỉnh sửa thông tin / Đổi tên thành viên (PostgreSQL)
router.put('/class/:className/member', async (req, res) => {
  try {
    const { className } = req.params;
    const { alias, alias_id, name, title, department, class: newClass } = req.body;
    const targetAlias = alias || alias_id;

    if (!targetAlias) {
      return res.status(400).json({ success: false, message: 'Thiếu AliasID của thành viên cần sửa' });
    }
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Tên thành viên không được để trống' });
    }

    const updated = await dbClassService.updateMember(targetAlias, {
      name: name.trim(),
      title,
      className: newClass || className,
      departmentId: department
    });

    res.json({ success: true, member: updated });
  } catch (err) {
    console.error('[ClassRoutes] Lỗi cập nhật thành viên:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Xóa thành viên (PostgreSQL)
router.delete('/class/:className/member/:alias', async (req, res) => {
  try {
    const { alias } = req.params;

    if (!alias) {
      return res.status(400).json({ success: false, message: 'Thiếu AliasID cần xóa' });
    }

    await dbClassService.deleteMember(alias);
    res.json({ success: true, message: 'Đã xóa thành viên thành công' });
  } catch (err) {
    console.error('[ClassRoutes] Lỗi xóa thành viên:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Đổi tên Lớp (PostgreSQL)
router.post('/class/:className/rename', async (req, res) => {
  try {
    const { className } = req.params;
    const { newClassName } = req.body;

    if (!newClassName || !newClassName.trim()) {
      return res.status(400).json({ success: false, message: 'Tên lớp mới không được để trống' });
    }

    const result = await dbClassService.renameClass(className, newClassName.trim());
    res.json({ success: true, newClassName: newClassName.trim(), result });
  } catch (err) {
    console.error('[ClassRoutes] Lỗi đổi tên lớp:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;

```

### File: `src/routes/transferRoutes.js`
```js
const express = require('express');
const router = express.Router();
const transferController = require('../controllers/transferController');
const { authorize, ROLES } = require('../middlewares/authMiddleware');
const { auditLog } = require('../middlewares/auditMiddleware');

/* =========================================================================
 * 1. GIAO DIỆN QUẢN LÝ CHUYỂN LỚP (Admin Interface)
 * ========================================================================= */
router.get(
  '/admin/transfers',
  authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  transferController.renderTransferPage
);

/* =========================================================================
 * 2. RESTful APIs ĐIỀU PHỐI CHUYỂN LỚP & HOÀN TÁC
 * ========================================================================= */

// Lấy danh sách học sinh theo lớp
router.get(
  '/api/transfers/members',
  authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  transferController.getMembersByClass
);

// Xem trước tác động chuyển lớp
router.post(
  '/api/transfers/preview',
  authorize([ROLES.GROUP_LEADER, ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  transferController.preview
);

// Thực thi chuyển lớp (Saga flow + Audit Log)
router.post(
  '/api/transfers',
  authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  auditLog('TRANSFER_CLASS'),
  transferController.executeTransfer
);

// Hoàn tác đợt chuyển lớp (Restore + Audit Log)
router.post(
  '/api/transfers/:batchId/restore',
  authorize([ROLES.ADMIN, ROLES.SUPER_ADMIN]),
  auditLog('RESTORE_CLASS_TRANSFER'),
  transferController.restore
);

module.exports = router;

```

### File: `src/middlewares/authMiddleware.js`
```js
/**
 * Role-Based Access Control (RBAC) & Authentication Middleware
 */

const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  GROUP_LEADER: 'GROUP_LEADER',
  PUBLIC_USER: 'PUBLIC_USER'
};

/**
 * Middleware phân quyền theo vai trò (RBAC)
 * @param {Array<string>} allowedRoles - Danh sách vai trò được phép truy cập
 */
function authorize(allowedRoles = []) {
  return (req, res, next) => {
    const adminToken = process.env.ADMIN_TOKEN || process.env.APP_TOKEN;

    // 1. Nếu có token truyền qua Query URL (?token=...) hoặc Header Bearer
    const queryToken = req.query.token;
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    const providedToken = queryToken || bearerToken;

    if (adminToken && providedToken && String(providedToken) === String(adminToken)) {
      if (req.session) {
        req.session.user = {
          id: 'admin_sys',
          username: 'superadmin',
          role: ROLES.SUPER_ADMIN
        };
        req.session.isAdminAuthenticated = true;
      }
      req.user = req.session ? req.session.user : { id: 'admin_sys', username: 'superadmin', role: ROLES.SUPER_ADMIN };
    }

    // 2. Lấy thông tin user hiện tại từ Session hoặc Request
    let currentUser = req.session?.user || req.user || null;

    // Nếu không cấu hình ADMIN_TOKEN trên môi trường dev/local -> cấp quyền SUPER_ADMIN mặc định
    if (!adminToken && !currentUser) {
      currentUser = {
        id: 'dev_user',
        username: 'developer',
        role: ROLES.SUPER_ADMIN
      };
      if (req.session) req.session.user = currentUser;
      req.user = currentUser;
    }

    // 3. Nếu chưa đăng nhập / chưa có danh tính
    if (!currentUser) {
      if (req.accepts('html')) {
        return res.status(401).send(`
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>401 - Yêu Cầu Xác Thực</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
          </head>
          <body class="bg-light d-flex align-items-center justify-content-center vh-100">
            <div class="card border-0 shadow-sm rounded-4 p-4 text-center" style="max-width: 480px;">
              <div class="text-warning mb-3">
                <i class="bi bi-shield-lock-fill display-3"></i>
              </div>
              <h4 class="fw-bold text-dark">Yêu Cầu Xác Thực Danh Tính</h4>
              <p class="text-muted small mt-2">
                Trang quản trị này yêu cầu quyền truy cập hợp lệ. Vui lòng đăng nhập hoặc cung cấp mã Token xác thực.
              </p>
              <div class="alert alert-secondary small border-0 text-start py-2">
                <i class="bi bi-key-fill me-1"></i> Truy cập kèm mã Token quản trị (Ví dụ: <code>/?token=...</code>)
              </div>
              <a href="/links" class="btn btn-outline-primary btn-sm rounded-pill mt-2">
                <i class="bi bi-arrow-left me-1"></i> Trang Đăng Ký Theo Lớp
              </a>
            </div>
          </body>
          </html>
        `);
      }
      return res.status(401).json({ error: 'Chưa đăng nhập hoặc thiếu mã Token xác thực.' });
    }

    // 4. Kiểm tra Role có nằm trong allowedRoles không (nếu allowedRoles rỗng thì cho qua)
    if (allowedRoles.length > 0 && !allowedRoles.includes(currentUser.role)) {
      if (req.accepts('html')) {
        return res.status(403).send(`
          <!DOCTYPE html>
          <html lang="vi">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>403 - Không Có Quyền Truy Cập</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
          </head>
          <body class="bg-light d-flex align-items-center justify-content-center vh-100">
            <div class="card border-0 shadow-sm rounded-4 p-4 text-center" style="max-width: 480px;">
              <div class="text-danger mb-3">
                <i class="bi bi-slash-circle-fill display-3"></i>
              </div>
              <h4 class="fw-bold text-dark">403 - Quyền Truy Cập Bị Từ Chối</h4>
              <p class="text-muted small mt-2">
                Vai trò hiện tại của bạn (<code>${currentUser.role}</code>) không được phép thực hiện chức năng này.
              </p>
              <a href="/" class="btn btn-primary btn-sm rounded-pill mt-2">
                <i class="bi bi-house-door-fill me-1"></i> Về Trang Chủ
              </a>
            </div>
          </body>
          </html>
        `);
      }
      return res.status(403).json({ error: 'Không có quyền truy cập chức năng này (Forbidden).' });
    }

    req.user = currentUser;
    next();
  };
}

/**
 * Global Interceptor Middleware tự động nhận diện token quản trị
 */
const defaultAuthMiddleware = (req, res, next) => {
  const adminToken = process.env.ADMIN_TOKEN || process.env.APP_TOKEN;
  const queryToken = req.query.token;
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const providedToken = queryToken || bearerToken;

  if (adminToken && providedToken && String(providedToken) === String(adminToken)) {
    if (req.session) {
      req.session.user = {
        id: 'admin_sys',
        username: 'superadmin',
        role: ROLES.SUPER_ADMIN
      };
      req.session.isAdminAuthenticated = true;
    }
    req.user = req.session ? req.session.user : { id: 'admin_sys', username: 'superadmin', role: ROLES.SUPER_ADMIN };
  }

  next();
};

module.exports = defaultAuthMiddleware;
module.exports.ROLES = ROLES;
module.exports.authorize = authorize;

```

### File: `src/middlewares/auditMiddleware.js`
```js
const { pool } = require('../config/database');

/**
 * Middleware tự động ghi Structured Audit Log cho các thao tác CUD / Sync vào PostgreSQL
 * @param {string} actionName - Tên hành động nghiệp vụ (Ví dụ: UPDATE_PERSON, DELETE_PERSON, TRIGGER_CLOUD_SYNC)
 */
function auditLog(actionName = 'SYSTEM_ACTION') {
  return (req, res, next) => {
    // Lắng nghe sự kiện finish của response để trích xuất đầy đủ dữ liệu
    res.on('finish', () => {
      const user = req.session?.user || req.user || {
        id: 'ANONYMOUS',
        userId: 'ANONYMOUS',
        username: 'anonymous_user',
        role: 'GUEST'
      };

      const ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || req.ip || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || 'Unknown-Agent';

      // Trích xuất target metadata
      const targetId = req.params?.personID || req.params?.id || req.body?.personID || req.body?.aliasID || req.params?.file_name || req.params?.departmentID || null;

      // Trích xuất chi tiết thay đổi
      const details = {
        query: req.query || {},
        params: req.params || {},
        bodyKeys: Object.keys(req.body || {}),
        changes: {
          name: req.body?.name || req.body?.personName || null,
          title: req.body?.title || null,
          departmentID: req.body?.departmentID || null,
          aliasID: req.body?.aliasID || null,
          className: req.params?.file_name || req.body?.source_csv || req.body?.className || null
        }
      };

      // 1. In ra Terminal với format tiêu chuẩn [AUDIT]
      console.log(`[AUDIT] ${actionName} | Actor: ${user.username || 'guest'} (${user.role || 'GUEST'}) | Status: ${res.statusCode} | Target: ${targetId || 'N/A'}`);

      // 2. Ghi trực tiếp vào bảng audit_logs trong PostgreSQL
      pool.query(
        `INSERT INTO audit_logs (action, user_id, username, role, status_code, ip_address, user_agent, target_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
        [
          actionName,
          user.id || user.userId || 'ANONYMOUS',
          user.username || 'guest',
          user.role || 'GUEST',
          res.statusCode,
          String(ip),
          String(userAgent),
          targetId ? String(targetId) : null,
          JSON.stringify(details)
        ]
      ).catch(err => {
        console.error('[Audit DB Error] Không thể ghi bảng audit_logs:', err.message);
      });
    });

    next();
  };
}

module.exports = {
  auditLog
};

```

### File: `src/services/idempotencyService.js`
```js
require('dotenv').config();
const Redis = require('ioredis');

class IdempotencyService {
  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      db: parseInt(process.env.REDIS_DB || '4', 10),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false
    });

    this.redis.on('error', (err) => {
      console.error('[IdempotencyService Redis Error]', err.message);
    });
  }

  /**
   * Sinh khóa Idempotency theo hành động và định danh
   * @param {string} action - Hành động (ví dụ: FACE_REGISTER, PERSON_UPDATE)
   * @param {string} identifier - Mã định danh duy nhất (ví dụ: AliasID, PersonID)
   * @returns {string} Khóa dạng idempotency:hanet:<ACTION>:<IDENTIFIER>
   */
  generateKey(action, identifier) {
    const cleanAction = String(action || 'DEFAULT').trim().toUpperCase();
    const cleanId = String(identifier || '').trim().toUpperCase();
    return `idempotency:hanet:${cleanAction}:${cleanId}`;
  }

  /**
   * Chiếm khóa xử lý (Distributed Lock) với Redis SETNX
   * @param {string} key - Khóa idempotency
   * @param {number} ttlSeconds - Thời gian sống của lock (mặc định 120s = 2 phút)
   * @returns {Promise<boolean>} true nếu chiếm lock thành công, false nếu bị trùng lặp
   */
  async acquireLock(key, ttlSeconds = 120) {
    try {
      const result = await this.redis.set(key, 'PROCESSING', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      console.error(`[IdempotencyService] Lỗi khi acquireLock cho key ${key}:`, err.message);
      // Fail-open an toàn nếu Redis gặp sự cố để không làm gián đoạn nghiệp vụ
      return true;
    }
  }

  /**
   * Lấy trạng thái hiện tại của khóa trên Redis DB 4
   * @param {string} key - Khóa idempotency
   * @returns {Promise<string|null>} Giá trị hiện tại ('PROCESSING', 'COMPLETED', null,...)
   */
  async getLockStatus(key) {
    try {
      return await this.redis.get(key);
    } catch (err) {
      console.error(`[IdempotencyService] Lỗi khi getLockStatus cho key ${key}:`, err.message);
      return null;
    }
  }

  /**
   * Đánh dấu tác vụ đã hoàn tất thành công (lưu trạng thái trong 24 giờ)
   * @param {string} key - Khóa idempotency
   * @param {number} ttlSeconds - Thời gian lưu trạng thái (mặc định 86400s = 24h)
   * @returns {Promise<boolean>}
   */
  async markCompleted(key, ttlSeconds = 86400) {
    try {
      const result = await this.redis.set(key, 'COMPLETED', 'EX', ttlSeconds);
      return result === 'OK';
    } catch (err) {
      console.error(`[IdempotencyService] Lỗi khi markCompleted cho key ${key}:`, err.message);
      return false;
    }
  }

  /**
   * Xóa khóa khi gặp lỗi tạm thời để lượt retry tiếp theo có thể chạy
   * @param {string} key - Khóa idempotency
   * @returns {Promise<boolean>}
   */
  async releaseLock(key) {
    try {
      await this.redis.del(key);
      return true;
    } catch (err) {
      console.error(`[IdempotencyService] Lỗi khi releaseLock cho key ${key}:`, err.message);
      return false;
    }
  }
}

module.exports = new IdempotencyService();

```

### File: `src/services/transferService.js`
```js
const crypto = require('crypto');
const { pool } = require('../config/database');
const hanetService = require('./hanetService');

/**
 * Service Quản lý Chuyển Lớp & Saga Workflow (transferService)
 * Đảm bảo tính toàn vẹn dữ liệu giữa PostgreSQL 16 và HANET AI Cloud
 */

/**
 * Phân tích và lấy mã phòng ban mặc định theo tên lớp
 * @param {string} className 
 * @returns {string} departmentID
 */
function resolveDepartmentId(className) {
  if (!className) return '990653';
  const norm = className.toString().toLowerCase();
  if (norm.includes('dmhccc') || norm.includes('legio') || norm.includes('mariae') || norm.startsWith('lm')) {
    return '990730'; // Legiô Mariae
  }
  if (norm.includes('gioitre') || norm.includes('giới trẻ') || norm.startsWith('gt')) {
    return '990731'; // Giới Trẻ
  }
  if (norm.includes('giatruong') || norm.includes('gia trưởng') || norm.startsWith('gtr')) {
    return '990732'; // Gia Trưởng
  }
  if (norm.includes('hienmau') || norm.includes('hiền mẫu') || norm.startsWith('hm')) {
    return '990733'; // Hiền Mẫu
  }
  return '990653'; // Thiếu Nhi / GLV
}

/**
 * Sinh AliasID ngẫu nhiên theo RULE-004 không va chạm khóa unique
 * @param {string} targetClass Tên lớp đích
 * @returns {Promise<string>}
 */
async function generateTransferAlias(targetClass) {
  const deptId = resolveDepartmentId(targetClass);
  let deptPrefix = 'TN';
  if (deptId === '990730') deptPrefix = 'LM';
  else if (deptId === '990731') deptPrefix = 'GT';
  else if (deptId === '990732') deptPrefix = 'GTR';
  else if (deptId === '990733') deptPrefix = 'HM';

  const cleanClass = (targetClass || 'CHUNG')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

  let attempts = 0;
  while (attempts < 50) {
    attempts++;
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 ký tự HEX A-Z0-9
    const candidateAlias = `${deptPrefix}_${cleanClass}_${suffix}`;

    const checkRes = await pool.query('SELECT 1 FROM persons WHERE alias_id = $1 LIMIT 1', [candidateAlias]);
    if (checkRes.rows.length === 0) {
      return candidateAlias;
    }
  }

  // Fallback an toàn nếu sau 50 lần thử vẫn trùng
  return `${deptPrefix}_${cleanClass}_${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

/**
 * Xem trước danh sách chuyển lớp và phân loại nhóm xử lý
 * @param {string} fromClass Lớp hiện tại
 * @param {string} toClass Lớp chuyển đến
 * @param {Array<number|string>} [personIds] Danh sách ID người cần chuyển (nếu rỗng chuyển cả lớp)
 * @returns {Promise<Object>}
 */
async function previewTransfer(fromClass, toClass, personIds = []) {
  if (!fromClass || !toClass) {
    throw new Error('Thiếu thông tin lớp nguồn hoặc lớp đích');
  }

  let query = `
    SELECT id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status 
    FROM persons 
    WHERE class_name = $1
  `;
  const params = [fromClass];

  if (personIds && personIds.length > 0) {
    query += ' AND id = ANY($2::bigint[])';
    params.push(personIds);
  }

  query += ' ORDER BY id ASC';

  const res = await pool.query(query, params);
  const allMembers = res.rows;

  const databaseOnly = [];
  const hanetSync = [];

  for (const member of allMembers) {
    const hasCloudFace = !!(member.person_id && String(member.person_id).trim() !== '' && member.sync_status === 'SYNCED');

    if (hasCloudFace) {
      const generatedNewAlias = await generateTransferAlias(toClass);
      hanetSync.push({
        ...member,
        current_alias: member.alias_id,
        new_alias: generatedNewAlias,
        type: 'HANET_SYNC'
      });
    } else {
      databaseOnly.push({
        ...member,
        current_alias: member.alias_id,
        new_alias: member.alias_id, // Giữ nguyên alias nếu DB-only
        type: 'DATABASE_ONLY'
      });
    }
  }

  return {
    fromClass,
    toClass,
    total: allMembers.length,
    databaseOnlyCount: databaseOnly.length,
    hanetSyncCount: hanetSync.length,
    databaseOnly,
    hanetSync
  };
}

/**
 * Thực thi Saga Workflow chuyển lớp cho danh sách thành viên
 * @param {string} fromClass Lớp nguồn
 * @param {string} toClass Lớp đích
 * @param {Array<number|string>} personIds Danh sách ID học sinh chuyển
 * @param {Object} [actor] Thông tin người thực hiện { userId, username, role }
 * @returns {Promise<Object>}
 */
async function transferMembers(fromClass, toClass, personIds = [], actor = {}) {
  if (!fromClass || !toClass) {
    throw new Error('Thiếu thông tin lớp nguồn hoặc lớp đích');
  }

  const batchId = `batch_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const targetDeptId = resolveDepartmentId(toClass);

  // 1. Đảm bảo lớp đích tồn tại trong bảng classes
  await pool.query(
    `INSERT INTO classes (name, department_id) 
     VALUES ($1, $2) 
     ON CONFLICT (name) DO NOTHING`,
    [toClass, targetDeptId]
  );

  // 2. Lấy danh sách thành viên cần chuyển
  let query = `
    SELECT id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status 
    FROM persons 
    WHERE class_name = $1
  `;
  const params = [fromClass];

  if (personIds && personIds.length > 0) {
    query += ' AND id = ANY($2::bigint[])';
    params.push(personIds);
  }

  const res = await pool.query(query, params);
  const members = res.rows;

  if (members.length === 0) {
    return {
      batchId,
      total: 0,
      successCount: 0,
      failedCount: 0,
      message: 'Không tìm thấy thành viên phù hợp để chuyển lớp'
    };
  }

  let successCount = 0;
  let failedCount = 0;
  const results = [];

  for (const member of members) {
    const hasCloudFace = !!(member.person_id && String(member.person_id).trim() !== '' && member.sync_status === 'SYNCED');

    if (!hasCloudFace) {
      // Nhóm 1: DATABASE_ONLY (Chưa có Face ID) -> Cập nhật trực tiếp Postgres, không gọi HANET Cloud
      try {
        await pool.query(
          `UPDATE persons 
           SET class_name = $1, department_id = $2, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $3`,
          [toClass, targetDeptId, member.id]
        );

        // Ghi snapshot lưu vết
        await pool.query(
          `INSERT INTO transfer_snapshots 
           (batch_id, person_id_local, from_class, to_class, old_alias_id, new_alias_id, hanet_person_id, face_url, sync_status, error_message, created_at)
           VALUES ($1, $2, $3, $4, $5, $5, $6, $7, 'SYNCED', NULL, CURRENT_TIMESTAMP)`,
          [batchId, member.id, fromClass, toClass, member.alias_id, member.person_id || null, member.face_url || null]
        );

        successCount++;
        results.push({ id: member.id, name: member.name, status: 'SUCCESS', type: 'DATABASE_ONLY' });
      } catch (err) {
        failedCount++;
        results.push({ id: member.id, name: member.name, status: 'FAILED', type: 'DATABASE_ONLY', error: err.message });
      }
    } else {
      // Nhóm 2: HANET_SYNC (Đã có Face ID trên Cloud) -> Saga Workflow
      const newAlias = await generateTransferAlias(toClass);
      let snapshotId = null;

      try {
        // Bước 1: Ghi Snapshot với trạng thái PROCESSING
        const snapRes = await pool.query(
          `INSERT INTO transfer_snapshots 
           (batch_id, person_id_local, from_class, to_class, old_alias_id, new_alias_id, hanet_person_id, face_url, sync_status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PROCESSING', CURRENT_TIMESTAMP)
           RETURNING id`,
          [batchId, member.id, fromClass, toClass, member.alias_id, newAlias, member.person_id, member.face_url]
        );
        snapshotId = snapRes.rows[0].id;

        // Bước 2: Gọi HANET Cloud API cập nhật AliasID và DepartmentID
        const cloudRes = await hanetService.updateInfo({
          aliasID: member.alias_id,
          name: member.name,
          title: member.title || 'Học sinh',
          departmentID: targetDeptId
        });

        if (cloudRes && (cloudRes.returnCode === 1 || cloudRes.returnCode === '1')) {
          // Bước 3: Cloud thành công -> Cập nhật PostgreSQL
          await pool.query(
            `UPDATE persons 
             SET class_name = $1, department_id = $2, alias_id = $3, sync_status = 'SYNCED', updated_at = CURRENT_TIMESTAMP 
             WHERE id = $4`,
            [toClass, targetDeptId, newAlias, member.id]
          );

          // Bước 4: Chốt Snapshot SYNCED
          await pool.query(
            `UPDATE transfer_snapshots SET sync_status = 'SYNCED' WHERE id = $1`,
            [snapshotId]
          );

          successCount++;
          results.push({ id: member.id, name: member.name, status: 'SUCCESS', type: 'HANET_SYNC', newAlias });
        } else {
          // Cloud báo lỗi -> Cập nhật snapshot FAILED, Database giữ nguyên lớp cũ
          const errorMsg = cloudRes?.returnMessage || `HANET API Error Code: ${cloudRes?.returnCode}`;
          await pool.query(
            `UPDATE transfer_snapshots SET sync_status = 'FAILED', error_message = $1 WHERE id = $2`,
            [errorMsg, snapshotId]
          );

          failedCount++;
          results.push({ id: member.id, name: member.name, status: 'FAILED', type: 'HANET_SYNC', error: errorMsg });
        }
      } catch (err) {
        // Exception kết nối / timeout -> Đánh dấu FAILED, Database an toàn
        if (snapshotId) {
          await pool.query(
            `UPDATE transfer_snapshots SET sync_status = 'FAILED', error_message = $1 WHERE id = $2`,
            [err.message, snapshotId]
          ).catch(() => {});
        }

        failedCount++;
        results.push({ id: member.id, name: member.name, status: 'FAILED', type: 'HANET_SYNC', error: err.message });
      }
    }
  }

  return {
    batchId,
    fromClass,
    toClass,
    total: members.length,
    successCount,
    failedCount,
    results
  };
}

/**
 * Hoàn tác đợt chuyển lớp (Restore Transfer) an toàn
 * @param {string} batchId Mã đợt chuyển lớp cần hoàn tác
 * @returns {Promise<Object>}
 */
async function restoreTransfer(batchId) {
  if (!batchId) {
    throw new Error('Thiếu mã đợt chuyển lớp (batchId)');
  }

  // 1. Kiểm tra snapshot đợt chuyển
  const snapRes = await pool.query(
    `SELECT * FROM transfer_snapshots WHERE batch_id = $1 ORDER BY id ASC`,
    [batchId]
  );

  if (snapRes.rows.length === 0) {
    throw new Error(`Không tìm thấy dữ liệu chuyển lớp với BatchID: ${batchId}`);
  }

  const snapshots = snapRes.rows;
  const alreadyRestoredCount = snapshots.filter(s => s.restored_at !== null).length;
  if (alreadyRestoredCount === snapshots.length) {
    const error = new Error('RESTORE_NOT_ALLOWED: Giao dịch này đã được hoàn tác trước đó.');
    error.code = 'RESTORE_NOT_ALLOWED';
    throw error;
  }

  let restoredCount = 0;
  let skippedCount = 0;
  const details = [];

  for (const snap of snapshots) {
    // 2. Kiểm tra không hoàn tác 2 lần
    if (snap.restored_at) {
      skippedCount++;
      details.push({ id: snap.person_id_local, status: 'SKIPPED', reason: 'Đã hoàn tác trước đó' });
      continue;
    }

    if (snap.sync_status !== 'SYNCED') {
      skippedCount++;
      details.push({ id: snap.person_id_local, status: 'SKIPPED', reason: 'Chưa từng chuyển thành công' });
      continue;
    }

    // 3. Kiểm tra người đó chưa bị chuyển tiếp sang lớp thứ 3
    const personRes = await pool.query(
      `SELECT id, name, class_name, alias_id, person_id, title FROM persons WHERE id = $1`,
      [snap.person_id_local]
    );

    if (personRes.rows.length === 0) {
      skippedCount++;
      details.push({ id: snap.person_id_local, status: 'SKIPPED', reason: 'Không tìm thấy nhân sự trong DB' });
      continue;
    }

    const currentPerson = personRes.rows[0];
    if (currentPerson.class_name !== snap.to_class) {
      skippedCount++;
      details.push({
        id: snap.person_id_local,
        name: currentPerson.name,
        status: 'SKIPPED',
        reason: `Học sinh đã bị chuyển tiếp sang lớp khác (${currentPerson.class_name}), không thể hoàn tác về ${snap.from_class}`
      });
      continue;
    }

    // 4. Nếu có Face ID trên Cloud -> Khôi phục old_alias_id trên Cloud
    const fromDeptId = resolveDepartmentId(snap.from_class);
    if (snap.hanet_person_id && snap.old_alias_id) {
      try {
        await hanetService.updateInfo({
          aliasID: snap.old_alias_id,
          name: currentPerson.name,
          title: currentPerson.title || 'Học sinh',
          departmentID: fromDeptId
        });
      } catch (cloudErr) {
        console.warn(`[RestoreTransfer] Cảnh báo khôi phục Cloud cho ${currentPerson.name}:`, cloudErr.message);
      }
    }

    // 5. Cập nhật lại Database PostgreSQL về lớp cũ
    await pool.query(
      `UPDATE persons 
       SET class_name = $1, alias_id = COALESCE($2, alias_id), department_id = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4`,
      [snap.from_class, snap.old_alias_id, fromDeptId, snap.person_id_local]
    );

    // 6. Đánh dấu đã hoàn tác trong snapshot
    await pool.query(
      `UPDATE transfer_snapshots SET restored_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [snap.id]
    );

    restoredCount++;
    details.push({ id: snap.person_id_local, name: currentPerson.name, status: 'RESTORED', from: snap.to_class, backTo: snap.from_class });
  }

  return {
    batchId,
    total: snapshots.length,
    restoredCount,
    skippedCount,
    details
  };
}

module.exports = {
  generateTransferAlias,
  previewTransfer,
  transferMembers,
  restoreTransfer,
  resolveDepartmentId
};

```

### File: `src/services/queueService.js`
```js
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Queue = require('bull');
const hanetService = require('./hanetService');
const imageService = require('./imageService');
const idempotencyService = require('./idempotencyService');
const { pool } = require('../config/database');
const { getErrorMessage } = require('../utils/hanetErrorMap');

/**
 * Lớp lỗi đại diện cho các lỗi vĩnh viễn không thể khôi phục bằng retry
 */
class UnrecoverableError extends Error {
  constructor(message, code = null) {
    super(message);
    this.name = 'UnrecoverableError';
    this.code = code;
    this.isUnrecoverable = true;
  }
}

// Danh sách mã lỗi vĩnh viễn không thể phục hồi bằng retry tự động (lỗi tham số, lỗi ảnh, lỗi quyền)
const PERMANENT_ERROR_CODES = new Set([
  -1, -1005, -2035, -5005, -5006, -5010, -5011, -9002, -9005, -9006, -9008
]);

// Alias tương thích cho NON_RETRIABLE_CODES
const NON_RETRIABLE_CODES = PERMANENT_ERROR_CODES;

// Map tĩnh phòng ban chuẩn hóa theo quy chuẩn nghiệp vụ
const STATIC_DEPT_MAP = {
  'thiếu nhi': '990653',
  'thieu nhi': '990653',
  'legiô mariae': '990730',
  'legio mariae': '990730',
  'giới trẻ': '990731',
  'gioi tre': '990731'
};

/**
 * Sinh 4 ký tự ngẫu nhiên gồm chữ cái in hoa và số (A-Z, 0-9)
 */
function generateRandomSuffix(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Chuẩn hóa tên lớp cho AliasID:
 * - Viết hoa toàn bộ không dấu
 * - Ghép liền tên khối và phân lớp, loại bỏ hoàn toàn dấu gạch dưới (_) và khoảng trắng
 * Ví dụ: 'ThemSuc_1a' -> 'THEMSUC1A', 'XungToi_2a' -> 'XUNGTOI2A', 'BaoDong_3' -> 'BAODONG3'
 */
function normalizeClassNameForAlias(className) {
  if (!className) return '';
  return className
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '') // Loại bỏ triệt để _, space, ký tự lạ
    .toUpperCase()
    .trim();
}

/**
 * Chuẩn hóa động Phòng Ban, Chức Vụ và Alias chuẩn HANET Cloud:
 * Định dạng: [MÃ_PHÒNG_BAN]_[TÊN_LỚP]_[MÃ_ĐỊNH_DANH] (3 phần nối bằng 2 dấu gạch dưới)
 * Ví dụ: TN_THEMSUC1A_4BDI, TN_GLV_FNWD, LM_DMHCCC_I2SG
 * @param {string} className Tên lớp / nhóm (VD: GLV, ThemSuc_1a, DMHCCC, GioiTre)
 * @param {string} inputTitle Chức vụ do người dùng nhập hoặc chọn
 * @param {string|number} inputDeptID ID phòng ban truyền vào (nếu có)
 * @param {string} inputAlias Alias truyền vào (nếu có)
 * @returns {Promise<{ departmentName: string, targetDeptID: string, title: string, aliasID: string }>}
 */
async function resolveDepartmentAndAlias(className, inputTitle = '', inputDeptID = '', inputAlias = '') {
  const cleanClass = (className || '').replace(/\.csv$/i, '').trim();
  const normalizedClass = normalizeClassNameForAlias(cleanClass);

  // 1. Tra cứu phòng ban từ PostgreSQL classes table
  let dbDeptId = '';
  if (cleanClass) {
    try {
      const classRes = await pool.query('SELECT department_id FROM classes WHERE name = $1 LIMIT 1', [cleanClass]);
      if (classRes.rows.length > 0 && classRes.rows[0].department_id) {
        dbDeptId = classRes.rows[0].department_id;
      }
    } catch (err) {
      console.warn('[resolveDepartmentAndAlias] DB class lookup error:', err.message);
    }
  }

  // 2. Phân loại Chức vụ (Title)
  let resolvedTitle = 'Học Sinh';
  if (inputTitle && inputTitle.trim()) {
    resolvedTitle = inputTitle.trim();
  } else if (normalizedClass === 'GLV' || normalizedClass.includes('GLV')) {
    resolvedTitle = 'Giáo Lý Viên';
  } else if (normalizedClass.includes('DMHCCC') || normalizedClass.includes('LEGIO') || normalizedClass.includes('LM')) {
    resolvedTitle = 'Hội Viên';
  } else if (normalizedClass.includes('GIOITRE') || normalizedClass.includes('GT')) {
    resolvedTitle = 'Thành Viên';
  }

  // 3. Phân loại Phòng ban (Department)
  let targetDeptID = inputDeptID ? String(inputDeptID) : (dbDeptId ? String(dbDeptId) : '');
  let departmentName = 'Thiếu Nhi';

  if (!targetDeptID || targetDeptID === '0') {
    const norm = cleanClass.toLowerCase();
    if (norm.includes('glv') || norm.includes('giao ly') || norm.includes('thiếu nhi') || norm.includes('themsuc') || norm.includes('baodong') || norm.includes('khaitam') || norm.includes('xungtoi') || norm.includes('vaodoi')) {
      targetDeptID = '990653';
      departmentName = 'Thiếu Nhi';
    } else if (norm.includes('dmhccc') || norm.includes('legio') || norm.includes('mariae') || norm.startsWith('lm')) {
      targetDeptID = '990730';
      departmentName = 'Legiô Mariae';
    } else if (norm.includes('gioitre') || norm.includes('giới trẻ') || norm.startsWith('gt')) {
      targetDeptID = '990731';
      departmentName = 'Giới Trẻ';
    }
  }

  // Nếu vẫn chưa có ID, tra cứu theo map tĩnh
  if (!targetDeptID && STATIC_DEPT_MAP[departmentName.toLowerCase()]) {
    targetDeptID = STATIC_DEPT_MAP[departmentName.toLowerCase()];
  }

  // Tra cứu động danh sách phòng ban từ HANET nếu chưa tìm thấy
  if (!targetDeptID) {
    try {
      const deptListRes = await hanetService.getDepartmentList(1, 100);
      const hits = deptListRes?.data?.hits || (Array.isArray(deptListRes?.data) ? deptListRes.data : []);
      for (const d of hits) {
        const dName = (d.name || d.department_name || '').toLowerCase();
        if (dName.includes(departmentName.toLowerCase()) || departmentName.toLowerCase().includes(dName)) {
          targetDeptID = String(d.id || d.department_id);
          departmentName = d.name || d.department_name;
          break;
        }
      }
    } catch (err) {
      console.warn('[resolveDepartmentAndAlias] Dynamic department lookup error:', err.message);
    }
  }

  // Fallback an toàn
  if (!targetDeptID || targetDeptID === '0') {
    targetDeptID = '990653'; // Mặc định Thiếu Nhi
  }

  // 4. Sinh Tiền Tố Alias & Mã AliasID chuẩn gồm đúng 3 phần: [MÃ_PHÒNG_BAN]_[TÊN_LỚP]_[MÃ_ĐỊNH_DANH]
  let deptCode = 'TN';
  let classCode = normalizedClass || 'CHUNG';

  if (normalizedClass === 'GLV') {
    deptCode = 'TN';
    classCode = 'GLV';
  } else if (targetDeptID === '990653' || departmentName.toLowerCase().includes('thiếu nhi')) {
    deptCode = 'TN';
    classCode = normalizedClass || 'CHUNG';
  } else if (targetDeptID === '990730' || departmentName.toLowerCase().includes('mariae')) {
    deptCode = 'LM';
    classCode = normalizedClass || 'DMHCCC';
  } else if (targetDeptID === '990731' || departmentName.toLowerCase().includes('trẻ')) {
    deptCode = 'GT';
    classCode = normalizedClass || 'GIOITRE';
  } else if (departmentName.toLowerCase().includes('gia trưởng')) {
    deptCode = 'GTR';
    classCode = normalizedClass || 'GIATRUONG';
  } else if (departmentName.toLowerCase().includes('hiền mẫu')) {
    deptCode = 'HM';
    classCode = normalizedClass || 'HIENMAU';
  } else {
    deptCode = departmentName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase())
      .join('') || 'PB';
    classCode = normalizedClass || 'MEMBER';
  }

  const aliasPrefix = `${deptCode}_${classCode}_`;
  const randomSuffix = generateRandomSuffix(4);

  let finalAliasID = '';
  if (inputAlias && inputAlias.trim()) {
    let custom = inputAlias.trim().toUpperCase().replace(/\s+/g, '_');
    const parts = custom.split('_');
    if (parts.length >= 3 && /^00[0-9A-Z]{2}$/i.test(parts[parts.length - 1])) {
      parts[parts.length - 1] = randomSuffix;
      custom = parts.join('_');
    }
    finalAliasID = custom;
  } else {
    finalAliasID = `${aliasPrefix}${randomSuffix}`;
  }

  return {
    departmentName,
    targetDeptID,
    title: resolvedTitle,
    aliasID: finalAliasID
  };
}

// Cấu hình kết nối Redis DB 4 dùng chung
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  db: parseInt(process.env.REDIS_DB || '4', 10)
};

// 1. Khởi tạo Hàng Đợi Chính (hanet-registration)
const registrationQueue = new Queue('hanet-registration', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000 // Thử lại sau 2s, 4s, 8s
    },
    removeOnComplete: 100, // Giữ 100 job hoàn tất gần nhất
    removeOnFail: false    // Giữ job thất bại để phân tích và chuyển DLQ
  }
});

// Alias tương thích ngược
const hanetQueue = registrationQueue;

// 2. Khởi tạo Dead Letter Queue (DLQ) lưu trữ các job thất bại vĩnh viễn
const deadLetterQueue = new Queue('hanet-registration-dlq', {
  redis: redisConfig
});

// 3. Lắng nghe sự kiện thất bại của Queue chính để chuyển sang Dead Letter Queue (DLQ)
registrationQueue.on('failed', async (job, err) => {
  const isUnrecoverable = err && (err.name === 'UnrecoverableError' || err.isUnrecoverable);
  const isMaxAttempts = job.attemptsMade >= job.opts.attempts;

  if (isUnrecoverable || isMaxAttempts) {
    console.error(`🚨 [DLQ Trigger] Job ${job.id} (${job.name}) thất bại vĩnh viễn sau ${job.attemptsMade} lần thử. Chuyển vào DLQ.`);

    // Bảo toàn file ảnh khi job đi vào DLQ
    const imagePath = job.data?.imagePath;
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        const dlqPath = path.join(
          path.dirname(imagePath),
          'dlq_' + path.basename(imagePath)
        );
        fs.renameSync(imagePath, dlqPath);
        console.log('🛡️ [DLQ Preserved] Đã lưu ảnh lỗi để kiểm tra:', dlqPath);
      } catch (renameErr) {
        console.warn('⚠️ [DLQ Preserved Warning] Lỗi đổi tên ảnh lỗi:', renameErr.message);
      }
    }

    try {
      await deadLetterQueue.add('dead_letter_job', {
        originalJobId: job.id,
        jobName: job.name,
        jobData: job.data,
        failedReason: err.message,
        failedCode: err.code || null,
        isUnrecoverable: !!isUnrecoverable,
        attemptsMade: job.attemptsMade,
        failedAt: new Date().toISOString()
      }, {
        removeOnComplete: false,
        removeOnFail: false
      });
      console.log(`✅ [DLQ Stored] Đã lưu trữ Job ${job.id} vào deadLetterQueue thành công.`);

      // Cập nhật trạng thái FAILED trong PostgreSQL persons
      if (job.data?.aliasID || job.data?.personID) {
        await pool.query(
          `UPDATE persons
           SET sync_status = 'FAILED', updated_at = CURRENT_TIMESTAMP
           WHERE alias_id = $1 OR person_id = $2`,
          [job.data?.aliasID || null, job.data?.personID || null]
        ).catch(() => {});
      }
    } catch (dlqErr) {
      console.error(`❌ [DLQ Storage Error] Không thể lưu Job ${job.id} vào DLQ:`, dlqErr.message);
    }
  }
});

/**
 * Trích xuất personID từ response hoặc error object của HANET
 */
function extractPersonIDFromHanet(errorOrRes) {
  if (!errorOrRes) return null;
  const resData = errorOrRes.response?.data || errorOrRes.data || errorOrRes;
  return resData?.personID || resData?.personId || resData?.id || resData?.data?.personID || resData?.data?.id || null;
}

/**
 * Xử lý Fallback khi khuôn mặt đã tồn tại trên Cloud (Mã lỗi -9007)
 */
async function handleFaceExistsFallback(hanetError, memberName, className, jobAliasID) {
  const errData = hanetError?.response?.data || hanetError?.data || hanetError || {};
  const cloudData = errData?.data || errData || {};
  let cloudPersonId = String(cloudData.personID || cloudData.personId || cloudData.id || extractPersonIDFromHanet(hanetError) || '').trim();
  let cloudAliasId = String(cloudData.aliasID || cloudData.alias_id || '').trim();
  let cloudFaceUrl = String(cloudData.file || cloudData.avatar || cloudData.faceUrl || '').trim();

  // Nếu chưa có cloudPersonId trực tiếp từ payload, tra cứu nhanh qua list trên Cloud
  if (!cloudPersonId) {
    try {
      const listRes = await hanetService.getListByPlace();
      const allPersons = listRes?.data || [];
      const match = allPersons.find(p =>
        (cloudAliasId && p.aliasID === cloudAliasId) ||
        (jobAliasID && p.aliasID === jobAliasID) ||
        (p.name && p.name.trim().toLowerCase() === memberName.trim().toLowerCase())
      );
      if (match) {
        cloudPersonId = String(match.personID || match.id || '').trim();
        cloudAliasId = String(match.aliasID || cloudAliasId || '').trim();
        cloudFaceUrl = cloudFaceUrl || String(match.avatar || match.faceUrl || '').trim();
      }
    } catch (findErr) {
      console.warn(`[QueueService] Tra cứu nhân sự trùng lặp lỗi:`, findErr.message);
    }
  }

  console.log(`⚠️ [QueueService] Phát hiện khuôn mặt đã tồn tại trên Cloud (-9007):`);
  console.log(`   - Cloud PersonID: ${cloudPersonId || '(chưa rõ)'}`);
  console.log(`   - Cloud AliasID:  ${cloudAliasId || '(chưa rõ)'}`);

  if (cloudPersonId) {
    // 1. Nếu job sinh ra một alias tạm khác với alias gốc trên Cloud, xóa bản ghi thừa
    if (jobAliasID && cloudAliasId && jobAliasID !== cloudAliasId) {
      await pool.query(
        `DELETE FROM persons 
         WHERE alias_id = $1 
           AND (person_id IS NULL OR person_id = '') 
           AND sync_status = 'PENDING';`,
        [jobAliasID]
      ).catch(() => {});
    }

    // 2. Cập nhật chính xác vào bản ghi gốc trên DB khớp với Cloud
    await pool.query(
      `UPDATE persons 
       SET 
          person_id = $1,
          face_url = CASE WHEN $2 <> '' THEN $2 ELSE face_url END,
          sync_status = 'SYNCED',
          updated_at = CURRENT_TIMESTAMP
       WHERE alias_id = $3 
          OR person_id = $1 
          OR (TRIM(LOWER(name)) = TRIM(LOWER($4)) AND ($5::text IS NULL OR class_name = $5));`,
      [cloudPersonId, cloudFaceUrl, cloudAliasId || jobAliasID, memberName, className]
    );

    console.log(`✅ [QueueService] Đã đồng bộ an toàn bản ghi gốc theo thông tin HANET Cloud cho ${memberName}.`);
    return {
      returnCode: 1,
      returnMessage: 'Khuôn mặt đã tồn tại trên Cloud, đã đồng bộ an toàn vào Database',
      personID: cloudPersonId,
      aliasID: cloudAliasId || jobAliasID,
      updated: true
    };
  }

  return {
    returnCode: 1,
    returnMessage: 'Đã xử lý fallback khuôn mặt tồn tại',
    personID: cloudPersonId || null,
    updated: false
  };
}

// Xử lý Job đăng ký nhân sự ngầm
registrationQueue.process('register_person_job', 2, async (job) => {
  const { name, aliasID, title, departmentID, imagePath, publicImageUrl, imageFilename, source_csv, className, class_name, existing_person_id } = job.data;
  const targetClass = source_csv || className || class_name || null;
  const fallbackBaseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  const faceUrl = publicImageUrl || (imageFilename ? `${fallbackBaseUrl}/uploads/${imageFilename}` : null);

  // 1. Chuẩn hóa động Phòng Ban, Chức Vụ và Alias
  const resolved = await resolveDepartmentAndAlias(targetClass, title, departmentID, aliasID);
  const finalAlias = resolved.aliasID;
  const finalTitle = resolved.title;
  const finalDeptID = resolved.targetDeptID;

  // 2. Kiểm tra Idempotency Lock bằng Redis SETNX
  const lockKey = idempotencyService.generateKey('FACE_REGISTER', finalAlias);
  const currentStatus = await idempotencyService.getLockStatus(lockKey);

  if (currentStatus === 'COMPLETED') {
    console.log(`[IDEMPOTENCY] Bỏ qua tác vụ đã hoàn tất cho AliasID: ${finalAlias}`);
    return {
      status: 'SKIPPED_ALREADY_COMPLETED',
      returnCode: 1,
      returnMessage: 'Tác vụ đã được xử lý hoàn tất trước đó',
      aliasID: finalAlias,
      personID: existing_person_id || null
    };
  }

  const acquired = await idempotencyService.acquireLock(lockKey, 120);
  if (!acquired) {
    console.warn(`[CONCURRENCY] Job cho ${finalAlias} đang được xử lý bởi worker khác.`);
    throw new Error(`[CONCURRENCY] Job cho ${finalAlias} đang được xử lý bởi worker khác.`);
  }

  console.log(`[Queue register_person_job] (Attempt ${job.attemptsMade + 1}/${job.opts.attempts}) Bắt đầu xử lý: ${name} (${finalAlias}) | Chức vụ: ${finalTitle} | Phòng ban: ${resolved.departmentName} (${finalDeptID})`);

  let finalPersonID = existing_person_id || null;
  let finalAvatarUrl = faceUrl;
  let jobSucceeded = false;

  try {
    try {
      // 3. Thử gọi API đăng ký nhân sự (ưu tiên binary multipart nếu có imagePath, hoặc bằng URL)
      let registerRes;
      if (imagePath && fs.existsSync(imagePath)) {
        registerRes = await hanetService.registerPerson({
          name,
          aliasID: finalAlias,
          title: finalTitle,
          departmentID: finalDeptID,
          imagePath,
          publicImageUrl,
          faceUrl
        });
      } else {
        registerRes = await hanetService.registerPersonByUrl({
          name,
          aliasID: finalAlias,
          title: finalTitle,
          departmentID: finalDeptID,
          faceUrl: faceUrl || publicImageUrl
        });
      }

      if (registerRes && registerRes.returnCode === 1) {
        finalPersonID = registerRes.data?.personID || registerRes.data?.id;
        finalAvatarUrl = registerRes.data?.avatar || registerRes.data?.faceUrl || faceUrl;
        console.log(`[Queue register_person_job] ✅ Đăng ký mới thành công: ${finalPersonID}`);

        // Tự động gán phòng ban chuẩn trên Cloud
        if (finalDeptID && finalPersonID) {
          try {
            await hanetService.addPersonsToDepartment(finalDeptID, finalPersonID);
            console.log(`[Queue register_person_job] ✅ Đã khóa phòng ban ${finalDeptID} (${resolved.departmentName}) cho ${finalPersonID}`);
          } catch (deptErr) {
            console.warn(`[Queue register_person_job] Gán phòng ban lỗi:`, deptErr.message);
          }
        }

        // Tự động cập nhật trạng thái SYNCED vào PostgreSQL
        if (finalPersonID || finalAlias) {
          try {
            await pool.query(
              `UPDATE persons
               SET person_id = COALESCE($1, person_id),
                   face_url = COALESCE($2, face_url),
                   sync_status = 'SYNCED',
                   title = COALESCE($3, title),
                   department_id = COALESCE($4, department_id),
                   updated_at = CURRENT_TIMESTAMP
               WHERE alias_id = $5 OR person_id = $1`,
              [
                String(finalPersonID),
                finalAvatarUrl || faceUrl || null,
                finalTitle || null,
                finalDeptID || null,
                finalAlias
              ]
            );
            console.log(`[Queue register_person_job] ✅ Đã cập nhật PostgreSQL persons cho personID: ${finalPersonID} (Alias: ${finalAlias})`);
          } catch (dbErr) {
            console.warn(`[Queue register_person_job] Cập nhật Database thất bại:`, dbErr.message);
          }
        }

        // Đánh dấu hoàn tất trong Redis 24h
        await idempotencyService.markCompleted(lockKey, 86400);
        jobSucceeded = true;

        return { returnCode: 1, returnMessage: 'Success', personID: finalPersonID, aliasID: finalAlias };
      } else if (registerRes && (registerRes.returnCode === -9007 || registerRes.data?.returnCode === -9007)) {
        // Trường hợp HANET trả HTTP 200 kèm returnCode -9007 (Đã tồn tại khuôn mặt)
        const fallbackResult = await handleFaceExistsFallback(registerRes, name, targetClass, finalAlias);

        // Đánh dấu hoàn tất trong Redis 24h
        await idempotencyService.markCompleted(lockKey, 86400);
        jobSucceeded = true;

        return fallbackResult;
      } else {
        const errorMsg = getErrorMessage(registerRes?.returnCode, registerRes?.returnMessage);
        const code = Number(registerRes?.returnCode);

        // Kiểm tra lỗi vĩnh viễn (Permanent / Unrecoverable Failure) -> dừng retry ngay và đưa sang DLQ
        if (PERMANENT_ERROR_CODES.has(code)) {
          console.error(`[Queue register_person_job] ❌ Lỗi vĩnh viễn không thể retry (Mã ${code}): ${errorMsg}`);
          if (imagePath && fs.existsSync(imagePath)) {
            const dlqPath = path.join(
              path.dirname(imagePath),
              'dlq_' + path.basename(imagePath)
            );
            fs.renameSync(imagePath, dlqPath);
            console.log('🛡️ [DLQ Preserved] Đã lưu ảnh lỗi để kiểm tra:', dlqPath);
          }
          job.discard(); // Hủy retry trong Bull
          throw new UnrecoverableError(errorMsg, code);
        }

        // Lỗi tạm thời -> giải phóng lock để Bull Queue retry
        await idempotencyService.releaseLock(lockKey);
        throw new Error(`[Mã lỗi ${registerRes?.returnCode}]: ${errorMsg}`);
      }
    } catch (apiErr) {
      if (apiErr instanceof UnrecoverableError || apiErr.name === 'UnrecoverableError') {
        throw apiErr;
      }

      const errData = apiErr.response?.data;
      const code = Number(errData?.returnCode || apiErr.code);

      // Xử lý lỗi -9007 qua Catch block
      if (code === -9007 || (errData && (errData.returnCode === -9007 || errData.data?.returnCode === -9007))) {
        const fallbackResult = await handleFaceExistsFallback(apiErr, name, targetClass, finalAlias);

        await idempotencyService.markCompleted(lockKey, 86400);
        jobSucceeded = true;
        return fallbackResult;
      }

      const errorMsg = getErrorMessage(code, apiErr.message);

      if (PERMANENT_ERROR_CODES.has(code)) {
        console.error(`[Queue register_person_job] ❌ Lỗi vĩnh viễn trong catch block (Mã ${code}): ${errorMsg}`);
        if (imagePath && fs.existsSync(imagePath)) {
          const dlqPath = path.join(
            path.dirname(imagePath),
            'dlq_' + path.basename(imagePath)
          );
          fs.renameSync(imagePath, dlqPath);
          console.log('🛡️ [DLQ Preserved] Đã lưu ảnh lỗi để kiểm tra:', dlqPath);
        }
        job.discard();
        throw new UnrecoverableError(errorMsg, code);
      }

      // Lỗi tạm thời -> giải phóng lock để Bull Queue retry
      await idempotencyService.releaseLock(lockKey);
      throw apiErr;
    }

  } finally {
    // [RULE-022] Đối với Lỗi tạm thời (được retry hoặc job thành công): cleanupDelayed(imagePath, 30000)
    // Đối với Lỗi vĩnh viễn (đã đổi tên sang dlqPath): KHÔNG gọi imageService.cleanupDelayed
    if (imagePath && fs.existsSync(imagePath)) {
      imageService.cleanupDelayed(imagePath, 30000);
    }
  }
});

// Xử lý Job cập nhật nhân sự ngầm
registrationQueue.process('update_person_job', 3, async (job) => {
  const { personID, name, aliasID, title, departmentID, imagePath, publicImageUrl, imageFilename } = job.data;
  const lockKey = idempotencyService.generateKey('PERSON_UPDATE', personID);

  // 1. Kiểm tra Idempotency Lock
  const currentStatus = await idempotencyService.getLockStatus(lockKey);
  if (currentStatus === 'COMPLETED') {
    console.log(`[IDEMPOTENCY] Bỏ qua tác vụ cập nhật đã hoàn tất cho PersonID: ${personID}`);
    return { status: 'SKIPPED_ALREADY_COMPLETED', success: true, personID };
  }

  const acquired = await idempotencyService.acquireLock(lockKey, 120);
  if (!acquired) {
    console.warn(`[CONCURRENCY] Job cập nhật cho ${personID} đang được xử lý bởi worker khác.`);
    throw new Error(`[CONCURRENCY] Job cập nhật cho ${personID} đang được xử lý bởi worker khác.`);
  }

  console.log(`[Queue update_person_job] (Attempt ${job.attemptsMade + 1}/${job.opts.attempts}) Bắt đầu xử lý: ${name} (${personID})`);

  let jobSucceeded = false;

  try {
    try {
      // 2. Cập nhật thông tin cơ bản trên HANET Cloud
      const infoResult = await hanetService.updateInfo({
        personID,
        name,
        aliasID,
        title,
        departmentID
      });

      if (infoResult.returnCode !== 1) {
        const errorMsg = getErrorMessage(infoResult.returnCode, infoResult.returnMessage);
        const code = Number(infoResult.returnCode);
        if (PERMANENT_ERROR_CODES.has(code)) {
          console.error(`[Queue update_person_job] ❌ Lỗi vĩnh viễn không thể retry (Mã ${code}): ${errorMsg}`);
          if (imagePath && fs.existsSync(imagePath)) {
            const dlqPath = path.join(
              path.dirname(imagePath),
              'dlq_' + path.basename(imagePath)
            );
            fs.renameSync(imagePath, dlqPath);
            console.log('🛡️ [DLQ Preserved] Đã lưu ảnh lỗi để kiểm tra:', dlqPath);
          }
          job.discard();
          throw new UnrecoverableError(errorMsg, code);
        }
        await idempotencyService.releaseLock(lockKey);
        throw new Error(`[Mã lỗi ${infoResult.returnCode}]: ${errorMsg}`);
      }

      // Gán phòng ban để khóa liên kết phòng ban trên HANET Cloud
      if (departmentID && String(departmentID) !== '0') {
        try {
          await hanetService.addPersonsToDepartment(departmentID, personID);
          console.log(`[Queue update_person_job] ✅ Đã khóa liên kết phòng ban ${departmentID} cho PersonID: ${personID}`);
        } catch (deptErr) {
          console.warn(`[Queue update_person_job] Gán phòng ban thất bại:`, deptErr.message);
        }
      }

      // 3. Nếu có ảnh mới, cập nhật Face ID
      const fallbackBaseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
      const faceUrl = publicImageUrl || (imageFilename ? `${fallbackBaseUrl}/uploads/${imageFilename}` : null);

      if (faceUrl) {
        const faceResult = await hanetService.updateByFaceUrl({
          personID,
          faceUrl
        });

        if (faceResult.returnCode !== 1) {
          const errorMsg = getErrorMessage(faceResult.returnCode, faceResult.returnMessage);
          const code = Number(faceResult.returnCode);
          if (PERMANENT_ERROR_CODES.has(code)) {
            console.error(`[Queue update_person_job] ❌ Lỗi vĩnh viễn không thể retry khi cập nhật ảnh (Mã ${code}): ${errorMsg}`);
            if (imagePath && fs.existsSync(imagePath)) {
              const dlqPath = path.join(
                path.dirname(imagePath),
                'dlq_' + path.basename(imagePath)
              );
              fs.renameSync(imagePath, dlqPath);
              console.log('🛡️ [DLQ Preserved] Đã lưu ảnh lỗi để kiểm tra:', dlqPath);
            }
            job.discard();
            throw new UnrecoverableError(errorMsg, code);
          }
          await idempotencyService.releaseLock(lockKey);
          throw new Error(`[Mã lỗi ${faceResult.returnCode}]: ${errorMsg}`);
        }
      }

      // 4. Đồng bộ cập nhật vào PostgreSQL
      try {
        await pool.query(
          `UPDATE persons
           SET name = COALESCE($1, name),
               title = COALESCE($2, title),
               face_url = COALESCE($3, face_url),
               department_id = COALESCE($4, department_id),
               sync_status = 'SYNCED',
               updated_at = CURRENT_TIMESTAMP
           WHERE alias_id = $5 OR person_id = $6`,
          [
            name || null,
            title || null,
            faceUrl || null,
            departmentID || null,
            aliasID || null,
            String(personID)
          ]
        );
      } catch (dbErr) {
        console.warn(`[Queue update_person_job] Cập nhật DB thất bại:`, dbErr.message);
      }

      // Đánh dấu hoàn tất trong Redis 24h
      await idempotencyService.markCompleted(lockKey, 86400);
      jobSucceeded = true;

      return { success: true, personID };
    } catch (err) {
      if (err instanceof UnrecoverableError || err.name === 'UnrecoverableError') {
        throw err;
      }
      await idempotencyService.releaseLock(lockKey);
      throw err;
    }
  } finally {
    // [RULE-022] Đối với Lỗi tạm thời (được retry hoặc job thành công): cleanupDelayed(imagePath, 30000)
    // Đối với Lỗi vĩnh viễn (đã đổi tên sang dlqPath): KHÔNG gọi imageService.cleanupDelayed
    if (imagePath && fs.existsSync(imagePath)) {
      imageService.cleanupDelayed(imagePath, 30000);
    }
  }
});

/**
 * Lấy danh sách các jobs trong Dead Letter Queue (DLQ)
 * @param {number} start - Vị trí bắt đầu
 * @param {number} end - Vị trí kết thúc
 * @returns {Promise<Array<Object>>}
 */
async function getDLQJobs(start = 0, end = 50) {
  try {
    const jobs = await deadLetterQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed'], start, end, true);
    return jobs.map(j => ({
      id: j.id,
      name: j.name,
      data: j.data,
      timestamp: j.timestamp,
      processedOn: j.processedOn,
      finishedOn: j.finishedOn,
      failedReason: j.failedReason || j.data?.failedReason
    }));
  } catch (err) {
    console.error('[DLQ Service] Lỗi khi lấy danh sách DLQ jobs:', err.message);
    return [];
  }
}

/**
 * Đẩy lại (Retry) thủ công một job từ Dead Letter Queue vào Queue chính
 * @param {string|number} dlqJobId - ID của job trong DLQ
 * @returns {Promise<{ success: boolean, message: string, newJobId?: string|number }>}
 */
async function retryDLQJob(dlqJobId) {
  try {
    const dlqJob = await deadLetterQueue.getJob(dlqJobId);
    if (!dlqJob) {
      return { success: false, message: `Không tìm thấy job DLQ với ID: ${dlqJobId}` };
    }

    const originalData = dlqJob.data?.jobData || dlqJob.data;
    const jobName = dlqJob.data?.jobName || 'register_person_job';

    // Giải phóng lock Idempotency cũ nếu có để cho phép xử lý lại
    if (originalData.aliasID) {
      const lockKey = idempotencyService.generateKey('FACE_REGISTER', originalData.aliasID);
      await idempotencyService.releaseLock(lockKey);
    }
    if (originalData.personID) {
      const lockKey = idempotencyService.generateKey('PERSON_UPDATE', originalData.personID);
      await idempotencyService.releaseLock(lockKey);
    }

    // Đẩy lại vào hàng đợi chính
    const newJob = await registrationQueue.add(jobName, originalData);

    // Xóa khỏi DLQ sau khi đã tái nạp thành công
    await dlqJob.remove();

    console.log(`[DLQ Retry] Đã tái nạp thành công job DLQ ${dlqJobId} thành Job mới ${newJob.id}`);
    return {
      success: true,
      message: `Đã tái nạp thành công vào hàng đợi chính với Job ID: ${newJob.id}`,
      newJobId: newJob.id
    };
  } catch (err) {
    console.error(`[DLQ Retry Error] Không thể retry job DLQ ${dlqJobId}:`, err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Xóa toàn bộ jobs trong DLQ
 */
async function clearDLQ() {
  try {
    await deadLetterQueue.empty();
    return { success: true, message: 'Đã dọn sạch Dead Letter Queue' };
  } catch (err) {
    console.error('[DLQ Service] Lỗi dọn DLQ:', err.message);
    return { success: false, message: err.message };
  }
}

module.exports = {
  resolveDepartmentAndAlias,
  enqueueRegisterPerson: (payload) => registrationQueue.add('register_person_job', payload),
  enqueueUpdatePerson: (payload) => registrationQueue.add('update_person_job', payload),
  getDLQJobs,
  retryDLQJob,
  clearDLQ,
  registrationQueue,
  hanetQueue,
  deadLetterQueue,
  UnrecoverableError,
  PERMANENT_ERROR_CODES,
  NON_RETRIABLE_CODES
};

```

### File: `src/services/imageService.js`
```js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

/**
 * Kiểm tra buffer có phải định dạng HEIC/HEIF không qua Magic Bytes
 * @param {Buffer} buffer
 * @returns {boolean}
 */
function isHeic(buffer) {
  if (!buffer || buffer.length < 12) return false;

  const brand = buffer.toString('ascii', 4, 12);

  return brand.includes('ftyp') && (
    brand.includes('heic') ||
    brand.includes('heix') ||
    brand.includes('hevc') ||
    brand.includes('mif1') ||
    brand.includes('msf1')
  );
}

/**
 * Giải mã ảnh HEIC/HEIF sang Sharp Instance
 * @param {Buffer} buffer
 * @returns {Promise<sharp.Sharp>}
 */
async function loadSharpInstance(buffer) {
  if (isHeic(buffer)) {
    try {
      const decode = require('heic-decode');
      const { data, width, height } = await decode({ buffer });

      return sharp(Buffer.from(data), {
        raw: {
          width,
          height,
          channels: 4
        }
      });
    } catch (err) {
      console.warn(
        '⚠️ [ImageService] heic-decode fallback error:',
        err.message
      );
    }
  }

  return sharp(buffer);
}

/**
 * Chuẩn hóa ảnh thành 1280 x 738.
 * Không dùng fit: cover vì có thể cắt mất phần đầu/cằm của người chụp.
 * @param {string|Buffer} input
 * @param {string} outputPath
 * @returns {Promise<string>}
 */
async function normalizeImage(input, outputPath) {
  let buffer;
  const isFileInput = typeof input === 'string';

  if (isFileInput) {
    buffer = fs.readFileSync(input);
  } else {
    buffer = input;
  }

  const image = await loadSharpInstance(buffer);

  await image
    .rotate()
    .resize(1280, 738, {
      fit: 'contain',
      background: {
        r: 0,
        g: 0,
        b: 0,
        alpha: 1
      }
    })
    .jpeg({
      quality: 90,
      mozjpeg: true
    })
    .toFile(outputPath);

  if (
    isFileInput &&
    input !== outputPath &&
    fs.existsSync(input)
  ) {
    try {
      fs.unlinkSync(input);
    } catch (e) {}
  }

  return outputPath;
}

/**
 * Xóa an toàn tệp tin nếu tồn tại
 * @param {string} filePath
 */
function deleteFileSafe(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {}
  }
}

class ImageService {
  constructor() {
    this.normalizeImage = normalizeImage;
    this.deleteFileSafe = deleteFileSafe;
  }

  async processFaceImage(input) {
    const filename = `processed_${Date.now()}_${Math.round(Math.random() * 1000)}.jpg`;
    const outputPath = path.join(process.cwd(), 'uploads', filename);
    const uploadsDir = path.join(process.cwd(), 'uploads');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    if (input.filePath) {
      await normalizeImage(input.filePath, outputPath);
    } else if (input.base64String) {
      const base64Data = input.base64String.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      await normalizeImage(buffer, outputPath);
    } else {
      throw new Error('Dữ liệu ảnh đầu vào không hợp lệ');
    }

    return {
      processedPath: outputPath,
      filename
    };
  }

  cleanup(filePath) {
    deleteFileSafe(filePath);
  }

  cleanupDelayed(filePath, delayMs = 30000) {
    if (!filePath) return;

    const timer = setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`🧹 [ImageService] Đã dọn dẹp file sau ${delayMs / 1000}s: ${path.basename(filePath)}`);
        }
      } catch (err) {
        console.warn('⚠️ [ImageService Cleanup Warning] Lỗi xóa file:', filePath, err.message);
      }
    }, delayMs);

    if (timer && typeof timer.unref === 'function') {
      timer.unref();
    }
  }

  cleanOldFiles(maxAgeMs = 60 * 60 * 1000) {
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) return;

      const files = fs.readdirSync(uploadsDir);
      const now = Date.now();

      files.forEach((file) => {
        if (file.startsWith('processed_') || file.startsWith('face_')) {
          const filePath = path.join(uploadsDir, file);
          try {
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > maxAgeMs) {
              fs.unlinkSync(filePath);
              console.log(`🧹 [ImageService GC] Xóa file rác cũ: ${file}`);
            }
          } catch (fileErr) {}
        }
      });
    } catch (err) {
      console.warn('⚠️ [ImageService GC Error]:', err.message);
    }
  }
}

const instance = new ImageService();
instance.normalizeImage = normalizeImage;
instance.deleteFileSafe = deleteFileSafe;

module.exports = instance;
module.exports.normalizeImage = normalizeImage;
module.exports.deleteFileSafe = deleteFileSafe;

```

### File: `src/services/dbClassService.js`
```js
const crypto = require('crypto');
const { pool } = require('../config/database');

/**
 * Service quản lý Lớp Học và Nhân Sự trực tiếp trên PostgreSQL 16
 */

/**
 * Lấy danh sách thành viên của một lớp từ database
 * @param {string} className Tên lớp cần truy vấn
 * @returns {Promise<Array<Object>>}
 */
async function getClassMembers(className) {
  if (!className) return [];
  const cleanName = className.trim();
  const normalizedClass = cleanName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

  const query = `
    SELECT id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, created_at, updated_at 
    FROM persons 
    WHERE LOWER(class_name) = LOWER($1) 
       OR UPPER(REPLACE(class_name, '_', '')) = $2
    ORDER BY id ASC
  `;
  const res = await pool.query(query, [cleanName, normalizedClass]);

  return res.rows.map(row => ({
    ...row,
    // Alias tương thích các view và frontend bindings
    'Tên': row.name,
    'Chức Vụ': row.title,
    'Lớp': row.class_name,
    'Phòng Ban': row.department_id === '990730' ? 'Legiô Mariae' : (row.department_id === '990731' ? 'Giới Trẻ' : 'Thiếu Nhi'),
    'links': row.face_url || '',
    'PersonID': row.person_id || '',
    'AliasID': row.alias_id || '',
    avatar: row.face_url || '',
    alias: row.alias_id || '',
    class: row.class_name,
    department: row.department_id
  }));
}

/**
 * Thêm một thành viên mới vào lớp và database PostgreSQL
 * @param {Object} memberData { name, className, departmentId, title, aliasId }
 * @returns {Promise<Object>}
 */
async function addMember({ name, className, departmentId, title, aliasId }) {
  if (!name || !name.trim()) {
    throw new Error('Tên thành viên không được để trống');
  }

  // 1. Phân loại và chuẩn hóa departmentId
  let resolvedDeptId = '990653';
  if (departmentId && (departmentId === '990653' || departmentId === '990730' || departmentId === '990731')) {
    resolvedDeptId = departmentId;
  } else if (departmentId && typeof departmentId === 'string') {
    const normDept = departmentId.toLowerCase();
    if (normDept.includes('maria') || normDept.includes('legio') || normDept.includes('lm')) resolvedDeptId = '990730';
    else if (normDept.includes('trẻ') || normDept.includes('gt')) resolvedDeptId = '990731';
  } else if (className) {
    const normClass = className.toLowerCase();
    if (normClass.includes('dmhccc') || normClass.includes('legio') || normClass.includes('mariae')) resolvedDeptId = '990730';
    else if (normClass.includes('gioitre') || normClass.includes('giới trẻ') || normClass.startsWith('gt')) resolvedDeptId = '990731';
  }

  // 2. Đảm bảo lớp học tồn tại trong bảng classes (FK constraint)
  if (className) {
    await pool.query(
      `INSERT INTO classes (name, department_id) 
       VALUES ($1, $2) 
       ON CONFLICT (name) DO NOTHING`,
      [className, resolvedDeptId]
    );
  }

  // 3. Tự động sinh AliasID chuẩn 3 phần nếu chưa có
  let finalAliasId = aliasId;
  if (!finalAliasId || !finalAliasId.trim()) {
    let deptPrefix = 'TN';
    if (resolvedDeptId === '990730') deptPrefix = 'LM';
    else if (resolvedDeptId === '990731') deptPrefix = 'GT';

    const cleanClass = (className || 'CHUNG')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 ký tự A-Z0-9
    finalAliasId = `${deptPrefix}_${cleanClass}_${randomSuffix}`;
  }

  const insertQuery = `
    INSERT INTO persons (name, class_name, department_id, title, alias_id, sync_status) 
    VALUES ($1, $2, $3, $4, $5, 'PENDING') 
    RETURNING id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, created_at, updated_at
  `;

  const res = await pool.query(insertQuery, [
    name.trim(),
    className || null,
    resolvedDeptId,
    title || 'Học Sinh',
    finalAliasId.trim()
  ]);

  const row = res.rows[0];
  return {
    ...row,
    'Tên': row.name,
    'Chức Vụ': row.title,
    'Lớp': row.class_name,
    'Phòng Ban': row.department_id,
    'AliasID': row.alias_id,
    'PersonID': row.person_id || '',
    'links': row.face_url || ''
  };
}

/**
 * Cập nhật thông tin thành viên theo alias_id
 * @param {string} aliasId AliasID định danh
 * @param {Object} updateData { name, title, className, departmentId }
 * @returns {Promise<Object>}
 */
async function updateMember(aliasId, { name, title, className, departmentId }) {
  if (!aliasId || !aliasId.trim()) {
    throw new Error('AliasID không hợp lệ');
  }

  let resolvedDeptId = departmentId;
  if (departmentId && isNaN(departmentId) && typeof departmentId === 'string') {
    const norm = departmentId.toLowerCase();
    if (norm.includes('maria') || norm.includes('legio')) resolvedDeptId = '990730';
    else if (norm.includes('trẻ') || norm.includes('gt')) resolvedDeptId = '990731';
    else resolvedDeptId = '990653';
  }

  // Đảm bảo lớp học tồn tại nếu có đổi tên lớp
  if (className) {
    await pool.query(
      `INSERT INTO classes (name, department_id) 
       VALUES ($1, $2) 
       ON CONFLICT (name) DO NOTHING`,
      [className, resolvedDeptId || '990653']
    );
  }

  const query = `
    UPDATE persons 
    SET name = COALESCE($1, name),
        title = COALESCE($2, title),
        class_name = COALESCE($3, class_name),
        department_id = COALESCE($4, department_id),
        updated_at = CURRENT_TIMESTAMP 
    WHERE alias_id = $5 
    RETURNING id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, updated_at
  `;

  const res = await pool.query(query, [
    name ? name.trim() : null,
    title ? title.trim() : null,
    className ? className.trim() : null,
    resolvedDeptId || null,
    aliasId.trim()
  ]);

  if (res.rows.length === 0) {
    throw new Error(`Không tìm thấy thành viên với AliasID: ${aliasId}`);
  }

  return res.rows[0];
}

/**
 * Xóa một thành viên khỏi database theo alias_id
 * @param {string} aliasId AliasID định danh
 * @returns {Promise<Object>}
 */
async function deleteMember(aliasId) {
  if (!aliasId || !aliasId.trim()) {
    throw new Error('AliasID không hợp lệ để xóa');
  }

  const query = 'DELETE FROM persons WHERE alias_id = $1 RETURNING *';
  const res = await pool.query(query, [aliasId.trim()]);

  if (res.rows.length === 0) {
    throw new Error(`Không tìm thấy thành viên với AliasID: ${aliasId}`);
  }

  return res.rows[0];
}

/**
 * Đổi tên Lớp học và toàn bộ học viên thuộc lớp đó (sử dụng Transaction ACID)
 * @param {string} oldName Tên lớp hiện tại
 * @param {string} newName Tên lớp mới
 * @returns {Promise<{ success: boolean, updatedCount: number }>}
 */
async function renameClass(oldName, newName) {
  if (!oldName || !newName || !oldName.trim() || !newName.trim()) {
    throw new Error('Tên lớp cũ và tên lớp mới không được để trống');
  }

  const cleanOld = oldName.trim();
  const cleanNew = newName.trim();

  if (cleanOld === cleanNew) {
    return { success: true, updatedCount: 0 };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lấy thông tin phòng ban của lớp cũ
    const classRes = await client.query('SELECT department_id FROM classes WHERE name = $1 LIMIT 1', [cleanOld]);
    const deptId = classRes.rows.length > 0 ? classRes.rows[0].department_id : '990653';

    // 2. Tạo lớp mới hoặc cập nhật phòng ban lớp mới trong bảng classes
    await client.query(
      `INSERT INTO classes (name, department_id) 
       VALUES ($1, $2) 
       ON CONFLICT (name) DO UPDATE SET department_id = EXCLUDED.department_id`,
      [cleanNew, deptId]
    );

    // 3. Cập nhật tất cả nhân sự thuộc lớp cũ sang lớp mới
    const updatePersonsRes = await client.query(
      'UPDATE persons SET class_name = $1, updated_at = CURRENT_TIMESTAMP WHERE class_name = $2 RETURNING id',
      [cleanNew, cleanOld]
    );

    // 4. Xóa lớp cũ khỏi bảng classes
    await client.query('DELETE FROM classes WHERE name = $1', [cleanOld]);

    await client.query('COMMIT');
    console.log(`🔄 [PostgreSQL dbClassService] Đã đổi tên lớp từ "${cleanOld}" sang "${cleanNew}" (${updatePersonsRes.rowCount} thành viên)`);
    return { success: true, updatedCount: updatePersonsRes.rowCount };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [PostgreSQL dbClassService Error] Lỗi đổi tên lớp:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getClassMembers,
  addMember,
  updateMember,
  deleteMember,
  renameClass
};

```

### File: `src/services/hanetService.js`
```js
const axios = require('axios');
const qs = require('qs');
const FormData = require('form-data');
const fs = require('fs');

// Cấu hình axios instance với timeout 25s và Accept header chuẩn
const hanetAxios = axios.create({
  baseURL: process.env.HANET_API_BASE || 'https://partner.hanet.ai',
  timeout: 25000, // 25s (25.000ms) theo yêu cầu 10 - 30s của HANET
  headers: {
    'Accept': 'application/json'
  }
});

class HanetService {
  constructor() {
    this.apiBase = process.env.HANET_API_BASE || 'https://partner.hanet.ai';
    this.oauthBase = process.env.HANET_OAUTH_BASE || 'https://oauth.hanet.com';
    this.clientId = process.env.HANET_CLIENT_ID;
    this.clientSecret = process.env.HANET_CLIENT_SECRET;

    // Ưu tiên sử dụng Token tĩnh từ biến môi trường (nếu có)
    this.envAccessToken = process.env.HANET_ACCESS_TOKEN || null;
    this.accessToken = this.envAccessToken;
    this.tokenExpiry = null;
  }

  // Getter động - luôn đọc giá trị mới nhất từ process.env tại thời điểm gọi
  get placeId() {
    const pId = process.env.HANET_PLACE_ID;
    if (!pId) {
      console.warn('[HanetService] CẢNH BÁO: HANET_PLACE_ID chưa được định nghĩa trong .env!');
    }
    return pId;
  }

  // Tự động quản lý, ưu tiên token cấu hình và xoay vòng OAuth2 Token
  async getAccessToken(forceRefresh = false) {
    if (!forceRefresh && this.accessToken) {
      // Nếu có tokenExpiry và chưa hết hạn, hoặc dùng token tĩnh chưa bị đánh dấu hết hạn
      if (!this.tokenExpiry || new Date() < this.tokenExpiry) {
        return this.accessToken;
      }
    }

    // Nếu cần làm mới token hoặc token hết hạn, gọi OAuth2 nếu có Client ID & Client Secret
    if (this.clientId && this.clientSecret) {
      try {
        const res = await axios.post(
          `${this.oauthBase}/token`,
          qs.stringify({
            grant_type: 'client_credentials',
            client_id: this.clientId,
            client_secret: this.clientSecret
          }),
          {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
            timeout: 25000
          }
        );

        this.accessToken = res.data.access_token;
        this.tokenExpiry = new Date(Date.now() + ((res.data.expires_in || 3600) - 300) * 1000);
        return this.accessToken;
      } catch (err) {
        throw new Error(`[HANET OAuth Error] Không thể lấy Access Token: ${err.response?.data?.error_description || err.message}`);
      }
    }

    // Nếu không có Client credentials nhưng có envAccessToken
    if (this.accessToken) {
      return this.accessToken;
    }

    throw new Error('[HANET Config Error] Vui lòng cấu hình HANET_ACCESS_TOKEN hoặc cặp HANET_CLIENT_ID / HANET_CLIENT_SECRET trong .env');
  }

  // Helper gửi request tự động retry xoay vòng token khi gặp mã lỗi -103 (ACCESS_TOKEN_EXPIRE)
  async postWithToken(endpoint, data = {}, isRetry = false) {
    const token = await this.getAccessToken(isRetry);
    const payload = { ...data, token };

    const res = await hanetAxios.post(endpoint, qs.stringify(payload), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      timeout: 25000
    });

    // Kiểm tra nếu mã lỗi là -103 (Token hết hạn) và chưa retry
    if (res.data && res.data.returnCode === -103 && !isRetry) {
      console.warn('[HANET Service] Access token đã hết hạn (Mã -103). Đang tự động xoay vòng lấy token mới qua OAuth2...');
      return this.postWithToken(endpoint, data, true);
    }

    return res.data;
  }

  /* =========================================================================
   * PERSON APIs
   * ========================================================================= */

  // Đăng ký nhân sự kèm tệp ảnh nhị phân trực tiếp (Multipart Form-Data)
  async registerPerson(data, isRetry = false) {
    const token = await this.getAccessToken(isRetry);
    const formData = new FormData();

    const cleanAliasID = String(data.aliasID || '').trim().replace(/\s+/g, '_');
    const cleanName = String(data.name || '').trim();
    const cleanTitle = String(data.title || 'Nhân viên').trim();
    const cleanDepartmentID = String(data.departmentID || '').trim();

    // Đưa token vào form-data body thay vì HTTP Header
    formData.append('token', token);
    formData.append('placeID', this.placeId);
    formData.append('name', cleanName);
    formData.append('aliasID', cleanAliasID);
    formData.append('title', cleanTitle);
    formData.append('departmentID', cleanDepartmentID);

    // Đọc file ảnh từ local path và đính kèm binary stream (field name: 'file')
    if (data.imagePath && fs.existsSync(data.imagePath)) {
      formData.append('file', fs.createReadStream(data.imagePath));
    } else {
      throw new Error('[HanetService] Không tìm thấy file ảnh tại đường dẫn để upload.');
    }

    try {
      // Gửi request với axios instance, form-data headers, maxBodyLength/maxContentLength: Infinity và timeout 25s
      const response = await hanetAxios.post('/person/register', formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 25000
      });

      // Kiểm tra token hết hạn (Mã -103) và xoay vòng
      if (response.data && response.data.returnCode === -103 && !isRetry) {
        console.warn('[HANET Service] Access token đã hết hạn (Mã -103). Đang tự động xoay vòng lấy token mới qua OAuth2...');
        return this.registerPerson(data, true);
      }

      return response.data;
    } catch (err) {
      console.error('[HanetService Error Detail]:', {
        status: err.response?.status,
        data: err.response?.data,
        message: err.message
      });
      throw err;
    }
  }

  // Cập nhật thông tin nhân sự (Name, AliasID, Title, DepartmentID)
  async updateInfo(data) {
    const cleanPersonID = String(data.personID || data.id || '').trim();
    const cleanName = String(data.name || '').trim();
    const cleanAliasID = String(data.aliasID || '').trim().replace(/\s+/g, '_');
    const cleanTitle = String(data.title || 'Nhân viên').trim();
    const cleanDeptID = String(data.departmentID || '').trim();
    const departmentID = (!cleanDeptID || cleanDeptID === '0' || cleanDeptID === 'undefined' || cleanDeptID === 'null')
      ? '990653'
      : cleanDeptID;

    const payload = {
      placeID: String(data.placeID || this.placeId).trim(),
      name: cleanName,
      title: cleanTitle,
      departmentID: departmentID
    };

    if (cleanPersonID) {
      payload.personID = cleanPersonID;
    }
    if (cleanAliasID) {
      payload.aliasID = cleanAliasID;
    }

    return this.postWithToken('/person/updateInfo', payload);
  }

  // Alias hỗ trợ tương thích với /person/update hoặc updatePerson
  async updatePerson(data) {
    return this.updateInfo(data);
  }

  // Helper cập nhật thông tin nhân sự theo tham số rời
  async updatePersonInfo(personID, name, title, aliasID, departmentID) {
    return this.updateInfo({ personID, name, title, aliasID, departmentID });
  }

  // Cập nhật Face ID cho nhân sự qua faceUrl
  async updateByFaceUrl(data) {
    const cleanPersonID = String(data.personID || data.id || '').trim();
    const cleanFaceUrl = String(data.publicImageUrl || data.faceUrl || data.fileUrl || data.avatar || '').trim();
    const cleanAliasID = String(data.aliasID || '').trim().replace(/\s+/g, '_');

    const payload = {
      placeID: String(data.placeID || this.placeId).trim(),
      faceUrl: cleanFaceUrl,
      fileUrl: cleanFaceUrl
    };

    if (cleanPersonID) {
      payload.personID = cleanPersonID;
    }
    if (cleanAliasID) {
      payload.aliasID = cleanAliasID;
    }

    return this.postWithToken('/person/updateByFaceUrl', payload);
  }

  // Helper cập nhật Face ID theo (personID, faceUrl)
  async updatePersonByFaceUrl(personID, faceUrl) {
    if (typeof personID === 'object' && personID !== null) {
      return this.updateByFaceUrl(personID);
    }
    return this.updateByFaceUrl({ personID, faceUrl });
  }

  // Đăng ký nhân sự qua URL ảnh (FaceUrl)
  async registerPersonByUrl(data) {
    const payload = {
      placeID: this.placeId,
      name: String(data.name || '').trim(),
      aliasID: String(data.aliasID || '').trim().replace(/\s+/g, '_'),
      title: String(data.title || 'Nhân viên').trim(),
      faceUrl: data.faceUrl || data.publicImageUrl
    };
    if (data.departmentID) payload.departmentID = String(data.departmentID).trim();
    return this.postWithToken('/person/registerByUrl', payload);
  }

  /**
   * Lấy danh sách nhân sự từ Cloud HANET (Hỗ trợ phân trang tự động gom trọn vẹn 100% dữ liệu)
   * @param {Object|boolean} options - Cấu hình { page, size, fetchAll } hoặc boolean fetchAll
   * @returns {Promise<{ returnCode: number, returnMessage: string, data: Array, total: number }>}
   */
  async getListByPlace(options = { fetchAll: true, size: 50 }) {
    const isFetchAll = typeof options === 'boolean' ? options : (options?.fetchAll !== false);
    const requestedPage = typeof options === 'object' && options?.page ? Number(options.page) : 1;
    const pageSize = typeof options === 'object' && options?.size ? Number(options.size) : 50;

    // Nếu chỉ lấy 1 trang cụ thể (fetchAll = false)
    if (!isFetchAll) {
      return this.postWithToken('/person/getListByPlace', {
        placeID: this.placeId,
        page: requestedPage,
        size: pageSize
      });
    }

    // Tự động quét phân trang lấy toàn bộ nhân sự (fetchAll = true)
    const personMap = new Map();
    let currentPage = 1;
    let keepPaging = true;
    const maxPages = 50; // Giới hạn an toàn tối đa 50 trang

    while (keepPaging && currentPage <= maxPages) {
      try {
        const res = await this.postWithToken('/person/getListByPlace', {
          placeID: this.placeId,
          page: currentPage,
          size: pageSize
        });

        // Trích xuất mảng dữ liệu nhân sự linh hoạt
        let items = [];
        if (res && Array.isArray(res.data)) {
          items = res.data;
        } else if (res && res.data && Array.isArray(res.data.data)) {
          items = res.data.data;
        } else if (res && res.data && Array.isArray(res.data.hits)) {
          items = res.data.hits;
        } else if (Array.isArray(res)) {
          items = res;
        }

        if (Array.isArray(items) && items.length > 0) {
          items.forEach(p => {
            const id = String(p.id || p.personID || '').trim();
            if (id) {
              personMap.set(id, p);
            } else {
              personMap.set(`temp_${Math.random()}`, p);
            }
          });

          if (items.length < pageSize) {
            keepPaging = false;
          } else {
            currentPage++;
            // Khoảng nghỉ nhỏ 150ms để không vượt quá Rate Limit của HANET Cloud
            await new Promise(resolve => setTimeout(resolve, 150));
          }
        } else {
          keepPaging = false;
        }
      } catch (err) {
        console.error(`[HanetService] Lỗi quét danh sách nhân sự tại trang ${currentPage}:`, err.message);
        keepPaging = false;
      }
    }

    const allPersons = Array.from(personMap.values());
    return {
      returnCode: 1,
      returnMessage: 'Success',
      data: allPersons,
      total: allPersons.length
    };
  }

  // Helper chuyên dụng lấy toàn bộ nhân sự
  async getAllPersonsByPlace(size = 50) {
    return this.getListByPlace({ fetchAll: true, size });
  }

  // Tra cứu chi tiết nhân sự qua mã Alias ID (MSNV)
  async getPersonByAliasID(aliasID, placeID = this.placeId) {
    return this.postWithToken('/person/getUserInfoByAliasID', {
      placeID: placeID || this.placeId,
      aliasID: String(aliasID || '').trim()
    });
  }

  // Lấy dữ liệu Check-in theo timestamp (Ràng buộc: cùng 1 tháng dương lịch)
  async getCheckinByTimestamp(fromTimestamp, toTimestamp) {
    return this.postWithToken('/person/getCheckinByPlaceIdInTimestamp', {
      placeID: this.placeId,
      from: fromTimestamp,
      to: toTimestamp,
      size: 500
    });
  }

  // Xóa nhân sự trên Cloud
  async removePerson(personID) {
    return this.postWithToken('/person/removePersonByID', {
      placeID: this.placeId,
      personID
    });
  }

  /* =========================================================================
   * DEPARTMENT APIs
   * ========================================================================= */

  // Lấy danh sách phòng ban
  async getDepartmentList(page = 1, size = 100, keyword = '') {
    const payload = {
      placeID: this.placeId,
      page,
      size
    };
    if (keyword) payload.keyword = keyword;
    return this.postWithToken('/department/list', payload);
  }

  // Tạo mới phòng ban
  async createDepartment(name, desc = '') {
    return this.postWithToken('/department/create', {
      placeID: this.placeId,
      name,
      desc
    });
  }

  // Cập nhật phòng ban
  async updateDepartment(departmentID, name, desc = '') {
    return this.postWithToken('/department/update', {
      placeID: this.placeId,
      id: departmentID,
      name,
      desc
    });
  }

  // Xóa phòng ban
  async removeDepartment(departmentID) {
    return this.postWithToken('/department/remove', {
      placeID: this.placeId,
      id: departmentID
    });
  }

  // Lấy danh sách nhân sự thuộc phòng ban
  async getPersonsByDepartment(departmentID, page = 1, size = 50) {
    return this.postWithToken('/department/list-person', {
      placeID: this.placeId,
      departmentID,
      page,
      size
    });
  }

  // Thêm nhân sự vào phòng ban
  async addPersonsToDepartment(departmentID, personIDs) {
    const formattedPersonIDs = Array.isArray(personIDs) ? personIDs.join(',') : String(personIDs);
    return this.postWithToken('/department/add-person', {
      placeID: this.placeId,
      departmentID,
      personIDs: formattedPersonIDs
    });
  }

  // Xóa nhân sự khỏi phòng ban
  async removePersonsFromDepartment(departmentID, personIDs) {
    const formattedPersonIDs = Array.isArray(personIDs) ? personIDs.join(',') : String(personIDs);
    return this.postWithToken('/department/remove-person', {
      placeID: this.placeId,
      departmentID,
      personID: formattedPersonIDs
    });
  }
}

module.exports = new HanetService();

```

### File: `src/services/csvService.js`
```js
/**
 * @deprecated
 * [DEPRECATED - POSTGRES-FIRST ARCHITECTURE]
 * Module này đã ngưng sử dụng trong toàn bộ luồng vận hành chính.
 * Toàn bộ dữ liệu phòng ban, lớp học và nhân sự đã được chuyển đổi 100% sang PostgreSQL 16 (dbClassService / database pool).
 * File này chỉ được giữ lại cho mục đích backup / migration lịch sử.
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeName(name) {
  if (!name) return '';
  return name.toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Lấy đường dẫn file CSV an toàn trong thư mục data (hỗ trợ case-insensitive fallback)
 * @param {string} fileName Tên file danh mục (vd: ThemSuc_1a, GLV, THEMSUC1A)
 * @returns {string}
 */
function getFilePath(fileName) {
  if (!fileName) return path.join(DATA_DIR, 'unknown.csv');
  const safeName = path.basename(fileName).replace(/\.csv$/i, '').trim();
  const directPath = path.join(DATA_DIR, `${safeName}.csv`);
  if (fs.existsSync(directPath)) return directPath;

  // Case-insensitive & normalized fallback
  if (fs.existsSync(DATA_DIR)) {
    const files = fs.readdirSync(DATA_DIR);
    const target = safeName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const f of files) {
      if (f.toLowerCase().endsWith('.csv') && !f.includes('.bak')) {
        const cleanF = f.replace(/\.csv$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanF === target || f.toLowerCase() === `${safeName.toLowerCase()}.csv`) {
          return path.join(DATA_DIR, f);
        }
      }
    }
  }
  return directPath;
}

/**
 * Đọc file CSV và trả về danh sách thành viên với các trường đồng bộ
 * @param {string} fileName Tên lớp / tên file
 * @returns {Promise<Array<Object>>}
 */
function readList(fileName) {
  const filePath = getFilePath(fileName);
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return resolve([]);
    }
    const results = [];
    fs.createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (raw) => {
        const name = (raw['Tên'] || raw['ho_ten'] || raw['name'] || '').trim();
        const lop = (raw['Lớp'] || raw['lop'] || raw['class'] || fileName).trim();
        const phongBan = (raw['Phòng Ban'] || raw['phong_ban'] || raw['department'] || 'Thiếu Nhi').trim();
        const chucVu = (raw['Chức Vụ'] || raw['chuc_vu'] || raw['title'] || 'Học Sinh').trim();
        const links = (raw['links'] || raw['anh_url'] || raw['avatar'] || '').trim();
        const personId = (raw['PersonID'] || raw['hanet_person_id'] || raw['person_id'] || '').trim();
        const aliasId = (raw['AliasID'] || raw['alias_id'] || raw['alias'] || '').trim();

        if (name) {
          results.push({
            'Tên': name,
            'Lớp': lop,
            'Phòng Ban': phongBan,
            'Chức Vụ': chucVu,
            'links': links,
            'PersonID': personId,
            'AliasID': aliasId,
            // Hỗ trợ alias tương thích đa controller
            ho_ten: name,
            lop: lop,
            phong_ban: phongBan,
            chuc_vu: chucVu,
            anh_url: links,
            hanet_person_id: personId,
            name: name,
            class: lop,
            department: phongBan,
            title: chucVu,
            avatar: links,
            alias: aliasId
          });
        }
      })
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

/**
 * Ghi thêm thành viên mới vào file CSV (RULE-001 & RULE-002)
 * @param {string} fileName Tên lớp / tên file
 * @param {Object} person Dữ liệu thành viên mới
 */
async function appendPerson(fileName, person) {
  const filePath = getFilePath(fileName);
  const fileExists = fs.existsSync(filePath);

  const name = (person['Tên'] || person.name || person.ho_ten || '').trim();
  const lop = (person['Lớp'] || person.class || person.lop || fileName).trim();
  const phongBan = (person['Phòng Ban'] || person.department || person.phong_ban || 'Thiếu Nhi').trim();
  const chucVu = (person['Chức Vụ'] || person.title || person.chuc_vu || 'Học Sinh').trim();
  const links = (person['links'] || person.avatar || person.anh_url || '').trim();
  const personId = (person['PersonID'] || person.person_id || person.hanet_person_id || '').trim();
  const aliasId = (person['AliasID'] || person.alias || person.alias_id || '').trim();

  if (!fileExists) {
    const header = 'Tên,Lớp,Phòng Ban,Chức Vụ,links,PersonID,AliasID\n';
    const row = `"${name}","${lop}","${phongBan}","${chucVu}","${links}","${personId}","${aliasId}"\n`;
    fs.writeFileSync(filePath, header + row, 'utf-8');
  } else {
    // Đọc header hiện có để quyết định ghi có cột AliasID hay không
    const content = fs.readFileSync(filePath, 'utf-8');
    const firstLine = content.split(/\r?\n/)[0] || '';
    const hasAliasColumn = firstLine.toLowerCase().includes('alias');

    let row = '';
    if (hasAliasColumn) {
      row = `"${name}","${lop}","${phongBan}","${chucVu}","${links}","${personId}","${aliasId}"\n`;
    } else {
      row = `"${name}","${lop}","${phongBan}","${chucVu}","${links}","${personId}"\n`;
    }

    fs.appendFileSync(filePath, row, 'utf-8');
  }
}

/**
 * Cập nhật thông tin thành viên trong file CSV theo AliasID hoặc Tên
 * @param {string} className Tên lớp
 * @param {string} alias AliasID hoặc Tên hiện tại
 * @param {Object} updateData { name, title, department, class }
 */
async function updatePersonInfo(className, alias, updateData) {
  const filePath = getFilePath(className);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file dữ liệu cho lớp ${className}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return true;

  const header = lines[0];
  const targetAlias = (alias || '').trim().toUpperCase();
  const targetNormName = normalizeName(updateData.name || alias);
  let updated = false;

  const newLines = lines.map((line, idx) => {
    if (idx === 0) return line; // Giữ nguyên header
    
    // Phân tích dòng CSV đơn giản hoặc chuẩn CSV
    const regex = /(?:^|,)(?:"([^"]*)"|([^",]*))/g;
    const parts = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      parts.push(match[1] !== undefined ? match[1] : match[2]);
    }

    if (parts.length < 4) return line;

    const rowName = parts[0]?.trim();
    const rowAlias = (parts[6] || '').trim().toUpperCase();
    const isAliasMatch = targetAlias && rowAlias && rowAlias === targetAlias;
    const isNameMatch = targetNormName && normalizeName(rowName) === targetNormName;

    if (isAliasMatch || isNameMatch) {
      parts[0] = updateData.name ? updateData.name.trim() : parts[0];
      parts[1] = updateData.class ? updateData.class.trim() : parts[1];
      parts[2] = updateData.department ? updateData.department.trim() : parts[2];
      parts[3] = updateData.title ? updateData.title.trim() : parts[3];
      updated = true;
      return parts.map(p => (p && (p.includes(',') || p.includes('"')) ? `"${p.replace(/"/g, '""')}"` : (p || ''))).join(',');
    }

    return line;
  });

  if (updated) {
    fs.writeFileSync(filePath, newLines.join('\n') + '\n', 'utf-8');
    console.log(`✅ [CSV Service] Đã cập nhật thành viên trong ${path.basename(filePath)}`);
  }

  return updated;
}

/**
 * Xóa một thành viên khỏi file CSV của lớp (hoặc reset FaceID nếu xóa toàn cục)
 * @param {string} identifier AliasID, PersonID hoặc Tên thành viên
 * @param {string} [className] Tên lớp (nếu xóa từ giao diện quản lý lớp)
 */
async function removePersonFromCsv(identifier, className = '') {
  if (!identifier) return [];

  const targetId = String(identifier).trim();
  const targetNorm = normalizeName(identifier);

  // Nếu có truyền className cụ thể -> Xóa hoàn toàn dòng thành viên khỏi CSV lớp
  if (className) {
    const filePath = getFilePath(className);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      const newLines = lines.filter((line, idx) => {
        if (idx === 0) return true; // Giữ header
        const regex = /(?:^|,)(?:"([^"]*)"|([^",]*))/g;
        const parts = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
          parts.push(match[1] !== undefined ? match[1] : match[2]);
        }
        if (parts.length < 1) return false;

        const rowName = parts[0]?.trim();
        const rowPersonId = (parts[5] || '').trim();
        const rowAlias = (parts[6] || '').trim();

        if (targetId && (rowAlias === targetId || rowPersonId === targetId)) return false;
        if (targetNorm && normalizeName(rowName) === targetNorm) return false;

        return true;
      });

      fs.writeFileSync(filePath, newLines.join('\n') + '\n', 'utf-8');
      console.log(`🗑️ [CSV Service] Đã xóa thành viên "${identifier}" khỏi ${path.basename(filePath)}`);
      return [filePath];
    }
  }

  // Nếu không truyền className -> Reset avatar/PersonID trên toàn bộ file (tương thích backward)
  const updatedFiles = [];
  if (!fs.existsSync(DATA_DIR)) return updatedFiles;

  const files = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.csv') && !f.includes('.bak'));

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      let fileModified = false;

      const newLines = lines.map((line, idx) => {
        if (idx === 0 && line.toLowerCase().startsWith('tên,')) return line;
        const parts = line.split(',');
        if (parts.length < 4) return line;

        const rowName = normalizeName(parts[0]);
        const rowId = (parts[5] || '').trim();

        if ((targetId && rowId === targetId) || (targetNorm && rowName === targetNorm && (!rowId || rowId === targetId))) {
          parts[4] = '""';
          parts[5] = '""';
          fileModified = true;
          return parts.join(',');
        }
        return line;
      });

      if (fileModified) {
        fs.writeFileSync(filePath, newLines.join('\n') + '\n', 'utf-8');
        updatedFiles.push(file);
        console.log(`🧹 [CSV Service] Đã xóa Face ID & PersonID trong file ${file} cho ID: ${identifier}`);
      }
    } catch (err) {
      console.warn(`[CSV Service] Lỗi khi reset person trong file ${file}:`, err.message);
    }
  }

  return updatedFiles;
}

/**
 * Đổi tên file CSV của lớp và đồng bộ cột Lớp trong tất cả các dòng
 * @param {string} oldClassName Tên lớp cũ
 * @param {string} newClassName Tên lớp mới
 */
async function renameClassCsv(oldClassName, newClassName) {
  const oldPath = getFilePath(oldClassName);
  if (!fs.existsSync(oldPath)) {
    throw new Error(`Không tìm thấy file danh mục cho lớp ${oldClassName}`);
  }

  const safeNewName = path.basename(newClassName).replace(/\.csv$/i, '').trim();
  const newPath = path.join(DATA_DIR, `${safeNewName}.csv`);

  const content = fs.readFileSync(oldPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

  const newLines = lines.map((line, idx) => {
    if (idx === 0) return line; // Giữ header
    const regex = /(?:^|,)(?:"([^"]*)"|([^",]*))/g;
    const parts = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      parts.push(match[1] !== undefined ? match[1] : match[2]);
    }
    if (parts.length >= 2) {
      parts[1] = safeNewName; // Cập nhật cột Lớp
      return parts.map(p => (p && (p.includes(',') || p.includes('"')) ? `"${p.replace(/"/g, '""')}"` : (p || ''))).join(',');
    }
    return line;
  });

  // Ghi file mới
  fs.writeFileSync(newPath, newLines.join('\n') + '\n', 'utf-8');

  // Xóa file cũ nếu tên khác file mới
  if (path.resolve(oldPath) !== path.resolve(newPath) && fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
  }

  console.log(`🔄 [CSV Service] Đã đổi tên lớp từ "${oldClassName}" sang "${newClassName}"`);
  return true;
}

/**
 * Tự động ghi ngược thông tin đăng ký vào file CSV
 * @param {string} className Tên lớp/nhóm (VD: ThemSuc_1a, GLV, DMHCCC)
 * @param {string} personName Họ và tên người đăng ký
 * @param {string} avatarUrl Link ảnh từ HANET Cloud (https://static.hanet.ai/...)
 * @param {string|number} personId ID cấp bởi HANET Cloud
 * @param {string} inputTitle Chức vụ do người dùng nhập (nếu có)
 */
async function writeBackRegistration(className, personName, avatarUrl, personId, inputTitle = '') {
  if (!className || !personName || !personId) {
    console.warn('[CSV Service] Thiếu thông tin bắt buộc để ghi CSV:', { className, personName, personId });
    return false;
  }

  const cleanClassName = className.replace(/\.csv$/i, '');
  const filePath = path.join(DATA_DIR, `${cleanClassName}.csv`);

  if (!fs.existsSync(filePath)) {
    console.warn(`[CSV Service] Không tìm thấy file: ${filePath}`);
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const validLines = lines.filter(l => l.trim().length > 0);

    const targetNormName = normalizeName(personName);
    let matchedIndex = -1;

    // 1. Tìm xem tên đã có sẵn trong file CSV chưa
    for (let i = 0; i < validLines.length; i++) {
      if (i === 0 && validLines[i].toLowerCase().startsWith('tên,')) continue;
      const parts = validLines[i].split(',');
      const rowName = normalizeName(parts[0]);
      if (rowName === targetNormName) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex !== -1) {
      // TRƯỜNG HỢP 1: Tên đã có -> Cập nhật đúng dòng đó (Cột 3 là Chức vụ, Cột 4 là links, Cột 5 là PersonID)
      const parts = validLines[matchedIndex].split(',');
      if (inputTitle && inputTitle.trim()) {
        parts[3] = inputTitle.trim();
      }
      parts[4] = avatarUrl ? `"${avatarUrl}"` : '""';
      parts[5] = String(personId);
      validLines[matchedIndex] = parts.join(',');

      console.log(`✅ [CSV Write-Back] Đã cập nhật dòng ${matchedIndex + 1} cho: ${personName} (${parts[3]}) trong ${cleanClassName}.csv`);
    } else {
      // TRƯỜNG HỢP 2: Tên mới -> Kế thừa phòng ban & chức vụ từ người cuối cùng, thêm vào dòng Max + 1
      let inheritDept = 'Thiếu Nhi';
      let inheritTitle = inputTitle || 'Học Sinh';

      if (validLines.length > 0) {
        const lastLineParts = validLines[validLines.length - 1].split(',');
        if (lastLineParts.length >= 4) {
          inheritDept = lastLineParts[2]?.trim() || inheritDept;
          inheritTitle = inputTitle || lastLineParts[3]?.trim() || inheritTitle;
        }
      }

      const newLine = `${personName.trim()},${cleanClassName},${inheritDept},${inheritTitle},"${avatarUrl || ''}",${String(personId)}`;
      validLines.push(newLine);

      console.log(`🆕 [CSV Write-Back] Tên mới! Đã thêm vào dòng ${validLines.length} (Max + 1): ${personName} (${inheritTitle}) trong ${cleanClassName}.csv`);
    }

    // Ghi đè lại file CSV an toàn với ký tự xuống dòng chuẩn UTF-8
    fs.writeFileSync(filePath, validLines.join('\n') + '\n', 'utf-8');
    return true;
  } catch (error) {
    console.error(`❌ [CSV Write-Back Error] Lỗi ghi file ${cleanClassName}.csv:`, error.message);
    return false;
  }
}

module.exports = {
  getFilePath,
  readList,
  appendPerson,
  updatePersonInfo,
  removePersonFromCsv,
  renameClassCsv,
  writeBackRegistration,
  normalizeName
};

```

### File: `src/config/database.js`
```js
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

```

### File: `src/controllers/transferController.js`
```js
const { pool } = require('../config/database');
const transferService = require('../services/transferService');

/**
 * Controller Điều phối Nghiệp vụ Chuyển Lớp & Hoàn Tác (transferController)
 */

/**
 * [GET] Render trang Quản lý Chuyển Lớp
 */
exports.renderTransferPage = async (req, res) => {
  try {
    const [classesRes, batchRes] = await Promise.all([
      pool.query('SELECT name, department_id FROM classes ORDER BY name ASC'),
      pool.query(`
        SELECT batch_id, from_class, to_class, 
               COUNT(*) AS total_count,
               COUNT(*) FILTER (WHERE sync_status = 'SYNCED') AS synced_count,
               COUNT(*) FILTER (WHERE sync_status = 'FAILED') AS failed_count,
               MAX(created_at) AS created_at,
               MAX(restored_at) AS restored_at
        FROM transfer_snapshots
        GROUP BY batch_id, from_class, to_class
        ORDER BY MAX(created_at) DESC
        LIMIT 30;
      `)
    ]);

    res.render('transfer', {
      title: 'Quản Lý Chuyển Lớp & Điểm Phục Hồi (Saga)',
      classes: classesRes.rows || [],
      recentBatches: batchRes.rows || []
    });
  } catch (err) {
    console.error('[TransferController renderTransferPage Error]', err.message);
    req.flash('error', `Lỗi tải trang chuyển lớp: ${err.message}`);
    res.redirect('/links');
  }
};

/**
 * [GET] API Lấy danh sách thành viên theo lớp
 * Endpoint: /api/transfers/members?className=...
 */
exports.getMembersByClass = async (req, res) => {
  try {
    const { className } = req.query;
    if (!className || !className.trim()) {
      return res.status(400).json({ success: false, message: 'Thiếu tên lớp cần truy vấn' });
    }

    const query = `
      SELECT id, name, alias_id, person_id, class_name, department_id, title, face_url, sync_status 
      FROM persons 
      WHERE class_name = $1 
      ORDER BY id ASC;
    `;
    const result = await pool.query(query, [className.trim()]);

    res.json({
      success: true,
      className: className.trim(),
      total: result.rows.length,
      members: result.rows
    });
  } catch (err) {
    console.error('[TransferController getMembersByClass Error]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * [POST] API Xem trước tác động chuyển lớp
 * Endpoint: /api/transfers/preview
 */
exports.preview = async (req, res) => {
  try {
    const { fromClass, toClass, personIds } = req.body;

    if (!fromClass || !toClass) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn lớp nguồn và lớp đích' });
    }
    if (fromClass.trim().toUpperCase() === toClass.trim().toUpperCase()) {
      return res.status(400).json({ success: false, message: 'Lớp đích không được trùng với lớp nguồn' });
    }

    const previewData = await transferService.previewTransfer(
      fromClass.trim(),
      toClass.trim(),
      Array.isArray(personIds) ? personIds : []
    );

    res.json({
      success: true,
      data: previewData
    });
  } catch (err) {
    console.error('[TransferController preview Error]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * [POST] API Thực thi chuyển lớp (Saga Flow)
 * Endpoint: /api/transfers
 */
exports.executeTransfer = async (req, res) => {
  try {
    const { fromClass, toClass, personIds } = req.body;
    const actor = req.user || req.session?.user || {
      id: 'ANONYMOUS',
      username: 'anonymous',
      role: 'ADMIN'
    };

    if (!fromClass || !toClass) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn lớp nguồn và lớp đích' });
    }
    if (fromClass.trim().toUpperCase() === toClass.trim().toUpperCase()) {
      return res.status(400).json({ success: false, message: 'Lớp đích không được trùng với lớp nguồn' });
    }

    const transferResult = await transferService.transferMembers(
      fromClass.trim(),
      toClass.trim(),
      Array.isArray(personIds) ? personIds : [],
      actor
    );

    res.json({
      success: true,
      message: `Đã hoàn tất chuyển lớp: ${transferResult.successCount}/${transferResult.total} thành công.`,
      result: transferResult
    });
  } catch (err) {
    console.error('[TransferController executeTransfer Error]', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * [POST] API Hoàn tác đợt chuyển lớp
 * Endpoint: /api/transfers/:batchId/restore
 */
exports.restore = async (req, res) => {
  try {
    const { batchId } = req.params;

    if (!batchId || !batchId.trim()) {
      return res.status(400).json({ success: false, message: 'Thiếu mã đợt chuyển lớp (batchId)' });
    }

    const restoreResult = await transferService.restoreTransfer(batchId.trim());

    res.json({
      success: true,
      message: `Đã hoàn tác ${restoreResult.restoredCount}/${restoreResult.total} thành viên về lớp cũ.`,
      result: restoreResult
    });
  } catch (err) {
    console.error('[TransferController restore Error]', err.message);
    const status = (err.code === 'RESTORE_NOT_ALLOWED' || err.message.includes('RESTORE_NOT_ALLOWED')) ? 400 : 500;
    res.status(status).json({ success: false, error: err.code || 'RESTORE_ERROR', message: err.message });
  }
};

```

### File: `src/controllers/departmentController.js`
```js
const hanetService = require('../services/hanetService');
const { pool } = require('../config/database');

// [READ] Danh sách Phòng ban (Đồng bộ HANET Cloud & PostgreSQL)
exports.listDepartments = async (req, res) => {
  try {
    const [cloudRes, dbRes] = await Promise.all([
      hanetService.getDepartmentList().catch(() => ({ data: [] })),
      pool.query('SELECT d.*, count(p.id) as member_count FROM departments d LEFT JOIN persons p ON d.id = p.department_id GROUP BY d.id ORDER BY d.id ASC')
    ]);

    const departments = cloudRes?.data?.hits || cloudRes?.data || dbRes.rows || [];

    res.render('department/index', {
      title: 'Quản lý Phòng ban - HANET Cloud & DB',
      departments,
      dbDepartments: dbRes.rows || []
    });
  } catch (err) {
    console.error('[listDepartments Error]', err.message);
    req.flash('error', `Không thể lấy danh sách phòng ban: ${err.message}`);
    res.render('department/index', {
      title: 'Quản lý Phòng ban',
      departments: [],
      dbDepartments: []
    });
  }
};

// [CREATE] Tạo mới Phòng ban
exports.handleCreate = async (req, res) => {
  try {
    const { name, desc, code } = req.body;
    if (!name || !name.trim()) {
      req.flash('error', 'Tên phòng ban không được để trống.');
      return res.redirect('/departments');
    }

    const trimmedName = name.trim();
    const result = await hanetService.createDepartment(trimmedName, desc ? desc.trim() : '');

    if (result.returnCode === 1) {
      const newId = String(result.data?.id || Date.now());
      const deptCode = (code || trimmedName.slice(0, 4).toUpperCase()).replace(/\s+/g, '');

      // Lưu vào PostgreSQL
      await pool.query(
        `INSERT INTO departments (id, name, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           code = EXCLUDED.code`,
        [newId, trimmedName, deptCode]
      );

      req.flash('success', `Đã tạo thành công phòng ban "${trimmedName}" (ID: ${newId}).`);
    } else {
      req.flash('error', `Lỗi từ HANET Cloud [${result.returnCode}]: ${result.returnMessage}`);
    }

    res.redirect('/departments');
  } catch (err) {
    console.error('[handleCreate Error]', err.message);
    req.flash('error', `Không thể tạo phòng ban: ${err.message}`);
    res.redirect('/departments');
  }
};

// [UPDATE] Cập nhật Phòng ban
exports.handleUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, desc, code } = req.body;

    if (!name || !name.trim()) {
      req.flash('error', 'Tên phòng ban không được để trống.');
      return res.redirect('/departments');
    }

    const trimmedName = name.trim();

    // 1. Cập nhật trong PostgreSQL
    await pool.query(
      `UPDATE departments
       SET name = $1,
           code = COALESCE($2, code)
       WHERE id = $3`,
      [trimmedName, code ? code.trim() : null, String(id)]
    );

    // 2. Cập nhật trên HANET Cloud
    const result = await hanetService.updateDepartment(id, trimmedName, desc ? desc.trim() : '');

    if (result.returnCode === 1) {
      req.flash('success', `Đã cập nhật thành công phòng ban ID "${id}".`);
    } else {
      req.flash('warning', `Đã cập nhật Database. Cảnh báo Cloud [${result.returnCode}]: ${result.returnMessage}`);
    }

    res.redirect('/departments');
  } catch (err) {
    console.error('[handleUpdate Error]', err.message);
    req.flash('error', `Không thể cập nhật phòng ban: ${err.message}`);
    res.redirect('/departments');
  }
};

// [DELETE] Xóa Phòng ban
exports.handleDelete = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Xóa trong PostgreSQL (cascade hoặc set null)
    await pool.query('DELETE FROM departments WHERE id = $1', [String(id)]);

    // 2. Xóa trên HANET Cloud
    const result = await hanetService.removeDepartment(id);

    if (result.returnCode === 1) {
      req.flash('success', `Đã xóa thành công phòng ban ID "${id}".`);
    } else {
      req.flash('warning', `Đã xóa trong Database. Cảnh báo Cloud [${result.returnCode}]: ${result.returnMessage}`);
    }

    res.redirect('/departments');
  } catch (err) {
    console.error('[handleDelete Error]', err.message);
    req.flash('error', `Không thể xóa phòng ban: ${err.message}`);
    res.redirect('/departments');
  }
};

// [READ] Xem danh sách thành viên trong Phòng ban
exports.viewMembers = async (req, res) => {
  const { departmentID } = req.params;
  let members = [];
  let allPersons = [];
  let permissionError = false;
  let permissionMessage = '';

  try {
    // 1. Lấy tất cả nhân sự từ Cloud
    const allPersonsRes = await hanetService.getListByPlace().catch(() => ({ data: [] }));
    allPersons = allPersonsRes?.data || [];

    // 2. Lấy nhân sự từ PostgreSQL thuộc phòng ban này
    const dbMembersRes = await pool.query(
      `SELECT * FROM persons WHERE department_id = $1 ORDER BY name ASC`,
      [String(departmentID)]
    );

    // 3. Lấy nhân sự từ HANET Cloud
    try {
      const membersRes = await hanetService.getPersonsByDepartment(departmentID);
      if (membersRes.returnCode === 1 && membersRes.data) {
        members = membersRes.data;
      } else {
        members = dbMembersRes.rows || [];
      }
    } catch (err) {
      members = dbMembersRes.rows || [];
      if (err.response && err.response.status === 403) {
        permissionError = true;
        permissionMessage = `Phòng ban ID ${departmentID} không thuộc Place ID ${process.env.HANET_PLACE_ID} của app, hoặc thiếu quyền "department_person:read".`;
      }
    }
  } catch (err) {
    console.error(`[viewMembers Error - Dept ${departmentID}]`, err.message);
    req.flash('error', `Lỗi tải danh sách thành viên: ${err.message}`);
  }

  res.render('department/members', {
    title: `Quản lý Thành viên - Phòng ban ${departmentID}`,
    departmentID,
    members,
    allPersons,
    permissionError,
    permissionMessage
  });
};

// [CREATE/ADD] Thêm thành viên vào Phòng ban
exports.handleAddMembers = async (req, res) => {
  const { departmentID } = req.params;
  try {
    const { personIDs } = req.body;

    if (!personIDs || (Array.isArray(personIDs) && personIDs.length === 0)) {
      req.flash('error', 'Vui lòng chọn ít nhất một nhân sự để thêm vào phòng ban.');
      return res.redirect(`/departments/${departmentID}/members`);
    }

    const idsArray = Array.isArray(personIDs) ? personIDs : [personIDs];

    // 1. Cập nhật trong PostgreSQL
    for (const pId of idsArray) {
      await pool.query(
        `UPDATE persons
         SET department_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE person_id = $2 OR alias_id = $2`,
        [String(departmentID), String(pId)]
      );
    }

    // 2. Cập nhật trên HANET Cloud
    const result = await hanetService.addPersonsToDepartment(departmentID, personIDs);

    if (result.returnCode === 1) {
      req.flash('success', 'Đã thêm thành viên vào phòng ban thành công.');
    } else {
      req.flash('warning', `Đã cập nhật Database. Cảnh báo Cloud [${result.returnCode}]: ${result.returnMessage}`);
    }

    res.redirect(`/departments/${departmentID}/members`);
  } catch (err) {
    console.error('[handleAddMembers Error]', err.message);
    req.flash('error', `Không thể thêm nhân sự vào phòng ban: ${err.message}`);
    res.redirect(`/departments/${departmentID}/members`);
  }
};

// [FIX] Tự động xoá và tạo lại phòng ban qua API app (gắn đúng placeID)
exports.handleFix = async (req, res) => {
  const { id } = req.params;
  try {
    const listRes = await hanetService.getDepartmentList();
    const old = listRes?.data?.hits?.find(d => String(d.id) === String(id));
    if (!old) {
      req.flash('error', `Không tìm thấy phòng ban ID ${id}`);
      return res.redirect('/departments');
    }

    const delRes = await hanetService.removeDepartment(id);
    if (delRes.returnCode !== 1) {
      req.flash('error', `Không thể xoá phòng ban ${id}: ${delRes.returnMessage}`);
      return res.redirect('/departments');
    }

    const createRes = await hanetService.createDepartment(old.name, old.desc || '');
    if (createRes.returnCode === 1) {
      const newId = String(createRes.data?.id);
      await pool.query(
        `UPDATE departments SET id = $1 WHERE id = $2`,
        [newId, String(id)]
      );
      await pool.query(
        `UPDATE persons SET department_id = $1 WHERE department_id = $2`,
        [newId, String(id)]
      );
      req.flash('success', `Đã fix phòng ban "${old.name}": ID cũ ${id} → ID mới ${newId}`);
    } else {
      req.flash('error', `Xoá OK nhưng tạo lại lỗi: ${createRes.returnMessage}`);
    }

    res.redirect('/departments');
  } catch (err) {
    console.error('[handleFix Error]', err.message);
    req.flash('error', `Lỗi fix phòng ban: ${err.message}`);
    res.redirect('/departments');
  }
};

```

### File: `src/controllers/authController.js`
```js
/**
 * Authentication Controller for Admin Access
 */

exports.showLogin = (req, res) => {
  // Nếu đã đăng nhập thì chuyển hướng vào trang quản trị
  if (req.session?.user) {
    return res.redirect('/');
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="vi">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Đăng Nhập Quản Trị - HANET Cloud</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    </head>
    <body class="bg-light d-flex align-items-center justify-content-center vh-100">
      <div class="card border-0 shadow-sm rounded-4 p-4 text-center" style="max-width: 420px; width: 100%;">
        <div class="text-primary mb-3">
          <i class="bi bi-shield-lock-fill display-4"></i>
        </div>
        <h4 class="fw-bold text-dark mb-1">Quản Trị Hệ Thống</h4>
        <p class="text-muted small mb-4">Nhập mã Token quản trị để truy cập</p>

        <form method="POST" action="/login">
          <div class="mb-3 text-start">
            <label class="form-label small fw-semibold">Mã Token Quản Trị / Password</label>
            <input type="password" name="token" class="form-control form-control-lg rounded-3" placeholder="Nhập mã token..." required autofocus>
          </div>
          <button type="submit" class="btn btn-primary btn-lg w-100 fw-bold rounded-pill shadow-sm">
            <i class="bi bi-box-arrow-in-right me-1"></i> Đăng Nhập
          </button>
        </form>

        <div class="mt-4 pt-2 border-top">
          <a href="/links" class="text-decoration-none small text-muted">
            <i class="bi bi-arrow-left me-1"></i> Về trang Đăng Ký Theo Lớp
          </a>
        </div>
      </div>
    </body>
    </html>
  `);
};

exports.handleLogin = (req, res) => {
  const { token, username, password } = req.body;
  const adminToken = process.env.ADMIN_TOKEN || process.env.APP_TOKEN || 'admin123';
  const provided = (token || password || '').trim();

  if (provided === adminToken || !process.env.ADMIN_TOKEN) {
    req.session.user = {
      id: 'admin_sys',
      username: username || 'superadmin',
      role: 'SUPER_ADMIN'
    };
    req.session.isAdminAuthenticated = true;
    req.flash('success', 'Đăng nhập thành công!');
    return res.redirect('/');
  }

  req.flash('error', 'Mã Token hoặc mật khẩu không chính xác.');
  return res.redirect('/login');
};

exports.handleLogout = (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.redirect('/links');
    });
  } else {
    res.redirect('/links');
  }
};

```

### File: `src/controllers/personController.js`
```js
const path = require('path');
const hanetService = require('../services/hanetService');
const imageService = require('../services/imageService');
const queueService = require('../services/queueService');
const { pool } = require('../config/database');
const { getErrorMessage } = require('../utils/hanetErrorMap');

// [READ] Danh sách Nhân sự từ Cloud và Database
exports.listPersons = async (req, res, next) => {
  try {
    const [personRes, dbDeptRes] = await Promise.all([
      hanetService.getListByPlace(),
      pool.query('SELECT id, name FROM departments ORDER BY id ASC')
    ]);

    const persons = personRes?.data || [];
    const deptMap = {
      '990653': 'Thiếu Nhi',
      '990730': 'Legiô Mariae',
      '990731': 'Giới Trẻ'
    };

    (dbDeptRes.rows || []).forEach(d => {
      if (d.id && d.name) {
        deptMap[String(d.id)] = d.name;
      }
    });

    res.render('person/list', {
      title: 'Danh sách Nhân sự trên HANET Cloud',
      persons,
      deptMap
    });
  } catch (err) {
    console.error('[List Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Không thể lấy dữ liệu từ HANET Cloud: ${msg}`);
    res.render('person/list', { title: 'Danh sách Nhân sự', persons: [], deptMap: {} });
  }
};

// [READ] Danh Sách Link Đăng Ký từ Bảng classes (PostgreSQL)
exports.viewLinks = async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM classes ORDER BY name ASC');
    const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

    const links = result.rows.map(row => ({
      fileName: row.name,
      name: row.name,
      url: `${baseUrl}/register/${encodeURIComponent(row.name)}`
    }));

    res.render('links', {
      links,
      title: 'Danh Sách Link Đăng Ký Theo Lớp'
    });
  } catch (err) {
    console.error('[viewLinks Error]', err.message);
    res.render('links', {
      links: [],
      title: 'Danh Sách Link Đăng Ký Theo Lớp',
      error: 'Không thể tải danh sách link từ cơ sở dữ liệu.'
    });
  }
};

// [CREATE] Render Form Đăng ký chung
exports.renderRegisterForm = async (req, res) => {
  try {
    const [deptRes, dbClassesRes] = await Promise.all([
      pool.query('SELECT id, name FROM departments ORDER BY name ASC'),
      pool.query('SELECT name FROM classes ORDER BY name ASC')
    ]);

    res.render('person/register', {
      title: 'Đăng ký Face ID Nhân sự',
      departments: deptRes.rows || [],
      classes: dbClassesRes.rows || []
    });
  } catch (err) {
    console.error('[renderRegisterForm Error]', err.message);
    res.render('person/register', {
      title: 'Đăng ký Face ID Nhân sự',
      departments: [],
      classes: []
    });
  }
};

// [CREATE - POSTGRESQL] Render Form Đăng ký theo lớp từ bảng persons
exports.viewRegisterByFile = async (req, res) => {
  const fileName = req.params.file_name || req.params.classId;
  try {
    const result = await pool.query(
      `SELECT p.*, d.name AS department_name
       FROM persons p
       LEFT JOIN departments d ON p.department_id = d.id
       WHERE ($1::text IS NULL OR p.class_name = $1)
       ORDER BY p.id ASC`,
      [fileName]
    );

    const csvList = result.rows.map(row => ({
      ho_ten: row.name,
      lop: row.class_name,
      phong_ban: row.department_name || 'Thiếu Nhi',
      chuc_vu: row.title || 'Học Sinh',
      anh_url: row.face_url || '',
      hanet_person_id: row.person_id || '',
      alias_id: row.alias_id || ''
    }));

    if (csvList.length === 0) {
      req.flash('warning', `Lớp "${fileName}" hiện chưa có dữ liệu trong Database.`);
    }

    res.render('person/register_csv', {
      fileName,
      csvList,
      title: `Đăng Ký Face ID - ${fileName}`
    });
  } catch (err) {
    console.error('[viewRegisterByFile Error]', err.message);
    req.flash('error', `Không thể tải danh mục đăng ký: ${err.message}`);
    res.redirect('/links');
  }
};

// [CREATE] Xử lý Đăng ký Nhân sự mới (Cloud + PostgreSQL)
exports.handleRegister = async (req, res, next) => {
  try {
    const { aliasID, title, departmentID, base64_image, source_csv, className, lop, existing_person_id } = req.body;
    const name = req.body.personName || req.body.name;
    const targetClass = req.params.file_name || source_csv || req.body.file_name || className || lop || null;

    // 1. Validate Họ tên bắt buộc
    if (!name || !name.trim()) {
      req.flash('error', 'Vui lòng nhập Họ và Tên.');
      return res.redirect(targetClass ? `/register/${targetClass}` : '/register');
    }

    const uploadedFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    // 2. Validate Ảnh bắt buộc
    if (!uploadedFile && !base64_image) {
      req.flash('error', 'Vui lòng chụp hoặc tải ảnh khuôn mặt.');
      return res.redirect(targetClass ? `/register/${targetClass}` : '/register');
    }

    // 3. Xử lý ảnh khuôn mặt qua Image Service
    const processedImage = await imageService.processFaceImage({
      filePath: uploadedFile ? uploadedFile.path : null,
      base64String: base64_image || null
    });

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const publicImageUrl = `${baseUrl.replace(/\/$/, '')}/uploads/${processedImage.filename}`;

    // 4. Xác định Department ID từ DB nếu chưa có
    let finalDeptID = departmentID || null;
    if (!finalDeptID && targetClass) {
      const classRow = await pool.query('SELECT department_id FROM classes WHERE name = $1 LIMIT 1', [targetClass]);
      if (classRow.rows.length > 0 && classRow.rows[0].department_id) {
        finalDeptID = classRow.rows[0].department_id;
      }
    }
    if (!finalDeptID) finalDeptID = '990653'; // Mặc định Thiếu Nhi

    // 5. Kiểm tra thành viên đã tồn tại trong DB chưa (tránh sinh alias rác trùng lặp)
    let targetAlias = (aliasID || '').trim();
    let targetPersonId = existing_person_id || null;

    if (!targetAlias) {
      const existingPerson = await pool.query(
        `SELECT id, alias_id, person_id, sync_status, face_url, department_id, title 
         FROM persons 
         WHERE TRIM(LOWER(name)) = TRIM(LOWER($1)) 
           AND ($2::text IS NULL OR class_name = $2)
         LIMIT 1;`,
        [name.trim(), targetClass]
      );

      if (existingPerson.rows.length > 0) {
        // Tái sử dụng alias_id đã có (kể cả cũ hay mới), không sinh thêm mã rác
        targetAlias = existingPerson.rows[0].alias_id;
        targetPersonId = existingPerson.rows[0].person_id || targetPersonId;

        // Cập nhật trạng thái PENDING cho bản ghi hiện tại
        await pool.query(
          `UPDATE persons 
           SET updated_at = CURRENT_TIMESTAMP, 
               sync_status = 'PENDING',
               face_url = COALESCE($1, face_url),
               department_id = COALESCE($2, department_id),
               title = COALESCE($3, title)
           WHERE id = $4;`,
          [publicImageUrl, finalDeptID, (title || 'Học Sinh').trim(), existingPerson.rows[0].id]
        );
      } else {
        // Người mới hoàn toàn: Sinh mã theo RULE-004
        let deptPrefix = 'TN';
        if (finalDeptID === '990730') deptPrefix = 'LM';
        else if (finalDeptID === '990731') deptPrefix = 'GT';
        else if (finalDeptID === '990732') deptPrefix = 'GTR';
        else if (finalDeptID === '990733') deptPrefix = 'HM';

        const cleanClass = (targetClass || 'CHUNG')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase();

        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        targetAlias = `${deptPrefix}_${cleanClass}_${randomSuffix}`;

        // Insert bản ghi PENDING mới vào PostgreSQL
        await pool.query(
          `INSERT INTO persons (alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', CURRENT_TIMESTAMP)
           ON CONFLICT (alias_id) DO UPDATE SET
             name = EXCLUDED.name,
             face_url = COALESCE(EXCLUDED.face_url, persons.face_url),
             department_id = COALESCE(EXCLUDED.department_id, persons.department_id),
             title = EXCLUDED.title,
             updated_at = CURRENT_TIMESTAMP;`,
          [targetAlias, targetPersonId, name.trim(), targetClass, finalDeptID, (title || 'Học Sinh').trim(), publicImageUrl]
        );
      }
    } else {
      // Đã có aliasID truyền lên từ form
      await pool.query(
        `INSERT INTO persons (alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', CURRENT_TIMESTAMP)
         ON CONFLICT (alias_id) DO UPDATE SET
           name = EXCLUDED.name,
           face_url = COALESCE(EXCLUDED.face_url, persons.face_url),
           department_id = COALESCE(EXCLUDED.department_id, persons.department_id),
           title = EXCLUDED.title,
           updated_at = CURRENT_TIMESTAMP;`,
        [targetAlias, targetPersonId, name.trim(), targetClass, finalDeptID, (title || 'Học Sinh').trim(), publicImageUrl]
      );
    }

    // 6. Đẩy tác vụ vào Bull Queue xử lý với HANET Cloud
    await queueService.enqueueRegisterPerson({
      name: name.trim(),
      aliasID: targetAlias,
      title: title ? title.trim() : 'Học Sinh',
      departmentID: finalDeptID,
      imagePath: processedImage.processedPath,
      imageFilename: processedImage.filename,
      publicImageUrl,
      source_csv: targetClass,
      existing_person_id: targetPersonId || null
    });

    req.flash('success', `Đã tiếp nhận đăng ký cho "${name}". Tiến trình đồng bộ Cloud đang chạy ngầm.`);
    res.redirect(targetClass ? `/register/${targetClass}` : '/links');
  } catch (err) {
    console.error('[Register Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Lỗi đăng ký: ${msg}`);
    const redirectUrl = req.params.file_name || req.body?.source_csv || req.body?.file_name;
    res.redirect(redirectUrl ? `/register/${redirectUrl}` : '/register');
  }
};

// [UPDATE] Render Form Chỉnh sửa thông tin nhân sự
exports.renderEditForm = async (req, res, next) => {
  try {
    const { personID } = req.params;

    const [personRes, deptRes] = await Promise.all([
      hanetService.getListByPlace(),
      pool.query('SELECT id, name FROM departments ORDER BY id ASC')
    ]);

    const persons = personRes?.data || [];
    const departments = deptRes.rows || [];
    const person = persons.find(p => String(p.id || p.personID) === String(personID));

    if (!person) {
      req.flash('error', 'Không tìm thấy thông tin nhân sự trên HANET Cloud.');
      return res.redirect('/admin/person/list');
    }

    res.render('person/edit', {
      title: `Chỉnh sửa: ${person.name}`,
      person,
      departments
    });
  } catch (err) {
    console.error('[Edit Form Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Lỗi truy xuất thông tin nhân sự: ${msg}`);
    res.redirect('/admin/person/list');
  }
};

// [UPDATE] Xử lý Cập nhật Thông tin / Face ID lên Cloud và PostgreSQL
exports.handleUpdate = async (req, res, next) => {
  try {
    const { personID } = req.params;
    const { name, aliasID, title, departmentID, base64_image } = req.body;

    if (!name || !name.trim()) {
      req.flash('error', 'Vui lòng nhập Họ và Tên.');
      return res.redirect(`/edit/${personID}`);
    }

    // 1. Cập nhật thông tin trong PostgreSQL
    let publicImageUrl = null;
    let imageFilename = null;
    let imagePath = null;

    const uploadedUpdateFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
    if (uploadedUpdateFile || base64_image) {
      const processedImage = await imageService.processFaceImage({
        filePath: uploadedUpdateFile ? uploadedUpdateFile.path : null,
        base64String: base64_image || null
      });
      const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      publicImageUrl = `${baseUrl}/uploads/${processedImage.filename}`;
      imageFilename = processedImage.filename;
      imagePath = processedImage.processedPath;
    }

    await pool.query(
      `UPDATE persons
       SET name = COALESCE($1, name),
           title = COALESCE($2, title),
           face_url = COALESCE($3, face_url),
           department_id = COALESCE($4, department_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE alias_id = $5 OR person_id = $5`,
      [name.trim(), title ? title.trim() : null, publicImageUrl, departmentID || null, String(personID)]
    );

    // 2. Gửi tác vụ cập nhật vào Bull Queue
    await queueService.enqueueUpdatePerson({
      personID,
      name: name.trim(),
      aliasID: aliasID ? aliasID.trim() : '',
      title: title ? title.trim() : 'Học Sinh',
      departmentID: departmentID || null,
      imagePath,
      imageFilename,
      publicImageUrl
    });

    req.flash('success', `Đã cập nhật thông tin cho "${name}".`);
    res.redirect('/admin/person/list');
  } catch (err) {
    console.error('[Update Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Không thể cập nhật nhân sự: ${msg}`);
    res.redirect(`/edit/${req.params.personID}`);
  }
};

// [DELETE] Xử lý Xóa Nhân sự trên HANET Cloud & PostgreSQL
exports.handleDelete = async (req, res, next) => {
  const personID = req.params.personID || req.params.id || req.body.personID;

  if (!personID) {
    req.flash('error', 'Không tìm thấy ID nhân sự để xóa.');
    return res.redirect('/admin/person/list');
  }

  try {
    // 1. Xóa trực tiếp trong Database PostgreSQL
    await pool.query('DELETE FROM persons WHERE alias_id = $1 OR person_id = $1', [String(personID)]);

    // 2. Gọi API xóa nhân sự trên HANET Cloud
    const result = await hanetService.removePerson(personID);

    if (result && result.returnCode === 1) {
      req.flash('success', `Đã xóa thành công nhân sự [ID: ${personID}] khỏi hệ thống.`);
    } else {
      const errorMsg = getErrorMessage(result?.returnCode, result?.returnMessage);
      req.flash('warning', `Đã xóa trong Database cục bộ. Cảnh báo Cloud: ${errorMsg}`);
    }

    res.redirect('/admin/person/list');
  } catch (err) {
    console.error('[Delete Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Không thể xóa nhân sự: ${msg}`);
    res.redirect('/admin/person/list');
  }
};

// [READ] Lịch sử Check-in Real-time
exports.renderCheckin = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = now.getTime();

    const result = await hanetService.getCheckinByTimestamp(startOfMonth, endOfMonth);
    const logs = result?.data || [];

    res.render('person/checkin', {
      title: 'Nhật ký Check-in Real-time',
      logs
    });
  } catch (err) {
    console.error('[Checkin Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Lỗi truy xuất lịch sử check-in: ${msg}`);
    res.render('person/checkin', { title: 'Nhật ký Check-in', logs: [] });
  }
};

// [READ] Quản lý Dead Letter Queue (DLQ)
exports.viewDLQ = async (req, res, next) => {
  try {
    const jobs = await queueService.getDLQJobs(0, 50);
    res.json({ success: true, count: jobs.length, jobs });
  } catch (err) {
    console.error('[viewDLQ Error]', err.message);
    res.status(500).json({ error: `Không thể đọc DLQ: ${err.message}` });
  }
};

// [SYNC] Kích hoạt đồng bộ Cloud về PostgreSQL Database
exports.triggerSync = async (req, res, next) => {
  try {
    const listRes = await hanetService.getListByPlace();
    const cloudPersons = listRes?.data || [];

    let syncCount = 0;
    for (const cp of cloudPersons) {
      const pId = String(cp.personID || cp.id);
      const name = cp.name;
      const avatar = cp.avatar || cp.faceUrl || null;
      const alias = cp.aliasID || null;
      const deptId = cp.departmentID ? String(cp.departmentID) : null;
      const title = cp.title || 'Học Sinh';

      if (alias) {
        await pool.query(
          `INSERT INTO persons (alias_id, person_id, name, department_id, title, face_url, sync_status, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'SYNCED', CURRENT_TIMESTAMP)
           ON CONFLICT (alias_id) DO UPDATE SET
             person_id = EXCLUDED.person_id,
             face_url = COALESCE(EXCLUDED.face_url, persons.face_url),
             sync_status = 'SYNCED',
             updated_at = CURRENT_TIMESTAMP`,
          [alias, pId, name, deptId, title, avatar]
        );
        syncCount++;
      }
    }

    req.flash('success', `Đã đồng bộ thành công ${syncCount}/${cloudPersons.length} nhân sự từ Cloud vào PostgreSQL.`);
    res.redirect('/admin/person/list');
  } catch (err) {
    console.error('[triggerSync Error]', err.message);
    req.flash('error', `Lỗi đồng bộ: ${err.message}`);
    res.redirect('/admin/person/list');
  }
};

// Aliases cho routing tương thích
exports.list = exports.listPersons;
exports.showLinks = exports.viewLinks;
exports.showRegisterForm = exports.viewRegisterByFile;
exports.update = exports.handleUpdate;
exports.delete = exports.handleDelete;

```

