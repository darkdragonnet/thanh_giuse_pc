const hanetService = require('../services/hanetService');
const { pool } = require('../config/database');

// [READ] Danh sách Phòng ban (Đồng bộ HANET Cloud & PostgreSQL)
exports.listDepartments = async (req, res) => {
  try {
    const [cloudRes, dbRes] = await Promise.all([
      hanetService.getDepartmentList().catch(() => ({ data: [] })),
      pool.query('SELECT d.*, count(p.id) as member_count FROM departments d LEFT JOIN persons p ON d.id = p.department_id GROUP BY d.id ORDER BY d.id ASC')
    ]);

    const departments = cloudRes?.data?.hits || cloudRes?.data || dbRes.rows || [];

    res.render('department/index', {
      title: 'Quản lý Phòng ban - HANET Cloud & DB',
      departments,
      dbDepartments: dbRes.rows || []
    });
  } catch (err) {
    console.error('[listDepartments Error]', err.message);
    req.flash('error', `Không thể lấy danh sách phòng ban: ${err.message}`);
    res.render('department/index', {
      title: 'Quản lý Phòng ban',
      departments: [],
      dbDepartments: []
    });
  }
};

// [CREATE] Tạo mới Phòng ban
exports.handleCreate = async (req, res) => {
  try {
    const { name, desc, code } = req.body;
    if (!name || !name.trim()) {
      req.flash('error', 'Tên phòng ban không được để trống.');
      return res.redirect('/departments');
    }

    const trimmedName = name.trim();
    const result = await hanetService.createDepartment(trimmedName, desc ? desc.trim() : '');

    if (result.returnCode === 1) {
      const newId = String(result.data?.id || Date.now());
      const deptCode = (code || trimmedName.slice(0, 4).toUpperCase()).replace(/\s+/g, '');

      // Lưu vào PostgreSQL
      await pool.query(
        `INSERT INTO departments (id, name, code)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           code = EXCLUDED.code`,
        [newId, trimmedName, deptCode]
      );

      req.flash('success', `Đã tạo thành công phòng ban "${trimmedName}" (ID: ${newId}).`);
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
    const { name, desc, code } = req.body;

    if (!name || !name.trim()) {
      req.flash('error', 'Tên phòng ban không được để trống.');
      return res.redirect('/departments');
    }

    const trimmedName = name.trim();

    // 1. Cập nhật trong PostgreSQL
    await pool.query(
      `UPDATE departments
       SET name = $1,
           code = COALESCE($2, code)
       WHERE id = $3`,
      [trimmedName, code ? code.trim() : null, String(id)]
    );

    // 2. Cập nhật trên HANET Cloud
    const result = await hanetService.updateDepartment(id, trimmedName, desc ? desc.trim() : '');

    if (result.returnCode === 1) {
      req.flash('success', `Đã cập nhật thành công phòng ban ID "${id}".`);
    } else {
      req.flash('warning', `Đã cập nhật Database. Cảnh báo Cloud [${result.returnCode}]: ${result.returnMessage}`);
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

    // 1. Xóa trong PostgreSQL (cascade hoặc set null)
    await pool.query('DELETE FROM departments WHERE id = $1', [String(id)]);

    // 2. Xóa trên HANET Cloud
    const result = await hanetService.removeDepartment(id);

    if (result.returnCode === 1) {
      req.flash('success', `Đã xóa thành công phòng ban ID "${id}".`);
    } else {
      req.flash('warning', `Đã xóa trong Database. Cảnh báo Cloud [${result.returnCode}]: ${result.returnMessage}`);
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

  try {
    // 1. Lấy tất cả nhân sự từ Cloud
    const allPersonsRes = await hanetService.getListByPlace().catch(() => ({ data: [] }));
    allPersons = allPersonsRes?.data || [];

    // 2. Lấy nhân sự từ PostgreSQL thuộc phòng ban này
    const dbMembersRes = await pool.query(
      `SELECT * FROM persons WHERE department_id = $1 ORDER BY name ASC`,
      [String(departmentID)]
    );

    // 3. Lấy nhân sự từ HANET Cloud
    try {
      const membersRes = await hanetService.getPersonsByDepartment(departmentID);
      if (membersRes.returnCode === 1 && membersRes.data) {
        members = membersRes.data;
      } else {
        members = dbMembersRes.rows || [];
      }
    } catch (err) {
      members = dbMembersRes.rows || [];
      if (err.response && err.response.status === 403) {
        permissionError = true;
        permissionMessage = `Phòng ban ID ${departmentID} không thuộc Place ID ${process.env.HANET_PLACE_ID} của app, hoặc thiếu quyền "department_person:read".`;
      }
    }
  } catch (err) {
    console.error(`[viewMembers Error - Dept ${departmentID}]`, err.message);
    req.flash('error', `Lỗi tải danh sách thành viên: ${err.message}`);
  }

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

    const idsArray = Array.isArray(personIDs) ? personIDs : [personIDs];

    // 1. Cập nhật trong PostgreSQL
    for (const pId of idsArray) {
      await pool.query(
        `UPDATE persons
         SET department_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE person_id = $2 OR alias_id = $2`,
        [String(departmentID), String(pId)]
      );
    }

    // 2. Cập nhật trên HANET Cloud
    const result = await hanetService.addPersonsToDepartment(departmentID, personIDs);

    if (result.returnCode === 1) {
      req.flash('success', 'Đã thêm thành viên vào phòng ban thành công.');
    } else {
      req.flash('warning', `Đã cập nhật Database. Cảnh báo Cloud [${result.returnCode}]: ${result.returnMessage}`);
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
      const newId = String(createRes.data?.id);
      await pool.query(
        `UPDATE departments SET id = $1 WHERE id = $2`,
        [newId, String(id)]
      );
      await pool.query(
        `UPDATE persons SET department_id = $1 WHERE department_id = $2`,
        [newId, String(id)]
      );
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
