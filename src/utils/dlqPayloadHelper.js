/**
 * src/utils/dlqPayloadHelper.js
 * Module thuần túy chuẩn hóa và xác thực cấu trúc dữ liệu của Job trong Dead Letter Queue.
 * Bảo đảm tính toàn vẹn dữ liệu, kiểm soát kiểu nghiêm ngặt và ngăn ngừa ghi đè dữ liệu nghiệp vụ.
 */

const path = require('path');
const fs = require('fs');
const { verifyUploadFilePath, sanitizeFilename, buildPublicImageUrl } = require('./urlHelper');

const SUPPORTED_JOB_TYPES = new Set(['update_person_job', 'register_person_job']);
const IGNORED_WRAPPER_NAMES = new Set(['dead_letter_job', '']);

class PayloadValidationError extends Error {
  constructor(message, code = 'PAYLOAD_VALIDATION_ERROR') {
    super(message);
    this.name = 'PayloadValidationError';
    this.code = code;
  }
}

/**
 * Phân tích và ép kiểu boolean nghiêm ngặt (Strict Boolean Parser)
 * Giá trị TRUE : true, 1, 'true', '1', 'TRUE'
 * Giá trị FALSE: false, 0, 'false', '0', 'FALSE', null, undefined, ''
 * @param {any} val
 * @returns {boolean}
 */
function parseStrictBoolean(val) {
  if (val === true || val === 1) return true;
  if (val === false || val === 0 || val === null || val === undefined) return false;
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    if (trimmed === 'true' || trimmed === '1') return true;
    if (trimmed === 'false' || trimmed === '0' || trimmed === '') return false;
  }
  return false;
}

/**
 * Xác thực kiểu dữ liệu của mã định danh (Identifier: PersonID, AliasID)
 * CHỈ chấp nhận primitive string hoặc number; từ chối object, array, boolean,...
 * @param {any} val
 * @param {string} fieldName
 * @returns {string|null}
 */
function parseAndValidateIdentifier(val, fieldName) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    if (Number.isNaN(val) || !Number.isFinite(val)) {
      throw new PayloadValidationError(
        `Trường ${fieldName} không phải là số hợp lệ (${val}).`,
        'INVALID_IDENTIFIER_TYPE'
      );
    }
    const strNum = String(val).trim();
    return strNum || null;
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed || null;
  }
  throw new PayloadValidationError(
    `Trường ${fieldName} phải có kiểu string hoặc number, nhận được kiểu "${typeof val}".`,
    'INVALID_IDENTIFIER_TYPE'
  );
}

/**
 * Thu thập và kiểm tra xung đột định danh trên toàn bộ payload
 * @param {Array<{val: any, src: string}>} candidates
 * @param {string} fieldName
 * @returns {string|null}
 */
function resolveIdentifier(candidates, fieldName) {
  const uniqueValues = new Set();
  const sourceValues = [];

  for (const item of candidates) {
    const parsed = parseAndValidateIdentifier(item.val, item.src);
    if (parsed !== null) {
      uniqueValues.add(parsed);
      sourceValues.push(`${item.src}=${parsed}`);
    }
  }

  if (uniqueValues.size > 1) {
    throw new PayloadValidationError(
      `Xung đột định danh ${fieldName} giữa các trường/tầng dữ liệu: [${sourceValues.join(', ')}]`,
      'PAYLOAD_CONFLICT'
    );
  }

  return uniqueValues.size === 1 ? Array.from(uniqueValues)[0] : null;
}

/**
 * Chuẩn hóa DLQ payload và kiểm tra tính toàn vẹn nghiêm ngặt
 * @param {object} dlqJob - Bull Job object hoặc job data raw
 * @returns {object} Payload đã chuẩn hóa
 */
function normalizeDLQJobPayload(dlqJob) {
  if (!dlqJob) {
    throw new PayloadValidationError('DLQ Job object không tồn tại hoặc rỗng.', 'EMPTY_JOB');
  }

  const rawData = dlqJob.data || dlqJob;
  if (typeof rawData !== 'object' || rawData === null) {
    throw new PayloadValidationError('DLQ Job data không phải là object hợp lệ.', 'EMPTY_JOB');
  }

  const rawJobData = typeof rawData.jobData === 'object' && rawData.jobData !== null ? rawData.jobData : null;
  const rawOriginalData = typeof rawData.originalData === 'object' && rawData.originalData !== null ? rawData.originalData : null;

  // 1. Kiểm tra và trích xuất Person ID trên tất cả các tầng dữ liệu (từ chối sai kiểu, bắt xung đột)
  const personIdCandidates = [
    { val: rawData.personID, src: 'rawData.personID' },
    { val: rawData.personId, src: 'rawData.personId' },
    { val: rawJobData?.personID, src: 'jobData.personID' },
    { val: rawJobData?.personId, src: 'jobData.personId' },
    { val: rawOriginalData?.personID, src: 'originalData.personID' },
    { val: rawOriginalData?.personId, src: 'originalData.personId' }
  ];
  const personID = resolveIdentifier(personIdCandidates, 'PersonID');

  // 2. Kiểm tra và trích xuất Alias ID trên tất cả các tầng dữ liệu (từ chối sai kiểu, bắt xung đột)
  const aliasIdCandidates = [
    { val: rawData.aliasID, src: 'rawData.aliasID' },
    { val: rawData.alias_id, src: 'rawData.alias_id' },
    { val: rawJobData?.aliasID, src: 'jobData.aliasID' },
    { val: rawJobData?.alias_id, src: 'jobData.alias_id' },
    { val: rawOriginalData?.aliasID, src: 'originalData.aliasID' },
    { val: rawOriginalData?.alias_id, src: 'originalData.alias_id' }
  ];
  const aliasID = resolveIdentifier(aliasIdCandidates, 'AliasID');

  // 3. Thu thập và kiểm tra xung đột operation_type trên các tầng dữ liệu
  const opTypeSources = [
    { val: rawData.operation_type, src: 'rawData.operation_type' },
    { val: rawJobData?.operation_type, src: 'jobData.operation_type' },
    { val: rawOriginalData?.operation_type, src: 'originalData.operation_type' }
  ];
  const uniqueOpTypes = new Set();
  for (const item of opTypeSources) {
    if (item.val && typeof item.val === 'string') {
      const trimmed = item.val.trim().toUpperCase();
      if (trimmed) uniqueOpTypes.add(trimmed);
    }
  }
  if (uniqueOpTypes.size > 1) {
    throw new PayloadValidationError(
      `Xung đột operation_type giữa các tầng dữ liệu: [${Array.from(uniqueOpTypes).join(', ')}]`,
      'PAYLOAD_CONFLICT'
    );
  }
  const operation_type = uniqueOpTypes.size === 1 ? Array.from(uniqueOpTypes)[0] : null;

  // 4. Thu thập tất cả các jobName được khai báo rõ ràng (không suy luận đè lên khai báo)
  const declaredJobNameSources = [
    { val: dlqJob.name, src: 'dlqJob.name' },
    { val: rawData.jobName, src: 'rawData.jobName' },
    { val: rawData.originalJobName, src: 'rawData.originalJobName' },
    { val: rawJobData?.jobName, src: 'jobData.jobName' },
    { val: rawJobData?.originalJobName, src: 'jobData.originalJobName' },
    { val: rawOriginalData?.jobName, src: 'originalData.jobName' },
    { val: rawOriginalData?.originalJobName, src: 'originalData.originalJobName' }
  ];

  const declaredJobNames = new Set();
  const declaredDetails = [];
  for (const item of declaredJobNameSources) {
    if (item.val && typeof item.val === 'string') {
      const cleanName = item.val.trim();
      if (cleanName && !IGNORED_WRAPPER_NAMES.has(cleanName)) {
        declaredJobNames.add(cleanName);
        declaredDetails.push(`${item.src}=${cleanName}`);
      }
    }
  }

  // Nếu có bất kỳ jobName khai báo nào không thuộc SUPPORTED_JOB_TYPES -> Báo lỗi UNSUPPORTED_JOB_TYPE ngay
  for (const name of declaredJobNames) {
    if (!SUPPORTED_JOB_TYPES.has(name)) {
      throw new PayloadValidationError(
        `Loại job "${name}" không được hỗ trợ để replay. Chỉ hỗ trợ: ${Array.from(SUPPORTED_JOB_TYPES).join(', ')}`,
        'UNSUPPORTED_JOB_TYPE'
      );
    }
  }

  // Nếu có nhiều jobName khác nhau được khai báo (ví dụ update vs register) -> Báo lỗi xung đột
  if (declaredJobNames.size > 1) {
    throw new PayloadValidationError(
      `Xung đột khai báo jobName giữa các tầng payload: [${declaredDetails.join(', ')}]`,
      'PAYLOAD_CONFLICT'
    );
  }

  let jobName = null;
  if (declaredJobNames.size === 1) {
    jobName = Array.from(declaredJobNames)[0];
  } else {
    // CHỈ suy luận khi HOÀN TOÀN KHÔNG có jobName được khai báo
    if (operation_type === 'UPDATE_PHOTO') {
      jobName = 'update_person_job';
    } else if (operation_type === 'REGISTER_NEW') {
      jobName = 'register_person_job';
    } else if (personID) {
      jobName = 'update_person_job';
    } else if (aliasID) {
      jobName = 'register_person_job';
    } else {
      throw new PayloadValidationError(
        `Không thể xác định loại job từ payload DLQ. Chỉ hỗ trợ: ${Array.from(SUPPORTED_JOB_TYPES).join(', ')}`,
        'UNSUPPORTED_JOB_TYPE'
      );
    }
  }

  // 5. Kiểm tra xung đột giữa jobName và operation_type
  if (jobName === 'update_person_job' && operation_type === 'REGISTER_NEW') {
    throw new PayloadValidationError(
      'Xung đột nghiệp vụ: jobName là "update_person_job" nhưng operation_type là "REGISTER_NEW".',
      'OPERATION_TYPE_CONFLICT'
    );
  }
  if (jobName === 'register_person_job' && operation_type === 'UPDATE_PHOTO') {
    throw new PayloadValidationError(
      'Xung đột nghiệp vụ: jobName là "register_person_job" nhưng operation_type là "UPDATE_PHOTO".',
      'OPERATION_TYPE_CONFLICT'
    );
  }

  // 6. Xác thực trường bắt buộc theo từng loại job
  if (jobName === 'update_person_job') {
    if (!personID) {
      throw new PayloadValidationError(
        'Job "update_person_job" bắt buộc phải có PersonID hợp lệ.',
        'MISSING_REQUIRED_PERSON_ID'
      );
    }
  }

  if (jobName === 'register_person_job') {
    if (!aliasID) {
      throw new PayloadValidationError(
        'Job "register_person_job" bắt buộc phải có AliasID hợp lệ.',
        'MISSING_REQUIRED_ALIAS_ID'
      );
    }
  }

  // 7. Hợp nhất payload an toàn (bảo đảm không che giấu dữ liệu đã xác thực)
  const merged = {
    ...rawData,
    ...(rawOriginalData || {}),
    ...(rawJobData || {})
  };

  // 8. Trích xuất isPhotoOnly (Strict Boolean Parser)
  const isPhotoOnly = parseStrictBoolean(merged.isPhotoOnly) || (operation_type === 'UPDATE_PHOTO');

  // 9. Trích xuất title: KHÔNG tự động mặc định "Học Sinh" (phải là null nếu thiếu)
  let title = null;
  if (merged.title !== undefined && merged.title !== null) {
    const cleanTitle = String(merged.title).trim();
    title = cleanTitle || null;
  }

  // 10. Trích xuất các trường thông tin khác
  const name = merged.name !== undefined && merged.name !== null ? String(merged.name).trim() : '';
  const departmentID = merged.departmentID !== undefined && merged.departmentID !== null
    ? String(merged.departmentID).trim()
    : (merged.department_id !== undefined && merged.department_id !== null ? String(merged.department_id).trim() : null);
  const requestId = merged.requestId ? String(merged.requestId).trim() : null;
  const source_csv = merged.source_csv || merged.className || merged.class_name || null;
  const originalJobId = rawData.originalJobId || merged.originalJobId || merged.jobId || dlqJob.id || null;

  // 11. Trích xuất thông tin ảnh
  const imagePath = merged.imagePath ? String(merged.imagePath).trim() : null;
  const imageFilename = merged.imageFilename ? String(merged.imageFilename).trim() : (imagePath ? path.basename(imagePath) : null);
  const publicImageUrl = merged.publicImageUrl || merged.faceUrl || null;

  return {
    jobName,
    originalJobId: originalJobId ? String(originalJobId) : null,
    personID,
    aliasID,
    name,
    title,
    departmentID,
    requestId,
    isPhotoOnly,
    source_csv,
    imagePath,
    imageFilename,
    publicImageUrl,
    faceUrl: publicImageUrl,
    rawPayload: merged
  };
}

/**
 * Kiểm tra và đồng bộ triad tham chiếu ảnh cho Job DLQ
 * @param {object} normalized - Payload đã normalize từ normalizeDLQJobPayload
 * @param {string} [customUploadsDir] - Đường dẫn thư mục uploads tùy chọn
 * @returns {object} Triad ảnh đã xác minh { validImagePath, validFilename, validPublicUrl }
 */
function verifyAndSyncImageTriad(normalized, customUploadsDir = null) {
  const uploadsDir = customUploadsDir ? path.resolve(customUploadsDir) : path.resolve(process.cwd(), 'uploads');
  const rawImagePath = normalized.imagePath || (normalized.imageFilename ? path.join(uploadsDir, normalized.imageFilename) : null);

  // Nếu job là update nhưng không có ảnh và không phải photo update
  if (!rawImagePath && !normalized.imageFilename && !normalized.publicImageUrl) {
    if (normalized.jobName === 'update_person_job' && !normalized.isPhotoOnly) {
      // Cho phép update thông tin không kèm ảnh
      return { validImagePath: null, validFilename: null, validPublicUrl: null };
    }
    throw new PayloadValidationError('Job yêu cầu ảnh nhưng không có bất kỳ thông tin ảnh nào trong payload.', 'MISSING_IMAGE_INFO');
  }

  let candidatePath = null;
  if (rawImagePath) {
    const resolvedCandidate = path.resolve(rawImagePath);
    if (fs.existsSync(resolvedCandidate)) {
      candidatePath = resolvedCandidate;
    } else {
      // Thử tìm với tiền tố dlq_
      const baseName = path.basename(rawImagePath);
      const dlqBaseName = baseName.startsWith('dlq_') ? baseName : `dlq_${baseName}`;
      const dlqCandidate = path.join(uploadsDir, dlqBaseName);
      if (fs.existsSync(dlqCandidate)) {
        candidatePath = dlqCandidate;
      }
    }
  }

  if (!candidatePath || !fs.existsSync(candidatePath)) {
    throw new PayloadValidationError(
      `Không tìm thấy file ảnh thực tế trên đĩa (Kiểm tra: ${rawImagePath || normalized.imageFilename || 'N/A'})`,
      'IMAGE_FILE_NOT_FOUND'
    );
  }

  // Đảm bảo là file thông thường, không phải thư mục
  const stat = fs.statSync(candidatePath);
  if (!stat.isFile()) {
    throw new PayloadValidationError(`Đường dẫn ảnh "${candidatePath}" không phải là một file hợp lệ.`, 'INVALID_FILE_TYPE');
  }

  // Xác thực an toàn không path traversal và không thoát khỏi thư mục uploads (bao gồm realpath symlink)
  const validImagePath = verifyUploadFilePath(candidatePath, uploadsDir);
  const rawBase = path.basename(validImagePath);
  const validFilename = sanitizeFilename(rawBase);
  const validPublicUrl = buildPublicImageUrl(validFilename);

  return {
    validImagePath,
    validFilename,
    validPublicUrl
  };
}

module.exports = {
  SUPPORTED_JOB_TYPES,
  PayloadValidationError,
  parseStrictBoolean,
  parseAndValidateIdentifier,
  normalizeDLQJobPayload,
  verifyAndSyncImageTriad
};
