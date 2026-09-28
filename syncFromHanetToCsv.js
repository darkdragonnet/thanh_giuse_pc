require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const qs = require('qs');
const hanetService = require('./src/services/hanetService');

const API_BASE = process.env.HANET_API_BASE || 'https://partner.hanet.ai';
const PLACE_ID = process.env.HANET_PLACE_ID || '998577';
const DATA_DIR = path.join(__dirname, 'data');

// 1. Chuẩn hoá tên: loại bỏ toàn bộ dấu tiếng Việt, ký tự đặc biệt, chuyển chữ thường
function normalizeName(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'd')
        .replace(/[^a-zA-Z0-9\s]/g, ' ') // Bỏ ký tự đặc biệt
        .replace(/\s+/g, ' ')           // Gom khoảng trắng thừa
        .trim()
        .toLowerCase();
}

// 2. Lấy tổng số lượng nhân sự thực tế trên HANET Cloud
async function getTotalPersons(token) {
    try {
        const payload = qs.stringify({ token, placeID: PLACE_ID });
        const res = await axios.post(`${API_BASE}/person/getTotalPersonByPlaceID`, payload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 8000
        });
        if (res.data && res.data.returnCode === 1) {
            return Number(res.data.data?.total || res.data.data || 0);
        }
    } catch (e) {
        console.warn('⚠️ Không thể kiểm tra tổng số nhân sự qua getTotalPersonByPlaceID:', e.message);
    }
    return 0;
}

// 3. Lấy toàn bộ nhân sự ĐẦY ĐỦ NHẤT (kết hợp getListByPlace + quét theo Department nếu cần)
async function fetchAllHanetPersons() {
    const token = await hanetService.getAccessToken();
    const totalExpected = await getTotalPersons(token);
    if (totalExpected > 0) {
        console.log(`🎯 Tổng số nhân sự ghi nhận trên HANET Cloud: ${totalExpected} người.`);
    }

    console.log('📡 Đang gọi POST /person/getListByPlace...');
    const personMap = new Map(); // Dùng Map theo personID để tránh trùng lặp

    // Cách 1: Gọi getListByPlace thuần (không ép param page giả định)
    try {
        const payload = qs.stringify({ token, placeID: PLACE_ID });
        const res = await axios.post(`${API_BASE}/person/getListByPlace`, payload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 20000
        });

        const list = res.data?.data || [];
        if (Array.isArray(list)) {
            list.forEach(p => {
                const id = String(p.personID || p.id || '');
                if (id) personMap.set(id, p);
            });
            console.log(`✅ Lần 1 (getListByPlace): Thu được ${personMap.size} nhân sự.`);
        }
    } catch (err) {
        console.error('❌ Lỗi gọi getListByPlace:', err.response?.data || err.message);
    }

    // Cách 2: Nếu chưa đủ so với tổng số, thử gọi /person/get-by-place
    if (totalExpected > 0 && personMap.size < totalExpected) {
        console.log(`⚠️ Số lượng hiện tại (${personMap.size}) ít hơn tổng số (${totalExpected}). Thử quét qua endpoint /person/get-by-place...`);
        try {
            const payload = qs.stringify({ token, placeID: PLACE_ID });
            const res = await axios.post(`${API_BASE}/person/get-by-place`, payload, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 20000
            });
            const list = res.data?.data || [];
            if (Array.isArray(list)) {
                list.forEach(p => {
                    const id = String(p.personID || p.id || '');
                    if (id && !personMap.has(id)) personMap.set(id, p);
                });
                console.log(`✅ Sau khi thử get-by-place: Đã nâng tổng số lên ${personMap.size} nhân sự.`);
            }
        } catch (e) {
            // bỏ qua nếu endpoint không khả dụng
        }
    }

    // Cách 3: Nếu vẫn thiếu, quét qua danh sách phòng ban (Department) để vét sạch
    if (totalExpected > 0 && personMap.size < totalExpected) {
        console.log(`📡 Đang quét qua từng phòng ban để lấy trọn vẹn...`);
        try {
            const deptRes = await axios.post(`${API_BASE}/department/getDepartmentList`, qs.stringify({ token, placeID: PLACE_ID }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });
            const depts = deptRes.data?.data?.hits || deptRes.data?.data || [];
            for (const d of depts) {
                const deptId = d.id || d.departmentID;
                if (!deptId) continue;
                const pRes = await axios.post(`${API_BASE}/person/getPersonsByDepartment`, qs.stringify({ token, placeID: PLACE_ID, departmentID: deptId }), {
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                });
                const deptMembers = pRes.data?.data || [];
                if (Array.isArray(deptMembers)) {
                    deptMembers.forEach(p => {
                        const id = String(p.personID || p.id || '');
                        if (id && !personMap.has(id)) personMap.set(id, p);
                    });
                }
            }
            console.log(`✅ Sau khi quét phòng ban: Thu được ${personMap.size} nhân sự.`);
        } catch (e) {
            console.warn('⚠️ Lỗi khi quét phòng ban:', e.message);
        }
    }

    return Array.from(personMap.values());
}

// 4. Parser và Writer CSV an toàn
function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseLine = (line) => {
        const row = [];
        let inQuotes = false;
        let current = '';
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                if (inQuotes && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (char === ',' && !inQuotes) {
                row.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        row.push(current.trim());
        return row;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(line => {
        const values = parseLine(line);
        const obj = {};
        headers.forEach((h, idx) => {
            obj[h] = values[idx] || '';
        });
        return obj;
    });

    return { headers, rows };
}

function toCSV(headers, rows) {
    const escapeVal = (val) => {
        const str = String(val || '');
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };

    const headerLine = headers.map(escapeVal).join(',');
    const dataLines = rows.map(r => headers.map(h => escapeVal(r[h])).join(','));
    return [headerLine, ...dataLines].join('\n');
}

// 5. Tiến trình đồng bộ
async function runSync() {
    if (!fs.existsSync(DATA_DIR)) {
        console.error(`❌ Thư mục không tồn tại: ${DATA_DIR}`);
        return;
    }

    const allPersons = await fetchAllHanetPersons();
    console.log(`🚀 Bắt đầu phân loại và đồng bộ ${allPersons.length} nhân sự vào thư mục data/...`);

    // Gom dữ liệu theo Mã Lớp dựa trên aliasID
    // Format: [PhongBan]_[MaLop]_[4KyTu] -> Mã Lớp bỏ hết '_' và chuyển IN HOA
    const classMap = new Map();

    allPersons.forEach(p => {
        const alias = p.aliasID?.trim();
        if (!alias) return;

        const parts = alias.split('_');
        if (parts.length < 2) return;

        let maLop = '';
        if (parts.length === 2) {
            maLop = parts[0].toUpperCase();
        } else {
            maLop = parts.slice(1, -1).join('').toUpperCase();
        }

        if (!classMap.has(maLop)) {
            classMap.set(maLop, []);
        }

        classMap.get(maLop).push({
            originalName: p.name || '',
            normName: normalizeName(p.name || ''),
            personID: String(p.personID || p.id || ''),
            avatar: p.avatar || ''
        });
    });

    console.log(`📌 Phân tách được ${classMap.size} nhóm lớp từ dữ liệu Cloud:`, Array.from(classMap.keys()).join(', '));

    const csvFiles = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.csv'));
    let totalUpdated = 0;
    let totalFilesUpdated = 0;

    for (const fileName of csvFiles) {
        const classNameInFile = path.basename(fileName, path.extname(fileName)).replace(/_/g, '').toUpperCase();
        const cloudMembers = classMap.get(classNameInFile);

        if (!cloudMembers || cloudMembers.length === 0) {
            console.log(`⏩ [BỎ QUA] Không tìm thấy dữ liệu Cloud cho file: ${fileName} (Mã lớp: ${classNameInFile})`);
            continue;
        }

        const filePath = path.join(DATA_DIR, fileName);
        const content = fs.readFileSync(filePath, 'utf8');
        const { headers, rows } = parseCSV(content);

        let personIdCol = headers.find(h => /^(personid|person\s*id)$/i.test(h)) || 'PersonID';
        let linksCol = headers.find(h => /^links?$/i.test(h)) || 'links';
        let nameCol = headers.find(h => /^(ten|tên|ho\s*ten|họ\s*tên|name)$/i.test(h)) || 'Tên';

        if (!headers.includes(personIdCol)) headers.push(personIdCol);
        if (!headers.includes(linksCol)) headers.push(linksCol);

        let fileUpdatedCount = 0;

        rows.forEach(row => {
            const csvNormName = normalizeName(row[nameCol]);
            if (!csvNormName) return;

            // Khớp chính xác tên đã loại bỏ dấu tiếng Việt và ký tự đặc biệt
            const matched = cloudMembers.find(m => m.normName === csvNormName);

            if (matched) {
                row[personIdCol] = matched.personID;
                row[linksCol] = matched.avatar;
                fileUpdatedCount++;
                totalUpdated++;
            }
        });

        if (fileUpdatedCount > 0) {
            const newCsvContent = toCSV(headers, rows);
            fs.writeFileSync(filePath, newCsvContent, 'utf8');
            console.log(`📝 [${fileName}]: Đã khớp & cập nhật ${fileUpdatedCount}/${rows.length} người.`);
            totalFilesUpdated++;
        } else {
            console.log(`⚠️ [${fileName}]: Không có tên nào khớp với ${cloudMembers.length} người thuộc lớp này trên Cloud.`);
        }
    }

    console.log(`\n=================================================`);
    console.log(`--- HOÀN TẤT ĐỒNG BỘ TOÀN BỘ DỮ LIỆU TỪ HANET ---`);
    console.log(`- Tổng số nhân sự Cloud thu được : ${allPersons.length}`);
    console.log(`- Số file lớp CSV đã cập nhật    : ${totalFilesUpdated}`);
    console.log(`- Tổng số người đã khớp & ghi đè : ${totalUpdated}`);
    console.log(`=================================================\n`);
}

runSync().catch(console.error);
