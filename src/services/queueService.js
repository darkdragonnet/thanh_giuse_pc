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

// Danh sách mã lỗi vĩnh viễn không thể phục hồi bằng retry tự động
const PERMANENT_ERROR_CODES = new Set([
  -1, -1005, -2035, -5005, -5006, -5010, -5011, -9002, -9005, -9006, -9008
]);

const NON_RETRIABLE_CODES = PERMANENT_ERROR_CODES;

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
 */
function normalizeClassNameForAlias(className) {
  if (!className) return '';
  return className
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .trim();
}

/**
 * Chuẩn hóa động Phòng Ban, Chức Vụ và Alias chuẩn HANET Cloud:
 * BẢO TOÀN aliasID truyền vào nếu đã có, KHÔNG tự ý biến đổi mã hiện hữu.
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

  if (!targetDeptID && STATIC_DEPT_MAP[departmentName.toLowerCase()]) {
    targetDeptID = STATIC_DEPT_MAP[departmentName.toLowerCase()];
  }

  if (!targetDeptID || targetDeptID === '0') {
    targetDeptID = '990653'; // Mặc định Thiếu Nhi
  }

  // 4. BẢO TOÀN AliasID: Nếu đã có alias truyền vào, giữ nguyên 100% (không đổi suffix, không đổi hoa/thường)
  let finalAliasID = '';
  if (inputAlias && inputAlias.trim()) {
    finalAliasID = inputAlias.trim();
  } else {
    // Chỉ sinh mới nếu hoàn toàn chưa có alias
    let deptPrefix = 'TN';
    if (targetDeptID === '990730' || departmentName.toLowerCase().includes('mariae')) {
      deptPrefix = 'LM';
    } else if (targetDeptID === '990731' || departmentName.toLowerCase().includes('trẻ')) {
      deptPrefix = 'GT';
    } else if (departmentName.toLowerCase().includes('gia trưởng')) {
      deptPrefix = 'GTR';
    } else if (departmentName.toLowerCase().includes('hiền mẫu')) {
      deptPrefix = 'HM';
    }

    const classCode = normalizedClass || 'CHUNG';
    const randomSuffix = generateRandomSuffix(4);
    finalAliasID = `${deptPrefix}_${classCode}_${randomSuffix}`;
  }

  return {
    departmentName,
    targetDeptID,
    title: resolvedTitle,
    aliasID: finalAliasID
  };
}

// Cấu hình kết nối Redis DB 4
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  db: parseInt(process.env.REDIS_DB || '4', 10)
};

// 1. Khởi tạo Hàng Đợi Chính
const registrationQueue = new Queue('hanet-registration', {
  redis: redisConfig,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 100,
    removeOnFail: false
  }
});

const hanetQueue = registrationQueue;

// 2. Khởi tạo Dead Letter Queue (DLQ)
const deadLetterQueue = new Queue('hanet-registration-dlq', {
  redis: redisConfig
});

// 3. Lắng nghe sự kiện thất bại của Queue chính để chuyển sang DLQ
registrationQueue.on('failed', async (job, err) => {
  const isUnrecoverable = err && (err.name === 'UnrecoverableError' || err.isUnrecoverable);
  const isMaxAttempts = job.attemptsMade >= job.opts.attempts;

  if (isUnrecoverable || isMaxAttempts) {
    console.error(`🚨 [DLQ Trigger] Job ${job.id} (${job.name}) thất bại vĩnh viễn sau ${job.attemptsMade} lần thử. Chuyển vào DLQ. Lý do: ${err.message}`);

    let imagePath = job.data?.imagePath;
    let dlqPath = imagePath;

    // Bảo toàn file ảnh khi job đi vào DLQ bằng cách đổi tên sang dlq_...
    if (imagePath && fs.existsSync(imagePath) && !path.basename(imagePath).startsWith('dlq_')) {
      try {
        dlqPath = path.join(
          path.dirname(imagePath),
          'dlq_' + path.basename(imagePath)
        );
        fs.renameSync(imagePath, dlqPath);
        console.log('🛡️ [DLQ Preserved] Đã lưu ảnh lỗi vào đường dẫn bảo toàn:', dlqPath);
        // Cập nhật lại đường dẫn ảnh trong job.data
        job.data.imagePath = dlqPath;
        job.data.imageFilename = path.basename(dlqPath);
      } catch (renameErr) {
        console.warn('⚠️ [DLQ Preserved Warning] Lỗi đổi tên ảnh lỗi:', renameErr.message);
      }
    }

    try {
      await deadLetterQueue.add('dead_letter_job', {
        originalJobId: job.id,
        jobName: job.name,
        jobData: {
          ...job.data,
          imagePath: dlqPath,
          imageFilename: path.basename(dlqPath || '')
        },
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

      // Cập nhật trạng thái FAILED trong PostgreSQL persons và registration_requests
      const aliasID = job.data?.aliasID;
      const personID = job.data?.personID;
      const requestId = job.data?.requestId;

      if (aliasID || personID) {
        await pool.query(
          `UPDATE persons
           SET sync_status = 'FAILED', updated_at = CURRENT_TIMESTAMP
           WHERE (alias_id = $1 AND sync_status = 'PENDING') OR person_id = $2`,
          [aliasID || null, personID || null]
        ).catch(() => {});
      }

      if (requestId) {
        await pool.query(
          `UPDATE registration_requests
           SET status = 'FAILED', error_message = $1, attempts = $2, updated_at = CURRENT_TIMESTAMP
           WHERE request_id = $3`,
          [err.message, job.attemptsMade, requestId]
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
 * Áp dụng Fail-Soft có kiểm soát và xác minh danh tính nghiêm ngặt.
 */
async function handleFaceExistsFallback(hanetError, memberName, className, jobAliasID, faceUrl, finalDeptID, finalTitle, requestId = null) {
  const errData = hanetError?.response?.data || hanetError?.data || hanetError || {};
  const cloudData = errData?.data || errData || {};
  let cloudPersonId = String(cloudData.personID || cloudData.personId || cloudData.id || extractPersonIDFromHanet(hanetError) || '').trim();
  let cloudAliasId = String(cloudData.aliasID || cloudData.alias_id || '').trim();
  let cloudFaceUrl = String(cloudData.file || cloudData.avatar || cloudData.faceUrl || faceUrl || '').trim();

  console.log(`⚠️ [QueueService] Phát hiện khuôn mặt đã tồn tại trên Cloud (-9007):`);
  console.log(`   - Cloud PersonID trích xuất: ${cloudPersonId || '(chưa có trong payload)'}`);
  console.log(`   - Job AliasID: ${jobAliasID}`);

  // 1. Kiểm tra nếu có cloudPersonId hợp lệ từ HANET payload
  if (cloudPersonId) {
    try {
      // 1.1 Đồng bộ cập nhật Face ID mới trên Cloud cho personID này
      if (faceUrl) {
        try {
          await hanetService.updateByFaceUrl({
            personID: cloudPersonId,
            faceUrl
          });
          console.log(`[Fallback -9007] ✅ Đã cập nhật Face ID mới trên HANET Cloud cho personID: ${cloudPersonId}`);
        } catch (faceErr) {
          console.warn(`[Fallback -9007] Cảnh báo cập nhật Face ID:`, faceErr.message);
        }
      }

      // 1.2 Đồng bộ cập nhật thông tin tên, chức vụ, aliasID và phòng ban
      try {
        await hanetService.updateInfo({
          personID: cloudPersonId,
          name: memberName,
          aliasID: jobAliasID,
          title: finalTitle,
          departmentID: finalDeptID
        });
      } catch (infoErr) {
        console.warn(`[Fallback -9007] Cập nhật info cảnh báo:`, infoErr.message);
      }

      // 1.3 Khóa phòng ban
      if (finalDeptID && String(finalDeptID) !== '0') {
        try {
          await hanetService.addPersonsToDepartment(finalDeptID, cloudPersonId);
        } catch (deptErr) {}
      }

      // 1.4 Cập nhật chính xác bản ghi đích trong PostgreSQL
      const updateResult = await pool.query(
        `UPDATE persons 
         SET person_id = $1,
             face_url = COALESCE(NULLIF($2, ''), face_url),
             sync_status = 'SYNCED',
             department_id = COALESCE($3, department_id),
             title = COALESCE($4, title),
             updated_at = CURRENT_TIMESTAMP
         WHERE alias_id = $5`,
        [cloudPersonId, cloudFaceUrl, finalDeptID || null, finalTitle || null, jobAliasID]
      );

      if (updateResult.rowCount === 0) {
        throw new Error(`[Fallback -9007] Không tìm thấy bản ghi PostgreSQL với alias_id ${jobAliasID} để cập nhật.`);
      }

      // 1.5 Cập nhật registration_requests nếu có
      if (requestId) {
        await pool.query(
          `UPDATE registration_requests
           SET status = 'SYNCED', person_id = $1, cloud_result = $2, updated_at = CURRENT_TIMESTAMP
           WHERE request_id = $3`,
          [cloudPersonId, JSON.stringify({ fallback: true, returnCode: -9007 }), requestId]
        ).catch(() => {});
      }

      console.log(`✅ [Fallback -9007] Đã liên kết và đồng bộ an toàn personID ${cloudPersonId} cho alias ${jobAliasID}.`);
      return {
        returnCode: 1,
        returnMessage: 'Khuôn mặt đã tồn tại trên Cloud, đã đồng bộ an toàn vào Database',
        personID: cloudPersonId,
        aliasID: jobAliasID,
        updated: true
      };
    } catch (dbErr) {
      console.error(`❌ [Fallback -9007 DB Error]:`, dbErr.message);
      throw dbErr;
    }
  }

  // 2. Không trích xuất được cloudPersonId -> Đưa vào trạng thái REVIEW_REQUIRED (Chống thành công giả!)
  console.warn(`⚠️ [Fallback -9007] Không trích xuất được PersonID từ phản hồi Cloud. Đánh dấu REVIEW_REQUIRED.`);

  await pool.query(
    `UPDATE persons
     SET sync_status = 'REVIEW_REQUIRED', updated_at = CURRENT_TIMESTAMP
     WHERE alias_id = $1`,
    [jobAliasID]
  ).catch(() => {});

  if (requestId) {
    await pool.query(
      `UPDATE registration_requests
       SET status = 'REVIEW_REQUIRED', error_message = 'Khuôn mặt đã tồn tại trên Cloud nhưng thiếu PersonID, cần đối soát', updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $1`,
      [requestId]
    ).catch(() => {});
  }

  throw new UnrecoverableError('Khuôn mặt đã tồn tại trên HANET Cloud nhưng không trích xuất được PersonID để liên kết. Yêu cầu quản trị viên đối soát.', -9007);
}

// =========================================================================
// XỬ LÝ JOB: ĐĂNG KÝ NHÂN SỰ MỚI (register_person_job)
// =========================================================================
registrationQueue.process('register_person_job', 2, async (job) => {
  const { name, aliasID, title, departmentID, imagePath, publicImageUrl, imageFilename, source_csv, className, class_name, existing_person_id, requestId } = job.data;
  const targetClass = source_csv || className || class_name || null;
  const fallbackBaseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
  const faceUrl = publicImageUrl || (imageFilename ? `${fallbackBaseUrl}/uploads/${imageFilename}` : null);

  // 1. Chuẩn hóa phòng ban & chức vụ, BẢO TOÀN aliasID
  const resolved = await resolveDepartmentAndAlias(targetClass, title, departmentID, aliasID);
  const finalAlias = resolved.aliasID;
  const finalTitle = resolved.title;
  const finalDeptID = resolved.targetDeptID;

  // 2. Cập nhật trạng thái PROCESSING trong registration_requests nếu có
  if (requestId) {
    await pool.query(
      `UPDATE registration_requests
       SET status = 'PROCESSING', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $1`,
      [requestId]
    ).catch(() => {});
  }

  // 3. Idempotency Lock
  const lockKey = idempotencyService.generateKey('FACE_REGISTER', finalAlias, requestId || '');
  const acquired = await idempotencyService.acquireLock(lockKey, 120);
  if (!acquired) {
    console.warn(`[CONCURRENCY] Job cho ${finalAlias} (${requestId || 'no-req'}) đang được xử lý bởi worker khác.`);
    throw new Error(`[CONCURRENCY] Job cho ${finalAlias} đang được xử lý bởi worker khác.`);
  }

  console.log(`[Queue register_person_job] (Attempt ${job.attemptsMade + 1}/${job.opts.attempts}) Bắt đầu xử lý: ${name} (${finalAlias}) | Chức vụ: ${finalTitle} | Phòng ban: ${resolved.departmentName} (${finalDeptID})`);

  let finalPersonID = existing_person_id || null;
  let finalAvatarUrl = faceUrl;
  let jobSucceeded = false;

  try {
    try {
      // 4. Nếu đã có existing_person_id thì thực hiện luồng cập nhật khuôn mặt
      let registerRes;
      if (existing_person_id) {
        console.log(`[Queue register_person_job] Hồ sơ đã có person_id ${existing_person_id}. Thực hiện cập nhật khuôn mặt qua updateByFaceUrl...`);
        registerRes = await hanetService.updateByFaceUrl({
          personID: existing_person_id,
          faceUrl
        });

        if (registerRes && (registerRes.returnCode === 1 || registerRes.returnCode === '1')) {
          finalPersonID = existing_person_id;
        }
      } else {
        // Luồng đăng ký người mới hoàn toàn
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
      }

      // 5. Kiểm tra kết quả trả về từ Cloud
      if (registerRes && (registerRes.returnCode === 1 || registerRes.returnCode === '1')) {
        finalPersonID = registerRes.data?.personID || registerRes.data?.id || finalPersonID;
        finalAvatarUrl = registerRes.data?.avatar || registerRes.data?.faceUrl || faceUrl;
        console.log(`[Queue register_person_job] ✅ Đăng ký/Cập nhật Cloud thành công: PersonID = ${finalPersonID}`);

        // Gán và khóa phòng ban
        if (finalDeptID && finalPersonID) {
          try {
            await hanetService.addPersonsToDepartment(finalDeptID, finalPersonID);
            console.log(`[Queue register_person_job] ✅ Đã khóa phòng ban ${finalDeptID} cho ${finalPersonID}`);
          } catch (deptErr) {
            console.warn(`[Queue register_person_job] Gán phòng ban cảnh báo:`, deptErr.message);
          }
        }

        // Cập nhật trạng thái SYNCED vào PostgreSQL
        const dbUpdateRes = await pool.query(
          `UPDATE persons
           SET person_id = COALESCE($1, person_id),
               face_url = COALESCE($2, face_url),
               sync_status = 'SYNCED',
               title = COALESCE($3, title),
               department_id = COALESCE($4, department_id),
               updated_at = CURRENT_TIMESTAMP
           WHERE alias_id = $5`,
          [
            String(finalPersonID),
            finalAvatarUrl || faceUrl || null,
            finalTitle || null,
            finalDeptID || null,
            finalAlias
          ]
        );

        if (dbUpdateRes.rowCount === 0) {
          console.warn(`[Queue register_person_job] Cảnh báo: Không tìm thấy dòng persons với alias_id = ${finalAlias}`);
        }

        // Cập nhật bảng registration_requests
        if (requestId) {
          await pool.query(
            `UPDATE registration_requests
             SET status = 'SYNCED', person_id = $1, cloud_result = $2, updated_at = CURRENT_TIMESTAMP
             WHERE request_id = $3`,
            [String(finalPersonID), JSON.stringify(registerRes), requestId]
          );
        }

        await idempotencyService.markCompleted(lockKey, 3600);
        jobSucceeded = true;

        // Chỉ lên lịch dọn ảnh sau khi JOB ĐÃ HOÀN TẤT THÀNH CÔNG
        if (imagePath && fs.existsSync(imagePath)) {
          imageService.cleanupDelayed(imagePath, 30000);
        }

        return { returnCode: 1, returnMessage: 'Success', personID: finalPersonID, aliasID: finalAlias };
      } else if (registerRes && (registerRes.returnCode === -9007 || registerRes.data?.returnCode === -9007)) {
        // Xử lý mã lỗi -9007
        const fallbackResult = await handleFaceExistsFallback(
          registerRes,
          name,
          targetClass,
          finalAlias,
          faceUrl,
          finalDeptID,
          finalTitle,
          requestId
        );

        await idempotencyService.markCompleted(lockKey, 3600);
        jobSucceeded = true;

        if (imagePath && fs.existsSync(imagePath)) {
          imageService.cleanupDelayed(imagePath, 30000);
        }

        return fallbackResult;
      } else {
        const errorMsg = getErrorMessage(registerRes?.returnCode, registerRes?.returnMessage);
        const code = Number(registerRes?.returnCode);

        if (PERMANENT_ERROR_CODES.has(code)) {
          console.error(`[Queue register_person_job] ❌ Lỗi vĩnh viễn (Mã ${code}): ${errorMsg}`);
          job.discard();
          throw new UnrecoverableError(errorMsg, code);
        }

        await idempotencyService.releaseLock(lockKey);
        throw new Error(`[Mã lỗi ${registerRes?.returnCode}]: ${errorMsg}`);
      }
    } catch (apiErr) {
      if (apiErr instanceof UnrecoverableError || apiErr.name === 'UnrecoverableError') {
        throw apiErr;
      }

      const errData = apiErr.response?.data;
      const code = Number(errData?.returnCode || apiErr.code);

      if (code === -9007 || (errData && (errData.returnCode === -9007 || errData.data?.returnCode === -9007))) {
        const fallbackResult = await handleFaceExistsFallback(
          apiErr,
          name,
          targetClass,
          finalAlias,
          faceUrl,
          finalDeptID,
          finalTitle,
          requestId
        );

        await idempotencyService.markCompleted(lockKey, 3600);
        jobSucceeded = true;

        if (imagePath && fs.existsSync(imagePath)) {
          imageService.cleanupDelayed(imagePath, 30000);
        }

        return fallbackResult;
      }

      const errorMsg = getErrorMessage(code, apiErr.message);

      if (PERMANENT_ERROR_CODES.has(code)) {
        console.error(`[Queue register_person_job] ❌ Lỗi vĩnh viễn (Mã ${code}): ${errorMsg}`);
        job.discard();
        throw new UnrecoverableError(errorMsg, code);
      }

      // Lỗi tạm thời: giải phóng lock và KHÔNG xóa ảnh để Bull retry
      await idempotencyService.releaseLock(lockKey);
      throw apiErr;
    }
  } finally {
    // KHÔNG tự ý xóa ảnh trong finally nếu job chưa thành công!
  }
});

// =========================================================================
// XỬ LÝ JOB: CẬP NHẬT NHÂN SỰ (update_person_job)
// =========================================================================
registrationQueue.process('update_person_job', 3, async (job) => {
  const { personID, name, aliasID, title, departmentID, imagePath, publicImageUrl, imageFilename, requestId } = job.data;
  const lockKey = idempotencyService.generateKey('PERSON_UPDATE', personID, requestId || '');

  const acquired = await idempotencyService.acquireLock(lockKey, 120);
  if (!acquired) {
    console.warn(`[CONCURRENCY] Job cập nhật cho ${personID} đang được xử lý bởi worker khác.`);
    throw new Error(`[CONCURRENCY] Job cập nhật cho ${personID} đang được xử lý bởi worker khác.`);
  }

  console.log(`[Queue update_person_job] (Attempt ${job.attemptsMade + 1}/${job.opts.attempts}) Bắt đầu xử lý: ${name} (${personID})`);

  let jobSucceeded = false;

  try {
    try {
      // 1. Cập nhật thông tin cơ bản trên HANET Cloud
      const infoResult = await hanetService.updateInfo({
        personID,
        name,
        aliasID,
        title,
        departmentID
      });

      if (infoResult.returnCode !== 1 && infoResult.returnCode !== '1') {
        const errorMsg = getErrorMessage(infoResult.returnCode, infoResult.returnMessage);
        const code = Number(infoResult.returnCode);
        if (PERMANENT_ERROR_CODES.has(code)) {
          job.discard();
          throw new UnrecoverableError(errorMsg, code);
        }
        await idempotencyService.releaseLock(lockKey);
        throw new Error(`[Mã lỗi ${infoResult.returnCode}]: ${errorMsg}`);
      }

      // Gán phòng ban
      if (departmentID && String(departmentID) !== '0') {
        try {
          await hanetService.addPersonsToDepartment(departmentID, personID);
        } catch (deptErr) {}
      }

      // 2. Cập nhật Face ID nếu có ảnh mới
      const fallbackBaseUrl = (process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
      const faceUrl = publicImageUrl || (imageFilename ? `${fallbackBaseUrl}/uploads/${imageFilename}` : null);

      if (faceUrl) {
        const faceResult = await hanetService.updateByFaceUrl({
          personID,
          faceUrl
        });

        if (faceResult.returnCode !== 1 && faceResult.returnCode !== '1') {
          const errorMsg = getErrorMessage(faceResult.returnCode, faceResult.returnMessage);
          const code = Number(faceResult.returnCode);
          if (PERMANENT_ERROR_CODES.has(code)) {
            job.discard();
            throw new UnrecoverableError(errorMsg, code);
          }
          await idempotencyService.releaseLock(lockKey);
          throw new Error(`[Mã lỗi ${faceResult.returnCode}]: ${errorMsg}`);
        }
      }

      // 3. Cập nhật PostgreSQL
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

      if (requestId) {
        await pool.query(
          `UPDATE registration_requests
           SET status = 'SYNCED', person_id = $1, updated_at = CURRENT_TIMESTAMP
           WHERE request_id = $2`,
          [String(personID), requestId]
        ).catch(() => {});
      }

      await idempotencyService.markCompleted(lockKey, 3600);
      jobSucceeded = true;

      // Chỉ dọn ảnh khi job thành công
      if (imagePath && fs.existsSync(imagePath)) {
        imageService.cleanupDelayed(imagePath, 30000);
      }

      return { success: true, personID };
    } catch (err) {
      if (err instanceof UnrecoverableError || err.name === 'UnrecoverableError') {
        throw err;
      }
      await idempotencyService.releaseLock(lockKey);
      throw err;
    }
  } finally {
    // Không xóa ảnh khi retry
  }
});

/**
 * Lấy danh sách các jobs trong Dead Letter Queue (DLQ)
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
 */
async function retryDLQJob(dlqJobId) {
  try {
    const dlqJob = await deadLetterQueue.getJob(dlqJobId);
    if (!dlqJob) {
      return { success: false, message: `Không tìm thấy job DLQ với ID: ${dlqJobId}` };
    }

    const originalData = dlqJob.data?.jobData || dlqJob.data;
    const jobName = dlqJob.data?.jobName || 'register_person_job';

    // Khôi phục đường dẫn ảnh nếu cần
    let imagePath = originalData.imagePath;
    if (imagePath && !fs.existsSync(imagePath)) {
      // Thử tìm theo file dlq_
      const dlqCandidate = path.join(path.dirname(imagePath), 'dlq_' + path.basename(imagePath));
      if (fs.existsSync(dlqCandidate)) {
        imagePath = dlqCandidate;
        originalData.imagePath = dlqCandidate;
        originalData.imageFilename = path.basename(dlqCandidate);
      }
    }

    // Giải phóng lock cũ
    if (originalData.aliasID) {
      await idempotencyService.clearCompleted('FACE_REGISTER', originalData.aliasID);
    }
    if (originalData.personID) {
      await idempotencyService.clearCompleted('PERSON_UPDATE', originalData.personID);
    }

    const newJob = await registrationQueue.add(jobName, originalData);
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

/**
 * Quét và nạp lại các yêu cầu chưa được đưa vào queue từ registration_outbox (Transactional Outbox)
 */
async function dispatchPendingOutbox() {
  try {
    const outboxRes = await pool.query(
      `SELECT id, request_id, payload, attempts
       FROM registration_outbox
       WHERE status = 'PENDING' AND attempts < 5
       ORDER BY created_at ASC
       LIMIT 50`
    );

    for (const row of outboxRes.rows) {
      try {
        const payload = row.payload;
        const jobName = payload.operation_type === 'UPDATE_PHOTO' ? 'update_person_job' : 'register_person_job';
        
        await registrationQueue.add(jobName, {
          ...payload,
          requestId: row.request_id
        });

        await pool.query(
          `UPDATE registration_outbox
           SET status = 'ENQUEUED', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [row.id]
        );
        console.log(`📨 [Outbox Dispatcher] Đã phục hồi và nạp queue cho request_id: ${row.request_id}`);
      } catch (enqueueErr) {
        console.warn(`⚠️ [Outbox Dispatcher Warning] Không thể nạp queue cho id ${row.id}:`, enqueueErr.message);
        await pool.query(
          `UPDATE registration_outbox
           SET attempts = attempts + 1, last_error = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [enqueueErr.message, row.id]
        );
      }
    }
  } catch (err) {
    console.warn('⚠️ [Outbox Dispatcher Error]:', err.message);
  }
}

module.exports = {
  resolveDepartmentAndAlias,
  enqueueRegisterPerson: (payload) => registrationQueue.add('register_person_job', payload),
  enqueueUpdatePerson: (payload) => registrationQueue.add('update_person_job', payload),
  dispatchPendingOutbox,
  getDLQJobs,
  retryDLQJob,
  clearDLQ,
  registrationQueue,
  hanetQueue,
  deadLetterQueue,
  UnrecoverableError,
  PERMANENT_ERROR_CODES,
  NON_RETRIABLE_CODES
};
