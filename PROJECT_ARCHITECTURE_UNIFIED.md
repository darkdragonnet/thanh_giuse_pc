# KIẾN TRÚC HỆ THỐNG VÀ ĐẶC TẢ KỸ THUẬT HỢP NHẤT
## DỰ ÁN: THANH GIUSE PC (HANET AI CLOUD FIRST & CSV DATA INTEGRATION)

---

## MỤC LỤC
1. **PHẦN 1: TỔNG QUAN HỆ THỐNG & LUỒNG LIÊN KẾT (System Architecture & Data Flow)**
   - Sơ đồ tương tác và luồng chạy dữ liệu khép kín.
   - Phân tách và ánh xạ dữ liệu file CSV theo nhóm/đoàn thể dựa trên AliasID (MSNV).
2. **PHẦN 2: BẢN ĐỒ MÃ NGUỒN TỔNG HỢP (Unified Source Code Map)**
   - Services: `hanetService.js`, `queueService.js`, `csvService.js`, `imageService.js`.
   - Controllers & Routes: `personController.js`, `personRoutes.js`.
   - Views (EJS): `register.ejs`, `layout.ejs`, `register_csv.ejs`, `edit.ejs`.
   - Scripts Tự động hóa: `sync_cloud_to_csv.js`, `check_missing_faces.js`, `sync_83_faceids_to_csv.js`.
   - Cấu hình hạ tầng: `docker-compose.yml`, `Dockerfile`, `redis`, `cloudflared tunnel`.
3. **PHẦN 3: TRI THỨC HỆ THỐNG (Knowledge Base)**
   - HANET Cloud API Specification (OAuth2, Endpoints, Formats, Headers).
   - Bảng mã lỗi chi tiết & Cơ chế Fallback (-5011, -9007, -103).
4. **PHẦN 4: QUY TẮC VÀ ĐẶC TẢ KỸ THUẬT (Rules & Reuse Specifications)**
   - RULE-001: UTF-8 BOM CSV Specification.
   - RULE-002: One-way Enrich & Safe Write-back.
   - RULE-003: Zalo WebView Anti-Cache Policy.
   - RULE-004: Chuẩn hóa Định danh AliasID 3 phần.
   - RULE-022: Cleanup Delay 30s Policy.
   - RULE-090: Full Source Code Integrity.
5. **PHẦN 5: KỸ NĂNG VÀ THAO TÁC VẬN HÀNH (Skills & Operations)**
   - Quy trình Git & Deployment chuẩn trên VPS Ubuntu (`root@vpssieutoc`).
   - Lệnh điều phối Docker, Redis và chạy script bảo trì dữ liệu ngầm.

---

## PHẦN 1: TỔNG QUAN HỆ THỐNG & LUỒNG LIÊN KẾT (System Architecture & Data Flow)

### 1.1 Sơ Đồ Khép Kín Hệ Thống (End-to-End Architecture)

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Client & Zalo WebView"]
        A1["Người Dùng Zalo / Web Mobile"] -->|Mở Link Đăng Ký / Anti-Cache Meta| A2["Giao Diện Canvas (register.ejs)"]
        A2 -->|Chụp Ảnh / Tải Ảnh + Pan/Zoom 1280x738| A3["Gửi Form (POST Multipart)"]
    end

    subgraph AppLayer ["2. Express.js Application Server"]
        B1["personRoutes.js"] --> B2["personController.js"]
        B2 -->|Tiền Xử Lý Ảnh| B3["imageService.js (Sharp 1280x738)"]
        B3 -->|Đẩy Tác Vụ Ngầm| B4["queueService.js (Bull Queue - Redis DB 4)"]
    end

    subgraph HanetLayer ["3. HANET AI Cloud Integration"]
        B4 -->|1. Gọi Đăng Ký Nhân Sự| C1["hanetService.registerPerson"]
        C1 -->|Multipart Binary / URL| C2["HANET Cloud API (/person/register)"]
        C2 -- "Mã -9007 (Mặt đã tồn tại)" --> C3["Luồng Fallback: extractPersonIDFromHanet"]
        C3 -->|2. Cập Nhật Face ID| C4["hanetService.updateByFaceUrl"]
        C3 -->|3. Cập Nhật Info & Title| C5["hanetService.updateInfo"]
        C3 -->|4. Khóa Phòng Ban| C6["hanetService.addPersonsToDepartment"]
        C2 -- "Thành Công (returnCode: 1)" --> C6
    end

    subgraph DataLayer ["4. Write-Back & Storage"]
        C6 -->|5. Ghi Đè Thông Minh CSV| D1["csvService.writeBackRegistration"]
        D1 -->|Cập Nhật links & PersonID| D2["data/*.csv (ThemSuc, GLV,...)"]
        B4 -->|6. Dọn Dẹp File Tạm Sau 30s (RULE-022)| D3["uploads/ cleanupDelayed"]
    end

    subgraph InfraLayer ["5. Đồng Bộ & Hạ Tầng"]
        E1["VPS Ubuntu (root@vpssieutoc)"] <-->|Git Fetch / Reset Hard| E2["Local iMac Workspace"]
        E1 -->|Docker Compose| E3["App Container (Node 25)"]
        E1 -->|Docker Compose| E4["Redis 7-Alpine (DB 4)"]
        E1 -->|Docker Compose| E5["Cloudflare Tunnel (Public Access)"]
        E3 -->|Chạy Định Kỳ| E6["scripts/sync_cloud_to_csv.js"]
    end

    A3 --> B1
    D2 -.-> E6
```

### 1.2 Cơ Chế Phân Tách & Ánh Xạ Dữ Liệu CSV Theo Mã Alias ID (MSNV)
Hệ thống sử dụng **Cloud-First** kết hợp **File-Based CSV Database** làm kho lưu trữ phân tán cho từng lớp/đoàn thể:
- Mỗi file CSV đặt tại `data/[Tên_Lớp].csv` tương ứng với một danh mục thực tế (Ví dụ: `GLV.csv`, `ThemSuc_1a.csv`, `DMHCCC.csv`).
- Cấu trúc chuẩn 6 cột: `Tên,Lớp,Phòng Ban,Chức Vụ,links,PersonID`.
- Ánh xạ AliasID chuẩn 3 thành phần: `[MÃ_PHÒNG_BAN]_[TÊN_LỚP]_[MÃ_ĐỊNH_DANH]`:
  + `TN_GLV_4BDI` -> Phòng ban: **Thiếu Nhi** (`990653`), Lớp: `GLV`, Chức vụ: `Giáo Lý Viên`.
  + `TN_THEMSUC1A_X8Y9` -> Phòng ban: **Thiếu Nhi** (`990653`), Lớp: `ThemSuc_1a`, Chức vụ: `Học Sinh`.
  + `LM_DMHCCC_K3L2` -> Phòng ban: **Legiô Mariae** (`990730`), Lớp: `DMHCCC`, Chức vụ: `Hội Viên`.
  + `GT_GIOITRE_9M1N` -> Phòng ban: **Giới Trẻ** (`990731`), Lớp: `GioiTre`, Chức vụ: `Đoàn Sinh`.

---

## PHẦN 2: BẢN ĐỒ MÃ NGUỒN TỔNG HỢP (Unified Source Code Map)

### 2.1 Services (`src/services/`)
- **[`hanetService.js`](file:///Users/dragon/thanh_giuse_pc/src/services/hanetService.js):**
  + Tự động quản lý vòng đời OAuth2 token, xoay vòng khi token hết hạn (mã lỗi `-103`).
  + `registerPerson(data)`: Gửi stream file ảnh nhị phân trực tiếp (`form-data`) tới `/person/register`.
  + `updateInfo(data)` & `updatePerson(data)`: Chuẩn hóa payload `application/x-www-form-urlencoded`, tự động fallback `departmentID` mặc định `'990653'` khi thiếu hoặc rỗng.
  + `updateByFaceUrl(data)`: Cập nhật khuôn mặt qua `faceUrl` / `fileUrl`.
  + `getListByPlace({ fetchAll: true })`: Quét phân trang toàn bộ nhân sự từ Cloud, chống rate limit.
  + `getPersonByAliasID(aliasID)`: Tra cứu tức thì nhân sự qua MSNV.
  + `addPersonsToDepartment(departmentID, personIDs)`: Khóa phân quyền nhân sự vào phòng ban trên Cloud.
- **[`queueService.js`](file:///Users/dragon/thanh_giuse_pc/src/services/queueService.js):**
  + Điều phối hàng đợi Bull Queue chính `hanet-registration` và hàng đợi chết `hanet-registration-dlq` trên Redis DB 4.
  + Cấu hình Retry lũy thừa (`attempts: 3`, `backoff: exponential 2000ms`: 2s, 4s, 8s).
  + Định nghĩa lớp lỗi `UnrecoverableError`: Khi gặp lỗi vĩnh viễn (`-9002`, `-9005`, `-9006`), tự động dừng retry (`job.discard()`) và chuyển job sang Dead Letter Queue (DLQ).
  + Bắt mã lỗi `-9007` (*Face already exists*), trích xuất `personID` linh hoạt qua `extractPersonIDFromHanet`, chuyển tiếp sang hàm xử lý `handleFaceExistsFallback` để cập nhật Face ID, thông tin cá nhân và khóa phòng ban mà không crash tiến trình.
  + Cung cấp các hàm tiện ích quản trị DLQ: `getDLQJobs()`, `retryDLQJob(dlqJobId)`, `clearDLQ()`.
  + Tuân thủ RULE-022: `cleanupDelayed(imagePath, 30000)` trì hoãn 30 giây mới xóa file ảnh tạm để HANET Cloud hoàn tất tải.
- **[`csvService.js`](file:///Users/dragon/thanh_giuse_pc/src/services/csvService.js):**
  + Đọc/ghi file CSV với chuẩn UTF-8.
  + `writeBackRegistration(className, personName, avatarUrl, personId, title)`: Đối soát thông minh, cập nhật dòng người dùng có sẵn hoặc thêm mới vào dòng Max + 1 kế thừa phòng ban.
  + `removePersonFromCsv(personId, personName)`: Xóa liên kết Face ID và PersonID khi nhân sự bị xóa trên Cloud.
- **[`idempotencyService.js`](file:///Users/dragon/thanh_giuse_pc/src/services/idempotencyService.js):**
  + Quản lý chống trùng lặp tác vụ (Idempotency) và phân tán khóa (Distributed Lock) qua Redis SETNX trên DB 4.
  + `acquireLock(key, 120)`: Chiếm lock tạm thời 2 phút, ngăn chặn 2 worker cùng xử lý 1 tác vụ.
  + `markCompleted(key, 86400)`: Đánh dấu trạng thái `COMPLETED` và lưu giữ trong 24 giờ.
  + `releaseLock(key)`: Giải phóng lock khi gặp lỗi tạm thời để kích hoạt cơ chế retry của Bull Queue.
- **[`imageService.js`](file:///Users/dragon/thanh_giuse_pc/src/services/imageService.js):**
  + Chuẩn hóa kích thước khung hình HANET `1280x738` bằng Sharp.
  + Nén chất lượng ảnh JPEG tối ưu nhận diện, hỗ trợ cả upload file lẫn chuỗi Base64 từ canvas.

### 2.2 Middlewares (`src/middlewares/`)
- **[`authMiddleware.js`](file:///Users/dragon/thanh_giuse_pc/src/middlewares/authMiddleware.js):**
  + Quản lý xác thực và phân quyền theo vai trò (RBAC) với 4 Roles: `SUPER_ADMIN`, `ADMIN`, `GROUP_LEADER`, `PUBLIC_USER`.
  + Tự động nhận diện danh tính qua Session hoặc Token (`?token=...` / `Bearer ...`).
  + `authorize(allowedRoles)`: Chặn truy cập trái phép (401/403) đối với các endpoint nhạy cảm, đồng thời mở công khai 100% cho các route Zalo WebView (`/register`, `/register/:file_name`, `/links`).
- **[`auditMiddleware.js`](file:///Users/dragon/thanh_giuse_pc/src/middlewares/auditMiddleware.js):**
  + Ghi nhận nhật ký hệ thống có cấu trúc (Structured Audit Log) cho toàn bộ thao tác CUD / Sync.
  + Tự động lưu trữ dạng JSON Lines tại `logs/audit.log` và in trực tiếp ra Terminal với tiền tố `[AUDIT]`.

### 2.3 Views (`src/views/`)
- **[`register.ejs`](file:///Users/dragon/thanh_giuse_pc/src/views/register.ejs):**
  + Tích hợp đầy đủ thẻ meta chống cache trên Zalo WebView:
    ```html
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    ```
  + Đính kèm timestamp dynamic query `?v=<%= Date.now() %>` trên các thẻ stylesheet/script.
  + Tách 2 nút độc lập: "Chụp Ảnh Ngay" (`capture="user"`) và "Tải Ảnh Lên" (Thư viện).
  + Canvas tương tác Pan / Drag & Zoom thanh trượt trực quan với vòng oval xanh định vị khuôn mặt.
- **[`layout.ejs`](file:///Users/dragon/thanh_giuse_pc/src/views/layout.ejs):**
  + Master layout chuẩn Bootstrap 5, tích hợp thanh điều hướng (Nhân sự Cloud, Link Đăng Ký Theo Lớp, Check-in Realtime) và thẻ meta chống cache toàn diện.

### 2.4 Scripts Tự Động Hóa (`scripts/`)
- **[`sync_cloud_to_csv.js`](file:///Users/dragon/thanh_giuse_pc/scripts/sync_cloud_to_csv.js):**
  + Đồng bộ dữ liệu 2 chiều giữa Cloud HANET và toàn bộ file `data/*.csv`.
  + Sử dụng bộ index kép `cloudById`, `cloudByNameAndClass`, `cloudByName` chống trùng tên cho hơn 2.000 nhân sự.
  + Tự động reset `links` và `PersonID` về rỗng nếu nhân sự đã bị xóa khỏi Cloud.
- **[`check_missing_faces.js`](file:///Users/dragon/thanh_giuse_pc/scripts/check_missing_faces.js):**
  + Quét toàn bộ file CSV, thống kê danh sách những người chưa có Face ID để giáo lý viên / trưởng nhóm dễ dàng đôn đốc.
- **[`sync_83_faceids_to_csv.js`](file:///Users/dragon/thanh_giuse_pc/scripts/sync_83_faceids_to_csv.js):**
  + Script chuyên dụng đồng bộ toàn bộ FaceID hiện có trên Cloud vào CSV tương ứng theo tên lớp bóc tách từ AliasID.

### 2.5 Cấu Hình Hạ Tầng (`docker-compose.yml`)
```yaml
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
    depends_on:
      redis:
        condition: service_healthy
    volumes:
      - ./data:/app/data
      - ./uploads:/app/uploads

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

---

## PHẦN 3: TRI THỨC HỆ THỐNG (Knowledge Base)

### 3.1 Đặc Tả HANET Cloud API
- **Authentication:** OAuth2 Client Credentials (`https://oauth.hanet.com/token`) hoặc Token tĩnh (`HANET_ACCESS_TOKEN`). Khi token hết hạn, HANET trả về `returnCode: -103`, hệ thống tự động gọi lấy token mới và retry request.
- **Content-Type:** `application/x-www-form-urlencoded` thông qua `qs.stringify(payload)` cho tất cả các API cập nhật và truy vấn thông tin. Riêng `/person/register` hỗ trợ `multipart/form-data` kèm token trong body.
- **Các Endpoint Trọng Yếu:**
  | Endpoint | Phương Thức | Tham Số Bắt Buộc | Mô Tả |
  | :--- | :--- | :--- | :--- |
  | `/person/register` | POST (Multipart) | `token`, `placeID`, `name`, `aliasID`, `title`, `departmentID`, `file` | Đăng ký nhân sự kèm file ảnh nhị phân |
  | `/person/registerByUrl` | POST (Urlencoded) | `token`, `placeID`, `name`, `aliasID`, `title`, `departmentID`, `faceUrl` | Đăng ký nhân sự qua đường dẫn ảnh công khai |
  | `/person/updateInfo` | POST (Urlencoded) | `token`, `placeID`, `personID` (hoặc `aliasID`), `name`, `title`, `departmentID` | Cập nhật thông tin chi tiết nhân sự |
  | `/person/updateByFaceUrl` | POST (Urlencoded) | `token`, `placeID`, `personID`, `faceUrl` (hoặc `fileUrl`) | Cập nhật ảnh Face ID cho nhân sự đã có ID |
  | `/person/getUserInfoByAliasID` | POST (Urlencoded) | `token`, `placeID`, `aliasID` | Tra cứu chi tiết nhân sự theo mã AliasID (MSNV) |
  | `/person/getListByPlace` | POST (Urlencoded) | `token`, `placeID`, `page`, `size` | Lấy danh sách nhân sự (hỗ trợ phân trang) |
  | `/person/removePersonByID` | POST (Urlencoded) | `token`, `placeID`, `personID` | Xóa nhân sự vĩnh viễn trên Cloud |
  | `/department/add-person` | POST (Urlencoded) | `token`, `placeID`, `departmentID`, `personIDs` | Gán và khóa nhân sự vào phòng ban |

### 3.2 Bảng Mã Lỗi & Cơ Chế Phục Hồi Tự Động (Fallback Matrix)
| Mã Lỗi | Tên Lỗi / Ý Nghĩa | Phân Loại | Cơ Chế Xử Lý Của Hệ Thống |
| :---: | :--- | :--- | :--- |
| **`1`** | **Thành công (Success)** | Thành công | Ghi nhận ID, gán phòng ban và ghi ngược vào file CSV. |
| **`-103`** | **Access Token Expired** | Tạm thời | Tự động gọi OAuth2 lấy token mới và retry ngay lập tức. |
| **`-5011`** | **Không tìm thấy nhân sự** | Nghiệp vụ | Log cảnh báo, chuyển sang tạo mới hoặc kiểm tra lại mã AliasID/PersonID. |
| **`-9007`** | **Khuôn mặt đã tồn tại (Face exists)** | Nghiệp vụ Fallback | Trích xuất `personID` từ phản hồi hoặc tra cứu qua AliasID -> Chuyển hướng sang gọi `updateByFaceUrl` và `updateInfo` -> Khóa phòng ban -> Ghi ngược CSV thành công. |
| **`-9002`** | **Không phát hiện khuôn mặt** | Lỗi vĩnh viễn | Bỏ qua retry vô ích, chuyển vào DLQ và thông báo lỗi rõ ràng. |
| **`-9005`** | **Ảnh quá mờ / không đạt chuẩn** | Lỗi vĩnh viễn | Dừng retry, chuyển vào DLQ, yêu cầu chụp trong điều kiện đủ sáng. |
| **`-9006`** | **Phát hiện nhiều hơn 1 khuôn mặt** | Lỗi vĩnh viễn | Dừng retry, chuyển vào DLQ, yêu cầu chỉ đứng 1 mình trong khung hình. |

### 3.3 Ma Trận Phân Quyền (RBAC Matrix) & Đặc Tả Audit Log
- **Bảng Ma Trận Phân Quyền (Role-Based Access Control):**
  | Quyền Hạn / Chức Năng | SUPER_ADMIN | ADMIN | GROUP_LEADER | PUBLIC_USER |
  | :--- | :---: | :---: | :---: | :---: |
  | Đăng ký Face cá nhân (Form/Zalo) | ✔ | ✔ | ✔ | ✔ |
  | Xem danh mục link lớp (`/links`) | ✔ | ✔ | ✔ | ✔ |
  | Xem danh sách lớp mình phụ trách | ✔ | ✔ | ✔ | ✗ |
  | Sửa thông tin / Cập nhật Face ID | ✔ | ✔ | ✔ | ✗ |
  | Xem danh sách toàn hệ thống | ✔ | ✔ | ✗ | ✗ |
  | Xóa nhân sự trên Cloud | ✔ | ✔ | ✗ | ✗ |
  | Kích hoạt đồng bộ Cloud (`/sync/*`) | ✔ | ✔ | ✗ | ✗ |
  | Quản trị DLQ & Retry thất bại | ✔ | ✔ | ✗ | ✗ |
  | Quản trị Users & System Token | ✔ | ✗ | ✗ | ✗ |

- **Cấu Trúc JSON Lines của Audit Log (`logs/audit.log`):**
  ```json
  {
    "timestamp": "2026-09-29T16:20:00.000Z",
    "actor": {
      "userId": "admin_sys",
      "username": "superadmin",
      "role": "SUPER_ADMIN",
      "ip": "127.0.0.1",
      "userAgent": "Mozilla/5.0..."
    },
    "action": "UPDATE_PERSON_INFO",
    "target": {
      "aliasId": "TN_GLV_98CD",
      "personId": "123456",
      "className": "GLV"
    },
    "changes": {
      "before": { "title": "Giáo Lý Viên" },
      "after": { "title": "Phụ Trách Khối" }
    },
    "statusCode": 200,
    "result": "SUCCESS"
  }
  ```

---

## PHẦN 4: QUY TẮC VÀ ĐẶC TẢ KỸ THUẬT (Rules & Reuse Specifications)

### 4.1 RULE-001: UTF-8 Encoding & BOM Specification
- Mọi thao tác đọc/ghi file CSV tại thư mục `data/*.csv` phải đảm bảo tương thích tiếng Việt chuẩn. Khi ghi dữ liệu có dấu tiếng Việt, đảm bảo định dạng chuỗi chuẩn để Microsoft Excel và trình duyệt hiển thị đúng font chữ không bị vỡ ký tự.

### 4.2 RULE-002: One-way Enrich & Safe Write-Back
- HANET Cloud luôn được xem là **Single Source of Truth** cho dữ liệu nhận diện (Face ID, PersonID).
- Quá trình ghi ngược vào CSV không được xóa hoặc làm xáo trộn các dòng dữ liệu hiện có:
  + Nếu học viên đã có trong danh sách -> Cập nhật URL ảnh và PersonID tại đúng dòng đó.
  + Nếu là học viên mới hoàn toàn -> Kế thừa thuộc tính phòng ban từ dòng cuối cùng và bổ sung vào dòng Max + 1.

### 4.3 RULE-003: Zalo WebView No-Cache Policy
- Do trình duyệt nhúng Zalo WebView lưu cache HTML/CSS/JS rất lâu, bắt buộc phải có 2 lớp bảo vệ chống cache:
  1. **HTTP/HTML Meta Tags:**
     ```html
     <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
     <meta http-equiv="Pragma" content="no-cache">
     <meta http-equiv="Expires" content="0">
     ```
  2. **Asset Versioning:** Mọi đường dẫn nạp tài nguyên tĩnh (CSS, JS) nhúng trong file view động phải kèm tham số phiên bản `?v=<%= Date.now() %>`.

### 4.4 RULE-004: Chuẩn Hóa Định Danh AliasID 3 Phần
- Cấu trúc AliasID bắt buộc gồm đúng 3 phần nối bằng dấu gạch dưới: `[MÃ_PHÒNG_BAN]_[TÊN_LỚP]_[MÃ_ĐỊNH_DANH]`.
- Không chứa khoảng trắng, không dấu tiếng Việt, viết hoa toàn bộ.
- Ví dụ chuẩn: `TN_THEMSUC1A_A1B2`, `TN_GLV_98CD`, `LM_DMHCCC_E5F6`.

### 4.5 RULE-022: Cleanup Delay 30s Policy
- Khi ứng dụng nhận diện xong và tạo file ảnh tạm tại `uploads/`, không được xóa file ảnh ngay lập tức.
- Phải dùng hàm `imageService.cleanupDelayed(imagePath, 30000)` để giữ file ảnh tối thiểu 30 giây, tạo khoảng thời gian an toàn cho HANET Cloud tải ảnh về máy chủ nhận diện AI.

### 4.6 RULE-090: Full Source Code Integrity
- Mọi cập nhật mã nguồn phải cung cấp mã đầy đủ, không cắt xén, không dùng placeholder, đảm bảo khả năng triển khai tức thì mà không gây lỗi thiếu đoạn code.

---

## PHẦN 5: KỸ NĂNG VÀ THAO TÁC VẬN HÀNH (Skills & Operations)

### 5.1 Quy Trình Git & Deployment Chuẩn Trên VPS Ubuntu (`root@vpssieutoc`)

```bash
# 1. Truy cập vào thư mục dự án trên VPS
cd /root/thanh_giuse_pc

# 2. Cập nhật mã nguồn mới nhất từ nhánh main (Bỏ qua xung đột local trên VPS)
git fetch origin
git reset --hard origin/main

# 3. Build lại container ứng dụng trong nền
docker compose up -d --build app

# 4. Kiểm tra trạng thái hoạt động của các container (app, redis, tunnel)
docker compose ps

# 5. Theo dõi log thời gian thực của ứng dụng
docker compose logs -f app
```

### 5.2 Các Lệnh Bảo Trì Dữ Liệu Ngầm Trong Container

```bash
# Đồng bộ 2 chiều dữ liệu giữa HANET Cloud và các file CSV
docker compose exec app node scripts/sync_cloud_to_csv.js

# Kiểm tra danh sách những người chưa có Face ID
docker compose exec app node scripts/check_missing_faces.js

# Khôi phục và gán lại phòng ban tự động theo AliasID
docker compose exec app node scripts/restore_departments_by_alias.js

# Đồng bộ 83 FaceID trên Cloud vào đúng file CSV
docker compose exec app node scripts/sync_83_faceids_to_csv.js
```

### 5.3 Lệnh Kiểm Tra Redis Queue & Dead Letter Queue (DLQ)

```bash
# Kiểm tra số lượng job đang chờ hoặc xử lý trong Queue chính
docker compose exec redis redis-cli -n 4 keys "bull:hanet-registration:*"

# Kiểm tra các job thất bại trong Dead Letter Queue (DLQ)
docker compose exec redis redis-cli -n 4 keys "bull:hanet-registration-dlq:*"
```

---
*Tài liệu được khởi tạo và đồng bộ tự động cho hệ thống **Thành Giuse PC - HANET AI Cloud**.*
