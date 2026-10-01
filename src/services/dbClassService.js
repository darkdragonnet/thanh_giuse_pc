const crypto = require('crypto');
const { pool } = require('../config/database');

/**
 * Service quản lý Lớp Học và Nhân Sự trực tiếp trên PostgreSQL 16
 */

/**
 * Lấy danh sách thành viên của một lớp từ database
 * @param {string} className Tên lớp cần truy vấn
 * @returns {Promise<Array<Object>>}
 */
async function getClassMembers(className) {
  if (!className) return [];
  const cleanName = className.trim();
  const normalizedClass = cleanName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

  const query = `
    SELECT id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, created_at, updated_at 
    FROM persons 
    WHERE LOWER(class_name) = LOWER($1) 
       OR UPPER(REPLACE(class_name, '_', '')) = $2
    ORDER BY id ASC
  `;
  const res = await pool.query(query, [cleanName, normalizedClass]);

  return res.rows.map(row => ({
    ...row,
    // Alias tương thích các view và frontend bindings
    'Tên': row.name,
    'Chức Vụ': row.title,
    'Lớp': row.class_name,
    'Phòng Ban': row.department_id === '990730' ? 'Legiô Mariae' : (row.department_id === '990731' ? 'Giới Trẻ' : 'Thiếu Nhi'),
    'links': row.face_url || '',
    'PersonID': row.person_id || '',
    'AliasID': row.alias_id || '',
    avatar: row.face_url || '',
    alias: row.alias_id || '',
    class: row.class_name,
    department: row.department_id
  }));
}

/**
 * Thêm một thành viên mới vào lớp và database PostgreSQL
 * @param {Object} memberData { name, className, departmentId, title, aliasId }
 * @returns {Promise<Object>}
 */
async function addMember({ name, className, departmentId, title, aliasId }) {
  if (!name || !name.trim()) {
    throw new Error('Tên thành viên không được để trống');
  }

  // 1. Phân loại và chuẩn hóa departmentId
  let resolvedDeptId = '990653';
  if (departmentId && (departmentId === '990653' || departmentId === '990730' || departmentId === '990731')) {
    resolvedDeptId = departmentId;
  } else if (departmentId && typeof departmentId === 'string') {
    const normDept = departmentId.toLowerCase();
    if (normDept.includes('maria') || normDept.includes('legio') || normDept.includes('lm')) resolvedDeptId = '990730';
    else if (normDept.includes('trẻ') || normDept.includes('gt')) resolvedDeptId = '990731';
  } else if (className) {
    const normClass = className.toLowerCase();
    if (normClass.includes('dmhccc') || normClass.includes('legio') || normClass.includes('mariae')) resolvedDeptId = '990730';
    else if (normClass.includes('gioitre') || normClass.includes('giới trẻ') || normClass.startsWith('gt')) resolvedDeptId = '990731';
  }

  // 2. Đảm bảo lớp học tồn tại trong bảng classes (FK constraint)
  if (className) {
    await pool.query(
      `INSERT INTO classes (name, department_id) 
       VALUES ($1, $2) 
       ON CONFLICT (name) DO NOTHING`,
      [className, resolvedDeptId]
    );
  }

  // 3. Tự động sinh AliasID chuẩn 3 phần nếu chưa có
  let finalAliasId = aliasId;
  if (!finalAliasId || !finalAliasId.trim()) {
    let deptPrefix = 'TN';
    if (resolvedDeptId === '990730') deptPrefix = 'LM';
    else if (resolvedDeptId === '990731') deptPrefix = 'GT';

    const cleanClass = (className || 'CHUNG')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toUpperCase();

    const randomSuffix = crypto.randomBytes(2).toString('hex').toUpperCase(); // 4 ký tự A-Z0-9
    finalAliasId = `${deptPrefix}_${cleanClass}_${randomSuffix}`;
  }

  const insertQuery = `
    INSERT INTO persons (name, class_name, department_id, title, alias_id, sync_status) 
    VALUES ($1, $2, $3, $4, $5, 'PENDING') 
    RETURNING id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, created_at, updated_at
  `;

  const res = await pool.query(insertQuery, [
    name.trim(),
    className || null,
    resolvedDeptId,
    title || 'Học Sinh',
    finalAliasId.trim()
  ]);

  const row = res.rows[0];
  return {
    ...row,
    'Tên': row.name,
    'Chức Vụ': row.title,
    'Lớp': row.class_name,
    'Phòng Ban': row.department_id,
    'AliasID': row.alias_id,
    'PersonID': row.person_id || '',
    'links': row.face_url || ''
  };
}

/**
 * Cập nhật thông tin thành viên theo alias_id
 * @param {string} aliasId AliasID định danh
 * @param {Object} updateData { name, title, className, departmentId }
 * @returns {Promise<Object>}
 */
async function updateMember(aliasId, { name, title, className, departmentId }) {
  if (!aliasId || !aliasId.trim()) {
    throw new Error('AliasID không hợp lệ');
  }

  let resolvedDeptId = departmentId;
  if (departmentId && isNaN(departmentId) && typeof departmentId === 'string') {
    const norm = departmentId.toLowerCase();
    if (norm.includes('maria') || norm.includes('legio')) resolvedDeptId = '990730';
    else if (norm.includes('trẻ') || norm.includes('gt')) resolvedDeptId = '990731';
    else resolvedDeptId = '990653';
  }

  // Đảm bảo lớp học tồn tại nếu có đổi tên lớp
  if (className) {
    await pool.query(
      `INSERT INTO classes (name, department_id) 
       VALUES ($1, $2) 
       ON CONFLICT (name) DO NOTHING`,
      [className, resolvedDeptId || '990653']
    );
  }

  const query = `
    UPDATE persons 
    SET name = COALESCE($1, name),
        title = COALESCE($2, title),
        class_name = COALESCE($3, class_name),
        department_id = COALESCE($4, department_id),
        updated_at = CURRENT_TIMESTAMP 
    WHERE alias_id = $5 
    RETURNING id, alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, updated_at
  `;

  const res = await pool.query(query, [
    name ? name.trim() : null,
    title ? title.trim() : null,
    className ? className.trim() : null,
    resolvedDeptId || null,
    aliasId.trim()
  ]);

  if (res.rows.length === 0) {
    throw new Error(`Không tìm thấy thành viên với AliasID: ${aliasId}`);
  }

  return res.rows[0];
}

/**
 * Xóa một thành viên khỏi database theo alias_id
 * @param {string} aliasId AliasID định danh
 * @returns {Promise<Object>}
 */
async function deleteMember(aliasId) {
  if (!aliasId || !aliasId.trim()) {
    throw new Error('AliasID không hợp lệ để xóa');
  }

  const query = 'DELETE FROM persons WHERE alias_id = $1 RETURNING *';
  const res = await pool.query(query, [aliasId.trim()]);

  if (res.rows.length === 0) {
    throw new Error(`Không tìm thấy thành viên với AliasID: ${aliasId}`);
  }

  return res.rows[0];
}

/**
 * Đổi tên Lớp học và toàn bộ học viên thuộc lớp đó (sử dụng Transaction ACID)
 * @param {string} oldName Tên lớp hiện tại
 * @param {string} newName Tên lớp mới
 * @returns {Promise<{ success: boolean, updatedCount: number }>}
 */
async function renameClass(oldName, newName) {
  if (!oldName || !newName || !oldName.trim() || !newName.trim()) {
    throw new Error('Tên lớp cũ và tên lớp mới không được để trống');
  }

  const cleanOld = oldName.trim();
  const cleanNew = newName.trim();

  if (cleanOld === cleanNew) {
    return { success: true, updatedCount: 0 };
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lấy thông tin phòng ban của lớp cũ
    const classRes = await client.query('SELECT department_id FROM classes WHERE name = $1 LIMIT 1', [cleanOld]);
    const deptId = classRes.rows.length > 0 ? classRes.rows[0].department_id : '990653';

    // 2. Tạo lớp mới hoặc cập nhật phòng ban lớp mới trong bảng classes
    await client.query(
      `INSERT INTO classes (name, department_id) 
       VALUES ($1, $2) 
       ON CONFLICT (name) DO UPDATE SET department_id = EXCLUDED.department_id`,
      [cleanNew, deptId]
    );

    // 3. Cập nhật tất cả nhân sự thuộc lớp cũ sang lớp mới
    const updatePersonsRes = await client.query(
      'UPDATE persons SET class_name = $1, updated_at = CURRENT_TIMESTAMP WHERE class_name = $2 RETURNING id',
      [cleanNew, cleanOld]
    );

    // 4. Xóa lớp cũ khỏi bảng classes
    await client.query('DELETE FROM classes WHERE name = $1', [cleanOld]);

    await client.query('COMMIT');
    console.log(`🔄 [PostgreSQL dbClassService] Đã đổi tên lớp từ "${cleanOld}" sang "${cleanNew}" (${updatePersonsRes.rowCount} thành viên)`);
    return { success: true, updatedCount: updatePersonsRes.rowCount };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ [PostgreSQL dbClassService Error] Lỗi đổi tên lớp:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getClassMembers,
  addMember,
  updateMember,
  deleteMember,
  renameClass
};
