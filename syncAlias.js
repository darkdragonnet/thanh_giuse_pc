require('dotenv').config();
const axios = require('axios');
const qs = require('qs');
const hanetService = require('./src/services/hanetService'); 

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const API_BASE = process.env.HANET_API_BASE || 'https://partner.hanet.ai';
const PLACE_ID = process.env.HANET_PLACE_ID || '998577';

// Bảng ký tự sinh mã 4 ký tự ngẫu nhiên (chữ và số in hoa)
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function generateRandomCode() {
    let code = '';
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
        }
    } while (code.startsWith('00')); // Không bắt đầu bằng 00
    return code;
}

// 1. Lấy danh sách nhân sự từ HANET Cloud (hỗ trợ phân trang nếu có)
async function getAllPersons() {
    const token = await hanetService.getAccessToken(); 
    let allPersons = [];
    let page = 1;

    while (page <= 20) {
        const payload = qs.stringify({ 
            token: token, 
            placeID: PLACE_ID,
            page: page 
        });

        const response = await axios.post(`${API_BASE}/person/getListByPlace`, payload, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 10000
        });

        const list = response.data?.data || [];
        if (!Array.isArray(list) || list.length === 0) break;

        // Tránh lặp vô hạn nếu API không hỗ trợ page mà trả về trùng lặp trang 1
        if (allPersons.length > 0 && String(allPersons[0]?.id || allPersons[0]?.personID) === String(list[0]?.id || list[0]?.personID)) {
            break;
        }

        allPersons.push(...list);
        if (list.length < 50) break; // Đã lấy hết danh sách
        page++;
    }

    return allPersons;
}

// 2. Gọi trực tiếp API cập nhật Alias ID trên HANET Cloud
async function updatePersonAliasID(personID, newAliasID) {
    const token = await hanetService.getAccessToken();
    const payload = qs.stringify({
        token: token,
        personID: String(personID),
        newAliasID: String(newAliasID).trim()
    });

    const response = await axios.post(`${API_BASE}/person/updateAliasID`, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
    });
    return response.data;
}

async function processSync() {
    console.log('Đang lấy danh sách nhân sự từ HANET Cloud...');
    let persons = [];
    try {
        persons = await getAllPersons();
    } catch (e) {
        console.error('Không thể lấy danh sách từ Cloud. Vui lòng kiểm tra lại token và kết nối mạng.');
        return;
    }

    console.log(`Tìm thấy tổng cộng: ${persons.length} nhân sự trên Cloud.`);

    // Tập hợp danh sách các mã alias hiện có để tránh sinh trùng
    const existingAliases = new Set();
    persons.forEach(p => {
        if (p.aliasID) existingAliases.add(p.aliasID.trim().toUpperCase());
    });

    let successCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const person of persons) {
        const originalAlias = person.aliasID?.trim();
        const personID = person.personID || person.id; 

        if (!originalAlias || !personID) {
            skippedCount++;
            continue;
        }

        const parts = originalAlias.split('_');
        if (parts.length < 2) {
             console.log(`[BỎ QUA] aliasID không chứa dấu '_': ${originalAlias}`);
             skippedCount++;
             continue;
        }
        
        // 1. Mã phòng ban (trước dấu _ đầu tiên) -> Chuyển IN HOA
        const maPhongBan = parts[0].toUpperCase();

        // 2. 4 ký tự cuối (sau dấu _ cuối cùng)
        const lastPartRaw = parts[parts.length - 1];

        // 3. Mã Lớp: tất cả các phần ở giữa _ đầu và _ cuối
        // Bỏ hết dấu _ bên trong lớp và CHUYỂN IN HOA
        let maLop = '';
        if (parts.length === 2) {
            // Trường hợp chỉ có 2 phần: vd GLV_0001
            maLop = parts[0].toUpperCase();
        } else {
            // Gộp tất cả các đoạn ở giữa lại thành chuỗi liền, in hoa (vd: ThemSuc_1a -> THEMSUC1A, BaoDong_3 -> BAODONG3)
            maLop = parts.slice(1, -1).join('').toUpperCase();
        }

        // 4. Xử lý mã 4 ký tự phân biệt:
        // Nếu là dạng 000x, 00xx hoặc không đủ 4 ký tự -> sinh mã 4 ký tự ngẫu nhiên
        const isLegacyCode = /^00[0-9A-Za-z]{1,2}$/i.test(lastPartRaw) || lastPartRaw.startsWith('00') || lastPartRaw.length !== 4;

        let finalSuffix = '';
        if (isLegacyCode) {
            let candidateAlias = '';
            do {
                finalSuffix = generateRandomCode();
                candidateAlias = `${maPhongBan}_${maLop}_${finalSuffix}`;
            } while (existingAliases.has(candidateAlias.toUpperCase()));
        } else {
            finalSuffix = lastPartRaw.toUpperCase();
        }

        // Tạo mã Alias chuẩn hóa mới: tất cả IN HOA, lớp không chứa dấu _
        const newAliasID = `${maPhongBan}_${maLop}_${finalSuffix}`;
        existingAliases.add(newAliasID.toUpperCase());

        // Nếu mã hiện tại đã đúng 100% chuẩn thì bỏ qua
        if (originalAlias === newAliasID) {
           skippedCount++;
           continue; 
        }

        console.log(`Đang chuẩn hóa: ${originalAlias} ➔ ${newAliasID} (PersonID: ${personID})`);

        try {
            const res = await updatePersonAliasID(personID, newAliasID);
            
            if (res.returnCode === 1) {
                successCount++;
                console.log(`✅ Thành công: ${newAliasID}`);
            } else {
                errorCount++;
                console.error(`❌ Thất bại ${newAliasID}: ${res.returnMessage}`);
            }
            
            // Hoãn 300ms tránh Rate Limit 429
            await sleep(300); 

        } catch (err) {
            errorCount++;
            console.error(`[Lỗi Update] MSNV: ${newAliasID}`, err.response?.data || err.message);
            await sleep(500); 
        }
    }

    console.log(`\n==============================================`);
    console.log(`--- HOÀN TẤT CHUẨN HÓA TOÀN BỘ ALIAS ID ---`);
    console.log(`- Đã cập nhật thành công   : ${successCount}`);
    console.log(`- Thất bại                 : ${errorCount}`);
    console.log(`- Đã chuẩn sẵn (Bỏ qua)    : ${skippedCount}`);
    console.log(`==============================================\n`);
}

processSync().catch(console.error);
