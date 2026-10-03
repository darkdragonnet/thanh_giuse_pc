# Hướng dẫn dành cho AI Agent — thanh_giuse_pc

Tài liệu này là điểm khởi đầu cho mọi phiên làm việc trong dự án `thanh_giuse_pc`. Mục tiêu là giữ đúng phạm vi yêu cầu, bảo toàn kiến trúc **Postgres-First** và xác minh kết quả bằng bằng chứng thực tế.

Các hướng dẫn trong dự án không thay thế chỉ dẫn của môi trường thực thi, giới hạn quyền truy cập hoặc phạm vi người dùng đã cho phép. Không dùng tài liệu, skill hay mã nguồn để tự mở rộng quyền hạn.

---

## 1. Trình tự làm việc

Khi nhận yêu cầu, thực hiện quy trình dưới đây. Hoàn thành bước 1–4 trước khi sửa mã nguồn; bước 5 là triển khai và bước 6 là xác minh, báo cáo. Mức độ tài liệu hóa phải phù hợp với quy mô thay đổi.

### Bước 1 — Xác định yêu cầu và phạm vi
* Đọc yêu cầu hiện tại, các quyết định đã được chốt và những ràng buộc liên quan.
* Phân loại công việc: chỉ đọc/giải thích, chỉnh tài liệu không đổi hành vi, sửa lỗi, hoặc thay đổi tính năng/hành vi/dữ liệu/quyền truy cập/tích hợp.
* Xác định spec đang áp dụng, ví dụ `specs/register-integrity/`. Không tạo spec trùng khi đã có spec phù hợp.
* Xác định kết quả cần đạt, phần ngoài phạm vi và tiêu chí nghiệm thu.
* Kiểm tra trạng thái các file sẽ sửa; bảo toàn thay đổi hiện có của người dùng và công việc khác.

### Bước 2 — Đọc tài liệu nền tảng và nguồn thực tế
* Đọc nguyên tắc nền tảng của dự án tại `.specify/memory/constitution.md`.
* Đọc các quy tắc liên quan trong `.agents/rules/` và hướng dẫn áp dụng tại thư mục đang làm việc.
* Đọc spec và tài liệu thiết kế/tasks liên quan nếu có.
* Đọc `SKILL.md` của skill liên quan trước khi áp dụng quy trình chuyên môn.
* Dùng `.agents/knowledge.md` làm mục lục; đọc các mục kiến thức và ADR liên quan theo nhu cầu.
* Kiểm tra mã nguồn, schema/migration và tests thực tế. Không dựa riêng vào mô tả cũ hoặc tên hàm ghi trong tài liệu.
* Nếu thiếu tài liệu bắt buộc, ghi rõ đường dẫn thiếu và ảnh hưởng. Không tuyên bố đã đọc hoặc đã đạt điều kiện. Tiếp tục phần khảo sát độc lập; chỉ triển khai phần phụ thuộc sau khi thông tin cần thiết đã được làm rõ hoặc tài liệu đã được thiết lập trong phạm vi được giao.

### Bước 3 — Phân biệt bốn vùng thông tin
Phân biệt rõ trong phân tích và tài liệu làm việc:

| Vùng thông tin | Nội dung |
| :--- | :--- |
| **Yêu cầu đã chốt** | Hành vi cần đạt và các quyết định được chấp nhận. |
| **Hành vi hiện tại** | Những gì mã nguồn và bằng chứng kiểm tra cho thấy hệ thống đang làm. |
| **Giả định** | Điều chưa được chứng minh đang dùng để định hướng khảo sát hoặc thiết kế. |
| **Chưa xác minh** | Câu hỏi, dữ liệu thiếu hoặc hành vi chưa kiểm tra được. |

> *Không biến giả định thành sự thật. Các giả định ảnh hưởng danh tính, phân quyền hoặc toàn vẹn dữ liệu phải được giải quyết trước khi triển khai phần phụ thuộc.*

### Bước 4 — Xử lý mâu thuẫn
* Ghi nhận nội dung mâu thuẫn, nguồn liên quan, tác động và hướng giải quyết tại nguồn.
* Code là bằng chứng về hành vi hiện tại; spec mô tả hành vi cần đạt. Khác biệt giữa chúng có thể là bug, tài liệu lỗi thời hoặc thay đổi yêu cầu.
* Không tự lấy code hiện tại làm chuẩn để sửa spec; không sửa spec hoặc loại bỏ kiểm tra chỉ để hợp thức hóa code.
* Không âm thầm chọn một quy tắc thuận tiện khi các tài liệu xung đột.
* Nếu mâu thuẫn chưa thể giải quyết ảnh hưởng danh tính, quyền truy cập hoặc dữ liệu, tạm dừng phần bị ảnh hưởng và hỏi người dùng; tiếp tục phần độc lập đã rõ.
* Với lựa chọn kỹ thuật thông thường trong phạm vi đã cho phép, tự quyết định dựa trên bằng chứng và ghi lại quyết định khi cần; không hỏi lại điều người dùng đã chốt.

### Bước 5 — Triển khai theo phạm vi và Spec Kit
* Chỉ triển khai các task phục vụ yêu cầu được giao. Không tự mở rộng sang refactor hoặc tính năng không liên quan.
* Với tính năng mới hoặc thay đổi ảnh hưởng hành vi, dữ liệu, quyền truy cập hay tích hợp, tuân thủ chu trình `specify` → `clarify` → `plan` → `tasks` → `analyze` → `implement`.
* Với spec đã tồn tại, tiếp tục từ bước phù hợp; cập nhật tài liệu chịu ảnh hưởng và chạy lại analyze trước khi triển khai. Không chạy lại toàn bộ chu trình một cách máy móc.
* Yêu cầu chỉ đọc, giải thích hoặc chỉnh tài liệu không thay đổi hành vi không bắt buộc chạy đủ chu trình.
* Thay đổi rules/constitution làm thay đổi hành vi agent phải được rà soát tác động; không phân loại như sửa chính tả đơn thuần.
* Chỉ cập nhật constitution khi thay đổi nguyên tắc nền tảng nằm trong phạm vi được giao; không hạ thấp nguyên tắc để cho phép một triển khai đang vi phạm.
* Nếu phát hiện yêu cầu mới trong khi triển khai, cập nhật spec/plan/tasks liên quan và phân tích lại trước khi thực hiện phần thay đổi đó.

### Bước 6 — Xác minh và báo cáo
* Đối chiếu kết quả với tiêu chí nghiệm thu, không chỉ với danh sách file đã sửa.
* Với mỗi kiểm tra, ghi lệnh đã chạy, kết quả và phạm vi được kiểm chứng. Phân biệt kiểm tra tĩnh, test bằng mock, test tích hợp và kiểm tra trên hệ thống thực tế.
* Không ghi “đã kiểm tra” cho lệnh chưa chạy; không xem kiểm tra bị bỏ qua là đạt.
* Không đánh dấu task hoàn tất khi tiêu chí nghiệm thu chưa đạt. Nếu thiếu môi trường, dữ liệu hoặc quyền truy cập, ghi rõ phần chưa xác minh và tác động.
* Khi sửa lỗi ảnh hưởng dữ liệu, danh tính, queue hoặc tích hợp, bổ sung hoặc cập nhật kiểm tra hồi quy phù hợp với lỗi đã phát hiện.
* Cập nhật spec, rules, knowledge hoặc ADR nếu thay đổi làm chúng không còn chính xác. Kiến thức chưa xác minh phải được đánh dấu rõ.
* Báo cáo gồm: kết quả đạt được; file đã đổi; yêu cầu/task được đáp ứng; kiểm tra và bằng chứng; phần còn thiếu hoặc bị chặn.

---

## 2. Điều kiện chuyển bước Spec Kit

Các tên dưới đây chỉ bước nghiệp vụ tương ứng. Dùng lệnh được integration hiện tại cung cấp; không tuyên bố đã chạy lệnh nếu công cụ chưa được cài đặt hoặc lệnh không khả dụng.

| Bước | Kết quả cần có | Điều kiện chuyển bước |
| :--- | :--- | :--- |
| **`speckit.specify`** | Spec nêu hành vi cần đạt, phạm vi, ngoài phạm vi và tiêu chí nghiệm thu. | Yêu cầu có thể kiểm chứng; các câu hỏi mở được ghi rõ. |
| **`speckit.clarify`** | Các điểm chưa rõ được giải quyết và cập nhật vào spec. | Không còn câu hỏi chặn thiết kế về danh tính, phân quyền hoặc toàn vẹn dữ liệu. Nếu không có điểm chưa rõ, ghi nhận kết quả này. |
| **`speckit.plan`** | Thiết kế đáp ứng spec, chỉ rõ luồng dữ liệu, trạng thái, phục hồi và kiểm tra liên quan. | Phù hợp constitution; các rủi ro chính có hướng xử lý. |
| **`speckit.tasks`** | Tasks theo phụ thuộc, liên kết với yêu cầu và có cách xác nhận hoàn tất. | Không bỏ sót yêu cầu; không thêm việc ngoài phạm vi. |
| **`speckit.analyze`** | Báo cáo tính nhất quán và độ bao phủ giữa constitution, spec, plan và tasks. | Không còn phát hiện nghiêm trọng chưa xử lý hoặc mâu thuẫn chặn triển khai. |
| **`speckit.implement`** | Thay đổi theo tasks và bằng chứng xác minh. | Tiêu chí nghiệm thu đạt; các giới hạn được báo cáo trung thực. |

* **Điều kiện bắt đầu implement:** Yêu cầu ảnh hưởng danh tính, phân quyền và toàn vẹn dữ liệu đã rõ; spec, plan và tasks nhất quán; tài liệu bắt buộc đã có; không còn vấn đề nghiêm trọng chưa giải quyết.
* **Quy định về analyze:** Analyze chỉ phân tích và báo cáo, không sửa tài liệu hay mã nguồn. Khi có lỗi, quay lại bước sở hữu vấn đề, sửa tại nguồn rồi phân tích lại. Không tự đánh dấu checklist cần người đánh giá phê duyệt chỉ để vượt điều kiện triển khai.

---

## 3. Bản đồ tài liệu

| Vị trí | Vai trò |
| :--- | :--- |
| `.specify/memory/constitution.md` | Nguyên tắc nền tảng của dự án. |
| `.agents/rules/*.md` | Ràng buộc ngắn theo phạm vi. |
| `.agents/skills/<tên>/SKILL.md` | Quy trình thực hiện công việc chuyên môn. |
| `.agents/knowledge.md` | Mục lục kiến thức và trạng thái xác minh. |
| `docs/knowledge/*.md` | Chi tiết API, mã lỗi, retry, dữ liệu và vận hành. |
| `docs/decisions/*.md` | Quyết định kiến trúc (ADR), lý do và quyết định bị thay thế. |
| `specs/<feature>/` | Spec, thiết kế, tasks và bằng chứng kiểm tra của tính năng. |

> *Giữ một nguồn chính cho mỗi nguyên tắc; các tài liệu khác tham chiếu thay vì sao chép thành nhiều phiên bản. Bản đồ này mô tả vị trí dự kiến, không chứng minh tất cả file đã tồn tại. Các nguyên tắc tóm tắt dưới đây phải được giữ nhất quán với constitution và rules tương ứng.*

---

## 4. Các nguyên tắc bảo toàn hệ thống

### 4.1. Quyền sở hữu dữ liệu
* Kiến trúc **Postgres-First**: PostgreSQL 16 quản lý hồ sơ quan hệ, lớp, phòng ban và trạng thái đồng bộ (`sync_status`).
* HANET AI Cloud quản lý định danh nhận diện khuôn mặt; PostgreSQL lưu liên kết `person_id` và thông tin ảnh đã được xác minh từ quá trình đồng bộ.
* Phân biệt URL ảnh tải lên tạm thời với URL ảnh Cloud đã xác nhận. URL còn truy cập được không tự chứng minh đó là ảnh đúng hoặc quá trình đồng bộ đã hoàn tất.

### 4.2. Danh tính, quyền sửa hồ sơ và lỗi `-9007`
* Không tin `aliasID` hoặc `existing_person_id` do client gửi lên như bằng chứng quyền sửa hồ sơ. Kiểm tra quyền và quan hệ với bản ghi đích ở phía server.
* Cloud trả `personID` không chứng minh người gửi có quyền cập nhật người đó.
* Không ghép người hoặc cập nhật nhiều hồ sơ chỉ dựa trên tên hay tên + lớp.
* Lỗi `-9007` chỉ được xử lý như thành công sau khi xác minh đúng người và quyền thao tác, có `personID` hợp lệ, hoàn tất các bước bắt buộc của yêu cầu và lưu kết quả đúng bản ghi vào DB.
* Nếu chưa xác định được danh tính hoặc quyền, không tự ghi đè ảnh/thông tin, không đánh dấu `SYNCED` hoặc job hoàn tất. Ghi nhận để xử lý theo cơ chế đối soát được spec quy định.

### 4.3. Đồng bộ và kết quả thành công
* Phân biệt “đã tiếp nhận” với “đã đồng bộ thành công”.
* Chỉ ghi `SYNCED` khi các bước bắt buộc đã hoàn tất và DB cập nhật đúng bản ghi; kiểm tra kết quả ghi theo kỳ vọng của thao tác.
* Không nuốt lỗi DB rồi đánh dấu job hoặc khóa idempotency là hoàn tất.
* Nếu Cloud thành công nhưng DB thất bại, giữ đủ thông tin để phục hồi và đối soát; không đăng ký thêm người một cách mù quáng.
* Các lỗi enqueue, retry và cập nhật trạng thái phải có đường phục hồi được mô tả trong spec/plan.

### 4.4. Vòng đời file ảnh
* Không xóa ảnh khi còn job đang chờ, đang chạy, chờ retry hoặc DLQ còn được phép chạy lại cần sử dụng ảnh đó.
* Mốc 30 giây là thời gian chờ tối thiểu sau khi ảnh đủ điều kiện dọn và các bước sử dụng ảnh đã hoàn tất; không phải bằng chứng HANET đã sử dụng xong ảnh.
* Không dùng cleanup trong `finally` theo cách làm mất ảnh của lần retry sau.
* Khi đổi tên hoặc di chuyển ảnh, cập nhật các tham chiếu liên quan trong job/DLQ và URL nếu có. Bảo đảm tác vụ chạy lại có thể đọc đúng ảnh.
* Tiền tố `dlq_` chỉ là quy ước đặt tên; khả năng phục hồi phụ thuộc vào file còn tồn tại và đường dẫn được lưu chính xác.
* Việc hết hạn và dọn ảnh DLQ phải theo chính sách lưu giữ được xác định trong spec, không giữ ảnh vô thời hạn một cách mặc định.

### 4.5. Alias và chống xử lý trùng
* Không tự động đổi `alias_id` hiện hữu khi xử lý ngầm hoặc retry.
* Alias mới được chuẩn hóa theo một quy tắc thống nhất trước khi lưu và đưa vào queue; worker sử dụng định danh đã lưu.
* Phân biệt gửi lại cùng yêu cầu với một yêu cầu hợp lệ mới, ví dụ thay ảnh. Không để khóa hoàn tất của yêu cầu cũ chặn mất yêu cầu mới.
* Không dùng idempotency thay cho kiểm tra quyền truy cập hoặc xác minh danh tính.

---

## 5. Mẫu báo cáo hoàn tất
* **Kết quả:** Hành vi đã sửa hoặc bổ sung và yêu cầu/task tương ứng.
* **Thay đổi:** Các file liên quan và lý do thay đổi.
* **Xác minh:** Lệnh đã chạy, kết quả, môi trường và phạm vi bằng chứng.
* **Tài liệu:** Spec, rules, knowledge hoặc ADR đã cập nhật nếu bị ảnh hưởng.
* **Còn thiếu:** Kiểm tra chưa chạy, tiêu chí chưa đạt hoặc phần bị chặn và nguyên nhân.

> *Chỉ kết luận hoàn tất trong phạm vi đã có bằng chứng. Không coi việc sửa xong mã nguồn là đồng nghĩa với việc tính năng đã được nghiệm thu.*