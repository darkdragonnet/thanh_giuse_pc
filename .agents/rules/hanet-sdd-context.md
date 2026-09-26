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
