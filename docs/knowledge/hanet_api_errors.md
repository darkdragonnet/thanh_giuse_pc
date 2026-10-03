# KI-001 — Mã lỗi HANET

Trạng thái: UNVERIFIED. Ngày biên tập: 2026-10-03; chưa có ngày kiểm chứng.

## Phạm vi và nguồn hiện có

Các bảng mã trong bundle gán nghĩa khác nhau cho -9002/-9005/-9006. Không phát hành bảng “chính thức” dựa trên các mô tả này.

Nguồn tham khảo: project_full_bundle.md do người dùng cung cấp và các tài liệu dự án đã soạn. Chưa có log chạy, test report hoặc commit hiện hành để xác nhận triển khai/hợp đồng.

## Quy trình xác minh và yêu cầu đối chiếu

Thu thập endpoint, HTTP status, returnCode, schema phản hồi, thời điểm và môi trường; ẩn token/ảnh/danh tính. Đối chiếu tài liệu nhà cung cấp và test hợp đồng. Chuẩn hóa mã kiểu số/chuỗi; phân loại retry, permanent, đối soát sau khi có bằng chứng. Dịch thông báo người dùng riêng với mã/log nội bộ.

## Bằng chứng cần bổ sung

- Phát biểu cụ thể được kiểm tra và yêu cầu/CONST liên quan.
- Phiên bản code, môi trường, thời điểm, lệnh hoặc thao tác thực tế.
- Input tổng hợp, kỳ vọng, kết quả thực và artifact/log đã ẩn dữ liệu nhạy cảm.
- Kết luận giới hạn theo từng phát biểu; phần chưa kiểm chứng giữ UNVERIFIED.

Không thay trạng thái chỉ vì đã viết xong tài liệu hoặc đọc thấy một tên hàm trong code.
