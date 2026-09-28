require('dotenv').config();
const axios = require('axios');
const qs = require('qs');
const hanetService = require('./src/services/hanetService');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const API_BASE = process.env.HANET_API_BASE || 'https://partner.hanet.ai';
const PLACE_ID = process.env.HANET_PLACE_ID || '998577';

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function generateRandomCode() {
    let code = '';
    do {
        code = '';
        for (let i = 0; i < 4; i++) {
            code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
        }
    } while (code.startsWith('00'));
    return code;
}

// 1. Gọi API lấy TOÀN BỘ danh sách không bị sót
async function getAllPersonsFromHanet() {
    const token = await hanetService.getAccessToken();
    console.log('📡 Đang gọi POST /person/getListByPlace...');
    
    const payload = qs.stringify({
        token: token,
        placeID: PLACE_ID
    });

    const response = await axios.post(`${API_BASE}/person/getListByPlace`, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 25000
    });

    let list = response.data?.data || [];
    console.log(`✅ Lấy thành công ${list.length} nhân sự từ Cloud.`);
    return list;
}

// 2. Hàm gọi cập nhật aliasID
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

async function processNormalize() {
    let persons = [];
    try {
        persons = await getAllPersonsFromHanet();
    } catch (err) {
        console.error('❌ Lỗi khi lấy danh sách từ Cloud:', err.response?.data || err.message);
        return;
    }

    // Tập hợp toàn bộ alias để tránh sinh mã 4 ký tự trùng
    const existingAliases = new Set();
    persons.forEach(p => {
        if (p.aliasID) existingAliases.add(p.aliasID.trim().toUpperCase());
    });

    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    console.log(`\n🚀 Bắt đầu quét và chuẩn hóa toàn bộ Alias ID...\n`);

    for (const person of persons) {
        const originalAlias = person.aliasID?.trim();
        const personID = person.personID || person.id;

        if (!originalAlias || !personID) {
            skippedCount++;
            continue;
        }

        const parts = originalAlias.split('_');

        // Phải có ít nhất 1 dấu gạch dưới (VD: GLV_0001 hoặc TN_ThemSuc_1a_EP29)
        if (parts.length < 2) {
            console.log(`⏩ [BỎ QUA] Mã không chứa dấu '_': ${originalAlias}`);
            skippedCount++;
            continue;
        }

        let maPhongBan = '';
        let maLop = '';
        let suffix = '';

        if (parts.length === 2) {
            // Dạng 2 phần: [Lớp/PB]_[Mã] (VD: GLV_0001)
            maPhongBan = parts[0].toUpperCase();
            maLop = '';
            suffix = parts[1];
        } else {
            // Dạng >= 3 phần: [PhòngBan]_[Lớp...]_[Mã]
            // Ví dụ: TN_ThemSuc_1a_EP29 -> parts: ['TN', 'ThemSuc', '1a', 'EP29']
            maPhongBan = parts[0].toUpperCase();
            suffix = parts[parts.length - 1]; // Phần tử cuối cùng là mã phân biệt
            // Tất cả phần ở giữa là mã lớp: bỏ hết dấu _ và CHUYỂN IN HOA
            maLop = parts.slice(1, -1).join('').toUpperCase(); // 'ThemSuc' + '1a' -> 'THEMSUC1A'
        }

        // Kiểm tra phần mã đuôi suffix:
        // Nếu là dạng số thứ tự cũ (0001, 0012, 00xx) hoặc không đúng 4 ký tự -> sinh mã 4 ký tự ngẫu nhiên
        const isLegacySuffix = /^00[0-9A-Za-z]{1,2}$/i.test(suffix) || suffix.startsWith('00') || suffix.length !== 4;

        let finalSuffix = '';
        if (isLegacySuffix) {
            let candidate = '';
            do {
                finalSuffix = generateRandomCode();
                candidate = maLop ? `${maPhongBan}_${maLop}_${finalSuffix}` : `${maPhongBan}_${finalSuffix}`;
            } while (existingAliases.has(candidate.toUpperCase()));
        } else {
            // Đã là 4 ký tự đẹp (EP29, ZVP4, 9S71...) -> Giữ nguyên và IN HOA
            finalSuffix = suffix.toUpperCase();
        }

        // Tạo aliasID chuẩn hóa cuối cùng
        const newAliasID = maLop ? `${maPhongBan}_${maLop}_${finalSuffix}` : `${maPhongBan}_${finalSuffix}`;

        // Nếu mã đã đúng chuẩn 100% thì không cần gọi API
        if (originalAlias === newAliasID) {
            skippedCount++;
            continue;
        }

        console.log(`Đang chuẩn hóa: ${originalAlias} ➔ ${newAliasID} (ID: ${personID})`);
        existingAliases.add(newAliasID.toUpperCase());

        try {
            const res = await updatePersonAliasID(personID, newAliasID);
            if (res.returnCode === 1) {
                console.log(`✅ Thành công: ${newAliasID}`);
                updatedCount++;
            } else {
                console.error(`❌ Thất bại ${newAliasID}: ${res.returnMessage}`);
                failedCount++;
            }
            await sleep(300); // Tránh chạm rate limit của HANET
        } catch (err) {
            console.error(`❌ [Lỗi Gọi API] ${newAliasID}:`, err.response?.data || err.message);
            failedCount++;
            await sleep(500);
        }
    }

    console.log(`\n=================================================`);
    console.log(`--- HOÀN TẤT CHUẨN HÓA TOÀN BỘ ALIAS ID TRÊN CLOUD ---`);
    console.log(`- Đã cập nhật thành công   : ${updatedCount}`);
    console.log(`- Thất bại                 : ${failedCount}`);
    console.log(`- Đã chuẩn sẵn (Bỏ qua)    : ${skippedCount}`);
    console.log(`=================================================\n`);
}

processNormalize().catch(console.error);
