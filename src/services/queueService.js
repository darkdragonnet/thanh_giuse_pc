const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Queue = require('bull');
const hanetService = require('./hanetService');
const imageService = require('./imageService');
const csvService = require('./csvService');
const idempotencyService = require('./idempotencyService');
const { getErrorMessage } = require('../utils/hanetErrorMap');

// Danh sách mã lỗi không thể phục hồi bằng retry tự động (lỗi tham số, lỗi ảnh, lỗi quyền)
const NON_RETRIABLE_CODES = new Set([
  -1, -1005, -2035, -5005, -5006, -5010, -5011, -9002, -9005, -9006, -9008
]);

// Map tĩnh phòng ban chuẩn hóa theo quy chuẩn nghiệp vụ
const STATIC_DEPT_MAP = {
  'thiếu nhi': '990653',
  'thieu nhi': '990653',
  'legiô mariae': '990730',
  'legio mariae': '990730',
  'giới trẻ': '990731',
  'gioi tre': '990731'
};

/**
 * Sinh 4 ký tự ngẫu nhiên gồm chữ cái in hoa và số (A-Z, 0-9)
 */
function generateRandomSuffix(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Chuẩn hóa tên lớp cho AliasID:
 * - Viết hoa toàn bộ không dấu
 * - Ghép liền tên khối và phân lớp, loại bỏ hoàn toàn dấu gạch dưới (_) và khoảng trắng
 * Ví dụ: 'ThemSuc_1a' -> 'THEMSUC1A', 'XungToi_2a' -> 'XUNGTOI2A', 'BaoDong_3' -> 'BAODONG3'
 */
function normalizeClassNameForAlias(className) {
  if (!className) return '';
  return className
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '') // Loại bỏ triệt để _, space, ký tự lạ
    .toUpperCase()
    .trim();
}

/**
 * Chuẩn hóa động Phòng Ban, Chức Vụ và Alias chuẩn HANET Cloud:
 * Định dạng: [MÃ_PHÒNG_BAN]_[TÊN_LỚP]_[MÃ_ĐỊNH_DANH] (3 phần nối bằng 2 dấu gạch dưới)
 * Ví dụ: TN_THEMSUC1A_4BDI, TN_GLV_FNWD, LM_DMHCCC_I2SG
 * @param {string} className Tên lớp / nhóm (VD: GLV, ThemSuc_1a, DMHCCC, GioiTre)
 * @param {string} inputTitle Chức vụ do người dùng nhập hoặc chọn
 * @param {string|number} inputDeptID ID phòng ban truyền vào (nếu có)
 * @param {string} inputAlias Alias truyền vào (nếu có)
 * @returns {Promise<{ departmentName: string, targetDeptID: string, title: string, aliasID: string }>}
 */
async function resolveDepartmentAndAlias(className, inputTitle = '', inputDeptID = '', inputAlias = '') {
  const cleanClass = (className || '').replace(/\.csv$/i, '').trim();
  const normalizedClass = normalizeClassNameForAlias(cleanClass);

  // 1. Đọc dữ liệu từ file CSV mẫu trong data/ nếu có
  let csvDept = '';
  let csvTitle = '';
  if (cleanClass) {
    const dataDir = path.join(process.cwd(), 'data');
    const filePath = path.join(dataDir, `${cleanClass}.csv`);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
        if (lines.length > 1) {
          const lastLineParts = lines[lines.length - 1].split(',');
          if (lastLineParts.length >= 4) {
            csvDept = lastLineParts[2]?.trim() || '';
            csvTitle = lastLineParts[3]?.trim() || '';
          }
        }
      } catch (e) {
        console.warn(`[resolveDepartmentAndAlias] Không thể đọc mẫu CSV ${cleanClass}:`, e.message);
      }
    }
  }

  // 2. Xác định Chức Vụ (Title)
  let resolvedTitle = (inputTitle || '').trim();
  if (!resolvedTitle) {
    if (cleanClass.toUpperCase() === 'GLV' || normalizedClass === 'GLV') {
      resolvedTitle = 'Giáo Lý Viên';
    } else if (cleanClass.toUpperCase() === 'DMHCCC' || normalizedClass === 'DMHCCC') {
      resolvedTitle = 'Hội Viên';
    } else {
      resolvedTitle = csvTitle || 'Học Sinh';
    }
  }

  // 3. Xác định Phòng Ban (Department)
  let departmentName = csvDept || 'Thiếu Nhi';
  let targetDeptID = String(inputDeptID || '').trim();

  // Quy chuẩn: Cả Giáo Lý Viên (GLV) và Học Sinh đều thuộc CHUNG phòng ban 'Thiếu Nhi' (ID: 990653)
  if (normalizedClass === 'GLV' || /^(themsuc|xungtoi|baodong|khaitam|vaodoi)/i.test(normalizedClass)) {
    departmentName = 'Thiếu Nhi';
    targetDeptID = '990653';
  } else if (normalizedClass === 'DMHCCC' || /mariae/i.test(departmentName)) {
    departmentName = 'Legiô Mariae';
    targetDeptID = '990730';
  } else if (/giới trẻ|gioi tre/i.test(departmentName) || normalizedClass.includes('GIOITRE')) {
    departmentName = 'Giới Trẻ';
    targetDeptID = '990731';
  } else if (STATIC_DEPT_MAP[departmentName.toLowerCase()]) {
    targetDeptID = STATIC_DEPT_MAP[departmentName.toLowerCase()];
  }

  // Dynamic matching từ hanetService.getDepartmentList() nếu chưa có targetDeptID
  if (!targetDeptID || targetDeptID === '0') {
    try {
      const deptRes = await hanetService.getDepartmentList();
      const hits = deptRes?.data?.hits || [];
      const matchedDept = hits.find(d => 
        (d.name || '').trim().toLowerCase() === departmentName.toLowerCase() ||
        (d.title || '').trim().toLowerCase() === departmentName.toLowerCase()
      );
      if (matchedDept && matchedDept.id) {
        targetDeptID = String(matchedDept.id);
      }
    } catch (err) {
      console.warn('[resolveDepartmentAndAlias] Dynamic department lookup error:', err.message);
    }
  }

  // Fallback an toàn
  if (!targetDeptID || targetDeptID === '0') {
    targetDeptID = '990653'; // Mặc định Thiếu Nhi
  }

  // 4. Sinh Tiền Tố Alias & Mã AliasID chuẩn gồm đúng 3 phần: [MÃ_PHÒNG_BAN]_[TÊN_LỚP]_[MÃ_ĐỊNH_DANH]
  let deptCode = 'TN';
  let classCode = normalizedClass || 'CHUNG';

  if (normalizedClass === 'GLV') {
    deptCode = 'TN';
    classCode = 'GLV';
  } else if (targetDeptID === '990653' || departmentName.toLowerCase().includes('thiếu nhi')) {
    deptCode = 'TN';
    classCode = normalizedClass || 'CHUNG';
  } else if (targetDeptID === '990730' || departmentName.toLowerCase().includes('mariae')) {
    deptCode = 'LM';
    classCode = normalizedClass || 'DMHCCC';
  } else if (targetDeptID === '990731' || departmentName.toLowerCase().includes('trẻ')) {
    deptCode = 'GT';
    classCode = normalizedClass || 'GIOITRE';
  } else if (departmentName.toLowerCase().includes('gia trưởng')) {
    deptCode = 'GTR';
    classCode = normalizedClass || 'GIATRUONG';
  } else if (departmentName.toLowerCase().includes('hiền mẫu')) {
    deptCode = 'HM';
    classCode = normalizedClass || 'HIENMAU';
  } else {
    deptCode = departmentName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase())
      .join('') || 'PB';
    classCode = normalizedClass || 'MEMBER';
  }

  const aliasPrefix = `${deptCode}_${classCode}_`;
  const randomSuffix = generateRandomSuffix(4);

  let finalAliasID = '';
  if (inputAlias && inputAlias.trim()) {
    let custom = inputAlias.trim().toUpperCase().replace(/\s+/g, '_');
    // Nếu alias cũ chứa số tuần tự dạng _00xx hoặc chứa _ trong tên lớp, chuẩn hoá sang format mới
    const parts = custom.split('_');
    if (parts.length >= 3 && /^00[0-9A-Z]{2}$/i.test(parts[parts.length - 1])) {
      parts[parts.length - 1] = randomSuffix;
      custom = parts.join('_');
    }
    finalAliasID = custom;
  } else {
    finalAliasID = `${aliasPrefix}${randomSuffix}`;
  }

  return {
    departmentName,
    targetDeptID,
    title: resolvedTitle,
    aliasID: finalAliasID
  };
}

// Khởi tạo Bull Queue chạy trên Redis DB 4
const hanetQueue = new Queue('hanet-sync', {
  redis: {
    host: process.env.REDIS_HOST || 'redis',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    db: parseInt(process.env.REDIS_DB || '4', 10)
  },
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 3000 // 3s, 6s, 12s, 24s, 48s
    },
    removeOnComplete: 100,
    removeOnFail: 200
  }
});

/**
 * Trích xuất personID linh hoạt từ phản hồi lỗi hoặc dữ liệu của HANET Cloud
 */
function extractPersonIDFromHanet(resOrErr) {
  if (!resOrErr) return null;
  if (typeof resOrErr === 'string' && /^[0-9]+$/.test(resOrErr.trim())) return resOrErr.trim();
  if (resOrErr.personID) return String(resOrErr.personID).trim();
  if (resOrErr.id) return String(resOrErr.id).trim();

  // Kiểm tra thuộc tính data
  if (resOrErr.data) {
    if (typeof resOrErr.data === 'string' && /^[0-9]+$/.test(resOrErr.data.trim())) return resOrErr.data.trim();
    if (resOrErr.data.personID) return String(resOrErr.data.personID).trim();
    if (resOrErr.data.id) return String(resOrErr.data.id).trim();
  }

  // Kiểm tra response từ axios error
  if (resOrErr.response?.data) {
    const d = resOrErr.response.data;
    if (typeof d === 'string' && /^[0-9]+$/.test(d.trim())) return d.trim();
    if (d.personID) return String(d.personID).trim();
    if (d.id) return String(d.id).trim();
    if (d.data) {
      if (typeof d.data === 'string' && /^[0-9]+$/.test(d.data.trim())) return d.data.trim();
      if (d.data.personID) return String(d.data.personID).trim();
      if (d.data.id) return String(d.data.id).trim();
    }
  }

  return null;
}

/**
 * Xử lý luồng Fallback khi gặp lỗi -9007 (Khuôn mặt đã tồn tại)
 */
async function handleFaceExistsFallback({
  extractedPersonID,
  name,
  finalTitle,
  finalAlias,
  finalDeptID,
  resolvedDepartmentName,
  faceUrl,
  publicImageUrl,
  finalAvatarUrl,
  targetClass
}) {
  let personId = extractedPersonID;

  // Nếu chưa có personID, thử tra cứu lại qua AliasID trên HANET Cloud
  if (!personId && finalAlias) {
    try {
      const aliasRes = await hanetService.getPersonByAliasID(finalAlias);
      personId = extractPersonIDFromHanet(aliasRes);
    } catch (e) {
      console.warn(`[QueueService] Tra cứu personID qua AliasID ${finalAlias} không thành công:`, e.message);
    }
  }

  console.log('[QueueService] Phát hiện mã -9007, chuyển hướng cập nhật thông tin cho personID:', personId || 'Không xác định');

  const targetFaceUrl = faceUrl || publicImageUrl;

  // 1. Cập nhật ảnh khuôn mặt mới (Face ID)
  if (targetFaceUrl && personId) {
    try {
      await hanetService.updateByFaceUrl({
        personID: personId,
        faceUrl: targetFaceUrl,
        aliasID: finalAlias
      });
      console.log(`[QueueService] ✅ Đã cập nhật ảnh Face ID mới cho personID: ${personId}`);
    } catch (faceErr) {
      const errCode = faceErr.response?.data?.returnCode;
      console.warn(`[QueueService] Cập nhật Face ID thất bại:`, getErrorMessage(errCode, faceErr.message));
    }
  }

  // 2. Cập nhật thông tin cá nhân với payload chuẩn hóa
  if (personId) {
    try {
      await hanetService.updateInfo({
        personID: personId,
        name,
        title: finalTitle,
        aliasID: finalAlias,
        departmentID: finalDeptID
      });
      console.log(`[QueueService] ✅ Đã cập nhật thông tin cho personID: ${personId}`);
    } catch (infoErr) {
      const errCode = infoErr.response?.data?.returnCode;
      console.warn(`[QueueService] Cập nhật info thất bại:`, getErrorMessage(errCode, infoErr.message));
    }
  }

  // 3. Khóa phòng ban chuẩn
  if (finalDeptID && personId) {
    try {
      await hanetService.addPersonsToDepartment(finalDeptID, personId);
      console.log(`[QueueService] ✅ Đã khóa phòng ban ${finalDeptID} (${resolvedDepartmentName}) cho personID: ${personId}`);
    } catch (deptErr) {
      console.warn(`[QueueService] Gán phòng ban thất bại:`, deptErr.message);
    }
  }

  // 4. Ghi ngược thông tin đăng ký vào file CSV
  if (targetClass && personId) {
    try {
      await csvService.writeBackRegistration(targetClass, name, targetFaceUrl || finalAvatarUrl, personId, finalTitle);
    } catch (csvErr) {
      console.warn(`[QueueService] Ghi ngược CSV thất bại:`, csvErr.message);
    }
  }

  return {
    returnCode: 1,
    returnMessage: 'Cập nhật Face ID thành công (Khuôn mặt đã tồn tại trên hệ thống)',
    personID: personId,
    updated: true
  };
}

// Xử lý Job đăng ký nhân sự ngầm
hanetQueue.process('register_person_job', 2, async (job) => {
  const { name, aliasID, title, departmentID, imagePath, publicImageUrl, imageFilename, source_csv, className, class_name, existing_person_id } = job.data;
  const targetClass = source_csv || className || class_name || null;
  const fallbackBaseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  const faceUrl = publicImageUrl || (imageFilename ? `${fallbackBaseUrl}/uploads/${imageFilename}` : null);

  // 1. Chuẩn hóa động Phòng Ban, Chức Vụ và Alias
  const resolved = await resolveDepartmentAndAlias(targetClass, title, departmentID, aliasID);
  const finalAlias = resolved.aliasID;
  const finalTitle = resolved.title;
  const finalDeptID = resolved.targetDeptID;

  // 2. Kiểm tra Idempotency Lock bằng Redis SETNX
  const lockKey = idempotencyService.generateKey('FACE_REGISTER', finalAlias);
  const currentStatus = await idempotencyService.getLockStatus(lockKey);

  if (currentStatus === 'COMPLETED') {
    console.log(`[IDEMPOTENCY] Bỏ qua tác vụ đã hoàn tất cho AliasID: ${finalAlias}`);
    return {
      status: 'SKIPPED_ALREADY_COMPLETED',
      returnCode: 1,
      returnMessage: 'Tác vụ đã được xử lý hoàn tất trước đó',
      aliasID: finalAlias,
      personID: existing_person_id || null
    };
  }

  const acquired = await idempotencyService.acquireLock(lockKey, 120);
  if (!acquired) {
    console.warn(`[CONCURRENCY] Job cho ${finalAlias} đang được xử lý bởi worker khác.`);
    throw new Error(`[CONCURRENCY] Job cho ${finalAlias} đang được xử lý bởi worker khác.`);
  }

  console.log(`[Queue register_person_job] Bắt đầu xử lý: ${name} (${finalAlias}) | Chức vụ: ${finalTitle} | Phòng ban: ${resolved.departmentName} (${finalDeptID})`);

  let finalPersonID = existing_person_id || null;
  let finalAvatarUrl = faceUrl;

  try {
    try {
      // 3. Thử gọi API đăng ký nhân sự (ưu tiên binary multipart nếu có imagePath, hoặc bằng URL)
      let registerRes;
      if (imagePath && fs.existsSync(imagePath)) {
        registerRes = await hanetService.registerPerson({
          name,
          aliasID: finalAlias,
          title: finalTitle,
          departmentID: finalDeptID,
          imagePath,
          publicImageUrl,
          faceUrl
        });
      } else {
        registerRes = await hanetService.registerPersonByUrl({
          name,
          aliasID: finalAlias,
          title: finalTitle,
          departmentID: finalDeptID,
          faceUrl: faceUrl || publicImageUrl
        });
      }

      if (registerRes && registerRes.returnCode === 1) {
        finalPersonID = registerRes.data?.personID || registerRes.data?.id;
        finalAvatarUrl = registerRes.data?.avatar || registerRes.data?.faceUrl || faceUrl;
        console.log(`[Queue register_person_job] ✅ Đăng ký mới thành công: ${finalPersonID}`);

        // Tự động gán phòng ban chuẩn trên Cloud
        if (finalDeptID && finalPersonID) {
          try {
            await hanetService.addPersonsToDepartment(finalDeptID, finalPersonID);
            console.log(`[Queue register_person_job] ✅ Đã khóa phòng ban ${finalDeptID} (${resolved.departmentName}) cho ${finalPersonID}`);
          } catch (deptErr) {
            console.warn(`[Queue register_person_job] Gán phòng ban lỗi:`, deptErr.message);
          }
        }

        // Tự động ghi ngược thông tin đăng ký vào file CSV
        if (targetClass && finalPersonID) {
          await csvService.writeBackRegistration(targetClass, name, finalAvatarUrl, finalPersonID, finalTitle);
        }

        // Đánh dấu hoàn tất trong Redis 24h
        await idempotencyService.markCompleted(lockKey, 86400);

        return { returnCode: 1, returnMessage: 'Success', personID: finalPersonID, aliasID: finalAlias };
      } else if (registerRes && registerRes.returnCode === -9007) {
        // Trường hợp HANET trả HTTP 200 kèm returnCode -9007 (Đã tồn tại khuôn mặt)
        const extractedId = extractPersonIDFromHanet(registerRes) || finalPersonID;
        const fallbackResult = await handleFaceExistsFallback({
          extractedPersonID: extractedId,
          name,
          finalTitle,
          finalAlias,
          finalDeptID,
          resolvedDepartmentName: resolved.departmentName,
          faceUrl,
          publicImageUrl,
          finalAvatarUrl,
          targetClass
        });

        // Đánh dấu hoàn tất trong Redis 24h
        await idempotencyService.markCompleted(lockKey, 86400);

        return fallbackResult;
      } else {
        const errorMsg = getErrorMessage(registerRes?.returnCode, registerRes?.returnMessage);
        const code = Number(registerRes?.returnCode);

        // Kiểm tra nếu là lỗi vĩnh viễn -> không retry vô ích
        if (NON_RETRIABLE_CODES.has(code)) {
          console.error(`[Queue register_person_job] ❌ Lỗi không thể retry (Mã ${code}): ${errorMsg}`);
          return { returnCode: code, returnMessage: errorMsg, error: true };
        }

        // Lỗi tạm thời -> giải phóng lock để Bull Queue retry
        await idempotencyService.releaseLock(lockKey);
        throw new Error(`[Mã lỗi ${registerRes?.returnCode}]: ${errorMsg}`);
      }
    } catch (apiErr) {
      const errData = apiErr.response?.data;
      const code = Number(errData?.returnCode || apiErr.code);

      // 4. Xử lý lỗi -9007 qua Catch block
      if (code === -9007 || (errData && errData.returnCode === -9007)) {
        const extractedId = extractPersonIDFromHanet(apiErr) || finalPersonID;
        const fallbackResult = await handleFaceExistsFallback({
          extractedPersonID: extractedId,
          name,
          finalTitle,
          finalAlias,
          finalDeptID,
          resolvedDepartmentName: resolved.departmentName,
          faceUrl,
          publicImageUrl,
          finalAvatarUrl,
          targetClass
        });

        // Đánh dấu hoàn tất trong Redis 24h
        await idempotencyService.markCompleted(lockKey, 86400);

        return fallbackResult;
      } else {
        const errorMsg = getErrorMessage(code, apiErr.message);
        console.error(`[Queue register_person_job] Lỗi khi xử lý: ${errorMsg}`);

        if (NON_RETRIABLE_CODES.has(code)) {
          console.error(`[Queue register_person_job] ❌ Bỏ qua retry cho mã lỗi ${code}`);
          return { returnCode: code, returnMessage: errorMsg, error: true };
        }

        // Lỗi tạm thời -> giải phóng lock để Bull Queue retry
        await idempotencyService.releaseLock(lockKey);
        throw apiErr;
      }
    }

  } finally {
    // [RULE-022] Luôn delay 30 giây mới dọn dẹp ảnh để HANET fetch xong
    if (imagePath) {
      imageService.cleanupDelayed(imagePath, 30000);
    }
  }
});

// Xử lý Job cập nhật nhân sự ngầm
hanetQueue.process('update_person_job', 3, async (job) => {
  const { personID, name, aliasID, title, departmentID, imagePath, publicImageUrl, imageFilename } = job.data;
  const lockKey = idempotencyService.generateKey('PERSON_UPDATE', personID);

  // 1. Kiểm tra Idempotency Lock
  const currentStatus = await idempotencyService.getLockStatus(lockKey);
  if (currentStatus === 'COMPLETED') {
    console.log(`[IDEMPOTENCY] Bỏ qua tác vụ cập nhật đã hoàn tất cho PersonID: ${personID}`);
    return { status: 'SKIPPED_ALREADY_COMPLETED', success: true, personID };
  }

  const acquired = await idempotencyService.acquireLock(lockKey, 120);
  if (!acquired) {
    console.warn(`[CONCURRENCY] Job cập nhật cho ${personID} đang được xử lý bởi worker khác.`);
    throw new Error(`[CONCURRENCY] Job cập nhật cho ${personID} đang được xử lý bởi worker khác.`);
  }

  console.log(`[Queue update_person_job] Bắt đầu xử lý: ${name} (${personID})`);

  try {
    try {
      // 2. Cập nhật thông tin cơ bản
      const infoResult = await hanetService.updateInfo({
        personID,
        name,
        aliasID,
        title,
        departmentID
      });

      if (infoResult.returnCode !== 1) {
        const errorMsg = getErrorMessage(infoResult.returnCode, infoResult.returnMessage);
        const code = Number(infoResult.returnCode);
        if (NON_RETRIABLE_CODES.has(code)) {
          console.error(`[Queue update_person_job] ❌ Lỗi không thể retry (Mã ${code}): ${errorMsg}`);
          return { returnCode: code, returnMessage: errorMsg, error: true };
        }
        await idempotencyService.releaseLock(lockKey);
        throw new Error(`[Mã lỗi ${infoResult.returnCode}]: ${errorMsg}`);
      }

      // Gán phòng ban để khóa liên kết phòng ban 100% trên HANET Cloud
      if (departmentID && String(departmentID) !== '0') {
        try {
          await hanetService.addPersonsToDepartment(departmentID, personID);
          console.log(`[Queue update_person_job] ✅ Đã khóa liên kết phòng ban ${departmentID} cho PersonID: ${personID}`);
        } catch (deptErr) {
          console.warn(`[Queue update_person_job] Gán phòng ban thất bại:`, deptErr.message);
        }
      }

      // 3. Nếu có ảnh mới, cập nhật Face ID
      const fallbackBaseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
      const faceUrl = publicImageUrl || (imageFilename ? `${fallbackBaseUrl}/uploads/${imageFilename}` : null);

      if (faceUrl) {
        const faceResult = await hanetService.updateByFaceUrl({
          personID,
          faceUrl
        });

        if (faceResult.returnCode !== 1) {
          const errorMsg = getErrorMessage(faceResult.returnCode, faceResult.returnMessage);
          const code = Number(faceResult.returnCode);
          if (NON_RETRIABLE_CODES.has(code)) {
            console.error(`[Queue update_person_job] ❌ Lỗi không thể retry khi cập nhật ảnh (Mã ${code}): ${errorMsg}`);
            return { returnCode: code, returnMessage: errorMsg, error: true };
          }
          await idempotencyService.releaseLock(lockKey);
          throw new Error(`[Mã lỗi ${faceResult.returnCode}]: ${errorMsg}`);
        }
      }

      // Đánh dấu hoàn tất trong Redis 24h
      await idempotencyService.markCompleted(lockKey, 86400);

      return { success: true, personID };
    } catch (err) {
      await idempotencyService.releaseLock(lockKey);
      throw err;
    }
  } finally {
    // [RULE-022] Xử lý thành công hoặc kết thúc -> Luôn delay 30 giây trước khi xóa file tạm
    if (imagePath) {
      imageService.cleanupDelayed(imagePath, 30000);
    }
  }
});

module.exports = {
  resolveDepartmentAndAlias,
  enqueueRegisterPerson: (payload) => hanetQueue.add('register_person_job', payload),
  enqueueUpdatePerson: (payload) => hanetQueue.add('update_person_job', payload)
};
