---
name: register-flow-review
description: Rà soát luồng đăng ký và cập nhật Face ID từ form, route, PostgreSQL, queue đến HANET. Dùng khi kiểm tra hoặc thay đổi đăng ký mới, thay ảnh, alias, phân quyền, retry, DLQ và đồng bộ trạng thái.
---

# Register Flow Review

## Đầu vào

Đọc AGENTS.md, constitution, spec/plan/tasks đang áp dụng và knowledge liên quan. Xác định các file thực tế bằng tìm kiếm trong repository: views đăng ký chung/theo lớp, routes, controller, image/queue/HANET/idempotency services, schema, migrations và tests.

Không giả định tên hoặc vị trí view. Nếu thiếu file, ghi rõ giới hạn và tiếp tục rà soát phần có bằng chứng. Không suy luận frontend an toàn từ controller.

## Quy trình rà soát

1. **Lập bản đồ dữ liệu:** Theo dõi actor/quyền, hồ sơ nội bộ, alias, Cloud ID, request ID, phiên bản yêu cầu và ảnh qua từng tầng. Tách đăng ký người mới, bổ sung ảnh người có sẵn và thay ảnh đã đăng ký.
2. **Form và route:** Kiểm tra tên rỗng, gửi lặp, lỗi upload, loại/kích thước ảnh, trạng thái bất đồng bộ và quyền xem kết quả. Trường readonly/hidden không phải kiểm soát quyền. Xác minh cơ chế bảo vệ request phù hợp mô hình xác thực; không coi việc route công khai là quyền sửa hồ sơ.
3. **Backend và DB:** Xác minh quyền trên bản ghi đích và phạm vi lớp/phòng ban. Không gộp người theo tên. Không lấy chức vụ/phòng ban mặc định từ bản ghi cuối lớp. Nếu cho tạo người ngoài danh sách, phải có quy tắc được chốt và nguồn cấu hình lớp/phòng ban phía server.
4. **Alias và concurrency:** Kiểm tra alias chỉ sinh một lần, constraint duy nhất, xử lý va chạm không ghi đè, duplicate request và yêu cầu thay ảnh mới. Kiểm tra worker cũ không ghi đè phiên bản mới.
5. **Ảnh:** Đối chiếu EXIF/định dạng/kích thước với cấu hình ảnh được chấp nhận. Cấu hình 1280x738, contain, JPEG 90 trong bundle là baseline cần kiểm tra, không phải bằng chứng HANET chấp nhận. Kiểm tra cleanup cả worker, timer, GC và DLQ; kiểm tra ảnh gốc/temp cũng có chính sách giữ/dọn.
6. **Tiếp nhận và enqueue:** Cho phép ghi PENDING trước Cloud theo Postgres-First. Kiểm tra commit DB và enqueue có cơ chế phục hồi; Redis lỗi không để yêu cầu biến mất hoặc treo vô hạn.
7. **HANET và -9007:** Kiểm tra HTTP lẫn returnCode, định danh, scope và quyền. Không coi khớp alias do client gửi là bằng chứng đủ. Không rõ danh tính thì đối soát; cập nhật đúng các trường nằm trong yêu cầu.
8. **Thành công và phục hồi:** Chỉ SYNCED khi đủ điều kiện CONST-03. Kiểm tra DB lỗi sau Cloud, timeout chưa rõ kết quả Cloud, rowCount sai, retry và replay DLQ. Không đăng ký lại mù quáng.
9. **Kiểm tra:** Đối chiếu từng REG với code và test; phân biệt static, mock, tích hợp và kiểm tra thiết bị. Chỉ chạy thao tác trong phạm vi đã được phép; dùng dữ liệu tổng hợp cho thử nghiệm.

## Báo cáo

Lập ma trận: tầng → REG/CONST → file/vị trí → bằng chứng → phát hiện → mức độ → hướng sửa → kiểm tra cần có. Mỗi phát hiện phải có điều kiện xảy ra và hậu quả; nếu chưa đủ nguồn, ghi UNVERIFIED.

Nếu có nguy cơ sửa trái quyền hoặc mất dữ liệu, không tiếp tục thao tác ghi/thử nghiệm gây rủi ro. Tiếp tục khảo sát chỉ đọc và báo cáo phần bị chặn. Không dừng toàn bộ cuộc rà soát ngay khi gặp lỗi đầu tiên.

Skill này rà soát và đề xuất. Chỉ sửa code khi yêu cầu người dùng cho phép; chỉ đánh dấu test đạt khi đã chạy và có kết quả.
