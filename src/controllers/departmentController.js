const hanetService = require('../services/hanetService');

// [READ] Danh sách Phòng ban
exports.listDepartments = async (req, res) => {
  try {
    const result = await hanetService.getDepartmentList();
    const departments = result?.data?.hits || result?.data || [];

    res.render('department/index', {
      title: 'Quản lý Phòng ban - HANET Cloud',
      departments
    });
  } catch (err) {
    console.error('[listDepartments Error]', err.message);
    req.flash('error', `Không thể lấy danh sách phòng ban: ${err.message}`);
    res.render('department/index', {
      title: 'Quản lý Phòng ban',
      departments: []
    });
  }
};

// [CREATE] Tạo mới Phòng ban
exports.handleCreate = async (req, res) => {
  try {
    const { name, desc } = req.body;
    if (!name || !name.trim()) {
      req.flash('error', 'Tên phòng ban không được để trống.');
      return res.redirect('/departments');
    }

    const result = await hanetService.createDepartment(name.trim(), desc ? desc.trim() : '');

    if (result.returnCode === 1) {
      req.flash('success', `Đã tạo thành công phòng ban "${name}".`);
    } else {
      req.flash('error', `Lỗi từ HANET Cloud [${result.returnCode}]: ${result.returnMessage}`);
    }

    res.redirect('/departments');
  } catch (err) {
    console.error('[handleCreate Error]', err.message);
    req.flash('error', `Không thể tạo phòng ban: ${err.message}`);
    res.redirect('/departments');
  }
};

// [UPDATE] Cập nhật Phòng ban
exports.handleUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, desc } = req.body;

    if (!name || !name.trim()) {
      req.flash('error', 'Tên phòng ban không được để trống.');
      return res.redirect('/departments');
    }

    const result = await hanetService.updateDepartment(id, name.trim(), desc ? desc.trim() : '');

    if (result.returnCode === 1) {
      req.flash('success', `Đã cập nhật thành công phòng ban ID "${id}".`);
    } else {
      req.flash('error', `Lỗi từ HANET Cloud [${result.returnCode}]: ${result.returnMessage}`);
    }

    res.redirect('/departments');
  } catch (err) {
    console.error('[handleUpdate Error]', err.message);
    req.flash('error', `Không thể cập nhật phòng ban: ${err.message}`);
    res.redirect('/departments');
  }
};

// [DELETE] Xóa Phòng ban
exports.handleDelete = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await hanetService.removeDepartment(id);

    if (result.returnCode === 1) {
      req.flash('success', `Đã xóa thành công phòng ban ID "${id}".`);
    } else {
      req.flash('error', `Lỗi từ HANET Cloud [${result.returnCode}]: ${result.returnMessage}`);
    }

    res.redirect('/departments');
  } catch (err) {
    console.error('[handleDelete Error]', err.message);
    req.flash('error', `Không thể xóa phòng ban: ${err.message}`);
    res.redirect('/departments');
  }
};

// [READ] Xem danh sách thành viên trong Phòng ban
exports.viewMembers = async (req, res) => {
  const { departmentID } = req.params;
  let members = [];
  let allPersons = [];
  let permissionError = false;
  let permissionMessage = '';

  // 1. Lấy tất cả nhân sự (luôn OK)
  try {
    const allPersonsRes = await hanetService.getListByPlace();
    allPersons = allPersonsRes?.data || [];
  } catch (err) {
    console.error(`[viewMembers - getListByPlace Error]`, err.message);
    req.flash('error', `Không thể lấy danh sách nhân sự: ${err.message}`);
  }

  // 2. Lấy nhân sự thuộc phòng ban (có thể 403)
  try {
    const membersRes = await hanetService.getPersonsByDepartment(departmentID);
    if (membersRes.returnCode === 1) {
      members = membersRes.data || [];
    } else {
      req.flash('error', `Không thể đọc phòng ban ${departmentID}: ${membersRes.returnMessage}`);
    }
  } catch (err) {
    console.error(`[viewMembers Error - Dept ${departmentID}]`, err.message);
    if (err.response && err.response.status === 403) {
      permissionError = true;
      permissionMessage = `Phòng ban ID ${departmentID} không thuộc Place ID ${process.env.HANET_PLACE_ID} của app, hoặc thiếu quyền "department_person:read". Hãy dùng nút "Fix" để xoá và tạo lại qua API app.`;
      req.flash('error', `⚠️ Lỗi quyền (403): ${permissionMessage}`);
    } else {
      req.flash('error', `Lỗi tải thành viên: ${err.message}`);
    }
  }

  // 3. LUÔN render view
  res.render('department/members', {
    title: `Quản lý Thành viên - Phòng ban ${departmentID}`,
    departmentID,
    members,
    allPersons,
    permissionError,
    permissionMessage
  });
};

// [CREATE/ADD] Thêm thành viên vào Phòng ban
exports.handleAddMembers = async (req, res) => {
  const { departmentID } = req.params;
  try {
    const { personIDs } = req.body;

    if (!personIDs || (Array.isArray(personIDs) && personIDs.length === 0)) {
      req.flash('error', 'Vui lòng chọn ít nhất một nhân sự để thêm vào phòng ban.');
      return res.redirect(`/departments/${departmentID}/members`);
    }

    const result = await hanetService.addPersonsToDepartment(departmentID, personIDs);

    if (result.returnCode === 1) {
      req.flash('success', 'Đã thêm thành viên vào phòng ban thành công.');
    } else {
      req.flash('error', `Lỗi từ HANET Cloud [${result.returnCode}]: ${result.returnMessage}`);
    }

    res.redirect(`/departments/${departmentID}/members`);
  } catch (err) {
    console.error('[handleAddMembers Error]', err.message);
    req.flash('error', `Không thể thêm nhân sự vào phòng ban: ${err.message}`);
    res.redirect(`/departments/${departmentID}/members`);
  }
};

// [FIX] Tự động xoá và tạo lại phòng ban qua API app (gắn đúng placeID)
exports.handleFix = async (req, res) => {
  const { id } = req.params;
  try {
    const listRes = await hanetService.getDepartmentList();
    const old = listRes?.data?.hits?.find(d => String(d.id) === String(id));
    if (!old) {
      req.flash('error', `Không tìm thấy phòng ban ID ${id}`);
      return res.redirect('/departments');
    }

    const delRes = await hanetService.removeDepartment(id);
    if (delRes.returnCode !== 1) {
      req.flash('error', `Không thể xoá phòng ban ${id}: ${delRes.returnMessage}`);
      return res.redirect('/departments');
    }

    const createRes = await hanetService.createDepartment(old.name, old.desc || '');
    if (createRes.returnCode === 1) {
      const newId = createRes.data?.id;
      req.flash('success', `Đã fix phòng ban "${old.name}": ID cũ ${id} → ID mới ${newId}`);
    } else {
      req.flash('error', `Xoá OK nhưng tạo lại lỗi: ${createRes.returnMessage}`);
    }

    res.redirect('/departments');
  } catch (err) {
    console.error('[handleFix Error]', err.message);
    req.flash('error', `Lỗi fix phòng ban: ${err.message}`);
    res.redirect('/departments');
  }
};
