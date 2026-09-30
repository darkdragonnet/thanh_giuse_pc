/**
 * Script Migrate Dữ liệu từ các file CSV vào Database PostgreSQL (Phase 2)
 * Thực thi: node scripts/migrate_csv_to_db.js
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { pool } = require('../src/config/database');

const DATA_DIR = path.join(process.cwd(), 'data');

// Danh sách phòng ban chuẩn
const DEPARTMENTS = {
  THIEU_NHI: '990653',
  LEGIO_MARIAE: '990730',
  GIOI_TRE: '990731'
};

/**
 * Xác định department_id theo tên lớp / tên file
 * @param {string} className 
 * @returns {string} department_id
 */
function resolveDepartmentId(className) {
  const norm = (className || '').toLowerCase().trim();

  // 1. Legiô Mariae
  if (norm.includes('legio') || norm.includes('mariae') || norm.includes('dmhccc') || norm.includes('lêgiô') || norm.startsWith('lm_') || norm.startsWith('lm')) {
    return DEPARTMENTS.LEGIO_MARIAE;
  }

  // 2. Giới Trẻ
  if (norm.includes('gioitre') || norm.includes('gioi_tre') || norm.includes('giới trẻ') || norm.startsWith('gt_') || norm === 'gt') {
    return DEPARTMENTS.GIOI_TRE;
  }

  // 3. Mặc định là Thiếu Nhi (BaoDong, ThemSuc, KhaiTam, GLV, XungToi, VaoDoi,...)
  return DEPARTMENTS.THIEU_NHI;
}

/**
 * Đọc toàn bộ dòng dữ liệu từ một file CSV
 * @param {string} filePath 
 * @returns {Promise<Array<Object>>}
 */
function readCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (raw) => {
        records.push(raw);
      })
      .on('end', () => resolve(records))
      .on('error', (err) => reject(err));
  });
}

/**
 * Hàm thực thi di chuyển dữ liệu CSV sang PostgreSQL
 */
async function migrateCsvToDb() {
  console.log('====================================================');
  console.log('🚀 [PHASE 2 MIGRATION] BẮT ĐẦU IMPORT DỮ LIỆU CSV VÀO POSTGRESQL');
  console.log('====================================================');

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ [Lỗi] Không tìm thấy thư mục dữ liệu tại: ${DATA_DIR}`);
    process.exit(1);
  }

  // Danh sách đen các file rác hoặc backup cần bỏ qua
  const blacklist = ['mariae.csv', 'nhi.csv', 'thiếu.csv', 'lêgiô.csv', 'thieu.csv', 'legio.csv'];

  const csvFiles = fs.readdirSync(DATA_DIR)
    .filter(file => {
      const lower = file.toLowerCase();
      if (!lower.endsWith('.csv')) return false;
      if (lower.includes('.bak')) return false;
      if (file.startsWith('.') || file.startsWith('._')) return false;
      if (blacklist.includes(lower)) return false;
      return true;
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  if (csvFiles.length === 0) {
    console.warn('⚠️ Không tìm thấy file CSV hợp lệ nào trong thư mục data/.');
    await pool.end();
    return;
  }

  console.log(`📁 Tìm thấy ${csvFiles.length} file danh mục lớp cần xử lý.`);
  console.log('----------------------------------------------------');

  let totalClasses = 0;
  let totalPersons = 0;
  let totalSynced = 0;
  let totalPending = 0;

  const client = await pool.connect();

  try {
    for (const file of csvFiles) {
      const filePath = path.join(DATA_DIR, file);
      const cleanClassName = file.replace(/\.csv$/i, '').trim();
      const departmentId = resolveDepartmentId(cleanClassName);

      // Đọc toàn bộ bản ghi trong file CSV
      const rows = await readCsvFile(filePath);

      // Bắt đầu Transaction cho từng file để đảm bảo toàn vẹn dữ liệu
      await client.query('BEGIN');

      // 1. Nạp lớp vào bảng classes (Idempotent)
      await client.query(
        `INSERT INTO classes (name, department_id)
         VALUES ($1, $2)
         ON CONFLICT (name) DO UPDATE 
         SET department_id = EXCLUDED.department_id`,
        [cleanClassName, departmentId]
      );
      totalClasses++;

      let fileSuccessCount = 0;

      // 2. Nạp từng thành viên vào bảng persons
      for (let idx = 0; idx < rows.length; idx++) {
        const raw = rows[idx];

        // Chuẩn hóa tên họ
        const name = (raw['Tên'] || raw['ho_ten'] || raw['name'] || raw['ten'] || '').trim();
        if (!name) continue; // Bỏ qua dòng trống tên

        // Chuẩn hóa chức vụ
        const title = (raw['Chức Vụ'] || raw['chuc_vu'] || raw['title'] || raw['vai_tro'] || 'Học Sinh').trim();

        // Chuẩn hóa Face URL & Person ID
        const faceUrl = (raw['links'] || raw['face_url'] || raw['anh_url'] || raw['avatar'] || '').trim() || null;
        const personId = (raw['PersonID'] || raw['person_id'] || raw['hanet_person_id'] || '').trim() || null;

        // Chuẩn hóa Alias ID
        let aliasId = (raw['alias_id'] || raw['aliasID'] || raw['AliasID'] || raw['alias'] || '').trim();
        if (!aliasId) {
          aliasId = `${cleanClassName}_${idx + 1}`;
        }

        // Trạng thái đồng bộ (Đã có ảnh/ID HANET => SYNCED, chưa có => PENDING)
        const syncStatus = (faceUrl || personId) ? 'SYNCED' : 'PENDING';
        if (syncStatus === 'SYNCED') totalSynced++;
        else totalPending++;

        // Upsert vào bảng persons theo đúng chuẩn ON CONFLICT (alias_id)
        await client.query(
          `INSERT INTO persons (alias_id, person_id, name, class_name, department_id, title, face_url, sync_status, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
           ON CONFLICT (alias_id) DO UPDATE SET
             person_id = COALESCE(EXCLUDED.person_id, persons.person_id),
             name = EXCLUDED.name,
             class_name = EXCLUDED.class_name,
             department_id = EXCLUDED.department_id,
             title = EXCLUDED.title,
             face_url = COALESCE(EXCLUDED.face_url, persons.face_url),
             sync_status = EXCLUDED.sync_status,
             updated_at = CURRENT_TIMESTAMP`,
          [aliasId, personId, name, cleanClassName, departmentId, title, faceUrl, syncStatus]
        );

        fileSuccessCount++;
        totalPersons++;
      }

      await client.query('COMMIT');

      console.log(`[MIGRATION] File ${file.padEnd(20)}: Import thành công ${fileSuccessCount}/${rows.length} nhân sự (Phòng ban: ${departmentId}).`);
    }

    console.log('----------------------------------------------------');
    console.log('✅ [HOÀN TẤT MIGRATION] TẤT CẢ DỮ LIỆU ĐÃ ĐƯỢC NẠP VÀO POSTGRESQL!');
    console.log(`   - Tổng số Lớp / Đoàn thể:     ${totalClasses} lớp`);
    console.log(`   - Tổng số Nhân sự / Học viên:    ${totalPersons} người`);
    console.log(`   - Đã có Face ID (SYNCED):        ${totalSynced} người`);
    console.log(`   - Chờ nhận diện (PENDING):       ${totalPending} người`);
    console.log('====================================================');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ [Lỗi Migration]', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Chạy script
migrateCsvToDb();
