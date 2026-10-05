#!/usr/bin/env node

/**
 * Công cụ Đối soát & Phục hồi Cloud Face URL cho PostgreSQL (Postgres-First)
 * File: scripts/reconcile_face_urls.js
 * 
 * Mục tiêu:
 * - Quét các bản ghi trong bảng `persons` theo danh sách ID cụ thể (ví dụ: 5 hồ sơ đợt đầu: 364, 368, 370, 383, 395).
 * - Đối soát với thông tin thực tế từ HANET AI Cloud qua API `getUserInfoByAliasID`.
 * - Áp dụng pure adapter `selectCloudPerson` xác minh nghiêm ngặt định danh (aliasID, personID dạng chuỗi, placeID).
 * - Mặc định chạy ở chế độ DRY-RUN (chỉ kiểm tra, không ghi DB).
 * - Khi truyền cờ `--apply`, chỉ cập nhật cột `face_url` của bản ghi MATCHED, bảo toàn snapshot concurrency và ghi audit log trong cùng transaction.
 * 
 * Cách dùng:
 * - Dry-run (mặc định):
 *     node scripts/reconcile_face_urls.js --ids 364,368,370,383,395
 * - Dry-run xuất báo cáo JSON:
 *     node scripts/reconcile_face_urls.js --ids 364,368,370,383,395 --output /tmp/face-url-reconciliation.json
 * - Apply (chỉ khi có phê duyệt):
 *     node scripts/reconcile_face_urls.js --ids 364,368,370,383,395 --apply
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');
const hanetService = require('../src/services/hanetService');
const { isVerifiedHanetCdnUrl } = require('../src/utils/urlHelper');

/**
 * Pure adapter: Trích xuất và xác minh hồ sơ duy nhất từ response API HANET (/person/getUserInfoByAliasID).
 * 
 * @param {Object} response - Phản hồi từ hanetService
 * @param {Object} expected - { aliasID: string, personID: string, placeID: string|number }
 * @returns {Object} Hồ sơ person hợp lệ
 * @throws {Error} Error có thuộc tính .code phân loại chính xác
 */
function selectCloudPerson(response, expected) {
  if (!response || typeof response !== 'object') {
    const err = new Error('RESPONSE_SHAPE_INVALID');
    err.code = 'RESPONSE_SHAPE_INVALID';
    throw err;
  }

  if (response.returnCode !== 1 && response.returnCode !== '1') {
    const err = new Error('HANET_BUSINESS_ERROR');
    err.code = 'HANET_BUSINESS_ERROR';
    err.details = response.returnMessage || 'Mã lỗi nghiệp vụ từ HANET';
    throw err;
  }

  if (!Array.isArray(response.data)) {
    const err = new Error('RESPONSE_SHAPE_INVALID');
    err.code = 'RESPONSE_SHAPE_INVALID';
    throw err;
  }

  if (
    !expected ||
    typeof expected.aliasID !== 'string' ||
    !expected.aliasID.trim() ||
    typeof expected.personID !== 'string' ||
    !expected.personID.trim() ||
    expected.placeID == null
  ) {
    const err = new Error('EXPECTED_IDENTITY_MISSING');
    err.code = 'EXPECTED_IDENTITY_MISSING';
    throw err;
  }

  const alias = expected.aliasID.trim();
  const personID = expected.personID.trim();
  const placeID = String(expected.placeID).trim();

  // Lọc ứng viên có aliasID trùng khớp với alias mong đợi
  const candidates = response.data.filter(person =>
    person &&
    typeof person === 'object' &&
    !Array.isArray(person) &&
    typeof person.aliasID === 'string' &&
    person.aliasID.trim() === alias
  );

  if (candidates.length === 0) {
    const err = new Error('IDENTITY_NOT_FOUND');
    err.code = 'IDENTITY_NOT_FOUND';
    throw err;
  }

  if (candidates.length !== 1) {
    const err = new Error('AMBIGUOUS');
    err.code = 'AMBIGUOUS';
    throw err;
  }

  const person = candidates[0];

  if (
    typeof person.personID !== 'string' ||
    !person.personID.trim() ||
    person.placeID == null
  ) {
    const err = new Error('IDENTITY_MISSING');
    err.code = 'IDENTITY_MISSING';
    throw err;
  }

  const validPlaceType =
    (typeof person.placeID === 'string' && person.placeID.trim().length > 0) ||
    (typeof person.placeID === 'number' && Number.isSafeInteger(person.placeID));

  if (!validPlaceType) {
    const err = new Error('PLACE_ID_INVALID');
    err.code = 'PLACE_ID_INVALID';
    throw err;
  }

  if (
    person.personID.trim() !== personID ||
    String(person.placeID).trim() !== placeID
  ) {
    const err = new Error('IDENTITY_CONFLICT');
    err.code = 'IDENTITY_CONFLICT';
    throw err;
  }

  return person;
}

/**
 * Phân tích tham số dòng lệnh CLI an toàn
 * @param {string[]} rawArgs
 * @returns {{ ids: number[], isApply: boolean, isDryRun: boolean, outputPath: string|null }}
 */
function parseCliArgs(rawArgs = process.argv.slice(2)) {
  let ids = null;
  let isApply = false;
  let isDryRunExplicit = false;
  let outputPath = null;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];

    if (arg === '--ids') {
      if (i + 1 >= rawArgs.length || !rawArgs[i + 1] || rawArgs[i + 1].startsWith('--')) {
        throw new Error('MISSING_IDS_ARG: Cờ --ids yêu cầu truyền danh sách ID (ví dụ: --ids 364,368,370,383,395)');
      }
      ids = parseIdsString(rawArgs[i + 1]);
      i++;
    } else if (arg.startsWith('--ids=')) {
      const val = arg.substring(6);
      ids = parseIdsString(val);
    } else if (arg === '--apply') {
      isApply = true;
    } else if (arg === '--dry-run') {
      isDryRunExplicit = true;
    } else if (arg === '--output') {
      if (i + 1 >= rawArgs.length || !rawArgs[i + 1] || rawArgs[i + 1].startsWith('--')) {
        throw new Error('MISSING_OUTPUT_PATH: Cờ --output yêu cầu đường dẫn tệp (ví dụ: --output /tmp/report.json)');
      }
      outputPath = rawArgs[i + 1].trim();
      i++;
    } else if (arg.startsWith('--output=')) {
      outputPath = arg.substring(9).trim();
      if (!outputPath) {
        throw new Error('EMPTY_OUTPUT_PATH: Đường dẫn --output không được để trống');
      }
    } else {
      throw new Error(`UNRECOGNIZED_FLAG: Cờ không nhận diện "${arg}". Các cờ hợp lệ: --ids, --dry-run, --apply, --output`);
    }
  }

  if (isApply && isDryRunExplicit) {
    throw new Error('CONTRADICTORY_FLAGS: Không thể chỉ định đồng thời cả --dry-run và --apply');
  }

  if (!ids || ids.length === 0) {
    throw new Error('IDS_REQUIRED: Tham số --ids là bắt buộc và phải chứa ít nhất một ID số dương hợp lệ (ví dụ: --ids 364,368,370,383,395)');
  }

  return {
    ids,
    isApply,
    isDryRun: !isApply,
    outputPath
  };
}

/**
 * Phân tích chuỗi ID thành mảng số nguyên dương
 * @param {string} str
 * @returns {number[]}
 */
function parseIdsString(str) {
  if (!str || typeof str !== 'string' || !str.trim()) {
    throw new Error('INVALID_IDS_FORMAT: Chuỗi --ids không được để trống');
  }

  const parts = str.split(',').map(s => s.trim()).filter(s => s.length > 0);
  if (parts.length === 0) {
    throw new Error('INVALID_IDS_FORMAT: Không tìm thấy ID hợp lệ');
  }

  const numbers = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) {
      throw new Error(`INVALID_ID_VALUE: ID "${part}" không phải là số nguyên dương hợp lệ`);
    }
    const num = parseInt(part, 10);
    if (!Number.isSafeInteger(num) || num <= 0) {
      throw new Error(`INVALID_ID_VALUE: ID "${part}" nằm ngoài phạm vi số nguyên an toàn`);
    }
    numbers.push(num);
  }

  return numbers;
}

/**
 * Hàm thực thi đối soát và phục hồi Cloud Face URL
 * @param {Object} [customOptions]
 * @returns {Promise<Object>}
 */
async function runReconciliation(customOptions = null) {
  const options = customOptions || parseCliArgs();
  const { ids, isApply, outputPath } = options;

  console.log('======================================================================');
  console.log('🔍 CÔNG CỤ ĐỐI SOÁT CLOUD FACE URL — THANH_GIUSE_PC');
  console.log(`📌 Chế độ vận hành: ${isApply ? '⚠️ APPLY (Cập nhật Database có kiểm soát)' : '🛡️ DRY-RUN (Chỉ kiểm tra, không ghi DB)'}`);
  console.log(`🎯 Bộ lọc ID chỉ định: [${ids.join(', ')}]`);
  console.log('======================================================================\n');

  const client = await pool.connect();

  try {
    // 1. Truy vấn các bản ghi đích từ PostgreSQL bảo toàn microsecond precision cho updated_at
    const query = `
      SELECT id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status,
             to_char(updated_at, 'YYYY-MM-DD HH24:MI:SS.US') AS updated_at_raw,
             updated_at
      FROM persons
      WHERE id = ANY($1::int[])
      ORDER BY id ASC
    `;
    const res = await client.query(query, [ids]);
    const candidateRows = res.rows;

    console.log(`📊 Số bản ghi tìm thấy trong PostgreSQL: ${candidateRows.length} (trên tổng ${ids.length} ID yêu cầu)\n`);

    if (candidateRows.length === 0) {
      console.log('⚠️ Không tìm thấy bản ghi nào khớp với danh sách ID đã chỉ định.');
      return {
        success: true,
        total: 0,
        matched: 0,
        no_change: 0,
        identity_conflict: 0,
        ambiguous: 0,
        avatar_missing: 0,
        avatar_rejected: 0,
        unverified: 0,
        applied: 0,
        items: []
      };
    }

    let matchedCount = 0;
    let noChangeCount = 0;
    let identityConflictCount = 0;
    let ambiguousCount = 0;
    let avatarMissingCount = 0;
    let avatarRejectedCount = 0;
    let unverifiedCount = 0;
    let skippedCount = 0;
    let appliedCount = 0;
    let applyFailedCount = 0;

    const auditReport = [];
    const configuredPlaceId = hanetService.placeId;

    for (const row of candidateRows) {
      const { id, alias_id, person_id, name, class_name, face_url, sync_status, updated_at_raw } = row;
      const dbPersonId = person_id !== null && person_id !== undefined ? String(person_id).trim() : '';
      const cleanAlias = alias_id ? String(alias_id).trim() : '';

      let cloudAvatarUrl = null;
      let cloudPersonId = null;
      let statusResult = 'UNKNOWN';
      let reason = '';
      const apiSource = 'HANET /person/getUserInfoByAliasID';

      if (!cleanAlias) {
        statusResult = 'SKIPPED';
        reason = 'Bản ghi không có alias_id để đối soát với Cloud';
        skippedCount++;
      } else if (!dbPersonId) {
        statusResult = 'UNVERIFIED';
        reason = 'Bản ghi PostgreSQL chưa có person_id để đối soát danh tính với Cloud';
        unverifiedCount++;
      } else {
        try {
          const lookupRes = await hanetService.getPersonByAliasID(cleanAlias, configuredPlaceId);

          let selectedPerson = null;
          try {
            selectedPerson = selectCloudPerson(lookupRes, {
              aliasID: cleanAlias,
              personID: dbPersonId,
              placeID: configuredPlaceId
            });
          } catch (adapterErr) {
            if (adapterErr.code === 'IDENTITY_CONFLICT') {
              statusResult = 'IDENTITY_CONFLICT';
              reason = 'Mâu thuẫn định danh: personID hoặc placeID trên Cloud không khớp với PostgreSQL';
              identityConflictCount++;
            } else if (adapterErr.code === 'AMBIGUOUS') {
              statusResult = 'AMBIGUOUS';
              reason = `Tìm thấy nhiều hồ sơ Cloud trùng alias ${cleanAlias}`;
              ambiguousCount++;
            } else if (adapterErr.code === 'IDENTITY_NOT_FOUND') {
              statusResult = 'IDENTITY_NOT_FOUND';
              reason = `Không tìm thấy hồ sơ có alias ${cleanAlias} trên Cloud`;
              unverifiedCount++;
            } else if (adapterErr.code === 'RESPONSE_SHAPE_INVALID') {
              statusResult = 'RESPONSE_SHAPE_INVALID';
              reason = 'Cấu trúc response từ HANET không phải là mảng hoặc không hợp lệ';
              unverifiedCount++;
            } else if (adapterErr.code === 'IDENTITY_MISSING') {
              statusResult = 'IDENTITY_MISSING';
              reason = 'Hồ sơ Cloud thiếu trường personID hoặc placeID';
              unverifiedCount++;
            } else if (adapterErr.code === 'PLACE_ID_INVALID') {
              statusResult = 'PLACE_ID_INVALID';
              reason = 'placeID của hồ sơ Cloud không phải chuỗi hoặc số nguyên an toàn';
              unverifiedCount++;
            } else {
              statusResult = 'UNVERIFIED';
              reason = `Lỗi xác minh: ${adapterErr.message || adapterErr.code}`;
              unverifiedCount++;
            }
          }

          if (selectedPerson) {
            cloudPersonId = selectedPerson.personID.trim();
            const rawAvatar = selectedPerson.avatar || selectedPerson.faceUrl || null;

            if (!rawAvatar || typeof rawAvatar !== 'string' || !rawAvatar.trim()) {
              statusResult = 'AVATAR_MISSING';
              reason = 'Hồ sơ Cloud đã xác minh danh tính nhưng chưa có avatar (avatar = null hoặc rỗng)';
              avatarMissingCount++;
            } else {
              const cleanAvatar = rawAvatar.trim();
              if (!isVerifiedHanetCdnUrl(cleanAvatar)) {
                statusResult = 'AVATAR_URL_REJECTED';
                reason = `Avatar URL (${cleanAvatar}) bị từ chối do không thuộc CDN HANET được cấp phép`;
                avatarRejectedCount++;
              } else {
                cloudAvatarUrl = cleanAvatar;
                if (row.face_url === cleanAvatar) {
                  statusResult = 'NO_CHANGE';
                  reason = 'face_url trong DB đã khớp chính xác với Cloud CDN URL';
                  noChangeCount++;
                } else {
                  statusResult = 'MATCHED';
                  reason = 'Đã đối soát thành công định danh và avatar CDN';
                  matchedCount++;
                }
              }
            }
          }
        } catch (apiErr) {
          statusResult = 'UNVERIFIED';
          reason = `Lỗi gọi API HANET (${apiErr.message})`;
          unverifiedCount++;
        }
      }

      const reportItem = {
        id,
        name,
        class_name,
        alias_id: cleanAlias,
        person_id: dbPersonId || cloudPersonId || null,
        cloud_person_id: cloudPersonId || null,
        sync_status: sync_status || 'UNKNOWN',
        old_face_url: face_url,
        proposed_cloud_url: cloudAvatarUrl || null,
        status: statusResult,
        reason,
        source: apiSource,
        snapshot_updated_at: updated_at_raw || null,
        reconciled_at: new Date().toISOString()
      };

      auditReport.push(reportItem);

      // ---------------------------------------------------------------------
      // ÁP DỤNG CÓ ĐIỀU KIỆN (CHẾ ĐỘ --apply)
      // ---------------------------------------------------------------------
      if (isApply && statusResult === 'MATCHED' && cloudAvatarUrl) {
        try {
          await client.query('BEGIN');

          // Cập nhật với kiểm tra snapshot optimistic locking (bảo toàn microseconds)
          const updateQuery = `
            UPDATE persons
            SET face_url = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
              AND alias_id = $3
              AND person_id IS NOT DISTINCT FROM $4
              AND face_url IS NOT DISTINCT FROM $5
              AND (
                ($6::timestamp IS NULL AND updated_at IS NULL)
                OR updated_at = $6::timestamp
              )
            RETURNING id, alias_id, person_id, face_url, sync_status, updated_at;
          `;

          const updateRes = await client.query(updateQuery, [
            cloudAvatarUrl,
            id,
            cleanAlias,
            row.person_id,
            row.face_url,
            updated_at_raw
          ]);

          if (updateRes.rowCount !== 1) {
            await client.query('ROLLBACK');
            reportItem.apply_status = 'SKIPPED_SNAPSHOT_CHANGED';
            reportItem.apply_error = 'Dữ liệu bản ghi đã bị thay đổi kể từ lúc đọc snapshot. Đã bỏ qua an toàn.';
            applyFailedCount++;
            console.warn(`⚠️ [Snapshot Mismatch] Bản ghi ID ${id} đã bị thay đổi, bỏ qua không cập nhật.`);
          } else {
            // Ghi audit log vào bảng audit_logs trong cùng transaction
            try {
              await client.query(
                `INSERT INTO audit_logs (action, user_id, username, role, status_code, ip_address, user_agent, target_id, details, created_at)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)`,
                [
                  'RECONCILE_FACE_URL',
                  'SYSTEM_RECONCILE_SCRIPT',
                  'system_reconciler',
                  'SYSTEM',
                  200,
                  '127.0.0.1',
                  'reconcile_face_urls.js',
                  String(id),
                  JSON.stringify({
                    id,
                    alias_id: cleanAlias,
                    old_face_url: face_url,
                    new_face_url: cloudAvatarUrl,
                    previous_updated_at: updated_at_raw
                  })
                ]
              );
            } catch (auditErr) {
              console.error(`❌ [Audit Log Error] Không thể ghi audit log cho ID ${id}:`, auditErr.message);
              throw auditErr;
            }

            await client.query('COMMIT');
            reportItem.apply_status = 'APPLIED_SUCCESS';
            appliedCount++;
            console.log(`✅ [APPLIED] Đã khôi phục thành công face_url cho ID ${id} (${cleanAlias}) -> ${cloudAvatarUrl}`);
          }
        } catch (dbErr) {
          await client.query('ROLLBACK').catch(() => {});
          reportItem.apply_status = 'APPLY_FAILED';
          reportItem.apply_error = dbErr.message;
          applyFailedCount++;
          console.error(`❌ [Apply Failed] Lỗi cập nhật ID ${id}:`, dbErr.message);
        }
      }
    }

    // In chi tiết kết quả
    console.log('----------------------------------------------------------------------');
    console.log('📋 CHI TIẾT ĐỐI SOÁT TỪNG BẢN GHI:');
    console.log('----------------------------------------------------------------------');
    auditReport.forEach((item, idx) => {
      console.log(`[#${idx + 1}] ID: ${item.id} | ${item.name} (${item.alias_id}) | PersonID: ${item.person_id || 'N/A'}`);
      console.log(`    - SyncStatus:     ${item.sync_status}`);
      console.log(`    - URL hiện tại:   ${item.old_face_url}`);
      console.log(`    - Cloud đề xuất:  ${item.proposed_cloud_url || '(Không có ảnh CDN)'}`);
      console.log(`    - Kết quả:        [${item.status}] ${item.reason ? `(${item.reason})` : ''}`);
      if (item.apply_status) {
        console.log(`    - Thao tác Apply: [${item.apply_status}] ${item.apply_error ? `(${item.apply_error})` : ''}`);
      }
      console.log('');
    });

    console.log('======================================================================');
    console.log('📈 TỔNG KẾT ĐỐI SOÁT:');
    console.log(`  - Tổng bản ghi xử lý:         ${candidateRows.length}`);
    console.log(`  - Khớp ảnh CDN mới (MATCHED): ${matchedCount}`);
    console.log(`  - Đã chuẩn xác (NO_CHANGE):   ${noChangeCount}`);
    console.log(`  - Mâu thuẫn PersonID/Place:   ${identityConflictCount}`);
    console.log(`  - Mơ hồ (nhiều bản ghi trùng):${ambiguousCount}`);
    console.log(`  - Cloud chưa có avatar:       ${avatarMissingCount}`);
    console.log(`  - Avatar URL bị từ chối:      ${avatarRejectedCount}`);
    console.log(`  - Chưa xác minh (Lỗi API):    ${unverifiedCount}`);
    console.log(`  - Bỏ qua (thiếu alias):        ${skippedCount}`);
    if (isApply) {
      console.log(`  - Đã cập nhật vào Database:   ${appliedCount}`);
      console.log(`  - Cập nhật thất bại:          ${applyFailedCount}`);
    } else {
      console.log(`  - Đề xuất cập nhật (Dry-run): ${matchedCount} (Chưa ghi DB)`);
    }
    console.log('======================================================================\n');

    // Xuất file JSON nếu có tham số --output
    let fileWriteSuccess = true;
    if (outputPath) {
      try {
        const resolvedOut = path.resolve(outputPath);
        const reportData = {
          generated_at: new Date().toISOString(),
          mode: isApply ? 'APPLY' : 'DRY_RUN',
          summary: {
            total: candidateRows.length,
            matched: matchedCount,
            no_change: noChangeCount,
            identity_conflict: identityConflictCount,
            ambiguous: ambiguousCount,
            avatar_missing: avatarMissingCount,
            avatar_rejected: avatarRejectedCount,
            unverified: unverifiedCount,
            skipped: skippedCount,
            applied: appliedCount,
            apply_failed: applyFailedCount
          },
          items: auditReport
        };

        fs.writeFileSync(resolvedOut, JSON.stringify(reportData, null, 2), { mode: 0o600 });
        console.log(`💾 Đã xuất báo cáo đối soát ra tệp an toàn: ${resolvedOut} (Quyền: 0600)`);
      } catch (fileErr) {
        fileWriteSuccess = false;
        console.error(`❌ Không thể ghi file báo cáo ra ${outputPath}:`, fileErr.message);
      }
    }

    const isSuccess = fileWriteSuccess && (!isApply || applyFailedCount === 0);

    return {
      success: isSuccess,
      total: candidateRows.length,
      matched: matchedCount,
      no_change: noChangeCount,
      identity_conflict: identityConflictCount,
      ambiguous: ambiguousCount,
      avatar_missing: avatarMissingCount,
      avatar_rejected: avatarRejectedCount,
      unverified: unverifiedCount,
      skipped: skippedCount,
      applied: appliedCount,
      apply_failed: applyFailedCount,
      items: auditReport
    };
  } finally {
    client.release();
  }
}

if (require.main === module) {
  (async () => {
    try {
      const result = await runReconciliation();
      await pool.end();
      if (!result.success) {
        process.exitCode = 1;
      }
    } catch (err) {
      console.error('❌ Lỗi thực thi:', err.message);
      await pool.end().catch(() => {});
      process.exitCode = 1;
    }
  })();
}

module.exports = {
  selectCloudPerson,
  parseCliArgs,
  runReconciliation
};
