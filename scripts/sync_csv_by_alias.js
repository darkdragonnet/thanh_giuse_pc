require('dotenv').config();
const fs = require('fs');
const path = require('path');
const hanetService = require('../src/services/hanetService');

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
    .replace(/Đ/g, 'D');
}

/**
 * Chuẩn hóa alias ID để tra cứu
 */
function normalizeAlias(alias) {
  if (!alias) return '';
  return alias.toString().trim().toLowerCase().replace(/[\s_-]+/g, '');
}

async function syncCsvByAlias() {
  console.log('🔄 [HANET Sync] Bắt đầu đồng bộ trực tiếp Cloud HANET -> File CSV (Mảng Cache / Alias ID)...\n');

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    console.error('❌ Thư mục data không tồn tại:', dataDir);
    process.exit(1);
  }

  // 1. Tải toàn bộ nhân sự từ Cloud HANET về mảng bộ nhớ (1 request duy nhất)
  let cloudPersons = [];
  try {
    const res = await hanetService.getListByPlace();
    cloudPersons = res?.data || [];
    console.log(`📡 Đã nạp thành công ${cloudPersons.length} nhân sự từ Cloud HANET vào bộ nhớ đệm.`);
  } catch (err) {
    console.error('❌ Lỗi khi tải dữ liệu từ Cloud HANET:', err.message);
    process.exit(1);
  }

  // 2. Xây dựng các cấu trúc tra cứu nhanh (Indexes)
  const cloudById = new Map();
  const cloudByAlias = new Map();
  const cloudByNormName = new Map();
  const cloudByNoAccentName = new Map();

  cloudPersons.forEach(p => {
    const pId = String(p.id || p.personID || '').trim();
    const rawName = String(p.name || '').trim();
    const rawAlias = String(p.aliasID || '').trim();
    const normName = normalizeName(rawName);
    const noAccentName = removeAccents(normName);
    const normAlias = normalizeAlias(rawAlias);

    const record = {
      id: pId,
      name: rawName,
      aliasID: rawAlias,
      avatar: p.avatar || '',
      department: p.department || '',
      title: p.title || ''
    };

    if (pId) {
      cloudById.set(pId, record);
    }

    if (normAlias) {
      cloudByAlias.set(normAlias, record);
    }

    if (normName) {
      if (!cloudByNormName.has(normName)) {
        cloudByNormName.set(normName, []);
      }
      cloudByNormName.get(normName).push(record);
    }

    if (noAccentName) {
      if (!cloudByNoAccentName.has(noAccentName)) {
        cloudByNoAccentName.set(noAccentName, []);
      }
      cloudByNoAccentName.get(noAccentName).push(record);
    }
  });

  // 3. Quét các file CSV trong thư mục data/
  const files = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.csv') && !f.includes('.bak') && !f.startsWith('.') && !f.startsWith('._'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  let totalUpdated = 0;
  let totalUnchanged = 0;
  let totalNotFound = 0;

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    if (lines.length === 0) continue;

    const className = file.replace(/\.csv$/i, '').trim();
    const normClass = normalizeAlias(className);
    let fileModified = false;
    let fileUpdated = 0;

    const newLines = lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Giữ nguyên tiêu đề (Tên,Lớp,Phòng Ban,Chức Vụ,links,PersonID)
      if (idx === 0 && trimmed.toLowerCase().startsWith('tên,')) {
        return line;
      }

      const parts = trimmed.split(',');
      if (parts.length < 4) return line;

      const rawName = parts[0].trim();
      const normName = normalizeName(rawName);
      const noAccentName = removeAccents(normName);
      const currentAvatar = (parts[4] || '').replace(/^"|"$/g, '').trim();
      const currentId = (parts[5] || '').trim();

      // --- MAPPING ĐỐI SOÁT ---
      let matched = null;

      // 1. Khớp theo PersonID hiện có nếu đã có trong CSV
      if (currentId && cloudById.has(currentId)) {
        matched = cloudById.get(currentId);
      }

      // 2. Khớp theo Alias ID dự kiến (VD: TN_ThemSuc_1a_Giuse_Tran_Nam_An hoặc tương đương)
      if (!matched) {
        const potentialAlias1 = normalizeAlias(`TN_${className}_${rawName}`);
        const potentialAlias2 = normalizeAlias(`LM_${className}_${rawName}`);
        const potentialAlias3 = normalizeAlias(`GT_${className}_${rawName}`);
        const potentialAlias4 = normalizeAlias(`${className}_${rawName}`);

        matched = cloudByAlias.get(potentialAlias1) ||
                  cloudByAlias.get(potentialAlias2) ||
                  cloudByAlias.get(potentialAlias3) ||
                  cloudByAlias.get(potentialAlias4);
      }

      // 3. Khớp chính xác theo Họ Tên (có dấu) + lọc theo lớp/alias
      if (!matched && cloudByNormName.has(normName)) {
        const candidates = cloudByNormName.get(normName);
        if (candidates.length === 1) {
          matched = candidates[0];
        } else {
          matched = candidates.find(c => normalizeAlias(c.aliasID).includes(normClass)) || candidates[0];
        }
      }

      // 4. Khớp theo Họ Tên không dấu + lọc theo lớp/alias
      if (!matched && cloudByNoAccentName.has(noAccentName)) {
        const candidates = cloudByNoAccentName.get(noAccentName);
        if (candidates.length === 1) {
          matched = candidates[0];
        } else {
          matched = candidates.find(c => normalizeAlias(c.aliasID).includes(normClass)) || candidates[0];
        }
      }

      // --- ONE-WAY ENRICH / WRITE-BACK AN TOÀN ---
      if (matched && matched.id) {
        const cloudAvatar = matched.avatar || '';
        const cloudId = String(matched.id);

        if (currentAvatar !== cloudAvatar || currentId !== cloudId) {
          parts[4] = cloudAvatar ? `"${cloudAvatar}"` : '""';
          parts[5] = cloudId;
          fileModified = true;
          fileUpdated++;
          totalUpdated++;
          return parts.join(',');
        } else {
          totalUnchanged++;
        }
      } else {
        // Không tìm thấy trên Cloud -> Giữ nguyên tuyệt đối (RULE-002: One-way Enrich)
        totalNotFound++;
      }

      return line;
    });

    if (fileModified) {
      fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
      console.log(`✅ [${file}] Đã cập nhật ${fileUpdated} nhân sự từ Cloud HANET.`);
    }
  }

  console.log(`\n🎉 [ĐỒNG BỘ HOÀN TẤT]`);
  console.log(`   - Số dòng đã cập nhật PersonID/Avatar mới: ${totalUpdated}`);
  console.log(`   - Số dòng dữ liệu đã chính xác từ trước: ${totalUnchanged}`);
  console.log(`   - Số nhân sự chưa có trên Cloud (giữ nguyên): ${totalNotFound}`);
}

if (require.main === module) {
  syncCsvByAlias().catch(err => {
    console.error('❌ Lỗi xử lý:', err);
    process.exit(1);
  });
}

module.exports = syncCsvByAlias;
