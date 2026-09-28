require('dotenv').config();
const axios = require('axios');
const qs = require('qs');
const hanetService = require('./src/services/hanetService'); 

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const API_BASE = process.env.HANET_API_BASE || 'https://partner.hanet.ai';
const PLACE_ID = process.env.HANET_PLACE_ID || '998577';

// Hàm lấy dữ liệu phân trang getListByPlace (vét cạn 100% nhân sự)
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
                    const id = String(p.personID || p.id || '');
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

// Gọi API cập nhật aliasID
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

async function processNormalizeClass() {
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

    console.log(`\n🚀 BẮT ĐẦU CHUẨN HÓA BỎ DẤU '_' TRONG TÊN LỚP...\n`);

    for (const person of persons) {
        const originalAlias = person.aliasID?.trim();
        const personID = person.personID || person.id;

        if (!originalAlias || !personID) {
            skippedCount++;
            continue;
        }

        // Tách AliasID theo dấu '_'
        const parts = originalAlias.split('_');
        
        // Nếu không có hoặc có ít hơn 3 phần (ví dụ chỉ có TN_GLV hoặc TN_0001 không phải cấu trúc PhòngBan_TênLớp_Mã) thì giữ nguyên
        if (parts.length < 3) {
            skippedCount++;
            continue;
        }

        // Logic chuẩn xác theo yêu cầu:
        // - Phần đầu tiên: Phòng ban (ví dụ: TN) -> Giữ nguyên (hoặc In hoa)
        // - Phần cuối cùng: Mã 4 ký tự phân biệt (ví dụ: EP29, ZVP4) -> Giữ nguyên
        // - Các phần ở giữa: Tên lớp có thể bị dính dấu gạch dưới (ví dụ: ['ThemSuc', '1a'] hoặc ['BaoDong', '3'])
        // Ta sẽ gộp các phần ở giữa lại, loại bỏ TOÀN BỘ dấu '_' bên trong và chuyển thành chữ IN HOA.
        
        const phongBan = parts[0].toUpperCase();
        const suffix = parts[parts.length - 1].toUpperCase();
        
        // Lấy tất cả các phần ở giữa và nối liền lại, loại bỏ mọi dấu '_'
        const middleParts = parts.slice(1, -1);
        const tenLopClean = middleParts.join('').toUpperCase(); // ThemSuc + 1a -> THEMSUC1A ; BaoDong + 3 -> BAODONG3

        // Ghép lại thành aliasID mới hoàn chỉnh
        const newAliasID = `${phongBan}_${tenLopClean}_${suffix}`;

        // Nếu mã cũ và mới giống hệt nhau thì bỏ qua
        if (originalAlias === newAliasID) {
            skippedCount++;
            continue;
        }

        console.log(`Đang đổi: ${originalAlias} ➔ ${newAliasID} (ID: ${personID})`);

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
            console.error(`❌ [Lỗi API] ${newAliasID}:`, err.message);
            failedCount++;
            await sleep(500);
        }
    }

    console.log(`\n=================================================`);
    console.log(`--- HOÀN TẤT LOẠI BỎ DẤU '_' TRONG TÊN LỚP ---`);
    console.log(`- Đã cập nhật thành công   : ${updatedCount}`);
    console.log(`- Thất bại                 : ${failedCount}`);
    console.log(`- Đã chuẩn sẵn / Bỏ qua    : ${skippedCount}`);
    console.log(`=================================================\n`);
}

processNormalizeClass().catch(console.error);
