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
exports.renderRegisterForm = async (req, res) => {
  try {
    const deptRes = await hanetService.getDepartmentList();
    const departments = deptRes?.data?.hits || [];
    res.render('person/register', {
      title: 'Đăng ký Face ID Nhân sự',
      departments
    });
  } catch (err) {
    console.error('[renderRegisterForm Error]', err.message);
    res.render('person/register', {
      title: 'Đăng ký Face ID Nhân sự',
      departments: []
    });
  }
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
    // Đọc song song danh sách nhân sự và danh sách phòng ban từ Cloud
    const [personRes, deptRes] = await Promise.all([
      hanetService.getListByPlace(),
      hanetService.getDepartmentList()
    ]);

    const persons = personRes?.data || [];
    const departments = deptRes?.data?.hits || [];
    const person = persons.find(p => String(p.id || p.personID) === String(personID));

    if (!person) {
      req.flash('error', 'Không tìm thấy thông tin nhân sự trên HANET Cloud.');
      return res.redirect('/');
    }

    res.render('person/edit', {
      title: `Chỉnh sửa: ${person.name}`,
      person,
      departments
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
    const { name, aliasID, title, departmentID, base64_image } = req.body;

    // 1. Lấy thông tin person hiện tại để so sánh department
    const listRes = await hanetService.getListByPlace();
    const person = listRes?.data?.find(p => String(p.personID) === String(personID));
    const oldDeptID = person?.departmentID && String(person.departmentID) !== '0'
      ? String(person.departmentID)
      : null;
    const newDeptID = departmentID ? String(departmentID) : null;

    console.log(`[handleUpdate] Person ${personID} | oldDept=${oldDeptID} → newDept=${newDeptID}`);

    // 2. Cập nhật thông tin cơ bản + face nếu có (qua queue)
    let updatePayload = { personID, name, aliasID, title };
    if (req.file || base64_image) {
      const processedImage = await imageService.processFaceImage({
        filePath: req.file ? req.file.path : null,
        base64String: base64_image || null
      });
      updatePayload.imagePath = processedImage.processedPath;
      updatePayload.imageFilename = processedImage.filename;
    }
    await queueService.enqueueUpdatePerson(updatePayload);

    // 3. Xử lý đổi phòng ban (chỉ khi user chọn phòng mới khác phòng cũ)
    let deptMsg = '';
    if (newDeptID && newDeptID !== oldDeptID) {
      // 3a. Gỡ khỏi phòng cũ (nếu đang ở phòng nào đó)
      if (oldDeptID) {
        try {
          const removeRes = await hanetService.removePersonsFromDepartment(oldDeptID, personID);
          console.log(`[handleUpdate] Remove khỏi phòng ${oldDeptID}: returnCode=${removeRes.returnCode}`);
        } catch (err) {
          console.warn(`[handleUpdate] Không gỡ được khỏi phòng cũ ${oldDeptID}:`, err.message);
        }
      }

      // 3b. Gán vào phòng mới
      try {
        const addRes = await hanetService.addPersonsToDepartment(newDeptID, personID);
        console.log(`[handleUpdate] Add vào phòng ${newDeptID}: returnCode=${addRes.returnCode}`);
        if (addRes.returnCode === 1) {
          deptMsg = ` Đã chuyển sang phòng ban mới.`;
        } else {
          deptMsg = ` ⚠️ Gán phòng ban lỗi: ${addRes.returnMessage}`;
        }
      } catch (err) {
        console.error(`[handleUpdate] Lỗi add-person:`, err.message);
        deptMsg = ` ⚠️ Lỗi gán phòng ban: ${err.message}`;
      }
    } else if (newDeptID === oldDeptID && newDeptID) {
      deptMsg = ' (Không thay đổi phòng ban).';
    }

    req.flash('success', `Đã cập nhật nhân sự "${name}".${deptMsg}`);
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
