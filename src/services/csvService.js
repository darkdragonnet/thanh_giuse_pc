/**
 * @deprecated
 * [DEPRECATED - PHASE 3] Module này đã ngừng sử dụng trong luồng vận hành chính.
 * Toàn bộ dữ liệu lớp học và nhân sự đã được chuyển sang cơ sở dữ liệu PostgreSQL.
 * File này chỉ được giữ lại cho mục đích backup / migration lịch sử.
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const DATA_DIR = path.join(process.cwd(), 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function normalizeName(name) {
  if (!name) return '';
  return name.toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Lấy đường dẫn file CSV an toàn trong thư mục data
 * @param {string} fileName Tên file danh mục (vd: ThemSuc_1a, GLV)
 * @returns {string}
 */
function getFilePath(fileName) {
  const safeName = path.basename(fileName).replace(/\.csv$/i, '');
  return path.join(DATA_DIR, `${safeName}.csv`);
}

/**
 * Đọc file CSV và chuẩn hóa key về dạng chuẩn nội bộ:
 * ho_ten, lop, phong_ban, chuc_vu, anh_url, hanet_person_id
 * @param {string} fileName 
 * @returns {Promise<Array<Object>>}
 */
function readList(fileName) {
  const filePath = getFilePath(fileName);
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return resolve([]);
    }
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (raw) => {
        // Chuẩn hóa key từ file CSV thực tế: 'Tên', 'Lớp', 'Phòng Ban', 'Chức Vụ', 'links', 'PersonID'
        results.push({
          ho_ten: (raw['Tên'] || raw['ho_ten'] || '').trim(),
          lop: (raw['Lớp'] || raw['lop'] || '').trim(),
          phong_ban: (raw['Phòng Ban'] || raw['phong_ban'] || 'Thiếu Nhi').trim(),
          chuc_vu: (raw['Chức Vụ'] || raw['chuc_vu'] || 'Học Sinh').trim(),
          anh_url: (raw['links'] || raw['anh_url'] || '').trim(),
          hanet_person_id: (raw['PersonID'] || raw['hanet_person_id'] || '').trim(),
        });
      })
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

/**
 * Ghi thêm thành viên mới theo đúng header gốc của CSV
 * @param {string} fileName
 * @param {Object} person
 */
async function appendPerson(fileName, person) {
  const filePath = getFilePath(fileName);
  const fileExists = fs.existsSync(filePath);

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'ho_ten', title: 'Tên' },
      { id: 'lop', title: 'Lớp' },
      { id: 'phong_ban', title: 'Phòng Ban' },
      { id: 'chuc_vu', title: 'Chức Vụ' },
      { id: 'anh_url', title: 'links' },
      { id: 'hanet_person_id', title: 'PersonID' },
    ],
    append: fileExists,
  });

  await csvWriter.writeRecords([{
    ho_ten: person.ho_ten || '',
    lop: person.lop || '',
    phong_ban: person.phong_ban || 'Thiếu Nhi',
    chuc_vu: person.chuc_vu || 'Học Sinh',
    anh_url: person.anh_url || '',
    hanet_person_id: person.hanet_person_id || '',
  }]);
}

/**
 * Tự động ghi ngược thông tin đăng ký vào file CSV
 * @param {string} className Tên lớp/nhóm (VD: ThemSuc_1a, GLV, DMHCCC)
 * @param {string} personName Họ và tên người đăng ký
 * @param {string} avatarUrl Link ảnh từ HANET Cloud (https://static.hanet.ai/...)
 * @param {string|number} personId ID cấp bởi HANET Cloud
 * @param {string} inputTitle Chức vụ do người dùng nhập (nếu có)
 */
async function writeBackRegistration(className, personName, avatarUrl, personId, inputTitle = '') {
  if (!className || !personName || !personId) {
    console.warn('[CSV Service] Thiếu thông tin bắt buộc để ghi CSV:', { className, personName, personId });
    return false;
  }

  const cleanClassName = className.replace(/\.csv$/i, '');
  const filePath = path.join(DATA_DIR, `${cleanClassName}.csv`);

  if (!fs.existsSync(filePath)) {
    console.warn(`[CSV Service] Không tìm thấy file: ${filePath}`);
    return false;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    const validLines = lines.filter(l => l.trim().length > 0);

    const targetNormName = normalizeName(personName);
    let matchedIndex = -1;

    // 1. Tìm xem tên đã có sẵn trong file CSV chưa
    for (let i = 0; i < validLines.length; i++) {
      if (i === 0 && validLines[i].toLowerCase().startsWith('tên,')) continue;
      const parts = validLines[i].split(',');
      const rowName = normalizeName(parts[0]);
      if (rowName === targetNormName) {
        matchedIndex = i;
        break;
      }
    }

    if (matchedIndex !== -1) {
      // TRƯỜNG HỢP 1: Tên đã có -> Cập nhật đúng dòng đó (Cột 3 là Chức vụ, Cột 4 là links, Cột 5 là PersonID)
      const parts = validLines[matchedIndex].split(',');
      if (inputTitle && inputTitle.trim()) {
        parts[3] = inputTitle.trim();
      }
      parts[4] = avatarUrl ? `"${avatarUrl}"` : '""';
      parts[5] = String(personId);
      validLines[matchedIndex] = parts.join(',');

      console.log(`✅ [CSV Write-Back] Đã cập nhật dòng ${matchedIndex + 1} cho: ${personName} (${parts[3]}) trong ${cleanClassName}.csv`);
    } else {
      // TRƯỜNG HỢP 2: Tên mới -> Kế thừa phòng ban & chức vụ từ người cuối cùng, thêm vào dòng Max + 1
      let inheritDept = 'Thiếu Nhi';
      let inheritTitle = inputTitle || 'Học Sinh';

      if (validLines.length > 0) {
        const lastLineParts = validLines[validLines.length - 1].split(',');
        if (lastLineParts.length >= 4) {
          inheritDept = lastLineParts[2]?.trim() || inheritDept;
          inheritTitle = inputTitle || lastLineParts[3]?.trim() || inheritTitle;
        }
      }

      const newLine = `${personName.trim()},${cleanClassName},${inheritDept},${inheritTitle},"${avatarUrl || ''}",${String(personId)}`;
      validLines.push(newLine);

      console.log(`🆕 [CSV Write-Back] Tên mới! Đã thêm vào dòng ${validLines.length} (Max + 1): ${personName} (${inheritTitle}) trong ${cleanClassName}.csv`);
    }

    // Ghi đè lại file CSV an toàn với ký tự xuống dòng chuẩn
    fs.writeFileSync(filePath, validLines.join('\n') + '\n', 'utf-8');
    return true;
  } catch (error) {
    console.error(`❌ [CSV Write-Back Error] Lỗi ghi file ${cleanClassName}.csv:`, error.message);
    return false;
  }
}

/**
 * Xóa/Reset Face ID (avatar và PersonID) của một nhân sự khỏi các file CSV khi bị xóa trên Cloud
 * @param {string} personId - ID nhân sự cần xóa
 * @param {string} personName - Họ và tên nhân sự (tùy chọn)
 * @returns {Array<string>} Danh sách các file CSV đã được cập nhật
 */
function removePersonFromCsv(personId, personName = '') {
  if (!personId && !personName) return [];
  const updatedFiles = [];
  if (!fs.existsSync(DATA_DIR)) return updatedFiles;

  const targetId = String(personId || '').trim();
  const targetNormName = normalizeName(personName);

  const files = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.csv') && !f.includes('.bak'));

  for (const file of files) {
    const filePath = path.join(DATA_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      let fileModified = false;

      const newLines = lines.map((line, idx) => {
        if (idx === 0 && line.toLowerCase().startsWith('tên,')) return line;
        const parts = line.split(',');
        if (parts.length < 4) return line;

        const rowName = normalizeName(parts[0]);
        const rowId = (parts[5] || '').trim();

        // Khớp PersonID hoặc khớp Tên khi ID khớp
        if ((targetId && rowId === targetId) || (targetNormName && rowName === targetNormName && (!rowId || rowId === targetId))) {
          parts[4] = '""';
          parts[5] = '""';
          fileModified = true;
          return parts.join(',');
        }
        return line;
      });

      if (fileModified) {
        fs.writeFileSync(filePath, newLines.join('\n') + '\n', 'utf-8');
        updatedFiles.push(file);
        console.log(`🧹 [CSV Service] Đã xóa Face ID & PersonID trong file ${file} cho ID: ${personId}`);
      }
    } catch (err) {
      console.warn(`[CSV Service] Lỗi khi reset person trong file ${file}:`, err.message);
    }
  }

  return updatedFiles;
}

module.exports = {
  getFilePath,
  readList,
  appendPerson,
  writeBackRegistration,
  normalizeName,
  removePersonFromCsv
};
