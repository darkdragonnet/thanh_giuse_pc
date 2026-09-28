require('dotenv').config();
const path = require('path');
const hanetService = require('../src/services/hanetService');

// Bảng ánh xạ tiền tố -> Tên phòng ban & ID mặc định
const PREFIX_MAPPING = {
  'TG1': { name: 'Gia Trưởng',    defaultId: null },
  'TN':  { name: 'Thiếu Nhi',     defaultId: '990653' },
  'LM':  { name: 'Legiô Mariae',  defaultId: '990730' },
  'TG':  { name: 'Giới Trẻ',      defaultId: '990731' },
  'HM':  { name: 'Hiền Mẫu',      defaultId: null }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper bóc tách mảng dữ liệu an toàn từ response HANET
function extractArray(res) {
  if (!res) return [];
  let d = res;
  if (typeof d === 'string') {
    try { d = JSON.parse(d); } catch (e) { return []; }
  }
  if (Array.isArray(d)) return d;
  if (d.data) {
    let sub = d.data;
    if (typeof sub === 'string') {
      try { sub = JSON.parse(sub); } catch (e) { return []; }
    }
    if (Array.isArray(sub)) return sub;
    if (sub.data && Array.isArray(sub.data)) return sub.data;
  }
  return [];
}

async function main() {
  console.log('🚀 Bắt đầu quét và phục hồi phòng ban từ AliasID...');

  // 1. Lấy danh sách phòng ban
  console.log('📋 Đang lấy danh sách phòng ban hiện tại từ Cloud...');
  const deptListRes = await hanetService.getDepartmentList(1, 100, '');
  const existingDepts = extractArray(deptListRes);
  console.log(`   Tìm thấy ${existingDepts.length} phòng ban trên Cloud.`);

  // Map tên phòng ban -> ID
  const deptNameToId = {};
  for (const dept of existingDepts) {
    const name = dept.department_name || dept.name || '';
    const id = dept.id || dept.department_id;
    if (name && id) {
      deptNameToId[name.trim().toLowerCase()] = id.toString();
    }
  }

  // 2. Xác định hoặc tạo mới phòng ban
  const finalDeptMap = {};
  for (const [prefix, info] of Object.entries(PREFIX_MAPPING)) {
    const key = info.name.trim().toLowerCase();
    if (deptNameToId[key]) {
      finalDeptMap[prefix] = deptNameToId[key];
    } else if (info.defaultId) {
      finalDeptMap[prefix] = info.defaultId;
    } else {
      console.log(`➕ Đang tạo mới phòng ban "${info.name}" trên HANET Cloud...`);
      try {
        const createRes = await hanetService.createDepartment(info.name, `Phòng ban ${info.name}`);
        const resData = (createRes && createRes.data) ? createRes.data : createRes;
        const newId = resData.id || (typeof resData === 'object' && resData.data && resData.data.id);
        if (newId) {
          finalDeptMap[prefix] = newId.toString();
          console.log(`   -> Tạo thành công "${info.name}" (ID: ${finalDeptMap[prefix]})`);
        }
      } catch (err) {
        console.error(`   ❌ Lỗi tạo phòng ban "${info.name}":`, err.message);
      }
    }
  }

  console.log('\n📌 Bảng ID phòng ban sử dụng:', finalDeptMap);

  // 3. Lấy toàn bộ nhân sự tại Place
  console.log('\n👥 Đang lấy danh sách nhân sự từ HANET Cloud...');
  const placeRes = await hanetService.getListByPlace();
  const persons = extractArray(placeRes);
  console.log(`   Tổng cộng: ${persons.length} nhân sự trên Cloud.`);

  // 4. Lọc nhân sự bị thiếu phòng ban
  const pendingByDept = {};
  for (const prefix of Object.keys(finalDeptMap)) {
    pendingByDept[finalDeptMap[prefix]] = [];
  }

  let countMissing = 0;
  for (const p of persons) {
    const alias = (p.aliasID || '').trim().toUpperCase();
    const deptId = p.department_id || p.departmentID;
    const hasDept = deptId && deptId !== '0' && deptId !== 0;

    if (!hasDept && alias) {
      let matchedPrefix = null;
      if (alias.startsWith('TG1_') || alias.startsWith('TG1')) {
        matchedPrefix = 'TG1';
      } else {
        const p2 = alias.substring(0, 2);
        if (PREFIX_MAPPING[p2]) {
          matchedPrefix = p2;
        }
      }

      if (matchedPrefix && finalDeptMap[matchedPrefix]) {
        const targetDeptId = finalDeptMap[matchedPrefix];
        pendingByDept[targetDeptId].push({
          id: p.id || p.personID,
          name: p.name,
          aliasID: alias
        });
        countMissing++;
      }
    }
  }

  console.log(`🔍 Tìm thấy ${countMissing} nhân sự bị thiếu phòng ban.`);

  // 5. Gán vào phòng ban qua hàm addPersonsToDepartment
  for (const [deptId, list] of Object.entries(pendingByDept)) {
    if (list.length === 0) continue;

    console.log(`\n⚙️ Đang gán ${list.length} người vào Phòng Ban ID: ${deptId}...`);
    const batchSize = 20;
    for (let i = 0; i < list.length; i += batchSize) {
      const batch = list.slice(i, i + batchSize);
      const personIds = batch.map((item) => item.id);

      try {
        await hanetService.addPersonsToDepartment(deptId, personIds);
        console.log(`   ✅ Đã gán thành công ${batch.length} người (${i + 1} - ${i + batch.length})`);
        batch.forEach(item => console.log(`      - [${item.aliasID}] ${item.name}`));
      } catch (err) {
        console.error(`   ❌ Lỗi khi gán nhóm [${personIds.join(', ')}]:`, err.message);
      }

      await sleep(1000);
    }
  }

  console.log('\n🎉 Hoàn tất khôi phục phòng ban cho tất cả nhân sự!');
}

main().catch((err) => {
  console.error('❌ Lỗi tiến trình:', err);
  process.exit(1);
});
