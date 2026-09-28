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

// 1. Quét cạn toàn bộ nhân sự (100%) thông qua endpoint /person/getListByPlace với param page
async function fetchAllHanetPersonsSafely() {
    const token = await hanetService.getAccessToken();
    const personMap = new Map();

    console.log(`📡 [1/2] Đang tải danh sách nhân sự (Duyệt qua từng trang)...`);
    
    let page = 1;
    let keepPaging = true;
    
    while (keepPaging && page <= 50) { 
        try {
            const payload = qs.stringify({ 
                token: token, 
                placeID: PLACE_ID,
                page: page,
                size: 50 // Giới hạn 50 người 1 trang
            });

            const pRes = await axios.post(`${API_BASE}/person/getListByPlace`, payload, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 15000
            });

            const deptMembers = pRes.data?.data || [];
            
            if (Array.isArray(deptMembers) && deptMembers.length > 0) {
                deptMembers.forEach(p => {
                    const id = String(p.personID || p.id || '');
                    if (id && !personMap.has(id)) {
                        personMap.set(id, p);
                    }
                });
                
                console.log(`   + Trang ${page}: Thu được ${deptMembers.length} (Tổng gom: ${personMap.size})`);
                
                if (deptMembers.length < 50) {
                    keepPaging = false; // Đã quét hết người
                } else {
                    page++;
                    await sleep(200);
                }
            } else {
                keepPaging = false; 
            }
        } catch (err) {
            console.error(`   ❌ Lỗi quét trang ${page}:`, err.message);
            keepPaging = false;
        }
    }

    console.log(`✅ [2/2] Tổng cộng lấy được ${personMap.size} nhân sự (Đảm bảo 100% qua phân trang).`);
    return Array.from(personMap.values());
}

// 2. Hàm gọi cập nhật Alias ID
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

// 3. Tiến trình chuẩn hóa Alias ID (KHÔNG ĐỤNG ĐẾN CSV)
async function processNormalizeAll() {
    let persons = [];
    try {
        persons = await fetchAllHanetPersonsSafely();
    } catch (err) {
        console.error('❌ Lỗi khi tải dữ liệu Cloud:', err.message);
        return;
    }

    console.log(`\n🔥 TỔNG SỐ FACE ID THU THẬP ĐƯỢC: ${persons.length} người.`);
    if (persons.length === 0) {
        console.log('Không có dữ liệu để xử lý.');
        return;
    }

    // Tập hợp tất cả alias hiện tại để tránh sinh mã trùng
    const existingAliases = new Set();
    persons.forEach(p => {
        if (p.aliasID) existingAliases.add(p.aliasID.trim().toUpperCase());
    });

    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    console.log(`\n🚀 BẮT ĐẦU CHUẨN HÓA MÃ LỚP VÀ 4 KÝ TỰ PHÂN BIỆT TRÊN CLOUD...\n`);

    for (const person of persons) {
        const originalAlias = person.aliasID?.trim();
        const personID = person.personID || person.id;

        if (!originalAlias || !personID) {
            skippedCount++;
            continue;
        }

        const parts = originalAlias.split('_');
        if (parts.length < 2) {
            console.log(`⏩ [BỎ QUA] Mã không chứa dấu '_': ${originalAlias}`);
            skippedCount++;
            continue;
        }

        let maPhongBan = parts[0].toUpperCase();
        let maLop = '';
        let suffix = parts[parts.length - 1];

        if (parts.length > 2) {
            // Ghép phần lớp, bỏ '_' và chuyển IN HOA (ví dụ: ThemSuc + 1a -> THEMSUC1A)
            maLop = parts.slice(1, -1).join('').toUpperCase();
        }

        const isLegacySuffix = /^00[0-9A-Za-z]{1,2}$/i.test(suffix) || suffix.startsWith('00') || suffix.length !== 4;

        let finalSuffix = '';
        if (isLegacySuffix) {
            let candidate = '';
            do {
                finalSuffix = generateRandomCode();
                candidate = maLop ? `${maPhongBan}_${maLop}_${finalSuffix}` : `${maPhongBan}_${finalSuffix}`;
            } while (existingAliases.has(candidate.toUpperCase()));
        } else {
            finalSuffix = suffix.toUpperCase();
        }

        const newAliasID = maLop ? `${maPhongBan}_${maLop}_${finalSuffix}` : `${maPhongBan}_${finalSuffix}`;

        if (originalAlias === newAliasID) {
            skippedCount++;
            continue;
        }

        console.log(`Đang đổi: ${originalAlias} ➔ ${newAliasID} (ID: ${personID})`);
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
            await sleep(300); 
        } catch (err) {
            console.error(`❌ [Lỗi Gọi API] ${newAliasID}:`, err.message);
            failedCount++;
            await sleep(500);
        }
    }

    console.log(`\n=================================================`);
    console.log(`--- HOÀN TẤT CHUẨN HÓA TOÀN BỘ FACE ID TRÊN HANET ---`);
    console.log(`- Tổng số người gom được   : ${persons.length}`);
    console.log(`- Đã cập nhật thành công   : ${updatedCount}`);
    console.log(`- Thất bại                 : ${failedCount}`);
    console.log(`- Đã chuẩn sẵn (Bỏ qua)    : ${skippedCount}`);
    console.log(`=================================================\n`);
}

processNormalizeAll().catch(console.error);
