require('dotenv').config();
const fs = require('fs');
const path = require('path');
const hanetService = require('../src/services/hanetService');
const csvService = require('../src/services/csvService');

const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Chuẩn hóa chuỗi họ tên: chữ thường, cắt khoảng trắng dư thừa
 */
function normalizeName(str) {
  if (!str) return '';
  return str.toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Loại bỏ dấu tiếng Việt để đối soát linh hoạt
 */
function removeAccents(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Chuẩn hóa chuỗi tên lớp để đối soát file linh hoạt (bỏ _, space, hoa thường)
 */
function normalizeClassKey(str) {
  if (!str) return '';
  return str.toString().trim().toUpperCase().replace(/[\s_-]+/g, '');
}

/**
 * Tìm file CSV tương ứng trong thư mục data/
 */
function findCsvFile(rawClass) {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  const normTarget = normalizeClassKey(rawClass);
  const files = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.csv') && !f.includes('.bak'));

  // 1. Khớp chính xác tên file
  for (const f of files) {
    const base = f.replace(/\.csv$/i, '');
    if (base === rawClass) {
      return { filePath: path.join(DATA_DIR, f), fileName: f, className: base, isNew: false };
    }
  }

  // 2. Khớp linh hoạt (không phân biệt _, space, hoa thường)
  for (const f of files) {
    const base = f.replace(/\.csv$/i, '');
    if (normalizeClassKey(base) === normTarget) {
      return { filePath: path.join(DATA_DIR, f), fileName: f, className: base, isNew: false };
    }
  }

  // 3. Nếu chưa có -> Tạo file mới
  const newFileName = `${rawClass.toUpperCase()}.csv`;
  const newFilePath = path.join(DATA_DIR, newFileName);
  return { filePath: newFilePath, fileName: newFileName, className: rawClass.toUpperCase(), isNew: true };
}

/**
 * Trích xuất Tên Lớp từ AliasID chuẩn (Format: [MÃ_PB]_[TÊN_LỚP]_[MÃ_ĐỊNH_DANH])
 */
function extractClassFromAlias(aliasID, defaultClass = 'CHUNG') {
  if (!aliasID) return defaultClass;
  const parts = aliasID.trim().split('_');
  if (parts.length >= 3) {
    return parts[1]; // Phần thứ 2 chính là TÊN_LỚP
  }
  if (parts.length === 2) {
    return parts[1];
  }
  return defaultClass;
}

async function sync83FaceIdsToCsv() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🔄 BẮT ĐẦU ĐỒNG BỘ TOÀN BỘ FACE ID TỪ HANET CLOUD VỀ FILE CSV');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  // 1. Tải danh sách toàn bộ nhân sự từ Cloud (tự động gom phân trang 100%)
  let persons = [];
  try {
    const res = await hanetService.getListByPlace();
    persons = (res && Array.isArray(res.data)) ? res.data : [];
    console.log(`📡 Đã tải thành công: ${persons.length} FaceID từ HANET Cloud.\n`);
  } catch (err) {
    console.error('❌ Lỗi gọi API HANET Cloud:', err.message);
    process.exit(1);
  }

  if (persons.length === 0) {
    console.warn('⚠️ Không tìm thấy nhân sự nào trên Cloud.');
    return;
  }

  // 2. Cấu trúc thống kê & kiểm tra trùng lặp
  const fileStats = new Map();
  const seenPersonIds = new Map();
  const duplicatePersonId = {};
  const seenUrls = new Map();
  const duplicateImageUrl = {};

  let totalUpdated = 0;
  let totalAppended = 0;
  let totalUnchanged = 0;

  // 3. Phân nhóm nhân sự theo file CSV đích
  const groupedByFile = new Map();

  for (const p of persons) {
    const alias = String(p.aliasID || '').trim();
    const personId = String(p.id || p.personID || '').trim();
    const faceUrl = String(p.avatar || p.faceUrl || '').trim();
    const name = String(p.name || '').trim();
    const title = String(p.title || '').trim();
    const department = String(p.department || p.department_name || '').trim();

    // A. Kiểm tra trùng lặp PersonID
    if (personId) {
      if (seenPersonIds.has(personId)) {
        if (!duplicatePersonId[personId]) {
          duplicatePersonId[personId] = [seenPersonIds.get(personId)];
        }
        duplicatePersonId[personId].push({ name, alias, personId });
      } else {
        seenPersonIds.set(personId, { name, alias, personId });
      }
    }

    // B. Kiểm tra trùng lặp Avatar URL
    if (faceUrl) {
      if (seenUrls.has(faceUrl)) {
        if (!duplicateImageUrl[faceUrl]) {
          duplicateImageUrl[faceUrl] = [seenUrls.get(faceUrl)];
        }
        duplicateImageUrl[faceUrl].push({ name, alias, faceUrl });
      } else {
        seenUrls.set(faceUrl, { name, alias, faceUrl });
      }
    }

    // C. Xác định file CSV đích
    const rawClass = extractClassFromAlias(alias, 'CHUNG');
    const fileInfo = findCsvFile(rawClass);

    if (!groupedByFile.has(fileInfo.fileName)) {
      groupedByFile.set(fileInfo.fileName, {
        fileInfo,
        persons: []
      });
    }

    groupedByFile.get(fileInfo.fileName).persons.push({
      name,
      alias,
      personId,
      faceUrl,
      title,
      department
    });
  }

  // 4. Xử lý cập nhật cho từng file CSV
  for (const [fileName, group] of groupedByFile.entries()) {
    const { filePath, className, isNew } = group.fileInfo;
    let lines = [];
    let updatedInFile = 0;
    let appendedInFile = 0;
    let unchangedInFile = 0;

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
    }

    // Đảm bảo có dòng header chuẩn
    if (lines.length === 0 || !lines[0].toLowerCase().startsWith('tên,')) {
      lines.unshift('Tên,Lớp,Phòng Ban,Chức Vụ,links,PersonID');
    }

    const matchedPersonIndexes = new Set();

    for (const p of group.persons) {
      const targetNormName = normalizeName(p.name);
      const targetNoAccent = removeAccents(p.name);
      let foundIndex = -1;

      // 1. Tìm khớp chính xác họ tên
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',');
        const rowName = normalizeName(parts[0]);
        if (rowName === targetNormName) {
          foundIndex = i;
          break;
        }
      }

      // 2. Tìm khớp họ tên không dấu (nếu cách gõ dấu khác nhau)
      if (foundIndex === -1) {
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',');
          const rowNoAccent = removeAccents(parts[0]);
          if (rowNoAccent === targetNoAccent) {
            foundIndex = i;
            break;
          }
        }
      }

      if (foundIndex !== -1) {
        matchedPersonIndexes.add(foundIndex);
        const parts = lines[foundIndex].split(',');
        const currentAvatar = (parts[4] || '').replace(/^"|"$/g, '').trim();
        const currentId = (parts[5] || '').trim();

        const newAvatar = p.faceUrl || currentAvatar;
        const newId = p.personId || currentId;

        // Cập nhật chức vụ nếu có
        if (p.title && !parts[3]) {
          parts[3] = p.title;
        }

        if (currentAvatar !== newAvatar || currentId !== newId) {
          parts[4] = newAvatar ? `"${newAvatar}"` : '""';
          parts[5] = newId;
          lines[foundIndex] = parts.join(',');
          updatedInFile++;
          totalUpdated++;
        } else {
          unchangedInFile++;
          totalUnchanged++;
        }
      } else {
        // Thêm mới dòng vào cuối file
        let inheritDept = p.department || 'Thiếu Nhi';
        let inheritTitle = p.title || 'Học Sinh';

        if (lines.length > 1) {
          const lastLineParts = lines[lines.length - 1].split(',');
          if (lastLineParts.length >= 4) {
            inheritDept = lastLineParts[2]?.trim() || inheritDept;
            inheritTitle = p.title || lastLineParts[3]?.trim() || inheritTitle;
          }
        }

        const newLine = `${p.name},${className},${inheritDept},${inheritTitle},"${p.faceUrl || ''}",${p.personId}`;
        lines.push(newLine);
        appendedInFile++;
        totalAppended++;
      }
    }

    // Ghi đè file CSV an toàn với UTF-8
    fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf-8');

    fileStats.set(fileName, {
      fileName,
      totalRows: lines.length - 1,
      cloudCount: group.persons.length,
      updated: updatedInFile,
      appended: appendedInFile,
      unchanged: unchangedInFile
    });
  }

  // 5. In bảng thống kê chi tiết theo từng file
  console.log('📋 KẾT QUẢ ĐỒNG BỘ THEO TỪNG FILE CSV:');
  const tableData = [];
  for (const stat of fileStats.values()) {
    tableData.push({
      'File CSV': stat.fileName,
      'Số trên Cloud': stat.cloudCount,
      'Cập nhật mới': stat.updated,
      'Thêm mới dòng': stat.appended,
      'Đã khớp sẵn': stat.unchanged,
      'Tổng dòng CSV': stat.totalRows
    });
  }
  console.table(tableData);

  // 6. Báo cáo tổng kết
  console.log('\n📊 === BÁO CÁO TỔNG KẾT TOÀN DIỆN ===');
  console.log(`🔹 Tổng số FaceID quét từ Cloud : ${persons.length}`);
  console.log(`🟢 Cập nhật mới (New Enrich)     : ${totalUpdated}`);
  console.log(`🟡 Thêm mới dòng (Appended)      : ${totalAppended}`);
  console.log(`⏩ Đã khớp sẵn (Unchanged)       : ${totalUnchanged}`);
  console.log(`📁 Số file CSV đã xử lý          : ${fileStats.size}`);

  // 7. Cảnh báo trùng lặp nếu có
  const dupIdKeys = Object.keys(duplicatePersonId);
  if (dupIdKeys.length > 0) {
    console.warn('\n⚠️ ═══════════════════════════════════════════════════════════════');
    console.warn(`⚠️ PHÁT HIỆN ${dupIdKeys.length} TRƯỜNG HỢP TRÙNG PERSON ID TRÊN CLOUD:`);
    console.warn('═══════════════════════════════════════════════════════════════');
    dupIdKeys.forEach(id => {
      console.warn(`\n[PersonID: ${id}]`);
      duplicatePersonId[id].forEach(u => console.warn(`  - [${u.alias}] ${u.name}`));
    });
  } else {
    console.log('\n✅ Kiểm tra PersonID: Không phát hiện PersonID trùng lặp.');
  }

  const dupUrlKeys = Object.keys(duplicateImageUrl);
  if (dupUrlKeys.length > 0) {
    console.warn('\n⚠️ ═══════════════════════════════════════════════════════════════');
    console.warn(`⚠️ PHÁT HIỆN ${dupUrlKeys.length} TRƯỜNG HỢP DÙNG CHUNG URL ẢNH TRÊN CLOUD:`);
    console.warn('═══════════════════════════════════════════════════════════════');
    dupUrlKeys.forEach(url => {
      console.warn(`\n[URL: ${url}]`);
      duplicateImageUrl[url].forEach(u => console.warn(`  - [${u.alias}] ${u.name}`));
    });
  } else {
    console.log('✅ Kiểm tra Avatar URL: Không phát hiện Avatar URL trùng lặp.');
  }

  console.log('\n🎉 [HOÀN TẤT ĐỒNG BỘ 100% FACE ID VỀ FILE CSV]');
}

if (require.main === module) {
  sync83FaceIdsToCsv().catch(err => {
    console.error('❌ Lỗi thực thi script:', err);
    process.exit(1);
  });
}

module.exports = sync83FaceIdsToCsv;
