const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Queue = require('bull');
const hanetService = require('./hanetService');
const imageService = require('./imageService');
const idempotencyService = require('./idempotencyService');
const { pool } = require('../config/database');
const { getErrorMessage } = require('../utils/hanetErrorMap');
const { redisConfig, MAIN_QUEUE_NAME, DLQ_QUEUE_NAME, defaultJobOptions } = require('../config/queueConfig');
const { buildPublicImageUrl, getPublicBaseUrl, verifyUploadFilePath, sanitizeFilename, isVerifiedHanetCdnUrl } = require('../utils/urlHelper');

const HanetApiError = hanetService.HanetApiError;

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

function generateRandomSuffix(length = 4) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

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

  let dbDeptId = '';
  if (cleanClass) {
    try {
      const classRes = await pool.query('SELECT department_id FROM classes WHERE name = $1 LIMIT 1', [cleanClass]);
      if (classRes.rows.length > 0 && classRes.rows[0].department_id) {
        dbDeptId = String(classRes.rows[0].department_id);
      }
    } catch (err) {
      console.warn('[resolveDepartmentAndAlias] DB class lookup warning:', err.message);
    }
  }

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
    targetDeptID = '990653';
  }

  let finalAliasID = '';
  if (inputAlias && inputAlias.trim()) {
    finalAliasID = inputAlias.trim();
  } else {
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

// 1. Khởi tạo Hàng Đợi Chính
const registrationQueue = new Queue(MAIN_QUEUE_NAME, {
  redis: redisConfig,
  defaultJobOptions
});

const hanetQueue = registrationQueue;

// 2. Khởi tạo Dead Letter Queue (DLQ)
const deadLetterQueue = new Queue(DLQ_QUEUE_NAME, {
  redis: redisConfig
});

// 3. Lắng nghe sự kiện thất bại của Queue chính để chuyển sang DLQ
registrationQueue.on('failed', async (job, err) => {
  const isUnrecoverable = err && (err.name === 'UnrecoverableError' || err.isUnrecoverable);
  const isMaxAttempts = job.attemptsMade >= job.opts.attempts;

  if (isUnrecoverable || isMaxAttempts) {
    const returnCode = err.returnCode || err.code || null;
    console.error(`🚨 [DLQ Trigger] Job ${job.id} (${job.name}) thất bại vĩnh viễn sau ${job.attemptsMade} lần thử. Mã lỗi: ${returnCode ?? 'N/A'}. Chuyển vào DLQ. Lý do: ${err.message}`);

    let imagePath = job.data?.imagePath;
    let dlqPath = imagePath;
    let dlqFilename = job.data?.imageFilename;
    let dlqPublicUrl = job.data?.publicImageUrl;

    // Bảo toàn file ảnh khi job đi vào DLQ bằng cách đổi tên sang dlq_... (không tạo dlq_dlq_)
    if (imagePath && fs.existsSync(imagePath)) {
      const baseName = path.basename(imagePath);
      if (!baseName.startsWith('dlq_')) {
        try {
          dlqFilename = 'dlq_' + baseName;
          dlqPath = path.join(path.dirname(imagePath), dlqFilename);
          fs.renameSync(imagePath, dlqPath);
          dlqPublicUrl = buildPublicImageUrl(dlqFilename);

          console.log(`🛡️ [DLQ Preserved] Đã lưu ảnh lỗi vào đường dẫn bảo toàn: ${dlqPath} | Public URL: ${dlqPublicUrl}`);

          job.data.imagePath = dlqPath;
          job.data.imageFilename = dlqFilename;
          job.data.publicImageUrl = dlqPublicUrl;
          if (job.data.faceUrl) job.data.faceUrl = dlqPublicUrl;
        } catch (renameErr) {
          console.warn('⚠️ [DLQ Preserved Warning] Lỗi đổi tên ảnh lỗi:', renameErr.message);
        }
      }
    }

    try {
      await deadLetterQueue.add('dead_letter_job', {
        originalJobId: job.id,
        jobName: job.name,
        jobData: {
          ...job.data,
          imagePath: dlqPath,
          imageFilename: dlqFilename,
          publicImageUrl: dlqPublicUrl,
          faceUrl: dlqPublicUrl || job.data?.faceUrl
        },
        failedReason: err.message,
        failedCode: returnCode,
        isUnrecoverable: !!isUnrecoverable,
        attemptsMade: job.attemptsMade,
        failedAt: new Date().toISOString()
      }, {
        removeOnComplete: false,
        removeOnFail: false
      });
      console.log(`✅ [DLQ Stored] Đã lưu trữ Job ${job.id} vào deadLetterQueue thành công.`);

      // Cập nhật trạng thái FAILED trong PostgreSQL
      const aliasID = job.data?.aliasID;
      const personID = job.data?.personID;
      const requestId = job.data?.requestId;

      const dbClient = await pool.connect();
      try {
        await dbClient.query('BEGIN');

        if (aliasID || personID) {
          await dbClient.query(
            `UPDATE persons
             SET sync_status = 'FAILED', updated_at = CURRENT_TIMESTAMP
             WHERE (alias_id = $1 AND sync_status = 'PENDING') OR (person_id IS NOT NULL AND person_id = $2)`,
            [aliasID || null, personID ? String(personID) : null]
          );
        }

        if (requestId) {
          await dbClient.query(
            `UPDATE registration_requests
             SET status = 'FAILED', error_message = $1, attempts = $2, updated_at = CURRENT_TIMESTAMP
             WHERE request_id = $3`,
            [err.message, job.attemptsMade, requestId]
          );
        }

        await dbClient.query('COMMIT');
      } catch (dbErr) {
        await dbClient.query('ROLLBACK').catch(() => {});
        console.error('❌ [DLQ DB Update Error]:', dbErr.message);
      } finally {
        dbClient.release();
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
  const pId = resData?.personID || resData?.personId || resData?.id || resData?.data?.personID || resData?.data?.id || null;
  return pId !== null && pId !== undefined ? String(pId).trim() : null;
}

/**
 * Xử lý Fallback khi khuôn mặt đã tồn tại trên Cloud (Mã lỗi -9007)
 */
async function handleFaceExistsFallback(hanetError, memberName, className, jobAliasID, faceUrl, finalDeptID, finalTitle, requestId = null) {
  const errData = hanetError?.response?.data || hanetError?.data || hanetError || {};
  const cloudData = errData?.data || errData || {};
  let cloudPersonId = String(cloudData.personID || cloudData.personId || cloudData.id || extractPersonIDFromHanet(hanetError) || '').trim();
  let rawCloudFaceUrl = String(cloudData.file || cloudData.avatar || cloudData.faceUrl || '').trim();
  let cloudVerifiedAvatar = isVerifiedHanetCdnUrl(rawCloudFaceUrl) ? rawCloudFaceUrl : null;

  console.log(`⚠️ [Fallback -9007] Phát hiện khuôn mặt đã tồn tại trên Cloud:`);
  console.log(`   - Cloud PersonID trích xuất: ${cloudPersonId || '(chưa có trong payload)'}`);
  console.log(`   - Job AliasID: ${jobAliasID}`);

  if (cloudPersonId) {
    // 1. Đồng bộ cập nhật Face ID mới trên Cloud cho personID này
    if (faceUrl) {
      try {
        const faceRes = await hanetService.updateByFaceUrl({
          personID: cloudPersonId,
          faceUrl
        });
        const avatarFromFaceRes = faceRes?.data?.avatar || faceRes?.data?.faceUrl || faceRes?.data?.file;
        if (isVerifiedHanetCdnUrl(avatarFromFaceRes)) {
          cloudVerifiedAvatar = avatarFromFaceRes;
        }
        console.log(`[Fallback -9007] ✅ Đã cập nhật Face ID mới trên HANET Cloud cho personID: ${cloudPersonId}`);
      } catch (faceErr) {
        console.warn(`[Fallback -9007] Cảnh báo cập nhật Face ID:`, faceErr.message);
      }
    }

    // Tra cứu Cloud avatar chính thức nếu chưa có CDN URL hợp lệ
    if (!cloudVerifiedAvatar && jobAliasID) {
      try {
        const lookupRes = await hanetService.getPersonByAliasID(jobAliasID);
        let lookupAvatar = null;
        if (Array.isArray(lookupRes?.data)) {
          const match = lookupRes.data.find(p => p && typeof p === 'object' && p.aliasID === jobAliasID);
          if (match) lookupAvatar = match.avatar || match.faceUrl;
        } else {
          const cloudInfo = lookupRes?.data?.data || lookupRes?.data;
          lookupAvatar = cloudInfo?.avatar || cloudInfo?.faceUrl;
        }
        if (isVerifiedHanetCdnUrl(lookupAvatar)) {
          cloudVerifiedAvatar = lookupAvatar;
        }
      } catch (lookupErr) {
        console.warn(`[Fallback -9007] Tra cứu avatar CDN Cloud cảnh báo:`, lookupErr.message);
      }
    }

    // 2. Đồng bộ cập nhật thông tin tên, chức vụ, aliasID và phòng ban
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

    // 3. Khóa phòng ban
    if (finalDeptID && String(finalDeptID) !== '0') {
      try {
        await hanetService.addPersonsToDepartment(finalDeptID, cloudPersonId);
      } catch (deptErr) {
        console.warn(`[Fallback -9007] Gán phòng ban cảnh báo:`, deptErr.message);
      }
    }

    // 4. Cập nhật chính xác bản ghi đích trong PostgreSQL qua 1 Transaction
    const dbClient = await pool.connect();
    try {
      await dbClient.query('BEGIN');

      const updateResult = await dbClient.query(
        `UPDATE persons 
         SET person_id = $1,
             face_url = COALESCE(NULLIF($2, ''), face_url),
             sync_status = 'SYNCED',
             department_id = COALESCE($3, department_id),
             title = COALESCE($4, title),
             updated_at = CURRENT_TIMESTAMP
         WHERE alias_id = $5`,
        [cloudPersonId, cloudVerifiedAvatar || null, finalDeptID || null, finalTitle || null, jobAliasID]
      );

      if (updateResult.rowCount === 0) {
        throw new Error(`[Fallback -9007] Không tìm thấy bản ghi PostgreSQL với alias_id ${jobAliasID} để cập nhật.`);
      }

      if (requestId) {
        await dbClient.query(
          `UPDATE registration_requests
           SET status = 'SYNCED', person_id = $1, cloud_result = $2, updated_at = CURRENT_TIMESTAMP
           WHERE request_id = $3`,
          [cloudPersonId, JSON.stringify({ fallback: true, returnCode: -9007, faceUrl: cloudVerifiedAvatar }), requestId]
        );
      }

      await dbClient.query('COMMIT');

      console.log(`✅ [Fallback -9007] Đã liên kết và đồng bộ an toàn personID ${cloudPersonId} cho alias ${jobAliasID}.`);
      return {
        returnCode: 1,
        returnMessage: 'Khuôn mặt đã tồn tại trên Cloud, đã đồng bộ an toàn vào Database',
        personID: cloudPersonId,
        aliasID: jobAliasID,
        updated: true
      };
    } catch (dbErr) {
      await dbClient.query('ROLLBACK').catch(() => {});
      console.error(`❌ [Fallback -9007 DB Error]:`, dbErr.message);
      throw dbErr;
    } finally {
      dbClient.release();
    }
  }

  // Không có PersonID -> Đưa vào trạng thái REVIEW_REQUIRED
  console.warn(`⚠️ [Fallback -9007] Không trích xuất được PersonID từ phản hồi Cloud. Đánh dấu REVIEW_REQUIRED.`);

  const dbClient = await pool.connect();
  try {
    await dbClient.query('BEGIN');
    await dbClient.query(
      `UPDATE persons
       SET sync_status = 'REVIEW_REQUIRED', updated_at = CURRENT_TIMESTAMP
       WHERE alias_id = $1`,
      [jobAliasID]
    );

    if (requestId) {
      await dbClient.query(
        `UPDATE registration_requests
         SET status = 'REVIEW_REQUIRED', error_message = 'Khuôn mặt đã tồn tại trên Cloud nhưng thiếu PersonID, cần đối soát', updated_at = CURRENT_TIMESTAMP
         WHERE request_id = $1`,
        [requestId]
      );
    }
    await dbClient.query('COMMIT');
  } catch (err) {
    await dbClient.query('ROLLBACK').catch(() => {});
  } finally {
    dbClient.release();
  }

  throw new UnrecoverableError('Khuôn mặt đã tồn tại trên HANET Cloud nhưng không trích xuất được PersonID để liên kết. Yêu cầu quản trị viên đối soát.', -9007);
}

// =========================================================================
// XỬ LÝ JOB: ĐĂNG KÝ NHÂN SỰ MỚI (register_person_job)
// =========================================================================
registrationQueue.process('register_person_job', 2, async (job) => {
  const { name, aliasID, title, departmentID, imagePath, publicImageUrl, imageFilename, source_csv, className, class_name, existing_person_id, requestId } = job.data;
  const targetClass = source_csv || className || class_name || null;
  const faceUrl = publicImageUrl || (imageFilename ? buildPublicImageUrl(imageFilename) : null);

  const resolved = await resolveDepartmentAndAlias(targetClass, title, departmentID, aliasID);
  const finalAlias = resolved.aliasID;
  const finalTitle = resolved.title;
  const finalDeptID = resolved.targetDeptID;

  let currentStage = 'START';
  console.log(`[Worker register_person_job | Job: ${job.id} | Req: ${requestId || 'N/A'}] [Stage: ${currentStage}] Bắt đầu xử lý: ${name} (${finalAlias})`);

  if (requestId) {
    await pool.query(
      `UPDATE registration_requests
       SET status = 'PROCESSING', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
       WHERE request_id = $1`,
      [requestId]
    ).catch(() => {});
  }

  const lockKey = idempotencyService.generateKey('FACE_REGISTER', finalAlias, requestId || '');
  const acquired = await idempotencyService.acquireLock(lockKey, 120);
  if (!acquired) {
    console.warn(`[CONCURRENCY] Job cho ${finalAlias} (${requestId || 'no-req'}) đang được xử lý bởi worker khác.`);
    throw new Error(`[CONCURRENCY] Job cho ${finalAlias} đang được xử lý bởi worker khác.`);
  }

  let finalPersonID = existing_person_id ? String(existing_person_id).trim() : null;
  let finalAvatarUrl = faceUrl;
  let jobSucceeded = false;

  try {
    try {
      let registerRes;
      if (finalPersonID) {
        currentStage = 'UPDATE_FACE';
        console.log(`[Worker register_person_job | Job: ${job.id}] [Stage: ${currentStage}] Hồ sơ đã có person_id ${finalPersonID}. Gọi updateByFaceUrl...`);
        registerRes = await hanetService.updateByFaceUrl({
          personID: finalPersonID,
          faceUrl
        });
      } else {
        currentStage = 'REGISTER_PERSON';
        console.log(`[Worker register_person_job | Job: ${job.id}] [Stage: ${currentStage}] Gọi registerPerson...`);
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
            faceUrl
          });
        }
      }

      currentStage = 'RESOLVE_CLOUD_RESULT';
      if (registerRes && (registerRes.returnCode === 1 || registerRes.returnCode === '1')) {
        finalPersonID = String(registerRes.data?.personID || registerRes.data?.id || finalPersonID || '').trim();
        let cloudAvatarCandidate = registerRes.data?.avatar || registerRes.data?.faceUrl || registerRes.data?.file || null;

        // Nếu response từ HANET không có CDN URL hoặc trả về URL tạm vừa gửi,
        // gọi API getUserInfoByAliasID để lấy chính xác Cloud avatar CDN URL
        if (!isVerifiedHanetCdnUrl(cloudAvatarCandidate) && finalAlias) {
          try {
            const lookupRes = await hanetService.getPersonByAliasID(finalAlias);
            let lookupAvatar = null;
            if (Array.isArray(lookupRes?.data)) {
              const match = lookupRes.data.find(p => p && typeof p === 'object' && p.aliasID === finalAlias);
              if (match) lookupAvatar = match.avatar || match.faceUrl;
            } else {
              const cloudInfo = lookupRes?.data?.data || lookupRes?.data;
              lookupAvatar = cloudInfo?.avatar || cloudInfo?.faceUrl;
            }
            if (isVerifiedHanetCdnUrl(lookupAvatar)) {
              cloudAvatarCandidate = lookupAvatar;
            }
          } catch (lookupErr) {
            console.warn(`[Worker register_person_job] Tra cứu avatar CDN Cloud cảnh báo:`, lookupErr.message);
          }
        }

        finalAvatarUrl = isVerifiedHanetCdnUrl(cloudAvatarCandidate) ? cloudAvatarCandidate : null;

        // Khóa phòng ban
        if (finalDeptID && finalPersonID) {
          currentStage = 'ASSIGN_DEPARTMENT';
          try {
            const deptRes = await hanetService.addPersonsToDepartment(finalDeptID, finalPersonID);
            if (deptRes && (deptRes.returnCode !== 1 && deptRes.returnCode !== '1')) {
              console.warn(`[Worker register_person_job] Gán phòng ban cảnh báo (Code ${deptRes.returnCode}): ${deptRes.returnMessage}`);
            }
          } catch (deptErr) {
            console.warn(`[Worker register_person_job] Gán phòng ban lỗi:`, deptErr.message);
          }
        }

        currentStage = 'SAVE_DB';
        const dbClient = await pool.connect();
        try {
          await dbClient.query('BEGIN');

          await dbClient.query(
            `UPDATE persons
             SET person_id = COALESCE($1, person_id),
                 face_url = COALESCE($2, face_url),
                 sync_status = 'SYNCED',
                 title = COALESCE($3, title),
                 department_id = COALESCE($4, department_id),
                 updated_at = CURRENT_TIMESTAMP
             WHERE alias_id = $5`,
            [
              finalPersonID || null,
              finalAvatarUrl || null,
              finalTitle || null,
              finalDeptID || null,
              finalAlias
            ]
          );

          if (requestId) {
            await dbClient.query(
              `UPDATE registration_requests
               SET status = 'SYNCED', person_id = $1, cloud_result = $2, updated_at = CURRENT_TIMESTAMP
               WHERE request_id = $3`,
              [finalPersonID, JSON.stringify(registerRes), requestId]
            );
          }

          await dbClient.query('COMMIT');
        } catch (dbErr) {
          await dbClient.query('ROLLBACK').catch(() => {});
          throw dbErr;
        } finally {
          dbClient.release();
        }

        currentStage = 'COMPLETE';
        await idempotencyService.markCompleted(lockKey, 3600);
        jobSucceeded = true;

        if (imagePath && fs.existsSync(imagePath)) {
          imageService.cleanupDelayed(imagePath, 30000);
        }

        return { returnCode: 1, returnMessage: 'Success', personID: finalPersonID, aliasID: finalAlias };
      } else if (registerRes && (registerRes.returnCode === -9007 || registerRes.data?.returnCode === -9007)) {
        currentStage = 'FALLBACK_9007';
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
          console.error(`[Worker register_person_job] ❌ Lỗi vĩnh viễn tại stage ${currentStage} (Mã ${code}): ${errorMsg}`);
          job.discard();
          throw new UnrecoverableError(errorMsg, code);
        }

        await idempotencyService.releaseLock(lockKey);
        throw new Error(`[Stage: ${currentStage}] [Mã lỗi ${registerRes?.returnCode}]: ${errorMsg}`);
      }
    } catch (apiErr) {
      if (apiErr instanceof UnrecoverableError || apiErr.name === 'UnrecoverableError') {
        throw apiErr;
      }

      const code = Number(apiErr.returnCode || apiErr.response?.data?.returnCode || apiErr.code);

      if (code === -9007) {
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

      const errorMsg = getErrorMessage(code, apiErr.returnMessage || apiErr.message);

      if (PERMANENT_ERROR_CODES.has(code)) {
        console.error(`[Worker register_person_job] ❌ Lỗi vĩnh viễn tại stage ${currentStage} (Mã ${code}): ${errorMsg}`);
        job.discard();
        throw new UnrecoverableError(errorMsg, code);
      }

      await idempotencyService.releaseLock(lockKey);
      throw apiErr;
    }
  } finally {
    // Không xóa ảnh khi chưa thành công
  }
});

// =========================================================================
// XỬ LÝ JOB: CẬP NHẬT NHÂN SỰ (update_person_job)
// =========================================================================
registrationQueue.process('update_person_job', 3, async (job) => {
  const { personID, name, aliasID, title, departmentID, imagePath, publicImageUrl, imageFilename, requestId, isPhotoOnly } = job.data;
  const cleanPersonID = String(personID || '').trim();
  const lockKey = idempotencyService.generateKey('PERSON_UPDATE', cleanPersonID, requestId || '');

  let currentStage = 'START';
  console.log(`[Worker update_person_job | Job: ${job.id} | Req: ${requestId || 'N/A'}] [Stage: ${currentStage}] Bắt đầu xử lý: ${name} (PersonID: ${cleanPersonID})`);

  if (!cleanPersonID) {
    throw new UnrecoverableError('Thiếu PersonID trong job cập nhật nhân sự.', -1);
  }

  const acquired = await idempotencyService.acquireLock(lockKey, 120);
  if (!acquired) {
    console.warn(`[CONCURRENCY] Job cập nhật cho ${cleanPersonID} đang được xử lý bởi worker khác.`);
    throw new Error(`[CONCURRENCY] Job cập nhật cho ${cleanPersonID} đang được xử lý bởi worker khác.`);
  }

  let jobSucceeded = false;
  let cloudAvatarUrl = null;

  try {
    try {
      // 1. Cập nhật thông tin cơ bản (Chỉ thực hiện nếu không phải là yêu cầu thuần thay ảnh)
      if (!isPhotoOnly) {
        currentStage = 'UPDATE_INFO';
        console.log(`[Worker update_person_job | Job: ${job.id}] [Stage: ${currentStage}] Gọi updateInfo cho PersonID: ${cleanPersonID}`);
        
        const infoResult = await hanetService.updateInfo({
          personID: cleanPersonID,
          name,
          aliasID,
          title,
          departmentID
        });

        if (infoResult && (infoResult.returnCode !== 1 && infoResult.returnCode !== '1')) {
          const errorMsg = getErrorMessage(infoResult.returnCode, infoResult.returnMessage);
          const code = Number(infoResult.returnCode);

          if (PERMANENT_ERROR_CODES.has(code)) {
            job.discard();
            throw new UnrecoverableError(errorMsg, code);
          }
          await idempotencyService.releaseLock(lockKey);
          throw new Error(`[Stage: ${currentStage}] [Mã lỗi ${infoResult.returnCode}]: ${errorMsg}`);
        }

        // Gán phòng ban
        if (departmentID && String(departmentID) !== '0') {
          currentStage = 'ASSIGN_DEPARTMENT';
          const deptRes = await hanetService.addPersonsToDepartment(departmentID, cleanPersonID);
          if (deptRes && (deptRes.returnCode !== 1 && deptRes.returnCode !== '1')) {
            console.warn(`[Worker update_person_job] Cảnh báo gán phòng ban (Code ${deptRes.returnCode}): ${deptRes.returnMessage}`);
          }
        }
      }

      // 2. Cập nhật Face ID nếu có ảnh mới
      const faceUrl = publicImageUrl || (imageFilename ? buildPublicImageUrl(imageFilename) : null);
      if (faceUrl) {
        currentStage = 'UPDATE_FACE';
        console.log(`[Worker update_person_job | Job: ${job.id}] [Stage: ${currentStage}] Gọi updateByFaceUrl cho PersonID: ${cleanPersonID} | FaceURL: ${faceUrl}`);

        const faceResult = await hanetService.updateByFaceUrl({
          personID: cleanPersonID,
          faceUrl,
          aliasID
        });

        if (faceResult && (faceResult.returnCode !== 1 && faceResult.returnCode !== '1')) {
          const errorMsg = getErrorMessage(faceResult.returnCode, faceResult.returnMessage);
          const code = Number(faceResult.returnCode);

          if (PERMANENT_ERROR_CODES.has(code)) {
            job.discard();
            throw new UnrecoverableError(errorMsg, code);
          }
          await idempotencyService.releaseLock(lockKey);
          throw new Error(`[Stage: ${currentStage}] [Mã lỗi ${faceResult.returnCode}]: ${errorMsg}`);
        }

        currentStage = 'RESOLVE_CLOUD_RESULT';
        let rawCloudAvatar = faceResult?.data?.avatar || faceResult?.data?.faceUrl || faceResult?.data?.file || null;
        if (!isVerifiedHanetCdnUrl(rawCloudAvatar) && aliasID) {
          try {
            const lookupRes = await hanetService.getPersonByAliasID(aliasID);
            let lookupAvatar = null;
            if (Array.isArray(lookupRes?.data)) {
              const match = lookupRes.data.find(p => p && typeof p === 'object' && p.aliasID === aliasID);
              if (match) lookupAvatar = match.avatar || match.faceUrl;
            } else {
              const cloudInfo = lookupRes?.data?.data || lookupRes?.data;
              lookupAvatar = cloudInfo?.avatar || cloudInfo?.faceUrl;
            }
            if (isVerifiedHanetCdnUrl(lookupAvatar)) {
              rawCloudAvatar = lookupAvatar;
            }
          } catch (lookupErr) {
            console.warn(`[Worker update_person_job] Tra cứu avatar CDN Cloud cảnh báo:`, lookupErr.message);
          }
        }
        cloudAvatarUrl = isVerifiedHanetCdnUrl(rawCloudAvatar) ? rawCloudAvatar : null;
      }

      // 3. Cập nhật PostgreSQL an toàn trong 1 Transaction
      currentStage = 'SAVE_DB';
      console.log(`[Worker update_person_job | Job: ${job.id}] [Stage: ${currentStage}] Ghi nhận kết quả vào PostgreSQL...`);

      const dbClient = await pool.connect();
      try {
        await dbClient.query('BEGIN');

        // Target chính xác hồ sơ theo person_id và alias_id
        const updatePersonsRes = await dbClient.query(
          `UPDATE persons
           SET name = COALESCE($1, name),
               title = COALESCE($2, title),
               face_url = COALESCE($3, face_url),
               department_id = COALESCE($4, department_id),
               sync_status = 'SYNCED',
               updated_at = CURRENT_TIMESTAMP
           WHERE person_id = $5`,
          [
            name || null,
            title || null,
            cloudAvatarUrl || null,
            departmentID || null,
            cleanPersonID
          ]
        );

        if (updatePersonsRes.rowCount === 0 && aliasID) {
          await dbClient.query(
            `UPDATE persons
             SET person_id = $1,
                 name = COALESCE($2, name),
                 title = COALESCE($3, title),
                 face_url = COALESCE($4, face_url),
                 department_id = COALESCE($5, department_id),
                 sync_status = 'SYNCED',
                 updated_at = CURRENT_TIMESTAMP
             WHERE alias_id = $6`,
            [
              cleanPersonID,
              name || null,
              title || null,
              cloudAvatarUrl || null,
              departmentID || null,
              aliasID
            ]
          );
        }

        if (requestId) {
          await dbClient.query(
            `UPDATE registration_requests
             SET status = 'SYNCED', person_id = $1, updated_at = CURRENT_TIMESTAMP
             WHERE request_id = $2`,
            [cleanPersonID, requestId]
          );
        }

        await dbClient.query('COMMIT');
      } catch (dbErr) {
        await dbClient.query('ROLLBACK').catch(() => {});
        throw dbErr;
      } finally {
        dbClient.release();
      }

      currentStage = 'COMPLETE';
      await idempotencyService.markCompleted(lockKey, 3600);
      jobSucceeded = true;

      console.log(`[Worker update_person_job | Job: ${job.id}] ✅ [Stage: ${currentStage}] Hoàn tất cập nhật PersonID: ${cleanPersonID}`);

      if (imagePath && fs.existsSync(imagePath)) {
        imageService.cleanupDelayed(imagePath, 30000);
      }

      return { success: true, personID: cleanPersonID };
    } catch (err) {
      if (err instanceof UnrecoverableError || err.name === 'UnrecoverableError') {
        throw err;
      }

      const code = Number(err.returnCode || err.code);
      if (PERMANENT_ERROR_CODES.has(code)) {
        const errorMsg = getErrorMessage(code, err.returnMessage || err.message);
        console.error(`[Worker update_person_job] ❌ Lỗi vĩnh viễn tại stage ${currentStage} (Mã ${code}): ${errorMsg}`);
        job.discard();
        throw new UnrecoverableError(errorMsg, code);
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
 * Đẩy lại (Retry/Replay) một job từ Dead Letter Queue vào Queue chính
 * Đồng bộ toàn diện imagePath, imageFilename, publicImageUrl và kiểm tra file an toàn
 */
async function retryDLQJob(dlqJobId) {
  try {
    const dlqJob = await deadLetterQueue.getJob(dlqJobId);
    if (!dlqJob) {
      return { success: false, message: `Không tìm thấy job DLQ với ID: ${dlqJobId}` };
    }

    const originalData = { ...(dlqJob.data?.jobData || dlqJob.data) };
    const jobName = dlqJob.data?.jobName || 'register_person_job';

    const uploadsDir = path.resolve(process.cwd(), 'uploads');
    let rawImagePath = originalData.imagePath;
    let validImagePath = null;

    // 1. Kiểm tra và xác định file ảnh thực tế trong thư mục uploads
    if (rawImagePath) {
      const resolvedPath = path.resolve(rawImagePath);
      if (resolvedPath.startsWith(uploadsDir) && fs.existsSync(resolvedPath)) {
        validImagePath = resolvedPath;
      } else {
        // Thử tìm theo tiền tố dlq_
        const baseName = path.basename(rawImagePath);
        const dlqCandidate = path.join(uploadsDir, baseName.startsWith('dlq_') ? baseName : `dlq_${baseName}`);
        if (fs.existsSync(dlqCandidate)) {
          validImagePath = dlqCandidate;
        }
      }
    }

    // Nếu không tìm thấy file ảnh thực tế trên đĩa -> Báo lỗi, KHÔNG enqueue, KHÔNG xóa job DLQ
    if (!validImagePath || !fs.existsSync(validImagePath)) {
      console.error(`❌ [DLQ Replay Error] Không tìm thấy file ảnh hợp lệ cho job DLQ ${dlqJobId}. Đường dẫn gốc: ${rawImagePath}`);
      return {
        success: false,
        code: 'IMAGE_NOT_FOUND',
        message: `File ảnh của job DLQ không tồn tại hoặc đã bị dọn dẹp. Không thể replay.`
      };
    }

    // 2. Đồng bộ 100% tham chiếu ảnh: imagePath, imageFilename, publicImageUrl, faceUrl
    const validFilename = path.basename(validImagePath);
    const validPublicUrl = buildPublicImageUrl(validFilename);

    originalData.imagePath = validImagePath;
    originalData.imageFilename = validFilename;
    originalData.publicImageUrl = validPublicUrl;
    if (originalData.faceUrl) {
      originalData.faceUrl = validPublicUrl;
    }

    // Gắn metadata truy vết liên kết job cũ - job mới
    originalData.replayedFromDLQ = String(dlqJobId);
    originalData.replayedAt = new Date().toISOString();

    // 3. Kiểm tra Idempotency Lock: Chống replay trùng lặp khi worker khác đang xử lý
    const cleanPersonID = originalData.personId ? String(originalData.personId).trim() : (originalData.personID ? String(originalData.personID).trim() : '');
    const cleanAliasID = originalData.aliasID ? String(originalData.aliasID).trim() : (originalData.alias_id ? String(originalData.alias_id).trim() : '');
    const lockIdentifier = cleanPersonID || cleanAliasID;
    const lockAction = cleanPersonID ? 'PERSON_UPDATE' : 'FACE_REGISTER';
    const lockKey = idempotencyService.generateKey(lockAction, lockIdentifier, originalData.requestId || '');

    const currentLockStatus = await idempotencyService.getLockStatus(lockKey);
    if (currentLockStatus === 'PROCESSING') {
      return {
        success: false,
        code: 'LOCKED_IN_PROCESSING',
        message: `Tác vụ cho ${lockIdentifier} đang được xử lý bởi worker khác. Vui lòng thử lại sau.`
      };
    }

    // Giải phóng lock COMPLETED cũ để cho phép nạp lại
    await idempotencyService.clearCompleted(lockAction, lockIdentifier);

    // 4. Đẩy lại vào Hàng đợi chính
    const newJob = await registrationQueue.add(jobName, originalData);

    // 5. Chỉ xóa job khỏi DLQ sau khi enqueue thành công
    await dlqJob.remove();

    console.log(`✅ [DLQ Replay] Đã tái nạp thành công job DLQ ${dlqJobId} -> Main Job ID: ${newJob.id} | Image: ${validFilename} | URL: ${validPublicUrl}`);
    return {
      success: true,
      message: `Đã tái nạp thành công vào hàng đợi chính với Job ID: ${newJob.id}`,
      newJobId: newJob.id,
      imageFilename: validFilename,
      publicImageUrl: validPublicUrl
    };
  } catch (err) {
    console.error(`❌ [DLQ Retry Error] Không thể retry job DLQ ${dlqJobId}:`, err.message);
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

/**
 * Đóng an toàn các Bull Queues và kết nối Redis liên quan (phục vụ graceful shutdown và teardown test)
 */
async function closeQueues() {
  try {
    if (registrationQueue) {
      await registrationQueue.close();
    }
  } catch (err) {
    console.warn('[QueueService] Lỗi khi đóng registrationQueue:', err.message);
  }

  try {
    if (deadLetterQueue) {
      await deadLetterQueue.close();
    }
  } catch (err) {
    console.warn('[QueueService] Lỗi khi đóng deadLetterQueue:', err.message);
  }

  if (idempotencyService && typeof idempotencyService.close === 'function') {
    idempotencyService.close();
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
  closeQueues,
  registrationQueue,
  hanetQueue,
  deadLetterQueue,
  UnrecoverableError,
  PERMANENT_ERROR_CODES,
  NON_RETRIABLE_CODES
};
