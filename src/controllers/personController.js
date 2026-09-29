const fs = require('fs');
const path = require('path');
const hanetService = require('../services/hanetService');
const imageService = require('../services/imageService');
const queueService = require('../services/queueService');
const csvService = require('../services/csvService');
const { getErrorMessage } = require('../utils/hanetErrorMap');

// [READ] Danh sách Nhân sự từ Cloud
exports.listPersons = async (req, res, next) => {
  try {
    const [personRes, deptRes] = await Promise.all([
      hanetService.getListByPlace(),
      hanetService.getDepartmentList(1, 100).catch(() => ({ data: [] }))
    ]);
    const persons = personRes?.data || [];
    const depts = deptRes?.data?.hits || (Array.isArray(deptRes?.data) ? deptRes.data : []);
    const deptMap = {
      '990653': 'Thiếu Nhi',
      '990730': 'Legiô Mariae',
      '990731': 'Giới Trẻ',
      '990735': 'Gia Trưởng',
      '990736': 'Hiền Mẫu'
    };
    depts.forEach(d => {
      const id = d.id || d.department_id;
      const name = d.name || d.department_name;
      if (id && name) deptMap[String(id)] = name;
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

// [READ] Danh Sách Link Đăng Ký theo Danh Mục CSV
exports.viewLinks = (req, res) => {
  try {
    const dataDir = path.join(__dirname, '../../data');
    const targetDir = fs.existsSync(dataDir) ? dataDir : path.join(process.cwd(), 'data');

    let links = [];
    if (fs.existsSync(targetDir)) {
      // Danh sách đen các tên file rác cần loại bỏ tuyệt đối
      const blacklist = ['mariae.csv', 'nhi.csv', 'thiếu.csv', 'lêgiô.csv', 'thieu.csv', 'legio.csv'];

      const files = fs.readdirSync(targetDir)
        .filter(f => {
          // 1. Phải là file đuôi .csv
          if (!f.toLowerCase().endsWith('.csv')) return false;

          // 2. Bỏ qua các file backup
          if (f.toLowerCase().includes('.bak')) return false;

          // 3. Bỏ qua file ẩn hệ thống (macOS ._ hoặc Linux .)
          if (f.startsWith('.') || f.startsWith('._')) return false;

          // 4. Bỏ qua các file trong danh sách đen
          if (blacklist.includes(f.toLowerCase())) return false;

          return true;
        })
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

      const baseUrl = (process.env.BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');

      links = files.map(file => {
        const slug = file.replace(/\.csv$/i, '');
        return {
          fileName: file,
          name: slug,
          url: `${baseUrl}/register/${encodeURIComponent(slug)}`
        };
      });
    }

    res.render('links', {
      links,
      title: 'Danh Sách Link Đăng Ký Theo Lớp'
    });
  } catch (err) {
    console.error('[viewLinks Error]', err.message);
    res.render('links', {
      links: [],
      title: 'Danh Sách Link Đăng Ký Theo Lớp',
      error: 'Không thể tải danh sách link.'
    });
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

// [CREATE - CSV] Render Form Đăng ký theo danh mục CSV
/**
 * Render form đăng ký Face ID tối ưu Zalo theo file CSV danh mục
 * Endpoint: GET /register/:file_name
 */
exports.viewRegisterByFile = async (req, res) => {
  const fileName = req.params.file_name;
  try {
    const csvList = await csvService.readList(fileName);
    
    // Fail-soft: nếu file rỗng hoặc không tồn tại vẫn render, cảnh báo nhẹ qua flash
    if (!csvList || csvList.length === 0) {
      req.flash('warning', `Danh sách "${fileName}" hiện chưa có dữ liệu hoặc file không tồn tại.`);
    }

    res.render('person/register_csv', {
      fileName,
      csvList: csvList || [],
      title: `Đăng Ký Face ID - ${fileName}`
    });
  } catch (err) {
    console.error('[viewRegisterByFile Error]', err.message);
    req.flash('error', `Không thể tải danh mục đăng ký: ${err.message}`);
    res.redirect('/');
  }
};

// [CREATE] Xử lý Đăng ký Nhân sự mới
exports.handleRegister = async (req, res, next) => {
  try {
    const { aliasID, title, departmentID, base64_image, source_csv, departmentName, lop, className, existing_person_id } = req.body;
    const name = req.body.personName || req.body.name;
    const fileName = req.params.file_name || source_csv || req.body.file_name || className || lop;

    // Validate Họ tên bắt buộc
    if (!name || !name.trim()) {
      req.flash('error', 'Vui lòng nhập Họ và Tên.');
      return res.redirect(fileName ? `/register/${fileName}` : '/register');
    }

    const uploadedFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);

    // Validate Ảnh bắt buộc
    if (!uploadedFile && !base64_image) {
      req.flash('error', 'Vui lòng chụp hoặc tải ảnh khuôn mặt.');
      return res.redirect(fileName ? `/register/${fileName}` : '/register');
    }

    const processedImage = await imageService.processFaceImage({
      filePath: uploadedFile ? uploadedFile.path : null,
      base64String: base64_image || null
    });

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const publicImageUrl = `${baseUrl.replace(/\/$/, '')}/uploads/${processedImage.filename}`;

    await queueService.enqueueRegisterPerson({
      name: name.trim(),
      aliasID: aliasID ? aliasID.trim() : '',
      title: title ? title.trim() : 'Nhân viên',
      departmentID: departmentID || null,
      imagePath: processedImage.processedPath,
      imageFilename: processedImage.filename,
      publicImageUrl,
      source_csv: fileName || null,
      existing_person_id: existing_person_id || null
    });

    const deptMsg = departmentID ? ' và gán vào phòng ban đã chọn' : '';
    req.flash('success', `Đã nhận yêu cầu đăng ký cho "${name}"${deptMsg}. Tiến trình xử lý đang chạy ngầm.`);
    res.redirect(fileName ? `/register/${fileName}` : '/');
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
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Lỗi truy xuất thông tin nhân sự: ${msg}`);
    res.redirect('/');
  }
};

// [UPDATE] Xử lý Cập nhật Thông tin / Face ID lên Cloud
exports.handleUpdate = async (req, res, next) => {
  try {
    const { personID } = req.params;
    const { name, aliasID, title, departmentID, base64_image } = req.body;

    // Validate Họ tên bắt buộc
    if (!name || !name.trim()) {
      req.flash('error', 'Vui lòng nhập Họ và Tên.');
      return res.redirect(`/edit/${personID}`);
    }

    // 1. Lấy thông tin person hiện tại để so sánh department
    const listRes = await hanetService.getListByPlace();
    const person = listRes?.data?.find(p => String(p.personID || p.id) === String(personID));
    const oldDeptID = person?.departmentID && String(person.departmentID) !== '0'
      ? String(person.departmentID)
      : null;
    const newDeptID = departmentID && String(departmentID) !== '0' ? String(departmentID) : null;

    console.log(`[handleUpdate] Person ${personID} | oldDept=${oldDeptID} → newDept=${newDeptID}`);

    // 2. Cập nhật thông tin cơ bản + face nếu có (qua queue)
    let updatePayload = {
      personID,
      name: name.trim(),
      aliasID: aliasID ? aliasID.trim() : '',
      title: title ? title.trim() : 'Nhân viên',
      departmentID: newDeptID || oldDeptID || null
    };

    const uploadedUpdateFile = req.file || (req.files && req.files.length > 0 ? req.files[0] : null);
    if (uploadedUpdateFile || base64_image) {
      const processedImage = await imageService.processFaceImage({
        filePath: uploadedUpdateFile ? uploadedUpdateFile.path : null,
        base64String: base64_image || null
      });
      const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
      updatePayload.imagePath = processedImage.processedPath;
      updatePayload.imageFilename = processedImage.filename;
      updatePayload.publicImageUrl = `${baseUrl.replace(/\/$/, '')}/uploads/${processedImage.filename}`;
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
          const errCode = addRes.returnCode;
          deptMsg = ` ⚠️ Gán phòng ban lỗi: ${getErrorMessage(errCode, addRes.returnMessage)}`;
        }
      } catch (err) {
        console.error(`[handleUpdate] Lỗi add-person:`, err.message);
        const code = err.response?.data?.returnCode;
        deptMsg = ` ⚠️ Lỗi gán phòng ban: ${getErrorMessage(code, err.message)}`;
      }
    } else if (newDeptID === oldDeptID && newDeptID) {
      deptMsg = ' (Không thay đổi phòng ban).';
    }

    req.flash('success', `Đã cập nhật nhân sự "${name}".${deptMsg}`);
    res.redirect('/');
  } catch (err) {
    console.error('[Update Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Không thể cập nhật nhân sự: ${msg}`);
    res.redirect(`/edit/${req.params.personID}`);
  }
};

// [DELETE] Xử lý Xóa Nhân sự trên HANET Cloud & Đồng bộ CSV
exports.handleDelete = async (req, res, next) => {
  const personID = req.params.personID || req.params.id || req.body.personID;
  const personName = req.body.personName || req.body.name || '';

  if (!personID) {
    req.flash('error', 'Không tìm thấy ID nhân sự để xóa.');
    return res.redirect('/');
  }

  try {
    // 1. Gọi API xóa nhân sự trên HANET Cloud
    const result = await hanetService.removePerson(personID);

    if (result && result.returnCode === 1) {
      // 2. Tự động reset Face ID & PersonID trong các file CSV (Đồng bộ 2 chiều)
      const updatedCsvFiles = csvService.removePersonFromCsv(personID, personName);
      const csvNote = updatedCsvFiles.length > 0 
        ? ` và đã đồng bộ xóa trong file danh mục (${updatedCsvFiles.join(', ')})` 
        : '';

      req.flash('success', `Đã xóa thành công nhân sự [ID: ${personID}] khỏi HANET Cloud${csvNote}.`);
    } else {
      const errorMsg = getErrorMessage(result?.returnCode, result?.returnMessage);
      req.flash('error', `Lỗi từ HANET Cloud: ${errorMsg}`);
    }

    res.redirect('/');
  } catch (err) {
    console.error('[Delete Error]', err.message);
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Không thể xóa nhân sự: ${msg}`);
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
    const code = err.response?.data?.returnCode;
    const msg = getErrorMessage(code, err.message);
    req.flash('error', `Lỗi truy xuất lịch sử check-in: ${msg}`);
    res.render('person/checkin', { title: 'Nhật ký Check-in', logs: [] });
  }
};
