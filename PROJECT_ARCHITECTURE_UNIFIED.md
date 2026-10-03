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

### 4.4 RULE-004 (Mở rộng): Chuẩn Hóa Định Danh `alias_id` 3 Phần & Phân Định Source of Truth

#### 4.4.1. Phân định Source of Truth (Ưu tiên tuyệt đối hai chiều)

| Trường | Source of Truth | Chiều đồng bộ | Hành vi khi xung đột |
| :--- | :---: | :--- | :--- |
| `alias_id` | **PostgreSQL** | Postgres → HANET | HANET cập nhật theo Postgres |
| `name`, `class_name`, `department_id`, `title` | **PostgreSQL** | Postgres → HANET | HANET cập nhật theo Postgres |
| `person_id` | **HANET Cloud** | HANET → Postgres | Postgres ghi đè theo HANET |
| `face_url` | **HANET Cloud** | HANET → Postgres | Postgres ghi đè theo HANET |

#### 4.4.2. Định dạng chuẩn `alias_id`
```
[MÃ_PHÒNG_BAN]_[TÊN_LỚP_KHÔNG_DẤU_VIẾT_HOA]_[TOKEN_4_KÝ_TỰ]
```
- **MÃ_PHÒNG_BAN:** `TN` (Thiếu Nhi), `LM` (Legiô Mariae), `GT` (Giới Trẻ), `GTR` (Gia Trưởng), `HM` (Hiền Mẫu).
- **TÊN_LỚP:** Viết HOA, loại bỏ toàn bộ dấu tiếng Việt, khoảng trắng và `_`.
- **TOKEN_4_KÝ_TỰ:** Chuỗi ngẫu nhiên `[A-Z0-9]`, đảm bảo UNIQUE toàn cục.
- **Ví dụ:** `TN_THEMSUC1C_YZBW`, `LM_DMHCCC_4BDI`, `GT_GIOITRE_9M1N`.

#### 4.4.3. Quy tắc xử lý dữ liệu `PENDING`
Trong bảng `persons`, các bản ghi import khung tên có:
- `alias_id IS NULL`
- `sync_status = 'PENDING'`
- Chưa có `person_id` / `face_url`

**Bắt buộc:** Toàn bộ bản ghi này phải được tự động sinh mã theo RULE-004 qua 2 cơ chế:
1. **Batch Backfill Script** (`generate_missing_aliases.js`) — chạy một lần để xử lý dữ liệu tồn đọng.
2. **Runtime Trigger** — trong `dbClassService.addMember()` và `personController.handleRegister()` để không phát sinh bản ghi NULL mới.

#### 4.4.4. Triết lý Zero-Friction Registration
- Toàn bộ khung dữ liệu (`name`, `class_name`, `department_id`, `title`, `alias_id`) đã được chuẩn bị sẵn từ PostgreSQL.
- Người dùng mở link lớp `/register/:class_name` → hệ thống render danh sách học sinh với `alias_id` đã có.
- **Người dùng chỉ cần chọn tên + chụp/tải ảnh khuôn mặt** — KHÔNG phải nhập bất kỳ trường nào.
- Form đăng ký tự động prefill từ record `PENDING` tương ứng trước khi gửi.

#### 4.4.5. Quy trình cập nhật `alias_id` lên HANET (2 bước bắt buộc)
1. Gọi `POST /person/updateInfo` với `aliasID`, `name`, `title`, `departmentID`.
2. Gọi ngay `POST /department/add-person` để khóa phòng ban không bị reset về 0.
3. Cập nhật `sync_status = 'SYNCED'`, `updated_at = NOW()` vào Postgres.

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
