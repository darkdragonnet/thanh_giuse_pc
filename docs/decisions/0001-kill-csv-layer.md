# ADR 0001 — PostgreSQL làm tầng dữ liệu vận hành

Ngày biên tập: 2026-10-03.
Trạng thái quyết định: kiến trúc mục tiêu theo CONST-01.
Trạng thái triển khai/di trú: UNVERIFIED; chưa kiểm kê repository đang vận hành.

## Bối cảnh

Bundle mô tả PostgreSQL quản lý lớp/phòng ban/nhân sự nhưng vẫn có hướng dẫn và service CSV cũ. Duy trì nhiều nguồn ghi làm khó kiểm soát transaction, đồng thời và liên kết danh tính.

## Quyết định

- Dùng PostgreSQL cho dữ liệu quan hệ và audit; HANET quản lý nhận diện theo constitution.
- Không dùng data/*.csv làm nguồn đọc/ghi trong luồng vận hành đăng ký/quản trị chính.
- CSV lịch sử chỉ được dùng cho lưu trữ hoặc migration/import có phạm vi riêng: validate, staging, đối soát và ghi transaction vào PostgreSQL. Không khôi phục CSV thành nguồn đồng bộ song song.
- Đánh dấu hướng dẫn duy trì CSV vận hành, gồm nội dung KI-038 cũ, là DEPRECATED. Quyết định Postgres-First vẫn có hiệu lực.

## Thực hiện và nghiệm thu

Kiểm kê import/call site của csvService, jobs, cron và volume; xác định người còn sử dụng trước khi xóa hoặc tắt. Migration phải có mapping định danh, kiểm tra số lượng/quan hệ, phương án lỗi và rollback. Không gộp người chỉ theo tên. Chỉ tuyên bố loại bỏ CSV khỏi runtime khi có bằng chứng call site/test.

Không tự xóa file CSV hoặc volume lịch sử. Việc lưu giữ/xóa phải theo phạm vi và chính sách dữ liệu. Lưu artifact migration có kiểm soát quyền và không đưa dữ liệu cá nhân vào tài liệu công khai.

## Hệ quả

Cần migrations, backup PostgreSQL và kiểm tra phục hồi; các tài liệu/code cũ phải được cập nhật tại nguồn. Tên field source_csv hoặc route tương thích có thể còn tồn tại; tên cũ không tự chứng minh có đọc CSV, phải kiểm tra luồng thực tế.
