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