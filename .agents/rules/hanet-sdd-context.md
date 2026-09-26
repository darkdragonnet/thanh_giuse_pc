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
- **View / Controller:** Không được `res.redirect` hoặc crash app khi gặp lỗi API 403 từ HANET. Luôn bắt lỗi, gán cờ `permissionError` và render view kèm flash message.
- **So sánh ID:** Luôn ép kiểu `String()` khi so sánh ID từ HANET (number) với form/dropdown (string).
- **Cleanup Ảnh (Queue Worker):** Bắt buộc **delay 30 giây** (`setTimeout` 30000ms) trước khi xóa file ảnh trong `uploads/` để HANET kịp fetch public URL qua Cloudflare.
