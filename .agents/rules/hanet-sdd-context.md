---
trigger: always_on
description: Ngữ cảnh kiến trúc Postgres-First v2.1 — Phân định rõ Single Source of Truth (Postgres sở hữu alias_id/quan hệ, HANET sở hữu person_id/face_url), cơ chế sinh AliasID tự động cho dữ liệu PENDING, và luồng đăng ký Zero-Friction (không nhập liệu).
---

---
name: hanet-sdd-context
description: Ngữ cảnh kiến trúc, cấu trúc module, API HANET và các quy tắc kỹ thuật của dự án HANET Cloud-First thanh_giuse_pc theo bản SDD v2.1. Dùng khi lập trình, sửa bug hoặc viết tính năng mới cho dự án.
---

# Ngữ cảnh Kỹ thuật & SDD — thanh_giuse_pc (v2.1)

## 1. Kiến trúc Cốt lõi & Phân định Source of Truth

### 1.1. PostgreSQL 16 — Single Source of Truth cho Định danh & Quan hệ
- Quản lý tập trung: `departments`, `classes`, `persons`, `audit_logs`, `transfer_snapshots`.
- **Quyền ưu tiên tuyệt đối:**
  - `alias_id` — Mã định danh duy nhất chuẩn 3 phần (UNIQUE constraint).
  - `name`, `class_name`, `department_id`, `title` — Thông tin quan hệ nhân sự.
- **Chiều đồng bộ:** Postgres → HANET Cloud. Khi có sai lệch, **HANET Cloud phải cập nhật theo Postgres** thông qua `POST /person/updateInfo`.

### 1.2. HANET AI Cloud — Single Source of Truth cho Sinh trắc học
- Quản lý Face ID, nhận diện khuôn mặt, lịch sử check-in.
- **Quyền ưu tiên tuyệt đối:**
  - `person_id` — ID sinh trắc học do HANET cấp.
  - `face_url` — URL ảnh khuôn mặt chuẩn do HANET lưu trữ (static.hanet.ai).
- **Chiều đồng bộ:** HANET Cloud → Postgres. Đồng bộ ngược về cột `persons.person_id` và `persons.face_url` sau khi đăng ký thành công.

### 1.3. Triết lý Zero-Friction Registration (Đăng ký không nhập liệu & Xử lý linh hoạt)
- Toàn bộ khung dữ liệu (`name`, `class_name`, `department_id`, `title`, `alias_id`) được tạo sẵn từ PostgreSQL ngay khi import danh mục ban đầu.
- Khi người dùng mở link lớp (`/register/:class_name`), hệ thống render danh sách học sinh đã có sẵn `alias_id`.
- **Người dùng chỉ cần chọn tên hoặc click vào bản ghi của mình + chụp/tải ảnh khuôn mặt** — không phải nhập lại bất kỳ trường văn bản nào.
- **Ngoại lệ (Không có tên trong danh sách):** 
  - Nếu người dùng không tìm thấy tên của mình trong danh sách lớp, cho phép họ nhập tên mới.
  - Khi lưu bản ghi mới với tên vừa nhập:
    - `name`: Lấy tên do người dùng mới nhập.
    - `class_name`: Lấy theo tên lớp của link hiện tại đang truy cập.
    - `department_id` & `title`: Lấy toàn bộ thông tin cấu hình từ bản ghi cuối cùng của lớp đó (hoặc sao chép thông tin của người cuối cùng trong lớp trừ tên).
    - `alias_id`: Tự động sinh mới theo chuẩn quy tắc định danh 3 phần (`RULE-004`).
    - Trạng thái khởi tạo: `PENDING` chờ chụp ảnh và đồng bộ.

## 2. RULE-004 (Mở rộng) — Chuẩn hóa Định danh `alias_id` 3 Phần

### 2.1. Định dạng bắt buộc
[MÃ_PHÒNG_BAN][TÊN_LỚP_KHÔNG_DẤU_VIẾT_HOA][TOKEN_4_KÝ_TỰ]

| Thành phần | Quy tắc | Ví dụ |
| :--- | :--- | :--- |
| **MÃ_PHÒNG_BAN** | Lấy từ cột `departments.code` | `TN`, `LM`, `GT` |
| **TÊN_LỚP** | Loại bỏ dấu tiếng Việt, viết HOA, xóa khoảng trắng & `_` | `THEMSUC1C`, `BAODONG2A`, `VAODOI1` |
| **TOKEN_4_KÝ_TỰ** | Ngẫu nhiên `[A-Z0-9]`, đảm bảo UNIQUE | `YZBW`, `4BDI`, `8XI8` |

**Ví dụ chuẩn:** `TN_THEMSUC1C_YZBW`, `LM_DMHCCC_4BDI`, `GT_GIOITRE_9M1N`.

### 2.2. Quy tắc bắt buộc về xử lý dữ liệu
1. **Không bỏ trống:** Mọi bản ghi `persons` phải có `alias_id` KHÁC NULL trước khi hệ thống cho phép đăng ký ảnh.
2. **Tự động backfill:** Các bản ghi đang có `alias_id IS NULL AND sync_status = 'PENDING'` **phải được tự động sinh mã** qua script batch (chạy một lần) và trigger runtime (mọi lần `INSERT` mới).
3. **Không cắt bớt tên lớp:** Tuyệt đối không viết tắt tên lớp (VD: `TN_THEMSUC1C_YZBW` ✅ — không phải `TN_TS1C_YZBW` ❌).
4. **Duy nhất toàn cục:** Vòng lặp kiểm tra `SELECT id FROM persons WHERE alias_id = $1` phải chạy trước khi `UPDATE`, đảm bảo UNIQUE constraint.

### 2.3. Bảng ánh xạ mã phòng ban chuẩn
| Mã | Tên Phòng Ban | Ưu tiên Prefix |
| :---: | :--- | :---: |
| `990653` | Thiếu Nhi | `TN` |
| `990730` | Legiô Mariae | `LM` |
| `990731` | Giới Trẻ | `GT` |
| `990732` | Gia Trưởng | `GTR` |
| `990733` | Hiền Mẫu | `HM` |

## 3. Quy tắc Đồng bộ & Cập nhật mã lên HANET Cloud

### 3.1. Khi cập nhật `alias_id` lên HANET
- **Bước 1:** Gọi `POST /person/updateInfo` với field `aliasID`, `name`, `title`, `departmentID`.
- **Bước 2:** Gọi ngay `POST /department/add-person` (`departmentID`, `personIDs`) để **khóa phòng ban không bị reset về 0** sau khi update.
- **Bước 3:** Cập nhật `sync_status = 'SYNCED'` và `updated_at = NOW()` vào PostgreSQL.

### 3.2. Khi gặp lỗi `-9007` (Khuôn mặt đã tồn tại)
Áp dụng **Fail-Soft có kiểm soát**:
1. Chỉ coi là thành công sau khi xác minh đúng người, trích xuất được `personID` hợp lệ từ payload lỗi và lưu kết quả thành công vào DB.
2. Nếu chưa rõ danh tính hoặc không khớp đối soát, hệ thống phải giữ trạng thái chờ xử lý, tuyệt đối không tự động gán bừa.
3. Trình tự xử lý: Gọi `updateByFaceUrl` để ghi đè ảnh mới -> Gọi `updateInfo` đồng bộ thông tin -> Gọi `addPersonsToDepartment` khóa phòng ban -> Cập nhật `person_id`, `face_url`, `sync_status = 'SYNCED'` vào PostgreSQL.
4. **KHÔNG throw error** làm fail Bull Queue job khi đã xử lý fallback thành công.

### 3.3. Nguyên tắc ưu tiên khi xung đột dữ liệu & Cập nhật thông tin
| Tình huống / Thông tin cập nhật | Xử lý |
| :--- | :--- |
| **Phòng ban, Chức vụ, Alias ID, Tên** (Khi cập nhật lên HANET Cloud) | Luôn lấy `person_id` làm chuẩn so sánh. **Nếu chưa có `person_id` (chưa có ảnh, chưa đăng ký) thì không cập nhật lên HANET Cloud**. |
| **Face URL, Person ID** (Khi cập nhật vào PostgreSQL) | Lấy theo khóa `alias_id` và `face_url` để mapping dữ liệu chính xác vào bảng `persons`. |
| `alias_id` Postgres khác HANET | Đẩy `alias_id` Postgres lên HANET (Postgres thắng) |
| `name` Postgres khác HANET | Đẩy `name` Postgres lên HANET (Postgres thắng) |
| `person_id` HANET có, Postgres NULL | Ghi `person_id` từ HANET vào Postgres (HANET thắng) |
| `face_url` HANET mới hơn Postgres | Ghi đè `face_url` HANET vào Postgres (HANET thắng) |

## 4. API HANET Bắt buộc (Tránh bẫy Doc sai)
- **Cập nhật/Xóa phòng ban** (`update`, `remove`):
  - ❌ **KHÔNG** dùng field: `departmentID`
  - ✅ **BẮT BUỘC** dùng thay thế: `id` (tên trường/field name truyền lên API)
  - *Ví dụ Payload chuẩn khi gọi API cập nhật phòng ban:*
    ```json
    {
      "id": "990653",
      "name": "Thiếu Nhi"
    }
    ```
- **Gỡ nhân sự khỏi phòng** (`remove-person`): Dùng field `personID` (số ít), **KHÔNG** dùng `personIDs`.
- **Place ID:** Luôn đọc động qua getter `process.env.HANET_PLACE_ID`, không cache trong constructor.
- **So sánh ID:** Luôn ép `String()` trước khi so sánh giữa number (từ Cloud) và string (từ form).
- **Đối chiếu hàm thực tế:** Tài liệu nhà cung cấp có thể gọi là `updatePersonByFaceUrl`, nhưng mã nguồn thực tế sử dụng hàm wrapper `updateByFaceUrl`. Cần kiểm chứng qua test hợp đồng tương ứng.

## 5. Quy tắc Code & Xử lý Lỗi (Fail-Soft)
- **Xử lý lỗi -9007:** Áp dụng Fail-Soft sau khi đã kiểm chứng định danh thành công.
- **RULE-008:** Mọi URL ảnh từ CSV/form phải qua `sanitizeFaceUrl()` để loại bỏ Markdown `[url](url)`.
- **RULE-009 & Chuẩn hóa Alias:** Bảo toàn `alias_id` hiện hữu, không tự động đổi mã khi retry hoặc xử lý ngầm.
- **RULE-022 (Quản lý file ảnh tạm):** Tuyệt đối không xóa ảnh khi còn job trong hàng đợi cần sử dụng. Khoảng chờ tối thiểu 30 giây chỉ tính sau khi các bước sử dụng ảnh hoàn tất; thư mục DLQ phải bảo toàn đường dẫn file hợp lệ (`dlq_`).
- **Quản lý Dữ liệu Lịch sử (CSV):** Toàn bộ kiến thức liên kết file CSV cũ được tách biệt hoàn toàn sang tài liệu migration/lịch sử, không đưa vào luồng nghiệp vụ vận hành thực tế (tuân thủ triệt để Postgres-First).
- **RULE-026:** Không hiển thị mã lỗi thô (`-9002`, `-9005`, `-9006`,...) — dịch qua từ điển tiếng Việt `src/utils/hanetErrorMap.js` sau khi kiểm chứng phản hồi đã ẩn dữ liệu nhạy cảm.
- **Zero-Friction:** Không được `res.redirect` khi gặp lỗi API 403 từ HANET. Bắt lỗi, gán cờ `permissionError`, render view kèm flash message.