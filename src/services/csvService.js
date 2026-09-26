const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const DATA_DIR = path.join(__dirname, '../../data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Lấy đường dẫn file CSV an toàn trong thư mục data
 * @param {string} fileName Tên file danh mục (vd: thieu_nhi)
 * @returns {string}
 */
exports.getFilePath = (fileName) => {
  const safeName = path.basename(fileName).replace(/\.csv$/, '');
  return path.join(DATA_DIR, `${safeName}.csv`);
};

/**
 * Đọc file CSV và chuẩn hóa key về dạng chuẩn nội bộ:
 * ho_ten, lop, phong_ban, chuc_vu, anh_url, hanet_person_id
 * @param {string} fileName 
 * @returns {Promise<Array<Object>>}
 */
exports.readList = (fileName) => {
  const filePath = exports.getFilePath(fileName);
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
};

/**
 * Ghi thêm thành viên mới theo đúng header gốc của CSV
 * @param {string} fileName
 * @param {Object} person
 */
exports.appendPerson = async (fileName, person) => {
  const filePath = exports.getFilePath(fileName);
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
};
