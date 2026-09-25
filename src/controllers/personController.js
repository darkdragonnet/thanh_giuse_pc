const hanetService = require('../services/hanetService');
const imageService = require('../services/imageService');
const queueService = require('../services/queueService');

// [READ] Danh sách Nhân sự từ Cloud
exports.listPersons = async (req, res, next) => {
  try {
    const result = await hanetService.getListByPlace();
    const persons = result?.data || [];
    res.render('person/list', {
      title: 'Danh sách Nhân sự trên HANET Cloud',
      persons
    });
  } catch (err) {
    console.error('[List Error]', err.message);
    req.flash('error', `Không thể lấy dữ liệu từ HANET Cloud: ${err.message}`);
    res.render('person/list', { title: 'Danh sách Nhân sự', persons: [] });
  }
};

// [CREATE] Render Form Đăng ký
exports.renderRegisterForm = (req, res) => {
  res.render('person/register', { title: 'Đăng ký Face ID Nhân sự' });
};

// [CREATE] Xử lý Đăng ký Nhân sự mới
exports.handleRegister = async (req, res, next) => {
  try {
    const { name, aliasID, title, base64_image } = req.body;

    if (!req.file && !base64_image) {
      req.flash('error', 'Vui lòng chụp hoặc tải ảnh khuôn mặt.');
      return res.redirect('/register');
    }

    const processedImage = await imageService.processFaceImage({
      filePath: req.file ? req.file.path : null,
      base64String: base64_image || null
    });

    await queueService.enqueueRegisterPerson({
      name,
      aliasID,
      title,
      imagePath: processedImage.processedPath,
      imageFilename: processedImage.filename
    });

    req.flash('success', `Đã nhận yêu cầu đăng ký cho "${name}". Tiến trình xử lý ảnh và đồng bộ Cloud đang chạy ngầm.`);
    res.redirect('/');
  } catch (err) {
    console.error('[Register Error]', err.message);
    req.flash('error', `Lỗi đăng ký: ${err.message}`);
    res.redirect('/register');
  }
};

// [UPDATE] Render Form Chỉnh sửa thông tin nhân sự
exports.renderEditForm = async (req, res, next) => {
  try {
    const { personID } = req.params;
    // Đọc danh sách từ Cloud và tìm nhân sự tương ứng
    const result = await hanetService.getListByPlace();
    const persons = result?.data || [];
    const person = persons.find(p => String(p.id || p.personID) === String(personID));

    if (!person) {
      req.flash('error', 'Không tìm thấy thông tin nhân sự trên HANET Cloud.');
      return res.redirect('/');
    }

    res.render('person/edit', {
      title: `Chỉnh sửa: ${person.name}`,
      person
    });
  } catch (err) {
    console.error('[Edit Form Error]', err.message);
    req.flash('error', `Lỗi truy xuất thông tin nhân sự: ${err.message}`);
    res.redirect('/');
  }
};

// [UPDATE] Xử lý Cập nhật Thông tin / Face ID lên Cloud
exports.handleUpdate = async (req, res, next) => {
  try {
    const { personID } = req.params;
    const { name, aliasID, title, base64_image } = req.body;

    let updatePayload = {
      personID,
      name,
      aliasID,
      title
    };

    // Nếu người dùng tải ảnh mới để cập nhật Face ID
    if (req.file || base64_image) {
      const processedImage = await imageService.processFaceImage({
        filePath: req.file ? req.file.path : null,
        base64String: base64_image || null
      });
      updatePayload.imagePath = processedImage.processedPath;
      updatePayload.imageFilename = processedImage.filename;
    }

    // Đẩy tác vụ cập nhật vào Queue xử lý ngầm
    await queueService.enqueueUpdatePerson(updatePayload);

    req.flash('success', `Yêu cầu cập nhật cho nhân sự ID "${personID}" đã được gửi vào hàng đợi đồng bộ Cloud.`);
    res.redirect('/');
  } catch (err) {
    console.error('[Update Error]', err.message);
    req.flash('error', `Không thể cập nhật nhân sự: ${err.message}`);
    res.redirect(`/edit/${req.params.personID}`);
  }
};

// [DELETE] Xử lý Xóa Nhân sự trên HANET Cloud
exports.handleDelete = async (req, res, next) => {
  try {
    const { personID } = req.params;
    // Gọi trực tiếp API xóa nhân sự trên HANET Cloud
    const result = await hanetService.removePerson(personID);

    if (result.returnCode === 1) {
      req.flash('success', `Đã xóa thành công nhân sự ID "${personID}" khỏi HANET Cloud.`);
    } else {
      req.flash('error', `Lỗi từ HANET Cloud [${result.returnCode}]: ${result.returnMessage}`);
    }

    res.redirect('/');
  } catch (err) {
    console.error('[Delete Error]', err.message);
    req.flash('error', `Không thể xóa nhân sự: ${err.message}`);
    res.redirect('/');
  }
};

// [READ] Lịch sử Check-in Real-time
exports.renderCheckin = async (req, res, next) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const endOfMonth = now.getTime();

    const result = await hanetService.getCheckinByTimestamp(startOfMonth, endOfMonth);
    const logs = result?.data || [];

    res.render('person/checkin', {
      title: 'Nhật ký Check-in Real-time',
      logs
    });
  } catch (err) {
    console.error('[Checkin Error]', err.message);
    req.flash('error', `Lỗi truy xuất lịch sử check-in: ${err.message}`);
    res.render('person/checkin', { title: 'Nhật ký Check-in', logs: [] });
  }
};
