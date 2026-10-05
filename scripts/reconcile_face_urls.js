#!/usr/bin/env node

/**
 * Công cụ Đối soát & Phục hồi Cloud Face URL cho PostgreSQL (Postgres-First)
 * File: scripts/reconcile_face_urls.js
 * 
 * Mục tiêu:
 * - Quét các bản ghi trong bảng `persons` bị lưu nhầm URL tạm (/uploads/...) thay vì Cloud CDN URL chính thức.
 * - Đối soát với thông tin thực tế từ HANET AI Cloud qua API `getUserInfoByAliasID`.
 * - Hỗ trợ lọc theo danh sách ID cụ thể (ví dụ: 5 hồ sơ đợt đầu: 364, 368, 370, 383, 395).
 * - Mặc định chạy ở chế độ DRY-RUN (chỉ đọc, không làm thay đổi Database/Cloud).
 * - Khi truyền cờ `--apply`, chỉ cập nhật cột `face_url` của bản ghi khớp định danh, KHÔNG thay đổi sync_status, bảo toàn snapshot concurrency và ghi audit log.
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
const { isVerifiedHanetCdnUrl, isUploadsUrl } = require('../src/utils/urlHelper');

/**
 * Phân tích tham số dòng lệnh CLI
 */
function parseCliArgs() {
  const args = process.argv.slice(2);
  let ids = null;
  let isApply = false;
  let outputPath = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--ids' && args[i + 1]) {
      ids = args[i + 1]
        .split(',')
        .map(x => parseInt(x.trim(), 10))
        .filter(x => !isNaN(x) && x > 0);
      i++;
    } else if (arg.startsWith('--ids=')) {
      ids = arg.split('=')[1]
        .split(',')
        .map(x => parseInt(x.trim(), 10))
        .filter(x => !isNaN(x) && x > 0);
    } else if (arg === '--apply') {
      isApply = true;
    } else if (arg === '--dry-run') {
      isApply = false;
    } else if (arg === '--output' && args[i + 1]) {
      outputPath = args[i + 1].trim();
      i++;
    } else if (arg.startsWith('--output=')) {
      outputPath = arg.split('=')[1].trim();
    }
  }

  return {
    ids,
    isApply,
    isDryRun: !isApply,
    outputPath
  };
}

/**
 * Hàm thực thi đối soát và phục hồi Cloud Face URL
 */
async function runReconciliation(customOptions = null) {
  const options = customOptions || parseCliArgs();
  const { ids, isApply, isDryRun, outputPath } = options;

  console.log('======================================================================');
  console.log('🔍 CÔNG CỤ ĐỐI SOÁT CLOUD FACE URL — THANH_GIUSE_PC');
  console.log(`📌 Chế độ vận hành: ${isApply ? '⚠️ APPLY (Cập nhật Database có kiểm soát)' : '🛡️ DRY-RUN (Chỉ kiểm tra, không ghi DB)'}`);
  if (ids && ids.length > 0) {
    console.log(`🎯 Bộ lọc ID chỉ định: [${ids.join(', ')}]`);
  } else {
    console.log(`🎯 Phạm vi: Toàn bộ bảng persons có face_url cần đối soát`);
  }
  console.log('======================================================================\n');

  const client = await pool.connect();

  try {
    // 1. Truy vấn các bản ghi đích từ PostgreSQL
    let candidateRows = [];

    if (ids && ids.length > 0) {
      const query = `
        SELECT id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, updated_at
        FROM persons
        WHERE id = ANY($1::int[])
        ORDER BY id ASC
      `;
      const res = await client.query(query, [ids]);
      candidateRows = res.rows;
    } else {
      const query = `
        SELECT id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, updated_at
        FROM persons
        WHERE face_url IS NOT NULL AND TRIM(face_url) != ''
        ORDER BY id ASC
      `;
      const res = await client.query(query);
      candidateRows = res.rows.filter(r => isUploadsUrl(r.face_url) || !isVerifiedHanetCdnUrl(r.face_url));
    }

    console.log(`📊 Số bản ghi được nạp để đối soát: ${candidateRows.length}\n`);

    if (candidateRows.length === 0) {
      console.log('✅ Không tìm thấy bản ghi nào cần đối soát.');
      return { total: 0, matched: 0, conflict: 0, unverified: 0, applied: 0, items: [] };
    }

    let matchedCount = 0;
    let conflictCount = 0;
    let unverifiedCount = 0;
    let noAvatarCount = 0;
    let skippedCount = 0;
    let appliedCount = 0;

    const auditReport = [];

    for (const row of candidateRows) {
      const { id, alias_id, person_id, name, class_name, face_url, sync_status, updated_at } = row;
      const dbPersonId = person_id !== null && person_id !== undefined ? String(person_id).trim() : '';
      const cleanAlias = alias_id ? String(alias_id).trim() : '';

      let cloudAvatarUrl = null;
      let cloudPersonId = null;
      let statusResult = 'UNKNOWN';
      let reason = '';
      let apiSource = 'HANET /person/getUserInfoByAliasID';

      if (!cleanAlias) {
        statusResult = 'SKIPPED';
        reason = 'Bản ghi không có alias_id để đối soát với Cloud';
        skippedCount++;
      } else {
        try {
          const lookupRes = await hanetService.getPersonByAliasID(cleanAlias);
          const cloudData = lookupRes?.data?.data || lookupRes?.data;

          if (cloudData && typeof cloudData === 'object') {
            const rawCloudId = cloudData.personID || cloudData.id || cloudData.personId || null;
            cloudPersonId = rawCloudId !== null && rawCloudId !== undefined ? String(rawCloudId).trim() : '';

            // 1. Kiểm tra mâu thuẫn định danh PersonID giữa Cloud và DB (không ép kiểu sang Number)
            if (dbPersonId && cloudPersonId && dbPersonId !== cloudPersonId) {
              statusResult = 'CONFLICT';
              reason = `PersonID trên Cloud (${cloudPersonId}) không khớp với PersonID trong PostgreSQL (${dbPersonId})`;
              conflictCount++;
            } else {
              // 2. Trích xuất Cloud avatar URL
              const rawAvatar = cloudData.avatar || cloudData.faceUrl || cloudData.file || null;

              if (rawAvatar && isVerifiedHanetCdnUrl(rawAvatar)) {
                cloudAvatarUrl = rawAvatar;
                statusResult = 'MATCHED';
                matchedCount++;
              } else {
                statusResult = 'NO_CLOUD_AVATAR';
                reason = 'Hồ sơ tồn tại trên Cloud nhưng chưa có ảnh khuôn mặt CDN (avatar = null hoặc không thuộc CDN)';
                noAvatarCount++;
              }
            }
          } else {
            statusResult = 'UNVERIFIED';
            reason = 'Không tìm thấy hồ sơ hoặc dữ liệu trả về từ Cloud không đúng cấu trúc';
            unverifiedCount++;
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
        snapshot_updated_at: updated_at ? new Date(updated_at).toISOString() : null,
        reconciled_at: new Date().toISOString()
      };

      auditReport.push(reportItem);

      // ---------------------------------------------------------------------
      // ÁP DỤNG CÓ ĐIỀU KIỆN (CHẾ ĐỘ --apply)
      // ---------------------------------------------------------------------
      if (isApply && statusResult === 'MATCHED' && cloudAvatarUrl) {
        try {
          await client.query('BEGIN');

          // Cập nhật với kiểm tra snapshot optimistic locking
          const updateQuery = `
            UPDATE persons
            SET face_url = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
              AND alias_id = $3
              AND person_id IS NOT DISTINCT FROM $4
              AND face_url IS NOT DISTINCT FROM $5
              AND updated_at IS NOT DISTINCT FROM $6
            RETURNING id, alias_id, person_id, face_url, sync_status, updated_at;
          `;

          const updateRes = await client.query(updateQuery, [
            cloudAvatarUrl,
            id,
            cleanAlias,
            row.person_id,
            row.face_url,
            row.updated_at
          ]);

          if (updateRes.rowCount !== 1) {
            await client.query('ROLLBACK');
            reportItem.apply_status = 'SKIPPED_SNAPSHOT_CHANGED';
            reportItem.apply_error = 'Dữ liệu bản ghi đã bị thay đổi kể từ lúc dry-run. Đã bỏ qua an toàn.';
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
                    previous_updated_at: row.updated_at
                  })
                ]
              );
            } catch (auditErr) {
              // Bảng audit_logs có thể không bắt buộc hoặc lỗi ghi log -> Rollback toàn bộ để đảm bảo an toàn
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
    console.log(`  - Khớp ảnh CDN từ Cloud:      ${matchedCount}`);
    console.log(`  - Mâu thuẫn PersonID (Lỗi):   ${conflictCount}`);
    console.log(`  - Chưa xác minh (Lỗi API/Kq): ${unverifiedCount}`);
    console.log(`  - Không có ảnh trên Cloud:    ${noAvatarCount}`);
    console.log(`  - Bỏ qua (thiếu alias):        ${skippedCount}`);
    if (isApply) {
      console.log(`  - Đã cập nhật vào Database:   ${appliedCount}`);
    } else {
      console.log(`  - Đề xuất cập nhật (Dry-run): ${matchedCount} (Chưa ghi DB)`);
    }
    console.log('======================================================================\n');

    // Xuất file JSON nếu có tham số --output
    if (outputPath) {
      try {
        const resolvedOut = path.resolve(outputPath);
        const reportData = {
          generated_at: new Date().toISOString(),
          mode: isApply ? 'APPLY' : 'DRY_RUN',
          summary: {
            total: candidateRows.length,
            matched: matchedCount,
            conflict: conflictCount,
            unverified: unverifiedCount,
            no_cloud_avatar: noAvatarCount,
            skipped: skippedCount,
            applied: appliedCount
          },
          items: auditReport
        };

        fs.writeFileSync(resolvedOut, JSON.stringify(reportData, null, 2), { mode: 0o600 });
        console.log(`💾 Đã xuất báo cáo đối soát ra tệp an toàn: ${resolvedOut} (Quyền: 0600)`);
      } catch (fileErr) {
        console.error(`❌ Không thể ghi file báo cáo ra ${outputPath}:`, fileErr.message);
      }
    }

    return {
      total: candidateRows.length,
      matched: matchedCount,
      conflict: conflictCount,
      unverified: unverifiedCount,
      no_cloud_avatar: noAvatarCount,
      skipped: skippedCount,
      applied: appliedCount,
      items: auditReport
    };
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runReconciliation()
    .then(() => {
      pool.end().then(() => process.exit(0));
    })
    .catch(err => {
      console.error('Fatal Error:', err.message);
      pool.end().then(() => process.exit(1));
    });
}

module.exports = {
  parseCliArgs,
  runReconciliation
};
