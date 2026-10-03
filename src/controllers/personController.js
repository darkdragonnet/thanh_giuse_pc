const path = require('path');
const crypto = require('crypto');
const hanetService = require('../services/hanetService');
const imageService = require('../services/imageService');
const queueService = require('../services/queueService');
const idempotencyService = require('../services/idempotencyService');
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

// [CREATE / UPDATE PHOTO] Xử lý Đăng ký / Cập nhật ảnh Face ID (PostgreSQL-First + Bull Queue + Outbox)
exports.handleRegister = async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { aliasID, title, departmentID, base64_image, source_csv, className, lop, existing_person_id } = req.body;
    const rawName = req.body.personName || req.body.name;
    const targetClass = req.params.file_name || source_csv || req.body.file_name || className || lop || null;

    // 1. Validate Họ tên bắt buộc
    if (!rawName || !rawName.trim()) {
      req.flash('error', 'Vui lòng nhập Họ và Tên.');
      return res.redirect(targetClass ? `/register/${targetClass}` : '/register');
    }
    const name = rawName.trim();

    const uploadedFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    // 2. Validate Ảnh bắt buộc
    if (!uploadedFile && !base64_image) {
      req.flash('error', 'Vui lòng chụp hoặc tải ảnh khuôn mặt.');
      return res.redirect(targetClass ? `/register/${targetClass}` : '/register');
    }

    // 3. Xử lý ảnh khuôn mặt qua Image Service (1280x738 contain JPEG 90)
    const processedImage = await imageService.processFaceImage({
      filePath: uploadedFile ? uploadedFile.path : null,
      base64String: base64_image || null
    });

    const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const publicImageUrl = `${baseUrl}/uploads/${processedImage.filename}`;

    // 4. Xác định Department ID từ DB classes phía Server (không tin cậy tuyệt đối client)
    let finalDeptID = departmentID || null;
    if (targetClass) {
      const classRow = await client.query('SELECT department_id FROM classes WHERE name = $1 LIMIT 1', [targetClass]);
      if (classRow.rows.length > 0 && classRow.rows[0].department_id) {
        finalDeptID = classRow.rows[0].department_id;
      }
    }
    if (!finalDeptID || finalDeptID === '0') finalDeptID = '990653'; // Mặc định Thiếu Nhi

    // 5. Xác minh danh tính & phân loại nghiệp vụ (Phòng ngừa sửa trái quyền)
    let targetAlias = (aliasID || '').trim();
    let targetPersonId = null;
    let finalTitle = title ? title.trim() : 'Học Sinh';
    let operationType = 'REGISTER_NEW'; // 'REGISTER_NEW' | 'UPDATE_PHOTO'
    let matchedPerson = null;

    if (targetAlias) {
      // 5.1 Trường hợp người dùng chọn hồ sơ có sẵn theo alias_id
      const existingRes = await client.query(
        `SELECT id, alias_id, person_id, name, class_name, department_id, title, sync_status 
         FROM persons 
         WHERE alias_id = $1 LIMIT 1`,
        [targetAlias]
      );

      if (existingRes.rows.length > 0) {
        matchedPerson = existingRes.rows[0];
        targetAlias = matchedPerson.alias_id;
        finalDeptID = matchedPerson.department_id || finalDeptID;
        finalTitle = matchedPerson.title || finalTitle;

        if (matchedPerson.person_id) {
          targetPersonId = matchedPerson.person_id;
          operationType = 'UPDATE_PHOTO';
        } else {
          operationType = 'REGISTER_NEW';
        }
      }
    }

    if (!matchedPerson) {
      // 5.2 Không có alias hoặc alias mới -> Tìm theo tên và lớp (chỉ khớp bản ghi chưa có person_id)
      const nameMatchRes = await client.query(
        `SELECT id, alias_id, person_id, name, class_name, department_id, title, sync_status 
         FROM persons 
         WHERE TRIM(LOWER(name)) = TRIM(LOWER($1)) 
           AND ($2::text IS NULL OR class_name = $2)
           AND (person_id IS NULL OR person_id = '')
         ORDER BY id ASC
         LIMIT 1`,
        [name, targetClass]
      );

      if (nameMatchRes.rows.length > 0) {
        matchedPerson = nameMatchRes.rows[0];
        targetAlias = matchedPerson.alias_id;
        finalDeptID = matchedPerson.department_id || finalDeptID;
        finalTitle = matchedPerson.title || finalTitle;
        operationType = 'REGISTER_NEW';
      } else {
        // 5.3 Tạo người mới hoàn toàn: Tự sinh mã alias chuẩn RULE-004
        let deptPrefix = 'TN';
        if (finalDeptID === '990730') deptPrefix = 'LM';
        else if (finalDeptID === '990731') deptPrefix = 'GT';
        else if (finalDeptID === '990732') deptPrefix = 'GTR';
        else if (finalDeptID === '990733') deptPrefix = 'HM';

        const cleanClass = (targetClass || 'CHUNG')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toUpperCase();

        // Kiểm tra tránh va chạm alias
        let isUnique = false;
        let attempts = 0;
        while (!isUnique && attempts < 5) {
          const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase();
          targetAlias = `${deptPrefix}_${cleanClass}_${randomSuffix}`;
          const checkRes = await client.query('SELECT id FROM persons WHERE alias_id = $1 LIMIT 1', [targetAlias]);
          if (checkRes.rows.length === 0) {
            isUnique = true;
          }
          attempts++;
        }
        operationType = 'REGISTER_NEW';
      }
    }

    // 6. Sinh Request ID duy nhất cho yêu cầu này
    const requestId = `req_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    // 7. Transaction ghi nhận vào PostgreSQL (PostgreSQL-First + Transactional Outbox)
    await client.query('BEGIN');

    // 7.1 Cập nhật hoặc Thêm mới bản ghi persons với trạng thái PENDING
    await client.query(
      `INSERT INTO persons (alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', CURRENT_TIMESTAMP)
       ON CONFLICT (alias_id) DO UPDATE SET
         face_url = EXCLUDED.face_url,
         sync_status = 'PENDING',
         updated_at = CURRENT_TIMESTAMP;`,
      [targetAlias, targetPersonId, name, targetClass, finalDeptID, finalTitle, publicImageUrl]
    );

    // 7.2 Lưu vết yêu cầu vào bảng registration_requests
    await client.query(
      `INSERT INTO registration_requests (
         request_id, alias_id, person_id, name, class_name, department_id, title,
         image_path, image_filename, public_image_url, operation_type, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'ACCEPTED');`,
      [
        requestId,
        targetAlias,
        targetPersonId,
        name,
        targetClass,
        finalDeptID,
        finalTitle,
        processedImage.processedPath,
        processedImage.filename,
        publicImageUrl,
        operationType
      ]
    );

    // 7.3 Lưu vào registration_outbox để đảm bảo tính bền vững nếu Redis tạm thời mất kết nối
    const queuePayload = {
      requestId,
      name,
      aliasID: targetAlias,
      title: finalTitle,
      departmentID: finalDeptID,
      imagePath: processedImage.processedPath,
      imageFilename: processedImage.filename,
      publicImageUrl,
      source_csv: targetClass,
      existing_person_id: targetPersonId || null,
      operation_type: operationType
    };

    const outboxRes = await client.query(
      `INSERT INTO registration_outbox (request_id, payload, status)
       VALUES ($1, $2, 'PENDING')
       RETURNING id;`,
      [requestId, JSON.stringify(queuePayload)]
    );

    await client.query('COMMIT');

    // 8. Đẩy vào Bull Queue (Giải phóng lock cũ trước nếu có yêu cầu thay ảnh mới)
    await idempotencyService.clearCompleted(
      operationType === 'UPDATE_PHOTO' ? 'PERSON_UPDATE' : 'FACE_REGISTER',
      operationType === 'UPDATE_PHOTO' ? targetPersonId : targetAlias
    );

    try {
      if (operationType === 'UPDATE_PHOTO' && targetPersonId) {
        await queueService.enqueueUpdatePerson({
          personID: targetPersonId,
          ...queuePayload
        });
      } else {
        await queueService.enqueueRegisterPerson(queuePayload);
      }

      // Đánh dấu outbox đã enqueued thành công
      await pool.query(
        `UPDATE registration_outbox SET status = 'ENQUEUED', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [outboxRes.rows[0].id]
      ).catch(() => {});
    } catch (queueErr) {
      console.warn(`⚠️ [Bull Queue Warning] Lỗi tạm thời khi enqueue (Outbox sẽ tự động phục hồi):`, queueErr.message);
    }

    req.flash('success', `Đã tiếp nhận thành công đăng ký cho "${name}" (Mã theo dõi: ${requestId}). Tiến trình đang được đồng bộ.`);
    
    // Nếu request yêu cầu JSON (API / AJAX)
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        requestId,
        aliasID: targetAlias,
        personID: targetPersonId,
        message: 'Đã tiếp nhận yêu cầu đăng ký'
      });
    }

    res.redirect(targetClass ? `/register/${targetClass}` : '/links');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[Register Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Lỗi đăng ký: ${msg}`);
    const redirectUrl = req.params.file_name || req.body?.source_csv || req.body?.file_name;
    res.redirect(redirectUrl ? `/register/${redirectUrl}` : '/register');
  } finally {
    client.release();
  }
};

// [READ] Kiểm tra trạng thái yêu cầu đăng ký theo Request ID (Dùng cho Polling/Reload UI)
exports.checkRegistrationStatus = async (req, res) => {
  const { requestId } = req.params;
  try {
    const result = await pool.query(
      `SELECT r.request_id, r.alias_id, r.person_id, r.name, r.class_name, r.operation_type,
              r.status, r.error_message, r.created_at, r.updated_at,
              p.sync_status, p.face_url
       FROM registration_requests r
       LEFT JOIN persons p ON r.alias_id = p.alias_id
       WHERE r.request_id = $1
       LIMIT 1`,
      [requestId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Không tìm thấy yêu cầu đăng ký.' });
    }

    const row = result.rows[0];
    res.json({
      success: true,
      requestId: row.request_id,
      aliasID: row.alias_id,
      personID: row.person_id,
      name: row.name,
      className: row.class_name,
      status: row.status, // ACCEPTED, PROCESSING, SYNCED, REVIEW_REQUIRED, FAILED
      syncStatus: row.sync_status,
      faceUrl: row.face_url,
      errorMessage: row.error_message,
      updatedAt: row.updated_at
    });
  } catch (err) {
    console.error('[checkRegistrationStatus Error]', err.message);
    res.status(500).json({ success: false, error: err.message });
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
  const targetId = req.params.personID || req.params.id || req.body.personID;
  const { name, aliasID, title, departmentID, base64_image } = req.body;

  if (!name || !name.trim()) {
    req.flash('error', 'Vui lòng nhập Họ và Tên.');
    return res.redirect(`/edit/${targetId}`);
  }

  try {
    const personRes = await pool.query(
      `SELECT id, name, alias_id, person_id, class_name, department_id, title, face_url, sync_status 
       FROM persons 
       WHERE person_id = $1 OR alias_id = $1 OR id::text = $1 
       LIMIT 1`,
      [String(targetId)]
    );

    const existingPerson = personRes.rows[0] || null;

    let currentDeptId = departmentID || existingPerson?.department_id || null;
    if (!currentDeptId || currentDeptId === '0' || currentDeptId === 'null' || currentDeptId === 'undefined') {
      currentDeptId = '990653';
    }

    const targetPersonId = existingPerson?.person_id || (/^\d{10,}$/.test(String(targetId)) ? String(targetId) : null);
    const targetAliasId = (aliasID && aliasID.trim()) ? aliasID.trim() : (existingPerson?.alias_id || '');
    const targetTitle = (title && title.trim()) ? title.trim() : (existingPerson?.title || 'Học Sinh');
    const targetName = name.trim();

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

    // Cập nhật Database PostgreSQL
    await pool.query(
      `UPDATE persons
       SET name = $1,
           title = $2,
           alias_id = COALESCE(NULLIF($3, ''), alias_id),
           face_url = COALESCE($4, face_url),
           department_id = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 OR alias_id = $7 OR person_id = $7`,
      [
        targetName,
        targetTitle,
        targetAliasId,
        publicImageUrl,
        currentDeptId,
        existingPerson ? existingPerson.id : null,
        String(targetId)
      ]
    );

    // Đồng bộ trực tiếp lên HANET Cloud
    if (targetPersonId) {
      try {
        const hanetRes = await hanetService.updatePerson(
          targetPersonId,
          targetName,
          targetAliasId,
          currentDeptId,
          targetTitle
        );

        if (hanetRes && (hanetRes.returnCode === 1 || hanetRes.returnCode === '1')) {
          console.log(`[HANET Sync] Cập nhật thành công personID ${targetPersonId}`);
        }
      } catch (hanetErr) {
        console.warn(`[HANET Sync Error]`, hanetErr.message);
      }
    }

    // Đẩy job cập nhật ảnh vào Queue nếu có ảnh mới
    if (imagePath || publicImageUrl) {
      await idempotencyService.clearCompleted('PERSON_UPDATE', targetPersonId || targetId);
      await queueService.enqueueUpdatePerson({
        personID: targetPersonId || targetId,
        name: targetName,
        aliasID: targetAliasId,
        title: targetTitle,
        departmentID: currentDeptId,
        imagePath,
        imageFilename,
        publicImageUrl
      });
    }

    req.flash('success', `Đã cập nhật thông tin cho "${targetName}".`);
    res.redirect('/admin/person/list');
  } catch (err) {
    console.error('[Update Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Không thể cập nhật nhân sự: ${msg}`);
    res.redirect(`/edit/${targetId}`);
  }
};

// [DELETE] Xử lý Xóa Nhân sự trên HANET Cloud & PostgreSQL
exports.handleDelete = async (req, res, next) => {
  const personID = req.params.personID || req.params.id || req.body.personID;

  if (!personID) {
    req.flash('error', 'Không tìm thấy ID nhân sự để xóa.');
    return res.redirect('/admin/person/list');
  }

  try {
    await pool.query('DELETE FROM persons WHERE alias_id = $1 OR person_id = $1', [String(personID)]);
    const result = await hanetService.removePerson(personID);

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
