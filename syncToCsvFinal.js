require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const qs = require('qs');
const hanetService = require('./src/services/hanetService'); 

const API_BASE = process.env.HANET_API_BASE || 'https://partner.hanet.ai';
const PLACE_ID = process.env.HANET_PLACE_ID || '998577';
const DATA_DIR = path.join(__dirname, 'data');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function normalizeName(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') 
        .replace(/đ/g, 'd').replace(/Đ/g, 'd')
        .replace(/[^a-zA-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')           
        .trim()
        .toLowerCase();
}

async function fetchAllHanetPersonsSafely() {
    const token = await hanetService.getAccessToken();
    const personMap = new Map();

    console.log(`📡 Đang tải danh sách nhân sự (Phân trang qua getListByPlace)...`);
    
    let page = 1;
    const size = 50;
    
    // Lặp cứng 20 trang để đảm bảo lấy vét cạn (20 trang x 50 = 1000 người, đủ dư dả cho 83 người)
    while (page <= 20) {
        try {
            const payload = qs.stringify({ 
                token: token, 
                placeID: PLACE_ID,
                page: page,
                size: size // Chèn thêm param size để an toàn
            });

            const res = await axios.post(`${API_BASE}/person/getListByPlace`, payload, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 15000
            });

            const list = res.data?.data || [];
            
            if (!Array.isArray(list) || list.length === 0) {
                console.log(`   + Trang ${page} rỗng. Dừng quét.`);
                break;
            }

            let newInPage = 0;
            list.forEach(p => {
                const id = String(p.personID || p.id || '');
                if (id && !personMap.has(id)) {
                    personMap.set(id, p);
                    newInPage++;
                }
            });

            console.log(`   + Trang ${page}: Lấy ${list.length} người. (Mới thêm: ${newInPage} | Tổng gom: ${personMap.size})`);
            
            // Chỉ dừng khi số lượng bản ghi trả về ít hơn 50
            if (list.length < size) {
                break;
            }
            
            page++;
            await sleep(200);

        } catch (err) {
            console.error(`   ❌ Lỗi quét trang ${page}:`, err.message);
            break;
        }
    }

    console.log(`✅ Tổng cộng lấy được ${personMap.size} nhân sự từ Cloud.`);
    return Array.from(personMap.values());
}

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
                if (inQuotes && line[i + 1] === '"') { current += '"'; i++; } 
                else { inQuotes = !inQuotes; }
            } else if (char === ',' && !inQuotes) {
                row.push(current.trim());
                current = '';
            } else { current += char; }
        }
        row.push(current.trim());
        return row;
    };

    const headers = parseLine(lines[0]);
    const rows = lines.slice(1).map(line => {
        const values = parseLine(line);
        const obj = {};
        headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
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

async function runSyncToCsv() {
    if (!fs.existsSync(DATA_DIR)) {
        console.error(`❌ Thư mục không tồn tại: ${DATA_DIR}`);
        return;
    }

    const allPersons = await fetchAllHanetPersonsSafely();
    if (allPersons.length === 0) {
        console.log('Không có dữ liệu Cloud để đồng bộ.');
        return;
    }

    console.log(`\n🚀 Phân tách dữ liệu Cloud theo Mã Lớp...`);
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

        if (!classMap.has(maLop)) classMap.set(maLop, []);
        classMap.get(maLop).push({
            normName: normalizeName(p.name || ''),
            personID: String(p.personID || p.id || ''),
            avatar: p.avatar || ''
        });
    });

    console.log(`📌 Phân loại được ${classMap.size} nhóm Lớp.`);

    const csvFiles = fs.readdirSync(DATA_DIR).filter(f => f.toLowerCase().endsWith('.csv'));
    let totalFilesUpdated = 0;
    let totalUpdated = 0;

    for (const fileName of csvFiles) {
        const classNameInFile = path.basename(fileName, path.extname(fileName)).toUpperCase().replace(/_/g, '');
        const cloudMembers = classMap.get(classNameInFile);

        if (!cloudMembers || cloudMembers.length === 0) continue;

        const filePath = path.join(DATA_DIR, fileName);
        const content = fs.readFileSync(filePath, 'utf8');
        const { headers, rows } = parseCSV(content);

        let personIdCol = headers.find(h => /^(personid|person\s*id)$/i.test(h));
        let linksCol = headers.find(h => /^links?$/i.test(h));
        let nameCol = headers.find(h => /^(ten|tên|ho\s*ten|họ\s*tên|name)$/i.test(h));

        if (!nameCol) {
            console.warn(`⚠️ Bỏ qua ${fileName}: Không tìm thấy cột Tên/Họ tên.`);
            continue;
        }

        if (!personIdCol) { personIdCol = 'PersonID'; headers.push(personIdCol); }
        if (!linksCol) { linksCol = 'links'; headers.push(linksCol); }

        let fileUpdatedCount = 0;

        rows.forEach(row => {
            const csvNormName = normalizeName(row[nameCol]);
            if (!csvNormName) return;

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
        }
    }

    console.log(`\n=================================================`);
    console.log(`--- HOÀN TẤT ĐỒNG BỘ DỮ LIỆU TỪ CLOUD XUỐNG CSV ---`);
    console.log(`- Số lượng người quét được trên Cloud : ${allPersons.length}`);
    console.log(`- Số file CSV được cập nhật           : ${totalFilesUpdated}`);
    console.log(`- Tổng số học sinh/nhân viên đã khớp  : ${totalUpdated}`);
    console.log(`=================================================\n`);
}

runSyncToCsv().catch(console.error);
