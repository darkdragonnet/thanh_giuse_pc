require('dotenv').config();
const axios = require('axios');
const qs = require('qs');
const crypto = require('crypto');
const hanetService = require('./src/services/hanetService'); 

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const API_BASE = process.env.HANET_API_BASE || 'https://partner.hanet.ai';
const PLACE_ID = process.env.HANET_PLACE_ID || '998577';

// Sinh 4 ký tự ngẫu nhiên gồm chữ in hoa và số (A-Z, 0-9)
function generateRandomSuffix() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    const bytes = crypto.randomBytes(4);
    for (let i = 0; i < 4; i++) {
        result += chars[bytes[i] % chars.length];
    }
    return result;
}

// 1. Quét danh sách nhân sự từ Cloud
async function fetchAllHanetPersonsSafely() {
    const token = await hanetService.getAccessToken();
    const personMap = new Map();

    console.log(`📡 Đang tải danh sách nhân sự từ Hanet Cloud...`);
    let page = 1;
    let keepPaging = true;
    
    while (keepPaging && page <= 50) { 
        try {
            const payload = qs.stringify({ 
                token: token, 
                placeID: PLACE_ID,
                page: page,
                size: 50 
            });

            const pRes = await axios.post(`${API_BASE}/person/getListByPlace`, payload, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 15000
            });

            const deptMembers = pRes.data?.data || [];
            
            if (Array.isArray(deptMembers) && deptMembers.length > 0) {
                deptMembers.forEach(p => {
                    const id = String(p.personID || p.id || '').trim();
                    if (id && !personMap.has(id)) {
                        personMap.set(id, p);
                    }
                });
                
                console.log(`   + Trang ${page}: Lấy được ${deptMembers.length} người (Tổng gom: ${personMap.size})`);
                
                if (deptMembers.length < 50) {
                    keepPaging = false; 
                } else {
                    page++;
                    await sleep(200);
                }
            } else {
                keepPaging = false; 
            }
        } catch (err) {
            console.error(`   ❌ Lỗi quét trang ${page}:`, err.message);
            break;
        }
    }

    return Array.from(personMap.values());
}

// 2. Cập nhật qua API /person/updateAliasID
async function updateAliasID(personID, newAliasID) {
    const token = await hanetService.getAccessToken();

    const payload = qs.stringify({
        token: token,
        placeID: PLACE_ID,
        personID: String(personID).trim(),
        newAliasID: String(newAliasID).trim(),
        aliasID: String(newAliasID).trim()
    });

    const response = await axios.post(`${API_BASE}/person/updateAliasID`, payload, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000
    });
    return response.data;
}

// 3. Xử lý chuẩn hoá đuôi 00xx / 000x
async function processRandomizeSuffix() {
    let persons = [];
    try {
        persons = await fetchAllHanetPersonsSafely();
    } catch (err) {
        console.error('❌ Lỗi khi tải dữ liệu Cloud:', err.message);
        return;
    }

    console.log(`\n🔥 Tổng số nhân sự thu thập được: ${persons.length} người.`);
    if (persons.length === 0) return;

    // Lưu các aliasID hiện có vào Set để chống trùng lặp tuyệt đối
    const usedAliases = new Set(persons.map(p => (p.aliasID || '').toUpperCase().trim()));

    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    console.log(`\n🚀 BẮT ĐẦU CHUẨN HOÁ HẬU TỐ 00xx / 000x SANG MÃ 4 KÝ TỰ NGẪU NHIÊN...\n`);

    // Regex phát hiện các hậu tố dạng 00xx hoặc 000x (4 ký tự bắt đầu bằng ít nhất hai số 0)
    const legacySuffixRegex = /^00[0-9A-Z]{2}$/i;

    for (const person of persons) {
        const originalAlias = person.aliasID ? String(person.aliasID).trim() : '';
        const personID = person.personID || person.id;

        if (!originalAlias || !personID) {
            skippedCount++;
            continue;
        }

        const parts = originalAlias.split('_');
        if (parts.length < 2) {
            skippedCount++;
            continue;
        }

        const suffix = parts[parts.length - 1];

        // Kiểm tra nếu hậu tố là dạng 00xx hoặc 000x
        if (!legacySuffixRegex.test(suffix)) {
            skippedCount++;
            continue;
        }

        const prefixParts = parts.slice(0, -1).map(p => p.toUpperCase());
        const basePrefix = prefixParts.join('_');

        // Sinh hậu tố ngẫu nhiên mới, đảm bảo không trùng với mã nào khác
        let newSuffix = '';
        let newAliasID = '';
        do {
            newSuffix = generateRandomSuffix();
            newAliasID = `${basePrefix}_${newSuffix}`;
        } while (usedAliases.has(newAliasID));

        usedAliases.add(newAliasID);

        console.log(`Đang đổi: ${originalAlias} ➔ ${newAliasID} (ID: ${personID})`);

        try {
            const res = await updateAliasID(personID, newAliasID);
            
            if (res && res.returnCode === 1) {
                console.log(`✅ Cập nhật thành công: ${newAliasID}`);
                updatedCount++;
            } else {
                console.error(`❌ Thất bại ${newAliasID}:`, res);
                failedCount++;
            }
            await sleep(350); 
        } catch (err) {
            console.error(`❌ [Lỗi HTTP] ${newAliasID}:`, err.response?.data || err.message);
            failedCount++;
            await sleep(600);
        }
    }

    console.log(`\n=================================================`);
    console.log(`--- HOÀN TẤT CHUẨN HOÁ HẬU TỐ ---`);
    console.log(`- Đã cập nhật thành công   : ${updatedCount}`);
    console.log(`- Thất bại                 : ${failedCount}`);
    console.log(`- Đã chuẩn sẵn / Bỏ qua    : ${skippedCount}`);
    console.log(`=================================================\n`);
}

processRandomizeSuffix().catch(console.error);
