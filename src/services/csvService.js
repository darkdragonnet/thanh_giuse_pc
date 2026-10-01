/**
 * @deprecated
 * [DEPRECATED - POSTGRES-FIRST ARCHITECTURE]
 * Module này đã ngưng sử dụng trong toàn bộ luồng vận hành chính.
 * Toàn bộ dữ liệu phòng ban, lớp học và nhân sự đã được chuyển đổi 100% sang PostgreSQL 16 (dbClassService / database pool).
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
 * Lấy đường dẫn file CSV an toàn trong thư mục data (hỗ trợ case-insensitive fallback)
 * @param {string} fileName Tên file danh mục (vd: ThemSuc_1a, GLV, THEMSUC1A)
 * @returns {string}
 */
function getFilePath(fileName) {
  if (!fileName) return path.join(DATA_DIR, 'unknown.csv');
  const safeName = path.basename(fileName).replace(/\.csv$/i, '').trim();
  const directPath = path.join(DATA_DIR, `${safeName}.csv`);
  if (fs.existsSync(directPath)) return directPath;

  // Case-insensitive & normalized fallback
  if (fs.existsSync(DATA_DIR)) {
    const files = fs.readdirSync(DATA_DIR);
    const target = safeName.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const f of files) {
      if (f.toLowerCase().endsWith('.csv') && !f.includes('.bak')) {
        const cleanF = f.replace(/\.csv$/i, '').toLowerCase().replace(/[^a-z0-9]/g, '');
        if (cleanF === target || f.toLowerCase() === `${safeName.toLowerCase()}.csv`) {
          return path.join(DATA_DIR, f);
        }
      }
    }
  }
  return directPath;
}

/**
 * Đọc file CSV và trả về danh sách thành viên với các trường đồng bộ
 * @param {string} fileName Tên lớp / tên file
 * @returns {Promise<Array<Object>>}
 */
function readList(fileName) {
  const filePath = getFilePath(fileName);
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(filePath)) {
      return resolve([]);
    }
    const results = [];
    fs.createReadStream(filePath, { encoding: 'utf-8' })
      .pipe(csv())
      .on('data', (raw) => {
        const name = (raw['Tên'] || raw['ho_ten'] || raw['name'] || '').trim();
        const lop = (raw['Lớp'] || raw['lop'] || raw['class'] || fileName).trim();
        const phongBan = (raw['Phòng Ban'] || raw['phong_ban'] || raw['department'] || 'Thiếu Nhi').trim();
        const chucVu = (raw['Chức Vụ'] || raw['chuc_vu'] || raw['title'] || 'Học Sinh').trim();
        const links = (raw['links'] || raw['anh_url'] || raw['avatar'] || '').trim();
        const personId = (raw['PersonID'] || raw['hanet_person_id'] || raw['person_id'] || '').trim();
        const aliasId = (raw['AliasID'] || raw['alias_id'] || raw['alias'] || '').trim();

        if (name) {
          results.push({
            'Tên': name,
            'Lớp': lop,
            'Phòng Ban': phongBan,
            'Chức Vụ': chucVu,
            'links': links,
            'PersonID': personId,
            'AliasID': aliasId,
            // Hỗ trợ alias tương thích đa controller
            ho_ten: name,
            lop: lop,
            phong_ban: phongBan,
            chuc_vu: chucVu,
            anh_url: links,
            hanet_person_id: personId,
            name: name,
            class: lop,
            department: phongBan,
            title: chucVu,
            avatar: links,
            alias: aliasId
          });
        }
      })
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
}

/**
 * Ghi thêm thành viên mới vào file CSV (RULE-001 & RULE-002)
 * @param {string} fileName Tên lớp / tên file
 * @param {Object} person Dữ liệu thành viên mới
 */
async function appendPerson(fileName, person) {
  const filePath = getFilePath(fileName);
  const fileExists = fs.existsSync(filePath);

  const name = (person['Tên'] || person.name || person.ho_ten || '').trim();
  const lop = (person['Lớp'] || person.class || person.lop || fileName).trim();
  const phongBan = (person['Phòng Ban'] || person.department || person.phong_ban || 'Thiếu Nhi').trim();
  const chucVu = (person['Chức Vụ'] || person.title || person.chuc_vu || 'Học Sinh').trim();
  const links = (person['links'] || person.avatar || person.anh_url || '').trim();
  const personId = (person['PersonID'] || person.person_id || person.hanet_person_id || '').trim();
  const aliasId = (person['AliasID'] || person.alias || person.alias_id || '').trim();

  if (!fileExists) {
    const header = 'Tên,Lớp,Phòng Ban,Chức Vụ,links,PersonID,AliasID\n';
    const row = `"${name}","${lop}","${phongBan}","${chucVu}","${links}","${personId}","${aliasId}"\n`;
    fs.writeFileSync(filePath, header + row, 'utf-8');
  } else {
    // Đọc header hiện có để quyết định ghi có cột AliasID hay không
    const content = fs.readFileSync(filePath, 'utf-8');
    const firstLine = content.split(/\r?\n/)[0] || '';
    const hasAliasColumn = firstLine.toLowerCase().includes('alias');

    let row = '';
    if (hasAliasColumn) {
      row = `"${name}","${lop}","${phongBan}","${chucVu}","${links}","${personId}","${aliasId}"\n`;
    } else {
      row = `"${name}","${lop}","${phongBan}","${chucVu}","${links}","${personId}"\n`;
    }

    fs.appendFileSync(filePath, row, 'utf-8');
  }
}

/**
 * Cập nhật thông tin thành viên trong file CSV theo AliasID hoặc Tên
 * @param {string} className Tên lớp
 * @param {string} alias AliasID hoặc Tên hiện tại
 * @param {Object} updateData { name, title, department, class }
 */
async function updatePersonInfo(className, alias, updateData) {
  const filePath = getFilePath(className);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Không tìm thấy file dữ liệu cho lớp ${className}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) return true;

  const header = lines[0];
  const targetAlias = (alias || '').trim().toUpperCase();
  const targetNormName = normalizeName(updateData.name || alias);
  let updated = false;

  const newLines = lines.map((line, idx) => {
    if (idx === 0) return line; // Giữ nguyên header
    
    // Phân tích dòng CSV đơn giản hoặc chuẩn CSV
    const regex = /(?:^|,)(?:"([^"]*)"|([^",]*))/g;
    const parts = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      parts.push(match[1] !== undefined ? match[1] : match[2]);
    }

    if (parts.length < 4) return line;

    const rowName = parts[0]?.trim();
    const rowAlias = (parts[6] || '').trim().toUpperCase();
    const isAliasMatch = targetAlias && rowAlias && rowAlias === targetAlias;
    const isNameMatch = targetNormName && normalizeName(rowName) === targetNormName;

    if (isAliasMatch || isNameMatch) {
      parts[0] = updateData.name ? updateData.name.trim() : parts[0];
      parts[1] = updateData.class ? updateData.class.trim() : parts[1];
      parts[2] = updateData.department ? updateData.department.trim() : parts[2];
      parts[3] = updateData.title ? updateData.title.trim() : parts[3];
      updated = true;
      return parts.map(p => (p && (p.includes(',') || p.includes('"')) ? `"${p.replace(/"/g, '""')}"` : (p || ''))).join(',');
    }

    return line;
  });

  if (updated) {
    fs.writeFileSync(filePath, newLines.join('\n') + '\n', 'utf-8');
    console.log(`✅ [CSV Service] Đã cập nhật thành viên trong ${path.basename(filePath)}`);
  }

  return updated;
}

/**
 * Xóa một thành viên khỏi file CSV của lớp (hoặc reset FaceID nếu xóa toàn cục)
 * @param {string} identifier AliasID, PersonID hoặc Tên thành viên
 * @param {string} [className] Tên lớp (nếu xóa từ giao diện quản lý lớp)
 */
async function removePersonFromCsv(identifier, className = '') {
  if (!identifier) return [];

  const targetId = String(identifier).trim();
  const targetNorm = normalizeName(identifier);

  // Nếu có truyền className cụ thể -> Xóa hoàn toàn dòng thành viên khỏi CSV lớp
  if (className) {
    const filePath = getFilePath(className);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
      
      const newLines = lines.filter((line, idx) => {
        if (idx === 0) return true; // Giữ header
        const regex = /(?:^|,)(?:"([^"]*)"|([^",]*))/g;
        const parts = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
          parts.push(match[1] !== undefined ? match[1] : match[2]);
        }
        if (parts.length < 1) return false;

        const rowName = parts[0]?.trim();
        const rowPersonId = (parts[5] || '').trim();
        const rowAlias = (parts[6] || '').trim();

        if (targetId && (rowAlias === targetId || rowPersonId === targetId)) return false;
        if (targetNorm && normalizeName(rowName) === targetNorm) return false;

        return true;
      });

      fs.writeFileSync(filePath, newLines.join('\n') + '\n', 'utf-8');
      console.log(`🗑️ [CSV Service] Đã xóa thành viên "${identifier}" khỏi ${path.basename(filePath)}`);
      return [filePath];
    }
  }

  // Nếu không truyền className -> Reset avatar/PersonID trên toàn bộ file (tương thích backward)
  const updatedFiles = [];
  if (!fs.existsSync(DATA_DIR)) return updatedFiles;

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

        if ((targetId && rowId === targetId) || (targetNorm && rowName === targetNorm && (!rowId || rowId === targetId))) {
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
        console.log(`🧹 [CSV Service] Đã xóa Face ID & PersonID trong file ${file} cho ID: ${identifier}`);
      }
    } catch (err) {
      console.warn(`[CSV Service] Lỗi khi reset person trong file ${file}:`, err.message);
    }
  }

  return updatedFiles;
}

/**
 * Đổi tên file CSV của lớp và đồng bộ cột Lớp trong tất cả các dòng
 * @param {string} oldClassName Tên lớp cũ
 * @param {string} newClassName Tên lớp mới
 */
async function renameClassCsv(oldClassName, newClassName) {
  const oldPath = getFilePath(oldClassName);
  if (!fs.existsSync(oldPath)) {
    throw new Error(`Không tìm thấy file danh mục cho lớp ${oldClassName}`);
  }

  const safeNewName = path.basename(newClassName).replace(/\.csv$/i, '').trim();
  const newPath = path.join(DATA_DIR, `${safeNewName}.csv`);

  const content = fs.readFileSync(oldPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

  const newLines = lines.map((line, idx) => {
    if (idx === 0) return line; // Giữ header
    const regex = /(?:^|,)(?:"([^"]*)"|([^",]*))/g;
    const parts = [];
    let match;
    while ((match = regex.exec(line)) !== null) {
      parts.push(match[1] !== undefined ? match[1] : match[2]);
    }
    if (parts.length >= 2) {
      parts[1] = safeNewName; // Cập nhật cột Lớp
      return parts.map(p => (p && (p.includes(',') || p.includes('"')) ? `"${p.replace(/"/g, '""')}"` : (p || ''))).join(',');
    }
    return line;
  });

  // Ghi file mới
  fs.writeFileSync(newPath, newLines.join('\n') + '\n', 'utf-8');

  // Xóa file cũ nếu tên khác file mới
  if (path.resolve(oldPath) !== path.resolve(newPath) && fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath);
  }

  console.log(`🔄 [CSV Service] Đã đổi tên lớp từ "${oldClassName}" sang "${newClassName}"`);
  return true;
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

    // Ghi đè lại file CSV an toàn với ký tự xuống dòng chuẩn UTF-8
    fs.writeFileSync(filePath, validLines.join('\n') + '\n', 'utf-8');
    return true;
  } catch (error) {
    console.error(`❌ [CSV Write-Back Error] Lỗi ghi file ${cleanClassName}.csv:`, error.message);
    return false;
  }
}

module.exports = {
  getFilePath,
  readList,
  appendPerson,
  updatePersonInfo,
  removePersonFromCsv,
  renameClassCsv,
  writeBackRegistration,
  normalizeName
};
