const crypto = require('crypto');
const { pool } = require('../config/database');
const hanetService = require('./hanetService');

/**
 * Service Quản lý Chuyển Lớp & Saga Workflow (transferService)
 * Đảm bảo tính toàn vẹn dữ liệu giữa PostgreSQL 16 và HANET AI Cloud
 */

/**
 * Phân tích và lấy mã phòng ban mặc định theo tên lớp
 * @param {string} className 
 * @returns {string} departmentID
 */
function resolveDepartmentId(className) {
  if (!className) return '990653';
  const norm = className.toString().toLowerCase();
  if (norm.includes('dmhccc') || norm.includes('legio') || norm.includes('mariae') || norm.startsWith('lm')) {
    return '990730'; // Legiô Mariae
  }
  if (norm.includes('gioitre') || norm.includes('giới trẻ') || norm.startsWith('gt')) {
    return '990731'; // Giới Trẻ
  }
  if (norm.includes('giatruong') || norm.includes('gia trưởng') || norm.startsWith('gtr')) {
    return '990732'; // Gia Trưởng
  }
  if (norm.includes('hienmau') || norm.includes('hiền mẫu') || norm.startsWith('hm')) {
    return '990733'; // Hiền Mẫu
  }
  return '990653'; // Thiếu Nhi / GLV
}

/**
 * Sinh AliasID ngẫu nhiên theo RULE-004 không va chạm khóa unique
 * @param {string} targetClass Tên lớp đích
 * @returns {Promise<string>}
 */
async function generateTransferAlias(targetClass) {
  const deptId = resolveDepartmentId(targetClass);
  let deptPrefix = 'TN';
  if (deptId === '990730') deptPrefix = 'LM';
  else if (deptId === '990731') deptPrefix = 'GT';
  else if (deptId === '990732') deptPrefix = 'GTR';
  else if (deptId === '990733') deptPrefix = 'HM';

  const cleanClass = (targetClass || 'CHUNG')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

  let attempts = 0;
  while (attempts < 50) {
    attempts++;
    const suffix = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 ký tự HEX A-Z0-9
    const candidateAlias = `${deptPrefix}_${cleanClass}_${suffix}`;

    const checkRes = await pool.query('SELECT 1 FROM persons WHERE alias_id = $1 LIMIT 1', [candidateAlias]);
    if (checkRes.rows.length === 0) {
      return candidateAlias;
    }
  }

  // Fallback an toàn nếu sau 50 lần thử vẫn trùng
  return `${deptPrefix}_${cleanClass}_${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

/**
 * Xem trước danh sách chuyển lớp và phân loại nhóm xử lý
 * @param {string} fromClass Lớp hiện tại
 * @param {string} toClass Lớp chuyển đến
 * @param {Array<number|string>} [personIds] Danh sách ID người cần chuyển (nếu rỗng chuyển cả lớp)
 * @returns {Promise<Object>}
 */
async function previewTransfer(fromClass, toClass, personIds = []) {
  if (!fromClass || !toClass) {
    throw new Error('Thiếu thông tin lớp nguồn hoặc lớp đích');
  }

  let query = `
    SELECT id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status 
    FROM persons 
    WHERE class_name = $1
  `;
  const params = [fromClass];

  if (personIds && personIds.length > 0) {
    query += ' AND id = ANY($2::bigint[])';
    params.push(personIds);
  }

  query += ' ORDER BY id ASC';

  const res = await pool.query(query, params);
  const allMembers = res.rows;

  const databaseOnly = [];
  const hanetSync = [];

  for (const member of allMembers) {
    const hasCloudFace = !!(member.person_id && String(member.person_id).trim() !== '' && member.sync_status === 'SYNCED');

    if (hasCloudFace) {
      const generatedNewAlias = await generateTransferAlias(toClass);
      hanetSync.push({
        ...member,
        current_alias: member.alias_id,
        new_alias: generatedNewAlias,
        type: 'HANET_SYNC'
      });
    } else {
      databaseOnly.push({
        ...member,
        current_alias: member.alias_id,
        new_alias: member.alias_id, // Giữ nguyên alias nếu DB-only
        type: 'DATABASE_ONLY'
      });
    }
  }

  return {
    fromClass,
    toClass,
    total: allMembers.length,
    databaseOnlyCount: databaseOnly.length,
    hanetSyncCount: hanetSync.length,
    databaseOnly,
    hanetSync
  };
}

/**
 * Thực thi Saga Workflow chuyển lớp cho danh sách thành viên
 * @param {string} fromClass Lớp nguồn
 * @param {string} toClass Lớp đích
 * @param {Array<number|string>} personIds Danh sách ID học sinh chuyển
 * @param {Object} [actor] Thông tin người thực hiện { userId, username, role }
 * @returns {Promise<Object>}
 */
async function transferMembers(fromClass, toClass, personIds = [], actor = {}) {
  if (!fromClass || !toClass) {
    throw new Error('Thiếu thông tin lớp nguồn hoặc lớp đích');
  }

  const batchId = `batch_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const targetDeptId = resolveDepartmentId(toClass);

  // 1. Đảm bảo lớp đích tồn tại trong bảng classes
  await pool.query(
    `INSERT INTO classes (name, department_id) 
     VALUES ($1, $2) 
     ON CONFLICT (name) DO NOTHING`,
    [toClass, targetDeptId]
  );

  // 2. Lấy danh sách thành viên cần chuyển
  let query = `
    SELECT id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status 
    FROM persons 
    WHERE class_name = $1
  `;
  const params = [fromClass];

  if (personIds && personIds.length > 0) {
    query += ' AND id = ANY($2::bigint[])';
    params.push(personIds);
  }

  const res = await pool.query(query, params);
  const members = res.rows;

  if (members.length === 0) {
    return {
      batchId,
      total: 0,
      successCount: 0,
      failedCount: 0,
      message: 'Không tìm thấy thành viên phù hợp để chuyển lớp'
    };
  }

  let successCount = 0;
  let failedCount = 0;
  const results = [];

  for (const member of members) {
    const hasCloudFace = !!(member.person_id && String(member.person_id).trim() !== '' && member.sync_status === 'SYNCED');

    if (!hasCloudFace) {
      // Nhóm 1: DATABASE_ONLY (Chưa có Face ID) -> Cập nhật trực tiếp Postgres, không gọi HANET Cloud
      try {
        await pool.query(
          `UPDATE persons 
           SET class_name = $1, department_id = $2, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $3`,
          [toClass, targetDeptId, member.id]
        );

        // Ghi snapshot lưu vết
        await pool.query(
          `INSERT INTO transfer_snapshots 
           (batch_id, person_id_local, from_class, to_class, old_alias_id, new_alias_id, hanet_person_id, face_url, sync_status, error_message, created_at)
           VALUES ($1, $2, $3, $4, $5, $5, $6, $7, 'SYNCED', NULL, CURRENT_TIMESTAMP)`,
          [batchId, member.id, fromClass, toClass, member.alias_id, member.person_id || null, member.face_url || null]
        );

        successCount++;
        results.push({ id: member.id, name: member.name, status: 'SUCCESS', type: 'DATABASE_ONLY' });
      } catch (err) {
        failedCount++;
        results.push({ id: member.id, name: member.name, status: 'FAILED', type: 'DATABASE_ONLY', error: err.message });
      }
    } else {
      // Nhóm 2: HANET_SYNC (Đã có Face ID trên Cloud) -> Saga Workflow
      const newAlias = await generateTransferAlias(toClass);
      let snapshotId = null;

      try {
        // Bước 1: Ghi Snapshot với trạng thái PROCESSING
        const snapRes = await pool.query(
          `INSERT INTO transfer_snapshots 
           (batch_id, person_id_local, from_class, to_class, old_alias_id, new_alias_id, hanet_person_id, face_url, sync_status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PROCESSING', CURRENT_TIMESTAMP)
           RETURNING id`,
          [batchId, member.id, fromClass, toClass, member.alias_id, newAlias, member.person_id, member.face_url]
        );
        snapshotId = snapRes.rows[0].id;

        // Bước 2: Gọi HANET Cloud API cập nhật AliasID và DepartmentID
        const cloudRes = await hanetService.updateInfo({
          aliasID: member.alias_id,
          name: member.name,
          title: member.title || 'Học sinh',
          departmentID: targetDeptId
        });

        if (cloudRes && (cloudRes.returnCode === 1 || cloudRes.returnCode === '1')) {
          // Bước 3: Cloud thành công -> Cập nhật PostgreSQL
          await pool.query(
            `UPDATE persons 
             SET class_name = $1, department_id = $2, alias_id = $3, sync_status = 'SYNCED', updated_at = CURRENT_TIMESTAMP 
             WHERE id = $4`,
            [toClass, targetDeptId, newAlias, member.id]
          );

          // Bước 4: Chốt Snapshot SYNCED
          await pool.query(
            `UPDATE transfer_snapshots SET sync_status = 'SYNCED' WHERE id = $1`,
            [snapshotId]
          );

          successCount++;
          results.push({ id: member.id, name: member.name, status: 'SUCCESS', type: 'HANET_SYNC', newAlias });
        } else {
          // Cloud báo lỗi -> Cập nhật snapshot FAILED, Database giữ nguyên lớp cũ
          const errorMsg = cloudRes?.returnMessage || `HANET API Error Code: ${cloudRes?.returnCode}`;
          await pool.query(
            `UPDATE transfer_snapshots SET sync_status = 'FAILED', error_message = $1 WHERE id = $2`,
            [errorMsg, snapshotId]
          );

          failedCount++;
          results.push({ id: member.id, name: member.name, status: 'FAILED', type: 'HANET_SYNC', error: errorMsg });
        }
      } catch (err) {
        // Exception kết nối / timeout -> Đánh dấu FAILED, Database an toàn
        if (snapshotId) {
          await pool.query(
            `UPDATE transfer_snapshots SET sync_status = 'FAILED', error_message = $1 WHERE id = $2`,
            [err.message, snapshotId]
          ).catch(() => {});
        }

        failedCount++;
        results.push({ id: member.id, name: member.name, status: 'FAILED', type: 'HANET_SYNC', error: err.message });
      }
    }
  }

  return {
    batchId,
    fromClass,
    toClass,
    total: members.length,
    successCount,
    failedCount,
    results
  };
}

/**
 * Hoàn tác đợt chuyển lớp (Restore Transfer) an toàn
 * @param {string} batchId Mã đợt chuyển lớp cần hoàn tác
 * @returns {Promise<Object>}
 */
async function restoreTransfer(batchId) {
  if (!batchId) {
    throw new Error('Thiếu mã đợt chuyển lớp (batchId)');
  }

  // 1. Kiểm tra snapshot đợt chuyển
  const snapRes = await pool.query(
    `SELECT * FROM transfer_snapshots WHERE batch_id = $1 ORDER BY id ASC`,
    [batchId]
  );

  if (snapRes.rows.length === 0) {
    throw new Error(`Không tìm thấy dữ liệu chuyển lớp với BatchID: ${batchId}`);
  }

  const snapshots = snapRes.rows;
  const alreadyRestoredCount = snapshots.filter(s => s.restored_at !== null).length;
  if (alreadyRestoredCount === snapshots.length) {
    const error = new Error('RESTORE_NOT_ALLOWED: Giao dịch này đã được hoàn tác trước đó.');
    error.code = 'RESTORE_NOT_ALLOWED';
    throw error;
  }

  let restoredCount = 0;
  let skippedCount = 0;
  const details = [];

  for (const snap of snapshots) {
    // 2. Kiểm tra không hoàn tác 2 lần
    if (snap.restored_at) {
      skippedCount++;
      details.push({ id: snap.person_id_local, status: 'SKIPPED', reason: 'Đã hoàn tác trước đó' });
      continue;
    }

    if (snap.sync_status !== 'SYNCED') {
      skippedCount++;
      details.push({ id: snap.person_id_local, status: 'SKIPPED', reason: 'Chưa từng chuyển thành công' });
      continue;
    }

    // 3. Kiểm tra người đó chưa bị chuyển tiếp sang lớp thứ 3
    const personRes = await pool.query(
      `SELECT id, name, class_name, alias_id, person_id, title FROM persons WHERE id = $1`,
      [snap.person_id_local]
    );

    if (personRes.rows.length === 0) {
      skippedCount++;
      details.push({ id: snap.person_id_local, status: 'SKIPPED', reason: 'Không tìm thấy nhân sự trong DB' });
      continue;
    }

    const currentPerson = personRes.rows[0];
    if (currentPerson.class_name !== snap.to_class) {
      skippedCount++;
      details.push({
        id: snap.person_id_local,
        name: currentPerson.name,
        status: 'SKIPPED',
        reason: `Học sinh đã bị chuyển tiếp sang lớp khác (${currentPerson.class_name}), không thể hoàn tác về ${snap.from_class}`
      });
      continue;
    }

    // 4. Nếu có Face ID trên Cloud -> Khôi phục old_alias_id trên Cloud
    const fromDeptId = resolveDepartmentId(snap.from_class);
    if (snap.hanet_person_id && snap.old_alias_id) {
      try {
        await hanetService.updateInfo({
          aliasID: snap.old_alias_id,
          name: currentPerson.name,
          title: currentPerson.title || 'Học sinh',
          departmentID: fromDeptId
        });
      } catch (cloudErr) {
        console.warn(`[RestoreTransfer] Cảnh báo khôi phục Cloud cho ${currentPerson.name}:`, cloudErr.message);
      }
    }

    // 5. Cập nhật lại Database PostgreSQL về lớp cũ
    await pool.query(
      `UPDATE persons 
       SET class_name = $1, alias_id = COALESCE($2, alias_id), department_id = $3, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $4`,
      [snap.from_class, snap.old_alias_id, fromDeptId, snap.person_id_local]
    );

    // 6. Đánh dấu đã hoàn tác trong snapshot
    await pool.query(
      `UPDATE transfer_snapshots SET restored_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [snap.id]
    );

    restoredCount++;
    details.push({ id: snap.person_id_local, name: currentPerson.name, status: 'RESTORED', from: snap.to_class, backTo: snap.from_class });
  }

  return {
    batchId,
    total: snapshots.length,
    restoredCount,
    skippedCount,
    details
  };
}

module.exports = {
  generateTransferAlias,
  previewTransfer,
  transferMembers,
  restoreTransfer,
  resolveDepartmentId
};
