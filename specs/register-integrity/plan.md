# Implementation Plan — Register Integrity

Trạng thái: PROPOSED / BLOCKED cho các phần phụ thuộc Q-01 đến Q-04. Đây là thiết kế đề xuất, chưa triển khai hoặc xác minh trên repository hiện tại.

## 1. Kiến trúc đề xuất

Giữ Node/Express/EJS, PostgreSQL, Bull/Redis và HANET theo baseline dự án. Kiểm tra package/schema hiện tại trước khi chọn cú pháp hoặc dependency. Dùng PostgreSQL làm nơi lưu bền vững yêu cầu và outbox để không mất yêu cầu khi Redis lỗi.

Luồng: kiểm tra quyền và dữ liệu → lưu ảnh có định danh ổn định → transaction ghi request, thay đổi hồ sơ hợp lệ và outbox → commit → phản hồi đã tiếp nhận → dispatcher enqueue → worker xử lý/đối soát Cloud → transaction ghi kết quả đúng phiên bản → cập nhật trạng thái → dọn ảnh khi đủ điều kiện.

Không giữ transaction DB mở suốt request mạng tới HANET. Enqueue lặp là có thể xảy ra; worker phải xử lý idempotent bằng định danh request bền vững.

## 2. Dữ liệu và trạng thái đề xuất

Tên bảng/cột sau là đề xuất, phải đối chiếu schema và tạo migration:

- `registration_requests`: request_id, người/phạm vi được cấp quyền, person nội bộ, alias bất biến, loại thao tác, version, idempotency key, payload hash, image_ref, trạng thái, kết quả Cloud, last_error, timestamps.
- `registration_outbox`: sự kiện chờ enqueue, request_id, số lần thử, lease và thời điểm gửi. Dispatcher phục hồi lease hết hạn; ghi nhận gửi không loại bỏ khả năng queue nhận lặp.
- Metadata ảnh bền vững: đường dẫn hiện tại, checksum, các request tham chiếu, thời điểm đủ điều kiện dọn, hạn lưu giữ và trạng thái di chuyển/dọn.
- Giữ `persons.sync_status` tương thích trước migration. Không tự ghi trạng thái mới vào cột cũ. Request có thể có trạng thái đề xuất ACCEPTED, PROCESSING, RETRY_WAIT, REVIEW_REQUIRED, SUCCEEDED, FAILED_FINAL, EXPIRED; chuẩn hóa mapping trong migration/UI sau clarify.

`persons.sync_status` biểu diễn phiên bản hồ sơ đang có hiệu lực. Kết quả request cũ không được làm hồ sơ mới chuyển sai sang SYNCED/FAILED. Dùng version check và khóa theo hồ sơ để tuần tự hóa thay đổi cùng người, kể cả tác động trên Cloud; chỉ version check khi ghi DB là chưa đủ.

## 3. Quyền và validation — REG-001, REG-004

Chốt Q-01/Q-02 trước khi triển khai quyền. Xác minh bản ghi đích ở backend, scope lớp/phòng ban, loại thao tác và quyền xem status/replay. Không dựa vào hidden field, alias hay khớp tên. Validate tên, lớp tồn tại, giới hạn upload và cấu hình department/title phía server. Trường hợp người mới dùng flow riêng, không chọn record cuối lớp.

## 4. Alias và idempotency — REG-002, REG-006

Dùng alias đã lưu; chỉ sinh alias cho hồ sơ mới. Unique constraint bắt va chạm rồi sinh lại có giới hạn. Idempotency key gắn actor/scope và request; cùng key + cùng payload trả cùng request, cùng key + payload khác báo xung đột. Request thay ảnh mới có định danh/version riêng. Khóa có owner token, gia hạn khi cần và chỉ owner được giải phóng. Tác vụ cùng hồ sơ được tuần tự hóa để tránh Cloud bị ghi ngược bởi request cũ.

## 5. Worker và hợp đồng HANET — REG-003, REG-005

Đối chiếu hàm thực tế trong hanetService; không tự giả định tồn tại updatePersonByFaceUrl. Chọn register cho tạo mới, update cho người đã có Cloud ID và đủ quyền. Chuẩn hóa phản hồi HTTP/returnCode theo hợp đồng đã xác minh.

- -9007: trích ID → kiểm tra scope/liên kết/quyền → chỉ cập nhật các trường thuộc yêu cầu → xác nhận kết quả → commit DB.
- ID thiếu/chưa rõ/thuộc người khác: REVIEW_REQUIRED, không tự ghi đè.
- Timeout chưa rõ Cloud có tạo người không: tra cứu/đối soát bằng định danh ổn định trước khi thử tạo mới.
- Cloud thành công, DB lỗi: không trả hoàn tất; giữ checkpoint khi có thể. Nếu chết trước khi lưu checkpoint, recovery phải đối soát Cloud theo định danh ổn định. Hợp đồng tra cứu chưa xác minh là blocker của recovery này.
- Kiểm tra đúng person, version, rowCount và commit trước SUCCEEDED/COMPLETED.

## 6. Ảnh và DLQ — REG-007, REG-008

Kiểm tra baseline ảnh EXIF, HEIC/JPEG và cấu hình Sharp bằng tests. Lưu ảnh bền vững trước ghi tham chiếu; dọn file mồ côi theo policy khi DB chưa nhận yêu cầu.

Tất cả cleanup/GC kiểm tra tham chiếu và trạng thái. Chỉ lên lịch sau khi không còn consumer và Cloud hoàn tất theo hợp đồng; trước khi xóa phải kiểm tra lại, kể cả đã qua 30 giây.

Đổi tên dlq_ đi kèm metadata chuyển trạng thái, cập nhật tham chiếu và cơ chế reconcile nếu crash. Không dùng transfer_snapshots làm kho ảnh DLQ. Replay xác minh file/checksum/quyền/hạn giữ và liên kết Cloud; request đã thành công không bị replay tạo tác động mới. Chốt Q-04 trước khi cho phép dọn ảnh theo thời hạn.

## 7. Tiếp nhận và giao diện — REG-009, REG-010

DB commit thành công thì trả request ID để theo dõi, dù Redis tạm mất kết nối. DB chưa commit thì trả lỗi tiếp nhận, không báo đang xử lý. Dispatcher có retry và cảnh báo request kẹt theo ngưỡng đã chốt.

Endpoint status kiểm tra quyền. EJS/WebView đọc trạng thái bền vững bằng polling có giới hạn/backoff hoặc cơ chế tương đương; flash ban đầu chỉ nói đã tiếp nhận. Kiểm tra reload, lỗi mạng, timeout và request bị đối soát, không chỉ kiểm tra render một flash message.

## 8. Migration, rollback và kiểm tra

Kiểm kê duplicate/null alias và liên kết person_id trước thêm constraint; không tự gộp bản ghi theo tên. Migration/additive rollout phải giữ worker cũ không nhận payload mới không tương thích. Ghi kế hoạch chuyển worker, phục hồi request đang chạy và rollback ứng dụng; không rollback DB bằng cách xóa request/outbox đã nhận hoặc giả định hoàn tác Cloud.

Thực hiện test hồi quy, tích hợp PostgreSQL/Redis trong môi trường tách biệt và HANET giả lập lỗi. Test hợp đồng HANET cần môi trường được phép và dữ liệu tổng hợp. Camera/Zalo kiểm tra riêng trên thiết bị; camera check-in production không phải điều kiện bắt buộc để chứng minh hợp đồng API đăng ký.

## 9. Điều kiện thông qua

Q-01..Q-04 đã chốt; hợp đồng Cloud cần cho recovery đã có bằng chứng; migrations/traceability/tests đầy đủ; analyze không còn blocker. Chưa đáp ứng thì chỉ khảo sát hoặc làm phần độc lập được phép.
