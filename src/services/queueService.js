const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Queue = require('bull');
const hanetService = require('./hanetService');
const imageService = require('./imageService');
const idempotencyService = require('./idempotencyService');
const { pool } = require('../config/database');
const { getErrorMessage } = require('../utils/hanetErrorMap');

/**
 * Lớp lỗi đại diện cho các lỗi vĩnh viễn không thể khôi phục bằng retry
 */
class UnrecoverableError extends Error {
  constructor(message, code = null) {
    super(message);
    this.name = 'UnrecoverableError';
    this.code = code;
    this.isUnrecoverable = true;
  }
}

// Danh sách mã lỗi vĩnh viễn không thể phục hồi bằng retry tự động (lỗi tham số, lỗi ảnh, lỗi quyền)
const PERMANENT_ERROR_CODES = new Set([
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

  // 1. Tra cứu phòng ban từ PostgreSQL classes table
  let dbDeptId = '';
  if (cleanClass) {
    try {
      const classRes = await pool.query('SELECT department_id FROM classes WHERE name = $1 LIMIT 1', [cleanClass]);
      if (classRes.rows.length > 0 && classRes.rows[0].department_id) {
        dbDeptId = classRes.rows[0].department_id;
      }
    } catch (err) {
      console.warn('[resolveDepartmentAndAlias] DB class lookup error:', err.message);
    }
  }

  // 2. Phân loại Chức vụ (Title)
  let resolvedTitle = 'Học Sinh';
  if (inputTitle && inputTitle.trim()) {
    resolvedTitle = inputTitle.trim();
  } else if (normalizedClass === 'GLV' || normalizedClass.includes('GLV')) {
    resolvedTitle = 'Giáo Lý Viên';
  } else if (normalizedClass.includes('DMHCCC') || normalizedClass.includes('LEGIO') || normalizedClass.includes('LM')) {
    resolvedTitle = 'Hội Viên';
  } else if (normalizedClass.includes('GIOITRE') || normalizedClass.includes('GT')) {
    resolvedTitle = 'Thành Viên';
  }

  // 3. Phân loại Phòng ban (Department)
  let targetDeptID = inputDeptID ? String(inputDeptID) : (dbDeptId ? String(dbDeptId) : '');
  let departmentName = 'Thiếu Nhi';

  if (!targetDeptID || targetDeptID === '0') {
    const norm = cleanClass.toLowerCase();
    if (norm.includes('glv') || norm.includes('giao ly') || norm.includes('thiếu nhi') || norm.includes('themsuc') || norm.includes('baodong') || norm.includes('khaitam') || norm.includes('xungtoi') || norm.includes('vaodoi')) {
      targetDeptID = '990653';
      departmentName = 'Thiếu Nhi';
    } else if (norm.includes('dmhccc') || norm.includes('legio') || norm.includes('mariae') || norm.startsWith('lm')) {
      targetDeptID = '990730';
      departmentName = 'Legiô Mariae';
    } else if (norm.includes('gioitre') || norm.includes('giới trẻ') || norm.startsWith('gt')) {
      targetDeptID = '990731';
      departmentName = 'Giới Trẻ';
    }
  }

  // Nếu vẫn chưa có ID, tra cứu theo map tĩnh
  if (!targetDeptID && STATIC_DEPT_MAP[departmentName.toLowerCase()]) {
    targetDeptID = STATIC_DEPT_MAP[departmentName.toLowerCase()];
  }

  // Tra cứu động danh sách phòng ban từ HANET nếu chưa tìm thấy
  if (!targetDeptID) {
    try {
      const deptListRes = await hanetService.getDepartmentList(1, 100);
      const hits = deptListRes?.data?.hits || (Array.isArray(deptListRes?.data) ? deptListRes.data : []);
      for (const d of hits) {
        const dName = (d.name || d.department_name || '').toLowerCase();
        if (dName.includes(departmentName.toLowerCase()) || departmentName.toLowerCase().includes(dName)) {
          targetDeptID = String(d.id || d.department_id);
          departmentName = d.name || d.department_name;
          break;
        }
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

// Cấu hình kết nối Redis DB 4 dùng chung
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  db: parseInt(process.env.REDIS_DB || '4', 10)
};

// 1. Khởi tạo Hàng Đợi Chính (hanet-registration)
const registrationQueue = new Queue('hanet-registration', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000 // Thử lại sau 2s, 4s, 8s
    },
    removeOnComplete: 100, // Giữ 100 job hoàn tất gần nhất
    removeOnFail: false    // Giữ job thất bại để phân tích và chuyển DLQ
  }
});

// Alias tương thích ngược
const hanetQueue = registrationQueue;

// 2. Khởi tạo Dead Letter Queue (DLQ) lưu trữ các job thất bại vĩnh viễn
const deadLetterQueue = new Queue('hanet-registration-dlq', {
  redis: redisConfig
});

// 3. Lắng nghe sự kiện thất bại của Queue chính để chuyển sang Dead Letter Queue (DLQ)
registrationQueue.on('failed', async (job, err) => {
  const isUnrecoverable = err && (err.name === 'UnrecoverableError' || err.isUnrecoverable);
  const isMaxAttempts = job.attemptsMade >= job.opts.attempts;

  if (isUnrecoverable || isMaxAttempts) {
    console.error(`🚨 [DLQ Trigger] Job ${job.id} (${job.name}) thất bại vĩnh viễn sau ${job.attemptsMade} lần thử. Chuyển vào DLQ.`);

    try {
      await deadLetterQueue.add('dead_letter_job', {
        originalJobId: job.id,
        jobName: job.name,
        jobData: job.data,
        failedReason: err.message,
        failedCode: err.code || null,
        isUnrecoverable: !!isUnrecoverable,
        attemptsMade: job.attemptsMade,
        failedAt: new Date().toISOString()
      }, {
        removeOnComplete: false,
        removeOnFail: false
      });
      console.log(`✅ [DLQ Stored] Đã lưu trữ Job ${job.id} vào deadLetterQueue thành công.`);

      // Cập nhật trạng thái FAILED trong PostgreSQL persons
      if (job.data?.aliasID || job.data?.personID) {
        await pool.query(
          `UPDATE persons
           SET sync_status = 'FAILED', updated_at = CURRENT_TIMESTAMP
           WHERE alias_id = $1 OR person_id = $2`,
          [job.data?.aliasID || null, job.data?.personID || null]
        ).catch(() => {});
      }
    } catch (dlqErr) {
      console.error(`❌ [DLQ Storage Error] Không thể lưu Job ${job.id} vào DLQ:`, dlqErr.message);
    }
  }
});

/**
 * Trích xuất personID từ response hoặc error object của HANET
 */
function extractPersonIDFromHanet(errorOrRes) {
  if (!errorOrRes) return null;
  const resData = errorOrRes.response?.data || errorOrRes.data || errorOrRes;
  return resData?.personID || resData?.personId || resData?.id || resData?.data?.personID || resData?.data?.id || null;
}

/**
 * Xử lý Fallback khi khuôn mặt đã tồn tại trên Cloud (Mã lỗi -9007)
 */
async function handleFaceExistsFallback(params) {
  const {
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
  } = params;

  let personId = extractedPersonID;

  // 1. Nếu chưa có personID, tìm kiếm theo Tên và Alias trên Cloud
  if (!personId) {
    try {
      const listRes = await hanetService.getListByPlace();
      const allPersons = listRes?.data || [];
      const match = allPersons.find(p =>
        (p.aliasID && p.aliasID === finalAlias) ||
        (p.name && p.name.trim().toLowerCase() === name.trim().toLowerCase())
      );
      if (match) {
        personId = match.personID || match.id;
        console.log(`[QueueService] Đã tìm thấy nhân sự trùng khớp: ${name} -> personID: ${personId}`);
      }
    } catch (findErr) {
      console.warn(`[QueueService] Tra cứu nhân sự trùng lặp lỗi:`, findErr.message);
    }
  }

  // 2. Cập nhật ảnh đại diện khuôn mặt mới
  const targetFaceUrl = faceUrl || publicImageUrl || finalAvatarUrl;
  if (personId && targetFaceUrl) {
    try {
      const updateFaceRes = await hanetService.updateByFaceUrl({
        personID: personId,
        faceUrl: targetFaceUrl
      });
      console.log(`[QueueService] Cập nhật Face URL cho personID ${personId}: returnCode=${updateFaceRes.returnCode}`);
    } catch (faceErr) {
      const errCode = faceErr.response?.data?.returnCode;
      console.warn(`[QueueService] Cập nhật Face URL thất bại:`, getErrorMessage(errCode, faceErr.message));
    }
  }

  // 3. Cập nhật thông tin cơ bản
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

  // 4. Khóa phòng ban chuẩn
  if (finalDeptID && personId) {
    try {
      await hanetService.addPersonsToDepartment(finalDeptID, personId);
      console.log(`[QueueService] ✅ Đã khóa phòng ban ${finalDeptID} (${resolvedDepartmentName}) cho personID: ${personId}`);
    } catch (deptErr) {
      console.warn(`[QueueService] Gán phòng ban thất bại:`, deptErr.message);
    }
  }

  // 5. Cập nhật vào cơ sở dữ liệu PostgreSQL
  if (personId || finalAlias) {
    try {
      await pool.query(
        `UPDATE persons
         SET person_id = COALESCE($1, person_id),
             face_url = COALESCE($2, face_url),
             sync_status = 'SYNCED',
             title = COALESCE($3, title),
             department_id = COALESCE($4, department_id),
             updated_at = CURRENT_TIMESTAMP
         WHERE alias_id = $5 OR person_id = $1`,
        [
          String(personId),
          targetFaceUrl || finalAvatarUrl || null,
          finalTitle || null,
          finalDeptID || null,
          finalAlias
        ]
      );
      console.log(`[QueueService] ✅ Đã đồng bộ vào PostgreSQL persons cho personID: ${personId} (Alias: ${finalAlias})`);
    } catch (dbErr) {
      console.warn(`[QueueService] Cập nhật Database thất bại:`, dbErr.message);
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
registrationQueue.process('register_person_job', 2, async (job) => {
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

  console.log(`[Queue register_person_job] (Attempt ${job.attemptsMade + 1}/${job.opts.attempts}) Bắt đầu xử lý: ${name} (${finalAlias}) | Chức vụ: ${finalTitle} | Phòng ban: ${resolved.departmentName} (${finalDeptID})`);

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

        // Tự động cập nhật trạng thái SYNCED vào PostgreSQL
        if (finalPersonID || finalAlias) {
          try {
            await pool.query(
              `UPDATE persons
               SET person_id = COALESCE($1, person_id),
                   face_url = COALESCE($2, face_url),
                   sync_status = 'SYNCED',
                   title = COALESCE($3, title),
                   department_id = COALESCE($4, department_id),
                   updated_at = CURRENT_TIMESTAMP
               WHERE alias_id = $5 OR person_id = $1`,
              [
                String(finalPersonID),
                finalAvatarUrl || faceUrl || null,
                finalTitle || null,
                finalDeptID || null,
                finalAlias
              ]
            );
            console.log(`[Queue register_person_job] ✅ Đã cập nhật PostgreSQL persons cho personID: ${finalPersonID} (Alias: ${finalAlias})`);
          } catch (dbErr) {
            console.warn(`[Queue register_person_job] Cập nhật Database thất bại:`, dbErr.message);
          }
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

        // Kiểm tra lỗi vĩnh viễn (Permanent / Unrecoverable Failure) -> dừng retry ngay và đưa sang DLQ
        if (PERMANENT_ERROR_CODES.has(code)) {
          console.error(`[Queue register_person_job] ❌ Lỗi vĩnh viễn không thể retry (Mã ${code}): ${errorMsg}`);
          job.discard(); // Hủy retry trong Bull
          throw new UnrecoverableError(errorMsg, code);
        }

        // Lỗi tạm thời -> giải phóng lock để Bull Queue retry
        await idempotencyService.releaseLock(lockKey);
        throw new Error(`[Mã lỗi ${registerRes?.returnCode}]: ${errorMsg}`);
      }
    } catch (apiErr) {
      if (apiErr instanceof UnrecoverableError || apiErr.name === 'UnrecoverableError') {
        throw apiErr;
      }

      const errData = apiErr.response?.data;
      const code = Number(errData?.returnCode || apiErr.code);

      // Xử lý lỗi -9007 qua Catch block
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

        await idempotencyService.markCompleted(lockKey, 86400);
        return fallbackResult;
      }

      const errorMsg = getErrorMessage(code, apiErr.message);

      if (PERMANENT_ERROR_CODES.has(code)) {
        console.error(`[Queue register_person_job] ❌ Lỗi vĩnh viễn trong catch block (Mã ${code}): ${errorMsg}`);
        job.discard();
        throw new UnrecoverableError(errorMsg, code);
      }

      // Lỗi tạm thời -> giải phóng lock để Bull Queue retry
      await idempotencyService.releaseLock(lockKey);
      throw apiErr;
    }

  } finally {
    // [RULE-022] Luôn delay 30 giây mới dọn dẹp ảnh để HANET fetch xong
    if (imagePath) {
      imageService.cleanupDelayed(imagePath, 30000);
    }
  }
});

// Xử lý Job cập nhật nhân sự ngầm
registrationQueue.process('update_person_job', 3, async (job) => {
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

  console.log(`[Queue update_person_job] (Attempt ${job.attemptsMade + 1}/${job.opts.attempts}) Bắt đầu xử lý: ${name} (${personID})`);

  try {
    try {
      // 2. Cập nhật thông tin cơ bản trên HANET Cloud
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
        if (PERMANENT_ERROR_CODES.has(code)) {
          console.error(`[Queue update_person_job] ❌ Lỗi vĩnh viễn không thể retry (Mã ${code}): ${errorMsg}`);
          job.discard();
          throw new UnrecoverableError(errorMsg, code);
        }
        await idempotencyService.releaseLock(lockKey);
        throw new Error(`[Mã lỗi ${infoResult.returnCode}]: ${errorMsg}`);
      }

      // Gán phòng ban để khóa liên kết phòng ban trên HANET Cloud
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
          if (PERMANENT_ERROR_CODES.has(code)) {
            console.error(`[Queue update_person_job] ❌ Lỗi vĩnh viễn không thể retry khi cập nhật ảnh (Mã ${code}): ${errorMsg}`);
            job.discard();
            throw new UnrecoverableError(errorMsg, code);
          }
          await idempotencyService.releaseLock(lockKey);
          throw new Error(`[Mã lỗi ${faceResult.returnCode}]: ${errorMsg}`);
        }
      }

      // 4. Đồng bộ cập nhật vào PostgreSQL
      try {
        await pool.query(
          `UPDATE persons
           SET name = COALESCE($1, name),
               title = COALESCE($2, title),
               face_url = COALESCE($3, face_url),
               department_id = COALESCE($4, department_id),
               sync_status = 'SYNCED',
               updated_at = CURRENT_TIMESTAMP
           WHERE alias_id = $5 OR person_id = $6`,
          [
            name || null,
            title || null,
            faceUrl || null,
            departmentID || null,
            aliasID || null,
            String(personID)
          ]
        );
      } catch (dbErr) {
        console.warn(`[Queue update_person_job] Cập nhật DB thất bại:`, dbErr.message);
      }

      // Đánh dấu hoàn tất trong Redis 24h
      await idempotencyService.markCompleted(lockKey, 86400);

      return { success: true, personID };
    } catch (err) {
      if (err instanceof UnrecoverableError || err.name === 'UnrecoverableError') {
        throw err;
      }
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

/**
 * Lấy danh sách các jobs trong Dead Letter Queue (DLQ)
 * @param {number} start - Vị trí bắt đầu
 * @param {number} end - Vị trí kết thúc
 * @returns {Promise<Array<Object>>}
 */
async function getDLQJobs(start = 0, end = 50) {
  try {
    const jobs = await deadLetterQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed'], start, end, true);
    return jobs.map(j => ({
      id: j.id,
      name: j.name,
      data: j.data,
      timestamp: j.timestamp,
      processedOn: j.processedOn,
      finishedOn: j.finishedOn,
      failedReason: j.failedReason || j.data?.failedReason
    }));
  } catch (err) {
    console.error('[DLQ Service] Lỗi khi lấy danh sách DLQ jobs:', err.message);
    return [];
  }
}

/**
 * Đẩy lại (Retry) thủ công một job từ Dead Letter Queue vào Queue chính
 * @param {string|number} dlqJobId - ID của job trong DLQ
 * @returns {Promise<{ success: boolean, message: string, newJobId?: string|number }>}
 */
async function retryDLQJob(dlqJobId) {
  try {
    const dlqJob = await deadLetterQueue.getJob(dlqJobId);
    if (!dlqJob) {
      return { success: false, message: `Không tìm thấy job DLQ với ID: ${dlqJobId}` };
    }

    const originalData = dlqJob.data?.jobData || dlqJob.data;
    const jobName = dlqJob.data?.jobName || 'register_person_job';

    // Giải phóng lock Idempotency cũ nếu có để cho phép xử lý lại
    if (originalData.aliasID) {
      const lockKey = idempotencyService.generateKey('FACE_REGISTER', originalData.aliasID);
      await idempotencyService.releaseLock(lockKey);
    }
    if (originalData.personID) {
      const lockKey = idempotencyService.generateKey('PERSON_UPDATE', originalData.personID);
      await idempotencyService.releaseLock(lockKey);
    }

    // Đẩy lại vào hàng đợi chính
    const newJob = await registrationQueue.add(jobName, originalData);

    // Xóa khỏi DLQ sau khi đã tái nạp thành công
    await dlqJob.remove();

    console.log(`[DLQ Retry] Đã tái nạp thành công job DLQ ${dlqJobId} thành Job mới ${newJob.id}`);
    return {
      success: true,
      message: `Đã tái nạp thành công vào hàng đợi chính với Job ID: ${newJob.id}`,
      newJobId: newJob.id
    };
  } catch (err) {
    console.error(`[DLQ Retry Error] Không thể retry job DLQ ${dlqJobId}:`, err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Xóa toàn bộ jobs trong DLQ
 */
async function clearDLQ() {
  try {
    await deadLetterQueue.empty();
    return { success: true, message: 'Đã dọn sạch Dead Letter Queue' };
  } catch (err) {
    console.error('[DLQ Service] Lỗi dọn DLQ:', err.message);
    return { success: false, message: err.message };
  }
}

module.exports = {
  resolveDepartmentAndAlias,
  enqueueRegisterPerson: (payload) => registrationQueue.add('register_person_job', payload),
  enqueueUpdatePerson: (payload) => registrationQueue.add('update_person_job', payload),
  getDLQJobs,
  retryDLQJob,
  clearDLQ,
  registrationQueue,
  hanetQueue,
  deadLetterQueue,
  UnrecoverableError
};
