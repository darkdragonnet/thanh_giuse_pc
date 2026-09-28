require('dotenv').config();
const axios = require('axios');
const qs = require('qs');
const hanetService = require('./src/services/hanetService'); 

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const API_BASE = process.env.HANET_API_BASE || 'https://partner.hanet.ai';
const PLACE_ID = process.env.HANET_PLACE_ID || '998577';

// 1. Quét danh sách nhân sự
async function fetchAllHanetPersonsSafely() {
    const token = await hanetService.getAccessToken();
    const personMap = new Map();

    console.log(`📡 Đang quét danh sách nhân sự từ Hanet Cloud...`);
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

// 2. Gọi endpoint chuyên dụng /person/updateAliasID với param newAliasID
async function updateAliasID(personID, newAliasID) {
    const token = await hanetService.getAccessToken();

    // HANET yêu cầu cả newAliasID và aliasID để tương thích mọi phiên bản gateway
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

// 3. Thực thi cập nhật
async function processForceUpdate() {
    let persons = [];
    try {
        persons = await fetchAllHanetPersonsSafely();
    } catch (err) {
        console.error('❌ Lỗi khi tải dữ liệu Cloud:', err.message);
        return;
    }

    console.log(`\n🔥 Tổng số nhân sự thu thập được: ${persons.length} người.`);
    if (persons.length === 0) return;

    let updatedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    console.log(`\n🚀 BẮT ĐẦU CẬP NHẬT QUA /person/updateAliasID...\n`);

    for (const person of persons) {
        const originalAlias = person.aliasID ? String(person.aliasID).trim() : '';
        const personID = person.personID || person.id;

        if (!originalAlias || !personID) {
            skippedCount++;
            continue;
        }

        const parts = originalAlias.split('_');
        if (parts.length < 3) {
            skippedCount++;
            continue;
        }

        const phongBan = parts[0].toUpperCase();
        const suffix = parts[parts.length - 1].toUpperCase();
        const middleParts = parts.slice(1, -1);
        const tenLopClean = middleParts.join('').toUpperCase(); 
        const newAliasID = `${phongBan}_${tenLopClean}_${suffix}`;

        if (originalAlias === newAliasID) {
            skippedCount++;
            continue;
        }

        console.log(`Đang xử lý: ${originalAlias} ➔ ${newAliasID} (ID: ${personID})`);

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
    console.log(`--- HOÀN TẤT ĐỒNG BỘ ALIAS ID ---`);
    console.log(`- Đã cập nhật thành công   : ${updatedCount}`);
    console.log(`- Thất bại                 : ${failedCount}`);
    console.log(`- Đã chuẩn sẵn / Bỏ qua    : ${skippedCount}`);
    console.log(`=================================================\n`);
}

processForceUpdate().catch(console.error);
