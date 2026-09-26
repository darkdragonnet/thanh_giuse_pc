const ERROR_MAP = {
  1: 'Thao tác thành công.',
  '-1': 'Thông tin gửi lên không hợp lệ. Vui lòng kiểm tra lại các trường bắt buộc (Họ tên, mã NV, phòng ban).',
  '-103': 'Phiên đăng nhập đã hết hạn. Hệ thống đang tự động làm mới, vui lòng thử lại.',
  '-404': 'Yêu cầu không được hỗ trợ bởi hệ thống HANET.',
  '-503': 'Máy chủ HANET Cloud đang bảo trì hoặc quá tải. Vui lòng thử lại sau ít phút.',
  '-909': 'Lỗi trong quá trình tải dữ liệu khuôn mặt lên máy chủ.',
  '-1001': 'Lỗi khởi tạo địa điểm.',
  '-1005': 'Địa điểm không tồn tại trên hệ thống.',
  '-10076': 'Bạn không có quyền chỉnh sửa địa điểm này.',
  '-2035': 'Bạn không có quyền truy cập vào phòng ban hoặc địa điểm này.',
  '-5004': 'Không thể tạo khuôn mặt do kết nối mạng không ổn định. Vui lòng thử lại.',
  '-5005': 'Không thể cập nhật thông tin thành viên. Có thể thành viên không còn tồn tại.',
  '-5006': 'Không thể xóa thành viên khỏi phòng ban. Vui lòng kiểm tra lại dữ liệu.',
  '-5008': 'Cập nhật khuôn mặt mới thất bại. Vui lòng thử lại với ảnh rõ nét hơn.',
  '-5010': 'Ảnh khuôn mặt không hợp lệ.',
  '-5011': 'Không tìm thấy hồ sơ thành viên này trên HANET Cloud.',
  '-9002': 'Định dạng file ảnh không hợp lệ. Hệ thống chỉ hỗ trợ định dạng JPG, JPEG hoặc PNG.',
  '-9003': 'Máy chủ HANET gặp lỗi khi đăng ký thành viên mới.',
  '-9004': 'Lỗi khi xóa nhân sự.',
  '-9005': 'Mã nhân viên (Mã NV) này đã tồn tại trên hệ thống. Vui lòng chọn mã khác.',
  '-9006': 'Ảnh chụp không đạt chuẩn nhận diện! Yêu cầu: Ảnh rõ nét, chỉ có 1 người, nhìn thẳng vào camera, không đeo khẩu trang hay đội nón.',
  '-9007': 'Khuôn mặt này đã được đăng ký trước đó trên hệ thống.',
  '-9008': 'Dung lượng bộ nhớ Face ID của Nhà thờ đã hết. Vui lòng liên hệ Admin để nâng cấp gói Cloud.'
};

exports.getErrorMessage = (code, defaultMsg = 'Đã xảy ra lỗi không xác định từ máy chủ HANET.') => {
  if (!code && code !== 0) return defaultMsg;
  return ERROR_MAP[String(code)] || defaultMsg;
};

exports.ERROR_MAP = ERROR_MAP;
