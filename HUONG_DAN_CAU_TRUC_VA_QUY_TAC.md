# HƯỚNG DẪN CẤU TRÚC VÀ QUY TẮC FUNCTION HỆ THỐNG
**Hệ Thống Đăng Ký & Quản Lý Nhận Diện Khuôn Mặt Face ID (HANET AI Cloud)**

---

## 1. TỔNG QUAN KIẾN TRÚC HỆ THỐNG (ARCHITECTURE OVERVIEW)

Hệ thống được thiết kế theo mô hình **Cloud-First (No-Database)** kết hợp với lưu trữ danh mục bằng **CSV Data Layer**:
- **Không sử dụng cơ sở dữ liệu quan hệ (SQL/NoSQL truyền thống):** Dữ liệu định danh, trạng thái khuôn mặt và thông tin nhân sự được lưu trữ và quản lý trực tiếp trên **HANET Cloud**.
- **Data Layer (File CSV):** Lưu trữ danh sách phân lớp học sinh, đoàn thể trong thư mục `data/*.csv` với chuẩn 6 cột: `Tên,Lớp,Phòng Ban,Chức Vụ,links,PersonID`.
- **Hàng đợi ngầm (Bull Queue on Redis DB 4):** Xử lý bất đồng bộ các tác vụ nặng như đăng ký Face ID, nén ảnh, gán phòng ban và cập nhật dữ liệu để đảm bảo giao diện web luôn phản hồi tức thì (< 200ms).
- **Bộ chuẩn hóa ảnh Sharp (Backend Engine):** Đảm bảo 100% ảnh khuôn mặt gửi lên HANET đúng tỷ lệ chuẩn `1280 x 738`, tự động sửa góc xoay EXIF và nén JPEG chất lượng cao.
- **Stateful Session Store (Redis DB 4):** Lưu trữ phiên làm việc và thông báo tương tác (`connect-flash`).

```
[ Người Dùng / Mobile / Zalo ]
           │
           ▼
[ Express Router & Middlewares ] (src/routes, src/middlewares)
           │
           ▼
[ Controllers ] (personController, departmentController)
     │                     │
     ▼                     ▼
[ ImageService ]     [ CsvService ]
(Sharp 1280x738)    (data/*.csv R/W)
     │
     ▼
[ QueueService ] (Bull Queue on Redis DB 4)
     │
     ▼ (Worker chạy ngầm)
[ HanetService ] ◄──► [ HANET AI Cloud API ]
     │ (Write-back khi thành công)
     ▼
[ CsvService ] ──► Cập nhật links (Avatar) & PersonID vào data/*.csv
```

---

## 2. CẤU TRÚC THƯ MỤC DỰ ÁN

```
thanh_giuse_pc/
├── data/                       # Chứa các file CSV danh mục nhân sự theo từng lớp/đoàn thể
│   ├── GLV.csv                 # Danh sách Giáo Lý Viên
│   ├── ThemSuc_1a.csv          # Danh sách lớp Thêm Sức 1A
│   └── ...
├── public/                     # Tài nguyên tĩnh (CSS, JS, Fonts, Icons)
├── scripts/                    # Các kịch bản đồng bộ, sửa lỗi và bảo trì dữ liệu
│   ├── sync_csv_by_alias.js    # Đồng bộ trực tiếp Cloud HANET -> CSV (Cache / Alias ID)
│   ├── sync_cloud_to_csv.js    # Đồng bộ 2 chiều Cloud HANET và các file CSV
│   └── repair_departments.js   # Quét và tạo lại phòng ban bị lỗi quyền
├── src/                        # Mã nguồn chính của ứng dụng
│   ├── app.js                  # Entry point: Cấu hình Express, Redis, Session, Routes
│   ├── controllers/            # Tầng điều khiển nghiệp vụ (Business Controllers)
│   │   ├── personController.js     # Đăng ký, sửa, xóa, xem danh sách, check-in
│   │   └── departmentController.js # Quản lý phòng ban và thành viên phòng ban
│   ├── middlewares/            # Các Middleware lọc request
│   │   └── authMiddleware.js       # Xác thực Token quản trị bảo vệ route riêng tư
│   ├── routes/                 # Định tuyến URL cho ứng dụng
│   │   ├── personRoutes.js         # Routes nhân sự và form đăng ký
│   │   └── departmentRoutes.js     # Routes phòng ban
│   ├── services/               # Tầng dịch vụ cốt lõi (Core Services)
│   │   ├── hanetService.js         # Wrapper gọi API HANET Cloud (OAuth2, Retry, ...)
│   │   ├── queueService.js         # Hàng đợi Bull Queue xử lý đăng ký/cập nhật ngầm
│   │   ├── imageService.js         # Nén và cắt ảnh chuẩn 1280x738 bằng Sharp
│   │   └── csvService.js           # Đọc/ghi và cập nhật ngược dữ liệu vào file CSV
│   ├── utils/                  # Thư viện tiện ích
│   │   └── hanetErrorMap.js        # Từ điển dịch mã lỗi HANET sang tiếng Việt
│   └── views/                  # Giao diện EJS Template
│       ├── layout.ejs              # Khung giao diện dùng chung (Bootstrap 5)
│       ├── links.ejs               # Danh sách link form đăng ký theo từng lớp
│       ├── register.ejs            # Form đăng ký Face ID (Touch/Drag & Zoom Canvas 1280x738)
│       ├── department/             # Views quản trị phòng ban
│       └── person/                 # Views danh sách nhân sự, check-in, form CSV
├── uploads/                    # Thư mục tạm lưu trữ ảnh đã chuẩn hóa trước khi gửi Cloud
├── Dockerfile                  # Cấu hình đóng gói Docker container
├── docker-compose.yml          # Cấu hình chạy ứng dụng và Redis DB 4
└── package.json                # Khai báo dependencies và scripts thực thi
```

---

## 3. CHI TIẾT CÁC MODULE VÀ QUY TẮC FUNCTION

### 3.1. `src/services/hanetService.js` (Giao tiếp HANET Cloud)

Chịu trách nhiệm toàn bộ việc gửi nhận request tới API đối tác `https://partner.hanet.ai`.

| Tên Function | Tham Số | Chức Năng | Ghi Chú Kỹ Thuật |
| :--- | :--- | :--- | :--- |
| `getAccessToken(forceRefresh)` | `forceRefresh: boolean` | Lấy hoặc xoay vòng Access Token qua OAuth2 | Tự động đọc từ `process.env.HANET_ACCESS_TOKEN` hoặc gọi endpoint `/token` |
| `postWithToken(endpoint, data, isRetry)` | `endpoint: string`, `data: object`, `isRetry: boolean` | Gửi HTTP POST với `application/x-www-form-urlencoded` | Tự động bắt lỗi `-103` (Token hết hạn) để refresh và retry 1 lần |
| `registerPerson(data, isRetry)` | `data: object`, `isRetry: boolean` | Đăng ký nhân sự kèm stream tệp ảnh nhị phân | Dùng `multipart/form-data`, timeout 25s, maxBodyLength Infinity |
| `registerPersonByUrl(data)` | `data: object` | Đăng ký nhân sự bằng URL ảnh (`faceUrl`) | Sử dụng khi ảnh đã có trên CDN công khai |
| `updateInfo(data)` | `data: object` | Cập nhật tên, aliasID, title, departmentID | Endpoint: `/person/updateInfo` |
| `updatePersonInfo(personID, name, title, aliasID, departmentID)` | Các tham số rời | Wrapper helper cập nhật thông tin | Tiện ích gọi nhanh `updateInfo` |
| `updateByFaceUrl(data)` | `data: object` | Cập nhật ảnh Face ID qua URL | Endpoint: `/person/updateByFaceUrl` |
| `updatePersonByFaceUrl(personID, faceUrl)` | `personID`, `faceUrl` | Helper cập nhật Face ID | Tự động xử lý cả object hoặc params rời |
| `getListByPlace(options)` | `options: { page, size, fetchAll }` | Lấy danh sách toàn bộ nhân sự tại Place ID (Tự động quét phân trang 100%) | Endpoint: `/person/getListByPlace` |
| `getPersonByAliasID(aliasID, placeID)` | `aliasID: string`, `placeID: string` | Tra cứu chi tiết nhân sự qua mã Alias ID (MSNV) | Endpoint: `/person/getUserInfoByAliasID` |
| `getCheckinByTimestamp(from, to)` | `from: number`, `to: number` | Lấy lịch sử điểm danh theo khoảng thời gian | Endpoint: `/person/getCheckinByPlaceIdInTimestamp` |
| `removePerson(personID)` | `personID: string` | Xóa nhân sự vĩnh viễn trên Cloud HANET | Endpoint: `/person/removePersonByID` |
| `getDepartmentList(page, size, keyword)` | `page, size, keyword` | Lấy danh sách phòng ban tại địa điểm | Endpoint: `/department/list` |
| `createDepartment(name, desc)` | `name: string`, `desc: string` | Tạo mới phòng ban | Endpoint: `/department/create` |
| `updateDepartment(id, name, desc)` | `id, name, desc` | Sửa tên/mô tả phòng ban | Endpoint: `/department/update` |
| `removeDepartment(id)` | `id: string` | Xóa phòng ban | Endpoint: `/department/remove` |
| `getPersonsByDepartment(deptID, page, size)` | `deptID, page, size` | Danh sách nhân sự trong 1 phòng ban | Endpoint: `/department/list-person` |
| `addPersonsToDepartment(deptID, personIDs)` | `deptID`, `personIDs: string\|array` | Gán nhân sự vào phòng ban | Endpoint: `/department/add-person` |
| `removePersonsFromDepartment(deptID, personIDs)` | `deptID`, `personIDs: string\|array` | Gỡ nhân sự khỏi phòng ban | Endpoint: `/department/remove-person` |

---

### 3.2. `src/services/imageService.js` (Xử Lý Ảnh Chuyên Biệt Sharp)

Xử lý chuẩn hóa định dạng ảnh trước khi gửi sang HANET để đảm bảo tỷ lệ nhận diện tối ưu.

| Tên Function | Tham Số | Chức Năng | Quy Tắc Nghiệp Vụ |
| :--- | :--- | :--- | :--- |
| `normalizeImage(inputPath, outputPath)` | `inputPath: string`, `outputPath: string` | Chuẩn hóa ảnh: Xoay EXIF, Cover `1280x738`, Nén JPEG 90% | **BẮT BUỘC:** Mọi ảnh đăng ký phải đạt chuẩn `1280x738`. Tự động xóa `inputPath` nếu khác `outputPath`. |
| `deleteFileSafe(filePath)` | `filePath: string` | Xóa tệp tin an toàn (bọc `try..catch`) | Không làm sập ứng dụng nếu tệp không tồn tại hoặc bị khóa. |
| `processFaceImage(input)` | `input: { filePath, base64String }` | Tiếp nhận ảnh từ Multer hoặc chuỗi Base64 và lưu file chuẩn | Tạo file tên dạng `processed_<timestamp>_<random>.jpg` trong `uploads/`. |
| `cleanup(filePath)` | `filePath: string` | Xóa ngay lập tức tệp tạm | Dùng cho các file lỗi hoặc không sử dụng tiếp. |
| `cleanupDelayed(filePath, delayMs)` | `filePath: string`, `delayMs: number = 30000` | **[RULE-022]** Xóa file sau 30 giây chờ | **QUAN TRỌNG:** Ngăn chặn race condition khi Cloud HANET đang fetch ảnh từ server nội bộ. |
| `cleanOldFiles(maxAgeMs)` | `maxAgeMs: number = 3600000` (1 giờ) | Dọn dẹp các file mồ côi trong `uploads/` | Chạy định kỳ bởi Garbage Collector mỗi 30 phút trong `src/app.js`. |

---

### 3.3. `src/services/csvService.js` (Thao Tác File Danh Mục CSV)

Đọc và ghi dữ liệu ngược về các file CSV danh mục lớp.

| Tên Function | Tham Số | Chức Năng | Quy Tắc An Toàn |
| :--- | :--- | :--- | :--- |
| `normalizeName(name)` | `name: string` | Chuẩn hóa chuỗi: chữ thường, cắt khoảng trắng thừa | Dùng để so sánh tên không phân biệt hoa thường. |
| `getFilePath(fileName)` | `fileName: string` | Trả về đường dẫn tuyệt đối an toàn trong `data/` | Tự động loại bỏ đuôi `.csv` thừa và ngăn path traversal. |
| `readList(fileName)` | `fileName: string` | Đọc toàn bộ danh sách nhân sự từ file CSV | Chuyển đổi các cột CSV sang object chuẩn nội bộ. |
| `appendPerson(fileName, person)` | `fileName: string`, `person: object` | Thêm dòng mới vào cuối file CSV | Giữ nguyên tiêu đề chuẩn 6 cột. |
| `writeBackRegistration(className, personName, avatarUrl, personId, inputTitle)` | `className, personName, avatarUrl, personId, inputTitle` | **Tự động ghi ngược (Write-Back) khi đăng ký Face ID thành công** | **RULE-002:** Nếu tên đã có trong CSV -> cập nhật cột 5 (`links`) và cột 6 (`PersonID`). Nếu tên mới -> thêm dòng tại `Max + 1`, kế thừa Phòng ban & Chức vụ từ dòng cuối. |

---

### 3.4. `src/services/queueService.js` (Hàng Đợi Bull Queue & Xử Lý Ngầm)

Đảm bảo tính tin cậy, tự động retry khi mạng chập chờn, xử lý tự động khi gặp trùng mặt (`-9007`).

| Tên Function / Job | Tham Số | Chức Năng | Quy Tắc Xử Lý |
| :--- | :--- | :--- | :--- |
| `resolveDepartmentAndAlias(className, inputTitle, inputDeptID, inputAlias)` | `className, inputTitle, inputDeptID, inputAlias` | **Chuẩn hóa động Phòng ban, Chức vụ và Alias** | Phân loại chính xác: GLV và Học sinh $\rightarrow$ Dept `990653` (Thiếu Nhi); DMHCCC $\rightarrow$ Dept `990730` (Legiô Mariae); Giới Trẻ $\rightarrow$ Dept `990731`. Sinh alias dạng `TN_<Lớp>_<SUFFIX4>`. |
| `hanetQueue.process('register_person_job')` | `job: Job` | Xử lý Worker đăng ký nhân sự mới ngầm | 1. Đăng ký qua HANET API.<br>2. Nếu thành công: Khóa phòng ban + ghi ngược CSV.<br>3. Nếu gặp mã `-9007` (mặt đã có): Gọi `updateByFaceUrl` + `updatePersonInfo` + khóa phòng ban + ghi ngược CSV.<br>4. Cuối cùng: Gọi `imageService.cleanupDelayed(30000)`. |
| `hanetQueue.process('update_person_job')` | `job: Job` | Xử lý Worker cập nhật thông tin / Face ID ngầm | 1. Cập nhật thông tin cơ bản.<br>2. Đổi phòng ban (nếu có).<br>3. Cập nhật Face URL (nếu có ảnh mới).<br>4. Dọn dẹp trễ 30s (`cleanupDelayed`). |
| `enqueueRegisterPerson(payload)` | `payload: object` | Đẩy công việc đăng ký vào Bull Queue | Cấu hình exponential backoff 5 lần (3s, 6s, 12s, 24s, 48s). |
| `enqueueUpdatePerson(payload)` | `payload: object` | Đẩy công việc cập nhật vào Bull Queue | Xử lý song song tối đa 3 jobs cùng lúc. |

---

## 4. BẢNG MÃ QUY TẮC BẮT BUỘC (SYSTEM RULES)

### 📌 RULE-002: NGUYÊN TẮC AN TOÀN DỮ LIỆU CSV (ONE-WAY ENRICH)
- Khi thực hiện đồng bộ giữa Cloud HANET và file CSV (`data/*.csv`), **tuyệt đối không xóa bỏ bất kỳ dòng dữ liệu nào** trong file CSV nếu người đó chưa xuất hiện trên Cloud.
- Chỉ thực hiện bổ sung (Enrich) các trường còn thiếu (`avatar` URL tại cột 5, `personID` chuỗi 19 số tại cột 6).

### 📌 RULE-022: ĐỘ TRỄ DỌN DẸP ẢNH TẠM (DELAYED CLEANUP 30S)
- Sau khi tiếp nhận và gửi ảnh sang HANET API thành công hoặc thất bại, **luôn giữ file ảnh tạm trong thư mục `uploads/` ít nhất 30 giây (`30,000ms`)** bằng `imageService.cleanupDelayed(...)`.
- *Lý do:* HANET Cloud và các cổng Tunnel (Cloudflare) mất từ 3 - 15 giây để tải file ảnh nhị phân từ máy chủ nội bộ. Xóa file ngay lập tức sẽ gây ra lỗi `INVALID_IMAGE` hoặc không thể tải ảnh.

### 📌 RULE-040: BỎ QUA RETRY VỚI LỖI VĨNH VIỄN (NON-RETRIABLE CODES)
- Trong Queue Worker, danh sách các mã lỗi sau được coi là lỗi tham số hoặc lỗi logic không thể tự phục hồi bằng retry:
  ```javascript
  const NON_RETRIABLE_CODES = new Set([
    -1, -1005, -2035, -5005, -5006, -5010, -5011, -9002, -9005, -9006, -9008
  ]);
  ```
- Khi gặp các mã lỗi này, Worker ghi log chi tiết và dừng job ngay (trả về kết quả lỗi rõ ràng) thay vì retry lặp lại 5 lần gây nghẽn hàng đợi.

### 📌 RULE-041: XỬ LÝ TỰ ĐỘNG KHI GẶP LỖI -9007 (FACE ALREADY REGISTERED)
- Mã lỗi `-9007` xuất hiện khi khuôn mặt đã từng được đăng ký trong hệ thống HANET (dù dưới tên khác hoặc ID cũ).
- **Quy trình xử lý tự động:**
  1. Trích xuất `personID` trả về từ body/catch của response.
  2. Tự động chuyển sang gọi API `updateByFaceUrl(personID, faceUrl)` để cập nhật ảnh Face ID mới nhất.
  3. Gọi `updatePersonInfo(...)` để đồng bộ lại Tên, Chức Vụ, Alias.
  4. Khóa phòng ban bằng `addPersonsToDepartment(...)`.
  5. Ghi đè thông tin `links` và `PersonID` vào file CSV tương ứng.

### 📌 RULE-050: QUY CHUẨN ĐỊNH DANH PHÒNG BAN & ALIAS ID (3 PHẦN NỐI GẠCH DƯỚI)
1. **Cấu trúc chuẩn bắt buộc gồm đúng 3 phần:**
   `[MÃ_PHÒNG_BAN]_[TÊN_LỚP]_[MÃ_ĐỊNH_DANH]`
2. **Quy tắc cho từng thành phần:**
   - **[MÃ_PHÒNG_BAN]:** Viết hoa, không dấu, không khoảng trắng (Ví dụ: `TN` cho Thiếu Nhi/GLV, `LM` cho Legiô Mariae, `GT` cho Giới Trẻ, `GTR` cho Gia Trưởng, `HM` cho Hiền Mẫu).
   - **[TÊN_LỚP]:** Viết hoa toàn bộ không dấu, **loại bỏ hoàn toàn dấu gạch dưới (`_`) và khoảng trắng** (Ví dụ: `ThemSuc_1a` $\rightarrow$ `THEMSUC1A`, `XungToi_2a` $\rightarrow$ `XUNGTOI2A`, `BaoDong_3` $\rightarrow$ `BAODONG3`, `GLV` $\rightarrow$ `GLV`, `DMHCCC` $\rightarrow$ `DMHCCC`).
   - **[MÃ_ĐỊNH_DANH]:** Đúng **4 ký tự ngẫu nhiên** gồm chữ cái in hoa và số `[A-Z0-9]` (Ví dụ: `8XI8`, `4BDI`, `YS03`). Tuyệt đối KHÔNG dùng dạng số thứ tự tuần tự cũ (`0001`, `0012`, `00xx`).
3. **Ví dụ chuẩn đầu ra:**
   - Học sinh lớp Thêm Sức 1A: `TN_THEMSUC1A_4BDI`
   - Học sinh lớp Xưng Tội 2A: `TN_XUNGTOI2A_8XI8`
   - Giáo Lý Viên: `TN_GLV_FNWD`
   - Lêgiô Mariae: `LM_DMHCCC_I2SG`
   - Giới Trẻ: `GT_GIOITRE_9QHS`

### 📌 RULE-060: TIÊU CHUẨN KHUNG ẢNH 1280x738 VÀ TƯƠNG TÁC CANVAS
- Giao diện đăng ký (`src/views/register.ejs`) cung cấp:
  + Nút **"Chụp Ảnh Mới"** (`capture="user"`) và nút **"Tải Ảnh Từ Máy"** (mở Thư viện) độc lập.
  + Khung Canvas tương tác chuẩn tỷ lệ `1280 / 738` có vòng Oval tiêu điểm xanh `#00e676`.
  + Hỗ trợ chạm kéo (Pan/Drag trên Mobile/Zalo/Desktop) và thanh trượt Phóng to/Thu nhỏ (Zoom `1x - 3.5x`).
  + Khi submit, Canvas tự xuất Blob JPEG chất lượng `0.90` với độ phân giải thực tế đúng `1280 x 738`.

---

## 5. HƯỚNG DẪN VẬN HÀNH & SCRIPT BẢO TRÌ

### 5.1. Khởi động môi trường phát triển
```bash
# Cài đặt thư viện
npm install

# Khởi chạy ứng dụng (hỗ trợ nodemon tự reload)
npm run dev
```

### 5.2. Khởi chạy bằng Docker Compose
```bash
# Khởi động đồng thời Web App và Redis DB 4
docker-compose up -d --build
```

### 5.3. Các công cụ đồng bộ dữ liệu
- **Đồng bộ trực tiếp Cloud HANET vào các file CSV (Tối ưu tốc độ qua Cache):**
  ```bash
  node scripts/sync_csv_by_alias.js
  ```
- **Chuẩn hóa hậu tố Alias sang 4 ký tự ngẫu nhiên (A-Z, 0-9):**
  ```bash
  node fixRandomSuffixAlias.js
  ```
- **Sửa và tạo lại các phòng ban bị lỗi phân quyền (403):**
  ```bash
  node scripts/repair_departments.js
  ```

---

> [!TIP]
> Toàn bộ tài liệu này là quy chuẩn kỹ thuật chính thức. Mọi hàm mới được thêm vào hoặc nâng cấp trong tương lai cần tuân thủ đầy đủ các quy tắc **RULE-002**, **RULE-022**, **RULE-040**, **RULE-041**, **RULE-050**, **RULE-060** đã nêu trên.
