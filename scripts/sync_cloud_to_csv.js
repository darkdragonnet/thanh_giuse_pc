require('dotenv').config();
const fs = require('fs');
const path = require('path');
const hanetService = require('../src/services/hanetService');

const DATA_DIR = path.join(__dirname, '../data');
const ERROR_LOG = path.join(__dirname, '../error.log');

// Chuẩn hóa tên (bỏ khoảng trắng thừa, chữ thường)
function normalizeName(str) {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Bóc tách tên lớp từ aliasID và tìm file CSV tương ứng
function extractClassAndFindCsv(aliasID, csvFiles) {
  if (!aliasID) return null;
  const parts = aliasID.trim().split('_');
  if (parts.length < 2) return null;

  // Lấy phần giữa: [TiềnTố]_[MãLớp]_[HậuTố] hoặc [MãLớp]_[HậuTố]
  let classPart = '';
  if (parts.length >= 3) {
    classPart = parts.slice(1, parts.length - 1).join('_').toLowerCase();
  } else {
    classPart = parts[0].toLowerCase();
  }

  for (const file of csvFiles) {
    const baseName = file.replace(/\.csv$/i, '').toLowerCase();
    if (baseName === classPart || baseName.replace(/_/g, '') === classPart.replace(/_/g, '')) {
      return file;
    }
  }
  return null;
}

// Đọc và phân tích file CSV
function parseCsv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length === 0) return { header: [], rows: [], rawHeader: '' };

  const header = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
    rows.push(cols);
  }

  return { header, rows, rawHeader: lines[0] };
}

// Ghi dữ liệu ra file CSV chuẩn
function writeCsv(filePath, rawHeader, rows) {
  const output = [rawHeader];
  rows.forEach(r => {
    const formatted = r.map(col => {
      if (col === '' || col === undefined || col === null) return '""';
      if (col.includes(',') || col.includes('"') || col.includes('http')) return `"${col}"`;
      return col;
    }).join(',');
    output.push(formatted);
  });
  fs.writeFileSync(filePath, output.join('\n') + '\n', 'utf-8');
}

async function runSync() {
  console.log('=== [BẮT ĐẦU ĐỒNG BỘ HANET CLOUD -> DATA CSV] ===\n');

  if (!fs.existsSync(DATA_DIR)) {
    console.error(`❌ Không tìm thấy thư mục: ${DATA_DIR}`);
    process.exit(1);
  }

  fs.writeFileSync(ERROR_LOG, `--- ERROR LOG [${new Date().toISOString()}] ---\n`, 'utf-8');

  try {
    console.log('1. Đang tải danh sách nhân sự từ HANET Cloud...');
    const res = await hanetService.getListByPlace();
    const cloudPersons = res?.data || [];
    console.log(`-> Đã lấy thành công ${cloudPersons.length} nhân sự từ Cloud.\n`);

    const csvFiles = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.csv') && !f.includes('.bak'));

    const csvCache = {};
    csvFiles.forEach(file => {
      const fullPath = path.join(DATA_DIR, file);
      csvCache[file] = {
        path: fullPath,
        ...parseCsv(fullPath),
        isModified: false
      };
    });

    let countUpdated = 0;
    let countAppended = 0;
    let countErrors = 0;

    for (const person of cloudPersons) {
      const { name, aliasID, personID, avatar } = person;

      const matchedCsvFile = extractClassAndFindCsv(aliasID, csvFiles);

      if (!matchedCsvFile) {
        const errLine = `[LỖI MAP CSV] PersonID: ${personID} | Tên: ${name} | AliasID: ${aliasID || 'N/A'} -> Không tìm thấy file CSV phù hợp trong data/\n`;
        fs.appendFileSync(ERROR_LOG, errLine, 'utf-8');
        countErrors++;
        continue;
      }

      const csvData = csvCache[matchedCsvFile];
      const rows = csvData.rows;

      const nameIdx = csvData.header.findIndex(h => /tên|ho_ten/i.test(h));
      const linksIdx = csvData.header.findIndex(h => /links|ảnh|anh_url/i.test(h));
      const pidIdx = csvData.header.findIndex(h => /personid|id/i.test(h));

      const normCloudName = normalizeName(name);
      let foundRow = null;

      for (const row of rows) {
        if (normalizeName(row[nameIdx]) === normCloudName) {
          foundRow = row;
          break;
        }
      }

      if (foundRow) {
        if (linksIdx !== -1 && avatar) foundRow[linksIdx] = avatar;
        if (pidIdx !== -1 && personID) foundRow[pidIdx] = String(personID);
        csvData.isModified = true;
        countUpdated++;
      } else {
        const lastRow = rows.length > 0 ? rows[rows.length - 1] : [];
        const className = matchedCsvFile.replace(/\.csv$/i, '');
        const deptName = lastRow[2] || (aliasID && aliasID.startsWith('LM_') ? 'Lêgiô Mariae' : 'Thiếu Nhi');
        const titleName = lastRow[3] || 'Thành Viên';

        const newRow = [
          name,
          className,
          deptName,
          titleName,
          avatar || '',
          String(personID)
        ];

        rows.push(newRow);
        csvData.isModified = true;
        countAppended++;
        console.log(`[Thêm Mới] "${name}" -> ${matchedCsvFile}`);
      }
    }

    console.log('\n2. Đang ghi dữ liệu vào các file CSV...');
    for (const [fileName, fileData] of Object.entries(csvCache)) {
      if (fileData.isModified) {
        writeCsv(fileData.path, fileData.rawHeader, fileData.rows);
        console.log(`   ✅ Đã cập nhật file: ${fileName}`);
      }
    }

    console.log('\n=== [HOÀN TẤT ĐỒNG BỘ] ===');
    console.log(`- Cập nhật Link/PersonID: ${countUpdated}`);
    console.log(`- Thêm mới vào CSV:       ${countAppended}`);
    console.log(`- Ngoại lệ / Lỗi:         ${countErrors} (Chi tiết trong error.log)`);

  } catch (err) {
    console.error('❌ Lỗi thực thi:', err.message);
    fs.appendFileSync(ERROR_LOG, `[FATAL] ${err.stack}\n`, 'utf-8');
  }
}

runSync();
