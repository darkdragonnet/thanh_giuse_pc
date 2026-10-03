# Feature Specification — Register Integrity

Ngày biên tập: 2026-10-03. Trạng thái: DRAFT — còn câu hỏi chặn triển khai.
Tham chiếu: CONST-01 đến CONST-06 trong `.specify/memory/constitution.md`.

## Mục tiêu và phạm vi

Bảo toàn danh tính, quyền cập nhật và ảnh trong đăng ký Face ID; chống thành công giả; phục hồi yêu cầu qua lỗi DB/Redis/HANET. Bao gồm đăng ký chung/theo lớp trên Web/Zalo, thay ảnh được cấp quyền, worker và giao diện trạng thái. Ngoài phạm vi: đổi hạ tầng VPS, thuật toán nhận diện, chấm công/check-in và refactor không phục vụ các yêu cầu dưới đây.

## Các tình huống người dùng

- Người được phép đăng ký nhận xác nhận tiếp nhận và theo dõi kết quả cuối, kể cả khi xử lý ngầm chậm.
- Người được phép thay ảnh cho đúng hồ sơ có thể tạo yêu cầu mới mà không bị khóa của lần trước chặn.
- Người vận hành có quyền đối soát/replay xử lý yêu cầu chưa xác định được danh tính hoặc kết quả Cloud, có audit và không gộp người tùy tiện.

## Yêu cầu và nghiệm thu

| Mã | Yêu cầu | Tiêu chí nghiệm thu |
| --- | --- | --- |
| REG-001 | Xác minh quyền trên đúng hồ sơ/lớp/phòng ban ở backend | Đổi alias/ID trong request không cho sửa hồ sơ người khác; DB và Cloud không có tác động trái quyền. Quyền xem trạng thái cũng được kiểm tra. |
| REG-002 | Giữ alias ổn định | Alias có chữ thường hoặc hậu tố 00XX vẫn nguyên qua enqueue/retry; va chạm alias mới không ghi đè bản ghi khác. |
| REG-003 | -9007 chỉ thành công có điều kiện | Không rõ người, thiếu ID hoặc thiếu quyền không SYNCED/COMPLETED; đúng người và quyền thì hoàn tất các bước bắt buộc, commit đúng DB mới thành công. |
| REG-004 | Không gộp người trùng tên | Hai người trùng tên trong cùng lớp giữ hai hồ sơ riêng; nếu được phép tạo mới thì không tái sử dụng hồ sơ chỉ vì trùng tên. |
| REG-005 | Phục hồi sau lỗi từng phần | Cloud thành công nhưng DB lỗi, hoặc timeout chưa rõ kết quả, phải được đối soát; không hoàn tất giả và không đăng ký thêm người một cách mù quáng. |
| REG-006 | Phân biệt gửi trùng và yêu cầu mới | Gửi lại cùng request không lặp tác động; request thay ảnh mới hợp lệ được tiếp nhận. Job phiên bản cũ không ghi đè kết quả mới. |
| REG-007 | Giữ ảnh cho mọi tác vụ còn cần | Retry trên 30 giây, worker đang chạy và GC đồng thời không làm mất ảnh cần dùng. Chỉ dọn sau khi đủ điều kiện và hết khoảng chờ tối thiểu. |
| REG-008 | DLQ replay đúng ảnh | Replay đọc được đúng nội dung ảnh đã bảo toàn, kể cả gián đoạn giữa rename và cập nhật tham chiếu. Ảnh hết hạn không được replay như ảnh hợp lệ. |
| REG-009 | Tiếp nhận bền vững khi Redis lỗi | Nếu DB chưa nhận bền vững, báo không tiếp nhận; nếu đã commit, giữ request để tự enqueue lại và trả cùng mã theo dõi. Không bỏ quên PENDING hoặc yêu cầu người dùng tạo bản ghi trùng. |
| REG-010 | Trạng thái UI chính xác | Thể hiện đã tiếp nhận/đang xử lý/thành công/lỗi cần xử lý; phân biệt retry, cần đối soát và lỗi kết thúc bằng chi tiết thích hợp. Reload vẫn lấy đúng trạng thái và không lộ hồ sơ khác. |

## Các nguyên tắc đã xác định

- Kiểm tra khớp Cloud ID với hồ sơ là cần thiết nhưng chưa đủ: phải kiểm tra quyền của người gửi và scope.
- Không sao chép department/title từ “bản ghi cuối lớp”. Thứ tự bản ghi không thể hiện chính sách phân quyền hay cấu hình mặc định.
- Không có tên trong danh sách khác với không nhập họ tên. Họ tên rỗng không hợp lệ. Tạo hồ sơ ngoài danh sách chỉ được hỗ trợ khi chính sách này được chốt.
- Trạng thái chờ đối soát phải được biểu diễn rõ trong dữ liệu/UI; không dùng PENDING vô hạn để che giấu vấn đề.

## Câu hỏi cần clarify

| ID | Quyết định còn thiếu | Phần bị chặn |
| --- | --- | --- |
| Q-01 | Đăng ký công khai xác minh quyền sửa hồ sơ bằng cơ chế nào: phiên đăng nhập, token liên kết hồ sơ, hay duyệt quản trị? Quyền xem status đi theo cơ chế nào? | REG-001, REG-003, REG-010 |
| Q-02 | Có cho tự thêm người ngoài danh sách không; ai được phép; lấy mặc định chức vụ/phòng ban từ cấu hình nào? | Nhánh tạo người mới, REG-004 |
| Q-03 | Vai trò nào được đối soát liên kết Cloud chưa có trong DB; bằng chứng nào được chấp nhận; được phép sửa những trường nào? | REG-003, REG-005, REG-008 |
| Q-04 | Thời hạn giữ ảnh/DLQ, giới hạn retry, thời hạn cảnh báo request bị kẹt và quyền replay là bao nhiêu? | REG-005, REG-007, REG-008, REG-009 |

Mỗi câu trả lời phải ghi quyết định, nguồn/ngày và phần tài liệu được cập nhật. Không tự đánh dấu các câu hỏi này đã chốt.
