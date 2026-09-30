const path = require('path');
const hanetService = require('../services/hanetService');
const imageService = require('../services/imageService');
const queueService = require('../services/queueService');
const csvService = require('../services/csvService');
const { pool } = require('../config/database');
const { getErrorMessage } = require('../utils/hanetErrorMap');

// [READ] Danh sách Nhân sự từ Cloud và Database
exports.listPersons = async (req, res, next) => {
  try {
    const [personRes, dbDeptRes] = await Promise.all([
      hanetService.getListByPlace(),
      pool.query('SELECT id, name FROM departments ORDER BY id ASC')
    ]);

    const persons = personRes?.data || [];
    const deptMap = {
      '990653': 'Thiếu Nhi',
      '990730': 'Legiô Mariae',
      '990731': 'Giới Trẻ'
    };

    (dbDeptRes.rows || []).forEach(d => {
      if (d.id && d.name) {
        deptMap[String(d.id)] = d.name;
      }
    });

    res.render('person/list', {
      title: 'Danh sách Nhân sự trên HANET Cloud',
      persons,
      deptMap
    });
  } catch (err) {
    console.error('[List Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Không thể lấy dữ liệu từ HANET Cloud: ${msg}`);
    res.render('person/list', { title: 'Danh sách Nhân sự', persons: [], deptMap: {} });
  }
};

// [READ] Danh Sách Link Đăng Ký từ Bảng classes (PostgreSQL)
exports.viewLinks = async (req, res) => {
  try {
    const result = await pool.query('SELECT name FROM classes ORDER BY name ASC');
    const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

    const links = result.rows.map(row => ({
      fileName: row.name,
      name: row.name,
      url: `${baseUrl}/register/${encodeURIComponent(row.name)}`
    }));

    res.render('links', {
      links,
      title: 'Danh Sách Link Đăng Ký Theo Lớp'
    });
  } catch (err) {
    console.error('[viewLinks Error]', err.message);
    res.render('links', {
      links: [],
      title: 'Danh Sách Link Đăng Ký Theo Lớp',
      error: 'Không thể tải danh sách link từ cơ sở dữ liệu.'
    });
  }
};

// [CREATE] Render Form Đăng ký chung
exports.renderRegisterForm = async (req, res) => {
  try {
    const [deptRes, dbClassesRes] = await Promise.all([
      pool.query('SELECT id, name FROM departments ORDER BY name ASC'),
      pool.query('SELECT name FROM classes ORDER BY name ASC')
    ]);

    res.render('person/register', {
      title: 'Đăng ký Face ID Nhân sự',
      departments: deptRes.rows || [],
      classes: dbClassesRes.rows || []
    });
  } catch (err) {
    console.error('[renderRegisterForm Error]', err.message);
    res.render('person/register', {
      title: 'Đăng ký Face ID Nhân sự',
      departments: [],
      classes: []
    });
  }
};

// [CREATE - POSTGRESQL] Render Form Đăng ký theo lớp từ bảng persons
exports.viewRegisterByFile = async (req, res) => {
  const fileName = req.params.file_name || req.params.classId;
  try {
    const result = await pool.query(
      `SELECT p.*, d.name AS department_name
       FROM persons p
       LEFT JOIN departments d ON p.department_id = d.id
       WHERE ($1::text IS NULL OR p.class_name = $1)
       ORDER BY p.id ASC`,
      [fileName]
    );

    const csvList = result.rows.map(row => ({
      ho_ten: row.name,
      lop: row.class_name,
      phong_ban: row.department_name || 'Thiếu Nhi',
      chuc_vu: row.title || 'Học Sinh',
      anh_url: row.face_url || '',
      hanet_person_id: row.person_id || '',
      alias_id: row.alias_id || ''
    }));

    if (csvList.length === 0) {
      req.flash('warning', `Lớp "${fileName}" hiện chưa có dữ liệu trong Database.`);
    }

    res.render('person/register_csv', {
      fileName,
      csvList,
      title: `Đăng Ký Face ID - ${fileName}`
    });
  } catch (err) {
    console.error('[viewRegisterByFile Error]', err.message);
    req.flash('error', `Không thể tải danh mục đăng ký: ${err.message}`);
    res.redirect('/links');
  }
};

// [CREATE] Xử lý Đăng ký Nhân sự mới (Cloud + PostgreSQL)
exports.handleRegister = async (req, res, next) => {
  try {
    const { aliasID, title, departmentID, base64_image, source_csv, className, lop, existing_person_id } = req.body;
    const name = req.body.personName || req.body.name;
    const targetClass = req.params.file_name || source_csv || req.body.file_name || className || lop || null;

    // 1. Validate Họ tên bắt buộc
    if (!name || !name.trim()) {
      req.flash('error', 'Vui lòng nhập Họ và Tên.');
      return res.redirect(targetClass ? `/register/${targetClass}` : '/register');
    }

    const uploadedFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    // 2. Validate Ảnh bắt buộc
    if (!uploadedFile && !base64_image) {
      req.flash('error', 'Vui lòng chụp hoặc tải ảnh khuôn mặt.');
      return res.redirect(targetClass ? `/register/${targetClass}` : '/register');
    }

    // 3. Xử lý ảnh khuôn mặt qua Image Service
    const processedImage = await imageService.processFaceImage({
      filePath: uploadedFile ? uploadedFile.path : null,
      base64String: base64_image || null
    });

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const publicImageUrl = `${baseUrl.replace(/\/$/, '')}/uploads/${processedImage.filename}`;

    // 4. Xác định Department ID từ DB nếu chưa có
    let finalDeptID = departmentID || null;
    if (!finalDeptID && targetClass) {
      const classRow = await pool.query('SELECT department_id FROM classes WHERE name = $1 LIMIT 1', [targetClass]);
      if (classRow.rows.length > 0 && classRow.rows[0].department_id) {
        finalDeptID = classRow.rows[0].department_id;
      }
    }
    if (!finalDeptID) finalDeptID = '990653'; // Mặc định Thiếu Nhi

    // 5. Chuẩn hóa Alias ID
    let finalAlias = (aliasID || '').trim();
    if (!finalAlias) {
      const countRes = await pool.query('SELECT count(*) FROM persons WHERE class_name = $1', [targetClass]);
      const nextIdx = parseInt(countRes.rows[0].count || 0, 10) + 1;
      finalAlias = `${targetClass || 'CHUNG'}_${nextIdx}`;
    }

    // 6. Ghi trước vào Database PostgreSQL với trạng thái PENDING
    await pool.query(
      `INSERT INTO persons (alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', CURRENT_TIMESTAMP)
       ON CONFLICT (alias_id) DO UPDATE SET
         name = EXCLUDED.name,
         face_url = COALESCE(EXCLUDED.face_url, persons.face_url),
         department_id = COALESCE(EXCLUDED.department_id, persons.department_id),
         title = EXCLUDED.title,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [finalAlias, existing_person_id || null, name.trim(), targetClass, finalDeptID, (title || 'Học Sinh').trim(), publicImageUrl]
    );

    // 7. Đẩy tác vụ vào Bull Queue xử lý với HANET Cloud
    await queueService.enqueueRegisterPerson({
      name: name.trim(),
      aliasID: finalAlias,
      title: title ? title.trim() : 'Học Sinh',
      departmentID: finalDeptID,
      imagePath: processedImage.processedPath,
      imageFilename: processedImage.filename,
      publicImageUrl,
      source_csv: targetClass,
      existing_person_id: existing_person_id || null
    });

    req.flash('success', `Đã tiếp nhận đăng ký cho "${name}". Tiến trình đồng bộ Cloud đang chạy ngầm.`);
    res.redirect(targetClass ? `/register/${targetClass}` : '/links');
  } catch (err) {
    console.error('[Register Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Lỗi đăng ký: ${msg}`);
    const redirectUrl = req.params.file_name || req.body?.source_csv || req.body?.file_name;
    res.redirect(redirectUrl ? `/register/${redirectUrl}` : '/register');
  }
};

// [UPDATE] Render Form Chỉnh sửa thông tin nhân sự
exports.renderEditForm = async (req, res, next) => {
  try {
    const { personID } = req.params;

    const [personRes, deptRes] = await Promise.all([
      hanetService.getListByPlace(),
      pool.query('SELECT id, name FROM departments ORDER BY id ASC')
    ]);

    const persons = personRes?.data || [];
    const departments = deptRes.rows || [];
    const person = persons.find(p => String(p.id || p.personID) === String(personID));

    if (!person) {
      req.flash('error', 'Không tìm thấy thông tin nhân sự trên HANET Cloud.');
      return res.redirect('/admin/person/list');
    }

    res.render('person/edit', {
      title: `Chỉnh sửa: ${person.name}`,
      person,
      departments
    });
  } catch (err) {
    console.error('[Edit Form Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Lỗi truy xuất thông tin nhân sự: ${msg}`);
    res.redirect('/admin/person/list');
  }
};

// [UPDATE] Xử lý Cập nhật Thông tin / Face ID lên Cloud và PostgreSQL
exports.handleUpdate = async (req, res, next) => {
  try {
    const { personID } = req.params;
    const { name, aliasID, title, departmentID, base64_image } = req.body;

    if (!name || !name.trim()) {
      req.flash('error', 'Vui lòng nhập Họ và Tên.');
      return res.redirect(`/edit/${personID}`);
    }

    // 1. Cập nhật thông tin trong PostgreSQL
    let publicImageUrl = null;
    let imageFilename = null;
    let imagePath = null;

    const uploadedUpdateFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
    if (uploadedUpdateFile || base64_image) {
      const processedImage = await imageService.processFaceImage({
        filePath: uploadedUpdateFile ? uploadedUpdateFile.path : null,
        base64String: base64_image || null
      });
      const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
      publicImageUrl = `${baseUrl}/uploads/${processedImage.filename}`;
      imageFilename = processedImage.filename;
      imagePath = processedImage.processedPath;
    }

    await pool.query(
      `UPDATE persons
       SET name = COALESCE($1, name),
           title = COALESCE($2, title),
           face_url = COALESCE($3, face_url),
           department_id = COALESCE($4, department_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE alias_id = $5 OR person_id = $5`,
      [name.trim(), title ? title.trim() : null, publicImageUrl, departmentID || null, String(personID)]
    );

    // 2. Gửi tác vụ cập nhật vào Bull Queue
    await queueService.enqueueUpdatePerson({
      personID,
      name: name.trim(),
      aliasID: aliasID ? aliasID.trim() : '',
      title: title ? title.trim() : 'Học Sinh',
      departmentID: departmentID || null,
      imagePath,
      imageFilename,
      publicImageUrl
    });

    req.flash('success', `Đã cập nhật thông tin cho "${name}".`);
    res.redirect('/admin/person/list');
  } catch (err) {
    console.error('[Update Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Không thể cập nhật nhân sự: ${msg}`);
    res.redirect(`/edit/${req.params.personID}`);
  }
};

// [DELETE] Xử lý Xóa Nhân sự trên HANET Cloud & PostgreSQL
exports.handleDelete = async (req, res, next) => {
  const personID = req.params.personID || req.params.id || req.body.personID;
  const personName = req.body.personName || req.body.name || '';

  if (!personID) {
    req.flash('error', 'Không tìm thấy ID nhân sự để xóa.');
    return res.redirect('/admin/person/list');
  }

  try {
    // 1. Xóa trong PostgreSQL
    await pool.query('DELETE FROM persons WHERE alias_id = $1 OR person_id = $1', [String(personID)]);

    // 2. Gọi API xóa nhân sự trên HANET Cloud
    const result = await hanetService.removePerson(personID);

    // 3. Tự động đồng bộ xóa trong file CSV nếu có (fail-soft)
    csvService.removePersonFromCsv(personID, personName);

    if (result && result.returnCode === 1) {
      req.flash('success', `Đã xóa thành công nhân sự [ID: ${personID}] khỏi hệ thống.`);
    } else {
      const errorMsg = getErrorMessage(result?.returnCode, result?.returnMessage);
      req.flash('warning', `Đã xóa trong Database cục bộ. Cảnh báo Cloud: ${errorMsg}`);
    }

    res.redirect('/admin/person/list');
  } catch (err) {
    console.error('[Delete Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Không thể xóa nhân sự: ${msg}`);
    res.redirect('/admin/person/list');
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
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Lỗi truy xuất lịch sử check-in: ${msg}`);
    res.render('person/checkin', { title: 'Nhật ký Check-in', logs: [] });
  }
};

// [READ] Quản lý Dead Letter Queue (DLQ)
exports.viewDLQ = async (req, res, next) => {
  try {
    const jobs = await queueService.getDLQJobs(0, 50);
    res.json({ success: true, count: jobs.length, jobs });
  } catch (err) {
    console.error('[viewDLQ Error]', err.message);
    res.status(500).json({ error: `Không thể đọc DLQ: ${err.message}` });
  }
};

// [SYNC] Kích hoạt đồng bộ Cloud về PostgreSQL Database
exports.triggerSync = async (req, res, next) => {
  try {
    const listRes = await hanetService.getListByPlace();
    const cloudPersons = listRes?.data || [];

    let syncCount = 0;
    for (const cp of cloudPersons) {
      const pId = String(cp.personID || cp.id);
      const name = cp.name;
      const avatar = cp.avatar || cp.faceUrl || null;
      const alias = cp.aliasID || null;
      const deptId = cp.departmentID ? String(cp.departmentID) : null;
      const title = cp.title || 'Học Sinh';

      if (alias) {
        await pool.query(
          `INSERT INTO persons (alias_id, person_id, name, department_id, title, face_url, sync_status, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, 'SYNCED', CURRENT_TIMESTAMP)
           ON CONFLICT (alias_id) DO UPDATE SET
             person_id = EXCLUDED.person_id,
             face_url = COALESCE(EXCLUDED.face_url, persons.face_url),
             sync_status = 'SYNCED',
             updated_at = CURRENT_TIMESTAMP`,
          [alias, pId, name, deptId, title, avatar]
        );
        syncCount++;
      }
    }

    req.flash('success', `Đã đồng bộ thành công ${syncCount}/${cloudPersons.length} nhân sự từ Cloud vào PostgreSQL.`);
    res.redirect('/admin/person/list');
  } catch (err) {
    console.error('[triggerSync Error]', err.message);
    req.flash('error', `Lỗi đồng bộ: ${err.message}`);
    res.redirect('/admin/person/list');
  }
};

// Aliases cho routing tương thích
exports.list = exports.listPersons;
exports.showLinks = exports.viewLinks;
exports.showRegisterForm = exports.viewRegisterByFile;
exports.update = exports.handleUpdate;
exports.delete = exports.handleDelete;
