require('dotenv').config();
const fs = require('fs');
const path = require('path');
const hanetService = require('../src/services/hanetService');

function normalizeName(name) {
  if (!name) return '';
  return name.toString().trim().toLowerCase().replace(/\s+/g, ' ');
}

async function syncCloudToCsv() {
  console.log('🔄 [Sync Tool] Bắt đầu đồng bộ dữ liệu hai chiều giữa HANET Cloud và các file CSV...\n');

  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    console.error('❌ Thư mục data không tồn tại:', dataDir);
    process.exit(1);
  }

  // 1. Lấy toàn bộ danh sách từ Cloud
  let cloudPersons = [];
  try {
    const res = await hanetService.getListByPlace();
    cloudPersons = res?.data || [];
    console.log(`📡 Đã tải thành công ${cloudPersons.length} nhân sự từ Cloud HANET.`);
  } catch (err) {
    console.error('❌ Lỗi khi gọi API HANET:', err.message);
    process.exit(1);
  }

  // Xây dựng bộ chỉ mục (Indexes) để tra cứu chính xác, chống trùng tên cho 2.000+ nhân sự
  const cloudById = new Map();
  const cloudByNameAndClass = new Map();
  const cloudByName = new Map(); // danh sách mảng cho trường hợp trùng tên

  cloudPersons.forEach(p => {
    const pId = String(p.id || p.personID || '').trim();
    const normName = normalizeName(p.name);
    const alias = (p.aliasID || '').toLowerCase().trim();
    const item = { ...p, id: pId };

    if (pId) {
      cloudById.set(pId, item);
    }

    if (normName) {
      if (!cloudByName.has(normName)) {
        cloudByName.set(normName, []);
      }
      cloudByName.get(normName).push(item);
    }

    // Index theo key: "tên + mã lớp trong alias"
    if (normName && alias) {
      cloudByNameAndClass.set(`${normName}|${alias}`, item);
    }
  });

  // 2. Quét tất cả file CSV hợp lệ trong thư mục data (bỏ qua .bak, file ẩn)
  const files = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.csv') && !f.includes('.bak') && !f.startsWith('.') && !f.startsWith('._'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  let totalUpdated = 0;
  let totalCleared = 0;

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/);
    if (lines.length === 0) continue;

    const className = file.replace(/\.csv$/i, '').trim().toLowerCase();
    let fileModified = false;
    let updatedInFile = 0;
    let clearedInFile = 0;

    const newLines = lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      // Giữ nguyên dòng tiêu đề
      if (idx === 0 && trimmed.toLowerCase().startsWith('tên,')) {
        return line;
      }

      // Phân tích dòng CSV: [Tên, Lớp, Phòng Ban, Chức Vụ, links, PersonID]
      const parts = trimmed.split(',');
      if (parts.length < 4) return line;

      const rawName = parts[0].trim();
      const normName = normalizeName(rawName);
      const currentAvatar = (parts[4] || '').replace(/^"|"$/g, '').trim();
      const currentId = (parts[5] || '').trim();

      // --- TÌM KIẾM NHÂN SỰ TƯƠNG ỨNG TRÊN CLOUD (CHỐNG TRÙNG TÊN) ---
      let matched = null;

      // 1. Ưu tiên tìm theo PersonID hiện có trên Cloud nếu ID hợp lệ
      if (currentId && cloudById.has(currentId)) {
        matched = cloudById.get(currentId);
      }

      // 2. Tìm theo cặp (Tên + Tên Lớp)
      if (!matched) {
        for (const [key, person] of cloudByNameAndClass.entries()) {
          if (key.startsWith(`${normName}|`) && key.includes(className)) {
            matched = person;
            break;
          }
        }
      }

      // 3. Tìm theo Tên trong danh sách nếu chỉ có 1 người trùng tên trên toàn Cloud
      if (!matched && cloudByName.has(normName)) {
        const candidates = cloudByName.get(normName);
        if (candidates.length === 1) {
          matched = candidates[0];
        } else {
          // Nếu có nhiều người trùng tên, tìm người có alias gần khớp với lớp
          matched = candidates.find(c => (c.aliasID || '').toLowerCase().includes(className)) || candidates[0];
        }
      }

      // --- ĐỒNG BỘ 2 CHIỀU ---
      if (matched && matched.id) {
        // TRƯỜNG HỢP 1: Có trên Cloud -> Cập nhật URL ảnh và PersonID mới nhất
        const cloudAvatar = matched.avatar || '';
        const cloudId = String(matched.id);

        if (currentAvatar !== cloudAvatar || currentId !== cloudId) {
          parts[4] = cloudAvatar ? `"${cloudAvatar}"` : '""';
          parts[5] = cloudId;
          fileModified = true;
          updatedInFile++;
          totalUpdated++;
          return parts.join(',');
        }
      } else {
        // TRƯỜNG HỢP 2: Người này trước đây có PersonID/link trong CSV nhưng NAY ĐÃ BỊ XÓA trên Cloud
        if (currentId || currentAvatar) {
          parts[4] = '""';
          parts[5] = '""';
          fileModified = true;
          clearedInFile++;
          totalCleared++;
          console.log(`⚠️ [Xóa/Reset ID] ${rawName} (${file}): Không còn trên Cloud HANET -> Đã xóa rỗng PersonID & Link.`);
          return parts.join(',');
        }
      }

      return line;
    });

    if (fileModified) {
      fs.writeFileSync(filePath, newLines.join('\n'), 'utf-8');
      console.log(`✅ [${file}] Cập nhật: ${updatedInFile} | Đã reset: ${clearedInFile}`);
    }
  }

  console.log(`\n🎉 [Sync Tool Hoàn Tất]`);
  console.log(`   - Tổng số nhân sự đã cập nhật link ảnh & PersonID: ${totalUpdated}`);
  console.log(`   - Tổng số nhân sự đã reset do bị xóa trên Cloud: ${totalCleared}`);
}

syncCloudToCsv();
